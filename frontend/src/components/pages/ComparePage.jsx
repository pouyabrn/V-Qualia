import { useState, useMemo, useRef } from 'react';
import { Upload, X, GitCompare, TrendingUp, TrendingDown, FileCheck, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ScatterChart, Scatter, Cell } from 'recharts';
import { parseCSV } from '../../utils/csvParser';
import { calculateStats } from '../../utils/telemetryCalculations';
import { toast } from '../../utils/toast';

// Cyberpunk color palette (up to 10 CSVs)
const CYBERPUNK_COLORS = [
  '#00f0ff', // Cyan
  '#fcf003', // Bright Yellow
  '#ff00ff', // Magenta
  '#00ff88', // Neon Green
  '#ff2a6d', // Hot Pink
  '#05d9e8', // Electric Blue
  '#d1f7ff', // Ice Blue
  '#fee800', // Electric Yellow
  '#b967ff', // Purple
  '#ff6c11', // Orange
];

const ComparePage = () => {
  const [csvFiles, setCsvFiles] = useState([]);
  const [maxFiles] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Calculate statistics for all files
  const allStats = useMemo(() => {
    return csvFiles.map(csv => ({
      ...csv,
      stats: calculateStats(csv.data)
    }));
  }, [csvFiles]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    await processFiles(files);
    if (event.target) event.target.value = '';
  };

  const processFiles = async (files) => {
    if (!files || files.length === 0) return;

    if (csvFiles.length + files.length > maxFiles) {
      toast.warning(`Maximum ${maxFiles} CSV files allowed. Adding first ${maxFiles - csvFiles.length} files.`);
      files = files.slice(0, maxFiles - csvFiles.length);
    }

    setIsProcessing(true);
    let successCount = 0;

    for (const file of files) {
      try {
        if (!file.name.endsWith('.csv')) {
          toast.error(`${file.name}: Must be a CSV file`);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: File too large (max 10MB)`);
          continue;
        }

        const text = await file.text();
        const data = parseCSV(text);

        if (!data || data.length === 0) {
          toast.error(`${file.name}: No data found`);
          continue;
        }

        setCsvFiles(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name.replace('.csv', ''),
          data: data,
          color: CYBERPUNK_COLORS[(prev.length) % CYBERPUNK_COLORS.length]
        }]);

        successCount++;
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        toast.error(`${file.name}: Failed to parse`);
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      toast.success(`Successfully loaded ${successCount} file${successCount > 1 ? 's' : ''}`);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    if (files.length > 0) {
      await processFiles(files);
    } else {
      toast.warning('Please drop CSV files only');
    }
  };

  const removeFile = (id) => {
    const file = csvFiles.find(f => f.id === id);
    setCsvFiles(prev => prev.filter(f => f.id !== id));
    toast.info(`Removed ${file?.name || 'file'}`);
  };

  const clearAll = () => {
    if (window.confirm('Remove all files?')) {
      setCsvFiles([]);
      toast.info('All files removed');
    }
  };

  const prepareChartData = (dataKey) => {
    if (csvFiles.length === 0) return [];

    const maxLength = Math.max(...csvFiles.map(f => f.data.length));
    
    const chartData = [];
    for (let i = 0; i < maxLength; i++) {
      const point = { index: i };
      csvFiles.forEach(csv => {
        if (i < csv.data.length) {
          point[csv.id] = csv.data[i][dataKey];
        }
      });
      chartData.push(point);
    }
    
    return chartData;
  };

  const prepareGearData = () => {
    const gearData = [];
    
    csvFiles.forEach(csv => {
      const gearCounts = {};
      csv.data.forEach(d => {
        if (d.gear > 0) {
          gearCounts[d.gear] = (gearCounts[d.gear] || 0) + 1;
        }
      });

      Object.entries(gearCounts).forEach(([gear, count]) => {
        const existingGear = gearData.find(g => g.gear === `Gear ${gear}`);
        if (existingGear) {
          existingGear[csv.id] = parseFloat((count / csv.data.length * 100).toFixed(1));
        } else {
          gearData.push({
            gear: `Gear ${gear}`,
            [csv.id]: parseFloat((count / csv.data.length * 100).toFixed(1))
          });
        }
      });
    });

    return gearData.sort((a, b) => {
      const gearA = parseInt(a.gear.replace('Gear ', ''));
      const gearB = parseInt(b.gear.replace('Gear ', ''));
      return gearA - gearB;
    });
  };

  const renderChart = (title, dataKey, unit, type = 'line') => {
    const data = prepareChartData(dataKey);

    return (
      <div className="card-gradient">
        <h3 className="text-xl font-semibold mb-4 text-cyan-300">{title}</h3>
        <ResponsiveContainer width="100%" height={300}>
          {type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="index" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" unit={unit} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10,20,30,0.9)',
                  border: '1px solid #00f0ff',
                  backdropFilter: 'blur(5px)'
                }}
                itemStyle={{ color: '#e7e5e4' }}
              />
              <Legend />
              {csvFiles.map(csv => (
                <Line
                  key={csv.id}
                  type="monotone"
                  dataKey={csv.id}
                  name={csv.name}
                  stroke={csv.color}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="index" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" unit={unit} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10,20,30,0.9)',
                  border: '1px solid #00f0ff',
                  backdropFilter: 'blur(5px)'
                }}
                itemStyle={{ color: '#e7e5e4' }}
              />
              <Legend />
              {csvFiles.map(csv => (
                <Area
                  key={csv.id}
                  type="monotone"
                  dataKey={csv.id}
                  name={csv.name}
                  stroke={csv.color}
                  fill={csv.color}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  const renderGearUsageChart = () => {
    const data = prepareGearData();

    return (
      <div className="card-gradient">
        <h3 className="text-xl font-semibold mb-4 text-cyan-300">Gear Usage (Octagonal)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={data}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="gear" stroke="#9ca3af" />
            <PolarRadiusAxis angle={30} domain={[0, 'dataMax + 10']} stroke="#374151" />
            {csvFiles.map(csv => (
              <Radar
                key={csv.id}
                name={csv.name}
                dataKey={csv.id}
                stroke={csv.color}
                fill={csv.color}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(10,20,30,0.9)',
                border: '1px solid #00f0ff',
                backdropFilter: 'blur(5px)'
              }}
              itemStyle={{ color: '#e7e5e4' }}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderGForceChart = () => {
    const dataLong = prepareChartData('g_long');
    const dataLat = prepareChartData('g_lat');

    return (
      <div className="card-gradient col-span-1 lg:col-span-2">
        <h3 className="text-xl font-semibold mb-4 text-cyan-300">G-Forces (Longitudinal & Lateral)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dataLong}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="index" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" domain={[-4, 4]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(10,20,30,0.9)',
                border: '1px solid #00f0ff',
                backdropFilter: 'blur(5px)'
              }}
              itemStyle={{ color: '#e7e5e4' }}
            />
            <Legend />
            {csvFiles.map(csv => (
              <Line
                key={`${csv.id}-long`}
                type="monotone"
                dataKey={csv.id}
                name={`${csv.name} (Longitudinal)`}
                stroke={csv.color}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderPedalApplicationChart = () => {
    if (csvFiles.length === 0) return null;

    const pedalData = csvFiles.map(csv => {
      let throttleOnly = 0, brakeOnly = 0, coasting = 0;
      csv.data.forEach(d => {
        if (d.throttle_pct > 5 && d.brake_pct < 5) throttleOnly++;
        else if (d.brake_pct > 5 && d.throttle_pct < 5) brakeOnly++;
        else if (d.throttle_pct < 5 && d.brake_pct < 5) coasting++;
      });
      const total = csv.data.length;
      
      return {
        name: csv.name,
        color: csv.color,
        Throttle: parseFloat(((throttleOnly / total) * 100).toFixed(1)),
        Coasting: parseFloat(((coasting / total) * 100).toFixed(1)),
        Brake: parseFloat(((brakeOnly / total) * 100).toFixed(1))
      };
    });

    return (
      <div className="card-gradient">
        <h3 className="text-xl font-semibold mb-4 text-cyan-300">Pedal Application</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={pedalData} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" unit="%" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(10,20,30,0.9)',
                border: '1px solid #00f0ff',
                backdropFilter: 'blur(5px)'
              }}
              itemStyle={{ color: '#e7e5e4' }}
            />
            <Legend />
            <Bar dataKey="Throttle" fill="#00ff88" />
            <Bar dataKey="Coasting" fill="#fcf003" />
            <Bar dataKey="Brake" fill="#ff2a6d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderLapTimeComparison = () => {
    if (allStats.length === 0) return null;

    const lapTimeData = allStats.map(csv => ({
      name: csv.name,
      lapTime: csv.stats?.lapTime || 0,
      color: csv.color
    })).sort((a, b) => a.lapTime - b.lapTime);

    const fastest = lapTimeData[0]?.lapTime || 0;

    return (
      <div className="card-gradient">
        <h3 className="text-xl font-semibold mb-4 text-cyan-300">Lap Time Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={lapTimeData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" unit="s" />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" width={150} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(10,20,30,0.9)',
                border: '1px solid #00f0ff',
                backdropFilter: 'blur(5px)'
              }}
              itemStyle={{ color: '#e7e5e4' }}
              formatter={(value) => [`${value.toFixed(3)}s`, 'Lap Time']}
            />
            <Bar dataKey="lapTime" name="Lap Time">
              {lapTimeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 text-center text-sm text-gray-400">
          Fastest: {fastest.toFixed(3)}s ({lapTimeData[0]?.name})
        </div>
      </div>
    );
  };

  const renderStatisticsGrid = () => {
    if (allStats.length === 0) return null;

    const statCategories = [
      { key: 'maxSpeed', label: 'Max Speed', unit: 'km/h', formatter: (v) => v.toFixed(1) },
      { key: 'avgSpeed', label: 'Avg Speed', unit: 'km/h', formatter: (v) => v.toFixed(1) },
      { key: 'maxRPM', label: 'Max RPM', unit: 'rpm', formatter: (v) => v.toFixed(0) },
      { key: 'avgThrottle', label: 'Avg Throttle', unit: '%', formatter: (v) => v.toFixed(1) },
      { key: 'maxGForce', label: 'Max G-Force', unit: 'G', formatter: (v) => v.toFixed(2) },
      { key: 'lapTime', label: 'Lap Time', unit: 's', formatter: (v) => v.toFixed(3) },
      { key: 'distance', label: 'Distance', unit: 'km', formatter: (v) => v.toFixed(2) },
      { key: 'brakeEvents', label: 'Brake Events', unit: '', formatter: (v) => v },
      { key: 'gearChanges', label: 'Gear Changes', unit: '', formatter: (v) => v },
    ];

    return (
      <div className="card-gradient">
        <h3 className="text-2xl font-semibold mb-6 text-cyan-300 text-center">
          📊 Numerical Comparison
        </h3>

        {/* Statistics Grid */}
        {statCategories.map(category => {
          const values = allStats.map(csv => ({
            name: csv.name,
            value: csv.stats?.[category.key] || 0,
            color: csv.color
          }));

          const maxValue = Math.max(...values.map(v => v.value));
          const minValue = Math.min(...values.map(v => v.value));

          return (
            <div key={category.key} className="mb-6 pb-6 border-b border-white/10 last:border-0">
              <h4 className="text-lg font-semibold text-gray-300 mb-4">{category.label}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {values.map((item, index) => {
                  const isBest = item.value === (category.key === 'lapTime' ? minValue : maxValue);
                  const isWorst = item.value === (category.key === 'lapTime' ? maxValue : minValue);

                  return (
                    <div
                      key={index}
                      className="relative p-4 rounded-lg transition-all hover:scale-105"
                      style={{
                        backgroundColor: `${item.color}15`,
                        borderLeft: `4px solid ${item.color}`
                      }}
                    >
                      {/* Best/Worst Indicator */}
                      {allStats.length > 1 && isBest && (
                        <div className="absolute top-2 right-2">
                          <TrendingUp className="text-green-400" size={16} />
                        </div>
                      )}
                      {allStats.length > 1 && isWorst && (
                        <div className="absolute top-2 right-2">
                          <TrendingDown className="text-red-400" size={16} />
                        </div>
                      )}

                      <p className="text-xs text-gray-400 truncate mb-1">{item.name}</p>
                      <p className="text-2xl font-bold text-white">
                        {category.formatter(item.value)}
                        <span className="text-sm ml-1 text-gray-400">{category.unit}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (csvFiles.length === 0) {
    return (
      <div className="max-w-5xl mx-auto py-12 animate-fadeIn">
        <div className="text-center mb-12">
          <div className="inline-flex p-6 bg-cyan-500/10 rounded-full mb-6 animate-pulse">
            <GitCompare className="w-16 h-16 text-cyan-400" />
          </div>
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent animate-slideUp">
            Compare Multiple Laps
          </h2>
          <p className="text-gray-400 text-xl mb-8 max-w-3xl mx-auto leading-relaxed animate-slideUp" style={{ animationDelay: '0.1s' }}>
            Upload up to 10 telemetry CSV files to compare performance across different laps,
            drivers, or setups. Each file will be displayed in a unique cyberpunk color.
          </p>
        </div>

        {/* Drag & Drop Zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 animate-slideUp ${
            dragActive
              ? 'border-cyan-500 bg-cyan-500/10 scale-105'
              : 'border-gray-700 bg-gradient-to-br from-gray-900/80 to-gray-800/40 hover:border-cyan-500/50 hover:bg-cyan-500/5'
          }`}
          style={{ animationDelay: '0.2s' }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            id="compare-upload"
            type="file"
            accept=".csv"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="text-center">
            <div className="mb-6">
              <Upload className={`w-20 h-20 mx-auto text-cyan-400 mb-4 transition-transform ${dragActive ? 'scale-110' : ''}`} />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-3">
              {dragActive ? 'Drop files here' : 'Upload Telemetry Files'}
            </h3>
            
            <p className="text-gray-400 mb-6 text-lg">
              Drag & drop CSV files here, or click to browse
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/30 disabled:cursor-not-allowed disabled:scale-100"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Select Files
                </>
              )}
            </button>

            <p className="text-sm text-gray-500 mt-6">
              Maximum {maxFiles} files • CSV format • Up to 10MB each
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-8 border-t border-gray-700/50">
            {[
              { icon: '📊', text: '12+ Charts' },
              { icon: '🎨', text: 'Color-Coded' },
              { icon: '📈', text: 'Statistics Grid' },
              { icon: '⚡', text: 'Instant Compare' }
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-400 text-sm">
                <span className="text-2xl">{feature.icon}</span>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-xl hover:border-cyan-500/30 transition-all animate-slideUp">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
            Lap Comparison
          </h2>
          <p className="text-gray-400 mt-1 flex items-center gap-2">
            <FileCheck size={16} className="text-green-400" />
            {csvFiles.length} / {maxFiles} files loaded
          </p>
        </div>

        <div className="flex items-center gap-3">
          {csvFiles.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg transition-all hover:scale-105"
            >
              <X size={16} />
              Clear All
            </button>
          )}
          
          <label
            htmlFor="compare-upload-more"
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg font-semibold transition-all cursor-pointer border border-cyan-500/30 hover:scale-105"
          >
            <Upload size={18} />
            Add More
          </label>
          <input
            id="compare-upload-more"
            type="file"
            accept=".csv"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            disabled={csvFiles.length >= maxFiles}
          />
        </div>
      </div>

      {/* File Tags */}
      <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-xl p-6 hover:border-cyan-500/30 transition-all animate-slideUp" style={{ animationDelay: '0.1s' }}>
        <h3 className="text-lg font-semibold mb-4 text-gray-300 flex items-center gap-2">
          <FileCheck size={20} className="text-cyan-400" />
          Loaded Files
        </h3>
        <div className="flex flex-wrap gap-3">
          {csvFiles.map((csv, index) => (
            <div
              key={csv.id}
              className="group flex items-center gap-3 px-4 py-2 rounded-lg transition-all hover:scale-105 cursor-default animate-slideInLeft"
              style={{
                backgroundColor: `${csv.color}15`,
                borderLeft: `4px solid ${csv.color}`,
                animationDelay: `${index * 0.05}s`
              }}
            >
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: csv.color }}
              />
              <span className="text-sm font-medium text-white">{csv.name}</span>
              <span className="text-xs text-gray-500">{csv.data.length.toLocaleString()} pts</span>
              <button
                onClick={() => removeFile(csv.id)}
                className="ml-2 text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Numerical Statistics Grid */}
      {renderStatisticsGrid()}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lap Time Comparison */}
        {renderLapTimeComparison()}

        {/* Speed */}
        {renderChart('Speed', 'speed_kmh', ' km/h')}

        {/* RPM */}
        {renderChart('RPM', 'rpm', '')}

        {/* Gear Changes */}
        {renderChart('Gear', 'gear', '', 'line')}

        {/* Brake */}
        {renderChart('Brake', 'brake_pct', '%', 'area')}

        {/* Throttle */}
        {renderChart('Throttle', 'throttle_pct', '%', 'area')}

        {/* Speed Over Distance */}
        {renderChart('Speed Over Distance', 'speed_kmh', ' km/h')}

        {/* Steering Angle */}
        {renderChart('Steering Angle', 'steering_angle_rad', ' rad')}

        {/* Downforce */}
        {renderChart('Downforce', 'downforce_n', ' N')}

        {/* Drag */}
        {renderChart('Drag Force', 'drag_force_n', ' N')}

        {/* Pedal Application */}
        {renderPedalApplicationChart()}

        {/* Gear Usage */}
        {renderGearUsageChart()}

        {/* G-Forces */}
        {renderGForceChart()}
      </div>
    </div>
  );
};

export default ComparePage;
