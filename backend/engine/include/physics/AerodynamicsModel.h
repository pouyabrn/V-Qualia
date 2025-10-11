#pragma once

#include "data/VehicleParams.h"

namespace LapTimeSim {

/**
 * @brief Calculates aerodynamic forces on the vehicle
 * 
 * Implements the standard aerodynamic force equations:
 * - Drag: F_drag = 0.5 × ρ × v² × Cd × A
 * - Downforce (negative lift): F_lift = 0.5 × ρ × v² × Cl × A
 */
class AerodynamicsModel {
public:
    /**
     * @brief Constructor
     * @param params Vehicle aerodynamic parameters
     */
    explicit AerodynamicsModel(const AeroParams& params);
    ~AerodynamicsModel() = default;
    
    /**
     * @brief Calculate drag force at given velocity
     * @param v Velocity (m/s)
     * @return Drag force in Newtons (always positive, opposes motion)
     */
    double getDragForce(double v) const;
    
    /**
     * @brief Calculate downforce at given velocity
     * @param v Velocity (m/s)
     * @return Downforce in Newtons (positive = pushes car down)
     * Note: Cl is typically negative, so this returns -F_lift
     */
    double getDownforce(double v) const;
    
    /**
     * @brief Calculate total vertical load including weight and downforce
     * @param v Velocity (m/s)
     * @param mass Vehicle mass (kg)
     * @param g Gravitational acceleration (m/s²)
     * @return Total vertical force on tires in Newtons
     */
    double getTotalVerticalLoad(double v, double mass, double g = 9.81) const;
    
    /**
     * @brief Calculate drag power requirement
     * @param v Velocity (m/s)
     * @return Power needed to overcome drag in Watts
     */
    double getDragPower(double v) const;
    
    /**
     * @brief Update aerodynamic parameters
     */
    void setParams(const AeroParams& params) { params_ = params; }
    
    /**
     * @brief Get current parameters
     */
    const AeroParams& getParams() const { return params_; }

private:
    AeroParams params_;
    
    /**
     * @brief Calculate the common aerodynamic coefficient: 0.5 × ρ × A
     */
    double getAeroCoefficient() const {
        return 0.5 * params_.air_density * params_.frontal_area;
    }
};

} // namespace LapTimeSim


