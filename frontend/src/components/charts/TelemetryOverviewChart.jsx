import { useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

const TelemetryOverviewChart = ({ telemetryData }) => {
  const [hiddenSeries, setHiddenSeries] = useState([]);

  if (!telemetryData) return null;

  const seriesConfig = [
    { name: 'Speed', dataKey: 'speed_kmh', color: '#22d3ee' },
    { name: 'RPM', dataKey: 'rpm', color: '#fcf003' },
    { name: 'Throttle', dataKey: 'throttle_pct', color: '#030ffc' },
    { name: 'Brake', dataKey: 'brake_pct', color: '#ef4444' }
  ];

  const toggleSeries = (dataKey) => {
    setHiddenSeries(prev =>
      prev.includes(dataKey) ? prev.filter(key => key !== dataKey) : [...prev, dataKey]
    );
  };

  return (
    <div className="card-gradient">
      <h3 className="text-2xl font-semibold mb-4 text-cyan-300">Telemetry Overview</h3>
      <div className="flex justify-center gap-2 md:gap-4 mb-4 flex-wrap">
        {seriesConfig.map(series => (
          <button
            key={series.dataKey}
            onClick={() => toggleSeries(series.dataKey)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all text-xs md:text-sm border ${
              !hiddenSeries.includes(series.dataKey)
                ? 'text-white'
                : 'bg-transparent text-gray-500 border-gray-700 hover:bg-gray-800'
            }`}
            style={{
              backgroundColor: !hiddenSeries.includes(series.dataKey)
                ? `${series.color}33`
                : undefined,
              borderColor: !hiddenSeries.includes(series.dataKey) ? series.color : undefined
            }}
          >
            {series.name}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={telemetryData}>
          <defs>
            <linearGradient id="throttleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={seriesConfig[2].color} stopOpacity={0.8} />
              <stop offset="95%" stopColor={seriesConfig[2].color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="brakeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={seriesConfig[3].color} stopOpacity={0.8} />
              <stop offset="95%" stopColor={seriesConfig[3].color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
          <XAxis dataKey="index" stroke="#9ca3af" />
          <YAxis yAxisId="percent" orientation="left" stroke="#888" domain={[0, 100]} />
          <YAxis yAxisId="speed" orientation="right" stroke="#888" />
          <YAxis yAxisId="rpm" orientation="right" stroke="#888" hide={true} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(10, 20, 30, 0.8)',
              border: '1px solid #06b6d4',
              backdropFilter: 'blur(5px)'
            }}
            labelStyle={{ color: '#06b6d4' }}
            itemStyle={{ color: '#e7e5e4' }}
          />
          <Area
            yAxisId="percent"
            type="monotone"
            dataKey="throttle_pct"
            fill="url(#throttleGradient)"
            stroke={seriesConfig[2].color}
            name="Throttle"
            hide={hiddenSeries.includes('throttle_pct')}
          />
          <Area
            yAxisId="percent"
            type="monotone"
            dataKey="brake_pct"
            fill="url(#brakeGradient)"
            stroke={seriesConfig[3].color}
            name="Brake"
            hide={hiddenSeries.includes('brake_pct')}
          />
          <Line
            yAxisId="speed"
            type="monotone"
            dataKey="speed_kmh"
            stroke={seriesConfig[0].color}
            name="Speed"
            dot={false}
            strokeWidth={2}
            hide={hiddenSeries.includes('speed_kmh')}
          />
          <Line
            yAxisId="rpm"
            type="monotone"
            dataKey="rpm"
            stroke={seriesConfig[1].color}
            name="RPM"
            dot={false}
            strokeWidth={2}
            hide={hiddenSeries.includes('rpm')}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TelemetryOverviewChart;


