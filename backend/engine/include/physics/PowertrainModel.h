#pragma once

#include "data/VehicleParams.h"
#include <cmath>

namespace LapTimeSim {

/**
 * @brief Models the vehicle powertrain: engine, transmission, and drivetrain
 * 
 * Calculates:
 * - Engine torque from RPM
 * - Wheel force from engine torque through gearing
 * - Optimal gear selection
 * - RPM from vehicle velocity
 */
class PowertrainModel {
public:
    /**
     * @brief Constructor
     * @param params Powertrain parameters
     * @param tire_radius Tire radius for RPM calculations
     */
    PowertrainModel(const PowertrainParams& params, double tire_radius);
    ~PowertrainModel() = default;
    
    /**
     * @brief Calculate force at wheels for given velocity and gear
     * @param v Velocity (m/s)
     * @param gear Current gear (1-indexed)
     * @return Force at wheels in Newtons
     */
    double getWheelForce(double v, int gear) const;
    
    /**
     * @brief Calculate engine RPM for given velocity and gear
     * @param v Velocity (m/s)
     * @param gear Current gear (1-indexed)
     * @return Engine RPM
     */
    double getRPM(double v, int gear) const;
    
    /**
     * @brief Get engine torque at specific RPM
     * @param rpm Engine RPM
     * @return Torque in Nm (uses interpolation from torque curve)
     */
    double getEngineTorque(double rpm) const;
    
    /**
     * @brief Get optimal gear for current velocity
     * Tries to keep engine near peak power RPM
     * @param v Velocity (m/s)
     * @return Optimal gear number (1-indexed)
     */
    int getOptimalGear(double v) const;
    
    /**
     * @brief Get maximum wheel force available at given velocity
     * Checks all gears and returns the maximum force achievable
     * @param v Velocity (m/s)
     * @return Maximum wheel force in Newtons
     */
    double getMaxWheelForce(double v) const;
    
    /**
     * @brief Get maximum power output
     * @return Maximum power in Watts
     */
    double getMaxPower() const;
    
    /**
     * @brief Get RPM at peak power
     * @return RPM at maximum power output
     */
    double getPeakPowerRPM() const;
    
    /**
     * @brief Calculate power at wheels for given velocity and gear
     * @param v Velocity (m/s)
     * @param gear Current gear
     * @return Power in Watts
     */
    double getWheelPower(double v, int gear) const;
    
    /**
     * @brief Update powertrain parameters
     */
    void setParams(const PowertrainParams& params) { params_ = params; }
    
    /**
     * @brief Set tire radius
     */
    void setTireRadius(double radius) { tire_radius_ = radius; }
    
    /**
     * @brief Get current parameters
     */
    const PowertrainParams& getParams() const { return params_; }

private:
    PowertrainParams params_;
    double tire_radius_;
    
    static constexpr double PI = 3.14159265358979323846;
    
    /**
     * @brief Get gear ratio for specific gear (including final drive)
     * @param gear Gear number (1-indexed)
     * @return Total gear ratio
     */
    double getTotalGearRatio(int gear) const;
    
    /**
     * @brief Check if gear is valid
     */
    bool isValidGear(int gear) const;
};

} // namespace LapTimeSim


