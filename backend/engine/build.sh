#!/bin/bash

# Lap Time Simulator - Build Script for Linux/Ubuntu/Mac
# Usage: ./build.sh

echo "Building Lap Time Simulator..."
echo "=============================="

# Create build directory if it doesn't exist
mkdir -p build

# Navigate to build directory
cd build

# Run CMake
echo "Running CMake..."
cmake ..

# Check if CMake succeeded
if [ $? -ne 0 ]; then
    echo "❌ CMake failed!"
    exit 1
fi

# Build with make (use all available CPU cores)
echo "Compiling..."
make -j$(nproc)

# Check if build succeeded
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Go back to project root
cd ..

echo ""
echo "✅ Build successful!"
echo ""
echo "To run the simulator:"
echo "  ./build/lap_sim examples/montreal.csv examples/f1_2025.json"
echo ""


