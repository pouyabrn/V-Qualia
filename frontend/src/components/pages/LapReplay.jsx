import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge, Zap, Activity, Wind } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LapReplay = () => {
  const [telemetryData, setTelemetryData] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const intervalRef = useRef(null);

  // Load CSV data on mount
  useEffect(() => {
    const loadCSV = async () => {
      try {
        const response = await fetch('/F1_2025-Zandvoort-1_22-VSIM.csv');
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',');
        
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          const row = {};
          headers.forEach((header, i) => {
            row[header.trim()] = parseFloat(values[i]) || 0;
          });
          return row;
        });
        
        setTelemetryData(data);
        console.log(`Loaded ${data.length} telemetry points`);
      } catch (error) {
        console.error('Error loading CSV:', error);
      }
    };
    
    loadCSV();
  }, []);

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
      }, (100 / playbackSpeed)); // Base 100ms interval, adjusted by speed
      
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
          <p className="text-xl text-gray-400">Loading lap data...</p>
        </div>
      </div>
    );
  }

  const currentPoint = telemetryData[currentIndex];
  const chartWindowSize = 100;
  const chartStartIndex = Math.max(0, currentIndex - chartWindowSize);
  const chartData = telemetryData.slice(chartStartIndex, currentIndex + 1);

  // Calculate track bounds for proper scaling
  const allX = telemetryData.map(d => d.pos_x_m);
  const allY = telemetryData.map(d => d.pos_y_m);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const trackWidth = maxX - minX;
  const trackHeight = maxY - minY;
  const scale = Math.min(600 / trackWidth, 600 / trackHeight);

  const progress = (currentIndex / (telemetryData.length - 1)) * 100;
  const lapTime = currentPoint?.timestamp_s || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/70 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Lap Replay - Zandvoort
              </h1>
              <p className="text-gray-400 text-sm mt-1">F1 2025 Virtual Simulation</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-400">Lap Time</div>
                <div className="text-3xl font-bold text-cyan-400 font-mono">
                  {Math.floor(lapTime / 60)}:{(lapTime % 60).toFixed(3).padStart(6, '0')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Track Visualization - Smaller */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
            <h2 className="text-sm font-bold text-cyan-400 mb-2">Track Position</h2>
            <div className="relative bg-black/50 rounded-lg p-2" style={{ height: '400px' }}>
              <svg width="100%" height="100%" viewBox={`0 0 ${trackWidth * scale + 40} ${trackHeight * scale + 40}`}>
                {/* Full track path */}
                <path
                  d={`M ${telemetryData.map((d, i) => 
                    `${(d.pos_x_m - minX) * scale + 20},${(d.pos_y_m - minY) * scale + 20}`
                  ).join(' L ')}`}
                  fill="none"
                  stroke="#374151"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Completed path (gradient) */}
                <defs>
                  <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <path
                  d={`M ${telemetryData.slice(0, currentIndex + 1).map((d, i) => 
                    `${(d.pos_x_m - minX) * scale + 20},${(d.pos_y_m - minY) * scale + 20}`
                  ).join(' L ')}`}
                  fill="none"
                  stroke="url(#trackGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Current car position */}
                <circle
                  cx={(currentPoint.pos_x_m - minX) * scale + 20}
                  cy={(currentPoint.pos_y_m - minY) * scale + 20}
                  r="12"
                  fill="#eab308"
                  stroke="#000"
                  strokeWidth="2"
                >
                  <animate
                    attributeName="r"
                    values="12;14;12"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
                
                {/* Direction indicator */}
                <circle
                  cx={(currentPoint.pos_x_m - minX) * scale + 20}
                  cy={(currentPoint.pos_y_m - minY) * scale + 20}
                  r="18"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="2"
                  opacity="0.5"
                />
              </svg>
              
              {/* Multiple overlays on track */}
              <div className="absolute top-2 right-2 space-y-2">
                {/* Speed */}
                <div className="bg-black/90 px-3 py-1.5 rounded-lg border border-cyan-500/40">
                  <div className="text-[10px] text-gray-400">Speed</div>
                  <div className="text-xl font-bold text-cyan-400">{currentPoint.speed_kmh.toFixed(0)}</div>
                  <div className="text-[9px] text-gray-500">km/h</div>
                </div>
                
                {/* Gear */}
                <div className="bg-black/90 px-3 py-1.5 rounded-lg border border-orange-500/40">
                  <div className="text-[10px] text-gray-400">Gear</div>
                  <div className="text-xl font-bold text-orange-400">{currentPoint.gear}</div>
                </div>
                
                {/* G-Force */}
                <div className="bg-black/90 px-3 py-1.5 rounded-lg border border-emerald-500/40">
                  <div className="text-[10px] text-gray-400">G-Force</div>
                  <div className="text-xl font-bold text-emerald-400">{currentPoint.g_total.toFixed(2)}g</div>
                </div>
              </div>
              
              {/* Distance overlay */}
              <div className="absolute bottom-2 left-2 bg-black/90 px-3 py-1.5 rounded-lg border border-purple-500/40">
                <div className="text-[10px] text-gray-400">Distance</div>
                <div className="text-lg font-bold text-purple-400">{currentPoint.arc_length_m.toFixed(0)}m</div>
              </div>
            </div>
            
            {/* Compact Info Panel */}
            <div className="space-y-2">
              {/* Throttle and Brake - Compact */}
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-lg p-2">
                <div className="text-[10px] text-green-400 font-semibold mb-1">Throttle</div>
                <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-75"
                    style={{ width: `${currentPoint.throttle_pct}%` }}
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-white font-bold text-[10px]">
                    {currentPoint.throttle_pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-lg p-2">
                <div className="text-[10px] text-red-400 font-semibold mb-1">Brake</div>
                <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-75"
                    style={{ width: `${currentPoint.brake_pct}%` }}
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-white font-bold text-[10px]">
                    {currentPoint.brake_pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Metrics Grid */}
          <div className="lg:col-span-2 space-y-3">
            {/* Current Stats - More compact */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-gradient-to-br from-cyan-900/40 to-cyan-800/20 backdrop-blur-md border border-cyan-700/50 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-1">
                  <Zap className="text-cyan-400" size={14} />
                  <span className="text-cyan-400 text-[10px] font-semibold">Speed</span>
                </div>
                <div className="text-2xl font-bold text-white">{currentPoint.speed_kmh.toFixed(1)}</div>
                <div className="text-[9px] text-gray-400">km/h</div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 backdrop-blur-md border border-purple-700/50 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-1">
                  <Gauge className="text-purple-400" size={14} />
                  <span className="text-purple-400 text-[10px] font-semibold">RPM</span>
                </div>
                <div className="text-2xl font-bold text-white">{currentPoint.rpm.toFixed(0)}</div>
                <div className="text-[9px] text-gray-400">RPM</div>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 backdrop-blur-md border border-emerald-700/50 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-1">
                  <Activity className="text-emerald-400" size={14} />
                  <span className="text-emerald-400 text-[10px] font-semibold">G-Force</span>
                </div>
                <div className="text-2xl font-bold text-white">{currentPoint.g_total.toFixed(2)}g</div>
                <div className="text-[9px] text-gray-400">Total</div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/20 backdrop-blur-md border border-orange-700/50 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-1">
                  <Wind className="text-orange-400" size={14} />
                  <span className="text-orange-400 text-[10px] font-semibold">Gear</span>
                </div>
                <div className="text-2xl font-bold text-white">{currentPoint.gear}</div>
                <div className="text-[9px] text-gray-400">Current</div>
              </div>
            </div>
            
            {/* Additional Data Cards - New */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 border border-gray-600/30 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">G-Long</div>
                <div className="text-xl font-bold text-emerald-300">{currentPoint.g_long.toFixed(2)}g</div>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 border border-gray-600/30 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">G-Lat</div>
                <div className="text-xl font-bold text-yellow-300">{currentPoint.g_lat.toFixed(2)}g</div>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 border border-gray-600/30 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">Accel</div>
                <div className="text-xl font-bold text-green-300">{currentPoint.accel_long_ms2.toFixed(1)}</div>
                <div className="text-[9px] text-gray-500">m/s²</div>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 border border-gray-600/30 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">Steering</div>
                <div className="text-xl font-bold text-blue-300">{(currentPoint.steering_angle_rad * 57.2958).toFixed(1)}°</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Charts - Smaller */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Speed Chart */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-3">
            <h3 className="text-cyan-400 font-bold text-xs mb-1">Speed</h3>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="timestamp_s" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[0, 350]} />
                <Tooltip contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="speed_kmh" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* RPM Chart */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-3">
            <h3 className="text-purple-400 font-bold text-xs mb-1">Engine RPM</h3>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="timestamp_s" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[5000, 15000]} />
                <Tooltip contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="rpm" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* G-Force Chart */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-3">
            <h3 className="text-emerald-400 font-bold text-xs mb-1">G-Forces</h3>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="timestamp_s" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[-2, 6]} />
                <Tooltip contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="g_long" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} name="Longitudinal" />
                <Line type="monotone" dataKey="g_lat" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} name="Lateral" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gear Chart */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-3">
            <h3 className="text-orange-400 font-bold text-xs mb-1">Gear Position</h3>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="timestamp_s" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[0, 8]} />
                <Tooltip contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="stepAfter" dataKey="gear" stroke="#f97316" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Playback Controls - Compact */}
        <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/70 backdrop-blur-lg border border-gray-700/50 rounded-xl p-3">
          <div className="space-y-3">
            {/* Progress Bar */}
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

            {/* Control Buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleRestart}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all"
              >
                <SkipBack size={20} />
              </button>
              
              <button
                onClick={handleSkipBack}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all"
              >
                <SkipBack size={16} />
              </button>
              
              <button
                onClick={handlePlayPause}
                className="p-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-full transition-all shadow-lg shadow-cyan-500/30"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              
              <button
                onClick={handleSkipForward}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all"
              >
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

export default LapReplay;

