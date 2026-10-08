import { useCallback, useEffect, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { tracksAPI } from '../../utils/api';
import { parseTrackCSV } from '../../utils/csvParser';
import { TrackPlot } from '../charts/ScientificCharts';
import { formatValue } from '../../utils/chartFormatting';
export default function TracksPage() {
  const [tracks, setTracks] = useState([]), [selected, setSelected] = useState(null), [points, setPoints] = useState([]), [file, setFile] = useState(null), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const select = useCallback(async track => { try { const r = await tracksAPI.get(track.name); setSelected(track); setPoints(r.data.map(p => ({ x: p.x_m, y: p.y_m }))); } catch (e) { setError(e.message); } }, []);
  const load = useCallback(async () => { try { const r = await tracksAPI.getAll(); setTracks(r.tracks); if (r.tracks.length) await select(r.tracks[0]); } catch (e) { setError(e.message); } }, [select]);
  useEffect(() => { load(); }, [load]);
  const choose = async event => { const f = event.target.files?.[0]; if (!f) return;
    try { setPoints(parseTrackCSV(await f.text(), f.name).data); setFile(f); setName(f.name.replace(/\.csv$/i, '')); setSelected(null); setError(''); } catch (e) { setError(e.message); } event.target.value = '';
  };
  const upload = async e => { e.preventDefault(); setBusy(true); try { await tracksAPI.upload(name, file); setFile(null); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const remove = async () => { if (!selected || !window.confirm(`Delete circuit ${selected.name}?`)) return;
    try { await tracksAPI.delete(selected.name); setSelected(null); setPoints([]); await load(); } catch (e) { setError(e.message); }
  };
  return <div><div className="page-heading"><div><div className="eyebrow">TRACK GEOMETRY</div><h1>Circuits</h1><p>Inspect centreline geometry and track widths.</p></div><label className="button"><Upload size={15} />Import circuit<input type="file" accept=".csv" className="sr-only" onChange={choose} /></label></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="library-layout"><aside className="library-list" aria-label="Circuit library">{tracks.map(t => <button key={t.name} className={selected?.name === t.name ? 'selected' : ''} onClick={() => { setFile(null); select(t); }}>{t.name}<span>{formatValue(t.length / 1000, 3)} km · {t.data_points} nodes</span></button>)}</aside>
      <div>{file && <form className="dataset-bar" onSubmit={upload}><label>Circuit name<input required value={name} onChange={e => setName(e.target.value)} /></label><button className="button primary" disabled={busy}>Store circuit</button></form>}
        {selected && <div className="dataset-bar"><span>{selected.name} · {formatValue(selected.length, 0)} m · {selected.data_points} nodes</span><button className="icon-button" aria-label="Delete selected circuit" onClick={remove}><Trash2 size={15} /></button></div>}
        <TrackPlot data={points} title={selected?.name || name || 'Circuit geometry'} /><div className="model-notes"><h2>Track input</h2><p>TUMFTM CSV: x_m, y_m, w_tr_right_m, w_tr_left_m. Coordinates and widths are in metres. Comment headers are accepted.</p><p>The bundled tracks include DRS, elevation and banking sidecars where available. Uploaded geometry has no sidecars; add measured road profiles in backend storage when available.</p><div className="equation">κ(s) = dψ / ds · ay ≈ v²κ</div></div>
      </div></div>
  </div>;
}
