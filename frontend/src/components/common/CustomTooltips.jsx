// Custom cursor for track layout chart
export const CustomCursor = ({ points }) => {
  if (!points || points.length === 0) {
    return null;
  }
  const { x, y } = points[0];
  return (
    <circle
      cx={x}
      cy={y}
      r={8}
      stroke="#fcf003"
      strokeWidth={2}
      fill="#fcf003"
      fillOpacity={0.5}
    />
  );
};

// Custom tooltip for track visualization
export const CustomTrackTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-black/60 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-3 text-white text-sm">
        <p className="font-bold text-cyan-400">Point: {data.index}</p>
        <p>Speed: {data.speed.toFixed(1)} km/h</p>
        <p>X: {data.x.toFixed(2)}m | Y: {data.y.toFixed(2)}m</p>
      </div>
    );
  }
  return null;
};


