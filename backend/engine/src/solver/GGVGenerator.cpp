#include "solver/GGVGenerator.h"
#include <algorithm>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <stdexcept>

namespace LapTimeSim {

GGVGenerator::GGVGenerator(const VehicleParams& vehicle, bool with_ers, bool drs_open)
    : model_(vehicle),
      generated_(false),
      with_ers_(with_ers && model_.hasERS()), drs_open_(drs_open && vehicle.aero.drs.enabled),
      v_min_(0), v_max_(0), v_step_(1),
      ay_min_(0), ay_max_(0), ay_step_(1) {
}

void GGVGenerator::generate(double v_min, double v_max, double v_step, double ay_max, double ay_step) {
    if (v_step <= 0.0 || ay_step <= 0.0 || v_max < v_min) {
        throw std::invalid_argument("Invalid GGV grid");
    }
    v_min_ = v_min;
    v_step_ = v_step;
    ay_min_ = 0.0;
    ay_step_ = ay_step;

    const int v_points = static_cast<int>(std::floor((v_max - v_min) / v_step + 1e-9)) + 1;
    const int ay_points = static_cast<int>(std::floor(ay_max / ay_step + 1e-9)) + 1;
    v_max_ = v_min_ + (v_points - 1) * v_step_;
    ay_max_ = (ay_points - 1) * ay_step_;

    ggv_points_.clear();
    ggv_points_.reserve(static_cast<size_t>(v_points * ay_points));
    for (int vi = 0; vi < v_points; ++vi) {
        const double v = v_min_ + vi * v_step_;
        for (int ai = 0; ai < ay_points; ++ai) {
            const double ay = ai * ay_step_;
            GGVPoint point;
            point.velocity = v;
            point.ay_lateral = ay;
            ForceBreakdown accel, brake;
            const double a = model_.maxAccelerationAy(v, ay, drs_open_, &accel, with_ers_);
            point.ax_max_accel = std::max(0.0, a);
            point.ax_max_brake = -model_.maxDecelerationAy(v, ay, &brake);
            point.accel_feasible = accel.lateral_usage <= 1.0 && a >= 0.0;
            point.brake_feasible = brake.lateral_usage <= 1.0;
            ggv_points_.push_back(point);
        }
    }
    generated_ = true;
}

double GGVGenerator::calculateMaxAcceleration(double v, double ay) const {
    return std::max(0.0, model_.maxAccelerationAy(std::max(0.0, v), std::abs(ay), drs_open_, nullptr, with_ers_));
}

double GGVGenerator::calculateMaxBraking(double v, double ay) const {
    return -model_.maxDecelerationAy(std::max(0.0, v), std::abs(ay));
}

double GGVGenerator::getMaxAcceleration(double v, double ay) const {
    if (!generated_) {
        throw std::runtime_error("GGV diagram has not been generated");
    }
    return interpolate(v, std::abs(ay), false);
}

double GGVGenerator::getMaxBraking(double v, double ay) const {
    if (!generated_) {
        throw std::runtime_error("GGV diagram has not been generated");
    }
    return interpolate(v, std::abs(ay), true);
}

double GGVGenerator::interpolate(double v, double ay, bool braking) const {
    v = std::clamp(v, v_min_, v_max_);
    ay = std::clamp(ay, 0.0, ay_max_);
    const int v_points = static_cast<int>(std::lround((v_max_ - v_min_) / v_step_)) + 1;
    const int ay_points = static_cast<int>(std::lround(ay_max_ / ay_step_)) + 1;
    const double v_f = (v - v_min_) / v_step_;
    const double ay_f = ay / ay_step_;
    const int v_idx = std::clamp(static_cast<int>(std::floor(v_f)), 0, std::max(0, v_points - 2));
    const int ay_idx = std::clamp(static_cast<int>(std::floor(ay_f)), 0, std::max(0, ay_points - 2));
    const double v_t = std::clamp(v_f - v_idx, 0.0, 1.0);
    const double ay_t = std::clamp(ay_f - ay_idx, 0.0, 1.0);

    auto value = [&](int vi, int ai) {
        vi = std::min(vi, v_points - 1);
        ai = std::min(ai, ay_points - 1);
        const GGVPoint& p = ggv_points_[static_cast<size_t>(vi * ay_points + ai)];
        return braking ? p.ax_max_brake : p.ax_max_accel;
    };

    const double v0 = value(v_idx, ay_idx) * (1.0 - v_t) + value(v_idx + 1, ay_idx) * v_t;
    const double v1 = value(v_idx, ay_idx + 1) * (1.0 - v_t) + value(v_idx + 1, ay_idx + 1) * v_t;
    return v0 * (1.0 - ay_t) + v1 * ay_t;
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
    file << "velocity_ms,lateral_accel_ms2,max_accel_ms2,max_brake_ms2,accel_feasible,brake_feasible\n";
    for (const auto& point : ggv_points_) {
        file << point.velocity << "," << point.ay_lateral << "," << point.ax_max_accel << ","
             << point.ax_max_brake << "," << point.accel_feasible << "," << point.brake_feasible << "\n";
    }
    if (!file) throw std::runtime_error("Failed to write GGV CSV: " + filename);
    std::ofstream meta(filename + ".meta.json");
    if (!meta) throw std::runtime_error("Failed to write GGV conditions: " + filename);
    meta << std::boolalpha << "{\n  \"road\": \"flat\",\n  \"ers_peak_assistance\": " << with_ers_
         << ",\n  \"drs_open_acceleration\": " << drs_open_
         << ",\n  \"drs_open_braking\": false,\n  \"lap_energy_budget_applied\": false,\n"
         << "  \"velocity_unit\": \"m/s\",\n  \"acceleration_unit\": \"m/s^2\",\n"
         << "  \"braking_sign\": \"negative\",\n  \"lateral_sign\": \"magnitude\",\n"
         << "  \"infeasible_points\": \"Ignore rows where the relevant envelope feasible flag is false\"\n}\n";
    if (!meta) throw std::runtime_error("Failed to write GGV conditions: " + filename);
}

} // namespace LapTimeSim
