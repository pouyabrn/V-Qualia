import { ResponsiveContainer, ScatterChart, CartesianGrid, XAxis, YAxis, Tooltip, Scatter } from 'recharts';

const SteeringVsGChart = ({ telemetryData }) => {
  if (!telemetryData) return null;

  const data = telemetryData.filter(d => Math.abs(d.g_lat) > 0.5);

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">Steering vs Lateral G</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <CartesianGrid stroke="#374151" />
          <XAxis
            type="number"
            dataKey="steering_angle_rad"
            name="Steering Angle"
            unit="rad"
            stroke="#9ca3af"
          />
          <YAxis
            type="number"
            dataKey="g_lat"
            name="Lateral G"
            unit="G"
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
          <Scatter name="Steer/G" data={data} fill="#06b6d4" fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SteeringVsGChart;


