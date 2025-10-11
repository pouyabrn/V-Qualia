#!/bin/bash
# Build script for MSYS2 MinGW 64-bit

echo "======================================"
echo "Building Lap Time Simulation Engine"
echo "======================================"
echo ""

# Check if cmake is installed
if ! command -v cmake &> /dev/null; then
    echo "❌ CMake not found!"
    echo "Installing CMake..."
    pacman -S --noconfirm mingw-w64-x86_64-cmake mingw-w64-x86_64-make
fi

# Check if g++ is installed
if ! command -v g++ &> /dev/null; then
    echo "❌ G++ compiler not found!"
    echo "Installing G++..."
    pacman -S --noconfirm mingw-w64-x86_64-gcc
fi

echo "✅ Dependencies OK"
echo ""

# Create build directory
echo "Creating build directory..."
mkdir -p build
cd build

echo "Running CMake..."
cmake -G "MinGW Makefiles" ..

if [ $? -ne 0 ]; then
    echo "❌ CMake configuration failed!"
    exit 1
fi

echo ""
echo "Building..."
cmake --build . --config Release

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "======================================"
echo "✅ Build successful!"
echo "======================================"
echo ""
echo "Executable: build/lap_sim.exe"
echo ""
echo "Test it with:"
echo "  ./lap_sim.exe ../examples/Zandvoort.csv ../examples/f1_2025.json"
echo ""

