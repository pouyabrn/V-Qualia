const pointValid = r => Number.isFinite(r.pos_x_m) && Number.isFinite(r.pos_y_m);
export const hasSpatialData = rows => rows.length > 2 && rows.every(pointValid);

// A physical station is a transverse gate through the reference path, not a CSV index.
export function sampleAtGate(reference, index, rows, maxSeparation = 100) {
  if (!hasSpatialData(reference) || !hasSpatialData(rows)) return null;
  const p = reference[index];
  const before = reference[Math.max(0, index - 1)], after = reference[Math.min(reference.length - 1, index + 1)];
  const dx = after.pos_x_m - before.pos_x_m, dy = after.pos_y_m - before.pos_y_m;
  const norm = Math.hypot(dx, dy); if (norm < 1e-8) return null;
  const tx = dx / norm, ty = dy / norm, expected = index / (reference.length - 1);
  let best = null;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i], sx = b.pos_x_m - a.pos_x_m, sy = b.pos_y_m - a.pos_y_m;
    const along = sx * tx + sy * ty;
    if (along <= 1e-8) continue; // Opposite-direction adjacent straights are not the same station.
    const fraction = -((a.pos_x_m - p.pos_x_m) * tx + (a.pos_y_m - p.pos_y_m) * ty) / along;
    if (fraction < -1e-8 || fraction > 1 + 1e-8) continue;
    const u = Math.max(0, Math.min(1, fraction));
    const x = a.pos_x_m + u * sx, y = a.pos_y_m + u * sy;
    const lateral = (x - p.pos_x_m) * -ty + (y - p.pos_y_m) * tx;
    if (Math.abs(lateral) > maxSeparation) continue;
    const progress = Number.isFinite(a.arc_length_m) && rows.at(-1).arc_length_m > rows[0].arc_length_m
      ? (a.arc_length_m + u * (b.arc_length_m - a.arc_length_m) - rows[0].arc_length_m) / (rows.at(-1).arc_length_m - rows[0].arc_length_m) : (i - 1 + u) / (rows.length - 1);
    const referenceProgress = Number.isFinite(p.arc_length_m) && reference.at(-1).arc_length_m > reference[0].arc_length_m
      ? (p.arc_length_m - reference[0].arc_length_m) / (reference.at(-1).arc_length_m - reference[0].arc_length_m) : expected;
    if (Math.abs(progress - referenceProgress) > .15) continue;
    const score = Math.abs(lateral) + Math.abs(progress - referenceProgress) * 10;
    if (!best || score < best.score) {
      const sample = {};
      for (const key of Object.keys(a)) sample[key] = Number.isFinite(a[key]) && Number.isFinite(b[key]) ? (key === 'gear' || key === 'drs_open' ? (u >= 1 ? b[key] : a[key]) : a[key] + u * (b[key] - a[key])) : null;
      best = { score, lateral_m: lateral, sample, segment: i - 1 };
    }
  }
  return best;
}
