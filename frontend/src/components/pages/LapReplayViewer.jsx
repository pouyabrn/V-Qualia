import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LapReplayViewer = ({ csvData, trackName = 'Track' }) => {
  const [telemetryData, setTelemetryData] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const intervalRef = useRef(null);

  // Parse CSV data on mount or when csvData changes
  useEffect(() => {
    if (!csvData) return;
    
    try {
      const lines = csvData.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, i) => {
          row[header] = parseFloat(values[i]) || 0;
        });
        return row;
      });
      
      setTelemetryData(data);
      setCurrentIndex(0);
      console.log(`Loaded ${data.length} telemetry points`);
    } catch (error) {
      console.error('Error parsing CSV:', error);
    }
  }, [csvData]);

  // Playback control
  useEffect(() => {
    if (isPlaying && telemetryData.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= telemetryData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, (100 / playbackSpeed));
      
      return () => clearInterval(intervalRef.current);
    }
  }, [isPlaying, telemetryData.length, playbackSpeed]);

  const handlePlayPause = () => {
    if (currentIndex >= telemetryData.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  const handleSkipForward = () => {
    setCurrentIndex(prev => Math.min(prev + 50, telemetryData.length - 1));
  };

  const handleSkipBack = () => {
    setCurrentIndex(prev => Math.max(prev - 50, 0));
  };

  if (telemetryData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-400">Loading telemetry data...</p>
        </div>
      </div>
    );
  }

  const currentPoint = telemetryData[currentIndex];
  const chartWindowSize = 100;
  const chartStartIndex = Math.max(0, currentIndex - chartWindowSize);
  const chartData = telemetryData.slice(chartStartIndex, currentIndex + 1);

  // Calculate track bounds
  const posXKey = 'pos_x_m' in telemetryData[0] ? 'pos_x_m' : 'x';
  const posYKey = 'pos_y_m' in telemetryData[0] ? 'pos_y_m' : 'y';
  
  const allX = telemetryData.map(d => d[posXKey] || 0);
  const allY = telemetryData.map(d => d[posYKey] || 0);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const trackWidth = maxX - minX;
  const trackHeight = maxY - minY;
  const scale = Math.min(700 / trackWidth, 700 / trackHeight);

  const progress = (currentIndex / (telemetryData.length - 1)) * 100;
  const lapTime = currentPoint?.timestamp_s || currentPoint?.Time || 0;

  // Safe data access with fallbacks
  const speed = currentPoint?.speed_kmh || currentPoint?.Speed || 0;
  const rpm = currentPoint?.rpm || currentPoint?.RPM || 0;
  const gear = currentPoint?.gear || currentPoint?.nGear || 1;
  const gTotal = currentPoint?.g_total || 0;
  const gLong = currentPoint?.g_long || 0;
  const gLat = currentPoint?.g_lat || 0;
  const throttle = currentPoint?.throttle_pct || currentPoint?.Throttle || 0;
  const brake = currentPoint?.brake_pct || currentPoint?.Brake || 0;
  const distance = currentPoint?.arc_length_m || currentPoint?.Distance || 0;
  const accel = currentPoint?.accel_long_ms2 || 0;
  const steering = currentPoint?.steering_angle_rad || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/70 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Lap Replay - {trackName}
              </h1>
              <p className="text-gray-400 text-xs mt-1">Telemetry Visualization</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Lap Time</div>
              <div className="text-3xl font-bold text-cyan-400 font-mono">
                {Math.floor(lapTime / 60)}:{(lapTime % 60).toFixed(3).padStart(6, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Track with ALL overlays - Larger */}
          <div className="lg:col-span-2 bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
            <h2 className="text-sm font-bold text-cyan-400 mb-2">Track Position</h2>
            <div className="relative bg-black/50 rounded-lg p-2" style={{ height: '700px' }}>
              <svg width="100%" height="100%" viewBox={`0 0 ${trackWidth * scale + 40} ${trackHeight * scale + 40}`}>
                {/* Track paths */}
                <path
                  d={`M ${telemetryData.map((d, i) => 
                    `${(d[posXKey] - minX) * scale + 20},${(d[posYKey] - minY) * scale + 20}`
                  ).join(' L ')}`}
                  fill="none"
                  stroke="#374151"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                <defs>
                  <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                
                <path
                  d={`M ${telemetryData.slice(0, currentIndex + 1).map((d, i) => 
                    `${(d[posXKey] - minX) * scale + 20},${(d[posYKey] - minY) * scale + 20}`
                  ).join(' L ')}`}
                  fill="none"
                  stroke="url(#trackGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Car position */}
                <circle
                  cx={(currentPoint[posXKey] - minX) * scale + 20}
                  cy={(currentPoint[posYKey] - minY) * scale + 20}
                  r="14"
                  fill="#eab308"
                  stroke="#000"
                  strokeWidth="2"
                >
                  <animate attributeName="r" values="14;16;14" dur="1s" repeatCount="indefinite" />
                </circle>
              </svg>
              
              {/* ALL DATA OVERLAYS ON TRACK */}
              <div className="absolute top-3 right-3 space-y-2">
                <div className="bg-black/95 px-4 py-2 rounded-lg border-2 border-cyan-500/60 shadow-lg shadow-cyan-500/20">
                  <div className="text-[11px] text-cyan-300 font-semibold">SPEED</div>
                  <div className="text-3xl font-bold text-cyan-400">{speed.toFixed(0)}</div>
                  <div className="text-[10px] text-gray-400">km/h</div>
                </div>
                
                <div className="bg-black/95 px-4 py-2 rounded-lg border-2 border-purple-500/60 shadow-lg shadow-purple-500/20">
                  <div className="text-[11px] text-purple-300 font-semibold">RPM</div>
                  <div className="text-3xl font-bold text-purple-400">{rpm.toFixed(0)}</div>
                </div>
                
                <div className="bg-black/95 px-4 py-2 rounded-lg border-2 border-orange-500/60 shadow-lg shadow-orange-500/20">
                  <div className="text-[11px] text-orange-300 font-semibold">GEAR</div>
                  <div className="text-3xl font-bold text-orange-400">{gear}</div>
                </div>
              </div>
              
              <div className="absolute top-3 left-3 space-y-2">
                <div className="bg-black/95 px-4 py-2 rounded-lg border-2 border-emerald-500/60 shadow-lg shadow-emerald-500/20">
                  <div className="text-[11px] text-emerald-300 font-semibold">G-FORCE</div>
                  <div className="text-3xl font-bold text-emerald-400">{gTotal.toFixed(2)}g</div>
                </div>
                
                <div className="bg-black/95 px-3 py-1.5 rounded-lg border border-emerald-500/40">
                  <div className="text-[10px] text-gray-400">Long</div>
                  <div className="text-xl font-bold text-emerald-300">{gLong.toFixed(2)}g</div>
                </div>
                
                <div className="bg-black/95 px-3 py-1.5 rounded-lg border border-yellow-500/40">
                  <div className="text-[10px] text-gray-400">Lat</div>
                  <div className="text-xl font-bold text-yellow-300">{gLat.toFixed(2)}g</div>
                </div>
              </div>
              
              <div className="absolute bottom-3 left-3 space-y-2">
                <div className="bg-black/95 px-4 py-2 rounded-lg border-2 border-purple-500/60 shadow-lg shadow-purple-500/20">
                  <div className="text-[11px] text-purple-300 font-semibold">DISTANCE</div>
                  <div className="text-2xl font-bold text-purple-400">{distance.toFixed(0)}m</div>
                </div>
              </div>
              
              <div className="absolute bottom-3 right-3 space-y-2">
                <div className="bg-black/95 px-3 py-1.5 rounded-lg border border-green-500/40">
                  <div className="text-[10px] text-gray-400">Throttle</div>
                  <div className="text-xl font-bold text-green-400">{throttle.toFixed(0)}%</div>
                </div>
                
                <div className="bg-black/95 px-3 py-1.5 rounded-lg border border-red-500/40">
                  <div className="text-[10px] text-gray-400">Brake</div>
                  <div className="text-xl font-bold text-red-400">{brake.toFixed(0)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts - 4 columns */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-3 mb-0">
            {/* Speed Chart */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-3">
              <h3 className="text-cyan-400 font-bold text-xs mb-1">Speed</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="timestamp_s" stroke="#6b7280" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 9 }} domain={[0, 350]} />
                  <Tooltip contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="speed_kmh" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* RPM Chart */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-3">
              <h3 className="text-purple-400 font-bold text-xs mb-1">RPM</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="timestamp_s" stroke="#6b7280" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 9 }} domain={[5000, 15000]} />
                  <Tooltip contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="rpm" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* G-Force Chart */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-3">
              <h3 className="text-emerald-400 font-bold text-xs mb-1">G-Forces</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="timestamp_s" stroke="#6b7280" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 9 }} domain={[-3, 6]} />
                  <Tooltip contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="g_long" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="g_lat" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Gear Chart */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-3">
              <h3 className="text-orange-400 font-bold text-xs mb-1">Gear</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="timestamp_s" stroke="#6b7280" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 9 }} domain={[0, 8]} />
                  <Tooltip contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                  <Line type="stepAfter" dataKey="gear" stroke="#f97316" strokeWidth={3} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/70 backdrop-blur-lg border border-gray-700/50 rounded-xl p-3">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Progress</span>
                <span>{currentIndex + 1} / {telemetryData.length}</span>
              </div>
              <input
                type="range"
                min="0"
                max={telemetryData.length - 1}
                value={currentIndex}
                onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="flex items-center justify-center gap-4">
              <button onClick={handleRestart} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all">
                <SkipBack size={20} />
              </button>
              
              <button onClick={handleSkipBack} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all">
                <SkipBack size={16} />
              </button>
              
              <button
                onClick={handlePlayPause}
                className="p-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-full transition-all shadow-lg shadow-cyan-500/30"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              
              <button onClick={handleSkipForward} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all">
                <SkipForward size={16} />
              </button>
              
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-gray-400">Speed:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="bg-gray-700 text-white px-3 py-1 rounded-lg text-sm"
                >
                  <option value="0.25">0.25x</option>
                  <option value="0.5">0.5x</option>
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="5">5x</option>
                  <option value="10">10x</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LapReplayViewer;


