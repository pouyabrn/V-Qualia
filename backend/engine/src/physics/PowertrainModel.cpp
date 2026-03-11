#include "physics/PowertrainModel.h"
#include <algorithm>
#include <limits>
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

    const double wheel_angular_velocity = std::max(0.0, v) / tire_radius_;
    const double engine_angular_velocity = wheel_angular_velocity * getTotalGearRatio(gear);
    return engine_angular_velocity * 60.0 / (2.0 * PI);
}

double PowertrainModel::getEngineTorque(double rpm) const {
    return params_.getTorqueAt(rpm);
}

PowertrainOperatingPoint PowertrainModel::getOperatingPoint(double v, int gear, double throttle) const {
    PowertrainOperatingPoint point;
    point.gear = gear;

    if (!isValidGear(gear) || throttle <= 0.0) {
        return point;
    }

    const double raw_rpm = getRPM(v, gear);
    if (raw_rpm > params_.max_rpm * 1.002) {
        return point;
    }

    const double effective_rpm = std::clamp(raw_rpm, params_.min_rpm, params_.max_rpm);
    const double engine_torque = getEngineTorque(effective_rpm) * std::clamp(throttle, 0.0, 1.0);
    const double total_ratio = getTotalGearRatio(gear);
    const double wheel_torque = engine_torque * total_ratio * params_.drivetrain_efficiency;

    point.rpm = effective_rpm;
    point.engine_torque = engine_torque;
    point.wheel_force = wheel_torque / tire_radius_;
    point.wheel_power = point.wheel_force * std::max(0.0, v);
    point.valid = true;
    return point;
}

double PowertrainModel::getWheelForce(double v, int gear) const {
    return getOperatingPoint(v, gear).wheel_force;
}

double PowertrainModel::getMaxWheelForce(double v) const {
    return getBestAccelerationPoint(v).wheel_force;
}

int PowertrainModel::getOptimalGear(double v) const {
    return getBestAccelerationPoint(v).gear;
}

PowertrainOperatingPoint PowertrainModel::getBestAccelerationPoint(double v, int current_gear) const {
    PowertrainOperatingPoint best;
    best.gear = std::clamp(current_gear, 1, static_cast<int>(params_.gear_ratios.size()));

    for (size_t i = 0; i < params_.gear_ratios.size(); ++i) {
        const int gear = static_cast<int>(i + 1);
        const PowertrainOperatingPoint point = getOperatingPoint(v, gear);
        if (!point.valid) {
            continue;
        }

        if (!best.valid || point.wheel_force > best.wheel_force) {
            best = point;
        }
    }

    if (!best.valid) {
        best.gear = static_cast<int>(params_.gear_ratios.size());
        best.rpm = std::min(params_.max_rpm, getRPM(v, best.gear));
    }

    return best;
}

int PowertrainModel::getRecommendedGear(double v, int current_gear, bool accelerating) const {
    if (params_.gear_ratios.empty()) {
        return 1;
    }

    int gear = std::clamp(current_gear, 1, static_cast<int>(params_.gear_ratios.size()));
    if (!isUsableGear(v, gear)) {
        while (gear < static_cast<int>(params_.gear_ratios.size()) && !isUsableGear(v, gear)) {
            ++gear;
        }
        while (gear > 1 && !isUsableGear(v, gear)) {
            --gear;
        }
    }

    if (!accelerating) {
        int best = gear;
        double best_rpm_distance = std::numeric_limits<double>::max();
        const double target_rpm = std::max(params_.min_rpm, 0.55 * params_.max_rpm);
        for (size_t i = 0; i < params_.gear_ratios.size(); ++i) {
            const int candidate = static_cast<int>(i + 1);
            const double rpm = getRPM(v, candidate);
            if (rpm > params_.max_rpm * 1.002) {
                continue;
            }
            const double effective_rpm = std::max(rpm, params_.min_rpm);
            const double distance = std::abs(effective_rpm - target_rpm);
            if (distance < best_rpm_distance) {
                best_rpm_distance = distance;
                best = candidate;
            }
        }
        return best;
    }

    const PowertrainOperatingPoint current = getOperatingPoint(v, gear);
    const PowertrainOperatingPoint best = getBestAccelerationPoint(v, gear);
    if (!current.valid) {
        return best.gear;
    }

    if (best.valid && best.gear != gear) {
        const double improvement = (best.wheel_force - current.wheel_force) / std::max(1.0, current.wheel_force);
        if (improvement > 0.02) {
            return best.gear;
        }
    }

    return gear;
}

double PowertrainModel::getMaxPower() const {
    double max_power = 0.0;
    for (const auto& [rpm, torque] : params_.engine_torque_curve) {
        const double angular_velocity = rpm * 2.0 * PI / 60.0;
        max_power = std::max(max_power, torque * angular_velocity);
    }
    return max_power * params_.drivetrain_efficiency;
}

double PowertrainModel::getPeakPowerRPM() const {
    double max_power = 0.0;
    double peak_rpm = params_.min_rpm;
    for (const auto& [rpm, torque] : params_.engine_torque_curve) {
        const double angular_velocity = rpm * 2.0 * PI / 60.0;
        const double power = torque * angular_velocity;
        if (power > max_power) {
            max_power = power;
            peak_rpm = rpm;
        }
    }
    return peak_rpm;
}

double PowertrainModel::getWheelPower(double v, int gear) const {
    return getOperatingPoint(v, gear).wheel_power;
}

double PowertrainModel::getTopSpeedForGear(int gear) const {
    if (!isValidGear(gear)) {
        return 0.0;
    }
    return (params_.max_rpm * 2.0 * PI * tire_radius_) / (60.0 * getTotalGearRatio(gear));
}

double PowertrainModel::getOverallRatio(int gear) const {
    return getTotalGearRatio(gear);
}

double PowertrainModel::getTotalGearRatio(int gear) const {
    if (!isValidGear(gear)) {
        return 0.0;
    }
    return params_.gear_ratios[static_cast<size_t>(gear - 1)] * params_.final_drive_ratio;
}

bool PowertrainModel::isValidGear(int gear) const {
    return gear >= 1 && gear <= static_cast<int>(params_.gear_ratios.size());
}

bool PowertrainModel::isUsableGear(double v, int gear) const {
    if (!isValidGear(gear)) {
        return false;
    }
    return getRPM(v, gear) <= params_.max_rpm * 1.002;
}

} // namespace LapTimeSim


