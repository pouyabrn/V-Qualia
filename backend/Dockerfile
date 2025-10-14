# Backend Dockerfile
FROM python:3.11-slim

# Install system dependencies for C++ compilation and Python packages
RUN apt-get update && apt-get install -y \
    # C++ build tools
    cmake \
    build-essential \
    pkg-config \
    # jsoncpp library
    libjsoncpp-dev \
    # Additional dependencies that might be needed
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Python requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the engine source code
COPY engine/ ./engine/

# Build the C++ engine
WORKDIR /app/engine
RUN mkdir -p build && \
    cd build && \
    cmake .. && \
    make -j$(nproc) && \
    cd ..

# Verify the engine was built
RUN ls -la /app/engine/build/

# Create outputs directory for engine results
RUN mkdir -p /app/engine/outputs

# Go back to main directory
WORKDIR /app

# Copy backend source code
COPY main.py prediction_engine.py test_api.py ./

# Copy data directories
COPY data/ ./data/

# Create directories for data persistence
RUN mkdir -p data/cars data/tracks data/predictions

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONPATH=/app
ENV ENGINE_DIR=/app/engine

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
