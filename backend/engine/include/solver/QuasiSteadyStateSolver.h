#pragma once

#include "data/TrackData.h"
#include "data/VehicleParams.h"
#include "data/SimulationState.h"
#include "solver/GGVGenerator.h"
#include "physics/AerodynamicsModel.h"
#include "physics/TireModel.h"
#include "physics/PowertrainModel.h"
#include <vector>
#include <memory>

namespace LapTimeSim {

/**
 * @brief Quasi-Steady-State lap time solver
 * 
 * Implements the three-pass algorithm:
 * 1. Cornering-limited velocity profile
 * 2. Forward integration (acceleration-limited)
 * 3. Backward integration (braking-limited)
 * 
 * The final velocity profile is the minimum of all three.
 */
class QuasiSteadyStateSolver {
public:
    /**
     * @brief Constructor
     * @param track Track data (must be preprocessed)
     * @param vehicle Vehicle parameters
     */
    QuasiSteadyStateSolver(const TrackData& track, const VehicleParams& vehicle);
    ~QuasiSteadyStateSolver() = default;
    
    /**
     * @brief Solve for optimal lap time
     * @param max_iterations Maximum number of iterations for convergence
     * @param tolerance Convergence tolerance (change in lap time)
     * @return Total lap time in seconds
     */
    double solve(int max_iterations = 10, double tolerance = 0.001);
    
    /**
     * @brief Get the computed velocity profile
     * @return Vector of velocities at each track point (m/s)
     */
    const std::vector<double>& getVelocityProfile() const { return v_optimal_; }
    
    /**
     * @brief Get complete simulation result with telemetry
     * @return LapResult containing all states
     */
    LapResult getDetailedResult() const;
    
    /**
     * @brief Get lap time from last solve
     */
    double getLapTime() const { return lap_time_; }
    
    /**
     * @brief Check if solver has converged
     */
    bool hasConverged() const { return converged_; }
    
    /**
     * @brief Get number of iterations used
     */
    int getIterationsUsed() const { return iterations_used_; }

private:
    const TrackData& track_;
    const VehicleParams& vehicle_;
    
    std::unique_ptr<GGVGenerator> ggv_;
    std::unique_ptr<AerodynamicsModel> aero_;
    std::unique_ptr<TireModel> tire_;
    std::unique_ptr<PowertrainModel> powertrain_model_;
    
    size_t n_points_;
    
    // Velocity profiles from each pass
    std::vector<double> v_corner_;   // Cornering-limited
    std::vector<double> v_accel_;    // Acceleration-limited
    std::vector<double> v_brake_;    // Braking-limited
    std::vector<double> v_optimal_;  // Final optimal (min of all three)
    
    double lap_time_;
    bool converged_;
    int iterations_used_;
    
    /**
     * @brief Initialize solver and generate GGV diagram
     */
    void initialize();
    
    /**
     * @brief Pass 1: Calculate cornering-limited velocity
     * 
     * For each point, solve:
     * m × v² × |κ| = μ × Fz(v)
     * where Fz(v) = mg + downforce(v)
     */
    void calculateCorneringLimit();
    
    /**
     * @brief Pass 2: Forward integration (acceleration limit)
     * 
     * Starting from first point, integrate forward using maximum acceleration:
     * v²[i+1] = v²[i] + 2 × ax_max × ds[i]
     */
    void forwardIntegration();
    
    /**
     * @brief Pass 3: Backward integration (braking limit)
     * 
     * Starting from last point, integrate backward using maximum braking:
     * v²[i-1] = v²[i] - 2 × ax_min × ds[i-1]
     */
    void backwardIntegration();
    
    /**
     * @brief Combine all three profiles to get optimal velocity
     * 
     * v_optimal[i] = min(v_corner[i], v_accel[i], v_brake[i])
     */
    void combineProfiles();
    
    /**
     * @brief Calculate total lap time from velocity profile
     * 
     * T = Σ (ds[i] / v[i])
     */
    double calculateLapTime() const;
    
    /**
     * @brief Solve cornering limit equation for velocity
     * 
     * Quadratic equation: v²(m|κ| - 0.5μρClA) = μmg
     * @param kappa Track curvature (1/m)
     * @return Maximum cornering velocity (m/s)
     */
    double solveCorneringVelocity(double kappa) const;
    
    /**
     * @brief Create detailed simulation state for a track point
     */
    SimulationState createState(size_t index, double time) const;
};

} // namespace LapTimeSim

