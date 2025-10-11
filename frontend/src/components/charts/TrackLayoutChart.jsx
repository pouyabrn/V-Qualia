import { ResponsiveContainer, ScatterChart, XAxis, YAxis, Tooltip, Scatter, Cell } from 'recharts';
import { Target } from 'lucide-react';
import { CustomCursor, CustomTrackTooltip } from '../common/CustomTooltips';

const TrackLayoutChart = ({ telemetryData, fileName, stats }) => {
  if (!telemetryData) return null;

  const xCoords = telemetryData.map(d => d.pos_x_m);
  const yCoords = telemetryData.map(d => d.pos_y_m);
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);
  const xRange = maxX - minX;
  const yRange = maxY - minY;
  const maxRange = Math.max(xRange, yRange);
  const xCenter = (minX + maxX) / 2;
  const yCenter = (minY + maxY) / 2;
  const domain = {
    x: [xCenter - maxRange / 2, xCenter + maxRange / 2],
    y: [yCenter - maxRange / 2, yCenter + maxRange / 2]
  };

  const trackData = telemetryData.map(d => ({
    x: d.pos_x_m,
    y: d.pos_y_m,
    speed: d.speed_kmh,
    index: d.index
  }));
  const maxSpeed = stats ? stats.maxSpeed : 300;

  const getSpeedColor = (speed, maxSpeed) => {
    const percentage = speed / (maxSpeed || 1);
    if (percentage < 0.33) return '#67e8f9';
    if (percentage < 0.66) return '#030ffc';
    return '#ec4899';
  };

  const formatTrackName = (name) => {
    if (!name) return 'Track Layout';
    return name.replace('.csv', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="card-gradient">
      <h3 className="text-2xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
        <Target className="w-6 h-6" /> {formatTrackName(fileName)}
      </h3>
      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }} syncId="lapSync">
          <XAxis type="number" dataKey="x" hide domain={domain.x} />
          <YAxis type="number" dataKey="y" hide domain={domain.y} />
          <Tooltip cursor={<CustomCursor />} content={<CustomTrackTooltip />} />
          <Scatter
            data={trackData}
            line={{ stroke: '#9ca3af', strokeWidth: 4 }}
            shape="circle"
          >
            {trackData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getSpeedColor(entry.speed, maxSpeed)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrackLayoutChart;


