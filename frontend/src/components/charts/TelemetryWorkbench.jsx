import { useMemo, useState } from 'react';
import { TracePlot, TrackPlot } from './ScientificCharts';
import { formatLap, formatValue } from '../../utils/chartFormatting';
import { sampleExtrema } from '../../utils/csvParser';
import { calculateStats, cumulativeEnergy } from '../../utils/telemetryCalculations';

export default function TelemetryWorkbench({ data, source = 'Telemetry' }) {
  const [index, setIndex] = useState(0);
  const [group, setGroup] = useState('dynamics');
  const stats = useMemo(() => calculateStats(data), [data]);
  const chartData = useMemo(() => sampleExtrema(cumulativeEnergy(data), 1200,
    group === 'powertrain' ? ['speed_kmh', 'rpm', 'gear', 'ers_power_kw'] :
    group === 'geometry' ? ['speed_kmh', 'curvature_inv_m', 'pos_z_m', 'banking_rad'] :
    ['speed_kmh', 'brake_pct', 'g_lat', 'g_long', 'grip_usage', 'fz_front_n', 'fz_rear_n']), [data, group]);
  const point = data[Math.min(index, data.length - 1)];
  const hasDistance = data.every(r => Number.isFinite(r.arc_length_m));
  const xKey = hasDistance ? 'arc_length_m' : data.every(r => Number.isFinite(r.timestamp_s)) ? 'timestamp_s' : 'index';
  const common = { data: chartData, cursor: point[xKey], xKey, xLabel: xKey === 'arc_length_m' ? 'Distance / m' : xKey === 'timestamp_s' ? 'Time / s' : 'Sample index' };
  return <div className="telemetry-workbench">
    <div className="metric-strip">{[['Lap duration', formatLap(stats.lapTime), 's'], ['Maximum speed', formatValue(stats.maxSpeed), 'km/h'], ['Time-weighted speed', formatValue(stats.avgSpeed), 'km/h'], ['Path length', formatValue(stats.distance, 3), 'km']].map(([label, value, unit]) => <div key={label}><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>)}</div>
    <div className="trace-controls"><div className="segmented" aria-label="Channel group">{['dynamics', 'powertrain', 'geometry'].map(g => <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}</div><span className="source-label">{source} · {data.length.toLocaleString()} samples</span></div>
    <label className="cursor-control">Inspection cursor <input type="range" min="0" max={data.length - 1} value={Math.min(index, data.length - 1)} onChange={e => setIndex(Number(e.target.value))} /><output>{formatValue(point.arc_length_m, 0)} m · {formatValue(point.speed_kmh)} km/h</output></label>
    <div className="plot-grid">
      <TracePlot {...common} title="Speed" units="km/h" channels={[{ key: 'speed_kmh', label: 'Vehicle speed' }]} formula="T = ∫ ds / v(s) · Vavg = (1/T) ∫ v(t) dt" />
      {group === 'dynamics' && <>
        <TracePlot {...common} title="Driver demand" units="%" domain={[0, 100]} channels={[{ key: 'throttle_pct', label: 'Throttle' }, { key: 'brake_pct', label: 'Brake', color: '#ed7180' }]} formula={source === 'Simulated telemetry' ? 'Demand inferred by the simulator; controls are not measured driver inputs.' : 'Control channels from the imported file; missing values remain missing.'} />
        <TracePlot {...common} title="Acceleration" units="g" channels={[{ key: 'g_long', label: 'Longitudinal' }, { key: 'g_lat', label: 'Lateral' }]} formula="gx = ax / g₀ · gy = ay / g₀ · g₀ = 9.81 m/s²" />
        <TracePlot {...common} title="Tire capacity usage" units="ratio" channels={[{ key: 'grip_usage', label: 'Combined demand' }]} formula="Model grip usage; values near 1 indicate operation near the tire limit." />
        <TracePlot {...common} title="Axle normal loads" units="N" channels={[{ key: 'fz_front_n', label: 'Front' }, { key: 'fz_rear_n', label: 'Rear' }]} formula="Fz,f + Fz,r = road-normal weight + downforce (with road-profile corrections)." />
        <TrackPlot data={data} cursor={index} />
      </>}
      {group === 'powertrain' && <>
        <TracePlot {...common} title="Engine speed" units="rpm" channels={[{ key: 'rpm', label: 'Engine' }]} formula="RPM = v · gear ratio · final drive · 60 / (2πr)" />
        <TracePlot {...common} title="Gear & DRS" units="state" channels={[{ key: 'gear', label: 'Gear', step: true }, { key: 'drs_open', label: 'DRS open', step: true }]} />
        <TracePlot {...common} title="Hybrid deployment" units="kW" channels={[{ key: 'ers_power_kw', label: 'ERS power' }]} />
        {data.some(r => Number.isFinite(r.ers_power_kw)) && <TracePlot {...common} title="Deployed energy" units="MJ" channels={[{ key: 'deployed_energy_mj', label: 'Gross deployed energy' }]} formula="Edeploy = ∫ PERS dt · Gross deployment differs from the solver's net energy budget." />}
      </>}
      {group === 'geometry' && <>
        <TrackPlot data={data} cursor={index} />
        <TracePlot {...common} title="Curvature" units="m⁻¹" channels={[{ key: 'curvature_inv_m', label: 'κ' }]} formula="ay ≈ v²κ on flat road · sign follows the track coordinate convention." />
        <TracePlot {...common} title="Elevation" units="m" channels={[{ key: 'pos_z_m', label: 'Height' }]} />
        <TracePlot {...common} title="Banking & steer" units="rad" channels={[{ key: 'banking_rad', label: 'Banking' }, { key: 'steering_angle_rad', label: 'Steering' }]} />
      </>}
    </div><p className="method-note">Plots preserve local extrema when reducing samples. Statistics use the complete dataset. Missing channels are omitted.</p>
  </div>;
}
