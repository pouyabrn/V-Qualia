#include "solver/GGVGenerator.h"
#include <algorithm>
#include <cmath>
#include <fstream>
#include <iostream>
#include <stdexcept>

namespace LapTimeSim {

GGVGenerator::GGVGenerator(const VehicleParams& vehicle)
    : vehicle_(vehicle),
      aero_model_(vehicle.aero),
      tire_model_(vehicle.tire),
      powertrain_model_(vehicle.powertrain, vehicle.tire.tire_radius),
      generated_(false),
      v_min_(0), v_max_(0), v_step_(1),
      ay_min_(0), ay_max_(0), ay_step_(1) {
}

void GGVGenerator::generate(double v_min, double v_max, double v_step,
                            double ay_max, double ay_step) {
    v_min_ = v_min;
    v_max_ = v_max;
    v_step_ = v_step;
    ay_min_ = 0.0;  // We'll use absolute value of lateral accel
    ay_max_ = ay_max;
    ay_step_ = ay_step;
    
    ggv_points_.clear();
    
    // Generate grid of (v, ay) points
    for (double v = v_min; v <= v_max; v += v_step) {
        for (double ay = 0.0; ay <= ay_max; ay += ay_step) {
            GGVPoint point;
            point.velocity = v;
            point.ay_lateral = ay;
            point.ax_max_accel = calculateMaxAcceleration(v, ay);
            point.ax_max_brake = calculateMaxBraking(v, ay);
            
            ggv_points_.push_back(point);
        }
    }
    
    generated_ = true;
}

double GGVGenerator::calculateMaxAcceleration(double v, double ay) const {
    const double g = VehicleParams::GRAVITY;
    const double m = vehicle_.mass.mass;
    
    // Minimum velocity for calculations
    if (v < 0.1) v = 0.1;
    
    // Calculate vertical load including downforce
    double Fz_total = aero_model_.getTotalVerticalLoad(v, m, g);
    
    // Calculate lateral force required for current lateral acceleration
    double Fy_required = m * ay;
    
    // Get available longitudinal force from tire model (friction circle)
    double Fx_tire_max = tire_model_.getAvailableLongitudinalForce(Fz_total, Fy_required);
    
    // Get engine force
    double Fx_engine = powertrain_model_.getMaxWheelForce(v);
    
    // Get drag force (negative acceleration)
    double F_drag = aero_model_.getDragForce(v);
    
    // Net force is limited by minimum of engine and tire grip
    double Fx_available = std::min(Fx_engine, Fx_tire_max);
    
    // Net longitudinal force (subtract drag)
    double Fx_net = Fx_available - F_drag;
    
    // Acceleration = F / m
    double ax = Fx_net / m;
    
    // Cannot accelerate backwards, and cap at reasonable F1 values
    return std::max(0.0, std::min(ax, 50.0));  // Cap at ~5g acceleration
}

double GGVGenerator::calculateMaxBraking(double v, double ay) const {
    const double g = VehicleParams::GRAVITY;
    const double m = vehicle_.mass.mass;
    
    // Minimum velocity for calculations
    if (v < 0.1) v = 0.1;
    
    // Calculate vertical load including downforce
    double Fz_total = aero_model_.getTotalVerticalLoad(v, m, g);
    
    // Calculate lateral force required
    double Fy_required = m * ay;
    
    // Get available longitudinal force from tire model
    double Fx_tire_max = tire_model_.getAvailableLongitudinalForce(Fz_total, Fy_required);
    
    // Braking force is limited by tire grip and brake system
    double Fx_brake_system = vehicle_.brake.max_brake_force;
    double Fx_brake = std::min(Fx_tire_max, Fx_brake_system);
    
    // Drag helps with braking
    double F_drag = aero_model_.getDragForce(v);
    
    // Net braking force (both negative)
    double Fx_net = -(Fx_brake + F_drag);
    
    // Deceleration = F / m (negative value)
    double ax = Fx_net / m;
    
    // Cap at reasonable F1 braking values
    return std::max(ax, -60.0);  // Cap at ~6g braking
}

double GGVGenerator::getMaxAcceleration(double v, double ay) const {
    if (!generated_) {
        throw std::runtime_error("GGV diagram has not been generated");
    }
    
    return interpolateAcceleration(v, std::abs(ay));
}

double GGVGenerator::getMaxBraking(double v, double ay) const {
    if (!generated_) {
        throw std::runtime_error("GGV diagram has not been generated");
    }
    
    return interpolateBraking(v, std::abs(ay));
}

double GGVGenerator::interpolateAcceleration(double v, double ay) const {
    // Clamp to valid range
    v = std::max(v_min_, std::min(v_max_, v));
    ay = std::max(0.0, std::min(ay_max_, ay));
    
    // Find surrounding grid points
    double v_idx_f = (v - v_min_) / v_step_;
    double ay_idx_f = ay / ay_step_;
    
    int v_idx = static_cast<int>(v_idx_f);
    int ay_idx = static_cast<int>(ay_idx_f);
    
    double v_t = v_idx_f - v_idx;
    double ay_t = ay_idx_f - ay_idx;
    
    // Get values at four corners
    int num_ay_points = static_cast<int>((ay_max_ - ay_min_) / ay_step_) + 1;
    
    auto getValue = [&](int vi, int ayi) -> double {
        int index = vi * num_ay_points + ayi;
        if (index >= 0 && index < static_cast<int>(ggv_points_.size())) {
            return ggv_points_[index].ax_max_accel;
        }
        return 0.0;
    };
    
    // Bilinear interpolation
    double v00 = getValue(v_idx, ay_idx);
    double v10 = getValue(v_idx + 1, ay_idx);
    double v01 = getValue(v_idx, ay_idx + 1);
    double v11 = getValue(v_idx + 1, ay_idx + 1);
    
    double v0 = v00 * (1 - v_t) + v10 * v_t;
    double v1 = v01 * (1 - v_t) + v11 * v_t;
    
    return v0 * (1 - ay_t) + v1 * ay_t;
}

double GGVGenerator::interpolateBraking(double v, double ay) const {
    // Similar to interpolateAcceleration but for braking
    v = std::max(v_min_, std::min(v_max_, v));
    ay = std::max(0.0, std::min(ay_max_, ay));
    
    double v_idx_f = (v - v_min_) / v_step_;
    double ay_idx_f = ay / ay_step_;
    
    int v_idx = static_cast<int>(v_idx_f);
    int ay_idx = static_cast<int>(ay_idx_f);
    
    double v_t = v_idx_f - v_idx;
    double ay_t = ay_idx_f - ay_idx;
    
    int num_ay_points = static_cast<int>((ay_max_ - ay_min_) / ay_step_) + 1;
    
    auto getValue = [&](int vi, int ayi) -> double {
        int index = vi * num_ay_points + ayi;
        if (index >= 0 && index < static_cast<int>(ggv_points_.size())) {
            return ggv_points_[index].ax_max_brake;
        }
        return 0.0;
    };
    
    double v00 = getValue(v_idx, ay_idx);
    double v10 = getValue(v_idx + 1, ay_idx);
    double v01 = getValue(v_idx, ay_idx + 1);
    double v11 = getValue(v_idx + 1, ay_idx + 1);
    
    double v0 = v00 * (1 - v_t) + v10 * v_t;
    double v1 = v01 * (1 - v_t) + v11 * v_t;
    
    return v0 * (1 - ay_t) + v1 * ay_t;
}

void GGVGenerator::exportToCSV(const std::string& filename) const {
    std::ofstream file(filename);
    if (!file.is_open()) {
        throw std::runtime_error("Failed to open file for writing: " + filename);
    }
    
    file << "velocity_ms,lateral_accel_ms2,max_accel_ms2,max_brake_ms2\n";
    
    for (const auto& point : ggv_points_) {
        file << point.velocity << ","
             << point.ay_lateral << ","
             << point.ax_max_accel << ","
             << point.ax_max_brake << "\n";
    }
    
    file.close();
}

} // namespace LapTimeSim

