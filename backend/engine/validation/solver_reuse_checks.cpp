#include "io/JSONParser.h"
#include "solver/QuasiSteadyStateSolver.h"
#include <cmath>
#include <iostream>
#include <stdexcept>

using namespace LapTimeSim;

int main() {
    try {
        auto track = JSONParser::parseTrackCSV("examples/Monza.csv");
        auto car = JSONParser::parseVehicleJSON("examples/f1_2025_quali_lowdf.json");
        car.powertrain.ers.energy_per_lap = 0.2e6; // force energy management to run
        SolverOptions options;
        options.verbose = false;
        QuasiSteadyStateSolver solver(track, car, options);
        const double first = solver.solve();
        const double cold_ms = solver.getStats().solve_time_ms;
        const int zones = solver.getStats().drs_zones;
        const double second = solver.solve();
        if (std::abs(first - second) > 1e-9 || !solver.getStats().line_cache_hit ||
            zones != solver.getStats().drs_zones) {
            throw std::runtime_error("Repeated solve changed the lap or failed to reuse the path");
        }
        std::cout << "Cold solve " << cold_ms << " ms, reused " << solver.getStats().solve_time_ms
                  << " ms, lap " << second << " s\n";
        const auto telemetry = solver.getDetailedResult();
        const auto& first_state = telemetry.getStates().front();
        const auto& closing_state = telemetry.getStates().back();
        if (closing_state.timestamp != second || closing_state.s != telemetry.getTotalDistance() ||
            closing_state.x != first_state.x || closing_state.y != first_state.y || closing_state.v != first_state.v) {
            throw std::runtime_error("Telemetry did not close the complete periodic lap");
        }
        car.tire.mu_y = 0.5; // caller edits must not diverge from the model snapshot
        if (std::abs(second - solver.solve()) > 1e-9) {
            throw std::runtime_error("Caller vehicle edit changed a constructed solver");
        }
        auto capped_car = JSONParser::parseVehicleJSON("examples/f1_2025_quali_lowdf.json");
        capped_car.powertrain.ers.energy_per_lap = 0.2e6;
        QuasiSteadyStateSolver capped(track, capped_car, options);
        capped.solve(1);
        if (capped.hasConverged() || capped.getStats().ers_energy_used > capped.getStats().ers_energy_budget) {
            throw std::runtime_error("Capped ERS solve falsely reported convergence or exceeded the budget");
        }
        solver.updateVehicle(car);
        if (solver.hasConverged() || solver.getLapTime() != 0.0) {
            throw std::runtime_error("Vehicle update left a stale lap result");
        }
        bool threw = false;
        try { solver.getDetailedResult(); } catch (const std::runtime_error&) { threw = true; }
        if (!threw) throw std::runtime_error("Vehicle update left stale telemetry accessible");
        const double slower = solver.solve();
        if (!solver.getStats().line_cache_hit || slower <= second) {
            throw std::runtime_error("Vehicle update did not reuse geometry or change the physics");
        }
        auto invalid = car;
        invalid.mass.mass = -1;
        threw = false;
        try { solver.updateVehicle(invalid); } catch (const std::exception&) { threw = true; }
        if (!threw || std::abs(solver.solve() - slower) > 1e-9) {
            throw std::runtime_error("Invalid vehicle update changed the valid solver");
        }
        track.setBankingAt(0, 0.1);
        solver.solve();
        if (solver.getStats().line_cache_hit) throw std::runtime_error("Track edit did not invalidate the path");
        std::cout << "PASS: reuse, deterministic result, vehicle updates, stale-result rejection and invalidation\n";
        return 0;
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
