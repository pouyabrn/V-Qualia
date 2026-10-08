import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { predictionsAPI } from '../../utils/api';
import { parseCSV } from '../../utils/csvParser';
import { TrackPlot, TracePlot } from '../charts/ScientificCharts';
import { formatLap, formatValue } from '../../utils/chartFormatting';
import { sampleExtrema } from '../../utils/csvParser';
export default function LapReplayViewer({ data, csvData, embedded = false }) {
  const [rows, setRows] = useState(data || []), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false), [time, setTime] = useState(0), [speed, setSpeed] = useState(1);
  const timeRef = useRef(0);
  useEffect(() => { let active = true; setPlaying(false); setTime(0);
    if (data) { setRows(data); return; }
    const file = new URLSearchParams(window.location.hash.split('?')[1]).get('file');
    const load = async () => {
      setLoading(true); setError('');
      try { const raw = csvData || (file ? await predictionsAPI.download(file) : localStorage.getItem('vqualiaReplayCSV'));
        if (!raw) throw new Error('No lap selected. Open replay from a prediction or imported telemetry.');
        if (active) setRows(parseCSV(raw));
      } catch (e) { if (active) setError(e.message); } finally { if (active) setLoading(false); }
    }; load(); return () => { active = false; };
  }, [data, csvData]);
  const timed = rows.length > 1 && rows.every(r => Number.isFinite(r.timestamp_s));
  const start = timed ? rows[0].timestamp_s : 0;
  const duration = timed ? rows[rows.length - 1].timestamp_s - start : 0;
  timeRef.current = time;
  useEffect(() => {
    if (!playing || !timed || duration <= 0) return;
    const startWall = performance.now(), startLap = timeRef.current;
    let frame, lastPaint = 0;
    const tick = now => {
      const next = Math.min(duration, startLap + (now - startWall) / 1000 * speed);
      if (now - lastPaint >= 33 || next >= duration) { setTime(next); lastPaint = now; }
      if (next >= duration) setPlaying(false); else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, timed, duration, speed]);
  const index = useMemo(() => {
    let lo = 0, hi = rows.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (rows[mid].timestamp_s <= start + time) lo = mid; else hi = mid - 1; }
    return lo;
  }, [rows, start, time]);
  const chartData = useMemo(() => sampleExtrema(rows), [rows]);
  const point = rows[index] || {};
  const hasDistance = rows.every(r => Number.isFinite(r.arc_length_m));
  return <div className={embedded ? 'replay-workspace' : 'standalone-workspace'}>
    {!embedded && <div className="page-heading"><div><div className="eyebrow">V–QUALIA</div><h1>Lap replay</h1></div><a className="button secondary" href="#/predict">Workspace</a></div>}
    {loading ? <p className="status-message">Loading telemetry…</p> : error ? <p role="alert" className="error-message">{error}</p> : !timed || duration <= 0 ? <p className="empty-panel">Replay requires increasing timestamp_s or Time values. Inspect other channels in Telemetry.</p> : <>
      <div className="replay-controls"><button className="button primary" aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={() => { if (time >= duration) setTime(0); setPlaying(!playing); }}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Play'}</button>
        <button className="icon-button" aria-label="Restart replay" onClick={() => { setPlaying(false); setTime(0); }}><RotateCcw size={16} /></button>
        <label>Playback speed<select value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[.25, .5, 1, 2, 4].map(s => <option key={s} value={s}>{s}×</option>)}</select></label><output>{formatLap(time)} / {formatLap(duration)}</output></div>
      <label className="cursor-control">Lap time<input aria-label="Replay position" type="range" min="0" max={duration} step=".01" value={time} onChange={e => { setPlaying(false); setTime(Number(e.target.value)); }} /></label>
      <div className="metric-strip">{[['Speed', point.speed_kmh, 'km/h'], ['Gear', point.gear, ''], ['RPM', point.rpm, 'rpm'], ['Lateral', point.g_lat, 'g']].map(([label, n, unit]) => <div key={label}><span>{label}</span><strong>{formatValue(n, label === 'Gear' || label === 'RPM' ? 0 : 1)}<small>{unit}</small></strong></div>)}</div>
      <div className="plot-grid"><TrackPlot data={rows} cursor={index} title="Vehicle position" progress={hasDistance ? (point.arc_length_m - rows[0].arc_length_m) / Math.max(1, rows[rows.length - 1].arc_length_m - rows[0].arc_length_m) : index / Math.max(1, rows.length - 1)} /><TracePlot data={chartData} title="Speed trace" units="km/h" channels={[{ key: 'speed_kmh', label: 'Speed' }]} cursor={point[hasDistance ? 'arc_length_m' : 'timestamp_s']} xKey={hasDistance ? 'arc_length_m' : 'timestamp_s'} xLabel={hasDistance ? 'Distance / m' : 'Time / s'} /></div>
      <p className="method-note">Playback follows telemetry timestamps. Display updates are limited to about 30 Hz to reduce CPU use; the underlying samples are retained.</p>
    </>}
  </div>;
}
