#pragma once

#include "data/SimulationState.h"
#include "data/TrackData.h"
#include "data/VehicleParams.h"
#include "physics/VehicleModel.h"
#include "solver/GGVGenerator.h"
#include "solver/RacingLine.h"
#include <limits>
#include <memory>
#include <string>
#include <vector>

namespace LapTimeSim {

struct SolverOptions {
    LineOptions line;                    ///< Racing line settings (edge margin is taken from the vehicle unless overridden)
    bool override_edge_margin = false;   ///< true = use line.edge_margin instead of the vehicle value
    bool enable_drs = true;
    bool enable_ers = true;
    bool verbose = true;
    std::string line_cache;              ///< Optional file used to store / reuse the optimised racing line
};

struct SolverStats {
    double line_length = 0.0;
    double centerline_length = 0.0;
    double top_speed = 0.0;
    double min_speed = 0.0;
    double avg_speed = 0.0;
    double ers_energy_used = 0.0;     ///< J taken from storage
    double ers_energy_budget = 0.0;   ///< J available (storage + recovery)
    double ers_clip_speed = 0.0;      ///< Deployment stops above this speed (m/s), inf = never
    double full_throttle_fraction = 0.0;
    double braking_fraction = 0.0;
    int drs_zones = 0;
    double drs_length = 0.0;
    int upshifts = 0;
    int line_sweeps = 0;
    double max_path_curvature = 0.0;
    double solve_time_ms = 0.0;
    bool line_cache_hit = false;       ///< The prepared path was reused in memory
};

/**
 * @brief Quasi-steady-state minimum lap time solver.
 *
 * Pipeline:
 *  1. Build the driven path (minimum-curvature racing line inside the track limits)
 *  2. Detect / map DRS zones
 *  3. Steady-state cornering speed limit at every point
 *  4. Forward (acceleration) pass with gear selection, physical shift interruption,
 *     ERS deployment and DRS; backward (braking) pass; both with RK2 integration
 *  5. ERS energy management: deployment clipping speed found by bisection so the
 *     energy used per lap matches the budget
 */
class QuasiSteadyStateSolver {
public:
    QuasiSteadyStateSolver(const TrackData& track, const VehicleParams& vehicle);
    QuasiSteadyStateSolver(const TrackData& track, const VehicleParams& vehicle, const SolverOptions& options);
    ~QuasiSteadyStateSolver() = default;

    /// Solve for the minimum lap time. max_iterations caps the ERS bisection, tolerance is the lap-time
    /// tolerance (s) used to stop it.
    double solve(int max_iterations = 40, double tolerance = 1e-4);
    /// Change setup while retaining prepared geometry. Old results are invalid
    /// until solve() is called; the supplied car is copied, never referenced.
    void updateVehicle(const VehicleParams& vehicle);

    const std::vector<double>& getVelocityProfile() const { return v_; }
    LapResult getDetailedResult() const;
    double getLapTime() const { return lap_time_; }
    bool hasConverged() const { return converged_; }
    int getIterationsUsed() const { return iterations_used_; }
    const SolverStats& getStats() const { return stats_; }
    const std::vector<PathPoint>& getPath() const { return path_; }
    const std::vector<double>& getCornerSpeedLimit() const { return v_corner_; }

    void exportGGVToFile(const std::string& filename, bool with_ers = true, bool drs_open = false) const;
    void exportRacingLine(const std::string& filename) const;
    void exportLineNodes(const std::string& filename) const;

private:
    struct Segment {
        double kappa = 0.0;
        double ds = 0.0;
        RoadConditions rc;      ///< DRS closed
        RoadConditions rc_drs;  ///< DRS open if the segment is in a zone
        bool drs_zone = false;
    };

    struct Profile {
        std::vector<double> v;
        std::vector<int> gear;
        std::vector<char> interrupted;
        std::vector<double> ers_force;
        double lap_time = 0.0;
        double ers_energy = 0.0;
        double full_throttle_time = 0.0;
        double braking_time = 0.0;
        int upshifts = 0;
    };

    const TrackData& track_;
    VehicleParams vehicle_;     ///< Owned snapshot; changes only through updateVehicle()
    SolverOptions options_;

    std::unique_ptr<VehicleModel> model_;
    mutable std::unique_ptr<GGVGenerator> ggv_;

    std::vector<PathPoint> path_;
    std::string path_key_;
    std::vector<double> line_node_s_, line_node_offset_;
    std::vector<Segment> segments_;
    std::vector<double> v_corner_;
    std::vector<double> v_;
    std::vector<int> gear_;
    std::vector<char> interrupted_;
    std::vector<double> ers_force_;

    size_t n_points_ = 0;
    size_t seed_ = 0;
    double v_cap_ = 0.0;
    double v_clip_ = std::numeric_limits<double>::infinity();
    double clip_lo_ = 0.0, clip_hi_ = 0.0;
    bool have_clip_bracket_ = false;
    bool car_updated_ = false;
    bool ers_active_ = false;
    double lap_time_ = 0.0;
    bool converged_ = false;
    int iterations_used_ = 0;
    SolverStats stats_;

    void buildPath();
    void detectDRSZones();
    void calculateCorneringLimit();
    Profile computeProfile(double v_clip, bool ers_on) const;
    double energyBudget(const Profile& profile) const;
    SimulationState createState(size_t index, double time) const;
};

} // namespace LapTimeSim
