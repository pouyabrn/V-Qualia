import { useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { parseCSV } from '../../utils/csvParser';
import { alignLaps, comparisonKeys } from '../../utils/lapComparison';
import { calculateStats, cumulativeEnergy } from '../../utils/telemetryCalculations';
import { TracePlot } from '../charts/ScientificCharts';
import SpatialLapComparison from '../charts/SpatialLapComparison';
import { colors, formatLap, formatValue } from '../../utils/chartFormatting';
import { channelInfo } from '../../utils/channelInfo';
export default function ComparePage({ files, onFiles: setFiles }) {
  const [error, setError] = useState(''), [view, setView] = useState('overlay'), [filter, setFilter] = useState('');
  const upload = async event => {
    const incoming = [...event.target.files].slice(0, Math.max(0, 5 - files.length));
    try { const added = await Promise.all(incoming.map(async f => { const data = cumulativeEnergy(parseCSV(await f.text()));
      if (!data.every(r => Number.isFinite(r.arc_length_m))) throw new Error(`${f.name}: distance is required for lap comparison.`);
      return { id: crypto.randomUUID(), name: f.name, data, stats: calculateStats(data) }; }));
      setFiles(previous => [...previous, ...added]); setError('');
    } catch (e) { setError(e.message); } event.target.value = '';
  };
  const aligned = useMemo(() => {
    try { return { data: alignLaps(files), error: '' }; } catch (e) { return { data: [], error: e.message }; }
  }, [files]);
  const keys = useMemo(() => comparisonKeys(files), [files]);
  const channels = key => files.map((f, i) => ({ key: `${i}_${view === 'difference' ? 'diff_' : ''}${key}`, label: f.name, color: colors[i], step: /^(gear|drs_open)$/.test(key) })).filter((_, i) => view !== 'difference' || i > 0);
  return <div><div className="page-heading"><div><div className="eyebrow">DISTANCE-ALIGNED DATA</div><h1>Lap comparison</h1><p>Compare up to five laps on the same circuit. First lap is the time reference.</p></div><label className="button"><Upload size={16} />Add laps<input type="file" multiple accept=".csv" className="sr-only" onChange={upload} disabled={files.length >= 5} /></label></div>
    {(error || aligned.error) && <div role="alert" className="error-message">{error || aligned.error}</div>}
    {!files.length ? <div className="empty-workspace"><h2>Load laps from the same circuit</h2><p>Different sample rates are aligned using distance interpolation. Timestamp data enables a delta-time trace.</p></div> : <>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Dataset</th><th>Lap duration</th><th>Maximum speed / km/h</th><th>Path / km</th><th /></tr></thead><tbody>{files.map((f, i) => <tr key={f.id}><td><span style={{ color: colors[i] }}>●</span> {f.name} {i === 0 && <span className="tag">reference</span>}</td><td>{formatLap(f.stats.lapTime)}</td><td>{formatValue(f.stats.maxSpeed)}</td><td>{formatValue(f.stats.distance, 3)}</td><td><button className="icon-button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter(p => p.id !== f.id))}><X size={14} /></button></td></tr>)}</tbody></table></div>
      <SpatialLapComparison key={files[0]?.id} files={files} />
      <div className="trace-controls"><div className="segmented" aria-label="Comparison mode"><button aria-pressed={view === 'overlay'} onClick={() => setView('overlay')}>All channel overlays</button><button aria-pressed={view === 'difference'} onClick={() => setView('difference')} disabled={files.length < 2}>Difference to reference</button></div><label className="channel-search">Find channel<input aria-label="Filter comparison channels" placeholder="speed, brake, load…" value={filter} onChange={e => setFilter(e.target.value)} /></label><span className="source-label">{keys.length} numeric channels · distance is the shared X axis</span></div>
      {view === 'difference' && keys.some(key => !files[0].data.some(r => Number.isFinite(r[key]))) && <p className="method-note">No reference value for: {keys.filter(key => !files[0].data.some(r => Number.isFinite(r[key]))).join(', ')}. Their difference plots are unavailable.</p>}
      <div className="plot-grid">
        <TracePlot defer data={aligned.data} title="Elapsed-time delta" units="s" channels={files.slice(1).map((f, i) => ({ key: `${i + 1}_delta`, label: f.name, color: colors[i + 1] }))} formula="Δt(s) = tcomparison(s) − treference(s) · positive = slower." />
        {keys.filter(key => `${key} ${channelInfo(key).label}`.toLowerCase().includes(filter.toLowerCase())).map(key => <TracePlot defer key={key} data={aligned.data} title={`${view === 'difference' ? 'Δ ' : ''}${channelInfo(key).label}`} units={channelInfo(key).unit} channels={channels(key)} formula={`${key} · ${view === 'difference' ? 'Δchannel(s) = channel(s) − reference(s). ' : ''}Available in ${files.filter(f => f.data.some(r => Number.isFinite(r[key]))).length}/${files.length} datasets. ${view === 'difference' && !files[0].data.some(r => Number.isFinite(r[key])) ? 'Reference channel missing; no difference can be computed.' : 'Missing spans are omitted.'}`} />)}
      </div><p className="method-note">Every finite numeric channel is available, including custom columns. Sample index is not a physical comparison axis. Comparison covers the shared distance range. Different driven lines can have different lengths; equal arc distance may represent different physical locations. Elapsed time is measured from each lap start. Interpolation is for visualization; full-resolution data supplies the statistics.</p>
    </>}
  </div>;
}
