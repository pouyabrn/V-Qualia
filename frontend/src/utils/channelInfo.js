const known = {
  timestamp_s: ['Elapsed lap time', 's'], arc_length_m: ['Path distance', 'm'],
  speed_kmh: ['Speed', 'km/h'], speed_ms: ['Speed', 'm/s'],
  pos_x_m: ['Position X', 'm'], pos_y_m: ['Position Y', 'm'], pos_z_m: ['Elevation', 'm'], lateral_offset_m: ['Line offset', 'm'],
  accel_long_ms2: ['Longitudinal acceleration', 'm/s²'], accel_lat_ms2: ['Lateral acceleration', 'm/s²'], accel_vert_ms2: ['Vertical acceleration', 'm/s²'],
  g_long: ['Longitudinal acceleration', 'g'], g_lat: ['Lateral acceleration', 'g'], g_vert: ['Vertical acceleration', 'g'], g_total: ['Resultant acceleration', 'g'],
  throttle_pct: ['Throttle demand', '%'], brake_pct: ['Brake demand', '%'], steering_angle_rad: ['Steering angle', 'rad'],
  gear: ['Gear', 'state'], rpm: ['Engine speed', 'rpm'], engine_torque_nm: ['Engine torque', 'N·m'],
  wheel_force_n: ['Wheel force', 'N'], drag_force_n: ['Drag force', 'N'], downforce_n: ['Downforce', 'N'],
  tire_force_long_n: ['Longitudinal tire force', 'N'], tire_force_lat_n: ['Lateral tire force', 'N'], vertical_load_n: ['Total normal load', 'N'],
  curvature_inv_m: ['Curvature', 'm⁻¹'], radius_m: ['Curvature radius', 'm'], banking_rad: ['Road banking', 'rad'],
  ers_power_kw: ['ERS power', 'kW'], drs_open: ['DRS state', 'state'], grip_usage: ['Tire capacity usage', 'ratio'],
  fz_front_n: ['Front axle normal load', 'N'], fz_rear_n: ['Rear axle normal load', 'N'], deployed_energy_mj: ['Gross deployed energy', 'MJ']
};
export const channelInfo = key => ({ label: known[key]?.[0] || key, unit: known[key]?.[1] || 'raw units' });
export const axisLabel = key => { const { label, unit } = channelInfo(key); return unit === 'raw units' ? label : `${label} / ${unit}`; };
