import { ExternalLink, Activity, Zap, TrendingUp, Monitor } from 'lucide-react';

const LivePage = () => {
  const openStandalone = () => {
    const standaloneUrl = `${window.location.origin}/#/live-standalone`;
    const newWindow = window.open(standaloneUrl, '_blank', 'width=1400,height=900');
    
    if (!newWindow) {
      alert('Please allow pop-ups for this site to open the Live Monitoring window.');
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        {/* Icon */}
        <div className="relative inline-block">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-full flex items-center justify-center border-2 border-red-500/30 shadow-2xl shadow-red-500/20">
            <Activity className="text-red-400" size={64} />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-400 via-rose-400 to-pink-400 bg-clip-text text-transparent">
            Live Telemetry Monitoring
          </h1>
          <p className="text-xl text-gray-400">
            Real-time vehicle data tracking at 100Hz
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
            <Zap className="text-cyan-400 mx-auto mb-2" size={24} />
            <h3 className="text-sm font-semibold text-gray-300 mb-1">High Frequency</h3>
            <p className="text-xs text-gray-500">100Hz update rate</p>
          </div>
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
            <TrendingUp className="text-purple-400 mx-auto mb-2" size={24} />
            <h3 className="text-sm font-semibold text-gray-300 mb-1">Live Charts</h3>
            <p className="text-xs text-gray-500">4 real-time graphs</p>
          </div>
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-xl p-4">
            <Monitor className="text-emerald-400 mx-auto mb-2" size={24} />
            <h3 className="text-sm font-semibold text-gray-300 mb-1">Optimized</h3>
            <p className="text-xs text-gray-500">Standalone mode</p>
          </div>
        </div>

        {/* Main CTA */}
        <div className="space-y-4 mt-8">
          <button
            onClick={openStandalone}
            className="group relative px-8 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105"
          >
            <div className="flex items-center justify-center gap-3">
              <ExternalLink size={24} />
              <span>Open Live Monitoring</span>
            </div>
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 rounded-xl" />
          </button>
          
          <p className="text-sm text-gray-500">
            Opens in a new window for optimal performance
          </p>
        </div>

        {/* Features List */}
        <div className="mt-12 bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border border-gray-700/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-300 mb-4">What's Included</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-300">Speed Tracking</p>
                <p className="text-xs text-gray-500">Real-time speed graph (0-400 km/h)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-300">RPM Monitoring</p>
                <p className="text-xs text-gray-500">Engine RPM chart (5k-15k)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-300">G-Force Analysis</p>
                <p className="text-xs text-gray-500">Lateral & longitudinal forces</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-300">Temperature Sensors</p>
                <p className="text-xs text-gray-500">Engine & brake temp monitoring</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-300">Throttle Input</p>
                <p className="text-xs text-gray-500">Real-time throttle application</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-rose-400 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-300">Brake Pressure</p>
                <p className="text-xs text-gray-500">Live brake force tracking</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-6 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-400">
            💡 <strong>Performance Tip:</strong> The standalone window provides better performance by isolating the monitoring process from the main application.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LivePage;
