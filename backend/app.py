import asyncio
import os
import subprocess
import tempfile
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from faster_whisper import WhisperModel
from settings import settings

app = FastAPI(title="tnt-ai")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True
)

# ----- Load models at startup -----
print(f"Loading Faster Whisper model: {settings.WHISPER_MODEL} on CPU...")
whisper_model = WhisperModel(
    settings.WHISPER_MODEL, 
    device="cpu", 
    compute_type=settings.COMPUTE_TYPE,
    download_root=settings.WHISPER_MODEL_DIR
)
print("✅ Model loaded successfully.")

# HTTP client for LibreTranslate API
http_client = httpx.AsyncClient(timeout=30.0)

class TranscribeTranslateResp(BaseModel):
    transcript: str
    translation: str
    source_lang: str  # BCP-47-ish, e.g. "tr", "en", "fa"

SUPPORTED_LANG_CODES = {
    "ar": "Arabic", "en": "English", "fa": "Persian", "tr": "Turkish",
}

# Language name to LibreTranslate code mapping
LANG_NAME_TO_CODE = {
    "English": "en",
    "Turkish": "tr",
    "Persian": "fa",
    "Arabic": "ar",
}

# Whisper language codes to LibreTranslate codes
WHISPER_TO_LIBRETRANSLATE = {
    "tr": "tr",
    "en": "en",
    "fa": "fa",
    "ar": "ar",
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
    target_lang: str = Form(default=settings.DEFAULT_TARGET_LANG)
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
        
        # Run inference using Faster Whisper
        segments, info = await asyncio.to_thread(
            whisper_model.transcribe,
            wav_path,
            beam_size=5
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

    # Translate using LibreTranslate API
    try:
        source_lang_code = WHISPER_TO_LIBRETRANSLATE.get(lang, "en")
        
        # Prepare request payload
        payload = {
            "q": text,
            "source": source_lang_code,
            "target": target_lang_code,
            "format": "text",
        }
        
        # Add API key if configured
        if settings.LIBRETRANSLATE_API_KEY:
            payload["api_key"] = settings.LIBRETRANSLATE_API_KEY
        
        # Call LibreTranslate API
        response = await http_client.post(
            f"{settings.LIBRETRANSLATE_URL}/translate",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        
        if response.status_code != 200:
            raise HTTPException(500, f"LibreTranslate API error: {response.text}")
        
        result = response.json()
        translated = result.get("translatedText", "")
        
    except httpx.HTTPError as e:
        raise HTTPException(500, f"Translation API request failed: {e}")
    except Exception as e:
        raise HTTPException(500, f"Translation error: {e}")

    lang_display = SUPPORTED_LANG_CODES.get(lang, lang)
    return TranscribeTranslateResp(transcript=text, translation=translated, source_lang=lang_display)

@app.get("/privacy-policy", response_class=HTMLResponse)
async def get_privacy_policy():
    """Serves the privacy policy page."""
    with open("privacy_policy.html", "r", encoding="utf-8") as f:
        return f.read()


