#include "solver/GGVGenerator.h"
#include <algorithm>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>

namespace LapTimeSim {

GGVGenerator::GGVGenerator(const VehicleParams& vehicle)
    : vehicle_(vehicle),
      aero_model_(vehicle.aero),
      tire_model_(vehicle.tire, vehicle.mass.mass * VehicleParams::GRAVITY / 4.0),
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

    const double velocity = std::max(0.0, v);
    const double Fz_total = aero_model_.getTotalVerticalLoad(velocity, m, g);
    const double Fy_required = m * std::abs(ay);
    const double Fx_tire_max = tire_model_.getAvailableLongitudinalForce(Fz_total, Fy_required);
    const double Fx_engine = powertrain_model_.getBestAccelerationPoint(velocity).wheel_force;
    const double Fx_net = std::min(Fx_engine, Fx_tire_max) - aero_model_.getDragForce(velocity);

    return std::max(0.0, Fx_net / m);
}

double GGVGenerator::calculateMaxBraking(double v, double ay) const {
    const double g = VehicleParams::GRAVITY;
    const double m = vehicle_.mass.mass;

    const double velocity = std::max(0.0, v);
    const double Fz_total = aero_model_.getTotalVerticalLoad(velocity, m, g);
    const double Fy_required = m * std::abs(ay);
    const double Fx_tire_max = tire_model_.getAvailableLongitudinalForce(Fz_total, Fy_required);
    const double Fx_brake = std::min(Fx_tire_max, vehicle_.brake.max_brake_force);
    const double Fx_net = -(Fx_brake + aero_model_.getDragForce(velocity));

    return Fx_net / m;
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
    v = std::max(v_min_, std::min(v_max_, v));
    ay = std::max(0.0, std::min(ay_max_, ay));

    const double v_idx_f = (v - v_min_) / v_step_;
    const double ay_idx_f = ay / ay_step_;
    const int v_points = static_cast<int>((v_max_ - v_min_) / v_step_) + 1;
    const int ay_points = static_cast<int>((ay_max_ - ay_min_) / ay_step_) + 1;

    const int v_idx = std::min(v_points - 2, std::max(0, static_cast<int>(std::floor(v_idx_f))));
    const int ay_idx = std::min(ay_points - 2, std::max(0, static_cast<int>(std::floor(ay_idx_f))));
    const double v_t = std::clamp(v_idx_f - v_idx, 0.0, 1.0);
    const double ay_t = std::clamp(ay_idx_f - ay_idx, 0.0, 1.0);

    auto getValue = [&](int vi, int ayi) -> double {
        const int index = vi * ay_points + ayi;
        return (index >= 0 && index < static_cast<int>(ggv_points_.size()))
            ? ggv_points_[static_cast<size_t>(index)].ax_max_accel
            : 0.0;
    };

    const double v00 = getValue(v_idx, ay_idx);
    const double v10 = getValue(v_idx + 1, ay_idx);
    const double v01 = getValue(v_idx, ay_idx + 1);
    const double v11 = getValue(v_idx + 1, ay_idx + 1);
    const double v0 = v00 * (1.0 - v_t) + v10 * v_t;
    const double v1 = v01 * (1.0 - v_t) + v11 * v_t;

    return v0 * (1 - ay_t) + v1 * ay_t;
}

double GGVGenerator::interpolateBraking(double v, double ay) const {
    v = std::max(v_min_, std::min(v_max_, v));
    ay = std::max(0.0, std::min(ay_max_, ay));

    const double v_idx_f = (v - v_min_) / v_step_;
    const double ay_idx_f = ay / ay_step_;
    const int v_points = static_cast<int>((v_max_ - v_min_) / v_step_) + 1;
    const int ay_points = static_cast<int>((ay_max_ - ay_min_) / ay_step_) + 1;

    const int v_idx = std::min(v_points - 2, std::max(0, static_cast<int>(std::floor(v_idx_f))));
    const int ay_idx = std::min(ay_points - 2, std::max(0, static_cast<int>(std::floor(ay_idx_f))));
    const double v_t = std::clamp(v_idx_f - v_idx, 0.0, 1.0);
    const double ay_t = std::clamp(ay_idx_f - ay_idx, 0.0, 1.0);

    auto getValue = [&](int vi, int ayi) -> double {
        const int index = vi * ay_points + ayi;
        return (index >= 0 && index < static_cast<int>(ggv_points_.size()))
            ? ggv_points_[static_cast<size_t>(index)].ax_max_brake
            : 0.0;
    };

    const double v00 = getValue(v_idx, ay_idx);
    const double v10 = getValue(v_idx + 1, ay_idx);
    const double v01 = getValue(v_idx, ay_idx + 1);
    const double v11 = getValue(v_idx + 1, ay_idx + 1);
    const double v0 = v00 * (1.0 - v_t) + v10 * v_t;
    const double v1 = v01 * (1.0 - v_t) + v11 * v_t;

    return v0 * (1 - ay_t) + v1 * ay_t;
}

void GGVGenerator::exportToCSV(const std::string& filename) const {
    const std::filesystem::path output_path(filename);
    if (output_path.has_parent_path()) {
        std::filesystem::create_directories(output_path.parent_path());
    }

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
