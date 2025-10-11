#pragma once

#include <vector>
#include <string>
#include <cmath>

namespace LapTimeSim {

/**
 * @brief Represents a single point on the race track
 */
struct TrackPoint {
    // Raw input data
    double x;              // X coordinate in global frame (m)
    double y;              // Y coordinate in global frame (m)
    double z;              // Z coordinate (elevation) in global frame (m)
    double w_tr_left;      // Track width to the left (m)
    double w_tr_right;     // Track width to the right (m)
    double banking;        // Track banking angle (radians)
    
    // Computed properties
    double s;              // Arc length along track from start (m)
    double psi;            // Heading angle (radians)
    double kappa;          // Curvature = 1/R (1/m), positive = left turn
    double ds;             // Segment length to next point (m)
    
    TrackPoint() : x(0), y(0), z(0), w_tr_left(0), w_tr_right(0), 
                   banking(0), s(0), psi(0), kappa(0), ds(0) {}
};

/**
 * @brief Complete track representation with geometric properties
 */
class TrackData {
public:
    TrackData();
    ~TrackData() = default;
    
    /**
     * @brief Add a raw track point (before preprocessing)
     */
    void addPoint(double x, double y, double z, 
                  double w_left, double w_right, 
                  double banking);
    
    /**
     * @brief Preprocess track: compute arc length, heading, curvature
     * Must be called after all points are added
     */
    void preprocess();
    
    /**
     * @brief Get track point at specific index
     */
    const TrackPoint& getPoint(size_t index) const;
    
    /**
     * @brief Get track point interpolated at specific arc length
     */
    TrackPoint interpolateAt(double s) const;
    
    /**
     * @brief Get curvature at specific arc length (interpolated)
     */
    double getCurvatureAt(double s) const;
    
    /**
     * @brief Check if position (s, n) is within track boundaries
     * @param s Arc length position
     * @param n Lateral offset from centerline (positive = left)
     */
    bool isWithinBounds(double s, double n) const;
    
    /**
     * @brief Get total track length
     */
    double getTotalLength() const { return total_length_; }
    
    /**
     * @brief Get number of track points
     */
    size_t getNumPoints() const { return points_.size(); }
    
    /**
     * @brief Get all track points (const reference)
     */
    const std::vector<TrackPoint>& getPoints() const { return points_; }
    
    /**
     * @brief Get track name
     */
    const std::string& getName() const { return track_name_; }
    void setName(const std::string& name) { track_name_ = name; }
    
    /**
     * @brief Check if track has been preprocessed
     */
    bool isPreprocessed() const { return preprocessed_; }

private:
    std::vector<TrackPoint> points_;
    double total_length_;
    bool preprocessed_;
    std::string track_name_;
    
    /**
     * @brief Calculate arc length for all points
     */
    void calculateArcLength();
    
    /**
     * @brief Calculate heading angles using central differences
     */
    void calculateHeading();
    
    /**
     * @brief Calculate curvature using central differences
     */
    void calculateCurvature();
    
    /**
     * @brief Normalize angles to [-π, π]
     */
    static double normalizeAngle(double angle);
    
    /**
     * @brief Find index of point closest to given arc length
     */
    size_t findIndexAt(double s) const;
};

} // namespace LapTimeSim


