import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from 'recharts';

const GearUsageChart = ({ telemetryData }) => {
  if (!telemetryData) return null;

  const getGearDistribution = () => {
    const gearCounts = {};
    telemetryData.forEach(d => {
      if (d.gear > 0) {
        gearCounts[d.gear] = (gearCounts[d.gear] || 0) + 1;
      }
    });
    return Object.entries(gearCounts)
      .map(([gear, count]) => ({ gear: parseInt(gear), count }))
      .sort((a, b) => a.gear - b.gear)
      .map(({ gear, count }) => ({
        gear: `Gear ${gear}`,
        percentage: parseFloat((count / telemetryData.length * 100).toFixed(1))
      }));
  };

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-4 text-cyan-300">Gear Usage</h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={getGearDistribution()}>
          <PolarGrid stroke="#374151" />
          <PolarAngleAxis dataKey="gear" stroke="#9ca3af" />
          <PolarRadiusAxis angle={30} domain={[0, 'dataMax + 10']} stroke="#374151" />
          <Radar
            name="Usage %"
            dataKey="percentage"
            stroke="#06b6d4"
            fill="#06b6d4"
            fillOpacity={0.6}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(10,20,30,0.8)',
              border: '1px solid #06b6d4',
              backdropFilter: 'blur(5px)'
            }}
            itemStyle={{ color: '#e7e5e4' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GearUsageChart;


