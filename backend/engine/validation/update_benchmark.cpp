// Changing inputs: update setup and solve, then compare with a fresh solver.
#include "io/JSONParser.h"
#include "solver/QuasiSteadyStateSolver.h"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>

using namespace LapTimeSim;

int main(int argc, char** argv) {
    std::ostringstream quiet;
    auto* saved = std::cout.rdbuf(quiet.rdbuf());
    const auto cache = std::filesystem::temp_directory_path() /
        ("lap_update_" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()) + ".cache");
    try {
        if (argc != 2) throw std::runtime_error("Usage: lap_update_benchmark <output.json>");
        std::ofstream out(argv[1]);
        if (!out) throw std::runtime_error("Cannot write update benchmark");
        out << "[\n" << std::setprecision(10);
        bool first = true;
        for (const std::string stem : {"Monza", "montreal", "Zandvoort", "Shanghai", "Spielberg", "Silverstone",
                                      "Budapest", "Suzuka", "Austin", "Sakhir", "MexicoCity"}) {
            const std::string file = "examples/" + stem + ".csv";
            auto track = JSONParser::parseTrackCSV(file);
            JSONParser::applyElevationSidecar(track, file);
            JSONParser::applyBankingSidecar(track, file);
            const std::string package = stem == "Monza" ? "lowdf" :
                ((stem == "Zandvoort" || stem == "Budapest" || stem == "MexicoCity") ? "highdf" : "mediumdf");
            for (const std::string& carname : {"f1_2024_quali_" + package, "f1_2025_quali_" + package,
                    "f2_2024_quali_" + (package == "lowdf" ? std::string("monza") : package),
                    std::string("honda_civic_si_2025"), std::string("fsae_road_course")}) {
                auto car = JSONParser::parseVehicleJSON("examples/" + carname + ".json");
                car.aero.drs.zones = JSONParser::loadDRSSidecar(file);
                SolverOptions options;
                options.verbose = false;
                options.line.output_step = 2.0;
                options.line_cache = cache.string();
                QuasiSteadyStateSolver solver(track, car, options);
                solver.solve();
                double maximum_delta = 0.0;
                std::vector<double> timings;
                for (double grip : {0.995, 1.0, 1.005}) {
                    auto changed = car;
                    changed.tire.mu_x *= grip;
                    changed.tire.mu_y *= grip;
                    const auto t0 = std::chrono::steady_clock::now();
                    solver.updateVehicle(changed);
                    const double warm = solver.solve();
                    timings.push_back(std::chrono::duration<double, std::milli>(
                        std::chrono::steady_clock::now() - t0).count());
                    if (!solver.hasConverged() || !solver.getStats().line_cache_hit ||
                        solver.getStats().ers_energy_used > solver.getStats().ers_energy_budget) {
                        throw std::runtime_error("Invalid setup update: " + carname + " " + stem);
                    }
                    QuasiSteadyStateSolver fresh(track, changed, options);
                    const double cold = fresh.solve();
                    maximum_delta = std::max(maximum_delta, std::abs(warm - cold));
                    if (!std::isfinite(warm) || std::abs(warm - cold) > 0.02) {
                        throw std::runtime_error("Warm setup update disagreed with independent fresh solve: " + carname + " " + stem);
                    }
                }
                std::sort(timings.begin(), timings.end());
                if (!first) out << ",\n";
                first = false;
                out << "  {\"track\":\"" << stem << "\",\"car\":\"" << carname
                    << "\",\"update_median_ms\":" << timings[1] << ",\"update_max_ms\":" << timings.back()
                    << ",\"max_fresh_delta_s\":" << maximum_delta << "}";
                std::cerr << stem << ' ' << carname << " update=" << timings[1] << " ms fresh delta=" << maximum_delta << " s\n";
            }
        }
        out << "\n]\n";
        std::filesystem::remove(cache);
        std::cout.rdbuf(saved);
        std::cout << "PASS: 165 setup updates across 55 configurations, energy feasible, compared with fresh solves\n";
        return 0;
    } catch (const std::exception& e) {
        std::filesystem::remove(cache);
        std::cout.rdbuf(saved);
        std::cerr << e.what() << '\n';
        return 1;
    }
}
