from pydantic import BaseModel
import os


class Settings(BaseModel):
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))


    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "medium")
    WHISPER_MODEL_DIR: str = os.getenv("WHISPER_MODEL_DIR", "models/whisper")
    COMPUTE_TYPE: str = os.getenv("COMPUTE_TYPE", "int8")
    CPU_THREADS: int = int(os.getenv("CPU_THREADS", "0"))
    NUM_WORKERS: int = int(os.getenv("NUM_WORKERS", "2"))

    DEFAULT_TARGET_LANG: str = os.getenv("DEFAULT_TARGET_LANG", "English")

    API_KEY: str = os.getenv("API_KEY", "YOUR_SECURE_API_KEY")
    
settings = Settings()

