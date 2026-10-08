#include "solver/RacingLine.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace LapTimeSim {

namespace {

/// Solves a cyclic tridiagonal system a[i] x[i-1] + b[i] x[i] + c[i] x[i+1] = d[i] (indices mod n).
std::vector<double> solveCyclicTridiagonal(const std::vector<double>& a, const std::vector<double>& b,
                                           const std::vector<double>& c, const std::vector<double>& d) {
    const size_t n = b.size();
    if (n == 1) {
        return {d[0] / (a[0] + b[0] + c[0])};
    }
    if (n == 2) {
        const double a00 = b[0], a01 = a[0] + c[0];
        const double a10 = a[1] + c[1], a11 = b[1];
        const double det = a00 * a11 - a01 * a10;
        return {(d[0] * a11 - a01 * d[1]) / det, (a00 * d[1] - a10 * d[0]) / det};
    }

    const double alpha = c[n - 1];  // bottom-left corner
    const double beta = a[0];       // top-right corner
    const double gamma = -b[0];
    std::vector<double> bb = b;
    bb[0] = b[0] - gamma;
    bb[n - 1] = b[n - 1] - alpha * beta / gamma;

    auto thomas = [&](const std::vector<double>& rhs) {
        std::vector<double> cp(n), dp(n), x(n);
        cp[0] = c[0] / bb[0];
        dp[0] = rhs[0] / bb[0];
        for (size_t i = 1; i < n; ++i) {
            const double m = bb[i] - a[i] * cp[i - 1];
            cp[i] = (i + 1 < n) ? c[i] / m : 0.0;
            dp[i] = (rhs[i] - a[i] * dp[i - 1]) / m;
        }
        x[n - 1] = dp[n - 1];
        for (size_t i = n - 1; i-- > 0;) {
            x[i] = dp[i] - cp[i] * x[i + 1];
        }
        return x;
    };

    std::vector<double> x = thomas(d);
    std::vector<double> u(n, 0.0);
    u[0] = gamma;
    u[n - 1] = alpha;
    const std::vector<double> z = thomas(u);
    const double fact = (x[0] + beta * x[n - 1] / gamma) / (1.0 + z[0] + beta * z[n - 1] / gamma);
    for (size_t i = 0; i < n; ++i) {
        x[i] -= fact * z[i];
    }
    return x;
}

/// Periodic (closed) cubic interpolating spline on non-uniform knots.
class PeriodicSpline {
public:
    PeriodicSpline(const std::vector<double>& t, const std::vector<double>& y, double period)
        : t_(t), y_(y), period_(period) {
        const size_t n = t_.size();
        h_.resize(n);
        for (size_t i = 0; i < n; ++i) {
            const double next = (i + 1 < n) ? t_[i + 1] : period_ + t_[0];
            h_[i] = std::max(1e-9, next - t_[i]);
        }
        std::vector<double> a(n), b(n), c(n), d(n);
        for (size_t i = 0; i < n; ++i) {
            const size_t ip = (i + 1) % n;
            const size_t im = (i + n - 1) % n;
            a[i] = h_[im];
            b[i] = 2.0 * (h_[im] + h_[i]);
            c[i] = h_[i];
            d[i] = 6.0 * ((y_[ip] - y_[i]) / h_[i] - (y_[i] - y_[im]) / h_[im]);
        }
        m_ = solveCyclicTridiagonal(a, b, c, d);
    }

    void eval(double t, double& y, double& dy, double& ddy) const {
        double u = 0.0;
        const size_t i = locate(t, u);
        const size_t ip = (i + 1) % t_.size();
        const double h = h_[i];
        const double w = h - u;
        const double ci = y_[i] / h - m_[i] * h / 6.0;
        const double cp = y_[ip] / h - m_[ip] * h / 6.0;
        y = m_[i] * w * w * w / (6.0 * h) + m_[ip] * u * u * u / (6.0 * h) + ci * w + cp * u;
        dy = -m_[i] * w * w / (2.0 * h) + m_[ip] * u * u / (2.0 * h) - ci + cp;
        ddy = m_[i] * w / h + m_[ip] * u / h;
    }

    double value(double t) const {
        double y = 0.0, dy = 0.0, ddy = 0.0;
        eval(t, y, dy, ddy);
        return y;
    }

    double period() const { return period_; }
    const std::vector<double>& knots() const { return t_; }
    const std::vector<double>& steps() const { return h_; }

    /// Returns the knot interval containing t and the local offset u.
    size_t locate(double t, double& u) const {
        t = std::fmod(t - t_[0], period_);
        if (t < 0.0) {
            t += period_;
        }
        t += t_[0];
        const auto it = std::upper_bound(t_.begin(), t_.end(), t);
        size_t i = (it == t_.begin()) ? 0 : static_cast<size_t>(std::distance(t_.begin(), it) - 1);
        i = std::min(i, t_.size() - 1);
        u = std::clamp(t - t_[i], 0.0, h_[i]);
        return i;
    }

private:
    std::vector<double> t_, y_, h_, m_;
    double period_;
};

/// Arc-length table of a planar periodic spline curve: maps arc length -> curve parameter.
struct ArcTable {
    std::vector<double> t;
    std::vector<double> s;
    double length = 0.0;

    ArcTable(const PeriodicSpline& sx, const PeriodicSpline& sy, int subdivisions) {
        const auto& knots = sx.knots();
        const auto& steps = sx.steps();
        double px = sx.value(knots[0]);
        double py = sy.value(knots[0]);
        double acc = 0.0;
        t.push_back(knots[0]);
        s.push_back(0.0);
        for (size_t i = 0; i < knots.size(); ++i) {
            for (int j = 1; j <= subdivisions; ++j) {
                const double tt = knots[i] + steps[i] * static_cast<double>(j) / subdivisions;
                const double x = sx.value(tt);
                const double y = sy.value(tt);
                acc += std::hypot(x - px, y - py);
                px = x;
                py = y;
                t.push_back(tt);
                s.push_back(acc);
            }
        }
        length = acc;
    }

    double parameterAt(double arc) const {
        arc = std::fmod(arc, length);
        if (arc < 0.0) {
            arc += length;
        }
        const auto it = std::upper_bound(s.begin(), s.end(), arc);
        const size_t hi = std::min(static_cast<size_t>(std::distance(s.begin(), it)), s.size() - 1);
        const size_t lo = (hi == 0) ? 0 : hi - 1;
        const double span = s[hi] - s[lo];
        const double f = (span > 1e-12) ? (arc - s[lo]) / span : 0.0;
        return t[lo] + f * (t[hi] - t[lo]);
    }
};

/// Linear interpolation of a per-knot attribute at curve parameter t (periodic).
double interpolateAttribute(const PeriodicSpline& spline, const std::vector<double>& values, double t) {
    double u = 0.0;
    const size_t i = spline.locate(t, u);
    const size_t ip = (i + 1) % values.size();
    const double f = u / spline.steps()[i];
    return values[i] * (1.0 - f) + values[ip] * f;
}

std::vector<double> gaussianSmoothCircular(const std::vector<double>& values, double sigma_samples) {
    if (sigma_samples <= 1e-6 || values.size() < 3) {
        return values;
    }
    const long long n = static_cast<long long>(values.size());
    const long long radius = std::max<long long>(1, static_cast<long long>(std::ceil(3.0 * sigma_samples)));
    std::vector<double> weights(static_cast<size_t>(2 * radius + 1));
    double total = 0.0;
    for (long long k = -radius; k <= radius; ++k) {
        const double w = std::exp(-0.5 * (k / sigma_samples) * (k / sigma_samples));
        weights[static_cast<size_t>(k + radius)] = w;
        total += w;
    }
    std::vector<double> out(values.size(), 0.0);
    for (long long i = 0; i < n; ++i) {
        double acc = 0.0;
        for (long long k = -radius; k <= radius; ++k) {
            long long j = (i + k) % n;
            if (j < 0) {
                j += n;
            }
            acc += weights[static_cast<size_t>(k + radius)] * values[static_cast<size_t>(j)];
        }
        out[static_cast<size_t>(i)] = acc / total;
    }
    return out;
}

/**
 * Multi-resolution projected SOR solver for the minimum-curvature line.
 *
 * Nodes P(j) = C(j) + n(j) N(j) slide along the centreline normals N(j) within
 * lo(j) <= n(j) <= hi(j). The objective approximates  integral(kappa^2 ds) + lambda * length:
 *
 *   J = sum_j w(j) * (T(j) . D(j))^2 + lambda * sum_j |P(j+1) - P(j)|^2
 *   D(j) = P(j-1) - 2 P(j) + P(j+1),   kappa(j) ~ T(j).D(j) / l(j)^2,   w(j) = (h / l(j))^3
 *
 * where T(j) is the unit normal of the current line and l(j) its local node spacing.
 * Normals and weights are frozen during a block of sweeps and refreshed between blocks
 * (iteratively reweighted least squares), which removes the bias of the plain
 * second-difference objective towards short, tight lines. Each coordinate update is the
 * exact 1-D minimiser of the frozen quadratic, followed by projection onto the bounds.
 */
int solveMinimumCurvature(const std::vector<double>& cx, const std::vector<double>& cy,
                          const std::vector<double>& nx, const std::vector<double>& ny,
                          const std::vector<double>& lo, const std::vector<double>& hi,
                          std::vector<double>& n, int max_sweeps, double tolerance, double& residual,
                          const std::vector<double>& node_length_weight) {
    const size_t N = cx.size();
    std::vector<size_t> strides;
    for (size_t k = 64; k >= 1; k /= 2) {
        if (N % k == 0 && N / k >= 24) {
            strides.push_back(k);
        }
        if (k == 1) {
            break;
        }
    }

    int total_sweeps = 0;
    residual = 0.0;
    for (const size_t k : strides) {
        const size_t M = N / k;
        std::vector<double> sx(M), sy(M), snx(M), sny(M), slo(M), shi(M), sn(M), px(M), py(M);
        std::vector<double> lam(M, 0.0);
        bool any_length = false;
        for (size_t j = 0; j < M; ++j) {
            const size_t idx = j * k;
            sx[j] = cx[idx];
            sy[j] = cy[idx];
            snx[j] = nx[idx];
            sny[j] = ny[idx];
            slo[j] = lo[idx];
            shi[j] = hi[idx];
            sn[j] = std::clamp(n[idx], slo[j], shi[j]);
            px[j] = sx[j] + sn[j] * snx[j];
            py[j] = sy[j] + sn[j] * sny[j];
            lam[j] = node_length_weight.empty() ? 0.0 : node_length_weight[idx];
            any_length = any_length || lam[j] > 0.0;
        }
        // weight of the segment between node j and j+1
        auto seg_weight = [&](size_t j) { return 0.5 * (lam[j] + lam[(j + 1) % M]); };

        // Curvature term of node i:  r_i = e_i / l_i^1.5,  r_i^2 = kappa_i^2 * l_i
        //   e_i = T_i . D_i  (D_i = P(i-1) - 2 P(i) + P(i+1), T_i = unit normal of the chord P(i+1) - P(i-1))
        //   l_i = |P(i+1) - P(i-1)| / 2 (local node spacing),  kappa_i = e_i / l_i^2
        struct Term {
            double r, e, l, ux, uy, tx, ty, du;  // du = u . D (tangential part of D)
        };
        auto term = [&](size_t i) {
            const size_t a = (i + M - 1) % M;
            const size_t c = (i + 1) % M;
            const double chx = px[c] - px[a];
            const double chy = py[c] - py[a];
            const double cl = std::max(1e-9, std::hypot(chx, chy));
            Term t;
            t.ux = chx / cl;
            t.uy = chy / cl;
            t.tx = -t.uy;
            t.ty = t.ux;
            const double dx = px[a] - 2.0 * px[i] + px[c];
            const double dy = py[a] - 2.0 * py[i] + py[c];
            t.e = t.tx * dx + t.ty * dy;
            t.du = t.ux * dx + t.uy * dy;
            t.l = 0.5 * cl;
            t.r = t.e / (t.l * std::sqrt(t.l));
            return t;
        };
        auto length_cost = [&](size_t j) {
            if (!any_length) {
                return 0.0;
            }
            const size_t jm = (j + M - 1) % M;
            const size_t jp = (j + 1) % M;
            const double ax = px[j] - px[jm], ay = py[j] - py[jm];
            const double bx = px[jp] - px[j], by = py[jp] - py[j];
            return seg_weight(jm) * (ax * ax + ay * ay) + seg_weight(j) * (bx * bx + by * by);
        };
        // Derivative of r_i (i = j-1 or j+1) w.r.t. the offset of node j, including the change of the
        // node spacing l_i and the rotation of the chord normal T_i (exact gradient of the objective).
        auto neighbour_derivative = [](const Term& t, double nx_j, double ny_j, double side) {
            // side = +1: node j is the chord end (i = j-1), -1: node j is the chord start (i = j+1)
            const double cross = nx_j * t.uy - ny_j * t.ux;
            const double de = (t.tx * nx_j + t.ty * ny_j) + side * cross * t.du / (2.0 * t.l);
            const double dl = side * 0.5 * (t.ux * nx_j + t.uy * ny_j);
            const double l15 = t.l * std::sqrt(t.l);
            return de / l15 - 1.5 * t.e * dl / (l15 * t.l);
        };

        const double omega = 1.5;
        const double level_tol = tolerance * static_cast<double>(k);
        double max_change = 0.0;
        for (int sweep = 0; sweep < max_sweeps; ++sweep) {
            max_change = 0.0;
            for (size_t j = 0; j < M; ++j) {
                const size_t jm = (j + M - 1) % M;
                const size_t jp = (j + 1) % M;
                const double nxj = snx[j];
                const double nyj = sny[j];
                const Term tm = term(jm);
                const Term t0 = term(j);
                const Term tp = term(jp);

                const double d0 = -2.0 * (t0.tx * nxj + t0.ty * nyj) / (t0.l * std::sqrt(t0.l));
                const double dm = neighbour_derivative(tm, nxj, nyj, +1.0);
                const double dp = neighbour_derivative(tp, nxj, nyj, -1.0);
                double grad = tm.r * dm + t0.r * d0 + tp.r * dp;  // d(J/2)/dn_j
                double hess = dm * dm + d0 * d0 + dp * dp;        // Gauss-Newton curvature
                if (any_length) {
                    // J/2 += 0.5 * (la |P_j - P_j-1|^2 + lb |P_j+1 - P_j|^2)
                    const double la = seg_weight(jm);
                    const double lb = seg_weight(j);
                    grad += la * ((px[j] - px[jm]) * nxj + (py[j] - py[jm]) * nyj) -
                            lb * ((px[jp] - px[j]) * nxj + (py[jp] - py[j]) * nyj);
                    hess += la + lb;
                }
                if (hess <= 1e-18) {
                    continue;
                }

                // Projected Gauss-Newton step with over-relaxation and a monotone safeguard.
                const double cost_old = tm.r * tm.r + t0.r * t0.r + tp.r * tp.r + length_cost(j);
                const double n_old = sn[j];
                double step = -omega * grad / hess;
                double accepted = 0.0;
                for (int attempt = 0; attempt < 5; ++attempt) {
                    const double n_try = std::clamp(n_old + step, slo[j], shi[j]);
                    if (n_try == n_old) {
                        break;
                    }
                    px[j] = sx[j] + n_try * nxj;
                    py[j] = sy[j] + n_try * nyj;
                    const Term am = term(jm);
                    const Term a0 = term(j);
                    const Term ap = term(jp);
                    const double cost_new = am.r * am.r + a0.r * a0.r + ap.r * ap.r + length_cost(j);
                    if (cost_new <= cost_old) {
                        accepted = n_try - n_old;
                        sn[j] = n_try;
                        break;
                    }
                    step *= 0.5;
                }
                if (accepted == 0.0) {
                    px[j] = sx[j] + n_old * nxj;
                    py[j] = sy[j] + n_old * nyj;
                }
                max_change = std::max(max_change, std::abs(accepted));
            }
            ++total_sweeps;
            if (max_change < level_tol) {
                break;
            }
        }
        residual = max_change;

        for (size_t j = 0; j < M; ++j) {
            n[j * k] = sn[j];
        }
        if (k > 1) {
            for (size_t j = 0; j < M; ++j) {
                const double a = sn[j];
                const double b = sn[(j + 1) % M];
                for (size_t q = 1; q < k; ++q) {
                    const size_t idx = j * k + q;
                    const double f = static_cast<double>(q) / static_cast<double>(k);
                    n[idx] = std::clamp(a * (1.0 - f) + b * f, lo[idx], hi[idx]);
                }
            }
        }
    }
    return total_sweeps;
}

double linearAt(const std::vector<double>& knots, double period, const std::vector<double>& values, double t) {
    // knots start at 0 and increase; periodic
    t = std::fmod(t, period);
    if (t < 0.0) {
        t += period;
    }
    const auto it = std::upper_bound(knots.begin(), knots.end(), t);
    const size_t i = (it == knots.begin()) ? 0 : static_cast<size_t>(std::distance(knots.begin(), it) - 1);
    const size_t ip = (i + 1) % knots.size();
    const double t_next = (ip == 0) ? period : knots[ip];
    const double span = t_next - knots[i];
    const double f = (span > 1e-12) ? std::clamp((t - knots[i]) / span, 0.0, 1.0) : 0.0;
    return values[i] * (1.0 - f) + values[ip] * f;
}

} // namespace

LineReference RacingLine::prepare(const TrackData& track, const LineOptions& options) {
    for (double value : {options.optimisation_step, options.output_step, options.tolerance}) {
        if (!std::isfinite(value) || value <= 0.0) {
            throw std::invalid_argument("Line spacing and tolerance must be positive and finite");
        }
    }
    for (double value : {options.edge_margin, options.curvature_smoothing, options.reference_smoothing,
                         options.elevation_smoothing, options.max_vertical_curvature, options.length_weight}) {
        if (!std::isfinite(value)) throw std::invalid_argument("Line options must be finite");
    }
    const auto& raw = track.getPoints();
    std::vector<double> rx, ry, rz, rwl, rwr, rbank;
    for (const TrackPoint& p : raw) {
        if (!rx.empty() && std::hypot(p.x - rx.back(), p.y - ry.back()) < 1e-6) {
            continue;  // drop duplicated samples
        }
        rx.push_back(p.x);
        ry.push_back(p.y);
        rz.push_back(p.z);
        rwl.push_back(p.w_tr_left);
        rwr.push_back(p.w_tr_right);
        rbank.push_back(p.banking);
    }
    if (rx.size() >= 4 && std::hypot(rx.back() - rx.front(), ry.back() - ry.front()) < 1e-3) {
        rx.pop_back();
        ry.pop_back();
        rz.pop_back();
        rwl.pop_back();
        rwr.pop_back();
        rbank.pop_back();
    }
    if (rx.size() < 4) {
        throw std::runtime_error("Racing line needs at least 4 distinct track points");
    }

    // 1) Spline through the raw centreline (chord-length parameter).
    const size_t nr = rx.size();
    std::vector<double> tr(nr, 0.0);
    for (size_t i = 1; i < nr; ++i) {
        tr[i] = tr[i - 1] + std::hypot(rx[i] - rx[i - 1], ry[i] - ry[i - 1]);
    }
    const double period_raw = tr.back() + std::hypot(rx.front() - rx.back(), ry.front() - ry.back());
    const PeriodicSpline csx(tr, rx, period_raw);
    const PeriodicSpline csy(tr, ry, period_raw);
    const ArcTable carc(csx, csy, 16);
    const double center_length = carc.length;

    // 2) Equally spaced optimisation nodes on the centreline.
    const double step = std::max(0.5, options.optimisation_step);
    const size_t N = 64 * static_cast<size_t>(std::max(2L, std::lround(center_length / (step * 64.0))));
    std::vector<double> cx(N), cy(N), nx(N), ny(N), lo(N), hi(N), wl(N), wr(N), cz(N), cb(N), sc(N);
    for (size_t k = 0; k < N; ++k) {
        const double s = center_length * static_cast<double>(k) / static_cast<double>(N);
        const double t = carc.parameterAt(s);
        double x, dx, ddx, y, dy, ddy;
        csx.eval(t, x, dx, ddx);
        csy.eval(t, y, dy, ddy);
        const double norm = std::max(1e-12, std::hypot(dx, dy));
        cx[k] = x;
        cy[k] = y;
        nx[k] = -dy / norm;
        ny[k] = dx / norm;
        wl[k] = linearAt(tr, period_raw, rwl, t);
        wr[k] = linearAt(tr, period_raw, rwr, t);
        cz[k] = linearAt(tr, period_raw, rz, t);
        cb[k] = linearAt(tr, period_raw, rbank, t);
        sc[k] = s;
    }

    // 2b) Smooth reference line. Raw centrelines (e.g. digitised from satellite images) carry
    // local kinks; offsetting along their normals makes the inner offset curve fold over at
    // hairpins. The optimiser therefore works on a smoothed reference with re-projected widths.
    const double h_opt = center_length / static_cast<double>(N);
    if (options.mode != LineMode::Centerline && options.reference_smoothing > 0.0) {
        const double sigma = options.reference_smoothing / h_opt;
        const std::vector<double> sx_ref = gaussianSmoothCircular(cx, sigma);
        const std::vector<double> sy_ref = gaussianSmoothCircular(cy, sigma);
        for (size_t k = 0; k < N; ++k) {
            const size_t kp = (k + 1) % N;
            const size_t km = (k + N - 1) % N;
            const double tx = sx_ref[kp] - sx_ref[km];
            const double ty = sy_ref[kp] - sy_ref[km];
            const double norm = std::max(1e-12, std::hypot(tx, ty));
            const double nxk = -ty / norm;
            const double nyk = tx / norm;
            // signed lateral position of the raw centre point w.r.t. the smoothed reference
            const double delta = (cx[k] - sx_ref[k]) * nxk + (cy[k] - sy_ref[k]) * nyk;
            wl[k] += delta;
            wr[k] -= delta;
            cx[k] = sx_ref[k];
            cy[k] = sy_ref[k];
            nx[k] = nxk;
            ny[k] = nyk;
        }
    }

    // Lateral bounds: track limits minus the edge margin, and never so far towards the inside
    // of a bend that neighbouring normals cross (offset curve fold-over).
    for (size_t k = 0; k < N; ++k) {
        const size_t kp = (k + 1) % N;
        const size_t km = (k + N - 1) % N;
        const double heading_in = std::atan2(cy[k] - cy[km], cx[k] - cx[km]);
        const double heading_out = std::atan2(cy[kp] - cy[k], cx[kp] - cx[k]);
        double dpsi = heading_out - heading_in;
        while (dpsi > 3.14159265358979323846) dpsi -= 2.0 * 3.14159265358979323846;
        while (dpsi < -3.14159265358979323846) dpsi += 2.0 * 3.14159265358979323846;
        const double kappa_ref = dpsi / h_opt;

        hi[k] = wl[k] - options.edge_margin;
        lo[k] = -(wr[k] - options.edge_margin);
        if (kappa_ref > 1e-6) {
            hi[k] = std::min(hi[k], 0.7 / kappa_ref);
        } else if (kappa_ref < -1e-6) {
            lo[k] = std::max(lo[k], 0.7 / kappa_ref);
        }
        if (lo[k] > hi[k]) {
            const double mid = 0.5 * (lo[k] + hi[k]);
            lo[k] = mid;
            hi[k] = mid;
        }
    }

    LineReference ref;
    ref.cx = std::move(cx);
    ref.cy = std::move(cy);
    ref.nx = std::move(nx);
    ref.ny = std::move(ny);
    ref.lo = std::move(lo);
    ref.hi = std::move(hi);
    ref.wl = std::move(wl);
    ref.wr = std::move(wr);
    ref.cz = std::move(cz);
    ref.cb = std::move(cb);
    ref.sc = std::move(sc);
    ref.center_length = center_length;
    return ref;
}

std::vector<double> RacingLine::minimumCurvatureOffsets(const LineReference& ref, const LineOptions& options,
                                                        int& sweeps, double& residual) {
    const size_t N = ref.size();
    std::vector<double> offsets(N, 0.0);
    for (size_t k = 0; k < N; ++k) {
        offsets[k] = std::clamp(0.0, ref.lo[k], ref.hi[k]);
    }
    std::vector<double> node_weight;
    if (!options.length_weight_s.empty() && options.length_weight_s.size() == options.length_weight_value.size()) {
        node_weight.resize(N);
        for (size_t k = 0; k < N; ++k) {
            node_weight[k] = std::max(0.0, linearAt(options.length_weight_s, ref.center_length,
                                                    options.length_weight_value, ref.sc[k]));
        }
    } else if (options.length_weight > 0.0) {
        node_weight.assign(N, options.length_weight);
    }
    sweeps = solveMinimumCurvature(ref.cx, ref.cy, ref.nx, ref.ny, ref.lo, ref.hi, offsets, options.max_sweeps,
                                   options.tolerance, residual, node_weight);
    return offsets;
}

std::vector<double> RacingLine::offsetsFromProfile(const LineReference& ref, const std::vector<double>& s_center,
                                                   const std::vector<double>& offset) {
    if (s_center.size() != offset.size() || s_center.size() < 2) {
        throw std::runtime_error("A given racing line needs at least two (s, offset) samples");
    }
    std::vector<std::pair<double, double>> samples;
    for (size_t i = 0; i < s_center.size(); ++i) {
        if (!std::isfinite(s_center[i]) || !std::isfinite(offset[i])) {
            throw std::runtime_error("Given line samples must be finite");
        }
        double s = std::fmod(s_center[i], ref.center_length);
        if (s < 0.0) {
            s += ref.center_length;
        }
        samples.emplace_back(s, offset[i]);
    }
    std::sort(samples.begin(), samples.end());
    std::vector<double> knots, values;
    for (const auto& [s, n] : samples) {
        if (!knots.empty() && s - knots.back() < 1e-8) {
            throw std::runtime_error("Given line has duplicate centreline distances");
        }
        knots.push_back(s);
        values.push_back(n);
    }
    std::vector<double> out(ref.size());
    for (size_t k = 0; k < ref.size(); ++k) {
        // periodic linear interpolation; knots need not start at zero
        const double t = ref.sc[k];
        const auto it = std::upper_bound(knots.begin(), knots.end(), t);
        double s0, s1, n0, n1;
        if (it == knots.begin() || it == knots.end()) {
            s0 = knots.back() - (it == knots.begin() ? ref.center_length : 0.0);
            n0 = values.back();
            s1 = knots.front() + (it == knots.end() ? ref.center_length : 0.0);
            n1 = values.front();
        } else {
            const size_t i = static_cast<size_t>(std::distance(knots.begin(), it));
            s0 = knots[i - 1];
            n0 = values[i - 1];
            s1 = knots[i];
            n1 = values[i];
        }
        const double f = (s1 - s0 > 1e-9) ? std::clamp((t - s0) / (s1 - s0), 0.0, 1.0) : 0.0;
        out[k] = std::clamp(n0 + f * (n1 - n0), ref.lo[k], ref.hi[k]);
    }
    return out;
}

RacingLineResult RacingLine::fromOffsets(const LineReference& ref, const std::vector<double>& offsets,
                                         const LineOptions& options) {
    const size_t N = ref.size();
    const std::vector<double>& cx = ref.cx;
    const std::vector<double>& cy = ref.cy;
    const std::vector<double>& nx = ref.nx;
    const std::vector<double>& ny = ref.ny;
    const std::vector<double>& wl = ref.wl;
    const std::vector<double>& wr = ref.wr;
    const std::vector<double>& cz = ref.cz;
    const std::vector<double>& cb = ref.cb;
    const std::vector<double>& sc = ref.sc;
    const double center_length = ref.center_length;
    RacingLineResult result;
    result.centerline_length = center_length;
    result.node_s = ref.sc;
    result.node_offset = offsets;

    // 4) Spline through the line.
    std::vector<double> px(N), py(N), tl(N, 0.0);
    for (size_t k = 0; k < N; ++k) {
        px[k] = cx[k] + offsets[k] * nx[k];
        py[k] = cy[k] + offsets[k] * ny[k];
        if (k > 0) {
            tl[k] = tl[k - 1] + std::hypot(px[k] - px[k - 1], py[k] - py[k - 1]);
        }
    }
    const double period_line = tl.back() + std::hypot(px.front() - px.back(), py.front() - py.back());
    const PeriodicSpline lsx(tl, px, period_line);
    const PeriodicSpline lsy(tl, py, period_line);
    const ArcTable larc(lsx, lsy, 16);
    const double line_length = larc.length;

    // s_center must stay monotonic across the wrap for interpolation.
    std::vector<double> sc_unwrapped = sc;

    // 5) Resample by arc length and evaluate geometry analytically.
    const size_t M = std::max<size_t>(16, static_cast<size_t>(std::lround(line_length / std::max(0.1, options.output_step))));
    const double ds = line_length / static_cast<double>(M);
    result.points.resize(M);
    std::vector<double> kappa(M);
    for (size_t j = 0; j < M; ++j) {
        const double s = ds * static_cast<double>(j);
        const double t = larc.parameterAt(s);
        double x, dx, ddx, y, dy, ddy;
        lsx.eval(t, x, dx, ddx);
        lsy.eval(t, y, dy, ddy);
        const double speed_sq = std::max(1e-12, dx * dx + dy * dy);
        PathPoint& p = result.points[j];
        p.s = s;
        p.ds = ds;
        p.x = x;
        p.y = y;
        p.psi = std::atan2(dy, dx);
        kappa[j] = (dx * ddy - dy * ddx) / std::pow(speed_sq, 1.5);
        p.n = interpolateAttribute(lsx, offsets, t);
        p.w_left = interpolateAttribute(lsx, wl, t);
        p.w_right = interpolateAttribute(lsx, wr, t);
        p.z = interpolateAttribute(lsx, cz, t);
        p.banking = interpolateAttribute(lsx, cb, t);
        // centreline distance: interpolate without wrapping artefacts
        double u = 0.0;
        const size_t i = lsx.locate(t, u);
        const double f = u / lsx.steps()[i];
        const double s0 = sc_unwrapped[i];
        const double s1 = (i + 1 < N) ? sc_unwrapped[i + 1] : center_length;
        p.s_center = s0 + f * (s1 - s0);
    }

    const double sigma_samples = options.curvature_smoothing / ds;
    kappa = gaussianSmoothCircular(kappa, sigma_samples);

    // Elevation: smooth, then grade = dz/ds and vertical curvature = d2z/ds2 (central differences).
    std::vector<double> z(M);
    for (size_t j = 0; j < M; ++j) {
        z[j] = result.points[j].z;
    }
    z = gaussianSmoothCircular(z, options.elevation_smoothing / ds);
    for (size_t j = 0; j < M; ++j) {
        result.points[j].kappa = kappa[j];
        result.max_curvature = std::max(result.max_curvature, std::abs(kappa[j]));
        const size_t jp = (j + 1) % M;
        const size_t jm = (j + M - 1) % M;
        result.points[j].z = z[j];
        result.points[j].grade = std::atan2(z[jp] - z[jm], 2.0 * ds);
        const double kv = (z[jp] - 2.0 * z[j] + z[jm]) / (ds * ds);
        result.points[j].vertical_curvature =
            std::clamp(kv, -options.max_vertical_curvature, options.max_vertical_curvature);
    }
    result.length = line_length;
    return result;
}

RacingLineResult RacingLine::build(const TrackData& track, const LineOptions& options) {
    const LineReference ref = prepare(track, options);
    std::vector<double> offsets;
    int sweeps = 0;
    double residual = 0.0;
    switch (options.mode) {
    case LineMode::MinimumCurvature:
        offsets = minimumCurvatureOffsets(ref, options, sweeps, residual);
        break;
    case LineMode::Given:
        offsets = offsetsFromProfile(ref, options.given_s, options.given_offset);
        break;
    case LineMode::Centerline:
    default:
        offsets.resize(ref.size());
        for (size_t k = 0; k < ref.size(); ++k) {
            offsets[k] = std::clamp(0.0, ref.lo[k], ref.hi[k]);
        }
        break;
    }
    RacingLineResult result = fromOffsets(ref, offsets, options);
    result.sweeps = sweeps;
    result.residual = residual;
    return result;
}

} // namespace LapTimeSim
