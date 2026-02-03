# CPU-optimized for Hetzner CX33
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Environment variables
ENV HOST=0.0.0.0 
ENV PORT=8080 
# Using faster-whisper default small model for CPU balance
ENV WHISPER_MODEL=small 
ENV OMP_NUM_THREADS=4

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
