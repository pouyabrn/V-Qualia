@echo off
REM Build script for Lap Time Simulation Engine (Windows)

echo ================================================================
echo   Building Lap Time Simulation Engine
echo ================================================================

REM Create build directory
if not exist "build" (
    echo Creating build directory...
    mkdir build
)

cd build

REM Configure with CMake
echo Configuring with CMake...
cmake .. -G "Visual Studio 16 2019" || cmake ..
if %errorlevel% neq 0 (
    echo CMake configuration failed!
    exit /b 1
)

REM Build
echo Building project...
cmake --build . --config Release
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

echo.
echo ================================================================
echo   Build completed successfully!
echo   Executable: build\Release\lap_sim.exe
echo ================================================================
echo.
echo To run the simulation:
echo   build\Release\lap_sim.exe examples\simple_track.json examples\formula_car.json
echo.

cd ..


