#include "solver/QuasiSteadyStateSolver.h"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <vector>

namespace LapTimeSim {

namespace {

size_t wrapIndex(long long index, size_t size) {
    const long long mod = static_cast<long long>(size);
    long long wrapped = index % mod;
    if (wrapped < 0) {
        wrapped += mod;
    }
    return static_cast<size_t>(wrapped);
}

std::vector<double> smoothCircular(const std::vector<double>& values, size_t radius) {
    if (values.empty() || radius == 0) {
        return values;
    }

    std::vector<double> smoothed(values.size(), 0.0);
    for (size_t i = 0; i < values.size(); ++i) {
        double weighted_sum = 0.0;
        double weight_total = 0.0;
        for (long long offset = -static_cast<long long>(radius); offset <= static_cast<long long>(radius); ++offset) {
            const double weight = static_cast<double>(radius + 1) - std::abs(static_cast<double>(offset));
            const size_t j = wrapIndex(static_cast<long long>(i) + offset, values.size());
            weighted_sum += weight * values[j];
            weight_total += weight;
        }
        smoothed[i] = (weight_total > 0.0) ? (weighted_sum / weight_total) : values[i];
    }
    return smoothed;
}

} // namespace

QuasiSteadyStateSolver::QuasiSteadyStateSolver(const TrackData& track, const VehicleParams& vehicle)
    : track_(track),
      vehicle_(vehicle),
      n_points_(0),
      lap_time_(0.0),
      top_speed_cap_(0.0),
      estimated_track_width_(std::clamp(vehicle.mass.wheelbase * 0.35 + 0.65, 1.1, 2.0)),
      converged_(false),
      iterations_used_(0) {
    if (!track_.isPreprocessed()) {
        throw std::runtime_error("Track must be preprocessed before solving");
    }
    if (!vehicle_.validate()) {
        throw std::runtime_error("Vehicle parameters are invalid");
    }

    aero_ = std::make_unique<AerodynamicsModel>(vehicle_.aero);
    tire_ = std::make_unique<TireModel>(
        vehicle_.tire,
        vehicle_.mass.mass * VehicleParams::GRAVITY / 4.0);
    powertrain_model_ = std::make_unique<PowertrainModel>(
        vehicle_.powertrain,
        vehicle_.tire.tire_radius);
    ggv_ = std::make_unique<GGVGenerator>(vehicle_);
}

void QuasiSteadyStateSolver::initialize() {
    if (working_track_.empty()) {
        buildWorkingTrack();
    }

    const int top_gear = static_cast<int>(vehicle_.powertrain.gear_ratios.size());
    const double gear_limited_speed = powertrain_model_->getTopSpeedForGear(top_gear);
    const double aero_limited_speed = vehicle_.getMaxTheoreticalSpeed();

    top_speed_cap_ = std::max(
        20.0,
        std::min(
            (gear_limited_speed > 1.0 ? gear_limited_speed * 1.02 : aero_limited_speed * 1.05),
            aero_limited_speed * 1.08));

    const double ggv_v_max = std::max(top_speed_cap_ + 5.0, 50.0);
    ggv_->generate(0.0, ggv_v_max, 0.5, 60.0, 1.0);

    v_corner_.assign(n_points_, top_speed_cap_);
    v_optimal_.assign(n_points_, top_speed_cap_);
    gear_profile_.assign(n_points_, 1);
    shift_profile_.assign(n_points_, false);
}

void QuasiSteadyStateSolver::buildWorkingTrack() {
    const double input_step = track_.getTotalLength() / static_cast<double>(track_.getNumPoints());
    const double target_step = std::clamp(input_step / 4.0, 0.75, 2.0);

    n_points_ = std::max(
        track_.getNumPoints(),
        static_cast<size_t>(std::ceil(track_.getTotalLength() / target_step)));

    const double ds = track_.getTotalLength() / static_cast<double>(n_points_);
    working_track_.assign(n_points_, {});
    std::vector<double> center_x(n_points_, 0.0);
    std::vector<double> center_y(n_points_, 0.0);
    std::vector<double> center_psi(n_points_, 0.0);

    for (size_t i = 0; i < n_points_; ++i) {
        const double s = ds * static_cast<double>(i);
        const TrackPoint point = track_.interpolateAt(s);
        SolverTrackPoint sample;
        sample.s = s;
        sample.ds = ds;
        sample.x = point.x;
        sample.y = point.y;
        sample.z = point.z;
        sample.w_tr_left = point.w_tr_left;
        sample.w_tr_right = point.w_tr_right;
        sample.banking = point.banking;
        working_track_[i] = sample;
        center_x[i] = sample.x;
        center_y[i] = sample.y;
    }

    const size_t deriv_stride = std::max<size_t>(1, static_cast<size_t>(std::lround(3.0 / ds)));

    for (size_t i = 0; i < n_points_; ++i) {
        const size_t prev = wrapIndex(static_cast<long long>(i) - static_cast<long long>(deriv_stride), n_points_);
        const size_t next = wrapIndex(static_cast<long long>(i) + static_cast<long long>(deriv_stride), n_points_);
        const double h = static_cast<double>(deriv_stride) * ds;

        const double dx = (center_x[next] - center_x[prev]) / (2.0 * h);
        const double dy = (center_y[next] - center_y[prev]) / (2.0 * h);
        center_psi[i] = std::atan2(dy, dx);
    }

    const size_t line_radius = std::max<size_t>(2, static_cast<size_t>(std::lround(18.0 / ds)));
    const std::vector<double> smooth_x = smoothCircular(center_x, line_radius);
    const std::vector<double> smooth_y = smoothCircular(center_y, line_radius);
    std::vector<double> lateral_offset(n_points_, 0.0);

    for (size_t i = 0; i < n_points_; ++i) {
        const double nx = -std::sin(center_psi[i]);
        const double ny = std::cos(center_psi[i]);
        const double dx = smooth_x[i] - center_x[i];
        const double dy = smooth_y[i] - center_y[i];
        const double max_left = 0.95 * working_track_[i].w_tr_left;
        const double max_right = 0.95 * working_track_[i].w_tr_right;
        lateral_offset[i] = std::clamp(dx * nx + dy * ny, -max_right, max_left);
    }

    const size_t offset_radius = std::max<size_t>(1, static_cast<size_t>(std::lround(8.0 / ds)));
    lateral_offset = smoothCircular(lateral_offset, offset_radius);

    for (size_t i = 0; i < n_points_; ++i) {
        const double nx = -std::sin(center_psi[i]);
        const double ny = std::cos(center_psi[i]);
        const double max_left = 0.98 * working_track_[i].w_tr_left;
        const double max_right = 0.98 * working_track_[i].w_tr_right;
        working_track_[i].n = std::clamp(lateral_offset[i], -max_right, max_left);
        working_track_[i].x = center_x[i] + working_track_[i].n * nx;
        working_track_[i].y = center_y[i] + working_track_[i].n * ny;
    }

    std::vector<double> raw_kappa(n_points_, 0.0);
    for (size_t i = 0; i < n_points_; ++i) {
        const size_t prev = wrapIndex(static_cast<long long>(i) - static_cast<long long>(deriv_stride), n_points_);
        const size_t next = wrapIndex(static_cast<long long>(i) + static_cast<long long>(deriv_stride), n_points_);
        const double h = static_cast<double>(deriv_stride) * ds;

        const double dx = (working_track_[next].x - working_track_[prev].x) / (2.0 * h);
        const double dy = (working_track_[next].y - working_track_[prev].y) / (2.0 * h);
        const double ddx = (working_track_[next].x - 2.0 * working_track_[i].x + working_track_[prev].x) / (h * h);
        const double ddy = (working_track_[next].y - 2.0 * working_track_[i].y + working_track_[prev].y) / (h * h);
        const double denom = std::pow(std::max(1e-9, dx * dx + dy * dy), 1.5);

        working_track_[i].psi = std::atan2(dy, dx);
        raw_kappa[i] = (dx * ddy - dy * ddx) / denom;
    }

    const size_t smooth_radius = std::max<size_t>(1, static_cast<size_t>(std::lround(12.0 / ds)));
    std::vector<double> smoothed = smoothCircular(raw_kappa, smooth_radius);
    smoothed = smoothCircular(smoothed, smooth_radius);

    for (size_t i = 0; i < n_points_; ++i) {
        working_track_[i].kappa = smoothed[i];
    }
}

double QuasiSteadyStateSolver::solve(int max_iterations, double tolerance) {
    initialize();

    std::cout << "Initializing solver..." << std::endl;
    std::cout << "  Input points: " << track_.getNumPoints()
              << " | working points: " << n_points_
              << " | ds: " << working_track_.front().ds << " m" << std::endl;
    std::cout << "  Top-speed cap: " << top_speed_cap_ * 3.6 << " km/h" << std::endl;

    calculateCorneringLimit();
    v_optimal_ = v_corner_;

    const size_t seed_index = static_cast<size_t>(
        std::distance(v_corner_.begin(), std::min_element(v_corner_.begin(), v_corner_.end())));

    double previous_lap_time = std::numeric_limits<double>::infinity();
    converged_ = false;

    for (int iteration = 0; iteration < max_iterations; ++iteration) {
        iterations_used_ = iteration + 1;

        forwardIntegration(seed_index);
        backwardIntegration(seed_index);
        updateGearProfile();

        lap_time_ = calculateLapTime();
        const double lap_time_change = std::isfinite(previous_lap_time)
            ? std::abs(lap_time_ - previous_lap_time)
            : std::numeric_limits<double>::infinity();

        std::cout << "Iteration " << (iteration + 1)
                  << ": lap time = " << lap_time_
                  << " s, delta = " << (std::isfinite(lap_time_change) ? lap_time_change : 0.0)
                  << std::endl;

        if (lap_time_change < tolerance) {
            converged_ = true;
            break;
        }

        previous_lap_time = lap_time_;
    }

    if (!converged_) {
        std::cout << "Warning: solver reached iteration limit without strict convergence" << std::endl;
    }

    std::cout << "Final lap time: " << lap_time_ << " seconds" << std::endl;
    return lap_time_;
}

void QuasiSteadyStateSolver::calculateCorneringLimit() {
    double min_speed = std::numeric_limits<double>::max();
    double max_speed = 0.0;

    for (size_t i = 0; i < n_points_; ++i) {
        v_corner_[i] = solveCorneringVelocity(working_track_[i].kappa, working_track_[i].banking);
        min_speed = std::min(min_speed, v_corner_[i]);
        max_speed = std::max(max_speed, v_corner_[i]);
    }

    std::cout << "Cornering speed range: "
              << min_speed * 3.6 << " to " << max_speed * 3.6 << " km/h" << std::endl;
}

void QuasiSteadyStateSolver::forwardIntegration(size_t seed_index) {
    for (size_t offset = 0; offset < n_points_; ++offset) {
        const size_t i = (seed_index + offset) % n_points_;
        const size_t next = (i + 1) % n_points_;

        const double ax = getMaxDriveAcceleration(
            v_optimal_[i],
            working_track_[i].kappa,
            working_track_[i].banking);
        const double next_speed_sq = std::max(
            0.0,
            v_optimal_[i] * v_optimal_[i] + 2.0 * ax * working_track_[i].ds);
        const double next_speed = std::sqrt(next_speed_sq);

        if (next_speed < v_optimal_[next]) {
            v_optimal_[next] = next_speed;
        }
    }
}

void QuasiSteadyStateSolver::backwardIntegration(size_t seed_index) {
    for (size_t offset = 0; offset < n_points_; ++offset) {
        const size_t current = wrapIndex(
            static_cast<long long>(seed_index) - static_cast<long long>(offset),
            n_points_);
        const size_t prev = wrapIndex(static_cast<long long>(current) - 1, n_points_);

        const double ax = getMaxBrakeAcceleration(
            v_optimal_[current],
            working_track_[prev].kappa,
            working_track_[prev].banking);
        const double prev_speed_sq = std::max(
            0.0,
            v_optimal_[current] * v_optimal_[current] - 2.0 * ax * working_track_[prev].ds);
        const double prev_speed = std::sqrt(prev_speed_sq);

        if (prev_speed < v_optimal_[prev]) {
            v_optimal_[prev] = prev_speed;
        }
    }
}

void QuasiSteadyStateSolver::updateGearProfile() {
    if (n_points_ == 0) {
        return;
    }

    const size_t seed_index = static_cast<size_t>(
        std::distance(v_optimal_.begin(), std::min_element(v_optimal_.begin(), v_optimal_.end())));

    int start_gear = 1;
    for (int pass = 0; pass < 2; ++pass) {
        int current_gear = start_gear;
        std::fill(shift_profile_.begin(), shift_profile_.end(), false);

        for (size_t offset = 0; offset < n_points_; ++offset) {
            const size_t i = (seed_index + offset) % n_points_;
            const size_t next = (i + 1) % n_points_;
            const bool accelerating = v_optimal_[next] > v_optimal_[i] + 0.1;
            const int recommended = powertrain_model_->getRecommendedGear(
                v_optimal_[i],
                current_gear,
                accelerating);

            shift_profile_[i] = accelerating && (recommended != current_gear);
            current_gear = recommended;
            gear_profile_[i] = current_gear;
        }

        start_gear = current_gear;
    }
}

double QuasiSteadyStateSolver::calculateLapTime() const {
    double total_time = 0.0;

    for (size_t i = 0; i < n_points_; ++i) {
        const size_t next = (i + 1) % n_points_;
        const double average_speed = 0.5 * (v_optimal_[i] + v_optimal_[next]);
        total_time += working_track_[i].ds / std::max(0.5, average_speed);

        if (i < shift_profile_.size() && shift_profile_[i]) {
            total_time += vehicle_.powertrain.shift_time;
        }
    }

    return total_time;
}

double QuasiSteadyStateSolver::solveCorneringVelocity(double kappa, double banking) const {
    if (std::abs(kappa) < 1e-6) {
        return top_speed_cap_;
    }

    double low = 0.0;
    double high = top_speed_cap_;

    for (int iteration = 0; iteration < 50; ++iteration) {
        const double mid = 0.5 * (low + high);
        const double lateral_accel = mid * mid * std::abs(kappa);
        const double Fy_required = getLateralForceDemand(mid, kappa, banking);
        const double Fy_available = getMaxLateralTireForce(getVerticalLoad(mid, banking), lateral_accel);

        if (Fy_required <= Fy_available) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return low;
}

double QuasiSteadyStateSolver::getVerticalLoad(double velocity, double banking) const {
    const double static_load = vehicle_.mass.mass * VehicleParams::GRAVITY * std::max(0.0, std::cos(banking));
    return std::max(0.0, static_load + aero_->getDownforce(velocity));
}

double QuasiSteadyStateSolver::getLateralForceDemand(double velocity, double curvature, double banking) const {
    const double lateral_accel = velocity * velocity * std::abs(curvature);
    const double bank_support = VehicleParams::GRAVITY * std::sin(banking);
    return vehicle_.mass.mass * std::max(0.0, lateral_accel - bank_support);
}

double QuasiSteadyStateSolver::getMaxLateralTireForce(double Fz_total, double lateral_accel) const {
    const double wheel_load = Fz_total / 4.0;
    const double load_transfer = vehicle_.mass.mass * std::abs(lateral_accel) *
        vehicle_.mass.cog_height / std::max(estimated_track_width_, 1.0);
    const double outside_load = std::max(0.0, wheel_load + 0.25 * load_transfer);
    const double inside_load = std::max(0.0, wheel_load - 0.25 * load_transfer);

    const double mu_outside = tire_->getEffectiveMu(outside_load * 4.0, vehicle_.tire.mu_y);
    const double mu_inside = tire_->getEffectiveMu(inside_load * 4.0, vehicle_.tire.mu_y);
    return 2.0 * mu_outside * outside_load + 2.0 * mu_inside * inside_load;
}

double QuasiSteadyStateSolver::getMaxLongitudinalTireForce(double Fz_total, double lateral_accel) const {
    const double wheel_load = Fz_total / 4.0;
    const double load_transfer = vehicle_.mass.mass * std::abs(lateral_accel) *
        vehicle_.mass.cog_height / std::max(estimated_track_width_, 1.0);
    const double outside_load = std::max(0.0, wheel_load + 0.25 * load_transfer);
    const double inside_load = std::max(0.0, wheel_load - 0.25 * load_transfer);

    const double mu_outside = tire_->getEffectiveMu(outside_load * 4.0, vehicle_.tire.mu_x);
    const double mu_inside = tire_->getEffectiveMu(inside_load * 4.0, vehicle_.tire.mu_x);
    return 2.0 * mu_outside * outside_load + 2.0 * mu_inside * inside_load;
}

double QuasiSteadyStateSolver::getAvailableLongitudinalTireForce(
    double Fz_total,
    double Fy_current,
    double lateral_accel) const {
    const double Fy_max = getMaxLateralTireForce(Fz_total, lateral_accel);
    const double Fx_max = getMaxLongitudinalTireForce(Fz_total, lateral_accel);
    if (Fy_max <= 0.0 || Fx_max <= 0.0) {
        return 0.0;
    }

    const double usage = std::abs(Fy_current) / Fy_max;
    if (usage >= 1.0) {
        return 0.0;
    }

    return Fx_max * std::sqrt(std::max(0.0, 1.0 - usage * usage));
}

double QuasiSteadyStateSolver::getMaxDriveAcceleration(double velocity, double curvature, double banking) const {
    const double Fz = getVerticalLoad(velocity, banking);
    const double lateral_accel = velocity * velocity * std::abs(curvature);
    const double Fy = getLateralForceDemand(velocity, curvature, banking);
    const double Fx_tire = getAvailableLongitudinalTireForce(Fz, Fy, lateral_accel);
    const PowertrainOperatingPoint power = powertrain_model_->getBestAccelerationPoint(velocity);
    const double drive_force = std::min(Fx_tire, power.wheel_force);
    return (drive_force - aero_->getDragForce(velocity)) / vehicle_.mass.mass;
}

double QuasiSteadyStateSolver::getMaxBrakeAcceleration(double velocity, double curvature, double banking) const {
    const double Fz = getVerticalLoad(velocity, banking);
    const double lateral_accel = velocity * velocity * std::abs(curvature);
    const double Fy = getLateralForceDemand(velocity, curvature, banking);
    const double Fx_tire = getAvailableLongitudinalTireForce(Fz, Fy, lateral_accel);
    const double brake_force = std::min(vehicle_.brake.max_brake_force, Fx_tire);
    return -(brake_force + aero_->getDragForce(velocity)) / vehicle_.mass.mass;
}

LapResult QuasiSteadyStateSolver::getDetailedResult() const {
    LapResult result;
    result.setLapTime(lap_time_);
    result.setTotalDistance(track_.getTotalLength());

    double cumulative_time = 0.0;
    for (size_t i = 0; i < n_points_; ++i) {
        result.addState(createState(i, cumulative_time, gear_profile_.empty() ? 1 : gear_profile_[i]));

        const size_t next = (i + 1) % n_points_;
        const double average_speed = 0.5 * (v_optimal_[i] + v_optimal_[next]);
        cumulative_time += working_track_[i].ds / std::max(0.5, average_speed);
        if (i < shift_profile_.size() && shift_profile_[i]) {
            cumulative_time += vehicle_.powertrain.shift_time;
        }
    }

    return result;
}

SimulationState QuasiSteadyStateSolver::createState(size_t index, double time, int gear) const {
    SimulationState state;
    const size_t next = (index + 1) % n_points_;
    const SolverTrackPoint& point = working_track_[index];

    const double velocity = v_optimal_[index];
    const double next_velocity = v_optimal_[next];
    const double ax = (next_velocity * next_velocity - velocity * velocity) / (2.0 * point.ds);
    const double downforce = aero_->getDownforce(velocity);
    const double drag_force = aero_->getDragForce(velocity);
    const double vertical_load = getVerticalLoad(velocity, point.banking);
    const double lateral_accel = velocity * velocity * std::abs(point.kappa);
    const double lateral_force = getLateralForceDemand(velocity, point.kappa, point.banking);
    const double signed_lateral_force = std::copysign(lateral_force, point.kappa);
    const double Fx_limit = getAvailableLongitudinalTireForce(vertical_load, lateral_force, lateral_accel);

    const PowertrainOperatingPoint power_at_full = powertrain_model_->getOperatingPoint(velocity, gear, 1.0);
    const double max_drive_force = std::min(Fx_limit, power_at_full.wheel_force);
    const double max_brake_force = std::min(vehicle_.brake.max_brake_force, Fx_limit);

    const double net_force = vehicle_.mass.mass * ax;
    double drive_force = 0.0;
    double brake_force = 0.0;
    double throttle = 0.0;
    double brake = 0.0;

    if (net_force > 25.0) {
        drive_force = std::max(0.0, net_force + drag_force);
        throttle = (max_drive_force > 1.0) ? std::clamp(drive_force / max_drive_force, 0.0, 1.0) : 0.0;
    } else if (net_force < -25.0) {
        brake_force = std::max(0.0, -net_force - drag_force);
        brake = (max_brake_force > 1.0) ? std::clamp(brake_force / max_brake_force, 0.0, 1.0) : 0.0;
    } else {
        drive_force = std::max(0.0, drag_force);
        throttle = (max_drive_force > 1.0) ? std::clamp(drive_force / max_drive_force, 0.0, 0.25) : 0.0;
    }

    const double ratio = powertrain_model_->getOverallRatio(gear);
    double rpm = powertrain_model_->getRPM(velocity, gear);
    if (throttle > 0.05) {
        rpm = std::max(rpm, vehicle_.powertrain.min_rpm);
    }

    const double engine_torque = (throttle > 0.0 && ratio > 0.0 && vehicle_.powertrain.drivetrain_efficiency > 0.0)
        ? (drive_force * vehicle_.tire.tire_radius) / (ratio * vehicle_.powertrain.drivetrain_efficiency)
        : 0.0;

    state.s = point.s;
    state.n = point.n;
    state.x = point.x;
    state.y = point.y;
    state.z = point.z;
    state.v = velocity;
    state.v_kmh = velocity * 3.6;
    state.ax = ax;
    state.ay = velocity * velocity * point.kappa;
    state.az = downforce / vehicle_.mass.mass;
    state.curvature = point.kappa;
    state.radius = (std::abs(point.kappa) > 1e-9) ? (1.0 / std::abs(point.kappa)) : 1e9;
    state.banking_angle = point.banking;
    state.drag_force = drag_force;
    state.downforce = downforce;
    state.vertical_load = vertical_load;
    state.throttle = throttle;
    state.brake = brake;
    state.steering_angle = std::atan(vehicle_.mass.wheelbase * point.kappa);
    state.gear = gear;
    state.rpm = rpm;
    state.engine_torque = engine_torque;
    state.wheel_force = drive_force;
    state.tire_force_x = drive_force - brake_force;
    state.tire_force_y = signed_lateral_force;
    state.timestamp = time;
    state.updateGForces();

    return state;
}

void QuasiSteadyStateSolver::exportGGVToFile(const std::string& filename) const {
    if (!ggv_->isGenerated()) {
        throw std::runtime_error("GGV diagram has not been generated - run solve() first");
    }

    ggv_->exportToCSV(filename);
    std::cout << "GGV diagram exported to CSV: " << filename << std::endl;
}

} // namespace LapTimeSim
