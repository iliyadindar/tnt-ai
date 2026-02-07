# CPU-optimized for Hetzner CX33
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (ultra-fast Python package installer)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY requirements.txt .

RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

# Environment variables
ENV HOST=0.0.0.0 
ENV PORT=8080 
# CPU-optimized: medium model = good accuracy + reasonable speed
ENV WHISPER_MODEL=medium 
ENV OMP_NUM_THREADS=0
ENV CT2_USE_EXPERIMENTAL_PACKED_GEMM=1

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
