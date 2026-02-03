from pydantic import BaseModel
import os


class Settings(BaseModel):
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))


    # Whisper
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "small") # tiny|base|small|medium|large-v3
    WHISPER_MODEL_DIR: str = os.getenv("WHISPER_MODEL_DIR", "models/whisper")
    COMPUTE_TYPE: str = os.getenv("COMPUTE_TYPE", "int8") # int8 for CPU speed

    # LibreTranslate API
    LIBRETRANSLATE_URL: str = os.getenv("LIBRETRANSLATE_URL", "http://localhost:5000")
    LIBRETRANSLATE_API_KEY: str = os.getenv("LIBRETRANSLATE_API_KEY", "")  # Optional, for authenticated instances


    # Language routing
    DEFAULT_TARGET_LANG: str = os.getenv("DEFAULT_TARGET_LANG", "English") # e.g., "English", "Turkish", "Persian"
    
settings = Settings()

