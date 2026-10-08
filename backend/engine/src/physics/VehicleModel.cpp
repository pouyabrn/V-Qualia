#include "physics/VehicleModel.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace LapTimeSim {

VehicleModel::VehicleModel(const VehicleParams& params, bool use_tire_tables, const VehicleModel* reuse)
    : p_(params),
      powertrain_(params.powertrain, params.tire.tire_radius) {
    if (!p_.validate()) throw std::invalid_argument("VehicleModel requires valid vehicle parameters");
    m_ = p_.mass.mass;
    g_ = VehicleParams::GRAVITY;
    h_ = p_.mass.cog_height;
    L_ = p_.mass.wheelbase;
    wd_ = p_.mass.weight_distribution;
    ab_ = p_.getAeroBalance();
    tf_ = p_.getFrontTrack();
    tr_ = p_.getRearTrack();
    lltd_ = p_.getLLTDFront();

    half_rho_cla_ = 0.5 * p_.aero.air_density * p_.aero.ClA();
    half_rho_cda_ = 0.5 * p_.aero.air_density * p_.aero.CdA();
    df_exponent_ = p_.aero.downforce_speed_exponent;
    df_v_ref_ = std::max(1.0, p_.aero.downforce_reference_speed);
    df_v_sat_ = std::max(df_v_ref_, p_.aero.downforce_saturation_speed);
    df_v_min_ = std::clamp(p_.aero.downforce_min_speed, 1.0, df_v_ref_);
    drs_drag_factor_ = p_.aero.drs.enabled ? (1.0 - p_.aero.drs.drag_reduction) : 1.0;
    drs_df_loss_ = p_.aero.drs.enabled ? p_.aero.drs.downforce_reduction : 0.0;

    fz0_ = (p_.tire.reference_load > 0.0) ? p_.tire.reference_load : m_ * g_ / 4.0;
    ls_ = p_.tire.load_sensitivity;
    mux_ = p_.tire.mu_x;
    muy_ = p_.tire.mu_y;
    rear_mu_ = p_.tire.rear_mu_scale;
    pexp_ = p_.tire.combined_exponent;
    crr_ = p_.tire.rolling_resistance;
    r_ = p_.tire.tire_radius;
    eta_ = p_.powertrain.drivetrain_efficiency;

    // Fixed car parameters: tabulate the nonlinear tire terms once. Linear
    // interpolation of these concave functions is conservative. Retain exact
    // evaluation near zero wheel load and the combined-slip boundary.
    if (use_tire_tables && ls_ > 0.0 && ls_ < 1.0) {
        load_table_scale_ = static_cast<double>(TIRE_TABLE_SIZE) / (32.0 * fz0_);
        if (reuse && reuse->ls_ == ls_ && reuse->fz0_ == fz0_ && !reuse->table_load_.empty()) {
            table_load_ = reuse->table_load_;
        } else {
            table_load_.resize(TIRE_TABLE_SIZE + 1);
            for (size_t i = 0; i <= TIRE_TABLE_SIZE; ++i) {
                table_load_[i] = fz0_ * std::pow(static_cast<double>(i) * 32.0 / TIRE_TABLE_SIZE, ls_);
            }
        }
    }
    if (use_tire_tables && pexp_ > 1.0 && std::abs(pexp_ - 2.0) >= 1e-9) {
        if (reuse && reuse->pexp_ == pexp_ && !reuse->table_combined_.empty()) {
            table_combined_ = reuse->table_combined_;
        } else {
            table_combined_.resize(TIRE_TABLE_SIZE + 1);
            for (size_t i = 0; i <= TIRE_TABLE_SIZE; ++i) {
                const double u = static_cast<double>(i) / TIRE_TABLE_SIZE;
                table_combined_[i] = std::pow(std::max(0.0, 1.0 - std::pow(u, pexp_)), 1.0 / pexp_);
            }
        }
    }

    const double wheel_eq = p_.tire.wheel_inertia / (r_ * r_);
    inertia_all_wheels_eq_ = 4.0 * wheel_eq;
    inertia_nondriven_eq_ = (p_.powertrain.drive_type == DriveType::AWD) ? 0.0 : 2.0 * wheel_eq;

    gear_inertia_eq_.assign(p_.powertrain.gear_ratios.size() + 1, 0.0);
    for (int gear = 1; gear <= numGears(); ++gear) {
        const double ratio = powertrain_.getOverallRatio(gear) / r_;
        gear_inertia_eq_[static_cast<size_t>(gear)] = p_.powertrain.engine_inertia * ratio * ratio;
    }

    // Full-load engine force map in the best gear (fast lookup for the solver).
    const double gear_limit = powertrain_.getTopSpeedForGear(numGears());
    table_dv_ = 0.05;
    table_vmax_ = std::max(30.0, gear_limit * 1.002);
    if (reuse && reuse->r_ == r_ && reuse->eta_ == eta_ &&
        reuse->p_.powertrain.gear_ratios == p_.powertrain.gear_ratios &&
        reuse->p_.powertrain.final_drive_ratio == p_.powertrain.final_drive_ratio &&
        reuse->p_.powertrain.max_rpm == p_.powertrain.max_rpm &&
        reuse->p_.powertrain.min_rpm == p_.powertrain.min_rpm &&
        reuse->p_.powertrain.engine_torque_curve == p_.powertrain.engine_torque_curve) {
        table_force_ = reuse->table_force_;
        table_gear_ = reuse->table_gear_;
        return;
    }
    const size_t n = static_cast<size_t>(std::ceil(table_vmax_ / table_dv_)) + 2;
    table_force_.assign(n, 0.0);
    table_gear_.assign(n, numGears());
    for (size_t i = 0; i < n; ++i) {
        const double v = static_cast<double>(i) * table_dv_;
        const PowertrainOperatingPoint op = powertrain_.getBestAccelerationPoint(v);
        table_force_[i] = op.valid ? op.wheel_force : 0.0;
        table_gear_[i] = op.gear;
    }
}

double VehicleModel::dragForce(double v, bool drs_open) const {
    return half_rho_cda_ * v * v * (drs_open ? drs_drag_factor_ : 1.0);
}

double VehicleModel::downforceFactor(double v) const {
    if (df_exponent_ == 0.0) {
        return 1.0;
    }
    const double vc = std::clamp(v, df_v_min_, df_v_sat_);
    return std::pow(vc / df_v_ref_, df_exponent_);
}

void VehicleModel::aeroLoads(double v, bool drs_open, double& df_front, double& df_rear) const {
    const double total = half_rho_cla_ * v * v * downforceFactor(v);
    df_front = total * ab_;
    df_rear = total * (1.0 - ab_) - (drs_open ? drs_df_loss_ * total : 0.0);
}

double VehicleModel::downforce(double v, bool drs_open) const {
    double front = 0.0;
    double rear = 0.0;
    aeroLoads(v, drs_open, front, rear);
    return front + rear;
}

double VehicleModel::lateralDemand(double v, double kappa, const RoadConditions& rc) const {
    const double ay_horizontal = v * v * std::abs(kappa);
    return std::abs(ay_horizontal * std::cos(rc.banking) - g_ * std::sin(rc.banking) * std::cos(rc.grade));
}

double VehicleModel::normalAccel(double v, double kappa, const RoadConditions& rc) const {
    // gravity component normal to the road + banking share of the centripetal acceleration
    // + centripetal acceleration of vertical curvature (compressions load the tyres, crests unload them)
    return g_ * std::cos(rc.banking) * std::cos(rc.grade) + v * v * std::abs(kappa) * std::sin(rc.banking) +
           v * v * rc.vertical_curvature;
}

double VehicleModel::resistance(double v, double kappa, const RoadConditions& rc) const {
    const double fz = std::max(0.0, m_ * normalAccel(v, kappa, rc) + downforce(v, rc.drs_open));
    return dragForce(v, rc.drs_open) + crr_ * fz + m_ * g_ * std::sin(rc.grade);
}

PowertrainOperatingPoint VehicleModel::engine(double v) const {
    PowertrainOperatingPoint op;
    v = std::max(0.0, v);
    const double idx = v / table_dv_;
    const size_t i = static_cast<size_t>(idx);
    if (i + 1 >= table_force_.size()) {
        op.gear = numGears();
        op.rpm = powertrain_.getRPM(v, op.gear);
        op.valid = false;
        return op;
    }
    const double f = idx - static_cast<double>(i);
    op.wheel_force = table_force_[i] * (1.0 - f) + table_force_[i + 1] * f;
    op.gear = (f < 0.5) ? table_gear_[i] : table_gear_[i + 1];
    if (powertrain_.getRPM(v, op.gear) > p_.powertrain.max_rpm * 1.002) {
        // Interpolation must not extend the lower gear across its rev limiter.
        return powertrain_.getBestAccelerationPoint(v);
    }
    op.rpm = std::max(powertrain_.getRPM(v, op.gear), p_.powertrain.min_rpm);
    op.engine_torque = p_.powertrain.getTorqueAt(op.rpm);
    op.wheel_power = op.wheel_force * v;
    op.valid = op.wheel_force > 0.0;
    return op;
}

double VehicleModel::ersForce(double v) const {
    const double power = p_.powertrain.ers.max_power;
    if (power <= 0.0) {
        return 0.0;
    }
    return power * eta_ / std::max(v, 1.0);
}

double VehicleModel::effectiveMassPowered(int gear) const {
    const size_t g = static_cast<size_t>(std::clamp(gear, 1, std::max(1, numGears())));
    const double engine_eq = (g < gear_inertia_eq_.size()) ? gear_inertia_eq_[g] : 0.0;
    return m_ + inertia_all_wheels_eq_ + engine_eq;
}

double VehicleModel::effectiveMassTraction() const {
    return m_ + inertia_nondriven_eq_;
}

double VehicleModel::peakLoad(double fz) const {
    if (fz <= 0.0) return 0.0;
    if (ls_ == 1.0) return fz;
    const double idx = fz * load_table_scale_;
    if (table_load_.empty() || idx < 32.0 || idx >= TIRE_TABLE_SIZE) {
        return fz0_ * std::pow(fz / fz0_, ls_);
    }
    const size_t i = static_cast<size_t>(idx);
    const double t = idx - static_cast<double>(i);
    return table_load_[i] + t * (table_load_[i + 1] - table_load_[i]);
}

VehicleModel::AxleCapacity VehicleModel::axleCapacity(double fz_axle, double load_transfer, bool rear) const {
    AxleCapacity cap;
    if (fz_axle <= 0.0) {
        return cap;
    }
    double outer = 0.5 * fz_axle + load_transfer;
    double inner = 0.5 * fz_axle - load_transfer;
    if (inner < 0.0) {  // inside wheel lifted
        inner = 0.0;
        outer = fz_axle;
    }
    const double base = (peakLoad(outer) + peakLoad(inner)) * (rear ? rear_mu_ : 1.0);
    cap.fy = muy_ * base;
    cap.fx = mux_ * base;
    return cap;
}

double VehicleModel::combinedFactor(double fy_required, double fy_capacity) const {
    if (fy_capacity <= 0.0 || fy_required >= fy_capacity) {
        return 0.0;
    }
    const double u = fy_required / fy_capacity;
    if (std::abs(pexp_ - 2.0) < 1e-9) {
        return std::sqrt(std::max(0.0, 1.0 - u * u));
    }
    if (!table_combined_.empty() && u < 0.999) {
        const double idx = u * TIRE_TABLE_SIZE;
        const size_t i = static_cast<size_t>(idx);
        const double t = idx - static_cast<double>(i);
        return table_combined_[i] + t * (table_combined_[i + 1] - table_combined_[i]);
    }
    return std::pow(std::max(0.0, 1.0 - std::pow(u, pexp_)), 1.0 / pexp_);
}

double VehicleModel::tractionFrom(const AxleCapacity& front, const AxleCapacity& rear, double k) const {
    switch (p_.powertrain.drive_type) {
    case DriveType::FWD:
        return front.fx * k;
    case DriveType::AWD:
        return (front.fx + rear.fx) * k;
    case DriveType::RWD:
    default:
        return rear.fx * k;
    }
}

double VehicleModel::brakeFrom(const AxleCapacity& front, const AxleCapacity& rear, double k) const {
    const double f = front.fx * k;
    const double r = rear.fx * k;
    double tyre_limit = f + r;
    if (!p_.brake.ideal_bias) {
        const double bias = p_.brake.brake_bias;
        tyre_limit = std::min(f / bias, r / (1.0 - bias));
    }
    return std::min(tyre_limit, p_.brake.max_brake_force);
}

double VehicleModel::accelCore(double v, double ay, double an, double grade, bool drs_open,
                               double propulsive_force, int gear, ForceBreakdown* out) const {
    double df_front = 0.0;
    double df_rear = 0.0;
    aeroLoads(v, drs_open, df_front, df_rear);
    const double drag = dragForce(v, drs_open);
    const double fz_total = std::max(0.0, m_ * an + df_front + df_rear);
    const double rolling = crr_ * fz_total;
    const double grade_force = m_ * g_ * std::sin(grade);
    const double resist = drag + rolling + grade_force;
    const double fy_req = m_ * std::abs(ay);
    const double m_pow = effectiveMassPowered(gear);
    const double m_trac = effectiveMassTraction();

    const double static_front = m_ * an * wd_ + df_front;
    const double static_rear = m_ * an * (1.0 - wd_) + df_rear;
    const double lat_front = m_ * std::abs(ay) * h_ * lltd_ / tf_;
    const double lat_rear = m_ * std::abs(ay) * h_ * (1.0 - lltd_) / tr_;

    double ax = std::clamp((propulsive_force - resist) / m_pow, -60.0, 60.0);
    AxleCapacity cf;
    AxleCapacity cr;
    double k = 0.0;
    double traction = 0.0;
    double fz_f = static_front;
    double fz_r = static_rear;
    for (int it = 0; it < 6; ++it) {
        const double shift = m_ * ax * h_ / L_;
        fz_f = std::clamp(static_front - shift, 0.0, fz_total);
        fz_r = fz_total - fz_f; // wheel lift cannot create extra normal load
        cf = axleCapacity(fz_f, lat_front, false);
        cr = axleCapacity(fz_r, lat_rear, true);
        k = combinedFactor(fy_req, cf.fy + cr.fy);
        traction = tractionFrom(cf, cr, k);
        const double a_new = std::min((propulsive_force - resist) / m_pow, (traction - resist) / m_trac);
        const bool done = std::abs(a_new - ax) < 1e-6;
        ax = a_new;
        if (done) {
            break;
        }
    }

    if (out != nullptr) {
        out->downforce = df_front + df_rear;
        out->drag = drag;
        out->rolling = rolling;
        out->grade_force = grade_force;
        out->fz_front = fz_f;
        out->fz_rear = fz_r;
        out->fy_required = fy_req;
        out->fy_capacity = cf.fy + cr.fy;
        out->fx_tyre_limit = traction;
        out->lateral_usage = (out->fy_capacity > 0.0) ? fy_req / out->fy_capacity : 1.0;
    }
    return ax;
}

double VehicleModel::decelCore(double v, double ay, double an, double grade, ForceBreakdown* out) const {
    double df_front = 0.0;
    double df_rear = 0.0;
    aeroLoads(v, false, df_front, df_rear);
    const double drag = dragForce(v, false);
    const double fz_total = std::max(0.0, m_ * an + df_front + df_rear);
    const double rolling = crr_ * fz_total;
    const double grade_force = m_ * g_ * std::sin(grade);
    const double resist = drag + rolling + grade_force;
    const double fy_req = m_ * std::abs(ay);

    const double static_front = m_ * an * wd_ + df_front;
    const double static_rear = m_ * an * (1.0 - wd_) + df_rear;
    const double lat_front = m_ * std::abs(ay) * h_ * lltd_ / tf_;
    const double lat_rear = m_ * std::abs(ay) * h_ * (1.0 - lltd_) / tr_;

    double ax = -(resist + mux_ * fz_total) / m_;
    AxleCapacity cf;
    AxleCapacity cr;
    double brake = 0.0;
    double fz_f = static_front;
    double fz_r = static_rear;
    for (int it = 0; it < 6; ++it) {
        const double shift = m_ * ax * h_ / L_;  // negative while braking -> load moves forward
        fz_f = std::clamp(static_front - shift, 0.0, fz_total);
        fz_r = fz_total - fz_f;
        cf = axleCapacity(fz_f, lat_front, false);
        cr = axleCapacity(fz_r, lat_rear, true);
        const double k = combinedFactor(fy_req, cf.fy + cr.fy);
        brake = brakeFrom(cf, cr, k);
        const double a_new = -(brake + resist) / m_;
        const bool done = std::abs(a_new - ax) < 1e-6;
        ax = a_new;
        if (done) {
            break;
        }
    }

    if (out != nullptr) {
        out->downforce = df_front + df_rear;
        out->drag = drag;
        out->rolling = rolling;
        out->grade_force = grade_force;
        out->fz_front = fz_f;
        out->fz_rear = fz_r;
        out->fy_required = fy_req;
        out->fy_capacity = cf.fy + cr.fy;
        out->fx_tyre_limit = brake;
        out->lateral_usage = (out->fy_capacity > 0.0) ? fy_req / out->fy_capacity : 1.0;
    }
    return std::max(0.0, -ax);
}

double VehicleModel::maxAcceleration(double v, double kappa, const RoadConditions& rc, double propulsive_force,
                                     int gear, ForceBreakdown* out) const {
    return accelCore(v, lateralDemand(v, kappa, rc), normalAccel(v, kappa, rc), rc.grade,
                     rc.drs_open, propulsive_force, gear, out);
}

double VehicleModel::maxDeceleration(double v, double kappa, const RoadConditions& rc, ForceBreakdown* out) const {
    return decelCore(v, lateralDemand(v, kappa, rc), normalAccel(v, kappa, rc), rc.grade, out);
}

double VehicleModel::maxAccelerationAy(double v, double ay, bool drs_open, ForceBreakdown* out, bool with_ers) const {
    const PowertrainOperatingPoint op = engine(v);
    const double propulsive = op.valid ? op.wheel_force + (with_ers ? ersForce(v) : 0.0) : 0.0;
    return accelCore(v, ay, g_, 0.0, drs_open, propulsive, op.gear, out);
}

double VehicleModel::maxDecelerationAy(double v, double ay, ForceBreakdown* out) const {
    return decelCore(v, ay, g_, 0.0, out);
}

bool VehicleModel::corneringFeasible(double v, double kappa, const RoadConditions& rc) const {
    const double ay = lateralDemand(v, kappa, rc);
    const double an = normalAccel(v, kappa, rc);
    double df_front = 0.0;
    double df_rear = 0.0;
    aeroLoads(v, false, df_front, df_rear);
    const double fz_total = std::max(0.0, m_ * an + df_front + df_rear);
    const double hold_force = dragForce(v, false) + crr_ * fz_total + m_ * g_ * std::sin(rc.grade);

    const double fz_f = std::clamp(m_ * an * wd_ + df_front, 0.0, fz_total);
    const double fz_r = fz_total - fz_f;
    const AxleCapacity cf = axleCapacity(fz_f, m_ * ay * h_ * lltd_ / tf_, false);
    const AxleCapacity cr = axleCapacity(fz_r, m_ * ay * h_ * (1.0 - lltd_) / tr_, true);
    const double fy_req = m_ * ay;
    const double fy_cap = cf.fy + cr.fy;
    if (fy_req > fy_cap) {
        return false;
    }
    if (hold_force <= 0.0) {
        return true;
    }
    // The driven tyres must still be able to hold speed against drag while cornering.
    const double k = combinedFactor(fy_req, fy_cap);
    return tractionFrom(cf, cr, k) >= hold_force;
}

double VehicleModel::maxCorneringSpeed(double kappa, const RoadConditions& rc, double v_cap) const {
    if (std::abs(kappa) < 1e-7 || corneringFeasible(v_cap, kappa, rc)) {
        return v_cap;
    }
    double lo = 0.0;
    double hi = v_cap;
    for (int it = 0; it < 48; ++it) {
        const double mid = 0.5 * (lo + hi);
        if (corneringFeasible(mid, kappa, rc)) {
            lo = mid;
        } else {
            hi = mid;
        }
        if (hi - lo < 1e-4) {
            break;
        }
    }
    return lo;
}

double VehicleModel::topSpeed(bool drs_open, bool with_ers) const {
    double last_positive = 0.0;
    const double gear_limit = powertrain_.getTopSpeedForGear(numGears()) * 1.002;
    for (double v = 1.0; v <= gear_limit; v += 0.05) {
        const double fz = m_ * g_ + downforce(v, drs_open);
        const double propulsive = engine(v).wheel_force + (with_ers ? ersForce(v) : 0.0);
        const double net = propulsive - dragForce(v, drs_open) - crr_ * fz;
        if (net >= 0.0) {
            last_positive = v;
        } else if (last_positive > 0.0) {
            break;
        }
    }
    return last_positive;
}

} // namespace LapTimeSim
