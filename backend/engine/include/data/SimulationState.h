#pragma once

#include <vector>
#include <string>

namespace LapTimeSim {

/**
 * @brief Represents the vehicle's instantaneous state during simulation
 */
struct SimulationState {
    // Position
    double s;                   // Arc length along track (m)
    double n;                   // Lateral offset from centerline (m) - positive = left
    double x;                   // Global X position (m)
    double y;                   // Global Y position (m)
    double z;                   // Global Z position (elevation) (m)
    
    // Velocity and acceleration
    double v;                   // Velocity magnitude (m/s)
    double v_kmh;               // Velocity (km/h) for convenience
    double ax;                  // Longitudinal acceleration (m/s²)
    double ay;                  // Lateral acceleration (m/s²)
    double az;                  // Vertical acceleration (m/s²)
    
    // G-forces
    double gx;                  // Longitudinal G-force
    double gy;                  // Lateral G-force
    double gz;                  // Vertical G-force
    double g_total;             // Total G-force magnitude
    
    // Control inputs
    double throttle;            // Throttle position (0-1)
    double brake;               // Brake pressure (0-1)
    double steering_angle;      // Steering angle (radians)
    
    // Powertrain state
    int gear;                   // Current gear (0 = neutral, 1-N = gears)
    double rpm;                 // Engine RPM
    double engine_torque;       // Current engine torque (Nm)
    double wheel_force;         // Force at wheels (N)
    
    // Forces
    double drag_force;          // Aerodynamic drag force (N)
    double downforce;           // Aerodynamic downforce (N)
    double tire_force_x;        // Longitudinal tire force (N)
    double tire_force_y;        // Lateral tire force (N)
    double vertical_load;       // Total vertical load on tires (N)
    
    // Track properties at current position
    double curvature;           // Track curvature at current position (1/m)
    double radius;              // Turn radius (m) - infinite for straight
    double banking_angle;       // Track banking angle (radians)
    
    // Time
    double timestamp;           // Time since lap start (s)
    
    /**
     * @brief Constructor - initialize to safe defaults
     */
    SimulationState();
    
    /**
     * @brief Convert velocity to km/h
     */
    void updateVelocityKmh() { v_kmh = v * 3.6; }
    
    /**
     * @brief Calculate G-forces from accelerations
     * @param gravity Gravitational constant (m/s²)
     */
    void updateGForces(double gravity = 9.81);
    
    /**
     * @brief Reset state to initial values
     */
    void reset();
    
    /**
     * @brief Get a string summary of the current state
     */
    std::string toString() const;
};

/**
 * @brief Container for complete lap simulation results
 */
class LapResult {
public:
    LapResult();
    ~LapResult() = default;
    
    /**
     * @brief Add a simulation state snapshot
     */
    void addState(const SimulationState& state);
    
    /**
     * @brief Get all states
     */
    const std::vector<SimulationState>& getStates() const { return states_; }
    
    /**
     * @brief Get total lap time
     */
    double getLapTime() const { return lap_time_; }
    void setLapTime(double time) { lap_time_ = time; }
    
    /**
     * @brief Get maximum speed achieved
     */
    double getMaxSpeed() const;
    
    /**
     * @brief Get average speed
     */
    double getAverageSpeed() const;
    
    /**
     * @brief Get maximum G-forces
     */
    void getMaxGForces(double& max_gx, double& max_gy, double& max_g_total) const;
    
    /**
     * @brief Clear all data
     */
    void clear();
    
    /**
     * @brief Get number of data points
     */
    size_t size() const { return states_.size(); }

private:
    std::vector<SimulationState> states_;
    double lap_time_;
};

} // namespace LapTimeSim


