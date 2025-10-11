import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from 'recharts';

const ThrottleBrakeChart = ({ telemetryData }) => {
  if (!telemetryData) return null;

  const getThrottleBrakeApplication = () => {
    let throttleOnly = 0, brakeOnly = 0, coasting = 0;
    telemetryData.forEach(d => {
      if (d.throttle_pct > 5 && d.brake_pct < 5) throttleOnly++;
      else if (d.brake_pct > 5 && d.throttle_pct < 5) brakeOnly++;
      else if (d.throttle_pct < 5 && d.brake_pct < 5) coasting++;
    });
    const total = telemetryData.length;
    return [
      { name: 'Throttle', value: parseFloat(((throttleOnly / total) * 100).toFixed(1)) },
      { name: 'Coasting', value: parseFloat(((coasting / total) * 100).toFixed(1)) },
      { name: 'Brake', value: parseFloat(((brakeOnly / total) * 100).toFixed(1)) },
    ];
  };

  const data = getThrottleBrakeApplication();

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">Pedal Application</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <defs>
            <linearGradient id="yellowGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="5%" stopColor="#fcf003" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#facc15" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" stroke="#9ca3af" unit="%" />
          <YAxis type="category" dataKey="name" stroke="#9ca3af" width={80} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(10,20,30,0.8)',
              border: '1px solid #fcf003',
              backdropFilter: 'blur(5px)'
            }}
            itemStyle={{ color: '#e7e5e4' }}
          />
          <Bar dataKey="value" name="% of Lap">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="url(#yellowGradient)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ThrottleBrakeChart;


