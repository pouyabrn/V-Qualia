#include "io/JSONParser.h"
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <iostream>
#include <vector>

namespace LapTimeSim {

Json::Value JSONParser::readJSONFile(const std::string& filepath) {
    std::ifstream file(filepath, std::ifstream::binary);
    if (!file.is_open()) {
        throw std::runtime_error("Could not open file: " + filepath);
    }
    
    Json::Value root;
    Json::CharReaderBuilder builder;
    std::string errors;
    
    if (!Json::parseFromStream(builder, file, &root, &errors)) {
        throw std::runtime_error("Failed to parse JSON file: " + errors);
    }
    
    return root;
}

double JSONParser::getDouble(const Json::Value& value, const std::string& key, double default_val) {
    if (value.isMember(key)) {
        return value[key].asDouble();
    }
    return default_val;
}

int JSONParser::getInt(const Json::Value& value, const std::string& key, int default_val) {
    if (value.isMember(key)) {
        return value[key].asInt();
    }
    return default_val;
}

std::string JSONParser::getString(const Json::Value& value, const std::string& key, 
                                  const std::string& default_val) {
    if (value.isMember(key)) {
        return value[key].asString();
    }
    return default_val;
}

TrackData JSONParser::parseTrackJSON(const std::string& filepath) {
    std::cout << "Parsing track JSON: " << filepath << std::endl;
    
    Json::Value root = readJSONFile(filepath);
    TrackData track;
    
    // Get track name
    if (root.isMember("name")) {
        track.setName(root["name"].asString());
    }
    
    // Parse track points
    if (!root.isMember("points")) {
        throw std::runtime_error("Track JSON must contain 'points' array");
    }
    
    const Json::Value& points = root["points"];
    if (!points.isArray()) {
        throw std::runtime_error("'points' must be an array");
    }
    
    for (const auto& point : points) {
        double x = getDouble(point, "x", 0.0);
        double y = getDouble(point, "y", 0.0);
        double z = getDouble(point, "elevation", 0.0);
        double w_left = getDouble(point, "w_tr_left", 5.0);
        double w_right = getDouble(point, "w_tr_right", 5.0);
        double banking = getDouble(point, "banking", 0.0);
        
        track.addPoint(x, y, z, w_left, w_right, banking);
    }
    
    // Preprocess the track
    std::cout << "Preprocessing track with " << track.getNumPoints() << " points..." << std::endl;
    track.preprocess();
    std::cout << "Track preprocessed. Total length: " << track.getTotalLength() << " m" << std::endl;
    
    return track;
}

TrackData JSONParser::parseTrackCSV(const std::string& filepath) {
    std::cout << "Parsing TUMFTM CSV track: " << filepath << std::endl;
    
    std::ifstream file(filepath);
    if (!file.is_open()) {
        throw std::runtime_error("Failed to open CSV track file: " + filepath);
    }
    
    TrackData track;
    
    // Extract track name from filepath (e.g., "path/to/montreal.csv" -> "montreal")
    std::string track_name = filepath;
    size_t last_slash = track_name.find_last_of("/\\");
    if (last_slash != std::string::npos) {
        track_name = track_name.substr(last_slash + 1);
    }
    size_t last_dot = track_name.find_last_of(".");
    if (last_dot != std::string::npos) {
        track_name = track_name.substr(0, last_dot);
    }
    
    track.setName(track_name);
    
    std::string line;
    // Skip header line (starts with #)
    while (std::getline(file, line)) {
        if (!line.empty() && line[0] != '#') {
            // Put it back for processing
            file.seekg(-(line.length() + 1), std::ios_base::cur);
            break;
        }
    }
    
    int point_count = 0;
    while (std::getline(file, line)) {
        // Skip empty lines or comments
        if (line.empty() || line[0] == '#') continue;
        
        std::stringstream ss(line);
        std::string token;
        std::vector<double> values;
        
        // Parse comma-separated values
        while (std::getline(ss, token, ',')) {
            try {
                values.push_back(std::stod(token));
            } catch (...) {
                continue;
            }
        }
        
        if (values.size() >= 4) {
            // TUMFTM format: x_m, y_m, w_tr_right_m, w_tr_left_m
            track.addPoint(values[0], values[1], 0.0, values[3], values[2], 0.0);
            point_count++;
        }
    }
    
    if (track.getNumPoints() == 0) {
        throw std::runtime_error("No valid track points found in CSV");
    }
    
    std::cout << "Loaded " << point_count << " points from CSV" << std::endl;
    std::cout << "Preprocessing track..." << std::endl;
    track.preprocess();
    std::cout << "Track preprocessed. Total length: " << track.getTotalLength() << " m" << std::endl;
    
    return track;
}

VehicleParams JSONParser::parseVehicleJSON(const std::string& filepath) {
    std::cout << "Parsing vehicle JSON: " << filepath << std::endl;
    
    Json::Value root = readJSONFile(filepath);
    VehicleParams vehicle;
    
    // Get vehicle name
    if (root.isMember("name")) {
        vehicle.setName(root["name"].asString());
    }
    
    // Parse mass parameters
    if (root.isMember("mass")) {
        const Json::Value& mass = root["mass"];
        vehicle.mass.mass = getDouble(mass, "mass", 800.0);
        vehicle.mass.cog_height = getDouble(mass, "cog_height", 0.3);
        vehicle.mass.wheelbase = getDouble(mass, "wheelbase", 2.5);
        vehicle.mass.weight_distribution = getDouble(mass, "weight_distribution", 0.45);
    }
    
    // Parse aerodynamics
    if (root.isMember("aerodynamics")) {
        const Json::Value& aero = root["aerodynamics"];
        vehicle.aero.Cl = getDouble(aero, "Cl", -3.0);
        vehicle.aero.Cd = getDouble(aero, "Cd", 0.8);
        vehicle.aero.frontal_area = getDouble(aero, "frontal_area", 1.5);
        vehicle.aero.air_density = getDouble(aero, "air_density", 1.225);
    }
    
    // Parse tire parameters
    if (root.isMember("tire")) {
        const Json::Value& tire = root["tire"];
        vehicle.tire.mu_x = getDouble(tire, "mu_x", 1.6);
        vehicle.tire.mu_y = getDouble(tire, "mu_y", 1.8);
        vehicle.tire.load_sensitivity = getDouble(tire, "load_sensitivity", 0.9);
        vehicle.tire.tire_radius = getDouble(tire, "tire_radius", 0.3);
    }
    
    // Parse powertrain
    if (root.isMember("powertrain")) {
        const Json::Value& powertrain = root["powertrain"];
        
        // Engine torque curve
        if (powertrain.isMember("engine_torque_curve")) {
            const Json::Value& curve = powertrain["engine_torque_curve"];
            for (const auto& key : curve.getMemberNames()) {
                double rpm = std::stod(key);
                double torque = curve[key].asDouble();
                vehicle.powertrain.engine_torque_curve[rpm] = torque;
            }
        }
        
        // Gear ratios
        if (powertrain.isMember("gear_ratios")) {
            const Json::Value& gears = powertrain["gear_ratios"];
            for (const auto& gear : gears) {
                vehicle.powertrain.gear_ratios.push_back(gear.asDouble());
            }
        }
        
        vehicle.powertrain.final_drive_ratio = getDouble(powertrain, "final_drive", 3.5);
        vehicle.powertrain.drivetrain_efficiency = getDouble(powertrain, "efficiency", 0.95);
        vehicle.powertrain.max_rpm = getDouble(powertrain, "max_rpm", 15000);
        vehicle.powertrain.min_rpm = getDouble(powertrain, "min_rpm", 4000);
        vehicle.powertrain.shift_time = getDouble(powertrain, "shift_time", 0.05);
    }
    
    // Parse brake parameters
    if (root.isMember("brake")) {
        const Json::Value& brake = root["brake"];
        vehicle.brake.max_brake_force = getDouble(brake, "max_brake_force", 20000);
        vehicle.brake.brake_bias = getDouble(brake, "brake_bias", 0.6);
    }
    
    // Validate vehicle parameters
    if (!vehicle.validate()) {
        throw std::runtime_error("Vehicle parameters failed validation");
    }
    
    std::cout << "Vehicle parsed successfully: " << vehicle.getName() << std::endl;
    std::cout << "  Mass: " << vehicle.mass.mass << " kg" << std::endl;
    std::cout << "  Power/Weight: " << vehicle.getPowerToWeightRatio() << " hp/kg" << std::endl;
    
    return vehicle;
}

} // namespace LapTimeSim

