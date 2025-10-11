import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

const SpeedOverDistanceChart = ({ telemetryData }) => {
  if (!telemetryData) return null;

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">Speed Over Distance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={telemetryData} syncId="lapSync">
          <defs>
            <linearGradient id="speedDistGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            dataKey="arc_length_m"
            name="Distance"
            unit="m"
            stroke="#9ca3af"
            domain={[0, 'dataMax']}
          />
          <YAxis stroke="#9ca3af" name="Speed" unit="km/h" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(10,20,30,0.8)',
              border: '1px solid #8b5cf6',
              backdropFilter: 'blur(5px)'
            }}
            itemStyle={{ color: '#e7e5e4' }}
          />
          <Area
            type="monotone"
            dataKey="speed_kmh"
            stroke="#8b5cf6"
            fill="url(#speedDistGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SpeedOverDistanceChart;


