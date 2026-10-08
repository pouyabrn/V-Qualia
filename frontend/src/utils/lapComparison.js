// Interpolate onto common distance coordinates; sample index is not lap position.
export function interpolateAt(data, distance, key) {
  if (distance < data[0].arc_length_m || distance > data[data.length - 1].arc_length_m) return null;
  let lo = 0, hi = data.length - 1;
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (data[mid].arc_length_m <= distance) lo = mid; else hi = mid; }
  const a = data[lo], b = data[hi];
  if (!Number.isFinite(a[key]) || !Number.isFinite(b[key])) return null;
  const ds = b.arc_length_m - a.arc_length_m;
  return ds > 0 ? a[key] + (b[key] - a[key]) * (distance - a.arc_length_m) / ds : b[key];
}
export function alignLaps(files, samples = 700) {
  if (!files.length) return [];
  const begin = Math.max(...files.map(f => f.data[0].arc_length_m));
  const end = Math.min(...files.map(f => f.data[f.data.length - 1].arc_length_m));
  if (!(end > begin)) throw new Error('Laps have no overlapping distance range.');
  return Array.from({ length: samples }, (_, i) => {
    const distance = begin + (end - begin) * i / (samples - 1), row = { arc_length_m: distance };
    const referenceTime = interpolateAt(files[0].data, distance, 'timestamp_s');
    const reference = referenceTime != null && Number.isFinite(files[0].data[0].timestamp_s)
      ? referenceTime - files[0].data[0].timestamp_s : NaN;
    files.forEach((f, j) => {
      for (const key of ['speed_kmh', 'g_long', 'g_lat', 'throttle_pct', 'brake_pct']) row[`${j}_${key}`] = interpolateAt(f.data, distance, key);
      const time = interpolateAt(f.data, distance, 'timestamp_s');
      row[`${j}_delta`] = time != null && Number.isFinite(reference) && Number.isFinite(f.data[0].timestamp_s)
        ? time - f.data[0].timestamp_s - reference : null;
    });
    return row;
  });
}
