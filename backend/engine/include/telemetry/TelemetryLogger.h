#pragma once

#include "data/SimulationState.h"
#include "data/TrackData.h"
#include "data/VehicleParams.h"
#include <string>
#include <fstream>
#include <iostream>
#include <iomanip>

namespace LapTimeSim {

/**
 * @brief Comprehensive telemetry logger for simulation output
 * 
 * Provides multiple output formats:
 * - Real-time console output
 * - CSV file export
 * - JSON file export
 * - Summary statistics
 */
class TelemetryLogger {
public:
    TelemetryLogger();
    ~TelemetryLogger() = default;
    
    /**
     * @brief Log a single state to console (real-time)
     * @param state Current simulation state
     * @param verbose If true, print detailed info; if false, print compact
     */
    void logToConsole(const SimulationState& state, bool verbose = false);
    
    /**
     * @brief Export lap result to CSV file
     * @param result Complete lap result with all states
     * @param filename Output file path
     */
    void exportToCSV(const LapResult& result, const std::string& filename);
    
    /**
     * @brief Export lap result to JSON file
     * @param result Complete lap result with all states
     * @param filename Output file path
     */
    void exportToJSON(const LapResult& result, const std::string& filename);
    
    /**
     * @brief Print summary statistics
     * @param result Lap result
     * @param track Track data
     * @param vehicle Vehicle parameters
     */
    void printSummary(const LapResult& result, 
                     const TrackData& track,
                     const VehicleParams& vehicle);
    
    /**
     * @brief Print header for console output
     */
    void printConsoleHeader();

private:
    /**
     * @brief Format time as MM:SS.mmm
     */
    std::string formatTime(double seconds) const;
    
    /**
     * @brief Format velocity with units
     */
    std::string formatVelocity(double ms) const;
};

} // namespace LapTimeSim


