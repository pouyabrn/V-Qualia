#pragma once

#include "data/TrackData.h"
#include <vector>

namespace LapTimeSim {

enum class LineMode {
    MinimumCurvature,  ///< Minimum-curvature line inside the track boundaries (default)
    Centerline,        ///< Drive the centreline (reference / debugging)
    Given              ///< Lateral offsets supplied by the user (e.g. an exported, edited or measured line)
};

struct LineOptions {
    LineMode mode = LineMode::MinimumCurvature;
    /// Given mode: lateral offsets (m, positive = left of the reference line) at centreline distances (m)
    std::vector<double> given_s;
    std::vector<double> given_offset;
    double edge_margin = 0.0;          ///< Distance kept between car centre and boundary (m)
    double optimisation_step = 2.0;    ///< Node spacing used by the line optimiser (m)
    double output_step = 1.0;          ///< Spacing of the working path handed to the speed solver (m)
    double curvature_smoothing = 1.0;  ///< Gaussian sigma applied to the final curvature (m), 0 = off
    int max_sweeps = 8000;             ///< Max Gauss-Seidel sweeps per resolution level
    double tolerance = 1e-5;           ///< Convergence threshold on lateral offset updates (m)
    double length_weight = 0.0;        ///< Optional blend towards the shortest path (0 = pure minimum curvature)
    /// Optional position-dependent length weight (overrides length_weight when non-empty), sampled on
    /// the centreline distance (sorted, periodic).
    std::vector<double> length_weight_s;
    std::vector<double> length_weight_value;
    double reference_smoothing = 7.0;  ///< Gaussian sigma (m) of the reference line used for the normals, 0 = raw
    double elevation_smoothing = 15.0; ///< Gaussian sigma (m) applied to elevation before grade / vertical curvature
    double max_vertical_curvature = 0.01; ///< Clamp for |d2z/ds2| (1/m), guards against noisy elevation data
};

/**
 * @brief One sample of the driven path.
 */
struct PathPoint {
    double s = 0.0;         ///< Distance along the driven path (m)
    double ds = 0.0;        ///< Length of the segment to the next point (m)
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;
    double psi = 0.0;       ///< Heading (rad)
    double kappa = 0.0;     ///< Path curvature (1/m), positive = left turn
    double n = 0.0;         ///< Lateral offset from the reference line (m), positive = left
    double w_left = 0.0;    ///< Reference-to-left-boundary distance (m)
    double w_right = 0.0;   ///< Reference-to-right-boundary distance (m)
    double banking = 0.0;   ///< rad
    double grade = 0.0;     ///< rad
    double vertical_curvature = 0.0;  ///< d2z/ds2 (1/m), positive = compression
    double s_center = 0.0;  ///< Matching distance along the centreline (m)
};

struct RacingLineResult {
    std::vector<PathPoint> points;
    std::vector<double> node_s, node_offset; ///< Exact reference-node profile for lossless export
    double length = 0.0;             ///< Length of the driven path (m)
    double centerline_length = 0.0;  ///< Length of the spline centreline (m)
    int sweeps = 0;                  ///< Total optimiser sweeps over all levels
    double residual = 0.0;           ///< Last max offset update of the finest level (m)
    double max_curvature = 0.0;      ///< Peak |kappa| on the driven path (1/m)
};

/**
 * @brief Equally spaced reference nodes on the (smoothed) centreline with their normals and the
 *        admissible lateral offset range. Any line is described by one offset per node.
 */
struct LineReference {
    std::vector<double> cx, cy;    ///< reference node positions (m)
    std::vector<double> nx, ny;    ///< unit normals (pointing left)
    std::vector<double> lo, hi;    ///< admissible offsets (m), lo <= n <= hi
    std::vector<double> wl, wr;    ///< reference-to-boundary distances (m)
    std::vector<double> cz, cb;    ///< elevation (m) and banking (rad)
    std::vector<double> sc;        ///< centreline distance of every node (m)
    double center_length = 0.0;    ///< centreline length (m)
    size_t size() const { return cx.size(); }
};

/**
 * @brief Builds the driven path from raw track data.
 *
 * The raw centreline is fitted with a periodic cubic spline and resampled by arc
 * length. In minimum-curvature mode the lateral offsets n_i of equally spaced
 * reference nodes are optimised to minimise integral(kappa^2 ds) subject to the
 * track-width bounds, using a multi-resolution projected Gauss-Newton solver with the
 * exact gradient of the discrete curvature. The resulting line is fitted again with a
 * periodic spline from which heading and curvature are evaluated analytically.
 */
class RacingLine {
public:
    /// Complete line for the requested mode.
    static RacingLineResult build(const TrackData& track, const LineOptions& options);

    static LineReference prepare(const TrackData& track, const LineOptions& options);
    static std::vector<double> minimumCurvatureOffsets(const LineReference& ref, const LineOptions& options,
                                                       int& sweeps, double& residual);
    /// Offsets at the reference nodes interpolated (periodic) from (centreline distance, offset) samples.
    static std::vector<double> offsetsFromProfile(const LineReference& ref, const std::vector<double>& s_center,
                                                  const std::vector<double>& offset);
    static RacingLineResult fromOffsets(const LineReference& ref, const std::vector<double>& offsets,
                                        const LineOptions& options);
};

} // namespace LapTimeSim
