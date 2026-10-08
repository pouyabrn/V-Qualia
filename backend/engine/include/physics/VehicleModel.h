#pragma once

#include "data/VehicleParams.h"
#include "physics/PowertrainModel.h"
#include <vector>

namespace LapTimeSim {

/**
 * @brief Local road conditions at a point of the driven path.
 */
struct RoadConditions {
    double banking = 0.0;             ///< rad, positive = banked towards the inside of the turn
    double grade = 0.0;               ///< rad, positive = uphill
    double vertical_curvature = 0.0;  ///< d2z/ds2 (1/m), positive = compression (dip), negative = crest
    bool drs_open = false;            ///< DRS flap open (only meaningful while accelerating)
};

/**
 * @brief Breakdown of the force balance at one operating point (for telemetry).
 */
struct ForceBreakdown {
    double downforce = 0.0;
    double drag = 0.0;
    double rolling = 0.0;
    double grade_force = 0.0;
    double fz_front = 0.0;
    double fz_rear = 0.0;
    double fy_required = 0.0;
    double fy_capacity = 0.0;
    double fx_tyre_limit = 0.0;  ///< Tyre-limited tractive force (accel) or braking force (decel)
    double lateral_usage = 0.0;  ///< fy_required / fy_capacity
};

/**
 * @brief Quasi-steady-state vehicle model shared by the lap solver and the GGV generator.
 *
 * Features:
 *  - aero downforce split front/rear (aero balance), DRS drag/downforce reduction
 *  - longitudinal and lateral load transfer per axle (roll-stiffness distribution)
 *  - load-sensitive tyres, per-wheel capacity, friction-ellipse combined slip
 *  - driven-axle traction limit (RWD / FWD / AWD) and fixed or ideal brake bias
 *  - best-gear engine force map, hybrid (ERS) deployment force
 *  - rotating inertia (wheels + engine reflected through the gearbox)
 *  - rolling resistance, banking and grade
 */
class VehicleModel {
public:
    explicit VehicleModel(const VehicleParams& params, bool use_tire_tables = true,
                          const VehicleModel* reuse = nullptr);

    const VehicleParams& params() const { return p_; }
    double mass() const { return m_; }
    double gravity() const { return g_; }

    double dragForce(double v, bool drs_open) const;
    double downforce(double v, bool drs_open) const;

    /// Tyre-plane lateral acceleration (magnitude) needed to follow curvature kappa at speed v
    double lateralDemand(double v, double kappa, const RoadConditions& rc) const;
    /// Acceleration normal to the road surface (gravity + banking contribution)
    double normalAccel(double v, double kappa, const RoadConditions& rc) const;
    /// Drag + rolling resistance + grade force (N)
    double resistance(double v, double kappa, const RoadConditions& rc) const;

    /// Combustion engine at full load in the best gear at speed v
    PowertrainOperatingPoint engine(double v) const;
    /// Combustion engine at full load in a specific gear (invalid above the rev limit)
    PowertrainOperatingPoint engineInGear(double v, int gear) const { return powertrain_.getOperatingPoint(v, gear); }
    /// Maximum ERS force at the wheels at speed v
    double ersForce(double v) const;
    bool hasERS() const { return p_.powertrain.ers.max_power > 0.0; }

    /// Maximum forward acceleration (m/s^2, can be negative) with the given propulsive force at the wheels
    double maxAcceleration(double v, double kappa, const RoadConditions& rc, double propulsive_force,
                           int gear, ForceBreakdown* out = nullptr) const;
    /// Maximum deceleration magnitude (m/s^2) on the path
    double maxDeceleration(double v, double kappa, const RoadConditions& rc, ForceBreakdown* out = nullptr) const;

    /// Flat-road versions with a prescribed lateral acceleration (for GGV maps)
    double maxAccelerationAy(double v, double ay, bool drs_open, ForceBreakdown* out = nullptr,
                             bool with_ers = true) const;
    double maxDecelerationAy(double v, double ay, ForceBreakdown* out = nullptr) const;

    /// Highest steady-state speed on curvature kappa (lateral grip + tyre force to hold speed)
    double maxCorneringSpeed(double kappa, const RoadConditions& rc, double v_cap) const;

    /// Power/gear limited top speed on a flat straight (m/s)
    double topSpeed(bool drs_open, bool with_ers) const;

    double effectiveMassPowered(int gear) const;
    double effectiveMassTraction() const;

    int numGears() const { return static_cast<int>(p_.powertrain.gear_ratios.size()); }
    double rpmAt(double v, int gear) const { return powertrain_.getRPM(v, gear); }
    double overallRatio(int gear) const { return powertrain_.getOverallRatio(gear); }

private:
    struct AxleCapacity {
        double fy = 0.0;
        double fx = 0.0;
    };

    void aeroLoads(double v, bool drs_open, double& df_front, double& df_rear) const;
    double downforceFactor(double v) const;
    AxleCapacity axleCapacity(double fz_axle, double load_transfer, bool rear) const;
    double combinedFactor(double fy_required, double fy_capacity) const;
    double peakLoad(double fz) const;
    double tractionFrom(const AxleCapacity& front, const AxleCapacity& rear, double k) const;
    double brakeFrom(const AxleCapacity& front, const AxleCapacity& rear, double k) const;

    double accelCore(double v, double ay, double an, double grade, bool drs_open,
                     double propulsive_force, int gear, ForceBreakdown* out) const;
    double decelCore(double v, double ay, double an, double grade, ForceBreakdown* out) const;
    bool corneringFeasible(double v, double kappa, const RoadConditions& rc) const;

    VehicleParams p_;
    PowertrainModel powertrain_;

    double m_, g_, h_, L_, wd_, ab_, tf_, tr_, lltd_;
    double half_rho_cla_, half_rho_cda_;
    double df_exponent_, df_v_ref_, df_v_sat_, df_v_min_;
    double drs_drag_factor_, drs_df_loss_;
    double fz0_, ls_, mux_, muy_, rear_mu_, pexp_, crr_, r_, eta_;
    double inertia_all_wheels_eq_, inertia_nondriven_eq_;
    std::vector<double> gear_inertia_eq_;

    double table_dv_;
    double table_vmax_;
    std::vector<double> table_force_;
    std::vector<int> table_gear_;
    std::vector<double> table_load_, table_combined_;
    double load_table_scale_ = 0.0;
    static constexpr size_t TIRE_TABLE_SIZE = 32768;
};

} // namespace LapTimeSim
