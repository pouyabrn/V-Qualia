import { lazy, Suspense, useState, useEffect } from 'react';
import { Menu, Activity, Gauge, GitCompare, Car, Map, Radio, SlidersHorizontal, BookOpen, LineChart } from 'lucide-react';
import ErrorBoundary from './components/common/ErrorBoundary';
import { parseCSV } from './utils/csvParser';
const Predict = lazy(() => import('./components/pages/PredictPage'));
const Analyze = lazy(() => import('./components/pages/AnalyzePage'));
const ChartLab = lazy(() => import('./components/pages/ChartLabPage'));
const Compare = lazy(() => import('./components/pages/ComparePage'));
const GGV = lazy(() => import('./components/pages/GGVPage'));
const Cars = lazy(() => import('./components/pages/CarsPage'));
const Tracks = lazy(() => import('./components/pages/TracksPage'));
const Live = lazy(() => import('./components/pages/LivePage'));
const LiveStandalone = lazy(() => import('./components/pages/LiveStandalone'));
const Replay = lazy(() => import('./components/pages/LapReplayViewer'));
const nav = [['predict', 'Lap prediction', Gauge], ['analyze', 'Telemetry', Activity], ['chart-lab', 'Chart laboratory', LineChart], ['compare', 'Lap comparison', GitCompare],
  ['ggv', 'GGV envelope', SlidersHorizontal], ['cars', 'Vehicles', Car], ['tracks', 'Circuits', Map], ['live', 'Live telemetry', Radio]];
const getLocation = () => window.location.hash || '#/predict';

export default function App() {
  const [location, setLocation] = useState(getLocation);
  const route = location.slice(2).split('?')[0] || 'predict';
  const [sidebar, setSidebar] = useState(() => window.innerWidth > 850);
  const [dataset, setDataset] = useState(null);
  const [savedRun, setSavedRun] = useState(null);
  const [labState, setLabState] = useState({ dataset: null, charts: [] });
  const [comparisonFiles, setComparisonFiles] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { const change = () => setLocation(getLocation()); window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change); }, []);
  const upload = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const raw = await file.text(); setDataset({ data: parseCSV(raw), name: file.name, raw }); setError(''); }
    catch (e) { setError(e.message); }
    event.target.value = '';
  };
  const standalone = ['lap-replay', 'lap-replay-viewer', 'live-standalone'].includes(route);
  const title = nav.find(n => n[0] === route)?.[1] || 'Lap prediction';
  return <ErrorBoundary><Suspense fallback={<div className="status-message">Loading workspace…</div>}>
    {standalone ? (route === 'live-standalone' ? <LiveStandalone /> : <Replay />) : <div className="app-shell">
      <header className="tool-header"><button className="icon-button" aria-label="Toggle navigation" aria-expanded={sidebar} onClick={() => setSidebar(!sidebar)}><Menu size={19} /></button>
        <a className="wordmark" href="#/predict"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2L30 27H2Z M16 10L23 23H9Z M16 2V10 M2 27L9 23 M30 27L23 23" /></svg><span>V–QUALIA<small>DYNAMICS INTERFACE</small></span></a><span className="header-divider" /><span className="header-title">{title}</span>
        <span className="header-note">MODEL / SIGNAL / ANALYSIS<span className="header-rule" /></span></header>
      <div className="shell-body">{sidebar && <><button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebar(false)} />
        <aside className="tool-sidebar"><div className="sidebar-label">INSTRUMENT DIRECTORY</div><nav aria-label="Workspace navigation">{nav.map(([id, label, Icon], i) => <a key={id} href={`#/${id}`} className={`${route === id ? 'selected' : ''} ${id === 'cars' ? 'nav-divider' : ''}`} onClick={() => { if (window.innerWidth <= 850) setSidebar(false); }}><span className="nav-index">{String(i + 1).padStart(2, '0')}</span><Icon size={16} /><span>{label}</span></a>)}</nav>
          <div className="sidebar-bottom"><BookOpen size={15} /><a href="https://github.com/pouyabrn/LapPredictionEngine/blob/main/validation/REVIEW_REPORT.md" target="_blank" rel="noreferrer">Model & validation</a>
            <p>Quasi-steady-state prediction.<br />Use measured data to check the model.</p></div></aside></>}
        <main className="workspace-main" id="main-content">
          {error && <div role="alert" className="error-message">{error}</div>}
          {route === 'analyze' ? <Analyze telemetryData={dataset?.data} fileName={dataset?.name} rawCsvText={dataset?.raw} onFileUpload={upload} /> :
            route === 'chart-lab' ? <ChartLab state={labState} onState={setLabState} imported={dataset} prediction={savedRun} /> : route === 'compare' ? <Compare files={comparisonFiles} onFiles={setComparisonFiles} /> : route === 'ggv' ? <GGV key={location} /> : route === 'cars' ? <Cars /> : route === 'tracks' ? <Tracks /> : route === 'live' ? <Live /> : <Predict savedRun={savedRun} onRun={setSavedRun} />}
        </main></div></div>}
  </Suspense></ErrorBoundary>;
}
