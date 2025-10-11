import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const GForceTraceChart = ({ telemetryData }) => {
  if (!telemetryData) return null;

  return (
    <div className="card-gradient col-span-1 lg:col-span-2">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">G-Force Trace</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={telemetryData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="index" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" domain={[-4, 4]} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(10,20,30,0.8)',
              border: '1px solid #06b6d4',
              backdropFilter: 'blur(5px)'
            }}
            itemStyle={{ color: '#e7e5e4' }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="g_long"
            name="Longitudinal"
            stroke="#06b6d4"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="g_lat"
            name="Lateral"
            stroke="#8b5cf6"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GForceTraceChart;


