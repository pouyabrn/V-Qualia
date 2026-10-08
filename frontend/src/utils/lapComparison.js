// Interpolate onto common distance coordinates; sample index is not lap position.
export function interpolateAt(data, distance, key) {
  if (distance < data[0].arc_length_m || distance > data[data.length - 1].arc_length_m) return null;
  let lo = 0, hi = data.length - 1;
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (data[mid].arc_length_m <= distance) lo = mid; else hi = mid; }
  const a = data[lo], b = data[hi];
  if (!Number.isFinite(a[key]) || !Number.isFinite(b[key])) return null;
  if (key === 'gear' || key === 'drs_open') return distance >= b.arc_length_m ? b[key] : a[key];
  const ds = b.arc_length_m - a.arc_length_m;
  return ds > 0 ? a[key] + (b[key] - a[key]) * (distance - a.arc_length_m) / ds : b[key];
}
export function comparisonKeys(files) {
  return [...new Set(files.flatMap(f => Object.keys(f.data[0] || {})))].filter(key => !['index', 'arc_length_m'].includes(key) && files.some(f => f.data.some(r => Number.isFinite(r[key]))));
}
export function alignLaps(files, samples = 700) {
  if (!files.length) return [];
  const begin = Math.max(...files.map(f => f.data[0].arc_length_m));
  const end = Math.min(...files.map(f => f.data[f.data.length - 1].arc_length_m));
  if (!(end > begin)) throw new Error('Laps have no overlapping distance range.');
  const keys = comparisonKeys(files);
  return Array.from({ length: samples }, (_, i) => {
    const distance = begin + (end - begin) * i / (samples - 1), row = { arc_length_m: distance };
    const referenceTime = interpolateAt(files[0].data, distance, 'timestamp_s');
    const reference = referenceTime != null && Number.isFinite(files[0].data[0].timestamp_s)
      ? referenceTime - files[0].data[0].timestamp_s : NaN;
    files.forEach((f, j) => {
      for (const key of keys) {
        let value = interpolateAt(f.data, distance, key);
        if (key === 'timestamp_s' && value != null && Number.isFinite(f.data[0].timestamp_s)) value -= f.data[0].timestamp_s;
        row[`${j}_${key}`] = value;
      }
      const time = interpolateAt(f.data, distance, 'timestamp_s');
      row[`${j}_delta`] = time != null && Number.isFinite(reference) && Number.isFinite(f.data[0].timestamp_s)
        ? time - f.data[0].timestamp_s - reference : null;
    });
    files.forEach((f, j) => { for (const key of keys) { const value = row[`${j}_${key}`], base = row[`0_${key}`]; row[`${j}_diff_${key}`] = Number.isFinite(value) && Number.isFinite(base) ? value - base : null; } });
    return row;
  });
}
