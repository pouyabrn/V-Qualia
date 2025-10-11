#pragma once

#include <map>
#include <vector>
#include <string>

namespace LapTimeSim {

/**
 * @brief Aerodynamic parameters
 */
struct AeroParams {
    double Cl;              // Lift coefficient (negative for downforce)
    double Cd;              // Drag coefficient
    double frontal_area;    // Reference area (m²)
    double air_density;     // Air density ρ (kg/m³), typically 1.225 at sea level
    
    AeroParams() : Cl(-3.0), Cd(0.8), frontal_area(1.5), air_density(1.225) {}
};

/**
 * @brief Tire model parameters
 */
struct TireParams {
    double mu_x;                    // Longitudinal friction coefficient
    double mu_y;                    // Lateral friction coefficient
    double load_sensitivity;        // Load sensitivity factor (0-1)
    double tire_radius;            // Effective rolling radius (m)
    
    TireParams() : mu_x(1.6), mu_y(1.8), load_sensitivity(0.9), tire_radius(0.3) {}
};

/**
 * @brief Powertrain parameters
 */
struct PowertrainParams {
    std::map<double, double> engine_torque_curve;  // RPM -> Torque (Nm)
    std::vector<double> gear_ratios;               // Gear ratios (higher = more torque)
    double final_drive_ratio;                      // Final drive ratio
    double drivetrain_efficiency;                  // Power transmission efficiency (0-1)
    double max_rpm;                                // Redline RPM
    double min_rpm;                                // Idle RPM
    double shift_time;                             // Time to shift gears (s)
    
    PowertrainParams() : final_drive_ratio(3.5), drivetrain_efficiency(0.95),
                         max_rpm(15000), min_rpm(4000), shift_time(0.05) {}
    
    /**
     * @brief Get engine torque at specific RPM (interpolated)
     */
    double getTorqueAt(double rpm) const;
    
    /**
     * @brief Get optimal gear for given velocity and target RPM
     */
    int getOptimalGear(double velocity, double tire_radius, double target_rpm) const;
};

/**
 * @brief Mass and inertia parameters
 */
struct MassParams {
    double mass;                    // Total vehicle mass (kg)
    double cog_height;              // Center of gravity height (m)
    double wheelbase;               // Distance between front and rear axles (m)
    double weight_distribution;     // Front weight distribution (0-1), e.g., 0.45 = 45% front
    
    MassParams() : mass(800), cog_height(0.3), wheelbase(2.5), weight_distribution(0.45) {}
};

/**
 * @brief Braking system parameters
 */
struct BrakeParams {
    double max_brake_force;         // Maximum brake force (N)
    double brake_bias;              // Front brake distribution (0-1), e.g., 0.6 = 60% front
    
    BrakeParams() : max_brake_force(20000), brake_bias(0.6) {}
};

/**
 * @brief Complete vehicle parameter set
 */
class VehicleParams {
public:
    VehicleParams();
    ~VehicleParams() = default;
    
    // Parameter groups
    MassParams mass;
    AeroParams aero;
    TireParams tire;
    PowertrainParams powertrain;
    BrakeParams brake;
    
    // Physical constants
    static constexpr double GRAVITY = 9.81;  // m/s²
    
    /**
     * @brief Validate all parameters for physical consistency
     * @return true if parameters are valid
     */
    bool validate() const;
    
    /**
     * @brief Get vehicle name/description
     */
    const std::string& getName() const { return vehicle_name_; }
    void setName(const std::string& name) { vehicle_name_ = name; }
    
    /**
     * @brief Calculate power-to-weight ratio (hp/kg)
     */
    double getPowerToWeightRatio() const;
    
    /**
     * @brief Get maximum theoretical speed based on power and drag
     */
    double getMaxTheoreticalSpeed() const;

private:
    std::string vehicle_name_;
};

} // namespace LapTimeSim


