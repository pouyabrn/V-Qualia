import { useState } from 'react';
import { Plus, Trash2, Target, Upload, Map } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, XAxis, YAxis, Tooltip, Scatter } from 'recharts';

const TracksPage = ({ tracks, setTracks, selectedTrack, setSelectedTrack, onTrackUpload }) => {
  const [previewTrack, setPreviewTrack] = useState(selectedTrack);

  const handleDeleteTrack = (trackId, e) => {
    e.stopPropagation();
    if (tracks.length <= 1) {
      alert('You must have at least one track!');
      return;
    }
    const newTracks = tracks.filter(t => t.id !== trackId);
    setTracks(newTracks);
    if (selectedTrack?.id === trackId) {
      setSelectedTrack(newTracks[0]);
      setPreviewTrack(newTracks[0]);
    }
  };

  const handleSelectTrack = (track) => {
    setSelectedTrack(track);
    setPreviewTrack(track);
  };

  const getTrackStats = (track) => {
    if (!track || !track.data || track.data.length === 0) {
      return { points: 0, length: 0 };
    }

    // Calculate approximate track length
    let totalLength = 0;
    for (let i = 1; i < track.data.length; i++) {
      const dx = track.data[i].x - track.data[i - 1].x;
      const dy = track.data[i].y - track.data[i - 1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    return {
      points: track.data.length,
      length: (totalLength / 1000).toFixed(2) // Convert to km
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Track Database
        </h2>
        <p className="text-gray-400">Select a track or upload a new one</p>
      </div>

      {/* Track Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Existing Tracks */}
        {tracks.map(track => {
          const stats = getTrackStats(track);
          return (
            <div
              key={track.id}
              onClick={() => handleSelectTrack(track)}
              className={`relative group cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                selectedTrack?.id === track.id ? 'ring-2 ring-cyan-500' : ''
              }`}
            >
              <div className="card-gradient h-full p-6 text-center hover:bg-white/10">
                {/* Delete Button */}
                {tracks.length > 1 && (
                  <button
                    onClick={(e) => handleDeleteTrack(track.id, e)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                {/* Track Icon */}
                <div
                  className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    selectedTrack?.id === track.id
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600'
                      : 'bg-white/10'
                  }`}
                >
                  <Map
                    className={selectedTrack?.id === track.id ? 'text-white' : 'text-cyan-400'}
                    size={32}
                  />
                </div>

                {/* Track Name */}
                <h3 className="text-xl font-bold text-white mb-2">{track.name}</h3>

                {/* Quick Stats */}
                <div className="space-y-1 text-sm text-gray-400">
                  <p>Length: ~{stats.length} km</p>
                  <p>Data Points: {stats.points}</p>
                </div>

                {/* Mini Preview */}
                <div className="mt-4 h-20 rounded-lg bg-black/20 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <XAxis type="number" dataKey="x" hide />
                      <YAxis type="number" dataKey="y" hide />
                      <Scatter
                        data={track.data}
                        line={{ stroke: selectedTrack?.id === track.id ? '#06b6d4' : '#4b5563', strokeWidth: 2 }}
                        shape={() => null}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                {/* Selection Indicator */}
                {selectedTrack?.id === track.id && (
                  <div className="mt-4 text-cyan-400 text-sm font-semibold">✓ Selected</div>
                )}
              </div>
            </div>
          );
        })}

        {/* Upload New Track Card */}
        <label
          className="cursor-pointer transition-all duration-300 transform hover:scale-105"
        >
          <div className="card-gradient h-full p-6 text-center hover:bg-white/10 flex flex-col justify-center items-center min-h-[320px] border-2 border-dashed border-cyan-500/30 hover:border-cyan-500">
            <div className="w-16 h-16 mb-4 rounded-full flex items-center justify-center bg-white/10">
              <Plus className="text-cyan-400" size={32} />
            </div>
            <Upload className="text-cyan-400 mb-2" size={24} />
            <h3 className="text-xl font-bold text-cyan-400 mb-2">Upload New Track</h3>
            <p className="text-sm text-gray-400">Add track layout from CSV</p>
          </div>
          <input type="file" accept=".csv" onChange={onTrackUpload} className="hidden" />
        </label>
      </div>

      {/* Large Preview Section */}
      {previewTrack && (
        <div className="card-gradient">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-2xl font-bold text-cyan-300 flex items-center gap-2">
                <Target size={28} />
                {previewTrack.name}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Track Preview - {getTrackStats(previewTrack).points} data points, ~
                {getTrackStats(previewTrack).length} km
              </p>
            </div>
          </div>

          {/* Large Track Visualization */}
          <ResponsiveContainer width="100%" height={500}>
            <ScatterChart>
              <XAxis type="number" dataKey="x" hide />
              <YAxis type="number" dataKey="y" hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10,20,30,0.8)',
                  border: '1px solid #06b6d4',
                  backdropFilter: 'blur(5px)'
                }}
                formatter={(value, name) => [value.toFixed(2) + 'm', name]}
              />
              <Scatter
                data={previewTrack.data}
                line={{ stroke: '#06b6d4', strokeWidth: 4 }}
                shape={() => null}
              />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Track Information Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400">Data Points</p>
              <p className="text-2xl font-bold text-white">{getTrackStats(previewTrack).points}</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400">Est. Length</p>
              <p className="text-2xl font-bold text-cyan-400">
                {getTrackStats(previewTrack).length} km
              </p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400">Format</p>
              <p className="text-2xl font-bold text-white">CSV</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-sm text-gray-400">Status</p>
              <p className="text-2xl font-bold text-green-400">✓ Ready</p>
            </div>
          </div>
        </div>
      )}

      {/* Attributions */}
      <div className="card-gradient text-sm text-gray-400">
        <p className="flex items-center justify-center gap-2 mb-2">
          <Target size={16} className="text-cyan-400" /> Track Data & Attribution
        </p>
        <p className="text-center">
          Track layouts and physics concepts influenced by TUMFTM's excellent open-source work.
        </p>
        <div className="flex justify-center gap-4 mt-3">
          <a
            href="https://github.com/TUMFTM/laptime-simulation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline"
          >
            Laptime Simulation
          </a>
          <a
            href="https://github.com/TUMFTM/racetrack-database"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline"
          >
            Racetrack Database
          </a>
        </div>
      </div>
    </div>
  );
};

export default TracksPage;
