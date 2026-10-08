#pragma once

#include "data/VehicleParams.h"
#include "physics/VehicleModel.h"
#include <string>
#include <vector>

namespace LapTimeSim {

/**
 * @brief Acceleration limits at a specific velocity and lateral acceleration
 */
struct GGVPoint {
    double velocity;      ///< m/s
    double ay_lateral;    ///< Lateral acceleration (m/s^2)
    double ax_max_accel;  ///< Maximum longitudinal acceleration (m/s^2, >= 0)
    double ax_max_brake;  ///< Maximum longitudinal deceleration (m/s^2, negative)
    bool accel_feasible = false, brake_feasible = false;

    GGVPoint() : velocity(0), ay_lateral(0), ax_max_accel(0), ax_max_brake(0) {}
};

/**
 * @brief Generates the GGV (G-G-Velocity) performance envelope on a flat road.
 *
 * Uses exactly the same VehicleModel as the lap solver (load transfer, aero
 * balance, driven axle, brake bias, ERS), so the exported map is consistent
 * with the local physics of the simulated lap. Peak ERS is instantaneous,
 * not a sustainable per-lap deployment strategy.
 */
class GGVGenerator {
public:
    explicit GGVGenerator(const VehicleParams& vehicle, bool with_ers = true, bool drs_open = false);
    ~GGVGenerator() = default;

    void generate(double v_min, double v_max, double v_step, double ay_max, double ay_step);
    double getMaxAcceleration(double v, double ay) const;
    double getMaxBraking(double v, double ay) const;
    bool isGenerated() const { return generated_; }
    bool hasERS() const { return with_ers_; }
    bool isDRSOpen() const { return drs_open_; }
    const std::vector<GGVPoint>& getPoints() const { return ggv_points_; }
    void exportToCSV(const std::string& filename) const;

private:
    VehicleModel model_;
    std::vector<GGVPoint> ggv_points_;
    bool generated_;
    bool with_ers_, drs_open_;

    double v_min_, v_max_, v_step_;
    double ay_min_, ay_max_, ay_step_;

    double calculateMaxAcceleration(double v, double ay) const;
    double calculateMaxBraking(double v, double ay) const;
    double interpolate(double v, double ay, bool braking) const;
};

} // namespace LapTimeSim
