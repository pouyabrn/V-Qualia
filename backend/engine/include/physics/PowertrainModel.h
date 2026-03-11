#pragma once

#include "data/VehicleParams.h"

namespace LapTimeSim {

struct PowertrainOperatingPoint {
    int gear = 1;
    double rpm = 0.0;
    double engine_torque = 0.0;
    double wheel_force = 0.0;
    double wheel_power = 0.0;
    bool valid = false;
};

/**
 * @brief Models engine, gearbox, and driveline behavior.
 */
class PowertrainModel {
public:
    PowertrainModel(const PowertrainParams& params, double tire_radius);
    ~PowertrainModel() = default;

    double getWheelForce(double v, int gear) const;
    double getRPM(double v, int gear) const;
    double getEngineTorque(double rpm) const;
    int getOptimalGear(double v) const;
    double getMaxWheelForce(double v) const;
    double getMaxPower() const;
    double getPeakPowerRPM() const;
    double getWheelPower(double v, int gear) const;
    double getTopSpeedForGear(int gear) const;
    double getOverallRatio(int gear) const;

    PowertrainOperatingPoint getOperatingPoint(double v, int gear, double throttle = 1.0) const;
    PowertrainOperatingPoint getBestAccelerationPoint(double v, int current_gear = 1) const;
    int getRecommendedGear(double v, int current_gear, bool accelerating) const;

    void setParams(const PowertrainParams& params) { params_ = params; }
    void setTireRadius(double radius) { tire_radius_ = radius; }
    const PowertrainParams& getParams() const { return params_; }

private:
    PowertrainParams params_;
    double tire_radius_;

    static constexpr double PI = 3.14159265358979323846;

    double getTotalGearRatio(int gear) const;
    bool isValidGear(int gear) const;
    bool isUsableGear(double v, int gear) const;
};

} // namespace LapTimeSim

