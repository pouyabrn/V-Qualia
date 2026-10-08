import { useState } from 'react';
import { Download, Plus, Upload, Pencil, X } from 'lucide-react';
import Papa from 'papaparse';
import { addDerived, derivedOperations, labDataset, parseLabCSV, validateChart } from '../../utils/chartLab';
import { colors } from '../../utils/chartFormatting';
import { axisLabel, channelInfo } from '../../utils/channelInfo';
import CustomTelemetryPlot from '../charts/CustomTelemetryPlot';

const makeChart = dataset => {
  const x = dataset.columns.find(k => /^(arc_length_m|Distance)$/i.test(k)) || dataset.columns.find(k => /^(timestamp_s|Time)$/i.test(k)) || dataset.indexKey;
  const y = dataset.columns.find(k => /^(speed_kmh|Speed)$/i.test(k)) || dataset.columns.find(k => k !== x && k !== dataset.indexKey);
  return { id: crypto.randomUUID(), title: `${channelInfo(y).label} / ${channelInfo(x).label}`, x, xLabel: axisLabel(x), leftLabel: axisLabel(y), rightLabel: '', mode: 'line', sortX: false,
    xMin: '', xMax: '', leftMin: '', leftMax: '', rightMin: '', rightMax: '', series: [{ key: y, label: y, color: colors[0], axis: 'left' }] };
};
const saveFile = (name, content, type) => { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

export default function ChartLabPage({ state, onState, imported, prediction }) {
  const { dataset, charts } = state;
  const [draft, setDraft] = useState(null), [editing, setEditing] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [derived, setDerived] = useState({ name: '', operation: 'scale', a: '', b: '', x: '', gain: 1, offset: 0 });
  const current = draft || (dataset ? makeChart(dataset) : null);
  const change = (key, value) => setDraft({ ...current, [key]: value });
  const layout = (data, views) => ({ version: 1, charts: views, derived: data?.derivedSpecs || [] });
  const store = (nextDataset, nextCharts) => { onState({ dataset: nextDataset, charts: nextCharts }); try { localStorage.setItem('vqualiaChartLayout', JSON.stringify(layout(nextDataset, nextCharts))); } catch { /* Layout export remains available. */ } };
  const loadDataset = next => {
    let layouts = charts, specs = dataset?.derivedSpecs || [];
    if (!layouts.length) { try { const saved = JSON.parse(localStorage.getItem('vqualiaChartLayout') || '{}'); layouts = Array.isArray(saved.charts) ? saved.charts.slice(0, 50) : []; specs = Array.isArray(saved.derived) ? saved.derived : []; } catch { layouts = []; } }
    for (const spec of specs) if (!next.columns.includes(spec.name)) { try { next = addDerived(next, spec); } catch { /* Only matching derived definitions can be restored on another CSV. */ } }
    layouts = layouts.filter(config => { try { validateChart(config, next); return true; } catch { return false; } });
    const first = makeChart(next); store(next, layouts.length ? layouts : [first]); setDraft(first); setEditing(null);
    setDerived(d => ({ ...d, a: first.series[0].key, b: first.series[0].key, x: first.x })); setError(''); setMessage('CSV stays in this browser. Matching chart layouts are retained.');
  };
  const upload = async event => { try { const file = event.target.files?.[0]; if (file) loadDataset(parseLabCSV(await file.text(), file.name)); } catch (e) { setError(e.message); } event.target.value = ''; };
  const loadSource = callback => { try { loadDataset(callback()); } catch (e) { setError(e.message); } };
  const submit = event => { event.preventDefault(); try {
    const config = validateChart({ ...current, id: editing || crypto.randomUUID() }, dataset);
    store(dataset, editing ? charts.map(c => c.id === editing ? config : c) : [...charts, config]); setEditing(null); setDraft({ ...config, id: crypto.randomUUID() }); setError(''); setMessage(editing ? 'Chart updated.' : 'Chart added.');
  } catch (e) { setError(e.message); } };
  const seriesChange = (key, field, value) => change('series', current.series.map(s => s.key === key ? { ...s, [field]: value } : s));
  const derive = () => { try { const next = addDerived(dataset, derived); store(next, charts); setError(''); setMessage(`${derived.name} created: ${derivedOperations[derived.operation]}. Label its units in the chart.`); } catch (e) { setError(e.message); } };
  const importLayout = async event => { try { const file = event.target.files?.[0]; if (!file) return; const layout = JSON.parse(await file.text());
    if (layout.version !== 1 || !Array.isArray(layout.charts) || !layout.charts.length || layout.charts.length > 50) throw new Error('Expected a V-Qualia chart-layout JSON with 1–50 charts.');
    let nextDataset = dataset;
    if (layout.derived != null && !Array.isArray(layout.derived)) throw new Error('Invalid derived channel definitions.');
    for (const spec of layout.derived || []) if (!nextDataset.columns.includes(spec.name)) nextDataset = addDerived(nextDataset, spec);
    const next = layout.charts.map(config => ({ ...validateChart(config, nextDataset), id: crypto.randomUUID() })); store(nextDataset, next); setError(''); setMessage('Chart layout and mathematics loaded.');
  } catch (e) { setError(e.message); } event.target.value = ''; };
  return <div><div className="page-heading"><div><div className="eyebrow">USER-DEFINED INSTRUMENTS / CSV</div><h1>Chart laboratory</h1><p>Create plots from any numeric telemetry column. Choose the channels, axes and units.</p></div><label className="button"><Upload size={15} />Load CSV<input type="file" accept=".csv,.tsv,.txt" className="sr-only" onChange={upload} /></label></div>
    <div className="lab-source-actions">{imported?.raw && <button className="button secondary" onClick={() => loadSource(() => parseLabCSV(imported.raw, imported.name))}>Use imported telemetry</button>}{prediction?.data && <button className="button secondary" onClick={() => loadSource(() => labDataset(prediction.data, `${prediction.car} / ${prediction.track}`))}>Use latest prediction</button>}<span className="source-label">LOCAL DATA / NO CSV UPLOAD TO SERVER</span></div>
    {error && <div role="alert" className="error-message">{error}</div>}{message && <div role="status" className="lab-message">{message}</div>}
    {!dataset ? <div className="empty-workspace"><div className="instrument-glyph">⌘</div><h2>Build your own instruments</h2><p>Load a CSV with numeric channels. Speed is optional. Add traces or XY scatter plots, place channels on separate Y axes, set ranges, and derive new signals.</p><code>line / step / scatter · 2 axes · math channels · saved layouts</code></div> : <>
      <div className="dataset-bar"><span>{dataset.name}</span><span className="tag">{dataset.rows.length.toLocaleString()} rows / {dataset.columns.length} numeric channels</span><button className="button secondary" onClick={() => saveFile('VQualia-chart-layout.json', JSON.stringify(layout(dataset, charts), null, 2), 'application/json')}><Download size={13} />Save layout</button><label className="button secondary">Load layout<input className="sr-only" type="file" accept=".json" onChange={importLayout} /></label><button className="button secondary" onClick={() => saveFile('VQualia-chart-data.csv', Papa.unparse(dataset.rows), 'text/csv')}>Export data</button></div>
      <div className="chart-lab-layout"><aside className="chart-builder"><form onSubmit={submit}><h2>{editing ? 'Edit instrument' : 'Create instrument'}</h2>
        <label>Chart title<input value={current.title} onChange={e => change('title', e.target.value)} required /></label>
        <div className="builder-row"><label>Plot type<select value={current.mode} onChange={e => change('mode', e.target.value)}><option value="line">Line trace</option><option value="step">Step trace</option><option value="scatter">XY scatter</option></select></label><label>X channel<select value={current.x} onChange={e => { setDraft({ ...current, x: e.target.value, xLabel: axisLabel(e.target.value) }); }}>{dataset.columns.map(k => <option key={k}>{k}</option>)}</select></label></div>
        <label>X label / units<input value={current.xLabel} onChange={e => change('xLabel', e.target.value)} placeholder="Time / s" /></label>
        <label className="checkbox-label"><input type="checkbox" checked={current.sortX} onChange={e => change('sortX', e.target.checked)} />Sort by X (otherwise CSV order)</label>
        <div className="setup-divider">Y CHANNELS / UP TO 8</div><div className="channel-picker">{dataset.columns.map((key, i) => { const selected = current.series.find(s => s.key === key); return <div className="channel-choice" key={key}><label><input type="checkbox" checked={Boolean(selected)} onChange={e => change('series', e.target.checked ? [...current.series, { key, label: key, axis: 'left', color: colors[i % colors.length] }] : current.series.filter(s => s.key !== key))} />{key}</label>{selected && <div className="series-settings"><input type="color" aria-label={`Colour for ${key}`} value={selected.color} onChange={e => seriesChange(key, 'color', e.target.value)} /><select aria-label={`Axis for ${key}`} value={selected.axis} onChange={e => seriesChange(key, 'axis', e.target.value)}><option value="left">Left Y</option><option value="right">Right Y</option></select></div>}</div>; })}</div>
        <div className="builder-row"><label>Left Y label / units<input value={current.leftLabel} onChange={e => change('leftLabel', e.target.value)} /></label><label>Right Y label / units<input value={current.rightLabel} onChange={e => change('rightLabel', e.target.value)} /></label></div>
        <details className="builder-details"><summary>Axis ranges</summary>{['x', 'left', 'right'].map(axis => <div key={axis} className="builder-row"><label>{axis} minimum<input type="number" step="any" placeholder="Auto" value={current[`${axis}Min`]} onChange={e => change(`${axis}Min`, e.target.value)} /></label><label>{axis} maximum<input type="number" step="any" placeholder="Auto" value={current[`${axis}Max`]} onChange={e => change(`${axis}Max`, e.target.value)} /></label></div>)}</details>
        <button className="button primary run-button" type="submit"><Plus size={14} />{editing ? 'Update chart' : 'Add chart'}</button>{editing && <button type="button" className="button secondary run-button" onClick={() => { setEditing(null); setDraft(makeChart(dataset)); }}>Cancel editing</button>}
      </form><details className="builder-details"><summary>Derived channels / mathematics</summary><label>New channel name<input value={derived.name} onChange={e => setDerived({ ...derived, name: e.target.value })} /></label><label>Operation<select value={derived.operation} onChange={e => setDerived({ ...derived, operation: e.target.value })}>{Object.entries(derivedOperations).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {['a', ...(!['scale', 'derivative', 'integral'].includes(derived.operation) ? ['b'] : []), ...(['derivative', 'integral'].includes(derived.operation) ? ['x'] : [])].map(key => <label key={key}>Input {key}<select value={derived[key]} onChange={e => setDerived({ ...derived, [key]: e.target.value })}>{dataset.columns.map(k => <option key={k}>{k}</option>)}</select></label>)}
        {derived.operation === 'scale' && <div className="builder-row">{['gain', 'offset'].map(k => <label key={k}>{k}<input type="number" step="any" value={derived[k]} onChange={e => setDerived({ ...derived, [k]: e.target.value })} /></label>)}</div>}
        <p className="method-note">Units are your choice. Derivative uses neighbouring samples; integral requires strictly increasing X. Missing samples remain missing.</p><button className="button run-button" onClick={derive}>Create channel</button></details></aside>
        <div className="lab-plots">{charts.map((config, i) => <div className="lab-chart" key={config.id}><div className="lab-chart-actions"><span>INSTRUMENT {String(i + 1).padStart(2, '0')}</span><button className="icon-button" aria-label={`Edit ${config.title}`} onClick={() => { setDraft(structuredClone(config)); setEditing(config.id); }}><Pencil size={14} /></button><button className="icon-button" aria-label={`Remove ${config.title}`} onClick={() => store(dataset, charts.filter(c => c.id !== config.id))}><X size={14} /></button></div><CustomTelemetryPlot dataset={dataset} config={config} /></div>)}{!charts.length && <div className="empty-panel">Select channels and add an instrument.</div>}</div>
      </div>
    </>}
  </div>;
}
