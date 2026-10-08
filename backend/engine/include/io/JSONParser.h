#pragma once

#include "data/TrackData.h"
#include "data/VehicleParams.h"
#include <string>
#include <utility>
#include <vector>

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

    /**
     * @brief Parse vehicle parameters with dotted-path overrides applied on top of the file,
     *        e.g. {"aerodynamics.ClA", "4.5"}, {"tire.mu_y", "1.9"}
     */
    static VehicleParams parseVehicleJSON(const std::string& filepath,
                                          const std::vector<std::pair<std::string, std::string>>& overrides);

    /**
     * @brief Apply an optional banking sidecar "<track>.banking.csv" (s_start_m,s_end_m,banking_deg[,ramp_m])
     *        defined on the centreline distance. Returns the number of banked sections applied.
     */
    static int applyBankingSidecar(TrackData& track, const std::string& track_filepath);

    /**
     * @brief Load optional DRS zones from "<track>.drs.csv" (s_start_m,s_end_m per row, centreline distance).
     *        Returns an empty list when the sidecar does not exist.
     */
    static std::vector<std::pair<double, double>> loadDRSSidecar(const std::string& track_filepath);

    /**
     * @brief Apply an optional elevation profile "<track>.elevation.csv" (s_m,z_m per row, centreline
     *        distance, periodic) and re-preprocess the track. Returns true when a profile was applied.
     */
    static bool applyElevationSidecar(TrackData& track, const std::string& track_filepath);
};

} // namespace LapTimeSim
