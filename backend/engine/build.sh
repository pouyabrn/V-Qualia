#!/bin/bash

# Lap Time Simulator - Build Script for Linux/Ubuntu/Mac
# Usage: ./build.sh

echo "Building Lap Time Simulator..."
echo "=============================="

mkdir -p build

if command -v cmake >/dev/null 2>&1; then
    cd build || exit 1

    echo "Running CMake..."
    cmake ..
    if [ $? -ne 0 ]; then
        echo "❌ CMake failed!"
        exit 1
    fi

    echo "Compiling..."
    make -j"$(nproc)"
    if [ $? -ne 0 ]; then
        echo "❌ Build failed!"
        exit 1
    fi

    cd ..
else
    echo "CMake not found. Falling back to direct g++ build..."
    g++ -std=c++17 -O3 -Wall -Wextra -Wpedantic \
        -Iinclude \
        src/main.cpp \
        src/data/TrackData.cpp \
        src/data/VehicleParams.cpp \
        src/data/SimulationState.cpp \
        src/physics/AerodynamicsModel.cpp \
        src/physics/TireModel.cpp \
        src/physics/PowertrainModel.cpp \
        src/solver/GGVGenerator.cpp \
        src/solver/QuasiSteadyStateSolver.cpp \
        src/telemetry/TelemetryLogger.cpp \
        src/io/JSONParser.cpp \
        -o build/lap_sim
    if [ $? -ne 0 ]; then
        echo "❌ Build failed!"
        exit 1
    fi
fi

echo ""
echo "✅ Build successful!"
echo ""
echo "To run the simulator:"
echo "  ./build/lap_sim examples/montreal.csv examples/f1_2025.json"
echo ""

