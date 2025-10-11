#include "data/VehicleParams.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace LapTimeSim {

VehicleParams::VehicleParams() 
    : vehicle_name_("Unnamed Vehicle") {
}

double PowertrainParams::getTorqueAt(double rpm) const {
    if (engine_torque_curve.empty()) {
        return 0.0;
    }
    
    // Clamp RPM to valid range
    rpm = std::max(0.0, rpm);
    
    // If RPM is below or at the first data point
    if (rpm <= engine_torque_curve.begin()->first) {
        return engine_torque_curve.begin()->second;
    }
    
    // If RPM is above or at the last data point
    if (rpm >= engine_torque_curve.rbegin()->first) {
        return engine_torque_curve.rbegin()->second;
    }
    
    // Find the two points to interpolate between
    auto upper = engine_torque_curve.upper_bound(rpm);
    auto lower = std::prev(upper);
    
    // Linear interpolation
    double rpm1 = lower->first;
    double torque1 = lower->second;
    double rpm2 = upper->first;
    double torque2 = upper->second;
    
    double t = (rpm - rpm1) / (rpm2 - rpm1);
    return torque1 + t * (torque2 - torque1);
}

int PowertrainParams::getOptimalGear(double velocity, double tire_radius, double target_rpm) const {
    if (gear_ratios.empty() || tire_radius <= 0.0 || velocity <= 0.1) {
        return 1;
    }
    
    const double PI = 3.14159265358979323846;
    
    // Target RPM range: 70-90% of max RPM for best power/efficiency balance
    double optimal_rpm_low = max_rpm * 0.70;   // 10,500 RPM for F1
    double optimal_rpm_high = max_rpm * 0.90;  // 13,500 RPM for F1
    
    // Find highest gear that keeps RPM above optimal_rpm_low
    for (int i = static_cast<int>(gear_ratios.size()) - 1; i >= 0; --i) {
        double rpm = (velocity / tire_radius) * gear_ratios[i] * final_drive_ratio * 60.0 / (2.0 * PI);
        
        // Use this gear if:
        // 1. RPM is in valid operating range
        // 2. RPM is above 70% of max (good power band)
        if (rpm >= min_rpm && rpm <= max_rpm && rpm >= optimal_rpm_low) {
            return i + 1;  // Gears are 1-indexed
        }
    }
    
    // Fallback: find any gear that keeps RPM in valid range
    for (size_t i = 0; i < gear_ratios.size(); ++i) {
        double rpm = (velocity / tire_radius) * gear_ratios[i] * final_drive_ratio * 60.0 / (2.0 * PI);
        if (rpm >= min_rpm && rpm <= max_rpm) {
            return static_cast<int>(i + 1);
        }
    }
    
    return 1;  // Default to first gear
}

bool VehicleParams::validate() const {
    // Check mass parameters
    if (mass.mass <= 0.0) return false;
    if (mass.cog_height < 0.0) return false;
    if (mass.wheelbase <= 0.0) return false;
    if (mass.weight_distribution < 0.0 || mass.weight_distribution > 1.0) return false;
    
    // Check aero parameters
    if (aero.frontal_area <= 0.0) return false;
    if (aero.air_density <= 0.0) return false;
    
    // Check tire parameters
    if (tire.mu_x <= 0.0 || tire.mu_y <= 0.0) return false;
    if (tire.tire_radius <= 0.0) return false;
    if (tire.load_sensitivity < 0.0 || tire.load_sensitivity > 1.0) return false;
    
    // Check powertrain parameters
    if (powertrain.engine_torque_curve.empty()) return false;
    if (powertrain.gear_ratios.empty()) return false;
    if (powertrain.final_drive_ratio <= 0.0) return false;
    if (powertrain.drivetrain_efficiency <= 0.0 || powertrain.drivetrain_efficiency > 1.0) return false;
    
    // Check brake parameters
    if (brake.max_brake_force <= 0.0) return false;
    if (brake.brake_bias < 0.0 || brake.brake_bias > 1.0) return false;
    
    return true;
}

double VehicleParams::getPowerToWeightRatio() const {
    if (powertrain.engine_torque_curve.empty()) return 0.0;
    
    // Find maximum power in the torque curve
    double max_power = 0.0;
    const double PI = 3.14159265358979323846;
    
    for (const auto& [rpm, torque] : powertrain.engine_torque_curve) {
        // Power (W) = Torque (Nm) × Angular Velocity (rad/s)
        // Angular Velocity = RPM × 2π / 60
        double power_watts = torque * (rpm * 2.0 * PI / 60.0);
        max_power = std::max(max_power, power_watts);
    }
    
    // Convert to horsepower and calculate ratio
    double max_hp = max_power / 745.7;  // 1 hp = 745.7 watts
    return max_hp / mass.mass;
}

double VehicleParams::getMaxTheoreticalSpeed() const {
    // At maximum speed, all engine power is used to overcome drag
    // Power = Drag Force × Velocity
    // 0.5 × ρ × v³ × Cd × A = Power
    
    // Find maximum power
    double max_power = 0.0;
    const double PI = 3.14159265358979323846;
    
    for (const auto& [rpm, torque] : powertrain.engine_torque_curve) {
        double power_watts = torque * (rpm * 2.0 * PI / 60.0) * powertrain.drivetrain_efficiency;
        max_power = std::max(max_power, power_watts);
    }
    
    // Solve for velocity: v = (2 × Power / (ρ × Cd × A))^(1/3)
    double v_cubed = (2.0 * max_power) / (aero.air_density * aero.Cd * aero.frontal_area);
    return std::pow(v_cubed, 1.0 / 3.0);
}

} // namespace LapTimeSim


