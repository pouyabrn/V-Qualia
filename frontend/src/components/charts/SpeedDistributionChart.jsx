import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

const SpeedDistributionChart = ({ telemetryData }) => {
  if (!telemetryData) return null;

  const getSpeedDistribution = () => {
    const speedBands = [
      { range: '0-100 km/h', count: 0 },
      { range: '100-150 km/h', count: 0 },
      { range: '150-200 km/h', count: 0 },
      { range: '200-250 km/h', count: 0 },
      { range: '250+ km/h', count: 0 },
    ];
    telemetryData.forEach(d => {
      const speed = d.speed_kmh;
      if (speed < 100) speedBands[0].count++;
      else if (speed < 150) speedBands[1].count++;
      else if (speed < 200) speedBands[2].count++;
      else if (speed < 250) speedBands[3].count++;
      else speedBands[4].count++;
    });
    return speedBands;
  };

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">Speed Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={getSpeedDistribution()}>
          <defs>
            <linearGradient id="speedDistributionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="range" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(10,20,30,0.8)',
              border: '1px solid #f43f5e',
              backdropFilter: 'blur(5px)'
            }}
            itemStyle={{ color: '#e7e5e4' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Data Points"
            stroke="#f43f5e"
            fill="url(#speedDistributionGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SpeedDistributionChart;


