#include "data/VehicleParams.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <iostream>

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
    double optimal_rpm_low = max_rpm * 0.70;
    double optimal_rpm_high = max_rpm * 0.90;
    
    // Calculate RPM for all gears
    std::vector<double> rpms(gear_ratios.size());
    for (size_t i = 0; i < gear_ratios.size(); ++i) {
        rpms[i] = (velocity / tire_radius) * gear_ratios[i] * final_drive_ratio * 60.0 / (2.0 * PI);
    }
    
    // Strategy 1: Find highest gear (lowest ratio) with RPM in optimal range
    for (int i = static_cast<int>(gear_ratios.size()) - 1; i >= 0; --i) {
        if (rpms[i] >= optimal_rpm_low && rpms[i] <= max_rpm) {
            return i + 1;
        }
    }
    
    // Strategy 2: Find highest gear with RPM in valid operating range (min_rpm to max_rpm)
    for (int i = static_cast<int>(gear_ratios.size()) - 1; i >= 0; --i) {
        if (rpms[i] >= min_rpm && rpms[i] <= max_rpm) {
            return i + 1;
        }
    }
    
    // Strategy 3: All gears are outside range - choose gear closest to valid range
    // If all RPMs are too high (over-revving), use highest gear to minimize RPM
    // If all RPMs are too low (lugging), use lowest gear to maximize RPM
    bool all_too_high = true;
    bool all_too_low = true;
    
    for (double rpm : rpms) {
        if (rpm <= max_rpm) all_too_high = false;
        if (rpm >= min_rpm) all_too_low = false;
    }
    
    if (all_too_high) {
        // All gears over-revving: use highest gear (lowest RPM)
        return static_cast<int>(gear_ratios.size());
    }
    
    if (all_too_low) {
        // All gears lugging: use lowest gear (highest RPM)
        return 1;
    }
    
    // Mixed case: find gear with RPM closest to optimal range
    int best_gear = 1;
    double best_distance = std::abs(rpms[0] - optimal_rpm_low);
    
    for (size_t i = 1; i < rpms.size(); ++i) {
        double distance = std::abs(rpms[i] - optimal_rpm_low);
        if (distance < best_distance) {
            best_distance = distance;
            best_gear = static_cast<int>(i + 1);
        }
    }
    
    return best_gear;
}

bool VehicleParams::validate() const {
    // Check mass parameters
    if (mass.mass <= 0.0) {
        std::cerr << "ERROR: Vehicle mass must be positive (got " << mass.mass << " kg)" << std::endl;
        return false;
    }
    if (mass.cog_height < 0.0) {
        std::cerr << "ERROR: COG height must be non-negative (got " << mass.cog_height << " m)" << std::endl;
        return false;
    }
    if (mass.wheelbase <= 0.0) {
        std::cerr << "ERROR: Wheelbase must be positive (got " << mass.wheelbase << " m)" << std::endl;
        return false;
    }
    if (mass.weight_distribution < 0.0 || mass.weight_distribution > 1.0) {
        std::cerr << "ERROR: Weight distribution must be between 0 and 1 (got " << mass.weight_distribution << ")" << std::endl;
        return false;
    }
    
    // Check aero parameters
    if (aero.frontal_area <= 0.0) {
        std::cerr << "ERROR: Frontal area must be positive (got " << aero.frontal_area << " m²)" << std::endl;
        return false;
    }
    if (aero.air_density <= 0.0) {
        std::cerr << "ERROR: Air density must be positive (got " << aero.air_density << " kg/m³)" << std::endl;
        return false;
    }
    
    // Check tire parameters
    if (tire.mu_x <= 0.0 || tire.mu_y <= 0.0) {
        std::cerr << "ERROR: Tire friction coefficients must be positive (mu_x=" << tire.mu_x 
                  << ", mu_y=" << tire.mu_y << ")" << std::endl;
        return false;
    }
    if (tire.tire_radius <= 0.0) {
        std::cerr << "ERROR: Tire radius must be positive (got " << tire.tire_radius << " m)" << std::endl;
        return false;
    }
    if (tire.load_sensitivity < 0.0 || tire.load_sensitivity > 1.5) {
        std::cerr << "ERROR: Load sensitivity must be between 0.0 and 1.5 (got " << tire.load_sensitivity << ")" << std::endl;
        std::cerr << "       Typical values: Racing slicks = 0.8-0.95, Road tires = 1.0-1.2" << std::endl;
        return false;
    }
    
    // Check powertrain parameters
    if (powertrain.engine_torque_curve.empty()) {
        std::cerr << "ERROR: Engine torque curve cannot be empty" << std::endl;
        return false;
    }
    if (powertrain.gear_ratios.empty()) {
        std::cerr << "ERROR: Gear ratios cannot be empty" << std::endl;
        return false;
    }
    if (powertrain.final_drive_ratio <= 0.0) {
        std::cerr << "ERROR: Final drive ratio must be positive (got " << powertrain.final_drive_ratio << ")" << std::endl;
        return false;
    }
    if (powertrain.drivetrain_efficiency <= 0.0 || powertrain.drivetrain_efficiency > 1.0) {
        std::cerr << "ERROR: Drivetrain efficiency must be between 0 and 1 (got " 
                  << powertrain.drivetrain_efficiency << ")" << std::endl;
        return false;
    }
    if (powertrain.max_rpm <= powertrain.min_rpm) {
        std::cerr << "ERROR: max_rpm (" << powertrain.max_rpm << ") must be greater than min_rpm (" 
                  << powertrain.min_rpm << ")" << std::endl;
        return false;
    }
    
    // Warn about potentially problematic gear ratios
    if (!powertrain.gear_ratios.empty()) {
        double first_gear = powertrain.gear_ratios.front();
        double last_gear = powertrain.gear_ratios.back();
        
        if (first_gear <= last_gear) {
            std::cerr << "WARNING: Gear ratios should decrease from 1st to top gear" << std::endl;
            std::cerr << "         Got: 1st=" << first_gear << ", top=" << last_gear << std::endl;
        }
        
        // Check if gears are sorted in descending order
        for (size_t i = 1; i < powertrain.gear_ratios.size(); ++i) {
            if (powertrain.gear_ratios[i] >= powertrain.gear_ratios[i-1]) {
                std::cerr << "WARNING: Gear ratio " << (i+1) << " (" << powertrain.gear_ratios[i] 
                          << ") should be less than gear " << i << " (" << powertrain.gear_ratios[i-1] << ")" << std::endl;
            }
        }
    }
    
    // Check brake parameters
    if (brake.max_brake_force <= 0.0) {
        std::cerr << "ERROR: Max brake force must be positive (got " << brake.max_brake_force << " N)" << std::endl;
        return false;
    }
    if (brake.brake_bias < 0.0 || brake.brake_bias > 1.0) {
        std::cerr << "ERROR: Brake bias must be between 0 and 1 (got " << brake.brake_bias << ")" << std::endl;
        return false;
    }
    
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


