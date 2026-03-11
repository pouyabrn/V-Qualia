#include "physics/TireModel.h"
#include <algorithm>
#include <cmath>

namespace LapTimeSim {

TireModel::TireModel(const TireParams& params, double reference_wheel_load)
    : params_(params),
      reference_wheel_load_(std::max(50.0, reference_wheel_load)) {
}

double TireModel::getMaxLongitudinalForce(double Fz_total) const {
    if (Fz_total <= 0.0) {
        return 0.0;
    }
    const double mu_eff = getEffectiveMu(Fz_total, params_.mu_x);
    return mu_eff * Fz_total;
}

double TireModel::getMaxLateralForce(double Fz_total) const {
    if (Fz_total <= 0.0) {
        return 0.0;
    }
    const double mu_eff = getEffectiveMu(Fz_total, params_.mu_y);
    return mu_eff * Fz_total;
}

double TireModel::getAvailableLongitudinalForce(double Fz_total, double Fy_current) const {
    const double Fy_max = getMaxLateralForce(Fz_total);
    const double Fx_max = getMaxLongitudinalForce(Fz_total);
    if (Fy_max <= 0.0 || Fx_max <= 0.0) {
        return 0.0;
    }

    const double usage = std::abs(Fy_current) / Fy_max;
    if (usage >= 1.0) {
        return 0.0;
    }

    return Fx_max * std::sqrt(std::max(0.0, 1.0 - usage * usage));
}

double TireModel::getAvailableLateralForce(double Fz_total, double Fx_current) const {
    const double Fx_max = getMaxLongitudinalForce(Fz_total);
    const double Fy_max = getMaxLateralForce(Fz_total);
    if (Fx_max <= 0.0 || Fy_max <= 0.0) {
        return 0.0;
    }

    const double usage = std::abs(Fx_current) / Fx_max;
    if (usage >= 1.0) {
        return 0.0;
    }

    return Fy_max * std::sqrt(std::max(0.0, 1.0 - usage * usage));
}

double TireModel::getEffectiveMu(double Fz_total, double base_mu) const {
    return applyLoadSensitivity(Fz_total, base_mu);
}

double TireModel::applyLoadSensitivity(double Fz_total, double base_mu) const {
    if (Fz_total <= 0.0 || base_mu <= 0.0) {
        return 0.0;
    }

    const double wheel_load = std::max(1.0, Fz_total / kNumTires);
    const double load_ratio = std::max(0.05, wheel_load / reference_wheel_load_);
    const double exponent = params_.load_sensitivity - 1.0;
    return base_mu * std::pow(load_ratio, exponent);
}

bool TireModel::isWithinFrictionCircle(double Fx, double Fy, double Fz_total) const {
    const double Fx_max = getMaxLongitudinalForce(Fz_total);
    const double Fy_max = getMaxLateralForce(Fz_total);
    if (Fx_max <= 0.0 || Fy_max <= 0.0) {
        return false;
    }

    const double longitudinal = Fx / Fx_max;
    const double lateral = Fy / Fy_max;
    return (longitudinal * longitudinal + lateral * lateral) <= 1.0 + 1e-9;
}

double TireModel::getMaxTotalForce(double Fz_total) const {
    const double Fx_max = getMaxLongitudinalForce(Fz_total);
    const double Fy_max = getMaxLateralForce(Fz_total);
    return std::sqrt(std::max(0.0, Fx_max * Fy_max));
}

} // namespace LapTimeSim


