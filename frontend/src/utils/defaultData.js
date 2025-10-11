// Default car configuration
export const getDefaultCar = () => ({
  id: 1,
  name: "F1_2025",
  mass: { mass: 798.0, cog_height: 0.25, wheelbase: 3.6, weight_distribution: 0.46 },
  aerodynamics: { Cl: -1.5, Cd: 0.55, frontal_area: 1.42, air_density: 1.225 },
  tire: { mu_x: 2.2, mu_y: 2.4, load_sensitivity: 0.80, tire_radius: 0.33 },
  powertrain: {
    engine_torque_curve: {
      "5000": 600, "6000": 680, "7000": 760, "8000": 840, "9000": 910,
      "10000": 970, "11000": 1000, "12000": 990, "13000": 950, "14000": 880, "15000": 780
    },
    gear_ratios: [13.0, 10.2, 8.3, 6.8, 5.7, 4.9, 4.2, 3.7],
    final_drive: 1.0,
    efficiency: 0.98,
    max_rpm: 15000,
    min_rpm: 5000
  },
  brake: { max_brake_force: 30000, brake_bias: 0.62 }
});

// Default blank car template
export const getBlankCar = () => ({
  id: Date.now(),
  name: "New Car",
  mass: { mass: 0, cog_height: 0, wheelbase: 0, weight_distribution: 0 },
  aerodynamics: { Cl: 0, Cd: 0, frontal_area: 0, air_density: 1.225 },
  tire: { mu_x: 0, mu_y: 0, load_sensitivity: 0, tire_radius: 0 },
  powertrain: {
    engine_torque_curve: { "5000": 0 },
    gear_ratios: [],
    final_drive: 0,
    efficiency: 0,
    max_rpm: 0,
    min_rpm: 0
  },
  brake: { max_brake_force: 0, brake_bias: 0 }
});

// Default Montreal track CSV
export const montrealTrackCSV = `# x_m,y_m,w_tr_right_m,w_tr_left_m
0.123414,-0.739252,5.388,5.699
1.226607,-5.613015,5.352,5.669
2.327816,-10.486809,5.314,5.636
3.419084,-15.362353,5.276,5.603
-50.279854,218.575153,5.466,5.483
-49.153609,213.704629,5.464,5.488
-48.027210,208.833831,5.462,5.493
-46.900690,203.962769,5.461,5.497`;


