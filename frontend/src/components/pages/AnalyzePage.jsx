import { useState, useMemo } from 'react';
import { Upload, Gauge, Activity, Zap, Wind, Move, Timer, Play, FileText, Trash2, AlertCircle } from 'lucide-react';
import TrackLayoutChart from '../charts/TrackLayoutChart';
import ThrottleBrakeChart from '../charts/ThrottleBrakeChart';
import RpmGearChart from '../charts/RpmGearChart';
import SpeedOverDistanceChart from '../charts/SpeedOverDistanceChart';
import SpeedDistributionChart from '../charts/SpeedDistributionChart';
import GForceVsSpeedChart from '../charts/GForceVsSpeedChart';
import CorneringAnalysisChart from '../charts/CorneringAnalysisChart';
import GForceTraceChart from '../charts/GForceTraceChart';
import SteeringVsGChart from '../charts/SteeringVsGChart';
import GearUsageChart from '../charts/GearUsageChart';
import SteeringTraceChart from '../charts/SteeringTraceChart';
import AeroForcesChart from '../charts/AeroForcesChart';
import TelemetryOverviewChart from '../charts/TelemetryOverviewChart';
import DrivingStylePanel from '../charts/DrivingStylePanel';
import { PageSkeleton, StatsSkeleton, ChartSkeleton } from '../common/LoadingSkeleton';
import { downsampleData } from '../../utils/csvParser';
import { calculateStats, calculateDrivingStyle, getRandomColor } from '../../utils/telemetryCalculations';
import { toast } from '../../utils/toast';

const AnalyzePage = ({ telemetryData, fileName, onFileUpload, rawCsvText }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const stats = useMemo(() => calculateStats(telemetryData), [telemetryData]);
  const sampledTelemetryData = useMemo(() => downsampleData(telemetryData, 10), [telemetryData]);
  const highResSampledData = useMemo(() => downsampleData(telemetryData, 2), [telemetryData]);

  const handleLapReplay = () => {
    if (!rawCsvText) {
      toast.error('No CSV data available for replay');
      return;
    }
    
    try {
      localStorage.setItem('lapReplayData', rawCsvText);
      localStorage.setItem('lapReplayName', fileName || 'Track');
      
      const replayUrl = `${window.location.origin}/#/lap-replay-viewer`;
      window.open(replayUrl, '_blank', 'width=1800,height=900');
      toast.success('Lap replay opened in new window');
    } catch (err) {
      toast.error('Failed to open lap replay');
      console.error(err);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onFileUpload(event);
      toast.success(`Successfully loaded ${file.name}`);
    } catch (err) {
      setError('Failed to parse CSV file. Please check the format.');
      toast.error('Failed to load telemetry data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const drivingStyleData = useMemo(() => {
    const styleCalc = calculateDrivingStyle(telemetryData, stats);
    if (!styleCalc) return null;

    return {
      aggressiveness: styleCalc.aggressiveness,
      stats: [
        { label: "Full Throttle", value: styleCalc.throttlePercent, unit: "%", icon: Zap },
        { label: "Coasting", value: styleCalc.coastingPercent, unit: "%", icon: Wind },
        { label: "Brake Events", value: styleCalc.brakeEvents, unit: "total", icon: Activity },
        { label: "Gear Changes", value: styleCalc.gearChanges, unit: "total", icon: Move },
        { label: "Events / km", value: styleCalc.brakeEventsPerKm, unit: "Brakes/km", icon: Timer },
      ].map(stat => ({ ...stat, color: getRandomColor() }))
    };
  }, [telemetryData, stats]);

  const topStats = useMemo(() => {
    if (!stats) return [];
    return [
      { icon: Gauge, label: 'Max Speed', value: stats.maxSpeed.toFixed(0), unit: 'km/h' },
      { icon: Activity, label: 'Avg Speed', value: stats.avgSpeed.toFixed(1), unit: 'km/h' },
      { icon: Zap, label: 'Max RPM', value: stats.maxRPM.toFixed(0), unit: 'rpm' },
      { icon: Wind, label: 'Avg Throttle', value: stats.avgThrottle.toFixed(1), unit: '%' },
      { icon: Move, label: 'Max G-Force', value: stats.maxGForce.toFixed(2), unit: 'G' },
      { icon: Timer, label: 'Lap Time', value: stats.lapTime.toFixed(2), unit: 's' }
    ].map(stat => ({ ...stat, color: getRandomColor() }));
  }, [stats]);

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-fadeIn">
        <div className="flex items-center justify-center mb-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent mr-3" />
          <span className="text-xl text-cyan-400 font-semibold">Loading telemetry data...</span>
        </div>
        <PageSkeleton />
      </div>
    );
  }

  // Empty state
  if (!telemetryData || !stats) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 animate-fadeIn">
        <div className="max-w-2xl w-full bg-gradient-to-br from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 hover:border-cyan-500/30 transition-all">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-cyan-500/10 rounded-full mb-4">
              <FileText className="w-12 h-12 text-cyan-400" />
            </div>
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Start Your Analysis
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Upload your telemetry CSV file to generate a detailed performance report
              with 14+ interactive visualizations and insights.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <label
            htmlFor="file-upload"
            className="relative flex flex-col items-center justify-center w-full h-56 border-2 border-cyan-500/30 border-dashed rounded-xl cursor-pointer bg-black/20 hover:bg-cyan-500/5 hover:border-cyan-500/50 transition-all group"
          >
            <div className="flex flex-col items-center justify-center text-center p-6">
              <div className="p-4 bg-cyan-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-cyan-400" />
              </div>
              <p className="text-xl font-semibold text-white mb-2">
                Drop your CSV file here
              </p>
              <p className="text-sm text-gray-400 mb-3">
                or click to browse files
              </p>
              <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
                Max size: 10MB
              </span>
            </div>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".csv"
              onChange={handleFileChange}
            />
          </label>

        </div>
      </div>
    );
  }

  // Main content with data
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with file info */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-xl hover:border-cyan-500/30 transition-all animate-slideUp">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{fileName || 'Telemetry Data'}</h3>
            <p className="text-sm text-gray-400">{telemetryData.length.toLocaleString()} data points</p>
          </div>
        </div>
        <label
          htmlFor="file-upload-replace"
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 rounded-lg transition-all cursor-pointer group"
        >
          <Upload className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span className="text-sm text-white">Upload New</span>
          <input
            id="file-upload-replace"
            type="file"
            className="hidden"
            accept=".csv"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {topStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="group bg-gradient-to-br from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4 hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/20 hover:-translate-y-1 cursor-default animate-slideUp"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {stat.value}
                <span className="text-lg text-gray-500 ml-1">{stat.unit}</span>
              </div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Track Layout */}
      <div className="animate-slideUp" style={{ animationDelay: '0.3s' }}>
        <TrackLayoutChart telemetryData={telemetryData} fileName={fileName} stats={stats} />
      </div>

      {/* Telemetry Overview */}
      <div className="animate-slideUp" style={{ animationDelay: '0.4s' }}>
        <TelemetryOverviewChart telemetryData={sampledTelemetryData} />
      </div>

      {/* RPM & Gear */}
      <div className="animate-slideUp" style={{ animationDelay: '0.5s' }}>
        <RpmGearChart telemetryData={highResSampledData} />
      </div>

      {/* G-Force Trace */}
      <div className="animate-slideUp" style={{ animationDelay: '0.6s' }}>
        <GForceTraceChart telemetryData={highResSampledData} />
      </div>

      {/* Grid of Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-0">
        {[
          { Component: SteeringVsGChart, delay: '0.7s' },
          { Component: SpeedOverDistanceChart, delay: '0.75s' },
          { Component: ThrottleBrakeChart, delay: '0.8s' },
          { Component: GearUsageChart, delay: '0.85s' },
          { Component: SteeringTraceChart, delay: '0.9s' },
          { Component: AeroForcesChart, delay: '0.95s' },
          { Component: SpeedDistributionChart, delay: '1s' },
          { Component: CorneringAnalysisChart, delay: '1.05s', extraProps: { stats } },
          { Component: GForceVsSpeedChart, delay: '1.1s', extraProps: { stats } }
        ].map(({ Component, delay, extraProps = {} }, index) => (
          <div key={index} className="animate-slideUp" style={{ animationDelay: delay }}>
            <Component telemetryData={telemetryData} {...extraProps} />
          </div>
        ))}
      </div>

      {/* Driving Style Analysis */}
      <div className="animate-slideUp" style={{ animationDelay: '1.2s' }}>
        <DrivingStylePanel drivingStyleData={drivingStyleData} />
      </div>

      {/* Lap Replay Button */}
      <div className="flex justify-center mt-8 mb-4 animate-slideUp" style={{ animationDelay: '1.3s' }}>
        <button
          onClick={handleLapReplay}
          className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 hover:from-purple-500 hover:via-pink-500 hover:to-cyan-500 text-white transition-all font-bold text-lg shadow-2xl shadow-purple-500/40 hover:scale-105 transform overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
          <Play size={24} className="relative group-hover:scale-110 transition-transform" />
          <span className="relative">View Lap Replay</span>
        </button>
      </div>
    </div>
  );
};

export default AnalyzePage;
