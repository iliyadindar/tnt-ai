import asyncio
import os
import subprocess
import tempfile
from typing import Optional

import argostranslate.package
import argostranslate.translate
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from faster_whisper import WhisperModel
from settings import settings

app = FastAPI(title="tnt-ai")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True
)

# ----- API Key Authentication -----
async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    if x_api_key != settings.API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return x_api_key

# ----- Load models at startup -----
print(f"Loading Faster Whisper model: {settings.WHISPER_MODEL} on CPU...")
whisper_model = WhisperModel(
    settings.WHISPER_MODEL, 
    device="cpu", 
    compute_type=settings.COMPUTE_TYPE,
    cpu_threads=settings.CPU_THREADS,   # Parallel CPU threads
    num_workers=settings.NUM_WORKERS,   # Parallel transcription workers
    download_root=settings.WHISPER_MODEL_DIR
)
print("✅ Model loaded successfully.")

# ----- Argos Translate (fully offline, no API key) -----
def _install_argos_languages():
    """Download & install required Argos Translate language packs."""
    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    # All pairs we need between en, tr, ar, fa
    required_pairs = [
        ("en", "tr"), ("tr", "en"),
        ("en", "ar"), ("ar", "en"),
        ("en", "fa"), ("fa", "en"),
        ("tr", "ar"), ("ar", "tr"),
        ("tr", "fa"), ("fa", "tr"),
        ("ar", "fa"), ("fa", "ar"),
    ]
    installed = argostranslate.package.get_installed_packages()
    installed_pairs = {(p.from_code, p.to_code) for p in installed}
    for src, tgt in required_pairs:
        if (src, tgt) in installed_pairs:
            continue
        pkg = next((p for p in available if p.from_code == src and p.to_code == tgt), None)
        if pkg:
            print(f"📦 Installing Argos language pack: {src} → {tgt}")
            argostranslate.package.install_from_path(pkg.download())
        else:
            print(f"⚠️  Argos package not found: {src} → {tgt} (will use pivot through English)")

print("🌐 Setting up Argos Translate (offline)...")
_install_argos_languages()
print("✅ Argos Translate ready.")

class TranscribeTranslateResp(BaseModel):
    transcript: str
    translation: str
    source_lang: str  # BCP-47-ish, e.g. "tr", "en", "fa"

SUPPORTED_LANG_CODES = {
    "ar": "Arabic", "en": "English", "fa": "Persian", "tr": "Turkish",
}

# Language name → Argos Translate language code
LANG_NAME_TO_CODE = {
    "English": "en",
    "Turkish": "tr",
    "Persian": "fa",
    "Arabic": "ar",
}

# Whisper expects wav/float or a file path; we normalize via ffmpeg

def to_wav(input_bytes: bytes) -> bytes:
    """Convert any audio format to 16kHz mono WAV using ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".in", delete=False) as fin:
        fin.write(input_bytes)
        fin.flush()
        in_path = fin.name
    out_path = in_path + ".wav"
    try:
        # Convert to 16kHz mono WAV (Whisper's preferred format)
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", in_path,
                "-ac", "1",           # Mono
                "-ar", "16000",       # 16kHz sample rate
                "-acodec", "pcm_s16le",  # 16-bit PCM
                "-f", "wav",          # WAV format
                out_path
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10  # 10 second timeout
        )
        
        if not os.path.exists(out_path):
            raise Exception("FFmpeg did not create output WAV file")
        
        with open(out_path, "rb") as f:
            wav_data = f.read()
        
        if len(wav_data) < 1000:
            raise Exception("Converted WAV file is too small")
        
        return wav_data
    finally:
        for p in (in_path, out_path):
            try: os.remove(p)
            except: pass

@app.post("/v1/transcribe_translate", response_model=TranscribeTranslateResp)
async def transcribe_translate(
    file: UploadFile = File(...),
    target_lang: str = Form(default=settings.DEFAULT_TARGET_LANG),
    api_key: str = Depends(verify_api_key),
):
    # target_lang is a human-readable name; pick its tokenizer/model at deploy time
    if target_lang not in LANG_NAME_TO_CODE:
        raise HTTPException(400, f"Unsupported target_lang: {target_lang}")
    target_lang_code = LANG_NAME_TO_CODE[target_lang]
    
    # Log incoming file info
    print(f"📥 Received file: {file.filename}, Content-Type: {file.content_type}")
    
    try:
        raw = await file.read()
        print(f"📦 File size: {len(raw) / 1024:.2f} KB")
        
        # Validate minimum file size
        if len(raw) < 1000:
            raise HTTPException(400, "Audio file too small - recording may be empty")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Invalid upload: {e}")

    try:
        print(f"🔄 Converting to WAV format (16kHz, mono)...")
        wav = await asyncio.to_thread(to_wav, raw)
        print(f"✅ WAV conversion successful: {len(wav) / 1024:.2f} KB")
    except subprocess.CalledProcessError as e:
        print(f"❌ FFmpeg error: {e.stderr}")
        raise HTTPException(500, f"Audio conversion failed - ensure file is valid audio format")
    except Exception as e:
        print(f"❌ Conversion error: {e}")
        raise HTTPException(500, f"Audio normalization failed: {e}")

    wav_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            tf.write(wav)
            tf.flush()
            wav_path = tf.name
        
        # Run inference using Faster Whisper (optimized for speed)
        segments, info = await asyncio.to_thread(
            whisper_model.transcribe,
            wav_path,
            beam_size=1,              # Greedy decoding = much faster, minimal quality loss
            vad_filter=True,          # Skip silence = huge speedup
            vad_parameters=dict(
                min_silence_duration_ms=500,
            ),
        )
        
        # Collect segments
        text = " ".join([segment.text for segment in segments]).strip()
        lang = info.language
        
    except Exception as e:
        print(f"Inference Error: {e}")
        raise HTTPException(500, f"Inference failed: {e}")
    finally:
        if wav_path and os.path.exists(wav_path):
             os.unlink(wav_path)


    if not text:
        return TranscribeTranslateResp(transcript="", translation="", source_lang=lang)

    # Translate using Argos Translate (fully offline)
    try:
        source_lang_code = lang if lang in SUPPORTED_LANG_CODES else "en"
        
        if source_lang_code == target_lang_code:
            # Same language, no translation needed
            translated = text
        else:
            translated = await asyncio.to_thread(
                argostranslate.translate.translate,
                text,
                source_lang_code,
                target_lang_code,
            )
    except Exception as e:
        print(f"❌ Translation error: {e}")
        raise HTTPException(500, f"Translation error: {e}")

    lang_display = SUPPORTED_LANG_CODES.get(lang, lang)
    return TranscribeTranslateResp(transcript=text, translation=translated, source_lang=lang_display)

@app.get("/privacy-policy", response_class=HTMLResponse)
async def get_privacy_policy():
    """Serves the privacy policy page."""
    with open("privacy_policy.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serves the landing page."""
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

# Mount static files (CSS, JS, images if needed later)
app.mount("/static", StaticFiles(directory="static"), name="static")


