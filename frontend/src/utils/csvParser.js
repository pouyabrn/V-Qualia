import Papa from 'papaparse';

const aliases = { Speed: 'speed_kmh', Distance: 'arc_length_m', Time: 'timestamp_s',
  RPM: 'rpm', nGear: 'gear', Throttle: 'throttle_pct', Brake: 'brake_pct',
  X: 'pos_x_m', Y: 'pos_y_m' };
const number = value => value === '' || value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export const parseCSV = text => {
  const result = Papa.parse(text.replace(/^\uFEFF/, ''), { delimiter: ',', header: true, skipEmptyLines: 'greedy',
    transformHeader: h => h.trim(), comments: '#' });
  if (result.errors.length) throw new Error(`Invalid CSV: ${result.errors[0].message}`);
  const data = result.data.map((raw, index) => {
    const row = { index };
    Object.entries(raw).forEach(([key, value]) => {
      const target = aliases[key] || key;
      if (target === 'brake_pct' && /^(true|false)$/i.test(value)) row[target] = value.toLowerCase() === 'true' ? 100 : 0;
      else if (target === 'timestamp_s' && value.includes(':')) {
        const parts = value.replace(/^\d+ days? /, '').split(':').map(Number);
        row[target] = parts.every(Number.isFinite) ? parts.reduce((sum, v) => sum * 60 + v, 0) : null;
      } else row[target] = number(value);
    });
    if (row.speed_kmh == null && row.speed_ms != null) row.speed_kmh = row.speed_ms * 3.6;
    if (row.g_long == null && row.accel_long_ms2 != null) row.g_long = row.accel_long_ms2 / 9.81;
    if (row.g_lat == null && row.accel_lat_ms2 != null) row.g_lat = row.accel_lat_ms2 / 9.81;
    return row;
  });
  if (data.length < 2 || data.some(row => row.speed_kmh == null || row.speed_kmh < 0))
    throw new Error('Telemetry needs at least two finite, nonnegative speed samples (speed_kmh or Speed).');
  for (let i = 1; i < data.length; i++) {
    if (data[i].timestamp_s != null && data[i - 1].timestamp_s != null && data[i].timestamp_s < data[i - 1].timestamp_s)
      throw new Error('Time must increase within one lap. Import laps separately.');
    if (data[i].arc_length_m != null && data[i - 1].arc_length_m != null && data[i].arc_length_m < data[i - 1].arc_length_m)
      throw new Error('Distance must increase within one lap.');
  }
  return data;
};

export const parseTrackCSV = (text, name) => {
  const result = Papa.parse(text, { delimiter: ',', comments: '#', skipEmptyLines: 'greedy' });
  const data = result.data.map(r => ({ x: number(r[0]), y: number(r[1]) })).filter(r => r.x != null && r.y != null);
  if (data.length < 3) throw new Error('Track needs at least three valid coordinate pairs.');
  return { id: Date.now(), name, data };
};
export const formatTrackName = name => (name || 'Track').replace(/\.csv$/i, '').replace(/_/g, ' ');

// Preserve first/last points and local extrema; do not hide a narrow braking event.
export const sampleExtrema = (data, limit = 900, keys = ['speed_kmh', 'brake_pct', 'g_lat']) => {
  if (data.length <= limit) return data;
  const bucket = Math.ceil(data.length / Math.max(1, Math.floor(limit / (2 * keys.length + 2))));
  const chosen = new Set([0, data.length - 1]);
  for (let start = 0; start < data.length; start += bucket) {
    chosen.add(start);
    for (const key of keys) {
      let lo = start, hi = start;
      for (let i = start; i < Math.min(start + bucket, data.length); i++) {
        if (data[i][key] != null && (data[lo][key] == null || data[i][key] < data[lo][key])) lo = i;
        if (data[i][key] != null && (data[hi][key] == null || data[i][key] > data[hi][key])) hi = i;
      }
      chosen.add(lo); chosen.add(hi);
    }
  }
  return [...chosen].sort((a, b) => a - b).map(i => data[i]);
};
export const downsampleData = (data, factor) => !data ? data : sampleExtrema(data, Math.ceil(data.length / Math.max(1, factor)));
