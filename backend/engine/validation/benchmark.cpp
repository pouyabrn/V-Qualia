// In-process full-lap benchmark and finite/energy checks, not a real-lap accuracy test.
#include "io/JSONParser.h"
#include "solver/QuasiSteadyStateSolver.h"
#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace LapTimeSim;

struct QuietLog {
    std::ostringstream sink;
    std::streambuf* saved = std::cout.rdbuf(sink.rdbuf());
    ~QuietLog() { std::cout.rdbuf(saved); }
};

int main(int argc, char** argv) {
    try {
        if (argc != 3) throw std::runtime_error("Usage: lap_benchmark <output.json> <ds_m>");
        const double ds = std::stod(argv[2]);
        std::ofstream out(argv[1]);
        if (!out) throw std::runtime_error("Cannot write benchmark output");
        QuietLog log;
        out << "[\n" << std::setprecision(10);
        bool first_row = true;
        for (const auto& stem : {"Monza", "montreal", "Zandvoort", "Shanghai", "Spielberg", "Silverstone",
                                 "Budapest", "Suzuka", "Austin", "Sakhir", "MexicoCity"}) {
            const std::string trackfile = "examples/" + std::string(stem) + ".csv";
            auto track = JSONParser::parseTrackCSV(trackfile);
            JSONParser::applyElevationSidecar(track, trackfile);
            JSONParser::applyBankingSidecar(track, trackfile);
            const std::string package = std::string(stem) == "Monza" ? "lowdf" :
                ((std::string(stem) == "Zandvoort" || std::string(stem) == "Budapest" ||
                  std::string(stem) == "MexicoCity") ? "highdf" : "mediumdf");
            std::vector<std::string> cars = {"f1_2024_quali_" + package, "f1_2025_quali_" + package,
                "f2_2024_quali_" + (package == "lowdf" ? std::string("monza") : package),
                "honda_civic_si_2025", "fsae_road_course"};
            for (const auto& carname : cars) {
                auto car = JSONParser::parseVehicleJSON("examples/" + carname + ".json");
                car.aero.drs.zones = JSONParser::loadDRSSidecar(trackfile);
                SolverOptions options;
                options.verbose = false;
                options.line.output_step = ds;
                QuasiSteadyStateSolver solver(track, car, options);
                const double lap = solver.solve();
                const double cold = solver.getStats().solve_time_ms;
                std::vector<double> warm;
                for (int i = 0; i < 5; ++i) {
                    const double again = solver.solve();
                    if (std::abs(lap - again) > 1e-9 || !solver.getStats().line_cache_hit) {
                        throw std::runtime_error("Non-deterministic repeated solve: " + carname);
                    }
                    warm.push_back(solver.getStats().solve_time_ms);
                }
                const auto& st = solver.getStats();
                if (!std::isfinite(lap) || lap <= 0 || !solver.hasConverged() ||
                    st.min_speed <= 0 || st.min_speed > st.avg_speed || st.avg_speed > st.top_speed ||
                    st.ers_energy_used > st.ers_energy_budget * 1.001 + 1e-6) {
                    throw std::runtime_error("Invalid summary: " + carname + " " + stem);
                }
                auto result = solver.getDetailedResult();
                for (const auto& state : result.getStates()) {
                    for (double value : {state.v, state.ax, state.ay, state.timestamp, state.rpm,
                                         state.throttle, state.brake, state.vertical_load}) {
                        if (!std::isfinite(value)) throw std::runtime_error("Non-finite telemetry");
                    }
                    if (state.rpm > car.powertrain.max_rpm * 1.0021 || state.throttle < 0 ||
                        state.throttle > 1 || state.brake < 0 || state.brake > 1) {
                        throw std::runtime_error("Invalid controls or RPM: " + carname + " " + stem);
                    }
                }
                std::sort(warm.begin(), warm.end());
                if (!first_row) out << ",\n";
                first_row = false;
                out << "  {\"track\":\"" << stem << "\",\"car\":\"" << carname
                    << "\",\"ds_m\":" << ds << ",\"lap_s\":" << lap << ",\"vmax_kmh\":" << st.top_speed * 3.6
                    << ",\"cold_ms\":" << cold << ",\"warm_median_ms\":" << warm[2]
                    << ",\"warm_max_ms\":" << warm.back() << "}";
                std::cerr << stem << " " << carname << " lap=" << lap << " s cold=" << cold
                          << " ms reused=" << warm[2] << " ms\n";
            }
        }
        out << "\n]\n";
        std::cerr << "55 car/track combinations: deterministic, finite, valid RPM and controls, ERS within budget\n";
        return 0;
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
