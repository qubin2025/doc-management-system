FROM python:3.11-slim

WORKDIR /app

# 系统依赖 (pymupdf + paddlepaddle)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Python依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir pymupdf

COPY main.py .

EXPOSE 8001

CMD ["python", "main.py"]
