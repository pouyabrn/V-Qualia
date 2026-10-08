#pragma once

#include <map>
#include <string>
#include <utility>
#include <vector>

namespace LapTimeSim {

/**
 * @brief Drag reduction system (movable rear-wing flap).
 *
 * The flap is only open while the car accelerates inside a DRS zone. Zones are
 * either given explicitly (metres from the start line, measured on the track
 * centreline) or detected automatically as the longest straights of the lap.
 */
struct DRSParams {
    bool enabled = false;
    double drag_reduction = 0.0;       ///< Fraction of total drag removed with the flap open (0-1)
    double downforce_reduction = 0.0;  ///< Fraction of total downforce removed with the flap open (0-1), taken off the rear axle
    int max_zones = 2;                 ///< Auto mode: number of longest straights that receive a zone
    double min_zone_length = 300.0;    ///< Auto mode: minimum straight length to qualify (m)
    double straight_radius = 1500.0;   ///< Auto mode: path radius above which a point counts as straight (m)
    std::vector<std::pair<double, double>> zones; ///< Explicit zones [start_m, end_m] on the centreline (may wrap)
};

/**
 * @brief Aerodynamic parameters
 */
struct AeroParams {
    double Cl;              ///< Lift coefficient (negative for downforce)
    double Cd;              ///< Drag coefficient
    double frontal_area;    ///< Reference area (m^2)
    double air_density;     ///< Air density (kg/m^3)
    double aero_balance;    ///< Front share of downforce (0-1). Negative = equal to static weight distribution
    /// Ride-height (ground effect) sensitivity: ClA(v) = ClA * (v / v_ref)^exponent, with v clamped to
    /// [min, saturation]. 0 = constant ClA. Ground-effect cars run lower and gain downforce with speed.
    double downforce_speed_exponent;
    double downforce_reference_speed;   ///< v_ref (m/s), ClA is the value at this speed
    double downforce_saturation_speed;  ///< above this speed the coefficient stops growing (m/s)
    double downforce_min_speed;         ///< below this speed the coefficient stops shrinking (m/s)
    DRSParams drs;

    AeroParams() : Cl(-3.0), Cd(0.8), frontal_area(1.5), air_density(1.225), aero_balance(-1.0),
                   downforce_speed_exponent(0.0), downforce_reference_speed(250.0 / 3.6),
                   downforce_saturation_speed(300.0 / 3.6), downforce_min_speed(60.0 / 3.6) {}

    double ClA() const { return -Cl * frontal_area; } ///< Positive for downforce
    double CdA() const { return Cd * frontal_area; }
};

/**
 * @brief Tire model parameters
 *
 * Peak force of one tyre: F = mu * Fz0 * (Fz / Fz0)^load_sensitivity, i.e. the
 * friction coefficient falls with load when load_sensitivity < 1.
 */
struct TireParams {
    double mu_x;               ///< Longitudinal friction coefficient at the reference load
    double mu_y;               ///< Lateral friction coefficient at the reference load
    double load_sensitivity;   ///< Load exponent (1 = no sensitivity, racing slicks ~0.75-0.95)
    double tire_radius;        ///< Effective rolling radius (m)
    double reference_load;     ///< Reference wheel load Fz0 (N). <= 0 means static wheel load m*g/4
    double combined_exponent;  ///< Friction ellipse exponent for combined slip (2 = ellipse)
    double rolling_resistance; ///< Rolling resistance coefficient (force = Crr * Fz)
    double wheel_inertia;      ///< Rotational inertia of one wheel + tyre (kg m^2)
    double rear_mu_scale;      ///< Rear tyre friction relative to the front (wider rear tyres > 1)

    TireParams() : mu_x(1.6), mu_y(1.8), load_sensitivity(0.9), tire_radius(0.3),
                   reference_load(-1.0), combined_exponent(2.0), rolling_resistance(0.0),
                   wheel_inertia(0.0), rear_mu_scale(1.0) {}
};

enum class DriveType { RWD, FWD, AWD };

/**
 * @brief Hybrid energy recovery / deployment system (e.g. F1 MGU-K).
 */
struct ERSParams {
    double max_power = 0.0;       ///< Electric deployment power at the crank (W)
    double energy_per_lap = 0.0;  ///< Energy that may be taken from storage per lap (J). <= 0 = unlimited
    double recovery_power = 0.0;  ///< Power recovered directly while at full throttle (W), e.g. MGU-H feeding the MGU-K
};

/**
 * @brief Powertrain parameters
 */
struct PowertrainParams {
    std::map<double, double> engine_torque_curve;  ///< RPM -> Torque (Nm)
    std::vector<double> gear_ratios;               ///< Gear ratios (higher = more torque)
    double final_drive_ratio;                      ///< Final drive ratio
    double drivetrain_efficiency;                  ///< Power transmission efficiency (0-1)
    double max_rpm;                                ///< Redline RPM
    double min_rpm;                                ///< Idle / launch RPM
    double shift_time;                             ///< Torque interruption per upshift (s)
    double engine_inertia;                         ///< Rotating inertia at the crank (kg m^2)
    DriveType drive_type;                          ///< Driven axle(s)
    ERSParams ers;                                 ///< Hybrid deployment

    PowertrainParams() : final_drive_ratio(3.5), drivetrain_efficiency(0.95),
                         max_rpm(15000), min_rpm(4000), shift_time(0.05),
                         engine_inertia(0.0), drive_type(DriveType::RWD) {}

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
 * @brief Mass, geometry and inertia parameters
 */
struct MassParams {
    double mass;                ///< Total vehicle mass incl. driver and fuel (kg)
    double cog_height;          ///< Centre of gravity height (m)
    double wheelbase;           ///< Distance between front and rear axles (m)
    double weight_distribution; ///< Static front weight fraction (0-1)
    double track_width_front;   ///< Front track (m). <= 0 = estimated from wheelbase
    double track_width_rear;    ///< Rear track (m). <= 0 = same as front
    double vehicle_width;       ///< Overall width (m). <= 0 = track + 0.3 m
    double lltd_front;          ///< Front share of lateral load transfer (0-1). Negative = weight distribution

    MassParams() : mass(800), cog_height(0.3), wheelbase(2.5), weight_distribution(0.45),
                   track_width_front(-1.0), track_width_rear(-1.0), vehicle_width(-1.0),
                   lltd_front(-1.0) {}
};

/**
 * @brief Braking system parameters
 */
struct BrakeParams {
    double max_brake_force;  ///< Maximum total brake force the system can generate (N)
    double brake_bias;       ///< Front brake distribution (0-1)
    bool ideal_bias;         ///< true = bias follows the load (brake-by-wire / perfect balance)

    BrakeParams() : max_brake_force(20000), brake_bias(0.6), ideal_bias(false) {}
};

/**
 * @brief Racing-line related settings that depend on the car
 */
struct LineParams {
    /// Minimum distance between the car centre line and the track boundary (m).
    /// 0 = car centre may reach the boundary (wheels on the kerbs), negative = beyond it.
    double edge_margin = 0.0;
};

/**
 * @brief Complete vehicle parameter set
 */
class VehicleParams {
public:
    VehicleParams();
    ~VehicleParams() = default;

    MassParams mass;
    AeroParams aero;
    TireParams tire;
    PowertrainParams powertrain;
    BrakeParams brake;
    LineParams line;

    static constexpr double GRAVITY = 9.81;  // m/s^2

    bool validate() const;

    const std::string& getName() const { return vehicle_name_; }
    void setName(const std::string& name) { vehicle_name_ = name; }

    /// Peak combustion power (W, at the crank)
    double getPeakEnginePower() const;
    /// Power-to-weight ratio incl. ERS (hp/kg)
    double getPowerToWeightRatio() const;
    /// Power-limited top speed estimate incl. ERS (m/s)
    double getMaxTheoreticalSpeed() const;

    double getFrontTrack() const;
    double getRearTrack() const;
    double getVehicleWidth() const;
    double getAeroBalance() const;
    double getLLTDFront() const;

private:
    std::string vehicle_name_;
};

} // namespace LapTimeSim
