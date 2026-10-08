#!/bin/bash

# Lap Time Simulator - Build Script for Linux/Ubuntu/macOS
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
    if command -v nproc >/dev/null 2>&1; then
        JOBS="$(nproc)"
    elif command -v sysctl >/dev/null 2>&1; then
        JOBS="$(sysctl -n hw.logicalcpu 2>/dev/null)"
    else
        JOBS=4
    fi

    make -j"${JOBS}"
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
        src/physics/PowertrainModel.cpp \
        src/physics/VehicleModel.cpp \
        src/solver/GGVGenerator.cpp \
        src/solver/RacingLine.cpp \
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
