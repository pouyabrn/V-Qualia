#include "solver/QuasiSteadyStateSolver.h"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <random>
#include <sstream>
#include <stdexcept>

namespace LapTimeSim {

QuasiSteadyStateSolver::QuasiSteadyStateSolver(const TrackData& track, const VehicleParams& vehicle)
    : QuasiSteadyStateSolver(track, vehicle, SolverOptions{}) {
}

QuasiSteadyStateSolver::QuasiSteadyStateSolver(const TrackData& track, const VehicleParams& vehicle,
                                               const SolverOptions& options)
    : track_(track), vehicle_(vehicle), options_(options) {
    if (!track_.isPreprocessed()) {
        throw std::runtime_error("Track must be preprocessed before solving");
    }
    if (!vehicle_.validate()) {
        throw std::runtime_error("Vehicle parameters are invalid");
    }
    model_ = std::make_unique<VehicleModel>(vehicle_);
}

void QuasiSteadyStateSolver::updateVehicle(const VehicleParams& vehicle) {
    // Construct first: an invalid update leaves the previous solver intact.
    auto model = std::make_unique<VehicleModel>(vehicle, true, model_.get());
    vehicle_ = vehicle;
    model_ = std::move(model);
    ggv_.reset();
    v_corner_.clear();
    v_.clear();
    gear_.clear();
    interrupted_.clear();
    ers_force_.clear();
    lap_time_ = 0.0;
    converged_ = false;
    iterations_used_ = 0;
    car_updated_ = true;
    // Keep the previous clip as a candidate only; energy feasibility must be
    // rechecked against the new car before using it as a bracket.
}

namespace {

/// Key identifying a racing line: track geometry + every option that changes the line.
std::string lineCacheKey(const TrackData& track, const LineOptions& line) {
    std::ostringstream key;
    // Ordered bitwise hash: a sum aliases permuted tracks and compensating edits.
    uint64_t hash = 14695981039346656037ULL;
    auto add = [&](double value) {
        uint64_t bits = 0;
        std::memcpy(&bits, &value, sizeof(bits));
        for (int byte = 0; byte < 8; ++byte) {
            hash ^= (bits >> (8 * byte)) & 0xff;
            hash *= 1099511628211ULL;
        }
    };
    for (const TrackPoint& p : track.getPoints()) {
        for (double value : {p.x, p.y, p.w_tr_left, p.w_tr_right, p.z, p.banking}) add(value);
    }
    for (const auto* values : {&line.length_weight_s, &line.length_weight_value, &line.given_s, &line.given_offset}) {
        add(static_cast<double>(values->size()));
        for (double value : *values) add(value);
    }
    key << std::setprecision(17) << "v5 n=" << track.getNumPoints() << " hash=" << hash
        << " mode=" << static_cast<int>(line.mode) << " margin=" << line.edge_margin
        << " step=" << line.optimisation_step << " out=" << line.output_step
        << " smooth=" << line.curvature_smoothing << " ref=" << line.reference_smoothing
        << " tol=" << line.tolerance << " sweeps=" << line.max_sweeps << " lw=" << line.length_weight
        << " zs=" << line.elevation_smoothing << " kvmax=" << line.max_vertical_curvature;
    double weight_hash = 0.0;
    for (size_t i = 0; i < line.length_weight_s.size() && i < line.length_weight_value.size(); ++i) {
        weight_hash += (static_cast<double>(i % 97) + 1.0) * line.length_weight_value[i] + 1e-3 * line.length_weight_s[i];
    }
    key << " lwp=" << line.length_weight_s.size() << ":" << weight_hash;
    double given_hash = 0.0;
    for (size_t i = 0; i < line.given_s.size() && i < line.given_offset.size(); ++i) {
        given_hash += (static_cast<double>(i % 89) + 1.0) * line.given_offset[i] + 1e-3 * line.given_s[i];
    }
    key << " given=" << line.given_s.size() << ":" << given_hash;
    return key.str();
}

bool loadLineCache(const std::string& file, const std::string& key, RacingLineResult& result) {
    std::ifstream in(file);
    if (!in.is_open()) {
        return false;
    }
    std::string header;
    std::getline(in, header);
    if (header != key) {
        return false;
    }
    size_t count = 0;
    in >> count >> result.length >> result.centerline_length >> result.sweeps >> result.residual >> result.max_curvature;
    if (!in || count < 16 || count > 2000000 || !std::isfinite(result.length) || result.length <= 0.0) {
        return false;
    }
    result.points.assign(count, PathPoint{});
    for (PathPoint& p : result.points) {
        in >> p.s >> p.ds >> p.x >> p.y >> p.z >> p.psi >> p.kappa >> p.n >> p.w_left >> p.w_right
           >> p.banking >> p.grade >> p.vertical_curvature >> p.s_center;
        for (double value : {p.s, p.ds, p.x, p.y, p.z, p.psi, p.kappa, p.n, p.w_left, p.w_right,
                             p.banking, p.grade, p.vertical_curvature, p.s_center}) {
            if (!std::isfinite(value)) return false;
        }
        if (p.ds <= 0.0) return false;
    }
    size_t nodes = 0;
    in >> nodes;
    if (!in || nodes < 4 || nodes > 2000000) return false;
    result.node_s.resize(nodes);
    result.node_offset.resize(nodes);
    for (size_t i = 0; i < nodes; ++i) {
        in >> result.node_s[i] >> result.node_offset[i];
        if (!std::isfinite(result.node_s[i]) || !std::isfinite(result.node_offset[i])) return false;
    }
    return static_cast<bool>(in);
}

void saveLineCache(const std::string& file, const std::string& key, const RacingLineResult& result) {
    const std::filesystem::path path(file);
    if (path.has_parent_path()) {
        std::filesystem::create_directories(path.parent_path());
    }
    // Write to a unique temporary file and rename it into place, so concurrent runs never see a
    // partially written cache.
    std::random_device rd;
    const std::string tmp = file + ".tmp" + std::to_string(rd()) + std::to_string(rd());
    {
        std::ofstream out(tmp);
        if (!out.is_open()) {
            return;  // cache is an optimisation only
        }
        out << key << '\n' << std::setprecision(17) << result.points.size() << ' ' << result.length << ' '
            << result.centerline_length << ' ' << result.sweeps << ' ' << result.residual << ' '
            << result.max_curvature << '\n';
        for (const PathPoint& p : result.points) {
            out << p.s << ' ' << p.ds << ' ' << p.x << ' ' << p.y << ' ' << p.z << ' ' << p.psi << ' ' << p.kappa
                << ' ' << p.n << ' ' << p.w_left << ' ' << p.w_right << ' ' << p.banking << ' ' << p.grade << ' '
                << p.vertical_curvature << ' ' << p.s_center << '\n';
        }
        out << result.node_s.size() << '\n';
        for (size_t i = 0; i < result.node_s.size(); ++i) {
            out << result.node_s[i] << ' ' << result.node_offset[i] << '\n';
        }
    }
    std::error_code ec;
    std::filesystem::rename(tmp, file, ec);
    if (ec) {
        std::filesystem::remove(tmp, ec);
    }
}

} // namespace

void QuasiSteadyStateSolver::buildPath() {
    LineOptions line = options_.line;
    if (!options_.override_edge_margin) {
        line.edge_margin = vehicle_.line.edge_margin;
    }
    RacingLineResult result;
    const std::string key = lineCacheKey(track_, line);
    if (!path_.empty() && key == path_key_) {
        stats_.line_cache_hit = true;
        return;
    }
    stats_.line_cache_hit = false;
    if (options_.line_cache.empty() || !loadLineCache(options_.line_cache, key, result)) {
        result = RacingLine::build(track_, line);
        if (!options_.line_cache.empty()) {
            saveLineCache(options_.line_cache, key, result);
        }
    }
    path_ = result.points;
    line_node_s_ = std::move(result.node_s);
    line_node_offset_ = std::move(result.node_offset);
    path_key_ = key;
    n_points_ = path_.size();
    stats_.line_length = result.length;
    stats_.centerline_length = result.centerline_length;
    stats_.line_sweeps = result.sweeps;
    stats_.max_path_curvature = result.max_curvature;

    segments_.assign(n_points_, Segment{});
    for (size_t i = 0; i < n_points_; ++i) {
        const size_t j = (i + 1) % n_points_;
        Segment& seg = segments_[i];
        seg.kappa = 0.5 * (path_[i].kappa + path_[j].kappa);
        seg.ds = path_[i].ds;
        seg.rc.banking = 0.5 * (path_[i].banking + path_[j].banking);
        seg.rc.grade = 0.5 * (path_[i].grade + path_[j].grade);
        seg.rc.vertical_curvature = 0.5 * (path_[i].vertical_curvature + path_[j].vertical_curvature);
        seg.rc.drs_open = false;
        seg.rc_drs = seg.rc;
    }
}

void QuasiSteadyStateSolver::detectDRSZones() {
    stats_.drs_zones = 0;
    stats_.drs_length = 0.0;
    for (Segment& seg : segments_) {
        seg.drs_zone = false;
        seg.rc_drs = seg.rc;
    }
    const DRSParams& drs = vehicle_.aero.drs;
    if (!options_.enable_drs || !drs.enabled || drs.drag_reduction <= 0.0) {
        return;
    }

    std::vector<char> in_zone(n_points_, 0);
    if (!drs.zones.empty()) {
        for (size_t i = 0; i < n_points_; ++i) {
            const double sc = path_[i].s_center;
            for (const auto& [start, end] : drs.zones) {
                const bool inside = (start <= end) ? (sc >= start && sc <= end) : (sc >= start || sc <= end);
                if (inside) {
                    in_zone[i] = 1;
                }
            }
        }
        stats_.drs_zones = static_cast<int>(drs.zones.size());
    } else {
        const double kappa_straight = 1.0 / std::max(1.0, drs.straight_radius);
        std::vector<char> straight(n_points_, 0);
        size_t first_curved = n_points_;
        for (size_t i = 0; i < n_points_; ++i) {
            straight[i] = std::abs(path_[i].kappa) < kappa_straight ? 1 : 0;
            if (!straight[i] && first_curved == n_points_) {
                first_curved = i;
            }
        }
        struct Run {
            size_t start;
            size_t count;
            double length;
        };
        std::vector<Run> runs;
        if (first_curved == n_points_) {
            runs.push_back({0, n_points_, stats_.line_length});
        } else {
            size_t k = 0;
            while (k < n_points_) {
                const size_t i = (first_curved + k) % n_points_;
                if (!straight[i]) {
                    ++k;
                    continue;
                }
                Run run{i, 0, 0.0};
                while (k < n_points_ && straight[(first_curved + k) % n_points_]) {
                    run.length += path_[(first_curved + k) % n_points_].ds;
                    ++run.count;
                    ++k;
                }
                runs.push_back(run);
            }
        }
        std::sort(runs.begin(), runs.end(), [](const Run& a, const Run& b) { return a.length > b.length; });
        for (const Run& run : runs) {
            if (stats_.drs_zones >= drs.max_zones || run.length < drs.min_zone_length) {
                break;
            }
            for (size_t c = 0; c < run.count; ++c) {
                in_zone[(run.start + c) % n_points_] = 1;
            }
            ++stats_.drs_zones;
        }
    }

    for (size_t i = 0; i < n_points_; ++i) {
        if (in_zone[i]) {
            segments_[i].drs_zone = true;
            segments_[i].rc_drs.drs_open = true;
            stats_.drs_length += segments_[i].ds;
        }
    }
}

void QuasiSteadyStateSolver::calculateCorneringLimit() {
    v_corner_.assign(n_points_, v_cap_);
    for (size_t i = 0; i < n_points_; ++i) {
        RoadConditions rc;
        rc.banking = path_[i].banking;
        rc.grade = path_[i].grade;
        rc.vertical_curvature = path_[i].vertical_curvature;
        v_corner_[i] = model_->maxCorneringSpeed(path_[i].kappa, rc, v_cap_);
    }
    seed_ = static_cast<size_t>(std::distance(v_corner_.begin(), std::min_element(v_corner_.begin(), v_corner_.end())));
}

QuasiSteadyStateSolver::Profile QuasiSteadyStateSolver::computeProfile(double v_clip, bool ers_on) const {
    const size_t N = n_points_;
    Profile P;
    P.v = v_corner_;
    P.gear.assign(N, 1);
    P.interrupted.assign(N, 0);
    P.ers_force.assign(N, 0.0);

    const double shift_time = vehicle_.powertrain.shift_time;

    // ---- Forward pass: maximum acceleration -------------------------------------------------
    int current_gear = model_->engine(P.v[seed_]).gear;
    double shift_timer = 0.0;
    for (size_t k = 0; k < N; ++k) {
        const size_t i = (seed_ + k) % N;
        const size_t j = (i + 1) % N;
        const Segment& seg = segments_[i];
        const double vi = P.v[i];

        // Gear choice with hysteresis: upshift when the next gear gives more drive force (or the
        // engine hits the limiter), downshift only for a clear gain. Prevents gear hunting when a
        // shift interruption briefly drops the speed back below the shift point.
        const PowertrainOperatingPoint best = model_->engine(vi);
        const PowertrainOperatingPoint in_gear = model_->engineInGear(vi, current_gear);
        if (best.gear > current_gear && (!in_gear.valid || best.wheel_force > in_gear.wheel_force)) {
            current_gear = best.gear;
            ++P.upshifts;
            if (shift_time > 0.0) {
                shift_timer = shift_time;
            }
        } else if (best.gear < current_gear &&
                   (!in_gear.valid || best.wheel_force > 1.03 * in_gear.wheel_force) &&
                   model_->rpmAt(vi, best.gear) < 0.97 * vehicle_.powertrain.max_rpm) {
            current_gear = best.gear;  // never drop into a gear that would sit on the limiter
        }
        P.gear[i] = current_gear;
        const bool interrupted = shift_timer > 0.0;
        P.interrupted[i] = interrupted ? 1 : 0;

        const int gear_now = current_gear;
        auto propulsion = [&](double v) {
            if (interrupted) {
                return 0.0;
            }
            const PowertrainOperatingPoint op = model_->engineInGear(v, gear_now);
            const PowertrainOperatingPoint usable = op.valid ? op : model_->engine(v);
            double force = usable.wheel_force;
            if (usable.valid && ers_on && v < v_clip) {
                force += model_->ersForce(v);
            }
            return force;
        };

        const RoadConditions& rc = seg.rc_drs;
        const double a1 = model_->maxAcceleration(vi, seg.kappa, rc, propulsion(vi), current_gear);
        const double v_mid = std::sqrt(std::max(1e-4, vi * vi + a1 * seg.ds));
        const double a2 = model_->maxAcceleration(v_mid, seg.kappa, rc, propulsion(v_mid), current_gear);
        const double v_next = std::sqrt(std::max(1e-4, vi * vi + 2.0 * a2 * seg.ds));
        if (v_next < P.v[j]) {
            P.v[j] = v_next;
        }
        if (shift_timer > 0.0) {
            shift_timer -= 2.0 * seg.ds / std::max(0.1, vi + P.v[j]);
        }
    }

    // ---- Backward pass: maximum braking -----------------------------------------------------
    for (size_t k = 0; k < N; ++k) {
        const size_t j = (seed_ + N - k) % N;
        const size_t i = (j + N - 1) % N;
        const Segment& seg = segments_[i];
        const double vj = P.v[j];
        const double d1 = model_->maxDeceleration(vj, seg.kappa, seg.rc);
        const double v_mid = std::sqrt(vj * vj + d1 * seg.ds);
        const double d2 = model_->maxDeceleration(v_mid, seg.kappa, seg.rc);
        const double v_prev = std::sqrt(vj * vj + 2.0 * d2 * seg.ds);
        if (v_prev < P.v[i]) {
            P.v[i] = v_prev;
        }
    }

    // ---- Lap time and energy accounting ------------------------------------------------------
    const double eta = vehicle_.powertrain.drivetrain_efficiency;
    for (size_t i = 0; i < N; ++i) {
        const size_t j = (i + 1) % N;
        const Segment& seg = segments_[i];
        const double vi = P.v[i];
        const double vj = P.v[j];
        const double dt = 2.0 * seg.ds / std::max(0.1, vi + vj);
        P.lap_time += dt;

        const double a = (vj * vj - vi * vi) / (2.0 * seg.ds);
        const double v_mid = 0.5 * (vi + vj);
        const bool accelerating = a > 0.0;
        const RoadConditions& rc = accelerating ? seg.rc_drs : seg.rc;
        const double resist = model_->resistance(v_mid, seg.kappa, rc);
        const double force_needed = model_->effectiveMassPowered(P.gear[i]) * a + resist;
        if (force_needed < -1.0 && a < 0.0) {
            const double brake_needed = model_->mass() * (-a) - resist;
            if (brake_needed > 0.02 * model_->mass() * model_->gravity()) {
                P.braking_time += dt;
            }
            continue;
        }
        if (force_needed <= 0.0) {
            continue;
        }
        const auto in_gear = model_->engineInGear(v_mid, P.gear[i]);
        const double engine_force = P.interrupted[i] ? 0.0 :
                                    (in_gear.valid ? in_gear.wheel_force : model_->engine(v_mid).wheel_force);
        const bool usable_gear = in_gear.valid || model_->engine(v_mid).valid;
        const double ers_available = (usable_gear && ers_on && !P.interrupted[i] && v_mid < v_clip) ? model_->ersForce(v_mid) : 0.0;
        const double ers_used = std::clamp(force_needed - engine_force, 0.0, ers_available);
        P.ers_force[i] = ers_used;
        P.ers_energy += ers_used * seg.ds / eta;
        const double available = engine_force + ers_available;
        if (available > 0.0 && force_needed >= 0.98 * available) {
            P.full_throttle_time += dt;
        }
    }
    return P;
}

double QuasiSteadyStateSolver::energyBudget(const Profile& profile) const {
    const ERSParams& ers = vehicle_.powertrain.ers;
    if (ers.energy_per_lap <= 0.0) {
        return std::numeric_limits<double>::infinity();
    }
    return ers.energy_per_lap + ers.recovery_power * profile.full_throttle_time;
}

double QuasiSteadyStateSolver::solve(int max_iterations, double tolerance) {
    if (max_iterations < 1 || !std::isfinite(tolerance) || tolerance <= 0.0) {
        throw std::invalid_argument("Solver iterations and tolerance must be positive and finite");
    }
    const auto t0 = std::chrono::steady_clock::now();
    std::ostream& log = std::cout;

    buildPath();
    detectDRSZones();
    if (!stats_.line_cache_hit) have_clip_bracket_ = false;

    ers_active_ = options_.enable_ers && model_->hasERS();
    const bool drs_possible = stats_.drs_zones > 0;
    // updateVehicle invalidates corner limits. Geometry and road conditions
    // are independently guarded by the path key.
    if (!stats_.line_cache_hit || v_corner_.empty()) {
        v_cap_ = std::max(30.0, model_->topSpeed(drs_possible, ers_active_) * 1.03 + 1.0);
        calculateCorneringLimit();
    }

    if (options_.verbose) {
        log << "Initializing solver..." << std::endl;
        log << "  Centreline length: " << std::fixed << std::setprecision(1) << stats_.centerline_length
            << " m | driven path: " << stats_.line_length << " m | points: " << n_points_
            << " | ds: " << std::setprecision(3) << (n_points_ ? path_[0].ds : 0.0) << " m" << std::endl;
        log << "  Racing line: "
            << (options_.line.mode == LineMode::MinimumCurvature ? "minimum curvature" : "centreline")
            << " (" << stats_.line_sweeps << " sweeps), tightest radius "
            << std::setprecision(1) << (stats_.max_path_curvature > 0.0 ? 1.0 / stats_.max_path_curvature : 0.0)
            << " m" << std::endl;
        log << "  DRS zones: " << stats_.drs_zones << " (" << std::setprecision(0) << stats_.drs_length << " m)"
            << " | ERS: " << (ers_active_ ? "on" : "off")
            << " | speed cap: " << std::setprecision(1) << v_cap_ * 3.6 << " km/h" << std::endl;
        const auto [mn, mx] = std::minmax_element(v_corner_.begin(), v_corner_.end());
        log << "Cornering speed range: " << *mn * 3.6 << " to " << *mx * 3.6 << " km/h" << std::endl;
    }

    iterations_used_ = 1;
    v_clip_ = std::numeric_limits<double>::infinity();
    Profile best = computeProfile(v_clip_, ers_active_);
    double budget = energyBudget(best);
    converged_ = true;

    if (ers_active_ && best.ers_energy > budget) {
        // Energy limited: deploy only below a clipping speed, found by bisection.
        double lo = 0.0;
        double hi = v_cap_;
        Profile lo_profile = computeProfile(lo, ers_active_);
        Profile hi_profile = best;
        ++iterations_used_;
        converged_ = false;
        if (have_clip_bracket_) {
            // Re-evaluate both endpoints, never reuse a prior energy estimate.
            // An unchanged car uses its exact old bracket; a setup update gets
            // a wider initial bracket and falls back if it no longer encloses
            // the root. The final solution always stays on the feasible side.
            const double trial_lo = car_updated_ ? std::max(0.0, clip_lo_ - 2.0) : clip_lo_;
            const double trial_hi = car_updated_ ? std::min(v_cap_, clip_hi_ + 2.0) : clip_hi_;
            Profile lower = computeProfile(trial_lo, ers_active_);
            Profile upper = computeProfile(trial_hi, ers_active_);
            iterations_used_ += 2;
            if (lower.ers_energy <= energyBudget(lower) && upper.ers_energy > energyBudget(upper)) {
                lo = trial_lo;
                hi = trial_hi;
                lo_profile = std::move(lower);
                hi_profile = std::move(upper);
            }
        }
        for (int it = 0; it < std::max(1, max_iterations); ++it) {
            if (std::abs(lo_profile.lap_time - hi_profile.lap_time) < tolerance || hi - lo < 0.01) {
                converged_ = true;
                break;
            }
            const double mid = 0.5 * (lo + hi);
            Profile p = computeProfile(mid, ers_active_);
            ++iterations_used_;
            if (p.ers_energy <= energyBudget(p)) {
                lo = mid;
                lo_profile = std::move(p);
            } else {
                hi = mid;
                hi_profile = std::move(p);
            }
            if (std::abs(lo_profile.lap_time - hi_profile.lap_time) < tolerance || hi - lo < 0.01) {
                converged_ = true;
                break;
            }
            if (options_.verbose) {
                log << "Iteration " << iterations_used_ << ": ERS clip " << std::setprecision(1) << mid * 3.6
                    << " km/h, lap time = " << std::setprecision(4) << lo_profile.lap_time << " s" << std::endl;
            }
        }
        clip_lo_ = lo;
        clip_hi_ = hi;
        have_clip_bracket_ = converged_;
        v_clip_ = lo;
        best = std::move(lo_profile);
        budget = energyBudget(best);
    } else {
        have_clip_bracket_ = false;
    }
    car_updated_ = false;

    v_ = best.v;
    gear_ = best.gear;
    interrupted_ = best.interrupted;
    ers_force_ = best.ers_force;
    lap_time_ = best.lap_time;

    stats_.top_speed = *std::max_element(v_.begin(), v_.end());
    stats_.min_speed = *std::min_element(v_.begin(), v_.end());
    stats_.avg_speed = stats_.line_length / lap_time_;
    stats_.ers_energy_used = best.ers_energy;
    stats_.ers_energy_budget = budget;
    stats_.ers_clip_speed = v_clip_;
    stats_.full_throttle_fraction = best.full_throttle_time / lap_time_;
    stats_.braking_fraction = best.braking_time / lap_time_;
    stats_.upshifts = best.upshifts;

    stats_.solve_time_ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();

    if (options_.verbose) {
        log << std::setprecision(1)
            << "Top speed " << stats_.top_speed * 3.6 << " km/h | min speed " << stats_.min_speed * 3.6
            << " km/h | full throttle " << stats_.full_throttle_fraction * 100.0 << " %" << std::endl;
        if (ers_active_) {
            log << "ERS: used " << std::setprecision(2) << stats_.ers_energy_used / 1e6 << " MJ of "
                << (std::isfinite(budget) ? budget / 1e6 : 0.0) << (std::isfinite(budget) ? " MJ" : " (unlimited)");
            if (std::isfinite(v_clip_)) {
                log << ", clipping above " << std::setprecision(1) << v_clip_ * 3.6 << " km/h";
            }
            log << std::endl;
        }
        log << "Final lap time: " << std::setprecision(3) << lap_time_ << " seconds ("
            << std::setprecision(0) << stats_.solve_time_ms << " ms)" << std::endl;
    }
    return lap_time_;
}

LapResult QuasiSteadyStateSolver::getDetailedResult() const {
    if (v_.empty()) throw std::runtime_error("Run solve() after constructing or updating the vehicle");
    LapResult result;
    result.setLapTime(lap_time_);
    result.setTotalDistance(stats_.line_length);

    double time = 0.0;
    for (size_t i = 0; i < n_points_; ++i) {
        result.addState(createState(i, time));
        const size_t j = (i + 1) % n_points_;
        time += 2.0 * segments_[i].ds / std::max(0.1, v_[i] + v_[j]);
    }
    // Close the periodic lap explicitly so exported telemetry includes its final segment.
    auto closing_state = createState(0, lap_time_);
    closing_state.s = stats_.line_length;
    result.addState(closing_state);
    return result;
}

SimulationState QuasiSteadyStateSolver::createState(size_t index, double time) const {
    SimulationState state;
    const size_t next = (index + 1) % n_points_;
    const PathPoint& point = path_[index];
    const Segment& seg = segments_[index];
    const double m = model_->mass();

    const double v = v_[index];
    const double v_next = v_[next];
    const double ax = (v_next * v_next - v * v) / (2.0 * seg.ds);
    const bool accelerating = ax > 0.05;
    const bool braking = ax < -0.05;
    const bool drs_open = seg.drs_zone && accelerating;

    RoadConditions rc;
    rc.banking = point.banking;
    rc.grade = point.grade;
    rc.vertical_curvature = point.vertical_curvature;
    rc.drs_open = drs_open;

    const int gear = accelerating ? gear_[index] : model_->engine(v).gear;
    const double resist = model_->resistance(v, point.kappa, rc);
    const auto in_gear = model_->engineInGear(v, gear);
    const double engine_force = interrupted_[index] ? 0.0 :
                                (in_gear.valid ? in_gear.wheel_force : model_->engine(v).wheel_force);
    const double ers_force = ers_force_.empty() ? 0.0 : ers_force_[index];
    const double ers_available = (ers_active_ && !interrupted_[index] && v < v_clip_) ? model_->ersForce(v) : 0.0;

    ForceBreakdown fb;
    double drive_force = 0.0;
    double brake_force = 0.0;
    double throttle = 0.0;
    double brake = 0.0;
    double fx_capacity = 0.0;

    if (braking) {
        model_->maxDeceleration(v, point.kappa, rc, &fb);
        brake_force = std::max(0.0, m * (-ax) - resist);
        fx_capacity = fb.fx_tyre_limit;
        brake = (fb.fx_tyre_limit > 1.0) ? std::clamp(brake_force / fb.fx_tyre_limit, 0.0, 1.0) : 0.0;
    } else {
        model_->maxAcceleration(v, point.kappa, rc, engine_force + ers_available, gear, &fb);
        drive_force = std::max(0.0, model_->effectiveMassPowered(gear) * ax + resist);
        fx_capacity = fb.fx_tyre_limit;
        const double available = engine_force + ers_available;
        throttle = (available > 1.0) ? std::clamp(drive_force / available, 0.0, 1.0) : 0.0;
    }

    const double ratio = model_->overallRatio(gear);
    double rpm = model_->rpmAt(v, gear);
    if (throttle > 0.05) {
        rpm = std::max(rpm, vehicle_.powertrain.min_rpm);
    }
    const double engine_part = std::max(0.0, drive_force - ers_force);
    const double engine_torque = (ratio > 0.0) ? engine_part * vehicle_.tire.tire_radius /
                                                     (ratio * vehicle_.powertrain.drivetrain_efficiency)
                                               : 0.0;

    const double fx_tyre = drive_force - brake_force;
    const double fy_tyre = m * model_->lateralDemand(v, point.kappa, rc);
    const double p = vehicle_.tire.combined_exponent;
    const double ux = (fx_capacity > 1.0) ? std::abs(fx_tyre) / std::max(1.0, fb.fy_capacity * vehicle_.tire.mu_x / vehicle_.tire.mu_y) : 0.0;
    const double uy = fb.lateral_usage;
    const double usage = std::pow(std::pow(std::min(1.5, ux), p) + std::pow(std::min(1.5, uy), p), 1.0 / p);

    state.s = point.s;
    state.n = point.n;
    state.x = point.x;
    state.y = point.y;
    state.z = point.z;
    state.v = v;
    state.v_kmh = v * 3.6;
    state.ax = ax;
    state.ay = v * v * point.kappa;
    state.az = fb.downforce / m;
    state.curvature = point.kappa;
    state.radius = (std::abs(point.kappa) > 1e-9) ? (1.0 / std::abs(point.kappa)) : 1e9;
    state.banking_angle = point.banking;
    state.drag_force = fb.drag;
    state.downforce = fb.downforce;
    state.vertical_load = fb.fz_front + fb.fz_rear;
    state.throttle = throttle;
    state.brake = brake;
    state.steering_angle = std::atan(vehicle_.mass.wheelbase * point.kappa);
    state.gear = gear;
    state.rpm = rpm;
    state.engine_torque = engine_torque;
    state.wheel_force = drive_force;
    state.tire_force_x = fx_tyre;
    state.tire_force_y = std::copysign(fy_tyre, point.kappa);
    state.ers_power = ers_force * v / vehicle_.powertrain.drivetrain_efficiency;
    state.drs_open = drs_open;
    state.grip_usage = usage;
    state.fz_front = fb.fz_front;
    state.fz_rear = fb.fz_rear;
    state.timestamp = time;
    state.updateGForces();
    return state;
}

void QuasiSteadyStateSolver::exportGGVToFile(const std::string& filename, bool with_ers, bool drs_open) const {
    if (v_.empty()) {
        throw std::runtime_error("Run solve() before exporting a GGV diagram");
    }
    with_ers = with_ers && options_.enable_ers && model_->hasERS();
    drs_open = drs_open && options_.enable_drs && vehicle_.aero.drs.enabled;
    if (!ggv_ || ggv_->hasERS() != with_ers || ggv_->isDRSOpen() != drs_open) {
        ggv_ = std::make_unique<GGVGenerator>(vehicle_, with_ers, drs_open);
    }
    if (!ggv_->isGenerated()) {
        ggv_->generate(0.0, std::max(stats_.top_speed + 5.0, 50.0), 0.5, 60.0, 1.0);
    }
    ggv_->exportToCSV(filename);
    std::cout << "GGV diagram exported to CSV: " << filename << std::endl;
}

void QuasiSteadyStateSolver::exportRacingLine(const std::string& filename) const {
    const std::filesystem::path output_path(filename);
    if (output_path.has_parent_path()) {
        std::filesystem::create_directories(output_path.parent_path());
    }
    std::ofstream file(filename);
    if (!file.is_open()) {
        throw std::runtime_error("Failed to open file for writing: " + filename);
    }
    file << "s_m,x_m,y_m,n_m,w_left_m,w_right_m,kappa_inv_m,s_center_m,v_corner_kmh,v_kmh,drs_zone,"
         << "z_m,grade_pct,vertical_curvature_inv_m,banking_deg\n";
    file << std::fixed << std::setprecision(10);
    for (size_t i = 0; i < n_points_; ++i) {
        const PathPoint& p = path_[i];
        file << p.s << ',' << p.x << ',' << p.y << ',' << p.n << ',' << p.w_left << ',' << p.w_right << ','
             << p.kappa << ',' << p.s_center << ','
             << v_corner_[i] * 3.6 << ',' << (v_.empty() ? 0.0 : v_[i] * 3.6) << ','
             << (segments_[i].drs_zone ? 1 : 0) << ',' << p.z << ',' << std::tan(p.grade) * 100.0 << ','
             << p.vertical_curvature << ','
             << p.banking * 180.0 / 3.14159265358979323846 << '\n';
    }
    std::cout << "Racing line exported to CSV: " << filename << std::endl;
}

void QuasiSteadyStateSolver::exportLineNodes(const std::string& filename) const {
    if (line_node_s_.empty()) throw std::runtime_error("Run solve() before exporting line nodes");
    const std::filesystem::path path(filename);
    if (path.has_parent_path()) std::filesystem::create_directories(path.parent_path());
    std::ofstream file(filename);
    if (!file) throw std::runtime_error("Cannot write line nodes: " + filename);
    file << "s_center_m,n_m\n" << std::setprecision(17);
    for (size_t i = 0; i < line_node_s_.size(); ++i) {
        file << line_node_s_[i] << ',' << line_node_offset_[i] << '\n';
    }
}

} // namespace LapTimeSim
