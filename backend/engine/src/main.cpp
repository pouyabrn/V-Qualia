/**
 * @file main.cpp
 * @brief High-Fidelity Lap Time Simulation and Race Line Optimization Engine
 * 
 * This application simulates vehicle dynamics on a race track to calculate
 * the single fastest, most optimal lap time and corresponding racing line.
 * 
 * Usage:
 *   ./lap_sim <track_json> <vehicle_json> [options]
 * 
 * Example:
 *   ./lap_sim track.json vehicle.json --output telemetry.csv
 */

#include "io/JSONParser.h"
#include "solver/QuasiSteadyStateSolver.h"
#include "telemetry/TelemetryLogger.h"
#include <iostream>
#include <string>
#include <memory>
#include <stdexcept>

using namespace LapTimeSim;

void printUsage(const char* program_name) {
    std::cout << "Usage: " << program_name << " <track_json> <vehicle_json> [options]\n";
    std::cout << "\nOptions:\n";
    std::cout << "  --csv <file>        Export telemetry to CSV file\n";
    std::cout << "  --json <file>       Export telemetry to JSON file\n";
    std::cout << "  --ggv <file>        Export GGV diagram to CSV file\n";
    std::cout << "  --iterations <N>    Maximum solver iterations (default: 10)\n";
    std::cout << "  --tolerance <T>     Convergence tolerance (default: 0.001)\n";
    std::cout << "  --help              Show this help message\n";
    std::cout << "\nExample:\n";
    std::cout << "  " << program_name << " track.json vehicle.json --csv telemetry.csv\n";
}

struct CommandLineArgs {
    std::string track_file;
    std::string vehicle_file;
    std::string csv_output;
    std::string json_output;
    std::string ggv_output;
    int max_iterations = 10;
    double tolerance = 0.001;
    bool show_help = false;
};

CommandLineArgs parseArguments(int argc, char* argv[]) {
    CommandLineArgs args;
    
    if (argc < 3) {
        args.show_help = true;
        return args;
    }
    
    args.track_file = argv[1];
    args.vehicle_file = argv[2];
    
    for (int i = 3; i < argc; ++i) {
        std::string arg = argv[i];
        
        if (arg == "--help" || arg == "-h") {
            args.show_help = true;
        } else if (arg == "--csv" && i + 1 < argc) {
            args.csv_output = argv[++i];
        } else if (arg == "--json" && i + 1 < argc) {
            args.json_output = argv[++i];
        } else if (arg == "--ggv" && i + 1 < argc) {
            args.ggv_output = argv[++i];
        } else if (arg == "--iterations" && i + 1 < argc) {
            args.max_iterations = std::stoi(argv[++i]);
        } else if (arg == "--tolerance" && i + 1 < argc) {
            args.tolerance = std::stod(argv[++i]);
        }
    }
    
    return args;
}

int main(int argc, char* argv[]) {
    try {
        // Banner
        std::cout << "\n";
        std::cout << "╔════════════════════════════════════════════════════════════════╗\n";
        std::cout << "║                                                                ║\n";
        std::cout << "║    High-Fidelity Lap Time Simulation Engine                   ║\n";
        std::cout << "║    Race Line Optimization & Vehicle Dynamics                  ║\n";
        std::cout << "║                                                                ║\n";
        std::cout << "╚════════════════════════════════════════════════════════════════╝\n";
        std::cout << "\n";
        
        // Parse command line arguments
        CommandLineArgs args = parseArguments(argc, argv);
        
        if (args.show_help) {
            printUsage(argv[0]);
            return 0;
        }
        
        std::cout << "Configuration:\n";
        std::cout << "  Track file: " << args.track_file << "\n";
        std::cout << "  Vehicle file: " << args.vehicle_file << "\n";
        std::cout << "  Max iterations: " << args.max_iterations << "\n";
        std::cout << "  Tolerance: " << args.tolerance << "\n";
        std::cout << "\n";
        
        // Parse input files
        std::cout << "═══ Phase 1: Loading Data ═══\n";
        // Auto-detect track file format (CSV or JSON)
        TrackData track;
        if (args.track_file.find(".csv") != std::string::npos) {
            track = JSONParser::parseTrackCSV(args.track_file);
        } else {
            track = JSONParser::parseTrackJSON(args.track_file);
        }
        VehicleParams vehicle = JSONParser::parseVehicleJSON(args.vehicle_file);
        std::cout << "\n";
        
        // Create solver
        std::cout << "═══ Phase 2: Initializing Solver ═══\n";
        QuasiSteadyStateSolver solver(track, vehicle);
        std::cout << "\n";
        
        // Solve for optimal lap time
        std::cout << "═══ Phase 3: Computing Optimal Lap Time ═══\n";
        double lap_time = solver.solve(args.max_iterations, args.tolerance);
        std::cout << "\n";
        
        // Get detailed results
        std::cout << "═══ Phase 4: Generating Telemetry ═══\n";
        LapResult result = solver.getDetailedResult();
        std::cout << "\n";
        
        // Create telemetry logger
        TelemetryLogger logger;
        
        // Print summary
        logger.printSummary(result, track, vehicle);
        
        // Auto-generate CSV filename if not provided
        std::string csv_filename = args.csv_output;
        if (csv_filename.empty()) {
            // Extract names from paths
            std::string vehicle_name = vehicle.getName();
            std::string track_name = track.getName();
            
            
            // Clean up names (remove spaces, special chars)
            auto clean_name = [](std::string str) {
                for (auto& c : str) {
                    if (c == ' ' || c == '-' || c == '(' || c == ')') c = '_';
                }
                // Remove consecutive underscores
                size_t pos;
                while ((pos = str.find("__")) != std::string::npos) {
                    str.replace(pos, 2, "_");
                }
                return str;
            };
            
            vehicle_name = clean_name(vehicle_name);
            track_name = clean_name(track_name);
            
            // Format lap time as MM_SS
            int minutes = static_cast<int>(lap_time) / 60;
            int seconds = static_cast<int>(lap_time) % 60;
            char lap_str[16];
            snprintf(lap_str, sizeof(lap_str), "%d_%02d", minutes, seconds);
            
            // Generate filename: carname-track-laptime-VSIM.csv
            csv_filename = "outputs/" + vehicle_name + "-" + track_name + "-" + lap_str + "-VSIM.csv";
        }
        
        // Always export CSV
        logger.exportToCSV(result, csv_filename);
        
        // Export JSON if requested
        if (!args.json_output.empty()) {
            logger.exportToJSON(result, args.json_output);
        }
        
        // Print final result prominently
        std::cout << "\n";
        std::cout << "╔════════════════════════════════════════════════════════════════╗\n";
        std::cout << "║                        FINAL RESULT                            ║\n";
        std::cout << "╠════════════════════════════════════════════════════════════════╣\n";
        std::cout << "║                                                                ║\n";
        std::cout << "║   OPTIMAL LAP TIME:  " << std::fixed << std::setprecision(3) 
                  << std::setw(10) << lap_time << " seconds                     ║\n";
        std::cout << "║                                                                ║\n";
        std::cout << "╚════════════════════════════════════════════════════════════════╝\n";
        std::cout << "\n";
        
        // Success
        return 0;
        
    } catch (const std::exception& e) {
        std::cerr << "\n╔════════════════════════════════════════════════════════════════╗\n";
        std::cerr << "║                           ERROR                                ║\n";
        std::cerr << "╚════════════════════════════════════════════════════════════════╝\n";
        std::cerr << "\nError: " << e.what() << "\n\n";
        return 1;
    }
}

