import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const AeroForcesChart = ({ telemetryData }) => {
  if (!telemetryData) return null;

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">Aerodynamic Forces</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={telemetryData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="speed_kmh" name="Speed" unit="km/h" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" unit="N" />
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
            dataKey="downforce_n"
            name="Downforce"
            stroke="#f472b6"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="drag_force_n"
            name="Drag"
            stroke="#f87171"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AeroForcesChart;


