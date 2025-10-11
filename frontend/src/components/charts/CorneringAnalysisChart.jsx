import { ResponsiveContainer, ScatterChart, CartesianGrid, XAxis, YAxis, Tooltip, Scatter, Cell } from 'recharts';

const CorneringAnalysisChart = ({ telemetryData, stats }) => {
  if (!telemetryData || !stats) return null;

  const data = telemetryData
    .filter(d => d.radius_m < 500 && d.radius_m > 0 && Math.abs(d.g_lat) > 0.5)
    .map(d => ({ ...d, g_lat: Math.abs(d.g_lat) }));

  const gearColors = [
    '#9ca3af', '#60a5fa', '#3b82f6', '#1d4ed8', '#0ea5e9',
    '#06b6d4', '#ec4899', '#be185d', '#86198f'
  ];

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">Cornering Analysis by Gear</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <CartesianGrid stroke="#374151" />
          <XAxis
            type="number"
            dataKey="radius_m"
            name="Corner Radius"
            unit="m"
            stroke="#9ca3af"
            domain={[0, 'dataMax']}
          />
          <YAxis
            type="number"
            dataKey="g_lat"
            name="Lateral G"
            unit=" G"
            stroke="#9ca3af"
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: 'rgba(10,20,30,0.8)',
              border: '1px solid #06b6d4',
              backdropFilter: 'blur(5px)'
            }}
            itemStyle={{ color: '#e7e5e4' }}
          />
          <Scatter name="G-Force vs Radius" data={data}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fillOpacity={0.7}
                fill={gearColors[entry.gear] || '#ffffff'}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CorneringAnalysisChart;


