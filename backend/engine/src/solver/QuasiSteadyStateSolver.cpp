#include "solver/QuasiSteadyStateSolver.h"
#include <cmath>
#include <algorithm>
#include <stdexcept>
#include <iostream>

namespace LapTimeSim {

QuasiSteadyStateSolver::QuasiSteadyStateSolver(const TrackData& track, 
                                               const VehicleParams& vehicle)
    : track_(track),
      vehicle_(vehicle),
      n_points_(track.getNumPoints()),
      lap_time_(0.0),
      converged_(false),
      iterations_used_(0) {
    
    if (!track_.isPreprocessed()) {
        throw std::runtime_error("Track must be preprocessed before solving");
    }
    
    if (!vehicle_.validate()) {
        throw std::runtime_error("Vehicle parameters are invalid");
    }
    
    // Resize velocity vectors
    v_corner_.resize(n_points_, 0.0);
    v_accel_.resize(n_points_, 0.0);
    v_brake_.resize(n_points_, 0.0);
    v_optimal_.resize(n_points_, 0.0);
    
    // Initialize models
    ggv_ = std::make_unique<GGVGenerator>(vehicle_);
    aero_ = std::make_unique<AerodynamicsModel>(vehicle_.aero);
    tire_ = std::make_unique<TireModel>(vehicle_.tire);
    powertrain_model_ = std::make_unique<PowertrainModel>(vehicle_.powertrain, vehicle_.tire.tire_radius);
}

void QuasiSteadyStateSolver::initialize() {
    std::cout << "Initializing solver..." << std::endl;
    std::cout << "Generating GGV diagram..." << std::endl;
    
    // Generate GGV diagram
    // Velocity range: 0 to high speed for F1
    double v_max = 120.0;  // 432 km/h - above realistic F1 top speed
    double v_step = 0.5;  // 0.5 m/s resolution
    
    // Lateral acceleration range: 0 to ~5g
    double ay_max = 50.0;  // m/s² (≈ 5g)
    double ay_step = 1.0;  // 1 m/s² resolution
    
    ggv_->generate(0.0, v_max, v_step, ay_max, ay_step);
    
    std::cout << "GGV diagram generated with v_max = " << v_max << " m/s (" 
              << (v_max * 3.6) << " km/h)" << std::endl;
}

double QuasiSteadyStateSolver::solve(int max_iterations, double tolerance) {
    initialize();
    
    std::cout << "Starting quasi-steady-state solver..." << std::endl;
    std::cout << "Track: " << n_points_ << " points, "
              << track_.getTotalLength() << " m" << std::endl;
    
    // Calculate cornering limit once (doesn't change between iterations)
    calculateCorneringLimit();
    
    // INITIALIZE: Start from realistic initial speed
    // Begin at moderate speed, not max cornering limit
    double initial_speed = 50.0;  // 50 m/s = 180 km/h (realistic rolling start)
    
    for (size_t i = 0; i < n_points_; ++i) {
        // Start at minimum of initial speed or cornering limit
        v_accel_[i] = std::min(initial_speed, v_corner_[i]);
        v_brake_[i] = std::min(initial_speed, v_corner_[i]);
    }
    
    double prev_lap_time = 1e9;
    converged_ = false;
    
    for (int iter = 0; iter < max_iterations; ++iter) {
        iterations_used_ = iter + 1;
        
        // Forward pass (acceleration)
        forwardIntegration();
        
        // Backward pass (braking)
        backwardIntegration();
        
        // Combine profiles
        combineProfiles();
        
        // Calculate lap time
        lap_time_ = calculateLapTime();
        
        std::cout << "Iteration " << (iter + 1) << ": Lap time = " 
                  << lap_time_ << " s" << std::endl;
        
        // Check convergence
        double lap_time_change = std::abs(lap_time_ - prev_lap_time);
        if (lap_time_change < tolerance) {
            converged_ = true;
            std::cout << "Converged!" << std::endl;
            break;
        }
        
        prev_lap_time = lap_time_;
    }
    
    if (!converged_) {
        std::cout << "Warning: Did not converge within " << max_iterations 
                  << " iterations" << std::endl;
    }
    
    std::cout << "Final lap time: " << lap_time_ << " seconds" << std::endl;
    
    return lap_time_;
}

void QuasiSteadyStateSolver::calculateCorneringLimit() {
    int straight_count = 0;
    double max_v_corner = 0.0;
    double min_v_corner = 1e9;
    
    for (size_t i = 0; i < n_points_; ++i) {
        const TrackPoint& point = track_.getPoint(i);
        v_corner_[i] = solveCorneringVelocity(point.kappa);
        
        if (std::abs(point.kappa) < 0.002) {
            straight_count++;
        }
        
        max_v_corner = std::max(max_v_corner, v_corner_[i]);
        min_v_corner = std::min(min_v_corner, v_corner_[i]);
    }
    
    std::cout << "Cornering limits calculated:" << std::endl;
    std::cout << "  Straight sections (|kappa| < 1e-6): " << straight_count 
              << " / " << n_points_ << std::endl;
    std::cout << "  v_corner range: " << (min_v_corner * 3.6) << " to " 
              << (max_v_corner * 3.6) << " km/h" << std::endl;
}

double QuasiSteadyStateSolver::solveCorneringVelocity(double kappa) const {
    const double g = VehicleParams::GRAVITY;
    const double m = vehicle_.mass.mass;
    const double mu = vehicle_.tire.mu_y;
    const double rho = vehicle_.aero.air_density;
    const double Cl = vehicle_.aero.Cl;
    const double A = vehicle_.aero.frontal_area;
    
    // Handle straight or nearly-straight sections
    // Monza has long straights but with tiny curvature from track irregularities
    if (std::abs(kappa) < 0.002) {  // Less than 0.002 rad/m = radius > 500m = very gentle
        // For straights and gentle curves, return high speed
        return 110.0;  // ~396 km/h - reasonable F1 top speed at Monza
    }
    
    // Solve: m × v² × |κ| = μ × (mg + 0.5 × ρ × v² × Cl × A)
    // Rearranging: v²(m|κ| - 0.5μρ(-Cl)A) = μmg
    
    double abs_kappa = std::abs(kappa);
    double aero_factor = 0.5 * mu * rho * (-Cl) * A;  // Cl is negative for downforce
    double denominator = m * abs_kappa - aero_factor;
    double numerator = mu * m * g;
    
    if (denominator <= 0.0) {
        // Downforce contribution exceeds mechanical requirement
        // Still limited by straight-line max speed
        return 100.0;  // ~360 km/h
    }
    
    double v_squared = numerator / denominator;
    
    if (v_squared < 0.0) {
        return 0.0;
    }
    
    double v_corner = std::sqrt(v_squared);
    
    // No artificial cap - let physics determine the limit
    return v_corner;
}

void QuasiSteadyStateSolver::forwardIntegration() {
    // Forward pass: accelerate from each point using maximum available force
    // v_accel_ is already initialized in solve()
    
    for (size_t i = 0; i < n_points_ - 1; ++i) {
        double v_start = std::max(v_accel_[i], 1.0);  // Never go below 1 m/s
        const TrackPoint& point = track_.getPoint(i);
        
        // Calculate lateral acceleration at this point
        double ay = v_start * v_start * std::abs(point.kappa);
        
        // Get maximum longitudinal acceleration from GGV
        double ax_max = ggv_->getMaxAcceleration(v_start, ay);
        
        // Clamp acceleration to reasonable values
        ax_max = std::min(ax_max, 50.0);
        
        // Integrate forward: v²_end = v²_start + 2 × a × ds
        double v_squared_end = v_start * v_start + 2.0 * ax_max * point.ds;
        
        double v_end = (v_squared_end > 0.0) ? std::sqrt(v_squared_end) : v_start;
        
        // Constrain by cornering limit at next point
        v_accel_[i + 1] = std::min(v_end, v_corner_[i + 1]);
        v_accel_[i + 1] = std::max(v_accel_[i + 1], 1.0);  // Minimum velocity
    }
    
    // Handle the loop closure (last point to first)
    size_t last = n_points_ - 1;
    double v_start = v_accel_[last];
    const TrackPoint& point = track_.getPoint(last);
    double ay = v_start * v_start * std::abs(point.kappa);
    double ax_max = ggv_->getMaxAcceleration(v_start, ay);
    double v_squared_end = v_start * v_start + 2.0 * ax_max * point.ds;
    double v_end = (v_squared_end > 0.0) ? std::sqrt(v_squared_end) : 0.0;
    
    // Update first point for next iteration
    v_accel_[0] = std::min(v_accel_[0], std::min(v_end, v_corner_[0]));
}

void QuasiSteadyStateSolver::backwardIntegration() {
    // Backward pass: determine braking points working backward from each corner
    // v_brake_ is already initialized in solve()
    
    for (int i = static_cast<int>(n_points_) - 1; i > 0; --i) {
        double v_start = std::max(v_brake_[i], 1.0);  // Never go below 1 m/s
        
        // Get the previous point's data
        size_t i_prev = static_cast<size_t>(i - 1);
        const TrackPoint& point_prev = track_.getPoint(i_prev);
        
        // Calculate lateral acceleration
        double ay = v_start * v_start * std::abs(track_.getPoint(i).kappa);
        
        // Get maximum braking from GGV (negative value)
        double ax_min = ggv_->getMaxBraking(v_start, ay);
        
        // Clamp braking to reasonable values
        ax_min = std::max(ax_min, -60.0);
        
        // Integrate backward: v²_prev = v²_curr - 2 × a × ds
        // (Note: ax_min is negative, so this actually increases v²)
        double v_squared_prev = v_start * v_start - 2.0 * ax_min * point_prev.ds;
        
        double v_prev = (v_squared_prev > 0.0) ? std::sqrt(v_squared_prev) : v_start;
        
        // Constrain by cornering limit
        v_brake_[i_prev] = std::min(v_prev, v_corner_[i_prev]);
        v_brake_[i_prev] = std::max(v_brake_[i_prev], 1.0);  // Minimum velocity
    }
    
    // Handle loop closure (first point to last)
    double v_start = v_brake_[0];
    const TrackPoint& last_point = track_.getPoint(n_points_ - 1);
    double ay = v_start * v_start * std::abs(track_.getPoint(0).kappa);
    double ax_min = ggv_->getMaxBraking(v_start, ay);
    double v_squared_prev = v_start * v_start - 2.0 * ax_min * last_point.ds;
    double v_prev = (v_squared_prev > 0.0) ? std::sqrt(v_squared_prev) : 0.0;
    
    // Update last point for next iteration
    v_brake_[n_points_ - 1] = std::min(v_brake_[n_points_ - 1], 
                                        std::min(v_prev, v_corner_[n_points_ - 1]));
}

void QuasiSteadyStateSolver::combineProfiles() {
    for (size_t i = 0; i < n_points_; ++i) {
        v_optimal_[i] = std::min({v_corner_[i], v_accel_[i], v_brake_[i]});
    }
}

double QuasiSteadyStateSolver::calculateLapTime() const {
    double total_time = 0.0;
    
    for (size_t i = 0; i < n_points_; ++i) {
        const TrackPoint& point = track_.getPoint(i);
        
        if (v_optimal_[i] > 0.0) {
            double dt = point.ds / v_optimal_[i];
            total_time += dt;
        }
    }
    
    return total_time;
}

LapResult QuasiSteadyStateSolver::getDetailedResult() const {
    LapResult result;
    result.setLapTime(lap_time_);
    
    double cumulative_time = 0.0;
    
    for (size_t i = 0; i < n_points_; ++i) {
        SimulationState state = createState(i, cumulative_time);
        result.addState(state);
        
        const TrackPoint& point = track_.getPoint(i);
        if (v_optimal_[i] > 0.0) {
            cumulative_time += point.ds / v_optimal_[i];
        }
    }
    
    return result;
}

SimulationState QuasiSteadyStateSolver::createState(size_t index, double time) const {
    SimulationState state;
    
    const TrackPoint& point = track_.getPoint(index);
    double v = v_optimal_[index];
    
    // Position
    state.s = point.s;
    state.n = 0.0;  // On centerline (no lateral optimization yet)
    state.x = point.x;
    state.y = point.y;
    state.z = point.z;
    
    // Velocity
    state.v = v;
    state.v_kmh = v * 3.6;
    
    // Accelerations
    state.ay = v * v * point.kappa;  // Lateral
    
    // Longitudinal acceleration (approximate from velocity change)
    if (index < n_points_ - 1) {
        double v_next = v_optimal_[index + 1];
        double dv = v_next - v;
        double dt = (v > 0.0) ? (point.ds / v) : 0.0;
        state.ax = (dt > 0.0) ? (dv / dt) : 0.0;
    } else {
        state.ax = 0.0;
    }
    
    state.az = VehicleParams::GRAVITY;  // Vertical (gravity)
    
    // G-forces
    state.updateGForces();
    
    // Track properties
    state.curvature = point.kappa;
    state.radius = (std::abs(point.kappa) > 1e-6) ? (1.0 / std::abs(point.kappa)) : 1e9;
    state.banking_angle = point.banking;
    
    // Forces
    state.drag_force = aero_->getDragForce(v);
    state.downforce = aero_->getDownforce(v);
    state.vertical_load = aero_->getTotalVerticalLoad(v, vehicle_.mass.mass);
    
    // Control inputs (simplified - would need more sophisticated logic for exact values)
    if (state.ax > 0.1) {
        state.throttle = std::min(1.0, state.ax / 20.0);  // Rough estimate
        state.brake = 0.0;
    } else if (state.ax < -0.1) {
        state.throttle = 0.0;
        state.brake = std::min(1.0, -state.ax / 30.0);
    } else {
        state.throttle = 0.0;
        state.brake = 0.0;
    }
    
    // Steering (simplified)
    state.steering_angle = std::atan(vehicle_.mass.wheelbase * point.kappa);
    
    // Time
    state.timestamp = time;
    
    // Gear and RPM - calculate optimal gear for current speed
    state.gear = powertrain_model_->getOptimalGear(v);
    state.rpm = powertrain_model_->getRPM(v, state.gear);
    
    return state;
}

} // namespace LapTimeSim

