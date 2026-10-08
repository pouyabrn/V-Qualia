import Papa from 'papaparse';
import { sampleExtrema } from './csvParser.js';

export function labDataset(rows, name) {
  const keys = Object.keys(rows[0] || {});
  const indexKey = keys.includes('sample_index') ? '__sample_index' : 'sample_index';
  const data = rows.map((row, i) => ({ ...row, [indexKey]: i }));
  const columns = [...keys, indexKey].filter(key => data.some(row => Number.isFinite(row[key])));
  if (data.length < 2 || columns.length < 2) throw new Error('CSV needs at least two rows and one numeric channel.');
  return { name, rows: data, columns, indexKey };
}

export function parseLabCSV(text, name) {
  const result = Papa.parse(text.replace(/^\uFEFF/, ''), { header: true, comments: '#', skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
  if (result.errors.length) throw new Error(`Invalid CSV: ${result.errors[0].message}`);
  if (!result.meta.fields?.length || new Set(result.meta.fields).size !== result.meta.fields.length || result.meta.renamedHeaders) throw new Error('CSV channel names must be unique.');
  const rows = result.data.map(raw => Object.fromEntries(Object.entries(raw).map(([key, value]) => {
    const input = String(value).trim();
    let n = input === '' ? NaN : Number(input);
    if (/^(true|false)$/i.test(input)) n = input.toLowerCase() === 'true' ? 1 : 0;
    if (input.includes(':') && /time/i.test(key)) {
      const parts = input.split(':').map(Number); n = parts.every(Number.isFinite) ? parts.reduce((s, v) => s * 60 + v, 0) : NaN;
    }
    return [key, Number.isFinite(n) ? n : null];
  })));
  return labDataset(rows, name);
}

export const derivedOperations = {
  scale: 'a × gain + offset', sum: 'a + b', difference: 'a − b', product: 'a × b', ratio: 'a / b',
  derivative: 'da / dx', integral: '∫ a dx (trapezoidal)'
};

export function addDerived(dataset, spec) {
  if (!spec.name.trim() || dataset.columns.includes(spec.name)) throw new Error('Choose a new channel name.');
  if (!dataset.columns.includes(spec.a) || !derivedOperations[spec.operation]) throw new Error('Choose a valid operation and input channel.');
  const needsB = !['scale', 'derivative', 'integral'].includes(spec.operation);
  if (needsB && !dataset.columns.includes(spec.b)) throw new Error('Choose the second channel.');
  const needsX = ['derivative', 'integral'].includes(spec.operation);
  if (needsX && (!dataset.columns.includes(spec.x) || dataset.rows.some((r, i, rows) => !Number.isFinite(r[spec.x]) || (i > 0 && r[spec.x] <= rows[i - 1][spec.x])))) throw new Error('Derivative/integral X must be finite and strictly increasing.');
  const gain = Number(spec.gain ?? 1), offset = Number(spec.offset ?? 0);
  if (!Number.isFinite(gain) || !Number.isFinite(offset)) throw new Error('Gain and offset must be finite.');
  let integral = 0, integralValid = true;
  const rows = dataset.rows.map((r, i, data) => {
    const a = r[spec.a], b = r[spec.b]; let value = null;
    if (Number.isFinite(a)) {
      if (spec.operation === 'scale') value = a * gain + offset;
      if (needsB && Number.isFinite(b)) value = spec.operation === 'sum' ? a + b : spec.operation === 'difference' ? a - b : spec.operation === 'product' ? a * b : b !== 0 ? a / b : null;
      if (spec.operation === 'derivative') {
        const before = data[Math.max(0, i - 1)], after = data[Math.min(data.length - 1, i + 1)];
        if (Number.isFinite(before[spec.a]) && Number.isFinite(after[spec.a])) {
          if (i === 0 || i === data.length - 1) value = (after[spec.a] - before[spec.a]) / (after[spec.x] - before[spec.x]);
          else { const h0 = r[spec.x] - before[spec.x], h1 = after[spec.x] - r[spec.x];
            value = h1 / (h0 + h1) * (a - before[spec.a]) / h0 + h0 / (h0 + h1) * (after[spec.a] - a) / h1; }
        }
      }
    }
    if (spec.operation === 'integral') {
      if (!Number.isFinite(a) || (i && !Number.isFinite(data[i - 1][spec.a]))) integralValid = false;
      if (integralValid) { if (i) integral += .5 * (a + data[i - 1][spec.a]) * (r[spec.x] - data[i - 1][spec.x]); value = integral; }
    }
    return { ...r, [spec.name]: Number.isFinite(value) ? value : null };
  });
  return { ...dataset, rows, columns: [...dataset.columns, spec.name], derivedSpecs: [...(dataset.derivedSpecs || []), { ...spec }] };
}

export function validateChart(config, dataset) {
  if (!config.title?.trim() || !dataset.columns.includes(config.x) || !['line', 'step', 'scatter'].includes(config.mode)) throw new Error('Choose a title, numeric X channel and plot type.');
  if (!config.series?.length || config.series.length > 8 || config.series.some(s => !dataset.columns.includes(s.key) || !['left', 'right'].includes(s.axis) || !/^#[0-9a-f]{6}$/i.test(s.color))) throw new Error('Select one to eight valid Y channels.');
  if (['xLabel', 'leftLabel', 'rightLabel'].some(key => config[key] != null && typeof config[key] !== 'string') || config.series.some(s => s.label != null && typeof s.label !== 'string')) throw new Error('Chart labels must be text.');
  for (const axis of ['x', 'left', 'right']) {
    const min = config[`${axis}Min`], max = config[`${axis}Max`];
    if ([min, max].some(v => v !== '' && v != null && !Number.isFinite(Number(v)))) throw new Error('Axis limits must be finite numbers.');
    if (min !== '' && min != null && max !== '' && max != null && Number(min) >= Number(max)) throw new Error('Axis minimum must be less than maximum.');
  }
  if (!dataset.rows.some(r => Number.isFinite(r[config.x]) && config.series.some(s => Number.isFinite(r[s.key])))) throw new Error('No finite X/Y pairs in these channels.');
  return { xLabel: '', leftLabel: '', rightLabel: '', xMin: '', xMax: '', leftMin: '', leftMax: '', rightMin: '', rightMax: '', sortX: false, ...config };
}

export function prepareChartData(rows, config) {
  const valid = rows.filter(r => Number.isFinite(r[config.x]));
  if (config.sortX) valid.sort((a, b) => a[config.x] - b[config.x]);
  if (config.mode === 'scatter') { const stride = Math.max(1, Math.ceil(valid.length / 2500)); return valid.filter((_, i) => i % stride === 0 || i === valid.length - 1); }
  const selected = sampleExtrema(valid, 1200, config.series.map(s => s.key));
  // A skipped missing sample must never create a false line across a gap.
  let offset = 0;
  return selected.map(point => {
    const gaps = new Set();
    while (offset < valid.length && valid[offset] !== point) { for (const s of config.series) if (!Number.isFinite(valid[offset][s.key])) gaps.add(s.key); offset++; }
    offset++;
    return gaps.size ? { ...point, ...Object.fromEntries([...gaps].map(k => [k, null])) } : point;
  });
}
