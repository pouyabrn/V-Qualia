import { useState, useEffect, useRef } from 'react';
import { Activity, Pause, Play, Zap, Gauge, Thermometer, Radio } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LiveStandalone = () => {
  console.log('LiveStandalone component rendering');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [speedData, setSpeedData] = useState([]);
  const [rpmData, setRpmData] = useState([]);
  const [gForceData, setGForceData] = useState([]);
  const [tempData, setTempData] = useState([]);
  const [currentData, setCurrentData] = useState({
    speed: 0,
    rpm: 0,
    gLat: 0,
    gLong: 0,
    engineTemp: 0,
    brakeTemp: 0,
    throttle: 0,
    brake: 0,
  });

  const timeRef = useRef(0);
  const maxDataPoints = 50;

  // Simulate real-time data updates
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      timeRef.current += 0.1;
      const t = timeRef.current;

      // Simulate realistic F1 telemetry data
      const newSpeed = 200 + Math.sin(t * 0.5) * 100 + Math.random() * 20;
      const newRpm = 10000 + Math.sin(t * 0.7) * 3000 + Math.random() * 500;
      const newGLat = Math.sin(t * 0.4) * 3 + Math.random() * 0.5;
      const newGLong = Math.cos(t * 0.3) * 2.5 + Math.random() * 0.3;
      const newEngineTemp = 85 + Math.sin(t * 0.1) * 10 + Math.random() * 2;
      const newBrakeTemp = 300 + Math.sin(t * 0.15) * 100 + Math.random() * 20;
      const newThrottle = Math.max(0, Math.min(100, 50 + Math.sin(t * 0.6) * 50 + Math.random() * 10));
      const newBrake = Math.max(0, Math.min(100, 30 + Math.cos(t * 0.5) * 30 + Math.random() * 10));

      setCurrentData({
        speed: newSpeed.toFixed(1),
        rpm: newRpm.toFixed(0),
        gLat: newGLat.toFixed(2),
        gLong: newGLong.toFixed(2),
        engineTemp: newEngineTemp.toFixed(1),
        brakeTemp: newBrakeTemp.toFixed(1),
        throttle: newThrottle.toFixed(1),
        brake: newBrake.toFixed(1),
      });

      // Update chart data
      const timestamp = t.toFixed(1);
      
      setSpeedData(prev => {
        const newData = [...prev, { time: timestamp, speed: parseFloat(newSpeed.toFixed(1)) }];
        return newData.slice(-maxDataPoints);
      });

      setRpmData(prev => {
        const newData = [...prev, { time: timestamp, rpm: parseFloat(newRpm.toFixed(0)) }];
        return newData.slice(-maxDataPoints);
      });

      setGForceData(prev => {
        const newData = [...prev, { 
          time: timestamp, 
          lateral: parseFloat(newGLat.toFixed(2)), 
          longitudinal: parseFloat(newGLong.toFixed(2)) 
        }];
        return newData.slice(-maxDataPoints);
      });

      setTempData(prev => {
        const newData = [...prev, { 
          time: timestamp, 
          engine: parseFloat(newEngineTemp.toFixed(1)), 
          brake: parseFloat(newBrakeTemp.toFixed(1)) 
        }];
        return newData.slice(-maxDataPoints);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isMonitoring]);

  const handleStartMonitoring = () => {
    // Reset all data on new start
    timeRef.current = 0;
    setSpeedData([]);
    setRpmData([]);
    setGForceData([]);
    setTempData([]);
    setCurrentData({
      speed: 0,
      rpm: 0,
      gLat: 0,
      gLong: 0,
      engineTemp: 0,
      brakeTemp: 0,
      throttle: 0,
      brake: 0,
    });
    setIsMonitoring(true);
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
  };

  const MetricCard = ({ label, value, unit, icon: Icon, color, maxValue }) => {
    const percentage = maxValue ? (parseFloat(value) / maxValue) * 100 : 0;
    
    return (
      <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-lg p-3 hover:border-cyan-500/40 transition-all shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={color} size={16} />
          <span className="text-gray-400 text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-white text-2xl font-bold">{value}</span>
            <span className="text-gray-500 text-sm ml-1">{unit}</span>
          </div>
          {maxValue && (
            <div className="w-16 bg-gray-700 rounded-full h-1.5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Standalone Header */}
        <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/70 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4 shadow-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-red-500 animate-pulse' : 'bg-gray-600'} shadow-lg ${isMonitoring ? 'shadow-red-500/50' : ''}`} />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  Live Telemetry Monitor
                </h1>
                <div className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded text-xs text-cyan-400 font-semibold">
                  STANDALONE MODE
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-gray-700/50">
                <Radio className="text-cyan-400" size={14} />
                <span className="text-xs text-gray-400 font-mono">100Hz</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {!isMonitoring ? (
                <button
                  onClick={handleStartMonitoring}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-bold transition-all text-sm shadow-lg shadow-green-500/30"
                >
                  <Play size={16} />
                  Start Monitoring
                </button>
              ) : (
                <button
                  onClick={handleStopMonitoring}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg font-bold transition-all text-sm shadow-lg shadow-red-500/30"
                >
                  <Pause size={16} />
                  Stop Monitoring
                </button>
              )}
            </div>
          </div>
        </div>

        {speedData.length === 0 ? (
          <div className="flex items-center justify-center h-[calc(100vh-120px)]">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                <Activity className="text-cyan-400" size={48} />
              </div>
              <h2 className="text-3xl font-bold text-gray-300">Ready to Monitor</h2>
              <p className="text-gray-500 text-lg">Click "Start Monitoring" to begin live telemetry tracking</p>
              <div className="mt-4 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg inline-block">
                <p className="text-sm text-blue-400">Standalone mode provides optimal performance</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Compact Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard 
                label="Speed" 
                value={currentData.speed} 
                unit="km/h" 
                icon={Zap}
                color="text-cyan-400"
                maxValue={400}
              />
              <MetricCard 
                label="RPM" 
                value={currentData.rpm} 
                unit="" 
                icon={Gauge}
                color="text-purple-400"
                maxValue={15000}
              />
              <MetricCard 
                label="Engine Temp" 
                value={currentData.engineTemp} 
                unit="°C" 
                icon={Thermometer}
                color="text-red-400"
                maxValue={120}
              />
              <MetricCard 
                label="Brake Temp" 
                value={currentData.brakeTemp} 
                unit="°C" 
                icon={Thermometer}
                color="text-orange-400"
                maxValue={500}
              />
            </div>

            {/* Live Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Speed Chart */}
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="text-cyan-400" size={18} />
                  <h3 className="text-cyan-400 font-bold text-sm">Speed Over Time</h3>
                  <div className="ml-auto px-2 py-1 bg-cyan-500/10 rounded text-xs text-cyan-400 font-mono">
                    {currentData.speed} km/h
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={speedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[0, 400]} />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(17, 24, 39, 0.95)', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="speed" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* RPM Chart */}
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="text-purple-400" size={18} />
                  <h3 className="text-purple-400 font-bold text-sm">Engine RPM</h3>
                  <div className="ml-auto px-2 py-1 bg-purple-500/10 rounded text-xs text-purple-400 font-mono">
                    {currentData.rpm} RPM
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={rpmData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[5000, 15000]} />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(17, 24, 39, 0.95)', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="rpm" 
                      stroke="#a855f7" 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* G-Force Chart */}
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="text-emerald-400" size={18} />
                  <h3 className="text-emerald-400 font-bold text-sm">G-Forces</h3>
                  <div className="ml-auto flex gap-2">
                    <div className="px-2 py-1 bg-emerald-500/10 rounded text-xs text-emerald-400 font-mono">
                      Lat: {currentData.gLat}g
                    </div>
                    <div className="px-2 py-1 bg-yellow-500/10 rounded text-xs text-yellow-400 font-mono">
                      Long: {currentData.gLong}g
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={gForceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[-4, 4]} />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(17, 24, 39, 0.95)', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lateral" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="longitudinal" 
                      stroke="#eab308" 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Temperature Chart */}
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Thermometer className="text-red-400" size={18} />
                  <h3 className="text-red-400 font-bold text-sm">Temperature Monitoring</h3>
                  <div className="ml-auto flex gap-2">
                    <div className="px-2 py-1 bg-red-500/10 rounded text-xs text-red-400 font-mono">
                      Eng: {currentData.engineTemp}°C
                    </div>
                    <div className="px-2 py-1 bg-orange-500/10 rounded text-xs text-orange-400 font-mono">
                      Brk: {currentData.brakeTemp}°C
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={tempData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[0, 500]} />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(17, 24, 39, 0.95)', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="engine" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="brake" 
                      stroke="#f97316" 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pedal Application */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-lg">
                <h3 className="text-green-400 font-bold text-sm mb-3">Throttle Application</h3>
                <div className="relative h-8 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-100 rounded-full"
                    style={{ width: `${currentData.throttle}%` }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white font-bold text-sm">
                    {currentData.throttle}%
                  </span>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-lg">
                <h3 className="text-red-400 font-bold text-sm mb-3">Brake Pressure</h3>
                <div className="relative h-8 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-100 rounded-full"
                    style={{ width: `${currentData.brake}%` }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white font-bold text-sm">
                    {currentData.brake}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveStandalone;

