import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const RpmGearChart = ({ telemetryData }) => {
  if (!telemetryData) return null;

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">RPM & Gear</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={telemetryData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="index" stroke="#9ca3af" />
          <YAxis yAxisId="left" stroke="#fcf003" />
          <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
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
            yAxisId="left"
            type="monotone"
            dataKey="rpm"
            stroke="#fcf003"
            name="RPM"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="step"
            dataKey="gear"
            stroke="#10b981"
            name="Gear"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RpmGearChart;


