#pragma once

#include "data/SimulationState.h"
#include "data/TrackData.h"
#include "data/VehicleParams.h"
#include "physics/AerodynamicsModel.h"
#include "physics/PowertrainModel.h"
#include "physics/TireModel.h"
#include "solver/GGVGenerator.h"
#include <memory>
#include <vector>

namespace LapTimeSim {

struct SolverTrackPoint {
    double s = 0.0;
    double ds = 0.0;
    double n = 0.0;
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;
    double psi = 0.0;
    double kappa = 0.0;
    double w_tr_left = 0.0;
    double w_tr_right = 0.0;
    double banking = 0.0;
};

class QuasiSteadyStateSolver {
public:
    QuasiSteadyStateSolver(const TrackData& track, const VehicleParams& vehicle);
    ~QuasiSteadyStateSolver() = default;

    double solve(int max_iterations = 10, double tolerance = 0.001);
    const std::vector<double>& getVelocityProfile() const { return v_optimal_; }
    LapResult getDetailedResult() const;
    double getLapTime() const { return lap_time_; }
    bool hasConverged() const { return converged_; }
    int getIterationsUsed() const { return iterations_used_; }
    void exportGGVToFile(const std::string& filename) const;

private:
    const TrackData& track_;
    const VehicleParams& vehicle_;

    std::unique_ptr<GGVGenerator> ggv_;
    std::unique_ptr<AerodynamicsModel> aero_;
    std::unique_ptr<TireModel> tire_;
    std::unique_ptr<PowertrainModel> powertrain_model_;

    std::vector<SolverTrackPoint> working_track_;
    std::vector<double> v_corner_;
    std::vector<double> v_optimal_;
    std::vector<int> gear_profile_;
    std::vector<bool> shift_profile_;

    size_t n_points_;
    double lap_time_;
    double top_speed_cap_;
    double estimated_track_width_;
    bool converged_;
    int iterations_used_;

    void initialize();
    void buildWorkingTrack();
    void calculateCorneringLimit();
    void forwardIntegration(size_t seed_index);
    void backwardIntegration(size_t seed_index);
    void updateGearProfile();
    double calculateLapTime() const;
    double solveCorneringVelocity(double kappa, double banking) const;
    double getVerticalLoad(double velocity, double banking) const;
    double getLateralForceDemand(double velocity, double curvature, double banking) const;
    double getMaxLateralTireForce(double Fz_total, double lateral_accel) const;
    double getMaxLongitudinalTireForce(double Fz_total, double lateral_accel) const;
    double getAvailableLongitudinalTireForce(double Fz_total, double Fy_current, double lateral_accel) const;
    double getMaxDriveAcceleration(double velocity, double curvature, double banking) const;
    double getMaxBrakeAcceleration(double velocity, double curvature, double banking) const;
    SimulationState createState(size_t index, double time, int gear) const;
};

} // namespace LapTimeSim
