import { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartFrame } from './ScientificCharts';
import { prepareChartData } from '../../utils/chartLab';
import { formatValue } from '../../utils/chartFormatting';

const domain = (config, axis) => ['Min', 'Max'].map((end, i) => config[axis + end] === '' || config[axis + end] == null ? ['auto', 'auto'][i] : Number(config[axis + end]));
export default function CustomTelemetryPlot({ dataset, config }) {
  const rows = useMemo(() => prepareChartData(dataset.rows, config), [dataset, config]);
  const right = config.series.some(s => s.axis === 'right');
  return <ChartFrame title={config.title} units={config.mode === 'scatter' ? 'XY · scatter' : 'TRACE'} formula={`X: ${config.xLabel || config.x} · ${dataset.rows.length.toLocaleString()} source rows / ${rows.length.toLocaleString()} display points. ${config.mode === 'scatter' ? 'Uniform thinning; point density is not a probability estimate.' : 'Local extrema retained; missing spans break traces.'}`}>
    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{ top: 15, right: right ? 12 : 22, bottom: 18, left: 8 }}>
      <CartesianGrid stroke="#26333c" strokeDasharray="2 6" vertical={false} />
      <XAxis dataKey={config.x} type="number" domain={domain(config, 'x')} allowDataOverflow tick={{ fill: '#9aa9b3', fontSize: 10 }} tickFormatter={n => formatValue(n, 1)} label={{ value: config.xLabel || config.x, position: 'insideBottom', offset: -12, fill: '#a6b8c4', fontSize: 11 }} />
      <YAxis yAxisId="left" domain={domain(config, 'left')} allowDataOverflow width={62} tick={{ fill: '#9aa9b3', fontSize: 10 }} tickFormatter={n => formatValue(n, 1)} label={{ value: config.leftLabel, angle: -90, position: 'insideLeft', fill: '#a6b8c4', fontSize: 10 }} />
      {right && <YAxis yAxisId="right" orientation="right" domain={domain(config, 'right')} allowDataOverflow width={62} tick={{ fill: '#9aa9b3', fontSize: 10 }} tickFormatter={n => formatValue(n, 1)} label={{ value: config.rightLabel, angle: 90, position: 'insideRight', fill: '#a6b8c4', fontSize: 10 }} />}
      <Tooltip contentStyle={{ background: '#0b121a', border: '1px solid #617687', borderRadius: 0, fontSize: 11 }} formatter={(v, name) => [formatValue(v, 3), name]} labelFormatter={v => `${config.xLabel || config.x}: ${formatValue(v, 3)}`} />
      <Legend verticalAlign="top" iconType="plainline" wrapperStyle={{ fontSize: 10 }} />
      {config.series.map(s => config.mode === 'scatter' ? <Scatter key={s.key} dataKey={s.key} yAxisId={s.axis} name={s.label || s.key} fill={s.color} isAnimationActive={false} /> :
        <Line key={s.key} dataKey={s.key} yAxisId={s.axis} type={config.mode === 'step' ? 'stepAfter' : 'linear'} name={s.label || s.key} stroke={s.color} strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />)}
    </ComposedChart></ResponsiveContainer>
  </ChartFrame>;
}
