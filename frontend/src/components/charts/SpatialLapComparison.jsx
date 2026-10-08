import { useMemo, useState } from 'react';
import { ChartFrame } from './ScientificCharts';
import { colors, formatValue } from '../../utils/chartFormatting';
import { hasSpatialData, sampleAtGate } from '../../utils/spatialComparison';

export default function SpatialLapComparison({ files }) {
  const [index, setIndex] = useState(0), [channel, setChannel] = useState('speed_kmh'), [zoom, setZoom] = useState(0);
  const reference = useMemo(() => files[0]?.data || [], [files]), cursor = Math.min(index, reference.length - 1), point = reference[cursor];
  const spatialFiles = files.map((f, i) => ({ ...f, color: colors[i], index: i })).filter(f => hasSpatialData(f.data));
  const geometry = useMemo(() => {
    const available = files.filter(f => hasSpatialData(f.data)); if (!available.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    available.forEach(f => f.data.forEach(p => { x0 = Math.min(x0, p.pos_x_m); x1 = Math.max(x1, p.pos_x_m); y0 = Math.min(y0, p.pos_y_m); y1 = Math.max(y1, p.pos_y_m); }));
    const scale = 470 / Math.max(x1 - x0, y1 - y0, 1), ox = (640 - (x1 - x0) * scale) / 2, oy = (500 - (y1 - y0) * scale) / 2;
    const project = p => [ox + (p.pos_x_m - x0) * scale, 500 - oy - (p.pos_y_m - y0) * scale];
    return { project, scale, paths: files.map(f => hasSpatialData(f.data) ? f.data.filter((_, i) => i % Math.max(1, Math.ceil(f.data.length / 1600)) === 0 || i === f.data.length - 1).map(p => project(p).join(',')).join(' ') : null) };
  }, [files]);
  const matches = useMemo(() => files.map((f, i) => i === 0 ? { sample: point, lateral_m: 0 } : sampleAtGate(reference, cursor, f.data)), [files, reference, cursor, point]);
  const keys = Object.keys(point || {}).filter(k => k !== 'index' && files.some(f => f.data.some(r => Number.isFinite(r[k]))));
  if (!geometry || !hasSpatialData(reference)) return <div className="empty-panel">Map comparison needs pos_x_m/pos_y_m or X/Y in the reference CSV. Include coordinates to compare racing lines at physical locations.</div>;
  const projected = geometry.project(point);
  const viewSize = zoom ? zoom * geometry.scale : 640;
  const box = zoom ? [projected[0] - viewSize / 2, projected[1] - viewSize * 500 / 640 / 2, viewSize, viewSize * 500 / 640] : [0, 0, 640, 500];
  const before = reference[Math.max(0, cursor - 1)], after = reference[Math.min(reference.length - 1, cursor + 1)];
  const dx = after.pos_x_m - before.pos_x_m, dy = after.pos_y_m - before.pos_y_m, norm = Math.max(Math.hypot(dx, dy), 1e-8);
  const gateA = geometry.project({ pos_x_m: point.pos_x_m - dy / norm * 40, pos_y_m: point.pos_y_m + dx / norm * 40 });
  const gateB = geometry.project({ pos_x_m: point.pos_x_m + dy / norm * 40, pos_y_m: point.pos_y_m - dx / norm * 40 });
  const selectPosition = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fit = Math.min(rect.width / box[2], rect.height / box[3]), px = box[0] + (event.clientX - rect.left - (rect.width - box[2] * fit) / 2) / fit, py = box[1] + (event.clientY - rect.top - (rect.height - box[3] * fit) / 2) / fit;
    let best = 0, distance = Infinity;
    reference.forEach((p, i) => { const [x, y] = geometry.project(p), d = (px - x) ** 2 + (py - y) ** 2; if (d < distance) { distance = d; best = i; } }); setIndex(best);
  };
  const elapsed = (sample, f) => Number.isFinite(sample?.timestamp_s) && Number.isFinite(f.data[0].timestamp_s) ? sample.timestamp_s - f.data[0].timestamp_s : null;
  const referenceTime = elapsed(point, files[0]);
  return <section className="spatial-comparison"><div className="trace-controls"><div><div className="eyebrow">PHYSICAL POSITION / RACING LINES</div><h2>Place-by-place comparison</h2></div><label className="channel-search">Map scale<select value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={0}>Full circuit</option><option value={250}>Local / 250 m</option><option value={80}>Local / 80 m</option></select></label><label className="channel-search">Inspect channel<select value={keys.includes(channel) ? channel : keys[0]} onChange={e => setChannel(e.target.value)}>{keys.map(k => <option key={k}>{k}</option>)}</select></label></div>
    <label className="cursor-control">Reference position<input aria-label="Map comparison position" type="range" min={0} max={reference.length - 1} value={cursor} onChange={e => setIndex(Number(e.target.value))} /><output>{formatValue(point.arc_length_m, 1)} m / {formatValue(point.speed_kmh)} km/h</output></label>
    <div className="spatial-grid"><ChartFrame title="Racing lines / driven paths" units="X/Y · m · equal aspect" formula="Select a point on the map or move the position slider. The dashed line is a physical transverse comparison gate."><svg viewBox={box.join(' ')} className="spatial-map" role="img" aria-label="Overlaid racing lines; select a physical location" onClick={selectPosition}><defs><pattern id="spatial-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" stroke="#263642" strokeWidth=".5" fill="none" /></pattern></defs><rect width="640" height="500" fill="url(#spatial-grid)" />{spatialFiles.map(f => <polyline key={f.id} points={geometry.paths[f.index]} fill="none" stroke={f.color} strokeWidth={f.index === 0 ? 2 : 1.4} vectorEffect="non-scaling-stroke" opacity=".85" />)}<line x1={gateA[0]} y1={gateA[1]} x2={gateB[0]} y2={gateB[1]} stroke="#b9cad7" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />{matches.map((match, i) => match && <circle key={i} cx={geometry.project(match.sample)[0]} cy={geometry.project(match.sample)[1]} r={3.2 * box[2] / 640} stroke="#0b1018" fill={colors[i]} vectorEffect="non-scaling-stroke" />)}</svg></ChartFrame>
      <div className="spatial-readout"><div className="eyebrow">AT SELECTED STATION</div><table className="data-table"><thead><tr><th>Lap / channel value</th><th>Δ channel</th><th>Δ time / s</th><th>Offset / m</th></tr></thead><tbody>{files.map((f, i) => { const match = matches[i], key = keys.includes(channel) ? channel : keys[0], value = match?.sample[key], base = point[key], time = match ? elapsed(match.sample, f) : null; return <tr key={f.id}><td><span style={{ color: colors[i] }}>{f.name}</span><strong>{formatValue(value, 3)}</strong>{!match && <small>No matching local crossing</small>}</td><td>{formatValue(Number.isFinite(value) && Number.isFinite(base) ? value - base : null, 3)}</td><td>{formatValue(time != null && referenceTime != null ? time - referenceTime : null, 3)}</td><td>{formatValue(match?.lateral_m, 2)}</td></tr>; })}</tbody></table></div></div>
    <details className="station-channels"><summary>All channel values and differences at this position</summary><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Channel</th>{files.map(f => <th key={f.id}>{f.name}<br />Value / Δ reference</th>)}</tr></thead><tbody>{keys.map(key => { const base = key === 'timestamp_s' ? referenceTime : point[key]; return <tr key={key}><td>{key === 'timestamp_s' ? 'Elapsed time / s' : key}</td>{matches.map((match, i) => { const value = key === 'timestamp_s' ? elapsed(match?.sample, files[i]) : match?.sample[key]; return <td key={i}>{formatValue(value, 3)}<span className="station-delta">Δ {formatValue(Number.isFinite(value) && Number.isFinite(base) ? value - base : null, 3)}</span></td>; })}</tr>; })}</tbody></table></div></details>
    <p className="method-note">Coordinates must share the same origin and metre scale. Same-place sampling intersects a gate normal to the reference heading. It requires a nearby crossing in the same direction and within 15% of lap progress; crossings beyond 100 m are unavailable. Offset is signed across the gate. Separate racing lines are retained, rather than snapped onto one line.</p>
  </section>;
}
