FROM debian:bookworm-slim AS engine-build
RUN apt-get update && apt-get install -y --no-install-recommends cmake g++ make \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /engine
COPY engine/ .
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF \
    && cmake --build build -j2

FROM python:3.11-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py prediction_engine.py ./
COPY engine/examples/ ./engine/examples/
COPY engine/UPSTREAM.json ./engine/UPSTREAM.json
COPY --from=engine-build /engine/build/lap_sim ./engine/build/lap_sim
COPY data/ ./data/
RUN mkdir -p data/cars data/tracks data/predictions data/line_cache
ENV PYTHONPATH=/app ENGINE_DIR=/app/engine PYTHONUNBUFFERED=1
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:10000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
