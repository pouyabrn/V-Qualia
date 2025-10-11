import { ResponsiveContainer, ScatterChart, CartesianGrid, XAxis, YAxis, Tooltip, Scatter, Cell } from 'recharts';

const GForceVsSpeedChart = ({ telemetryData, stats }) => {
  if (!telemetryData || !stats) return null;

  const data = telemetryData.filter(d => d.g_total > 1.0);

  const getGColor = (d) => {
    if (d.g_long > 0.3) return '#10b981';
    if (d.g_long < -0.3) return '#ef4444';
    return '#60a5fa';
  };

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">G-Force vs. Speed</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <CartesianGrid stroke="#374151" />
          <XAxis
            type="number"
            dataKey="speed_kmh"
            name="Speed"
            unit="km/h"
            stroke="#9ca3af"
            domain={[0, 'dataMax']}
          />
          <YAxis
            type="number"
            dataKey="g_total"
            name="Total G-Force"
            unit=" G"
            stroke="#9ca3af"
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: 'rgba(10,20,30,0.8)',
              border: '1px solid #10b981',
              backdropFilter: 'blur(5px)'
            }}
            itemStyle={{ color: '#e7e5e4' }}
          />
          <Scatter name="G-Force" data={data}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fillOpacity={0.7} fill={getGColor(entry)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GForceVsSpeedChart;


