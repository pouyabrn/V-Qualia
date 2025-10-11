#pragma once

#include "data/TrackData.h"
#include "data/VehicleParams.h"
#include <string>
#include <json/json.h>

namespace LapTimeSim {

/**
 * @brief JSON parser for track and vehicle configuration files
 * 
 * Expected track JSON format:
 * {
 *   "name": "Track Name",
 *   "points": [
 *     {
 *       "x": 0.0,
 *       "y": 0.0,
 *       "w_tr_right": 7.5,
 *       "w_tr_left": 7.5,
 *       "banking": 0.0,
 *       "elevation": 0.0
 *     },
 *     ...
 *   ]
 * }
 * 
 * Expected vehicle JSON format:
 * {
 *   "name": "Vehicle Name",
 *   "mass": {
 *     "mass": 800,
 *     "cog_height": 0.3,
 *     "wheelbase": 2.5,
 *     "weight_distribution": 0.45
 *   },
 *   "aerodynamics": {
 *     "Cl": -3.5,
 *     "Cd": 0.8,
 *     "frontal_area": 1.5,
 *     "air_density": 1.225
 *   },
 *   "tire": {
 *     "mu_x": 1.6,
 *     "mu_y": 1.8,
 *     "load_sensitivity": 0.9,
 *     "tire_radius": 0.3
 *   },
 *   "powertrain": {
 *     "engine_torque_curve": {
 *       "5000": 250,
 *       "10000": 350,
 *       "15000": 300
 *     },
 *     "gear_ratios": [3.0, 2.2, 1.7, 1.3, 1.0],
 *     "final_drive": 3.5,
 *     "efficiency": 0.95,
 *     "max_rpm": 15000,
 *     "min_rpm": 4000
 *   },
 *   "brake": {
 *     "max_brake_force": 20000,
 *     "brake_bias": 0.6
 *   }
 * }
 */
class JSONParser {
public:
    JSONParser() = default;
    ~JSONParser() = default;
    
    /**
     * @brief Parse track data from JSON file
     * @param filepath Path to track JSON file
     * @return TrackData object (preprocessed)
     */
    static TrackData parseTrackJSON(const std::string& filepath);
    
    /**
     * @brief Parse track data from TUMFTM CSV format
     * @param filepath Path to CSV file (x_m,y_m,w_tr_right_m,w_tr_left_m)
     * @return TrackData object (preprocessed)
     */
    static TrackData parseTrackCSV(const std::string& filepath);
    
    /**
     * @brief Parse vehicle parameters from JSON file
     * @param filepath Path to vehicle JSON file
     * @return VehicleParams object
     */
    static VehicleParams parseVehicleJSON(const std::string& filepath);

private:
    /**
     * @brief Read JSON file and return root value
     */
    static Json::Value readJSONFile(const std::string& filepath);
    
    /**
     * @brief Get double value with default
     */
    static double getDouble(const Json::Value& value, const std::string& key, double default_val);
    
    /**
     * @brief Get int value with default
     */
    static int getInt(const Json::Value& value, const std::string& key, int default_val);
    
    /**
     * @brief Get string value with default
     */
    static std::string getString(const Json::Value& value, const std::string& key, 
                                 const std::string& default_val);
};

} // namespace LapTimeSim

