import { useState, useEffect } from 'react';
import { Plus, Trash2, Target, Upload, Map, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, XAxis, YAxis, Tooltip, Scatter } from 'recharts';
import { tracksAPI } from '../../utils/api';
import Papa from 'papaparse';

const TracksPage = () => {
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [previewTrack, setPreviewTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // load tracks from backend on mount
  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const response = await tracksAPI.getAll();
      setTracks(response.tracks || []);
      
      // auto-select first track
      if (response.tracks && response.tracks.length > 0) {
        await loadTrackData(response.tracks[0]);
      }
    } catch (error) {
      console.error('failed to load tracks:', error);
      alert('couldnt load tracks from server: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTrackData = async (track) => {
    try {
      const response = await tracksAPI.get(track.track_name);
      
      // try to detect column names (case insensitive)
      const firstRow = response.data[0] || {};
      const columns = response.columns || Object.keys(firstRow);
      
      // find x and y columns
      const xCol = columns.find(c => c.toLowerCase().includes('x'));
      const yCol = columns.find(c => c.toLowerCase().includes('y'));
      const sCol = columns.find(c => c.toLowerCase().includes('s'));
      
      console.log('track columns:', columns);
      console.log('using columns:', { x: xCol, y: yCol, s: sCol });
      
      // convert backend data to frontend format
      const trackData = {
        id: track.track_name.replace(/\s+/g, '_'),
        name: track.track_name,
        data: response.data.map(row => ({
          x: parseFloat(row[xCol]) || 0,
          y: parseFloat(row[yCol]) || 0,
          s: parseFloat(row[sCol]) || 0
        }))
      };
      
      console.log('loaded track data:', trackData.data.slice(0, 5));
      
      setSelectedTrack(trackData);
      setPreviewTrack(trackData);
    } catch (error) {
      console.error('failed to load track data:', error);
    }
  };

  const handleDeleteTrack = async (trackName, e) => {
    e.stopPropagation();
    
    if (tracks.length <= 1) {
      alert('need at least one track bro');
      return;
    }
    
    if (!confirm(`delete ${trackName}?`)) {
      return;
    }
    
    try {
      await tracksAPI.delete(trackName);
      await loadTracks();
    } catch (error) {
      console.error('failed to delete track:', error);
      alert('couldnt delete track: ' + error.message);
    }
  };

  const handleSelectTrack = async (track) => {
    await loadTrackData(track);
  };

  const handleTrackUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    
    // first parse the csv to validate it
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          // check if csv has required columns
          const headers = results.meta.fields;
          const hasXColumn = headers.some(h => h.toLowerCase().includes('x'));
          const hasYColumn = headers.some(h => h.toLowerCase().includes('y'));
          
          if (!hasXColumn || !hasYColumn) {
            alert('csv needs x and y columns for track coordinates');
            setUploading(false);
            return;
          }

          // ask for track name
          const trackName = prompt('enter track name:', file.name.replace('.csv', ''));
          if (!trackName) {
            setUploading(false);
            return;
          }

          // upload to backend
          await tracksAPI.upload(trackName, file);
          alert('track uploaded successfully!');
          
          // reload tracks
          await loadTracks();
        } catch (error) {
          console.error('upload failed:', error);
          alert('failed to upload track: ' + error.message);
        } finally {
          setUploading(false);
          e.target.value = '';
        }
      },
      error: (error) => {
        console.error('csv parse error:', error);
        alert('invalid csv file');
        setUploading(false);
        e.target.value = '';
      }
    });
  };

  const getTrackStats = (track) => {
    if (!track || !track.data || track.data.length === 0) {
      return { points: 0, length: 0 };
    }

    // calculate approximate track length
    let totalLength = 0;
    for (let i = 1; i < track.data.length; i++) {
      const dx = track.data[i].x - track.data[i - 1].x;
      const dy = track.data[i].y - track.data[i - 1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    return {
      points: track.data.length,
      length: (totalLength / 1000).toFixed(2) // convert to km
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">loading tracks from server...</p>
        </div>
      </div>
    );
  }

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
        {tracks.map(track => (
          <div
            key={track.track_name}
            onClick={() => handleSelectTrack(track)}
            className={`relative group cursor-pointer transition-all duration-300 transform hover:scale-105 ${
              selectedTrack?.name === track.track_name ? 'ring-2 ring-cyan-500' : ''
            }`}
          >
            <div className="card-gradient h-full p-6 text-center hover:bg-white/10">
              {/* Delete Button */}
              {tracks.length > 1 && (
                <button
                  onClick={(e) => handleDeleteTrack(track.track_name, e)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              )}

              {/* Track Icon */}
              <div
                className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  selectedTrack?.name === track.track_name
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600'
                    : 'bg-white/10'
                }`}
              >
                <Map
                  className={selectedTrack?.name === track.track_name ? 'text-white' : 'text-cyan-400'}
                  size={32}
                />
              </div>

              {/* Track Name */}
              <h3 className="text-xl font-bold text-white mb-2">{track.track_name}</h3>

              {/* Quick Stats */}
              <div className="space-y-1 text-sm text-gray-400">
                <p>Length: ~{track.length ? (track.length / 1000).toFixed(2) : '0.00'} km</p>
                <p>Data Points: {track.data_points || 0}</p>
              </div>

              {/* Selection Indicator */}
              {selectedTrack?.name === track.track_name && (
                <div className="mt-4 text-cyan-400 text-sm font-semibold">✓ Selected</div>
              )}
            </div>
          </div>
        ))}

        {/* Upload New Track Card */}
        <label
          className={`cursor-pointer transition-all duration-300 transform hover:scale-105 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="card-gradient h-full p-6 text-center hover:bg-white/10 flex flex-col justify-center items-center min-h-[320px] border-2 border-dashed border-cyan-500/30 hover:border-cyan-500">
            <div className="w-16 h-16 mb-4 rounded-full flex items-center justify-center bg-white/10">
              {uploading ? (
                <RefreshCw className="text-cyan-400 animate-spin" size={32} />
              ) : (
                <Plus className="text-cyan-400" size={32} />
              )}
            </div>
            <Upload className="text-cyan-400 mb-2" size={24} />
            <h3 className="text-xl font-bold text-cyan-400 mb-2">
              {uploading ? 'Uploading...' : 'Upload New Track'}
            </h3>
            <p className="text-sm text-gray-400">Add track layout from CSV</p>
          </div>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleTrackUpload} 
            className="hidden" 
            disabled={uploading}
          />
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
