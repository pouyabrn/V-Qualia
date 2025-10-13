#include "data/SimulationState.h"
#include <cmath>
#include <sstream>
#include <iomanip>
#include <algorithm>

namespace LapTimeSim {

SimulationState::SimulationState() {
    reset();
}

void SimulationState::reset() {
    s = 0.0;
    n = 0.0;
    x = 0.0;
    y = 0.0;
    z = 0.0;
    
    v = 0.0;
    v_kmh = 0.0;
    ax = 0.0;
    ay = 0.0;
    az = 0.0;
    
    gx = 0.0;
    gy = 0.0;
    gz = 0.0;
    g_total = 0.0;
    
    throttle = 0.0;
    brake = 0.0;
    steering_angle = 0.0;
    
    gear = 1;
    rpm = 0.0;
    engine_torque = 0.0;
    wheel_force = 0.0;
    
    drag_force = 0.0;
    downforce = 0.0;
    tire_force_x = 0.0;
    tire_force_y = 0.0;
    vertical_load = 0.0;
    
    curvature = 0.0;
    radius = 1e9;  // Effectively infinite
    banking_angle = 0.0;
    
    timestamp = 0.0;
}

void SimulationState::updateGForces(double gravity) {
    if (gravity <= 0.0) gravity = 9.81;
    
    gx = ax / gravity;
    gy = ay / gravity;
    gz = az / gravity;
    g_total = std::sqrt(gx*gx + gy*gy + gz*gz);
}

std::string SimulationState::toString() const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(3);
    
    oss << "Time: " << timestamp << "s | "
        << "Speed: " << v_kmh << " km/h | "
        << "Pos: (" << x << ", " << y << ") | "
        << "G: (" << gx << ", " << gy << ") | "
        << "Throttle: " << (throttle * 100) << "% | "
        << "Brake: " << (brake * 100) << "% | "
        << "Gear: " << gear;
    
    return oss.str();
}

LapResult::LapResult() : lap_time_(0.0) {
}

void LapResult::addState(const SimulationState& state) {
    states_.push_back(state);
}

double LapResult::getMaxSpeed() const {
    if (states_.empty()) return 0.0;
    
    double max_speed = 0.0;
    for (const auto& state : states_) {
        max_speed = std::max(max_speed, state.v);
    }
    return max_speed;
}

double LapResult::getAverageSpeed() const {
    if (states_.empty() || lap_time_ <= 0.0) return 0.0;
    
    // Assuming states represent equal distance segments
    // Average speed = Total distance / Total time
    // For a lap, we can estimate from the last state's arc length
    if (!states_.empty()) {
        double total_distance = states_.back().s;
        return total_distance / lap_time_;
    }
    
    return 0.0;
}

void LapResult::getMaxGForces(double& max_gx, double& max_gy, double& max_g_total) const {
    max_gx = 0.0;
    max_gy = 0.0;
    max_g_total = 0.0;
    
    for (const auto& state : states_) {
        max_gx = std::max(max_gx, std::abs(state.gx));
        max_gy = std::max(max_gy, std::abs(state.gy));
        max_g_total = std::max(max_g_total, state.g_total);
    }
}

void LapResult::clear() {
    states_.clear();
    lap_time_ = 0.0;
}

} // namespace LapTimeSim


