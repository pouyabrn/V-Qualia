import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { TracePlot } from '../charts/ScientificCharts';
import { formatValue } from '../../utils/chartFormatting';
export default function LiveStandalone() {
  const [running, setRunning] = useState(false), [rows, setRows] = useState([]);
  const sample = useRef(0);
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      const t = ++sample.current / 10;
      const next = { timestamp_s: t, speed_kmh: 190 + 95 * Math.sin(t * .5), rpm: 10500 + 3000 * Math.sin(t * .5),
        g_lat: 2.5 * Math.sin(t * .4), g_long: 1.7 * Math.cos(t * .5), throttle_pct: 50 + 50 * Math.cos(t * .5) };
      setRows(previous => [...previous.slice(-299), next]);
    }, 100);
    return () => clearInterval(interval);
  }, [running]);
  const latest = rows[rows.length - 1] || {};
  const common = { data: rows, xKey: 'timestamp_s', xLabel: 'Demo time / s', xUnit: 's' };
  return <section className="demo-workspace"><div className="dataset-bar"><span className="tag">SYNTHETIC DEMONSTRATION · 10 Hz · NO VEHICLE FEED</span>
    <button className="button" onClick={() => setRunning(!running)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Pause demonstration' : 'Start demonstration'}</button>
    <button className="icon-button" aria-label="Reset demonstration" onClick={() => { setRunning(false); setRows([]); sample.current = 0; }}><RotateCcw size={15} /></button></div>
    <div className="metric-strip">{[['Speed', latest.speed_kmh, 'km/h'], ['Engine speed', latest.rpm, 'rpm'], ['Longitudinal', latest.g_long, 'g'], ['Lateral', latest.g_lat, 'g']].map(([label, value, unit]) => <div key={label}><span>{label}</span><strong>{formatValue(value)}<small>{unit}</small></strong></div>)}</div>
    <div className="plot-grid"><TracePlot {...common} title="Demonstration speed" units="km/h" channels={[{ key: 'speed_kmh', label: 'Synthetic speed' }]} /><TracePlot {...common} title="Demonstration acceleration" units="g" channels={[{ key: 'g_long', label: 'Synthetic longitudinal' }, { key: 'g_lat', label: 'Synthetic lateral' }]} /></div>
    <p className="method-note">Generated mathematical signals illustrate the interface. No physical vehicle model or measured stream supplies these values. At most 300 samples are kept in memory.</p>
  </section>;
}
