#pragma once

#include "data/VehicleParams.h"
#include "physics/AerodynamicsModel.h"
#include "physics/TireModel.h"
#include "physics/PowertrainModel.h"
#include <vector>
#include <map>

namespace LapTimeSim {

/**
 * @brief Stores acceleration limits at a specific velocity and lateral acceleration
 */
struct GGVPoint {
    double velocity;           // m/s
    double ay_lateral;         // Lateral acceleration (m/s²)
    double ax_max_accel;       // Maximum longitudinal acceleration (m/s²)
    double ax_max_brake;       // Maximum longitudinal deceleration (m/s², negative)
    
    GGVPoint() : velocity(0), ay_lateral(0), ax_max_accel(0), ax_max_brake(0) {}
};

/**
 * @brief Generates and stores the GGV (G-G-Velocity) diagram
 * 
 * The GGV diagram maps the maximum achievable accelerations for every
 * combination of velocity and lateral acceleration. It represents the
 * performance envelope of the vehicle.
 * 
 * Structure: ggv_map[velocity_index][ay_index] = {ax_max, ax_min}
 */
class GGVGenerator {
public:
    /**
     * @brief Constructor
     * @param vehicle Vehicle parameters
     */
    explicit GGVGenerator(const VehicleParams& vehicle);
    ~GGVGenerator() = default;
    
    /**
     * @brief Generate the complete GGV diagram
     * @param v_min Minimum velocity to analyze (m/s)
     * @param v_max Maximum velocity to analyze (m/s)
     * @param v_step Velocity step size (m/s)
     * @param ay_max Maximum lateral acceleration to consider (m/s²)
     * @param ay_step Lateral acceleration step size (m/s²)
     */
    void generate(double v_min, double v_max, double v_step,
                  double ay_max, double ay_step);
    
    /**
     * @brief Get maximum acceleration at specific velocity and lateral acceleration
     * Uses interpolation for values between grid points
     * @param v Velocity (m/s)
     * @param ay Lateral acceleration (m/s²)
     * @return Maximum longitudinal acceleration (m/s²)
     */
    double getMaxAcceleration(double v, double ay) const;
    
    /**
     * @brief Get maximum braking deceleration at specific velocity and lateral acceleration
     * @param v Velocity (m/s)
     * @param ay Lateral acceleration (m/s²)
     * @return Maximum braking deceleration (m/s², negative value)
     */
    double getMaxBraking(double v, double ay) const;
    
    /**
     * @brief Check if GGV diagram has been generated
     */
    bool isGenerated() const { return generated_; }
    
    /**
     * @brief Get all GGV points (for analysis/plotting)
     */
    const std::vector<GGVPoint>& getPoints() const { return ggv_points_; }
    
    /**
     * @brief Export GGV diagram to CSV file
     * @param filename Output file path
     */
    void exportToCSV(const std::string& filename) const;

private:
    VehicleParams vehicle_;
    AerodynamicsModel aero_model_;
    TireModel tire_model_;
    PowertrainModel powertrain_model_;
    
    std::vector<GGVPoint> ggv_points_;
    bool generated_;
    
    // Grid parameters
    double v_min_, v_max_, v_step_;
    double ay_min_, ay_max_, ay_step_;
    
    /**
     * @brief Calculate maximum acceleration for a specific (v, ay) point
     * @param v Velocity (m/s)
     * @param ay Lateral acceleration magnitude (m/s²)
     * @return Maximum longitudinal acceleration (m/s²)
     */
    double calculateMaxAcceleration(double v, double ay) const;
    
    /**
     * @brief Calculate maximum braking for a specific (v, ay) point
     * @param v Velocity (m/s)
     * @param ay Lateral acceleration magnitude (m/s²)
     * @return Maximum braking deceleration (m/s², negative)
     */
    double calculateMaxBraking(double v, double ay) const;
    
    /**
     * @brief Find GGV point by binary search
     * @param v Velocity
     * @param ay Lateral acceleration
     * @return Index in ggv_points_ vector, or -1 if not found
     */
    int findPointIndex(double v, double ay) const;
    
    /**
     * @brief Interpolate between GGV points
     */
    double interpolateAcceleration(double v, double ay) const;
    double interpolateBraking(double v, double ay) const;
};

} // namespace LapTimeSim


