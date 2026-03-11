#pragma once

#include "data/VehicleParams.h"

namespace LapTimeSim {

/**
 * @brief Tire force model using a load-sensitive friction ellipse.
 */
class TireModel {
public:
    explicit TireModel(const TireParams& params, double reference_wheel_load = 2000.0);
    ~TireModel() = default;

    double getMaxLongitudinalForce(double Fz_total) const;
    double getMaxLateralForce(double Fz_total) const;
    double getAvailableLongitudinalForce(double Fz_total, double Fy_current) const;
    double getAvailableLateralForce(double Fz_total, double Fx_current) const;
    double getEffectiveMu(double Fz_total, double base_mu) const;
    bool isWithinFrictionCircle(double Fx, double Fy, double Fz_total) const;
    double getMaxTotalForce(double Fz_total) const;

    void setParams(const TireParams& params) { params_ = params; }
    void setReferenceWheelLoad(double load) { reference_wheel_load_ = load; }
    const TireParams& getParams() const { return params_; }

private:
    TireParams params_;
    double reference_wheel_load_;

    double applyLoadSensitivity(double Fz_total, double base_mu) const;
    static constexpr double kNumTires = 4.0;
};

} // namespace LapTimeSim

