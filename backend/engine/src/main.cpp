/**
 * @file main.cpp
 * @brief Quasi-steady-state lap time simulation with racing line optimisation.
 *
 * Usage:
 *   ./lap_sim <track_csv_or_json> <vehicle_json> [options]
 *
 * Example:
 *   ./lap_sim examples/Monza.csv examples/f1_2025_quali_monza.json
 */

#include "io/JSONParser.h"
#include "solver/QuasiSteadyStateSolver.h"
#include "telemetry/TelemetryLogger.h"
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

using namespace LapTimeSim;

namespace {

void printUsage(const char* program_name) {
    std::cout << "Usage: " << program_name << " <track_csv_or_json> <vehicle_json> [options]\n";
    std::cout << "\nOutput options:\n";
    std::cout << "  --csv <file>            Telemetry CSV path (default: outputs/<car>-<track>-<mm_ss>-VSIM.csv)\n";
    std::cout << "  --json <file>           Also export telemetry JSON\n";
    std::cout << "  --ggv <file>            GGV CSV path (default: outputs/<car>-<track>-<mm_ss>-VSIM-GGV.csv)\n";
    std::cout << "  --ggv-no-ers            Export a combustion-only GGV envelope\n";
    std::cout << "  --ggv-drs               Open DRS for GGV acceleration (braking stays closed)\n";
    std::cout << "  --line-csv <file>       Export the racing line (x, y, offset, curvature, speeds)\n";
    std::cout << "  --line-nodes <file>     Export exact editable nodes for lossless --line given reuse\n";
    std::cout << "  --summary-json <file>   Machine-readable summary (lap time, speeds, energy, ...)\n";
    std::cout << "  --no-output             Do not write the default telemetry / GGV files\n";
    std::cout << "  --quiet                 Only print the final lap time\n";
    std::cout << "\nModel options:\n";
    std::cout << "  --line <mode>           Racing line: mincurv (default), center, given\n";
    std::cout << "  --line-file <csv>       Line for --line given (s_center_m,n_m columns, e.g. from --line-csv)\n";
    std::cout << "  --line-length-weight <w> Blend the minimum-curvature line towards the shortest path\n";
    std::cout << "  --edge-margin <m>       Car-centre distance to the track boundary (overrides vehicle file)\n";
    std::cout << "  --ds <m>                Working path resolution (default: 1.0)\n";
    std::cout << "  --line-step <m>         Racing line optimisation node spacing (default: 2.0)\n";
    std::cout << "  --line-tol <m>          Racing line optimiser convergence tolerance (default: 1e-5)\n";
    std::cout << "  --line-cache <file>     Reuse / store the optimised racing line (keyed on track + line options)\n";
    std::cout << "  --no-drs                Disable DRS\n";
    std::cout << "  --no-ers                Disable ERS deployment\n";
    std::cout << "  --drs-zones <list>      Explicit DRS zones on the centreline, e.g. \"0-800,3900-4600\"\n";
    std::cout << "  --mu-scale <f>          Scale tyre friction (track grip / evolution), default 1.0\n";
    std::cout << "  --air-density <kg/m3>   Override air density (weather / altitude)\n";
    std::cout << "  --set <path=value>      Override any vehicle JSON field, e.g. --set tire.mu_y=1.9 (repeatable)\n";
    std::cout << "  --no-banking            Ignore the optional <track>.banking.csv sidecar\n";
    std::cout << "  --no-elevation          Ignore the optional <track>.elevation.csv sidecar\n";
    std::cout << "  --iterations <N>        Max ERS energy-management iterations (default: 40)\n";
    std::cout << "  --tolerance <T>         Lap time tolerance for the ERS bisection in s (default: 1e-4)\n";
    std::cout << "  --help                  Show this help message\n";
    std::cout << "\nExample:\n";
    std::cout << "  " << program_name << " examples/Monza.csv examples/f1_2025_quali_monza.json\n";
}

struct CommandLineArgs {
    std::string track_file;
    std::string vehicle_file;
    std::string csv_output;
    std::string json_output;
    std::string ggv_output;
    std::string line_output;
    std::string line_nodes_output;
    std::string summary_output;
    std::string drs_zones;
    std::string line_cache;
    std::string line_file;
    std::string line_mode = "mincurv";
    std::vector<std::pair<std::string, std::string>> overrides;
    bool no_banking = false;
    bool no_elevation = false;
    bool no_output = false;
    bool quiet = false;
    bool no_drs = false;
    bool no_ers = false;
    bool ggv_no_ers = false;
    bool ggv_drs = false;
    bool has_edge_margin = false;
    double edge_margin = 0.0;
    double ds = 1.0;
    double line_step = 2.0;
    double line_tol = 1e-5;
    double line_length_weight = 0.0;
    double mu_scale = 1.0;
    double air_density = 0.0;
    int max_iterations = 40;
    double tolerance = 1e-4;
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
        const std::string arg = argv[i];
        auto next = [&]() -> std::string {
            if (i + 1 >= argc) {
                throw std::runtime_error("Missing value for option " + arg);
            }
            return argv[++i];
        };
        if (arg == "--help" || arg == "-h") {
            args.show_help = true;
        } else if (arg == "--csv") {
            args.csv_output = next();
        } else if (arg == "--json") {
            args.json_output = next();
        } else if (arg == "--ggv") {
            args.ggv_output = next();
        } else if (arg == "--ggv-no-ers") {
            args.ggv_no_ers = true;
        } else if (arg == "--ggv-drs") {
            args.ggv_drs = true;
        } else if (arg == "--line-csv") {
            args.line_output = next();
        } else if (arg == "--line-nodes") {
            args.line_nodes_output = next();
        } else if (arg == "--summary-json") {
            args.summary_output = next();
        } else if (arg == "--no-output") {
            args.no_output = true;
        } else if (arg == "--quiet") {
            args.quiet = true;
        } else if (arg == "--line") {
            args.line_mode = next();
        } else if (arg == "--edge-margin") {
            args.edge_margin = std::stod(next());
            args.has_edge_margin = true;
        } else if (arg == "--ds") {
            args.ds = std::stod(next());
        } else if (arg == "--line-step") {
            args.line_step = std::stod(next());
        } else if (arg == "--line-tol") {
            args.line_tol = std::stod(next());
        } else if (arg == "--line-cache") {
            args.line_cache = next();
        } else if (arg == "--line-length-weight") {
            args.line_length_weight = std::stod(next());
        } else if (arg == "--line-file") {
            args.line_file = next();
        } else if (arg == "--set") {
            const std::string kv = next();
            const size_t eq = kv.find('=');
            if (eq == std::string::npos || eq == 0) {
                throw std::runtime_error("--set expects section.field=value, got '" + kv + "'");
            }
            args.overrides.emplace_back(kv.substr(0, eq), kv.substr(eq + 1));
        } else if (arg == "--no-banking") {
            args.no_banking = true;
        } else if (arg == "--no-elevation") {
            args.no_elevation = true;
        } else if (arg == "--no-drs") {
            args.no_drs = true;
        } else if (arg == "--no-ers") {
            args.no_ers = true;
        } else if (arg == "--drs-zones") {
            args.drs_zones = next();
        } else if (arg == "--mu-scale") {
            args.mu_scale = std::stod(next());
        } else if (arg == "--air-density") {
            args.air_density = std::stod(next());
        } else if (arg == "--iterations") {
            args.max_iterations = std::stoi(next());
        } else if (arg == "--tolerance") {
            args.tolerance = std::stod(next());
        } else {
            throw std::runtime_error("Unknown option: " + arg + " (see --help)");
        }
    }
    return args;
}

std::vector<std::pair<double, double>> parseZones(const std::string& text) {
    std::vector<std::pair<double, double>> zones;
    std::stringstream stream(text);
    std::string item;
    while (std::getline(stream, item, ',')) {
        const size_t dash = item.find('-', 1);
        if (dash == std::string::npos) {
            throw std::runtime_error("DRS zone '" + item + "' must look like start-end");
        }
        zones.emplace_back(std::stod(item.substr(0, dash)), std::stod(item.substr(dash + 1)));
    }
    return zones;
}

/// Reads a racing line as (centreline distance, lateral offset) pairs. Accepts a CSV with a header
/// containing "s_center_m" and "n_m" (as written by --line-csv) or plain two-column rows.
void readGivenLine(const std::string& path, std::vector<double>& s_out, std::vector<double>& n_out) {
    std::ifstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open line file: " + path);
    }
    std::string line;
    int s_col = 0;
    int n_col = 1;
    bool header_seen = false;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') {
            continue;
        }
        std::vector<std::string> cells;
        std::stringstream stream(line);
        std::string cell;
        while (std::getline(stream, cell, ',')) {
            cells.push_back(cell);
        }
        if (!header_seen) {
            header_seen = true;
            bool numeric = true;
            try {
                (void)std::stod(cells.at(0));
            } catch (...) {
                numeric = false;
            }
            if (!numeric) {
                s_col = n_col = -1;
                for (size_t i = 0; i < cells.size(); ++i) {
                    if (cells[i] == "s_center_m") s_col = static_cast<int>(i);
                    if (cells[i] == "n_m") n_col = static_cast<int>(i);
                }
                if (s_col < 0 || n_col < 0) {
                    throw std::runtime_error("Line file header needs s_center_m and n_m columns: " + path);
                }
                continue;
            }
        }
        const size_t needed = static_cast<size_t>(std::max(s_col, n_col));
        if (cells.size() <= needed) {
            continue;
        }
        s_out.push_back(std::stod(cells[static_cast<size_t>(s_col)]));
        n_out.push_back(std::stod(cells[static_cast<size_t>(n_col)]));
    }
    if (s_out.size() < 2) {
        throw std::runtime_error("Line file contains fewer than two samples: " + path);
    }
}

std::string cleanName(std::string str) {
    for (auto& c : str) {
        if (c == ' ' || c == '-' || c == '(' || c == ')') c = '_';
    }
    size_t pos;
    while ((pos = str.find("__")) != std::string::npos) {
        str.replace(pos, 2, "_");
    }
    return str;
}

std::string jsonEscape(const std::string& text) {
    std::string out;
    for (char c : text) {
        if (c == '"' || c == '\\') {
            out.push_back('\\');
        }
        out.push_back(c);
    }
    return out;
}

void writeSummaryJSON(const std::string& filename, const VehicleParams& vehicle, const TrackData& track,
                      const QuasiSteadyStateSolver& solver, const LapResult& result) {
    const std::filesystem::path path(filename);
    if (path.has_parent_path()) {
        std::filesystem::create_directories(path.parent_path());
    }
    std::ofstream file(filename);
    if (!file.is_open()) {
        throw std::runtime_error("Failed to open summary file: " + filename);
    }
    const SolverStats& st = solver.getStats();
    double max_gx = 0.0, max_gy = 0.0, max_g = 0.0, max_brake_g = 0.0, max_accel_g = 0.0;
    result.getMaxGForces(max_gx, max_gy, max_g);
    for (const auto& s : result.getStates()) {
        max_brake_g = std::max(max_brake_g, -s.gx);
        max_accel_g = std::max(max_accel_g, s.gx);
    }
    auto num = [](double v) {
        std::ostringstream o;
        if (!std::isfinite(v)) {
            o << "null";
        } else {
            o << std::setprecision(10) << v;
        }
        return o.str();
    };
    file << "{\n"
         << "  \"vehicle\": \"" << jsonEscape(vehicle.getName()) << "\",\n"
         << "  \"track\": \"" << jsonEscape(track.getName()) << "\",\n"
         << "  \"lap_time_s\": " << num(solver.getLapTime()) << ",\n"
         << "  \"line_length_m\": " << num(st.line_length) << ",\n"
         << "  \"centerline_length_m\": " << num(st.centerline_length) << ",\n"
         << "  \"top_speed_kmh\": " << num(st.top_speed * 3.6) << ",\n"
         << "  \"min_speed_kmh\": " << num(st.min_speed * 3.6) << ",\n"
         << "  \"avg_speed_kmh\": " << num(st.avg_speed * 3.6) << ",\n"
         << "  \"max_lateral_g\": " << num(max_gy) << ",\n"
         << "  \"max_braking_g\": " << num(max_brake_g) << ",\n"
         << "  \"max_accel_g\": " << num(max_accel_g) << ",\n"
         << "  \"full_throttle_pct\": " << num(st.full_throttle_fraction * 100.0) << ",\n"
         << "  \"braking_pct\": " << num(st.braking_fraction * 100.0) << ",\n"
         << "  \"ers_energy_mj\": " << num(st.ers_energy_used / 1e6) << ",\n"
         << "  \"ers_budget_mj\": " << num(st.ers_energy_budget / 1e6) << ",\n"
         << "  \"ers_clip_speed_kmh\": " << num(st.ers_clip_speed * 3.6) << ",\n"
         << "  \"drs_zones\": " << st.drs_zones << ",\n"
         << "  \"drs_length_m\": " << num(st.drs_length) << ",\n"
         << "  \"upshifts\": " << st.upshifts << ",\n"
         << "  \"line_sweeps\": " << st.line_sweeps << ",\n"
         << "  \"converged\": " << (solver.hasConverged() ? "true" : "false") << ",\n"
         << "  \"line_cache_hit\": " << (st.line_cache_hit ? "true" : "false") << ",\n"
         << "  \"profile_evaluations\": " << solver.getIterationsUsed() << ",\n"
         << "  \"solve_ms\": " << num(st.solve_time_ms) << "\n"
         << "}\n";
}

} // namespace

int main(int argc, char* argv[]) {
    std::streambuf* original_cout = std::cout.rdbuf();
    std::ostringstream quiet_sink;
    try {
        CommandLineArgs args = parseArguments(argc, argv);
        if (args.show_help) {
            printUsage(argv[0]);
            return 0;
        }
        if (args.quiet) {
            std::cout.rdbuf(quiet_sink.rdbuf());
        }

        std::cout << "\n";
        std::cout << "================================================================\n";
        std::cout << "  Lap Time Simulation Engine - quasi-steady-state + racing line\n";
        std::cout << "================================================================\n\n";
        std::cout << "Configuration:\n";
        std::cout << "  Track file: " << args.track_file << "\n";
        std::cout << "  Vehicle file: " << args.vehicle_file << "\n";
        std::cout << "  Line: " << args.line_mode << " | ds: " << args.ds << " m\n\n";

        std::cout << "=== Phase 1: Loading Data ===\n";
        TrackData track;
        if (args.track_file.find(".csv") != std::string::npos) {
            track = JSONParser::parseTrackCSV(args.track_file);
        } else {
            track = JSONParser::parseTrackJSON(args.track_file);
        }
        if (!args.no_elevation) {
            JSONParser::applyElevationSidecar(track, args.track_file);
        }
        if (!args.no_banking) {
            JSONParser::applyBankingSidecar(track, args.track_file);
        }
        VehicleParams vehicle = JSONParser::parseVehicleJSON(args.vehicle_file, args.overrides);
        if (args.mu_scale != 1.0) {
            if (args.mu_scale <= 0.0) {
                throw std::runtime_error("--mu-scale must be positive");
            }
            vehicle.tire.mu_x *= args.mu_scale;
            vehicle.tire.mu_y *= args.mu_scale;
        }
        // DRS zones are a track property: CLI > <track>.drs.csv sidecar > vehicle file > auto-detection
        if (!args.drs_zones.empty()) {
            vehicle.aero.drs.zones = parseZones(args.drs_zones);
        } else if (vehicle.aero.drs.enabled) {
            auto zones = JSONParser::loadDRSSidecar(args.track_file);
            if (!zones.empty()) {
                vehicle.aero.drs.zones = std::move(zones);
            }
        }
        if (args.air_density != 0.0) {
            if (args.air_density <= 0.0) {
                throw std::runtime_error("--air-density must be positive");
            }
            vehicle.aero.air_density = args.air_density;
        }
        std::cout << "\n";

        std::cout << "=== Phase 2: Initializing Solver ===\n";
        SolverOptions options;
        options.enable_drs = !args.no_drs;
        options.enable_ers = !args.no_ers;
        options.line.output_step = args.ds;
        options.line.optimisation_step = args.line_step;
        options.line.tolerance = args.line_tol;
        options.line.length_weight = args.line_length_weight;
        options.line_cache = args.line_cache;
        if (args.line_mode == "center" || args.line_mode == "centre" || args.line_mode == "centerline") {
            options.line.mode = LineMode::Centerline;
        } else if (args.line_mode == "mincurv" || args.line_mode == "min-curvature") {
            options.line.mode = LineMode::MinimumCurvature;
        } else if (args.line_mode == "given") {
            if (args.line_file.empty()) {
                throw std::runtime_error("--line given requires --line-file <csv with s_center_m,n_m columns>");
            }
            options.line.mode = LineMode::Given;
            readGivenLine(args.line_file, options.line.given_s, options.line.given_offset);
        } else {
            throw std::runtime_error("Unknown --line mode: " + args.line_mode);
        }
        if (args.has_edge_margin) {
            options.override_edge_margin = true;
            options.line.edge_margin = args.edge_margin;
        }
        QuasiSteadyStateSolver solver(track, vehicle, options);
        std::cout << "\n";

        std::cout << "=== Phase 3: Computing Predicted Lap Time ===\n";
        const double lap_time = solver.solve(args.max_iterations, args.tolerance);
        std::cout << "\n";

        std::cout << "=== Phase 4: Generating Telemetry ===\n";
        const LapResult result = solver.getDetailedResult();
        TelemetryLogger logger;
        logger.printSummary(result, track, vehicle);

        const SolverStats& st = solver.getStats();
        std::cout << "Driven path: " << std::fixed << std::setprecision(1) << st.line_length
                  << " m (centreline " << st.centerline_length << " m)\n";
        std::cout << "Full throttle: " << st.full_throttle_fraction * 100.0 << " % | braking: "
                  << st.braking_fraction * 100.0 << " % | upshifts: " << st.upshifts << "\n";

        const int minutes = static_cast<int>(lap_time) / 60;
        const int seconds = static_cast<int>(lap_time) % 60;
        char lap_str[16];
        std::snprintf(lap_str, sizeof(lap_str), "%d_%02d", minutes, seconds);
        const std::string stem = "outputs/" + cleanName(vehicle.getName()) + "-" + cleanName(track.getName()) +
                                 "-" + lap_str + "-VSIM";

        std::string csv_filename = args.csv_output;
        if (csv_filename.empty() && !args.no_output) {
            csv_filename = stem + ".csv";
        }
        if (!csv_filename.empty()) {
            logger.exportToCSV(result, csv_filename);
        }
        if (!args.json_output.empty()) {
            logger.exportToJSON(result, args.json_output);
        }
        std::string ggv_filename = args.ggv_output;
        if (ggv_filename.empty() && !args.no_output) {
            ggv_filename = stem + "-GGV.csv";
        }
        if (!ggv_filename.empty()) {
            solver.exportGGVToFile(ggv_filename, !args.ggv_no_ers, args.ggv_drs);
        }
        if (!args.line_output.empty()) {
            solver.exportRacingLine(args.line_output);
        }
        if (!args.line_nodes_output.empty()) solver.exportLineNodes(args.line_nodes_output);
        if (!args.summary_output.empty()) {
            writeSummaryJSON(args.summary_output, vehicle, track, solver, result);
        }

        std::cout.rdbuf(original_cout);
        char formatted[32];
        std::snprintf(formatted, sizeof(formatted), "%d:%06.3f", minutes, lap_time - 60.0 * minutes);
        if (args.quiet) {
            std::cout << std::fixed << std::setprecision(3) << lap_time << "\n";
        } else {
            std::cout << "\n================================================================\n";
            std::cout << "  PREDICTED LAP TIME: " << std::fixed << std::setprecision(3) << lap_time
                      << " s  (" << formatted << ")\n";
            std::cout << "================================================================\n\n";
        }
        return 0;
    } catch (const std::exception& e) {
        std::cout.rdbuf(original_cout);
        std::cerr << "\nError: " << e.what() << "\n\n";
        return 1;
    }
}
