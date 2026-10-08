import { useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { parseCSV } from '../../utils/csvParser';
import { alignLaps } from '../../utils/lapComparison';
import { calculateStats } from '../../utils/telemetryCalculations';
import { TracePlot } from '../charts/ScientificCharts';
import { colors, formatLap, formatValue } from '../../utils/chartFormatting';
export default function ComparePage() {
  const [files, setFiles] = useState([]), [error, setError] = useState('');
  const upload = async event => {
    const incoming = [...event.target.files].slice(0, Math.max(0, 5 - files.length));
    try { const added = await Promise.all(incoming.map(async f => { const data = parseCSV(await f.text());
      if (!data.every(r => Number.isFinite(r.arc_length_m))) throw new Error(`${f.name}: distance is required for lap comparison.`);
      return { id: crypto.randomUUID(), name: f.name, data, stats: calculateStats(data) }; }));
      setFiles(previous => [...previous, ...added]); setError('');
    } catch (e) { setError(e.message); } event.target.value = '';
  };
  const aligned = useMemo(() => {
    try { return { data: alignLaps(files), error: '' }; } catch (e) { return { data: [], error: e.message }; }
  }, [files]);
  const channels = key => files.map((f, i) => ({ key: `${i}_${key}`, label: f.name, color: colors[i] }));
  return <div><div className="page-heading"><div><div className="eyebrow">DISTANCE-ALIGNED DATA</div><h1>Lap comparison</h1><p>Compare up to five laps on the same circuit. First lap is the time reference.</p></div><label className="button"><Upload size={16} />Add laps<input type="file" multiple accept=".csv" className="sr-only" onChange={upload} disabled={files.length >= 5} /></label></div>
    {(error || aligned.error) && <div role="alert" className="error-message">{error || aligned.error}</div>}
    {!files.length ? <div className="empty-workspace"><h2>Load laps from the same circuit</h2><p>Different sample rates are aligned using distance interpolation. Timestamp data enables a delta-time trace.</p></div> : <>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Dataset</th><th>Lap duration</th><th>Maximum speed / km/h</th><th>Path / km</th><th /></tr></thead><tbody>{files.map((f, i) => <tr key={f.id}><td><span style={{ color: colors[i] }}>●</span> {f.name} {i === 0 && <span className="tag">reference</span>}</td><td>{formatLap(f.stats.lapTime)}</td><td>{formatValue(f.stats.maxSpeed)}</td><td>{formatValue(f.stats.distance, 3)}</td><td><button className="icon-button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter(p => p.id !== f.id))}><X size={14} /></button></td></tr>)}</tbody></table></div>
      <div className="plot-grid"><TracePlot data={aligned.data} title="Speed overlay" units="km/h" channels={channels('speed_kmh')} formula="Linear interpolation at common arc distance; no alignment by sample index." />
        <TracePlot data={aligned.data} title="Elapsed-time delta" units="s" channels={channels('delta').slice(1)} formula="Δt(s) = tcomparison(s) − treference(s) · positive = slower." />
        <TracePlot data={aligned.data} title="Longitudinal acceleration" units="g" channels={channels('g_long')} /><TracePlot data={aligned.data} title="Lateral acceleration" units="g" channels={channels('g_lat')} />
      </div><p className="method-note">Comparison covers the shared distance range. Different driven lines can have different lengths; equal arc distance may represent different physical locations. Surveyed coordinates improve alignment. Interpolation is for visualization; full-resolution data supplies the statistics.</p>
    </>}
  </div>;
}
