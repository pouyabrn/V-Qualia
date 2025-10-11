#include "physics/PowertrainModel.h"
#include <algorithm>
#include <stdexcept>

namespace LapTimeSim {

PowertrainModel::PowertrainModel(const PowertrainParams& params, double tire_radius)
    : params_(params), tire_radius_(tire_radius) {
    if (tire_radius_ <= 0.0) {
        throw std::invalid_argument("Tire radius must be positive");
    }
}

double PowertrainModel::getRPM(double v, int gear) const {
    if (!isValidGear(gear)) {
        return 0.0;
    }
    
    // RPM = (v / r) × gear_ratio × final_drive × 60 / (2π)
    // where v/r is wheel angular velocity in rad/s
    double wheel_angular_velocity = v / tire_radius_;
    double total_ratio = getTotalGearRatio(gear);
    double engine_angular_velocity = wheel_angular_velocity * total_ratio;
    
    // Convert rad/s to RPM
    return engine_angular_velocity * 60.0 / (2.0 * PI);
}

double PowertrainModel::getEngineTorque(double rpm) const {
    return params_.getTorqueAt(rpm);
}

double PowertrainModel::getWheelForce(double v, int gear) const {
    if (!isValidGear(gear) || v <= 0.0) {
        return 0.0;
    }
    
    double rpm = getRPM(v, gear);
    
    // Check if RPM is in valid range
    if (rpm < params_.min_rpm || rpm > params_.max_rpm) {
        return 0.0;  // Engine not in operating range
    }
    
    double engine_torque = getEngineTorque(rpm);
    double total_ratio = getTotalGearRatio(gear);
    
    // Wheel torque = Engine torque × gear ratio × efficiency
    double wheel_torque = engine_torque * total_ratio * params_.drivetrain_efficiency;
    
    // Wheel force = Wheel torque / tire radius
    return wheel_torque / tire_radius_;
}

double PowertrainModel::getMaxWheelForce(double v) const {
    if (v <= 0.0) {
        // At zero velocity, use first gear at minimum RPM
        return getWheelForce(0.01, 1);
    }
    
    double max_force = 0.0;
    
    // Check all gears
    for (size_t i = 0; i < params_.gear_ratios.size(); ++i) {
        int gear = static_cast<int>(i + 1);
        double force = getWheelForce(v, gear);
        max_force = std::max(max_force, force);
    }
    
    return max_force;
}

int PowertrainModel::getOptimalGear(double v) const {
    if (v <= 0.0) {
        return 1;
    }
    
    // Find peak power RPM
    double target_rpm = getPeakPowerRPM();
    
    // Find gear that keeps engine closest to peak power RPM
    return params_.getOptimalGear(v, tire_radius_, target_rpm);
}

double PowertrainModel::getMaxPower() const {
    double max_power = 0.0;
    
    for (const auto& [rpm, torque] : params_.engine_torque_curve) {
        // Power (W) = Torque (Nm) × Angular Velocity (rad/s)
        double angular_velocity = rpm * 2.0 * PI / 60.0;
        double power = torque * angular_velocity;
        max_power = std::max(max_power, power);
    }
    
    return max_power * params_.drivetrain_efficiency;
}

double PowertrainModel::getPeakPowerRPM() const {
    double max_power = 0.0;
    double peak_rpm = 0.0;
    
    for (const auto& [rpm, torque] : params_.engine_torque_curve) {
        double angular_velocity = rpm * 2.0 * PI / 60.0;
        double power = torque * angular_velocity;
        
        if (power > max_power) {
            max_power = power;
            peak_rpm = rpm;
        }
    }
    
    return peak_rpm;
}

double PowertrainModel::getWheelPower(double v, int gear) const {
    // Power = Force × Velocity
    return getWheelForce(v, gear) * v;
}

double PowertrainModel::getTotalGearRatio(int gear) const {
    if (!isValidGear(gear)) {
        return 0.0;
    }
    
    size_t gear_index = static_cast<size_t>(gear - 1);
    return params_.gear_ratios[gear_index] * params_.final_drive_ratio;
}

bool PowertrainModel::isValidGear(int gear) const {
    return gear >= 1 && gear <= static_cast<int>(params_.gear_ratios.size());
}

} // namespace LapTimeSim


