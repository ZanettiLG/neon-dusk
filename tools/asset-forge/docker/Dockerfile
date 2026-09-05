# ComfyUI headless for Neon Dusk asset-forge (SD1.5 on NVIDIA GPU).
# Deps live in the image; models stay on the host (bind mount via compose).
FROM python:3.11-slim

# CUDA 12.6 wheels — any NVIDIA driver >= 525 serves them via back-compat.
RUN pip install --no-cache-dir torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu126

# Pinned so generated assets stay reproducible (see baselines/neon-dusk.md).
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch v0.28.0 \
    https://github.com/comfyanonymous/ComfyUI /opt/ComfyUI

WORKDIR /opt/ComfyUI
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8188
CMD ["python", "main.py", "--listen", "0.0.0.0", "--port", "8188"]
