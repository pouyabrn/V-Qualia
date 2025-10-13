#include "data/TrackData.h"
#include <algorithm>
#include <stdexcept>
#include <cmath>

namespace LapTimeSim {

TrackData::TrackData() 
    : total_length_(0.0), preprocessed_(false), track_name_("Unnamed Track") {
}

void TrackData::addPoint(double x, double y, double z, 
                         double w_left, double w_right, 
                         double banking) {
    TrackPoint point;
    point.x = x;
    point.y = y;
    point.z = z;
    point.w_tr_left = w_left;
    point.w_tr_right = w_right;
    point.banking = banking;
    
    points_.push_back(point);
    preprocessed_ = false;  // Mark as needing preprocessing
}

void TrackData::preprocess() {
    if (points_.size() < 3) {
        throw std::runtime_error("Track must have at least 3 points for preprocessing");
    }
    
    calculateArcLength();
    calculateHeading();
    calculateCurvature();
    
    preprocessed_ = true;
}

void TrackData::calculateArcLength() {
    points_[0].s = 0.0;
    
    for (size_t i = 1; i < points_.size(); ++i) {
        double dx = points_[i].x - points_[i-1].x;
        double dy = points_[i].y - points_[i-1].y;
        double dz = points_[i].z - points_[i-1].z;
        
        double segment_length = std::sqrt(dx*dx + dy*dy + dz*dz);
        points_[i-1].ds = segment_length;
        points_[i].s = points_[i-1].s + segment_length;
    }
    
    // Close the loop: last point connects to first
    double dx = points_[0].x - points_.back().x;
    double dy = points_[0].y - points_.back().y;
    double dz = points_[0].z - points_.back().z;
    points_.back().ds = std::sqrt(dx*dx + dy*dy + dz*dz);
    
    total_length_ = points_.back().s + points_.back().ds;
}

void TrackData::calculateHeading() {
    size_t n = points_.size();
    
    for (size_t i = 0; i < n; ++i) {
        // Use central difference for better accuracy
        size_t i_prev = (i == 0) ? (n - 1) : (i - 1);
        size_t i_next = (i == n - 1) ? 0 : (i + 1);
        
        double dx = points_[i_next].x - points_[i_prev].x;
        double dy = points_[i_next].y - points_[i_prev].y;
        
        points_[i].psi = std::atan2(dy, dx);
    }
}

void TrackData::calculateCurvature() {
    size_t n = points_.size();
    
    for (size_t i = 0; i < n; ++i) {
        size_t i_prev = (i == 0) ? (n - 1) : (i - 1);
        size_t i_next = (i == n - 1) ? 0 : (i + 1);
        
        // Calculate change in heading angle
        double dpsi = normalizeAngle(points_[i_next].psi - points_[i_prev].psi);
        
        // Calculate arc length difference
        double ds = points_[i_next].s - points_[i_prev].s;
        if (ds < 0) {
            ds += total_length_;  // Handle wraparound at track start/end
        }
        
        // Curvature = dψ/ds
        points_[i].kappa = (ds > 1e-6) ? (dpsi / ds) : 0.0;
    }
}

double TrackData::normalizeAngle(double angle) {
    const double PI = 3.14159265358979323846;
    while (angle > PI) angle -= 2.0 * PI;
    while (angle < -PI) angle += 2.0 * PI;
    return angle;
}

const TrackPoint& TrackData::getPoint(size_t index) const {
    if (index >= points_.size()) {
        throw std::out_of_range("Track point index out of range");
    }
    return points_[index];
}

TrackPoint TrackData::interpolateAt(double s) const {
    if (!preprocessed_) {
        throw std::runtime_error("Track must be preprocessed before interpolation");
    }
    
    // Normalize s to be within track length
    while (s < 0) s += total_length_;
    while (s >= total_length_) s -= total_length_;
    
    // Find the two points to interpolate between
    size_t i = findIndexAt(s);
    size_t i_next = (i + 1) % points_.size();
    
    const TrackPoint& p1 = points_[i];
    const TrackPoint& p2 = points_[i_next];
    
    // Linear interpolation parameter
    double t = (p1.ds > 1e-6) ? ((s - p1.s) / p1.ds) : 0.0;
    t = std::max(0.0, std::min(1.0, t));  // Clamp to [0, 1]
    
    TrackPoint result;
    result.x = p1.x + t * (p2.x - p1.x);
    result.y = p1.y + t * (p2.y - p1.y);
    result.z = p1.z + t * (p2.z - p1.z);
    result.s = s;
    result.w_tr_left = p1.w_tr_left + t * (p2.w_tr_left - p1.w_tr_left);
    result.w_tr_right = p1.w_tr_right + t * (p2.w_tr_right - p1.w_tr_right);
    result.banking = p1.banking + t * (p2.banking - p1.banking);
    
    // For heading, need to handle angle wraparound
    double dpsi = normalizeAngle(p2.psi - p1.psi);
    result.psi = normalizeAngle(p1.psi + t * dpsi);
    
    result.kappa = p1.kappa + t * (p2.kappa - p1.kappa);
    result.ds = p1.ds;
    
    return result;
}

double TrackData::getCurvatureAt(double s) const {
    if (!preprocessed_) {
        throw std::runtime_error("Track must be preprocessed before querying curvature");
    }
    
    // Normalize s
    while (s < 0) s += total_length_;
    while (s >= total_length_) s -= total_length_;
    
    size_t i = findIndexAt(s);
    size_t i_next = (i + 1) % points_.size();
    
    const TrackPoint& p1 = points_[i];
    const TrackPoint& p2 = points_[i_next];
    
    double t = (p1.ds > 1e-6) ? ((s - p1.s) / p1.ds) : 0.0;
    t = std::max(0.0, std::min(1.0, t));
    
    return p1.kappa + t * (p2.kappa - p1.kappa);
}

bool TrackData::isWithinBounds(double s, double n) const {
    if (!preprocessed_) {
        throw std::runtime_error("Track must be preprocessed before boundary checking");
    }
    
    TrackPoint point = interpolateAt(s);
    
    // n > 0 means left of centerline
    // n < 0 means right of centerline
    return (n >= -point.w_tr_right && n <= point.w_tr_left);
}

size_t TrackData::findIndexAt(double s) const {
    // Binary search for efficiency
    size_t left = 0;
    size_t right = points_.size() - 1;
    
    while (left < right) {
        size_t mid = left + (right - left) / 2;
        
        if (points_[mid].s <= s) {
            left = mid + 1;
        } else {
            right = mid;
        }
    }
    
    // Return the index of the point at or just before s
    if (left > 0 && points_[left].s > s) {
        return left - 1;
    }
    return left;
}

} // namespace LapTimeSim


