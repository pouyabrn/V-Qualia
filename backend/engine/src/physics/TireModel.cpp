#include "physics/TireModel.h"
#include <algorithm>
#include <cmath>

namespace LapTimeSim {

TireModel::TireModel(const TireParams& params)
    : params_(params) {
}

double TireModel::getMaxLongitudinalForce(double Fz) const {
    // F_x_max = μ_x × Fz (with load sensitivity)
    double mu_eff = getEffectiveMu(Fz, params_.mu_x);
    return mu_eff * Fz;
}

double TireModel::getMaxLateralForce(double Fz) const {
    // F_y_max = μ_y × Fz (with load sensitivity)
    double mu_eff = getEffectiveMu(Fz, params_.mu_y);
    return mu_eff * Fz;
}

double TireModel::getAvailableLongitudinalForce(double Fz, double Fy_current) const {
    // Friction ellipse: Fx² + Fy² ≤ (μ × Fz)²
    // Solve for Fx: Fx = √((μ × Fz)² - Fy²)
    
    double F_max = getMaxTotalForce(Fz);
    double Fy_squared = Fy_current * Fy_current;
    double F_max_squared = F_max * F_max;
    
    if (Fy_squared >= F_max_squared) {
        return 0.0;  // Already at or beyond friction limit
    }
    
    return std::sqrt(F_max_squared - Fy_squared);
}

double TireModel::getAvailableLateralForce(double Fz, double Fx_current) const {
    // Friction ellipse: Fx² + Fy² ≤ (μ × Fz)²
    // Solve for Fy: Fy = √((μ × Fz)² - Fx²)
    
    double F_max = getMaxTotalForce(Fz);
    double Fx_squared = Fx_current * Fx_current;
    double F_max_squared = F_max * F_max;
    
    if (Fx_squared >= F_max_squared) {
        return 0.0;  // Already at or beyond friction limit
    }
    
    return std::sqrt(F_max_squared - Fx_squared);
}

double TireModel::getEffectiveMu(double Fz, double base_mu) const {
    return applyLoadSensitivity(Fz, base_mu);
}

double TireModel::applyLoadSensitivity(double Fz, double base_mu) const {
    // Simple load sensitivity model
    // Higher loads produce proportionally less grip
    // μ_eff = μ_base × (Fz / Fz_ref)^(sensitivity - 1)
    
    // Use a reference load (e.g., typical static load per tire)
    const double Fz_reference = 2000.0;  // N, approximately 200kg per tire
    
    if (Fz <= 0.0) return 0.0;
    
    double load_ratio = Fz / Fz_reference;
    double exponent = params_.load_sensitivity - 1.0;
    
    return base_mu * std::pow(load_ratio, exponent);
}

bool TireModel::isWithinFrictionCircle(double Fx, double Fy, double Fz) const {
    double F_max = getMaxTotalForce(Fz);
    double F_combined = std::sqrt(Fx*Fx + Fy*Fy);
    return F_combined <= F_max;
}

double TireModel::getMaxTotalForce(double Fz) const {
    // Use the average of longitudinal and lateral mu for total grip
    // In practice, this could be more sophisticated
    double mu_avg = (params_.mu_x + params_.mu_y) / 2.0;
    double mu_eff = getEffectiveMu(Fz, mu_avg);
    return mu_eff * Fz;
}

} // namespace LapTimeSim


