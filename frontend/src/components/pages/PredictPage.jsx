import { useState, useEffect, useMemo } from 'react';
import { Car, Target, Download, CheckCircle, TrendingUp, Play, RefreshCw, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, XAxis, YAxis, Scatter } from 'recharts';
import AnimatedCounter from '../common/AnimatedCounter';
import { carsAPI, tracksAPI, predictionsAPI } from '../../utils/api';

const PredictPage = () => {
  // data loading
  const [cars, setCars] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // prediction state
  const [predictionStep, setPredictionStep] = useState(0); // 0: setup, 1: loading, 2: results
  const [selectedPredictCar, setSelectedPredictCar] = useState(null);
  const [selectedPredictTrack, setSelectedPredictTrack] = useState(null);
  const [predictedLapTime, setPredictedLapTime] = useState(null);
  const [predictionProgress, setPredictionProgress] = useState(0);
  const [predictionOutputFile, setPredictionOutputFile] = useState(null);
  const [engineStatus, setEngineStatus] = useState(null);
  
  // selected track data for visualization
  const [trackData, setTrackData] = useState([]);

  // load cars and tracks on mount
  useEffect(() => {
    loadData();
    checkEngineStatus();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [carsResponse, tracksResponse] = await Promise.all([
        carsAPI.getAll(),
        tracksAPI.getAll()
      ]);
      
      setCars(carsResponse.cars || []);
      setTracks(tracksResponse.tracks || []);
      
      // auto-select first car and track
      if (carsResponse.cars && carsResponse.cars.length > 0) {
        setSelectedPredictCar(carsResponse.cars[0]);
      }
      if (tracksResponse.tracks && tracksResponse.tracks.length > 0) {
        const firstTrack = tracksResponse.tracks[0];
        setSelectedPredictTrack(firstTrack);
        // only load visualization if track name exists
        if (firstTrack.name) {
          loadTrackVisualization(firstTrack.name);
        }
      }
    } catch (error) {
      console.error('failed to load data:', error);
      alert('couldnt load cars/tracks: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkEngineStatus = async () => {
    try {
      const status = await predictionsAPI.status();
      setEngineStatus(status);
    } catch (error) {
      console.error('failed to check engine status:', error);
    }
  };

  const loadTrackVisualization = async (trackName) => {
    if (!trackName) {
      console.log('no track name provided for visualization');
      return;
    }
    
    try {
      const response = await tracksAPI.get(trackName);
      if (response.data && response.data.length > 0) {
        // find x, y columns (case-insensitive)
        const keys = Object.keys(response.data[0]);
        const xKey = keys.find(k => k.toLowerCase().includes('x'));
        const yKey = keys.find(k => k.toLowerCase().includes('y'));
        
        if (xKey && yKey) {
          const viz = response.data.map(row => ({
            x: parseFloat(row[xKey]),
            y: parseFloat(row[yKey])
          })).filter(p => !isNaN(p.x) && !isNaN(p.y));
          
          // downsample for better performance and spacing (keep every 10th point)
          const downsampled = viz.filter((_, i) => i % 10 === 0);
          setTrackData(downsampled);
        }
      }
    } catch (error) {
      console.error('failed to load track visualization:', error);
      // don't alert, just log - visualization is not critical
    }
  };

  const handleStartPrediction = async () => {
    if (!selectedPredictCar || !selectedPredictTrack) {
      alert('Please select both a car and a track');
      return;
    }

    // check engine status first
    if (!engineStatus || !engineStatus.ready) {
      alert('Prediction engine not ready! Please build the engine first (run build.bat in backend/engine/)');
      return;
    }

    setPredictionStep(1);
    setPredictionProgress(0);

    // simulate smooth progress while waiting for backend
    const progressInterval = setInterval(() => {
      setPredictionProgress(prev => {
        if (prev >= 95) {
          return prev; // hold at 95% until backend responds
        }
        return prev + 1;
      });
    }, 80); // ~8 seconds to reach 95%

    try {
      // get car and track names (unified format)
      const carName = selectedPredictCar.name;
      const trackName = selectedPredictTrack.name;
      
      console.log('starting prediction:', carName, trackName);
      
      // validate names
      if (!carName || !trackName) {
        throw new Error(`Missing car or track name. Car: ${carName}, Track: ${trackName}`);
      }
      
      // call backend prediction
      const result = await predictionsAPI.predict(carName, trackName);
      
      console.log('prediction result:', result);
      
      // stop progress animation
      clearInterval(progressInterval);
      
      // complete progress
      setPredictionProgress(100);
      setPredictedLapTime(result.lap_time);
      setPredictionOutputFile(result.output_file);
      
      // move to results step
      setTimeout(() => {
        setPredictionStep(2);
      }, 500);
      
    } catch (error) {
      clearInterval(progressInterval);
      console.error('prediction failed:', error);
      alert('Prediction failed: ' + error.message);
      setPredictionStep(0);
      setPredictionProgress(0);
    }
  };

  const handleDownloadCSV = async () => {
    if (!predictionOutputFile) {
      alert('No prediction file available');
      return;
    }

    try {
      // download the CSV file
      const csvText = await predictionsAPI.download(predictionOutputFile);
      
      // create download link
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = predictionOutputFile;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('download failed:', error);
      alert('Failed to download: ' + error.message);
    }
  };

  const handleResetPrediction = () => {
    setPredictionStep(0);
    setPredictionProgress(0);
    setPredictedLapTime(null);
    setPredictionOutputFile(null);
  };

  const handleViewLapReplay = () => {
    // pass the prediction output file to lap replay viewer
    const replayUrl = `${window.location.origin}/#/lap-replay-viewer?file=${encodeURIComponent(predictionOutputFile)}`;
    window.open(replayUrl, '_blank', 'width=1600,height=900');
  };

  // loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">loading cars and tracks...</p>
        </div>
      </div>
    );
  }

  // engine not ready warning
  const engineWarning = engineStatus && !engineStatus.ready && (
    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
      <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
      <div>
        <p className="text-yellow-300 font-semibold">Prediction Engine Not Built</p>
        <p className="text-yellow-400/80 text-sm">
          Run <code className="px-1 bg-black/30 rounded">build.bat</code> in the <code className="px-1 bg-black/30 rounded">backend/engine/</code> directory to build the prediction engine.
        </p>
      </div>
    </div>
  );

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

        {engineWarning}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card-gradient">
            <h3 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
              <Car size={20} /> Select Vehicle
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cars.length === 0 ? (
                <p className="text-gray-500 text-sm">No cars available. Create one in the Cars page.</p>
              ) : (
                cars.map(car => {
                  const carName = car.name;
                  return (
                    <button
                      key={carName}
                      onClick={() => setSelectedPredictCar(car)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedPredictCar?.name === car.name
                          ? 'bg-cyan-500/20 border border-cyan-400'
                          : 'bg-white/5 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <div className="font-medium">{carName}</div>
                      <div className="text-sm text-gray-400">
                        {car.mass?.mass || 'N/A'} kg
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="card-gradient">
            <h3 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
              <Target size={20} /> Select Track
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tracks.length === 0 ? (
                <p className="text-gray-500 text-sm">No tracks available. Upload one in the Tracks page.</p>
              ) : (
                tracks.map((track, index) => {
                  const trackName = track.name || track.filename?.replace('.csv', '') || `track_${index}`;
                  return (
                    <button
                      key={track.name || track.filename || index}
                      onClick={() => {
                        setSelectedPredictTrack(track);
                        if (track.name) {
                          loadTrackVisualization(track.name);
                        }
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedPredictTrack?.name === track.name
                          ? 'bg-cyan-500/20 border border-cyan-400'
                          : 'bg-white/5 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <div className="font-medium">{trackName}</div>
                      <div className="text-sm text-gray-400">
                        {track.length ? `${(track.length / 1000).toFixed(2)} km` : `${track.data_points || 'N/A'} points`}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Track Preview */}
        {trackData.length > 0 && (
          <div className="card-gradient mb-8">
            <h3 className="text-sm font-semibold mb-3 text-cyan-300 uppercase tracking-wider">Track Preview</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="x" type="number" hide />
                <YAxis dataKey="y" type="number" hide />
                <Scatter 
                  data={trackData} 
                  fill="none"
                  stroke="none"
                  line={{ stroke: 'url(#trackGradient)', strokeWidth: 4 }}
                  shape={() => null}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        <button
          onClick={handleStartPrediction}
          disabled={!selectedPredictCar || !selectedPredictTrack || (engineStatus && !engineStatus.ready)}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg font-semibold text-lg hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Prediction
        </button>
      </div>
    );
  }

  // Step 1: Loading
  if (predictionStep === 1) {
    // calculate how much of the track to show in yellow based on progress
    const progressIndex = Math.floor((trackData.length * predictionProgress) / 100);
    const progressTrackData = trackData.slice(0, Math.max(1, progressIndex));

    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-6 text-center text-cyan-300">
          Simulating Lap...
        </h2>
        
        {/* Track with animated path */}
        {trackData.length > 0 && (
          <div className="card-gradient mb-8">
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <defs>
                  <linearGradient id="trackLoadingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                  <filter id="yellowGlow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <XAxis dataKey="x" type="number" hide />
                <YAxis dataKey="y" type="number" hide />
                {/* Base track - full track in dim color */}
                <Scatter
                  data={trackData}
                  fill="none"
                  stroke="none"
                  line={{
                    stroke: 'url(#trackLoadingGradient)',
                    strokeWidth: 4,
                    strokeOpacity: 0.3
                  }}
                  shape={() => null}
                  isAnimationActive={false}
                />
                {/* Progress track - yellow line following progress */}
                <Scatter
                  data={progressTrackData}
                  fill="none"
                  stroke="none"
                  line={{
                    stroke: '#eab308',
                    strokeWidth: 5,
                    filter: 'url(#yellowGlow)'
                  }}
                  shape={() => null}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Progress Bar */}
        <div className="card-gradient">
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Progress</span>
              <span className="text-cyan-400 font-semibold">{predictionProgress.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100"
                style={{ width: `${predictionProgress}%` }}
              />
            </div>
          </div>
          <p className="text-gray-400 text-center text-sm">
            Running physics simulation...
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Results
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <CheckCircle size={64} className="text-green-400 mx-auto mb-4" />
        <h2 className="text-4xl font-bold mb-2 text-cyan-300">
          Prediction Complete!
        </h2>
        <p className="text-gray-400">
          Optimal lap time for {selectedPredictCar?.name || selectedPredictCar?.vehicle_name} at {selectedPredictTrack?.name}
        </p>
      </div>

      <div className="card-gradient mb-8">
        <div className="text-center py-8">
          <div className="text-gray-400 text-sm uppercase tracking-wider mb-3">Optimal Lap Time</div>
          <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500" 
               style={{ 
                 textShadow: '0 0 40px rgba(34, 211, 238, 0.5), 0 0 80px rgba(34, 211, 238, 0.3)',
                 fontFamily: 'system-ui, -apple-system, sans-serif',
                 letterSpacing: '-0.02em'
               }}>
            <AnimatedCounter value={predictedLapTime} decimals={3} suffix="s" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={handleDownloadCSV}
          className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all"
        >
          <Download size={20} />
          Download CSV
        </button>

        <button
          onClick={handleViewLapReplay}
          className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all"
        >
          <Play size={20} />
          View Lap Replay
        </button>

        <button
          onClick={handleResetPrediction}
          className="flex items-center justify-center gap-2 py-4 bg-white/10 rounded-lg font-semibold hover:bg-white/20 transition-all"
        >
          <TrendingUp size={20} />
          New Prediction
        </button>
      </div>

      {/* Track visualization */}
      {trackData.length > 0 && (
        <div className="card-gradient">
          <h3 className="text-lg font-semibold mb-4 text-cyan-300">Predicted Path</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <XAxis dataKey="x" type="number" hide />
              <YAxis dataKey="y" type="number" hide />
              <Scatter
                data={trackData}
                fill="#06b6d4"
                line={{ stroke: '#06b6d4', strokeWidth: 2 }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default PredictPage;


