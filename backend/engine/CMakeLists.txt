cmake_minimum_required(VERSION 3.15)
project(LapTimeSimulation VERSION 1.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Default to an optimised build
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

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
    src/data/TrackData.cpp
    src/data/VehicleParams.cpp
    src/data/SimulationState.cpp
    src/physics/PowertrainModel.cpp
    src/physics/VehicleModel.cpp
    src/solver/GGVGenerator.cpp
    src/solver/RacingLine.cpp
    src/solver/QuasiSteadyStateSolver.cpp
    src/telemetry/TelemetryLogger.cpp
    src/io/JSONParser.cpp
)

# Create executable
add_library(lap_core STATIC ${SOURCES})
target_include_directories(lap_core PUBLIC ${CMAKE_SOURCE_DIR}/include)
add_executable(lap_sim src/main.cpp)
target_link_libraries(lap_sim PRIVATE lap_core)

include(CTest)
if(BUILD_TESTING)
add_executable(solver_reuse_checks validation/solver_reuse_checks.cpp)
target_link_libraries(solver_reuse_checks PRIVATE lap_core)
add_test(NAME solver_reuse_checks COMMAND solver_reuse_checks
         WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
add_executable(model_checks validation/model_checks.cpp)
target_link_libraries(model_checks PRIVATE lap_core)
add_test(NAME model_checks COMMAND model_checks WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
add_executable(lap_benchmark validation/benchmark.cpp)
target_link_libraries(lap_benchmark PRIVATE lap_core)
add_executable(lap_update_benchmark validation/update_benchmark.cpp)
target_link_libraries(lap_update_benchmark PRIVATE lap_core)
endif()

# Installation
install(TARGETS lap_sim DESTINATION bin)

# Tests (ctest): analytic physics checks and validation against real qualifying laps.
# Both only need a Python 3 interpreter (standard library).
find_package(Python3 COMPONENTS Interpreter)
if(BUILD_TESTING AND Python3_Interpreter_FOUND)
    enable_testing()
    add_test(NAME regression_checks
             COMMAND ${Python3_EXECUTABLE} ${CMAKE_SOURCE_DIR}/validation/regression_checks.py
                     --binary $<TARGET_FILE:lap_sim>
             WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
    add_test(NAME physics_checks
             COMMAND ${Python3_EXECUTABLE} ${CMAKE_SOURCE_DIR}/validation/physics_checks.py
                     --binary $<TARGET_FILE:lap_sim>
             WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
    add_test(NAME real_laps_calibration
             COMMAND ${Python3_EXECUTABLE} ${CMAKE_SOURCE_DIR}/validation/validate.py
                     --binary $<TARGET_FILE:lap_sim> --set calibration --max-mae 1.0 --max-error 1.5
             WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
    add_test(NAME real_laps_out_of_sample
             COMMAND ${Python3_EXECUTABLE} ${CMAKE_SOURCE_DIR}/validation/validate.py
                     --binary $<TARGET_FILE:lap_sim> --set out-of-sample --max-mae 2.0 --max-error 5.0
             WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
    add_test(NAME real_laps_f2
             COMMAND ${Python3_EXECUTABLE} ${CMAKE_SOURCE_DIR}/validation/validate.py
                     --binary $<TARGET_FILE:lap_sim> --set cross-car --max-mae 2.0 --max-error 3.0
             WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
endif()

# Print configuration summary
message(STATUS "==============================================")
message(STATUS "  Lap Time Simulation - Build Configuration")
message(STATUS "==============================================")
message(STATUS "  CMake Version: ${CMAKE_VERSION}")
message(STATUS "  C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "  Install Prefix: ${CMAKE_INSTALL_PREFIX}")
message(STATUS "==============================================")
