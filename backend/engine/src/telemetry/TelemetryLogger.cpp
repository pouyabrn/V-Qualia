#include "telemetry/TelemetryLogger.h"
#include <sstream>
#include <cmath>

namespace LapTimeSim {

TelemetryLogger::TelemetryLogger() {
}

void TelemetryLogger::printConsoleHeader() {
    std::cout << std::string(120, '=') << std::endl;
    std::cout << std::setw(8) << "Time"
              << std::setw(10) << "Distance"
              << std::setw(10) << "Speed"
              << std::setw(8) << "Gx"
              << std::setw(8) << "Gy"
              << std::setw(8) << "G-Total"
              << std::setw(10) << "Throttle"
              << std::setw(10) << "Brake"
              << std::setw(8) << "Gear"
              << std::setw(10) << "Curvature"
              << std::endl;
    std::cout << std::string(120, '=') << std::endl;
}

void TelemetryLogger::logToConsole(const SimulationState& state, bool verbose) {
    if (verbose) {
        std::cout << "\n--- Telemetry at t=" << std::fixed << std::setprecision(3)
                  << state.timestamp << "s ---" << std::endl;
        std::cout << "Position: (" << state.x << ", " << state.y << ", " << state.z << ")" << std::endl;
        std::cout << "Arc Length: " << state.s << " m" << std::endl;
        std::cout << "Speed: " << state.v_kmh << " km/h (" << state.v << " m/s)" << std::endl;
        std::cout << "Acceleration: ax=" << state.ax << " m/s², ay=" << state.ay << " m/s²" << std::endl;
        std::cout << "G-Forces: gx=" << state.gx << ", gy=" << state.gy << ", total=" << state.g_total << std::endl;
        std::cout << "Controls: Throttle=" << (state.throttle * 100) << "%, Brake=" 
                  << (state.brake * 100) << "%" << std::endl;
        std::cout << "Powertrain: Gear=" << state.gear << ", RPM=" << state.rpm << std::endl;
        std::cout << "Forces: Drag=" << state.drag_force << "N, Downforce=" 
                  << state.downforce << "N" << std::endl;
        std::cout << "Track: Curvature=" << state.curvature << " (1/m), Radius=" 
                  << state.radius << " m" << std::endl;
    } else {
        // Compact format
        std::cout << std::fixed << std::setprecision(2)
                  << std::setw(8) << state.timestamp
                  << std::setw(10) << state.s
                  << std::setw(10) << state.v_kmh
                  << std::setw(8) << state.gx
                  << std::setw(8) << state.gy
                  << std::setw(8) << state.g_total
                  << std::setw(10) << (state.throttle * 100)
                  << std::setw(10) << (state.brake * 100)
                  << std::setw(8) << state.gear
                  << std::setw(10) << state.curvature
                  << std::endl;
    }
}

void TelemetryLogger::exportToCSV(const LapResult& result, const std::string& filename) {
    std::ofstream file(filename);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open file " << filename << " for writing" << std::endl;
        return;
    }
    
    // CSV Header
    file << "timestamp_s,arc_length_m,pos_x_m,pos_y_m,pos_z_m,lateral_offset_m,"
         << "speed_ms,speed_kmh,accel_long_ms2,accel_lat_ms2,accel_vert_ms2,"
         << "g_long,g_lat,g_vert,g_total,"
         << "throttle_pct,brake_pct,steering_angle_rad,"
         << "gear,rpm,engine_torque_nm,wheel_force_n,"
         << "drag_force_n,downforce_n,tire_force_long_n,tire_force_lat_n,vertical_load_n,"
         << "curvature_inv_m,radius_m,banking_rad\n";
    
    // Data rows
    const auto& states = result.getStates();
    for (const auto& state : states) {
        file << std::fixed << std::setprecision(6)
             << state.timestamp << ","
             << state.s << ","
             << state.x << ","
             << state.y << ","
             << state.z << ","
             << state.n << ","
             << state.v << ","
             << state.v_kmh << ","
             << state.ax << ","
             << state.ay << ","
             << state.az << ","
             << state.gx << ","
             << state.gy << ","
             << state.gz << ","
             << state.g_total << ","
             << (state.throttle * 100) << ","
             << (state.brake * 100) << ","
             << state.steering_angle << ","
             << state.gear << ","
             << state.rpm << ","
             << state.engine_torque << ","
             << state.wheel_force << ","
             << state.drag_force << ","
             << state.downforce << ","
             << state.tire_force_x << ","
             << state.tire_force_y << ","
             << state.vertical_load << ","
             << state.curvature << ","
             << state.radius << ","
             << state.banking_angle << "\n";
    }
    
    file.close();
    std::cout << "Telemetry exported to CSV: " << filename << std::endl;
}

void TelemetryLogger::exportToJSON(const LapResult& result, const std::string& filename) {
    std::ofstream file(filename);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open file " << filename << " for writing" << std::endl;
        return;
    }
    
    file << "{\n";
    file << "  \"lap_time_seconds\": " << result.getLapTime() << ",\n";
    file << "  \"telemetry\": [\n";
    
    const auto& states = result.getStates();
    for (size_t i = 0; i < states.size(); ++i) {
        const auto& state = states[i];
        
        file << "    {\n";
        file << "      \"timestamp\": " << state.timestamp << ",\n";
        file << "      \"position\": {\"x\": " << state.x << ", \"y\": " << state.y 
             << ", \"z\": " << state.z << ", \"s\": " << state.s << "},\n";
        file << "      \"velocity\": {\"ms\": " << state.v << ", \"kmh\": " << state.v_kmh << "},\n";
        file << "      \"acceleration\": {\"longitudinal\": " << state.ax 
             << ", \"lateral\": " << state.ay << ", \"vertical\": " << state.az << "},\n";
        file << "      \"g_forces\": {\"gx\": " << state.gx << ", \"gy\": " << state.gy 
             << ", \"gz\": " << state.gz << ", \"total\": " << state.g_total << "},\n";
        file << "      \"controls\": {\"throttle_pct\": " << (state.throttle * 100) 
             << ", \"brake_pct\": " << (state.brake * 100) 
             << ", \"steering_rad\": " << state.steering_angle << "},\n";
        file << "      \"powertrain\": {\"gear\": " << state.gear << ", \"rpm\": " << state.rpm << "},\n";
        file << "      \"forces\": {\"drag\": " << state.drag_force << ", \"downforce\": " 
             << state.downforce << ", \"vertical_load\": " << state.vertical_load << "},\n";
        file << "      \"track\": {\"curvature\": " << state.curvature << ", \"radius\": " 
             << state.radius << ", \"banking\": " << state.banking_angle << "}\n";
        file << "    }";
        
        if (i < states.size() - 1) {
            file << ",";
        }
        file << "\n";
    }
    
    file << "  ]\n";
    file << "}\n";
    
    file.close();
    std::cout << "Telemetry exported to JSON: " << filename << std::endl;
}

void TelemetryLogger::printSummary(const LapResult& result, 
                                   const TrackData& track,
                                   const VehicleParams& vehicle) {
    std::cout << "\n" << std::string(80, '=') << std::endl;
    std::cout << "                    LAP TIME SIMULATION SUMMARY" << std::endl;
    std::cout << std::string(80, '=') << std::endl;
    
    // Track info
    std::cout << "\nTrack: " << track.getName() << std::endl;
    std::cout << "  Length: " << track.getTotalLength() << " m" << std::endl;
    std::cout << "  Points: " << track.getNumPoints() << std::endl;
    
    // Vehicle info
    std::cout << "\nVehicle: " << vehicle.getName() << std::endl;
    std::cout << "  Mass: " << vehicle.mass.mass << " kg" << std::endl;
    std::cout << "  Power/Weight: " << std::fixed << std::setprecision(2) 
              << vehicle.getPowerToWeightRatio() << " hp/kg" << std::endl;
    std::cout << "  Aero: Cd=" << vehicle.aero.Cd << ", Cl=" << vehicle.aero.Cl << std::endl;
    
    // Lap time
    std::cout << "\n" << std::string(80, '-') << std::endl;
    std::cout << "OPTIMAL LAP TIME: " << std::fixed << std::setprecision(3) 
              << result.getLapTime() << " seconds" << std::endl;
    std::cout << std::string(80, '-') << std::endl;
    
    // Statistics
    double max_speed = result.getMaxSpeed();
    double avg_speed = result.getAverageSpeed();
    double max_gx, max_gy, max_g_total;
    result.getMaxGForces(max_gx, max_gy, max_g_total);
    
    std::cout << "\nPerformance Statistics:" << std::endl;
    std::cout << "  Maximum Speed: " << (max_speed * 3.6) << " km/h (" 
              << max_speed << " m/s)" << std::endl;
    std::cout << "  Average Speed: " << (avg_speed * 3.6) << " km/h (" 
              << avg_speed << " m/s)" << std::endl;
    std::cout << "  Max Longitudinal G: " << max_gx << " g" << std::endl;
    std::cout << "  Max Lateral G: " << max_gy << " g" << std::endl;
    std::cout << "  Max Total G: " << max_g_total << " g" << std::endl;
    
    std::cout << "\n" << std::string(80, '=') << std::endl;
}

std::string TelemetryLogger::formatTime(double seconds) const {
    int minutes = static_cast<int>(seconds / 60.0);
    double secs = seconds - minutes * 60.0;
    
    std::ostringstream oss;
    oss << std::setfill('0') << std::setw(2) << minutes << ":"
        << std::fixed << std::setprecision(3) << std::setw(6) << secs;
    return oss.str();
}

std::string TelemetryLogger::formatVelocity(double ms) const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(1) << (ms * 3.6) << " km/h";
    return oss.str();
}

} // namespace LapTimeSim


