cmake_minimum_required(VERSION 3.15)
project(LapTimeSimulation VERSION 1.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Add compiler warnings
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Include directories
include_directories(
    ${CMAKE_SOURCE_DIR}/include
)

# Source files
set(SOURCES
    src/main.cpp
    src/data/TrackData.cpp
    src/data/VehicleParams.cpp
    src/data/SimulationState.cpp
    src/physics/AerodynamicsModel.cpp
    src/physics/TireModel.cpp
    src/physics/PowertrainModel.cpp
    src/solver/GGVGenerator.cpp
    src/solver/QuasiSteadyStateSolver.cpp
    src/telemetry/TelemetryLogger.cpp
    src/io/JSONParser.cpp
)

# Create executable
add_executable(lap_sim ${SOURCES})

# Installation
install(TARGETS lap_sim DESTINATION bin)

# Print configuration summary
message(STATUS "==============================================")
message(STATUS "  Lap Time Simulation - Build Configuration")
message(STATUS "==============================================")
message(STATUS "  CMake Version: ${CMAKE_VERSION}")
message(STATUS "  C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  Install Prefix: ${CMAKE_INSTALL_PREFIX}")
message(STATUS "==============================================")
