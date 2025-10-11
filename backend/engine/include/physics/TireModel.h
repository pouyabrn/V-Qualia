#pragma once

#include "data/VehicleParams.h"
#include <cmath>

namespace LapTimeSim {

/**
 * @brief Tire force model using friction circle/ellipse concept
 * 
 * Key physics:
 * - Friction Circle Constraint: √(Fx² + Fy²) ≤ μ × Fz
 * - Load Sensitivity: Grip doesn't scale linearly with vertical load
 * - Combined Forces: Longitudinal and lateral forces share total grip capacity
 */
class TireModel {
public:
    /**
     * @brief Constructor
     * @param params Tire model parameters
     */
    explicit TireModel(const TireParams& params);
    ~TireModel() = default;
    
    /**
     * @brief Get maximum longitudinal force (pure acceleration/braking)
     * @param Fz Vertical load on tire (N)
     * @return Maximum longitudinal force in Newtons
     */
    double getMaxLongitudinalForce(double Fz) const;
    
    /**
     * @brief Get maximum lateral force (pure cornering)
     * @param Fz Vertical load on tire (N)
     * @return Maximum lateral force in Newtons
     */
    double getMaxLateralForce(double Fz) const;
    
    /**
     * @brief Get available longitudinal force when already using lateral grip
     * Implements the friction ellipse constraint
     * @param Fz Vertical load on tire (N)
     * @param Fy_current Current lateral force being used (N)
     * @return Maximum available longitudinal force in Newtons
     */
    double getAvailableLongitudinalForce(double Fz, double Fy_current) const;
    
    /**
     * @brief Get available lateral force when already using longitudinal grip
     * @param Fz Vertical load on tire (N)
     * @param Fx_current Current longitudinal force being used (N)
     * @return Maximum available lateral force in Newtons
     */
    double getAvailableLateralForce(double Fz, double Fx_current) const;
    
    /**
     * @brief Calculate effective friction coefficient with load sensitivity
     * Models the non-linear relationship between load and grip
     * @param Fz Vertical load on tire (N)
     * @param base_mu Base friction coefficient
     * @return Effective friction coefficient
     */
    double getEffectiveMu(double Fz, double base_mu) const;
    
    /**
     * @brief Check if combined forces are within friction circle
     * @param Fx Longitudinal force (N)
     * @param Fy Lateral force (N)
     * @param Fz Vertical load (N)
     * @return true if forces are within limit, false if exceeding
     */
    bool isWithinFrictionCircle(double Fx, double Fy, double Fz) const;
    
    /**
     * @brief Get the total maximum force the tire can generate
     * @param Fz Vertical load on tire (N)
     * @return Maximum total force in Newtons
     */
    double getMaxTotalForce(double Fz) const;
    
    /**
     * @brief Update tire parameters
     */
    void setParams(const TireParams& params) { params_ = params; }
    
    /**
     * @brief Get current parameters
     */
    const TireParams& getParams() const { return params_; }

private:
    TireParams params_;
    
    /**
     * @brief Apply load sensitivity factor to friction coefficient
     * Uses a simple model: μ_eff = μ_base × (Fz / Fz_nominal)^(sensitivity - 1)
     */
    double applyLoadSensitivity(double Fz, double base_mu) const;
};

} // namespace LapTimeSim


