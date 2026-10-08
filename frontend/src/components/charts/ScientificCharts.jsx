import { useId, useMemo, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import { colors, formatValue } from '../../utils/chartFormatting';

export function ChartFrame({ title, units, formula, children }) {
  const [expanded, setExpanded] = useState(false);
  return <section className={`plot-panel ${expanded ? 'plot-expanded' : ''}`}>
    <div className="plot-heading"><h3>{title} <span>{units}</span></h3><button className="icon-button" aria-label={`${expanded ? 'Restore' : 'Expand'} ${title}`} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button></div>
    <div className="plot-body">{children}</div>{formula && <div className="formula">{formula}</div>}
  </section>;
}

export function TracePlot({ data, channels, title, units, formula, xKey = 'arc_length_m', xLabel = 'Distance / m', xUnit, cursor, domain = ['auto', 'auto'], syncId = 'lap-traces' }) {
  const available = channels.filter(c => data.some(r => typeof r[c.key] === 'number' && Number.isFinite(r[c.key])));
  if (!available.length) return null;
  return <ChartFrame title={title} units={units} formula={formula}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 18, bottom: 18, left: 3 }} syncId={syncId} syncMethod="value">
    <CartesianGrid stroke="#293744" strokeDasharray="2 4" vertical={false} />
    <XAxis dataKey={xKey} type="number" domain={['dataMin', 'dataMax']} tickFormatter={v => Math.round(v)} tick={{ fill: '#8f9ea9', fontSize: 10 }} label={{ value: xLabel, position: 'insideBottom', offset: -12, fill: '#8f9ea9', fontSize: 11 }} />
    <YAxis domain={domain} tick={{ fill: '#8f9ea9', fontSize: 10 }} tickFormatter={v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : Number(v.toFixed(1))} width={47} />
    <Tooltip contentStyle={{ background: '#15212b', border: '1px solid #415360', borderRadius: 3, fontSize: 12 }} formatter={(v, name) => [formatValue(v, 2), name]} labelFormatter={v => `${formatValue(v)} ${xUnit || (xKey === 'timestamp_s' ? 's' : xKey === 'index' ? 'sample' : 'm')}`} />
    <Legend verticalAlign="top" height={25} iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
    {available.map((c, i) => <Line key={c.key} type={c.step ? 'stepAfter' : 'linear'} dataKey={c.key} name={c.label} stroke={c.color || colors[i % colors.length]} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls={false} />)}
    {cursor != null && <ReferenceLine x={cursor} stroke="#b5c4ce" strokeDasharray="3 3" />}
  </LineChart></ResponsiveContainer></ChartFrame>;
}

export function TrackPlot({ data, cursor = 0, title = 'Plan view', animated = false, progress }) {
  const id = useId().replace(/:/g, '');
  const geometry = useMemo(() => {
    const rows = data.filter(r => Number.isFinite(r.pos_x_m ?? r.x) && Number.isFinite(r.pos_y_m ?? r.y));
    if (!rows.length) return null;
    const xs = rows.map(r => r.pos_x_m ?? r.x), ys = rows.map(r => r.pos_y_m ?? r.y);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < xs.length; i++) { minX = Math.min(minX, xs[i]); maxX = Math.max(maxX, xs[i]); minY = Math.min(minY, ys[i]); maxY = Math.max(maxY, ys[i]); }
    const scale = 270 / Math.max(maxX - minX, maxY - minY, 1), ox = (320 - (maxX - minX) * scale) / 2, oy = (320 - (maxY - minY) * scale) / 2;
    const points = rows.map((r, i) => [ox + (xs[i] - minX) * scale, 320 - oy - (ys[i] - minY) * scale]);
    const closed = [...points, points[0]].map(p => p.join(',')).join(' ');
    return { points, closed, scale, minX, maxX, minY, maxY };
  }, [data]);
  if (!geometry) return <div className="empty-panel">Track coordinates unavailable</div>;
  const point = geometry.points[Math.min(cursor, geometry.points.length - 1)];
  return <ChartFrame title={title} units="m · equal aspect" formula={animated ? 'Preparing the circuit and solving the lap…' : 'Physical X/Y coordinates; equal scale on both axes.'}><svg viewBox="0 0 320 320" className="track-plot" role="img" aria-label={animated ? `${title} circuit filling while solving` : title}>
    <defs><pattern id={`track-grid-${id}`} width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#243441" strokeWidth=".5" /></pattern>
      <linearGradient id={`track-fill-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c1d4db" /><stop offset=".5" stopColor="#95b6c0" /><stop offset="1" stopColor="#75a6b8" /></linearGradient>
    </defs>
    <rect width="320" height="320" fill={`url(#track-grid-${id})`} />
    <polyline points={geometry.closed} fill="#95b6c0" fillOpacity=".035" stroke="#425d6c" strokeWidth="3" strokeLinejoin="round" />
    <polyline points={geometry.closed} fill="none" stroke={`url(#track-fill-${id})`} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" pathLength="100" strokeDasharray="100" strokeDashoffset={progress == null ? 0 : 100 * (1 - Math.max(0, Math.min(1, progress)))} className={animated ? 'circuit-filling' : 'circuit-trace'} />
    {!animated && <circle cx={point[0]} cy={point[1]} r="3.5" fill="#c1d4db" />}<text x="10" y="308" fill="#879ba8" fontSize="9">X {formatValue(geometry.minX, 0)}…{formatValue(geometry.maxX, 0)} m · Y {formatValue(geometry.minY, 0)}…{formatValue(geometry.maxY, 0)} m</text>
  </svg></ChartFrame>;
}
