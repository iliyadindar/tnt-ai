from pydantic import BaseModel
import os


class Settings(BaseModel):
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))


    # Whisper
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "medium") # tiny|base|small|medium|large-v3|large-v3-turbo
    WHISPER_MODEL_DIR: str = os.getenv("WHISPER_MODEL_DIR", "models/whisper")
    COMPUTE_TYPE: str = os.getenv("COMPUTE_TYPE", "int8") # int8 for CPU speed
    CPU_THREADS: int = int(os.getenv("CPU_THREADS", "0"))  # 0 = auto-detect all cores
    NUM_WORKERS: int = int(os.getenv("NUM_WORKERS", "2"))  # Parallel transcription workers

    # Language routing
    DEFAULT_TARGET_LANG: str = os.getenv("DEFAULT_TARGET_LANG", "English") # e.g., "English", "Turkish", "Persian"
    
settings = Settings()

