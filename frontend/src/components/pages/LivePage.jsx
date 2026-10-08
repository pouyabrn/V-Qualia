import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import LiveStandalone from './LiveStandalone';
export default function LivePage() {
  const [demo, setDemo] = useState(false);
  return <div><div className="page-heading"><div><div className="eyebrow">STREAM INSPECTION</div><h1>Live telemetry</h1><p>No vehicle feed is connected. The existing preview generates synthetic data at 10 Hz.</p></div><button className="button secondary" onClick={() => window.open(`${window.location.pathname}#/live-standalone`, '_blank', 'noopener')}><ExternalLink size={15} />Pop out demo</button></div>
    <div className="dataset-bar"><span className="tag">SYNTHETIC DEMONSTRATION</span><button className="button" onClick={() => setDemo(!demo)}>{demo ? 'Close preview' : 'Open preview here'}</button></div>
    {demo ? <LiveStandalone /> : <div className="empty-workspace"><h2>Connect measured telemetry to use this as a live instrument</h2><p>The lap predictor produces simulated laps. The demonstration below does not consume a live car connection.</p></div>}
  </div>;
}
