import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Upload } from 'lucide-react';
import { predictionsAPI } from '../../utils/api';
import { TracePlot } from '../charts/ScientificCharts';
import { formatValue } from '../../utils/chartFormatting';
import GGVSurface from '../charts/GGVSurface';
function parseGGV(text) {
  const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
  if (parsed.errors.length || parsed.data.length < 2) throw new Error('Invalid GGV CSV.');
  const keys = ['velocity_ms', 'lateral_accel_ms2', 'max_accel_ms2', 'max_brake_ms2'];
  if (parsed.data.some(r => keys.some(k => !Number.isFinite(r[k])))) throw new Error('Expected engine GGV columns: velocity_ms, lateral_accel_ms2, max_accel_ms2, max_brake_ms2.');
  return parsed.data;
}
export default function GGVPage() {
  const [data, setData] = useState([]), [metadata, setMetadata] = useState(null), [index, setIndex] = useState(0), [name, setName] = useState(''), [error, setError] = useState('');
  useEffect(() => { const file = new URLSearchParams(window.location.hash.split('?')[1]).get('file'); if (!file) return;
    let active = true; predictionsAPI.download(file).then(text => { if (active) { setData(parseGGV(text)); setName(file); setIndex(0); } }).catch(e => { if (active) setError(e.message); });
    predictionsAPI.download(`${file}.meta.json`).then(text => { if (active) setMetadata(JSON.parse(text)); }).catch(() => { if (active) setMetadata(null); });
    return () => { active = false; };
  }, []);
  const upload = async event => { const files = [...event.target.files];
    try { const csv = files.find(f => f.name.endsWith('.csv')), meta = files.find(f => f.name.endsWith('.json'));
      if (csv) { setData(parseGGV(await csv.text())); setName(csv.name); setIndex(0); setMetadata(null); }
      if (meta) setMetadata(JSON.parse(await meta.text())); setError('');
    } catch (e) { setError(e.message); } event.target.value = '';
  };
  const velocities = useMemo(() => [...new Set(data.map(r => r.velocity_ms))].sort((a, b) => a - b), [data]);
  const selectedSpeed = velocities[Math.min(index, velocities.length - 1)];
  const slice = useMemo(() => {
    const rows = data.filter(r => r.velocity_ms === selectedSpeed).map(r => ({ lateral_g: r.lateral_accel_ms2 / 9.81,
      accel: r.accel_feasible === 0 || r.accel_feasible === false ? null : r.max_accel_ms2 / 9.81,
      brake: r.brake_feasible === 0 || r.brake_feasible === false ? null : -Math.abs(r.max_brake_ms2) / 9.81 }));
    return [...rows.filter(r => r.lateral_g > 0).reverse().map(r => ({ ...r, lateral_g: -r.lateral_g })), ...rows];
  }, [data, selectedSpeed]);
  const straight = useMemo(() => data.filter(r => Math.abs(r.lateral_accel_ms2) < 1e-8).map(r => ({ speed_kmh: r.velocity_ms * 3.6,
    accel: r.accel_feasible === 0 || r.accel_feasible === false ? null : r.max_accel_ms2 / 9.81,
    brake: r.brake_feasible === 0 || r.brake_feasible === false ? null : -Math.abs(r.max_brake_ms2) / 9.81 })), [data]);
  return <div><div className="page-heading"><div><div className="eyebrow">VEHICLE CAPABILITY</div><h1>GGV envelope</h1><p>Read acceleration limits as a velocity slice, with explicit units and conditions.</p></div><label className="button"><Upload size={16} />Import GGV + conditions<input className="sr-only" type="file" accept=".csv,.json" multiple onChange={upload} /></label></div>
    {error && <div role="alert" className="error-message">{error}</div>}
    {!data.length ? <div className="empty-workspace"><h2>Load an engine GGV map</h2><p>Export the envelope during a prediction, or import a GGV CSV together with its .meta.json conditions file.</p><div className="equation">(|Fx|/Fx,max)ᵖ + (|Fy|/Fy,max)ᵖ ≤ 1</div></div> : <>
      <div className="dataset-bar"><span>{name}</span><span className="tag">{metadata ? `${metadata.road || 'Unknown road'} · ERS ${metadata.ers_peak_assistance ? 'peak' : 'off'} · DRS ${metadata.drs_open_acceleration ? 'open' : 'closed'}` : 'Conditions unknown · no metadata loaded'}</span></div>
      <label className="cursor-control">Velocity slice<input type="range" min="0" max={velocities.length - 1} value={index} onChange={e => setIndex(Number(e.target.value))} /><output>{formatValue(selectedSpeed * 3.6)} km/h · {formatValue(selectedSpeed)} m/s</output></label>
      <GGVSurface data={data} />
      <div className="plot-grid"><TracePlot syncId={null} data={slice} title="Combined acceleration envelope" units="g" xKey="lateral_g" xLabel="Lateral acceleration / g" xUnit="g" channels={[{ key: 'accel', label: 'Acceleration' }, { key: 'brake', label: 'Braking', color: '#ed7180' }]} formula="Mirrored lateral magnitude; p is the tire combined-slip exponent. Infeasible branches are omitted." />
        <TracePlot syncId={null} data={straight} title="Straight-line capability" units="g" xKey="speed_kmh" xLabel="Velocity / km/h" xUnit="km/h" channels={[{ key: 'accel', label: 'Acceleration' }, { key: 'brake', label: 'Braking', color: '#ed7180' }]} formula="ay = 0 · aerodynamic drag and gearing are included." /></div>
      <p className="method-note">Instantaneous flat-road capability, without a per-lap energy budget. Braking is negative. Lateral magnitude is mirrored for inspection; this does not establish left/right vehicle asymmetry. {data[0].accel_feasible == null && 'Legacy file: feasibility flags are unavailable.'}</p>
    </>}
  </div>;
}
