import { useEffect, useState } from 'react';
import { Play, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { carsAPI, tracksAPI, predictionsAPI } from '../../utils/api';
import { parseCSV } from '../../utils/csvParser';
import { TrackPlot } from '../charts/ScientificCharts';
import { formatLap, formatValue } from '../../utils/chartFormatting';
import TelemetryWorkbench from '../charts/TelemetryWorkbench';
import LapReplayViewer from './LapReplayViewer';

export default function PredictPage({ savedRun, onRun }) {
  const [cars, setCars] = useState([]), [tracks, setTracks] = useState([]), [status, setStatus] = useState(null);
  const [car, setCar] = useState(savedRun?.car || ''), [track, setTrack] = useState(savedRun?.track || ''), [geometry, setGeometry] = useState([]);
  const [options, setOptions] = useState(savedRun?.options || { resolution_m: 2, air_density: 1.225, grip_scale: 1, line_mode: 'mincurv', ers: true, drs: true, export_ggv: false });
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [result, setResult] = useState(savedRun?.result || null), [data, setData] = useState(savedRun?.data || null), [view, setView] = useState('channels');
  const load = async () => {
    setLoading(true); setError('');
    try { const [c, t, s] = await Promise.all([carsAPI.getAll(), tracksAPI.getAll(), predictionsAPI.status()]);
      setCars(c.cars); setTracks(t.tracks); setStatus(s);
      setCar(prev => prev || c.cars.find(r => r.name === 'F1_2025_Quali_LowDF')?.name || c.cars[0]?.name || '');
      setTrack(prev => prev || t.tracks.find(r => r.name === 'Monza')?.name || t.tracks[0]?.name || '');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!track) return; let active = true;
    tracksAPI.get(track).then(r => { if (active) setGeometry(r.data.map(p => ({ x: p.x_m, y: p.y_m }))); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; }; }, [track]);
  const change = (key, value) => setOptions(previous => ({ ...previous, [key]: value }));
  const predict = async event => {
    event.preventDefault(); setBusy(true); setError(''); setResult(null); setData(null); onRun(null);
    try { const r = await predictionsAPI.predict(car, track, options); setResult(r);
      const csv = await predictionsAPI.download(r.telemetry_file), parsed = parseCSV(csv); setData(parsed); setView('channels');
      onRun({ result: r, data: parsed, car, track, options });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const download = async filename => {
    try { const blob = await predictionsAPI.get(filename), url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
    catch (e) { setError(e.message); }
  };
  return <div><div className="page-heading"><div><div className="eyebrow">QUASI-STEADY-STATE SIMULATION</div><h1>Lap prediction</h1><p>Set the vehicle and conditions. Inspect the resulting lap.</p></div>
    <div className="engine-state"><span className={`status-dot ${status?.ready ? 'ready' : ''}`} />{loading ? 'Connecting…' : status?.ready ? 'Engine ready' : 'Engine unavailable'}<button className="icon-button" aria-label="Refresh engine status" onClick={load}><RefreshCw size={14} /></button></div></div>
    <div className="prediction-layout"><form className="setup-panel" onSubmit={predict}>
      <h2>Simulation setup</h2><fieldset disabled={busy || loading}>
        <label>Vehicle<select value={car} onChange={e => setCar(e.target.value)} required><option value="" disabled>Select a vehicle</option>{cars.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
        <label>Circuit<select value={track} onChange={e => setTrack(e.target.value)} required><option value="" disabled>Select a circuit</option>{tracks.map(t => <option key={t.name}>{t.name}</option>)}</select></label>
        <div className="setup-divider">CONDITIONS</div>
        <label>Air density <span>kg/m³</span><input type="number" min="0.5" max="2" step="0.001" value={options.air_density} onChange={e => change('air_density', Number(e.target.value))} required /></label>
        <label>Grip scale <span>× preset</span><input type="number" min="0.3" max="2" step="0.01" value={options.grip_scale} onChange={e => change('grip_scale', Number(e.target.value))} required /></label>
        <label>Path resolution<select value={options.resolution_m} onChange={e => change('resolution_m', Number(e.target.value))}><option value="2">2 m · fast</option><option value="1">1 m · fine</option><option value="0.5">0.5 m · detailed</option><option value="5">5 m · coarse</option></select></label>
        <label>Racing line<select value={options.line_mode} onChange={e => change('line_mode', e.target.value)}><option value="mincurv">Minimum curvature</option><option value="center">Centreline</option></select></label>
        <label className="checkbox-label"><input type="checkbox" checked={options.ers} onChange={e => change('ers', e.target.checked)} />Enable ERS (if equipped)</label>
        <label className="checkbox-label"><input type="checkbox" checked={options.drs} onChange={e => change('drs', e.target.checked)} />Use track DRS zones</label>
        <label className="checkbox-label"><input type="checkbox" checked={options.export_ggv} onChange={e => change('export_ggv', e.target.checked)} />Export GGV envelope</label>
        <button className="button primary run-button" type="submit" disabled={!status?.ready || !car || !track}><Play size={15} />{busy ? 'Solving…' : 'Predict lap'}</button>
      </fieldset><p className="method-note">Track banking and elevation are applied when sidecars are available. GGV export adds work; it is an instantaneous envelope.</p>
      {status?.engine?.commit && <a className="revision" href={`${status.engine.repository}/commit/${status.engine.commit}`} target="_blank" rel="noreferrer">Engine {status.engine.commit.slice(0, 7)}</a>}
    </form><div className="prediction-results">
      {error && <div className="error-message" role="alert">{error}</div>}
      {busy && <div className="solve-preview"><TrackPlot data={geometry} title={track} animated /><div className="status-message" role="status">Solving the lap and writing telemetry. First use prepares the racing line.</div></div>}
      {!result && !busy && <><div className="preview-grid"><TrackPlot data={geometry} title={track || 'Circuit'} /><section className="model-notes"><div className="eyebrow">MODEL</div><h2>Physics with a small CPU budget</h2><p>Load-sensitive tires, combined grip, aerodynamic forces and a forward/backward speed solve.</p><div className="equation">T = ∫₀ᴸ ds / v(s)</div><div className="equation">Fdrag = ½ρCdAv² · ay ≈ v²κ</div><p>Prediction uses an effective vehicle model. A minimum-curvature line does not guarantee the fastest line. Check corner speeds as well as total lap time.</p><a href="https://github.com/pouyabrn/LapPredictionEngine/blob/main/validation/REVIEW_REPORT.md" target="_blank" rel="noreferrer">See measured validation →</a></section></div><div className="empty-panel">Run a prediction to inspect speed, controls, axle loads and hybrid deployment here.</div></>}
      {result && <><div className="result-heading"><div><span className="eyebrow">PREDICTED LAP</span><strong>{formatLap(result.lap_time)}</strong><span>{result.summary.vehicle} · {result.summary.track}</span></div><div className="run-details"><span>Converged · {formatValue(result.summary.solve_ms, 0)} ms solve</span><span>{formatValue(result.wall_ms, 0)} ms including export</span><span>{result.summary.ers_budget_mj != null ? `Net ERS ${formatValue(result.summary.ers_energy_mj, 3)} / ${formatValue(result.summary.ers_budget_mj, 3)} MJ` : 'No finite ERS budget applied'}</span></div></div>
        <div className="result-toolbar"><div className="segmented"><button aria-pressed={view === 'channels'} onClick={() => setView('channels')}>Telemetry</button><button aria-pressed={view === 'replay'} onClick={() => setView('replay')}>Lap replay</button></div>
          <a className="button secondary" href={`${window.location.pathname}#/lap-replay-viewer?file=${encodeURIComponent(result.telemetry_file)}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Pop out replay</a>
          <details className="download-menu"><summary><Download size={14} />Export</summary><div>{[['Telemetry CSV', result.telemetry_file], ['Summary JSON', result.summary_file], ['Racing line CSV', result.line_file], ['GGV CSV', result.ggv_file], ['GGV conditions', result.ggv_metadata_file]].filter(([, f]) => f).map(([label, f]) => <button key={f} onClick={() => download(f)}>{label}</button>)}{result.ggv_file && <a href={`#/ggv?file=${encodeURIComponent(result.ggv_file)}`}>Inspect GGV envelope →</a>}</div></details>
        </div>{data ? view === 'channels' ? <TelemetryWorkbench data={data} source="Simulated telemetry" /> : <LapReplayViewer data={data} embedded /> : <p className="status-message">Telemetry is unavailable; exports and summary remain available.</p>}
      </>}
    </div></div>
  </div>;
}
