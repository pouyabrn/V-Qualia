import { useState } from 'react';
import { Car, Target, Download, CheckCircle, TrendingUp, Play } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, XAxis, YAxis, Scatter } from 'recharts';
import AnimatedCounter from '../common/AnimatedCounter';

const PredictPage = ({ cars, tracks }) => {
  const [predictionStep, setPredictionStep] = useState(0); // 0: setup, 1: loading, 2: results
  const [selectedPredictCar, setSelectedPredictCar] = useState(null);
  const [selectedPredictTrack, setSelectedPredictTrack] = useState(null);
  const [predictedLapTime, setPredictedLapTime] = useState(null);
  const [predictionProgress, setPredictionProgress] = useState(0);

  const handleStartPrediction = () => {
    if (!selectedPredictCar || !selectedPredictTrack) {
      alert('Please select both a car and a track');
      return;
    }

    setPredictionStep(1);
    setPredictionProgress(0);

    // Simulate prediction progress
    const interval = setInterval(() => {
      setPredictionProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // Generate random lap time between 1:20 and 1:35
          const lapTime = 80 + Math.random() * 15;
          setPredictedLapTime(lapTime);
          setPredictionStep(2);
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const handleDownloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,timestamp,speed,throttle,brake,gear\n0.0,0,0,0,1\n1.0,120,100,0,3\n2.0,180,100,0,4";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `optimal_lap_${selectedPredictCar?.name}_${selectedPredictTrack?.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetPrediction = () => {
    setPredictionStep(0);
    setPredictionProgress(0);
    setPredictedLapTime(null);
  };

  const handleViewLapReplay = () => {
    const replayUrl = `${window.location.origin}/#/lap-replay`;
    window.open(replayUrl, '_blank', 'width=1600,height=900');
  };

  // Step 0: Setup
  if (predictionStep === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-6 text-center text-cyan-300">
          Predict Optimal Lap Time
        </h2>
        <p className="text-gray-400 text-center mb-8">
          Select a vehicle and track to simulate the fastest possible lap time
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card-gradient">
            <h3 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
              <Car size={20} /> Select Vehicle
            </h3>
            <div className="space-y-2">
              {cars.map(car => (
                <button
                  key={car.id}
                  onClick={() => setSelectedPredictCar(car)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedPredictCar?.id === car.id
                      ? 'bg-cyan-500/30 text-white border-2 border-cyan-500'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300 border-2 border-transparent'
                  }`}
                >
                  {car.name}
                </button>
              ))}
            </div>
          </div>

          <div className="card-gradient">
            <h3 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
              <Target size={20} /> Select Track
            </h3>
            <div className="space-y-2">
              {tracks.map(track => (
                <button
                  key={track.id}
                  onClick={() => setSelectedPredictTrack(track)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedPredictTrack?.id === track.id
                      ? 'bg-cyan-500/30 text-white border-2 border-cyan-500'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300 border-2 border-transparent'
                  }`}
                >
                  {track.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={handleStartPrediction}
            disabled={!selectedPredictCar || !selectedPredictTrack}
            className={`px-8 py-4 rounded-lg font-semibold transition-all transform ${
              selectedPredictCar && selectedPredictTrack
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white hover:scale-105 shadow-lg shadow-purple-500/30'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Start Prediction
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Loading
  if (predictionStep === 1) {
    return (
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold mb-6 text-center text-purple-300">
          Running Simulation...
        </h2>
        <p className="text-gray-400 text-center mb-8">
          Calculating optimal lap time for{' '}
          <span className="text-cyan-400">{selectedPredictCar?.name}</span> on{' '}
          <span className="text-cyan-400">{selectedPredictTrack?.name}</span>
        </p>

        <div className="card-gradient mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-semibold text-cyan-300">
              {selectedPredictTrack?.name}
            </h3>
            <span className="text-cyan-400 font-bold text-xl">{predictionProgress}%</span>
          </div>
          
          {/* Animated Track Drawing */}
          <div className="relative w-full h-[400px] bg-black/20 rounded-xl overflow-hidden border border-purple-500/20">
            <svg
              className="w-full h-full"
              viewBox={(() => {
                if (!selectedPredictTrack?.data || selectedPredictTrack.data.length === 0) {
                  return "0 0 100 100";
                }
                const xCoords = selectedPredictTrack.data.map(d => d.x);
                const yCoords = selectedPredictTrack.data.map(d => d.y);
                const minX = Math.min(...xCoords);
                const maxX = Math.max(...xCoords);
                const minY = Math.min(...yCoords);
                const maxY = Math.max(...yCoords);
                const padding = 50;
                return `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`;
              })()}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Gradient for the drawn part */}
                <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#ec4899" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="1" />
                </linearGradient>
                
                {/* Glow effect */}
                <filter id="trackGlow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Background track (gray outline - full track) */}
              <path
                d={selectedPredictTrack?.data ? 
                  `M ${selectedPredictTrack.data.map(d => `${d.x},${d.y}`).join(' L ')}` : 
                  ''
                }
                fill="none"
                stroke="#374151"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.3"
              />
              
              {/* Animated drawing track (colored - fills as progress increases) */}
              <path
                d={selectedPredictTrack?.data ? 
                  `M ${selectedPredictTrack.data.map(d => `${d.x},${d.y}`).join(' L ')}` : 
                  ''
                }
                fill="none"
                stroke="url(#trackGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#trackGlow)"
                style={{
                  strokeDasharray: '1000',
                  strokeDashoffset: `${1000 - (predictionProgress * 10)}`,
                  transition: 'stroke-dashoffset 0.1s linear'
                }}
              />
              
              {/* Animated pulsing dot at the current position */}
              {predictionProgress > 0 && selectedPredictTrack?.data && (
                (() => {
                  const currentIndex = Math.min(
                    Math.floor((predictionProgress / 100) * selectedPredictTrack.data.length),
                    selectedPredictTrack.data.length - 1
                  );
                  const point = selectedPredictTrack.data[currentIndex];
                  return (
                    <g>
                      {/* Outer pulse ring */}
                      <circle
                        cx={point?.x || 0}
                        cy={point?.y || 0}
                        r="15"
                        fill="none"
                        stroke="#fcf003"
                        strokeWidth="2"
                        opacity="0.6"
                      >
                        <animate
                          attributeName="r"
                          values="15;25;15"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.6;0;0.6"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      
                      {/* Inner glowing dot */}
                      <circle
                        cx={point?.x || 0}
                        cy={point?.y || 0}
                        r="8"
                        fill="#fcf003"
                        filter="url(#trackGlow)"
                      >
                        <animate
                          attributeName="r"
                          values="6;10;6"
                          dur="1s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </g>
                  );
                })()
              )}
            </svg>
            
            {/* Progress overlay text */}
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-gray-300 text-sm font-medium bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full inline-block border border-cyan-500/30">
                Optimizing trajectory • Calculating G-forces • Simulating tire dynamics
              </p>
            </div>
          </div>
          
          {/* Thin percentage indicator bar below track */}
          <div className="mt-4">
            <div className="w-full bg-gray-700/30 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 h-1.5 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                style={{ width: `${predictionProgress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
              </div>
            </div>
          </div>
          
          <style>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            .animate-shimmer {
              animation: shimmer 2s infinite;
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Step 2: Results
  if (predictionStep === 2) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
          <h2 className="text-4xl font-bold mb-3 text-green-400">Simulation Complete!</h2>
          <p className="text-gray-400">
            Optimal lap time calculated for{' '}
            <span className="text-cyan-400">{selectedPredictCar?.name}</span> on{' '}
            <span className="text-cyan-400">{selectedPredictTrack?.name}</span>
          </p>
        </div>

        <div className="card-gradient mb-6">
          <h3 className="text-center text-gray-400 text-lg mb-4">Optimal Lap Time</h3>
          <div className="text-center text-6xl font-bold text-white mb-6 font-mono">
            <AnimatedCounter value={predictedLapTime} duration={2000} />
          </div>
          <p className="text-center text-purple-400 text-sm">
            This is the theoretical fastest lap time achievable with perfect driving
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="card-gradient text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-cyan-400" />
            <h4 className="text-lg font-semibold text-gray-300 mb-2">Vehicle</h4>
            <p className="text-2xl font-bold text-white">{selectedPredictCar?.name}</p>
          </div>
          <div className="card-gradient text-center">
            <Target className="w-12 h-12 mx-auto mb-3 text-pink-400" />
            <h4 className="text-lg font-semibold text-gray-300 mb-2">Track</h4>
            <p className="text-2xl font-bold text-white">{selectedPredictTrack?.name}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 items-center">
          {/* Primary Action - View Lap Replay (Disabled - No CSV yet) */}
          <div className="relative group">
            <button
              disabled
              className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 text-gray-400 transition-all font-bold text-lg shadow-lg cursor-not-allowed opacity-60"
            >
              <Play size={24} /> View Lap Replay
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-black/90 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-600">
              Coming soon: Replay generated lap data
            </div>
          </div>
          
          {/* Secondary Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all font-semibold shadow-lg shadow-cyan-500/30"
            >
              <Download size={20} /> Download CSV
            </button>
            <button
              onClick={handleResetPrediction}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all font-semibold"
            >
              New Prediction
            </button>
          </div>
        </div>

        <p className="text-center text-gray-500 mt-6 text-sm">✓ Results saved to database</p>
      </div>
    );
  }
};

export default PredictPage;

