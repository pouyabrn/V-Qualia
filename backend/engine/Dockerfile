# C++ Engine Dockerfile
FROM ubuntu:22.04

# Install build dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    pkg-config \
    libjsoncpp-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Create build directory
RUN mkdir -p build

# Build the engine
WORKDIR /app/build
RUN cmake .. && \
    make -j$(nproc)

# Verify the build
RUN ls -la && \
    file lap_sim || echo "Build completed"

# Set the binary as entrypoint
ENTRYPOINT ["./lap_sim"]
