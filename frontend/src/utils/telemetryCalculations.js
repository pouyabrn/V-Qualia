const finite = value => typeof value === 'number' && Number.isFinite(value);
export const timeIntegral = (data, key) => {
  let sum = 0, duration = 0;
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1], b = data[i], dt = b.timestamp_s - a.timestamp_s;
    if (finite(a.timestamp_s) && finite(b.timestamp_s) && dt > 0 && finite(a[key]) && finite(b[key])) {
      sum += (a[key] + b[key]) * .5 * dt; duration += dt;
    }
  }
  return { sum, duration };
};
export const calculateStats = data => {
  if (!data?.length) return null;
  const max = key => data.reduce((m, r) => finite(r[key]) ? Math.max(m ?? -Infinity, r[key]) : m, null);
  const mean = key => { const { sum, duration } = timeIntegral(data, key); return duration ? sum / duration : null; };
  const first = data[0], last = data[data.length - 1];
  return { maxSpeed: max('speed_kmh'), avgSpeed: mean('speed_kmh'), maxRPM: max('rpm'), avgThrottle: mean('throttle_pct'),
    maxGForce: data.reduce((m, r) => finite(r.g_long) && finite(r.g_lat) ? Math.max(m ?? 0, Math.hypot(r.g_long, r.g_lat)) : m, null),
    brakeEvents: data.filter((r, i) => r.brake_pct > 10 && (!i || data[i - 1].brake_pct <= 10)).length,
    gearChanges: data.filter((r, i) => i > 0 && finite(r.gear) && finite(data[i - 1].gear) && r.gear !== data[i - 1].gear).length,
    lapTime: finite(last.timestamp_s) && finite(first.timestamp_s) ? last.timestamp_s - first.timestamp_s : null,
    distance: finite(last.arc_length_m) && finite(first.arc_length_m) ? (last.arc_length_m - first.arc_length_m) / 1000 : null };
};
export const cumulativeEnergy = data => {
  let energy = 0;
  return data.map((row, i) => {
    if (i && finite(row.ers_power_kw) && finite(data[i - 1].ers_power_kw)) {
      const dt = row.timestamp_s - data[i - 1].timestamp_s;
      if (finite(dt) && dt > 0) energy += (row.ers_power_kw + data[i - 1].ers_power_kw) * .5 * dt / 1000;
    }
    return { ...row, deployed_energy_mj: energy };
  });
};
// Kept for legacy live views. Analysis uses physical channels rather than an invented driver score.
export const getRandomColor = () => '#83bccc';
