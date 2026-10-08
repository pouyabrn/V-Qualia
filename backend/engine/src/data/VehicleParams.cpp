#include "data/VehicleParams.h"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <stdexcept>

namespace LapTimeSim {

namespace {
constexpr double PI = 3.14159265358979323846;
}

VehicleParams::VehicleParams()
    : vehicle_name_("Unnamed Vehicle") {
}

double PowertrainParams::getTorqueAt(double rpm) const {
    if (engine_torque_curve.empty()) {
        return 0.0;
    }

    rpm = std::max(0.0, rpm);
    if (rpm <= engine_torque_curve.begin()->first) {
        return engine_torque_curve.begin()->second;
    }
    if (rpm >= engine_torque_curve.rbegin()->first) {
        return engine_torque_curve.rbegin()->second;
    }

    const auto upper = engine_torque_curve.upper_bound(rpm);
    const auto lower = std::prev(upper);
    const double t = (rpm - lower->first) / (upper->first - lower->first);
    return lower->second + t * (upper->second - lower->second);
}

int PowertrainParams::getOptimalGear(double velocity, double tire_radius, double target_rpm) const {
    if (gear_ratios.empty() || tire_radius <= 0.0 || velocity <= 0.1) {
        return 1;
    }

    const double clamped_target_rpm = std::clamp(target_rpm, min_rpm, max_rpm);
    const double optimal_rpm_low = std::max(min_rpm, clamped_target_rpm * 0.90);
    const double optimal_rpm_high = std::min(max_rpm, clamped_target_rpm * 1.05);

    std::vector<double> rpms(gear_ratios.size());
    for (size_t i = 0; i < gear_ratios.size(); ++i) {
        rpms[i] = (velocity / tire_radius) * gear_ratios[i] * final_drive_ratio * 60.0 / (2.0 * PI);
    }

    for (int i = static_cast<int>(gear_ratios.size()) - 1; i >= 0; --i) {
        if (rpms[i] >= optimal_rpm_low && rpms[i] <= optimal_rpm_high) {
            return i + 1;
        }
    }
    for (int i = static_cast<int>(gear_ratios.size()) - 1; i >= 0; --i) {
        if (rpms[i] >= min_rpm && rpms[i] <= max_rpm) {
            return i + 1;
        }
    }

    bool all_too_high = true;
    bool all_too_low = true;
    for (double rpm : rpms) {
        if (rpm <= max_rpm) all_too_high = false;
        if (rpm >= min_rpm) all_too_low = false;
    }
    if (all_too_high) {
        return static_cast<int>(gear_ratios.size());
    }
    if (all_too_low) {
        return 1;
    }

    int best_gear = 1;
    double best_distance = std::abs(rpms[0] - optimal_rpm_low);
    for (size_t i = 1; i < rpms.size(); ++i) {
        const double distance = std::abs(rpms[i] - optimal_rpm_low);
        if (distance < best_distance) {
            best_distance = distance;
            best_gear = static_cast<int>(i + 1);
        }
    }
    return best_gear;
}

bool VehicleParams::validate() const {
    auto fail = [](const std::string& message) {
        std::cerr << "ERROR: " << message << std::endl;
        return false;
    };

    for (double value : {mass.mass, mass.cog_height, mass.wheelbase, mass.weight_distribution,
                         mass.track_width_front, mass.track_width_rear, mass.vehicle_width, mass.lltd_front,
                         aero.Cl, aero.Cd, aero.frontal_area, aero.air_density, aero.aero_balance,
                         aero.downforce_speed_exponent, aero.downforce_reference_speed,
                         aero.downforce_min_speed, aero.downforce_saturation_speed,
                         aero.drs.drag_reduction, aero.drs.downforce_reduction,
                         tire.mu_x, tire.mu_y, tire.load_sensitivity, tire.tire_radius, tire.reference_load,
                         tire.combined_exponent, tire.rolling_resistance, tire.wheel_inertia, tire.rear_mu_scale,
                         powertrain.final_drive_ratio, powertrain.drivetrain_efficiency, powertrain.max_rpm,
                         powertrain.min_rpm, powertrain.shift_time, powertrain.engine_inertia,
                         powertrain.ers.max_power, powertrain.ers.energy_per_lap, powertrain.ers.recovery_power,
                         brake.max_brake_force, brake.brake_bias, line.edge_margin}) {
        if (!std::isfinite(value)) return fail("Vehicle parameters must be finite");
    }
    for (double ratio : powertrain.gear_ratios) {
        if (!std::isfinite(ratio) || ratio <= 0.0) return fail("Gear ratios must be positive and finite");
    }
    for (const auto& [rpm, torque] : powertrain.engine_torque_curve) {
        if (!std::isfinite(rpm) || !std::isfinite(torque) || rpm <= 0.0 || torque < 0.0) {
            return fail("Torque curve RPM must be positive and torque non-negative, both finite");
        }
    }
    if (mass.mass <= 0.0) return fail("Vehicle mass must be positive (got " + std::to_string(mass.mass) + " kg)");
    if (mass.cog_height < 0.0) return fail("COG height must be non-negative");
    if (mass.wheelbase <= 0.0) return fail("Wheelbase must be positive");
    if (mass.weight_distribution < 0.0 || mass.weight_distribution > 1.0) {
        return fail("Weight distribution must be between 0 and 1");
    }
    if (mass.lltd_front > 1.0) return fail("lltd_front must be <= 1");

    if (aero.frontal_area <= 0.0) return fail("Frontal area must be positive");
    if (aero.air_density <= 0.0) return fail("Air density must be positive");
    if (aero.Cd < 0.0) return fail("Drag coefficient must be non-negative");
    if (aero.aero_balance > 1.0) return fail("aero_balance must be <= 1");
    if (aero.downforce_speed_exponent < -1.0 || aero.downforce_speed_exponent > 2.0) {
        return fail("downforce_speed_exponent must be between -1 and 2");
    }
    if (aero.downforce_reference_speed <= 0.0 || aero.downforce_saturation_speed < aero.downforce_reference_speed ||
        aero.downforce_min_speed <= 0.0 || aero.downforce_min_speed > aero.downforce_reference_speed) {
        return fail("downforce speeds must satisfy 0 < min <= reference <= saturation");
    }
    if (aero.drs.drag_reduction < 0.0 || aero.drs.drag_reduction >= 1.0 ||
        aero.drs.downforce_reduction < 0.0 || aero.drs.downforce_reduction >= 1.0) {
        return fail("DRS reductions must be in [0, 1)");
    }

    if (tire.mu_x <= 0.0 || tire.mu_y <= 0.0) return fail("Tire friction coefficients must be positive");
    if (tire.tire_radius <= 0.0) return fail("Tire radius must be positive");
    if (tire.load_sensitivity < 0.0 || tire.load_sensitivity > 1.5) {
        std::cerr << "       Typical values: racing slicks 0.75-0.95, road tyres 0.85-1.0" << std::endl;
        return fail("Load sensitivity must be between 0.0 and 1.5");
    }
    if (tire.combined_exponent < 1.0 || tire.combined_exponent > 4.0) {
        return fail("combined_exponent must be between 1 and 4");
    }
    if (tire.rolling_resistance < 0.0 || tire.rolling_resistance > 0.1) {
        return fail("rolling_resistance must be between 0 and 0.1");
    }
    if (tire.wheel_inertia < 0.0) return fail("wheel_inertia must be non-negative");
    if (tire.rear_mu_scale <= 0.2 || tire.rear_mu_scale > 3.0) return fail("rear_mu_scale must be in (0.2, 3]");

    if (powertrain.engine_torque_curve.empty()) return fail("Engine torque curve cannot be empty");
    if (powertrain.gear_ratios.empty()) return fail("Gear ratios cannot be empty");
    if (powertrain.final_drive_ratio <= 0.0) return fail("Final drive ratio must be positive");
    if (powertrain.drivetrain_efficiency <= 0.0 || powertrain.drivetrain_efficiency > 1.0) {
        return fail("Drivetrain efficiency must be between 0 and 1");
    }
    if (powertrain.max_rpm <= powertrain.min_rpm) return fail("max_rpm must be greater than min_rpm");
    if (powertrain.shift_time < 0.0) return fail("shift_time must be non-negative");
    if (powertrain.engine_inertia < 0.0) return fail("engine_inertia must be non-negative");
    if (powertrain.ers.max_power < 0.0) return fail("ERS power must be non-negative");

    for (size_t i = 1; i < powertrain.gear_ratios.size(); ++i) {
        if (powertrain.gear_ratios[i] >= powertrain.gear_ratios[i - 1]) {
            std::cerr << "WARNING: Gear ratio " << (i + 1) << " (" << powertrain.gear_ratios[i]
                      << ") should be less than gear " << i << " (" << powertrain.gear_ratios[i - 1] << ")" << std::endl;
        }
    }

    if (brake.max_brake_force <= 0.0) return fail("Max brake force must be positive");
    if (brake.brake_bias < 0.0 || brake.brake_bias > 1.0) return fail("Brake bias must be between 0 and 1");
    if (!brake.ideal_bias && (brake.brake_bias <= 0.0 || brake.brake_bias >= 1.0)) {
        return fail("A fixed brake bias must be strictly between 0 and 1");
    }

    return true;
}

double VehicleParams::getPeakEnginePower() const {
    double max_power = 0.0;
    for (const auto& [rpm, torque] : powertrain.engine_torque_curve) {
        if (rpm > powertrain.max_rpm * 1.0001) {
            continue;
        }
        max_power = std::max(max_power, torque * rpm * 2.0 * PI / 60.0);
    }
    return max_power;
}

double VehicleParams::getPowerToWeightRatio() const {
    const double total_power = getPeakEnginePower() + powertrain.ers.max_power;
    return (total_power / 745.7) / mass.mass;
}

double VehicleParams::getMaxTheoreticalSpeed() const {
    const double wheel_power = (getPeakEnginePower() + powertrain.ers.max_power) * powertrain.drivetrain_efficiency;
    const double cda = std::max(1e-6, aero.CdA());
    return std::cbrt((2.0 * wheel_power) / (aero.air_density * cda));
}

double VehicleParams::getFrontTrack() const {
    if (mass.track_width_front > 0.0) {
        return mass.track_width_front;
    }
    return std::clamp(mass.wheelbase * 0.35 + 0.65, 1.1, 2.0);
}

double VehicleParams::getRearTrack() const {
    return (mass.track_width_rear > 0.0) ? mass.track_width_rear : getFrontTrack();
}

double VehicleParams::getVehicleWidth() const {
    if (mass.vehicle_width > 0.0) {
        return mass.vehicle_width;
    }
    return std::max(getFrontTrack(), getRearTrack()) + 0.3;
}

double VehicleParams::getAeroBalance() const {
    return (aero.aero_balance >= 0.0) ? aero.aero_balance : mass.weight_distribution;
}

double VehicleParams::getLLTDFront() const {
    return (mass.lltd_front >= 0.0) ? mass.lltd_front : mass.weight_distribution;
}

} // namespace LapTimeSim
