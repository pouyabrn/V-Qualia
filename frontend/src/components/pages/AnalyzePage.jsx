import { useState } from 'react';
import { Upload, ExternalLink } from 'lucide-react';
import TelemetryWorkbench from '../charts/TelemetryWorkbench';
import LapReplayViewer from './LapReplayViewer';
export default function AnalyzePage({ telemetryData, fileName, rawCsvText, onFileUpload }) {
  const [view, setView] = useState('channels');
  const [error, setError] = useState('');
  const popOut = event => {
    try { localStorage.setItem('vqualiaReplayCSV', rawCsvText); }
    catch { event.preventDefault(); setError('Replay is available here. This dataset is too large for browser storage; download it and open it in another workspace.'); }
  };
  return <div><div className="page-heading"><div><div className="eyebrow">DATA INSPECTION</div><h1>Telemetry</h1><p>Inspect a single lap against distance or time.</p></div>
    <label className="button"><Upload size={16} />Import telemetry<input type="file" accept=".csv" onChange={onFileUpload} className="sr-only" /></label></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {!telemetryData ? <div className="empty-workspace"><Upload size={32} /><h2>Load a lap to begin</h2><p>Engine telemetry or FastF1 CSV. Requires speed; time, distance and physical channels enable the corresponding plots.</p><code>timestamp_s, arc_length_m, speed_kmh, g_long, g_lat, …</code></div> : <>
      <div className="dataset-bar"><span>{fileName}</span><div className="segmented"><button aria-pressed={view === 'channels'} onClick={() => setView('channels')}>Channels</button><button aria-pressed={view === 'replay'} onClick={() => setView('replay')}>Lap replay</button></div><a className="button secondary" href={`${window.location.pathname}#/lap-replay-viewer`} target="_blank" rel="noopener noreferrer" onClick={popOut}><ExternalLink size={14} />Pop out replay</a></div>
      {view === 'channels' ? <TelemetryWorkbench data={telemetryData} source="Imported CSV" /> : <LapReplayViewer data={telemetryData} embedded />}
    </>}
  </div>;
}
