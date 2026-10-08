import test from 'node:test';
import assert from 'node:assert/strict';
import { addDerived, parseLabCSV, prepareChartData, validateChart } from './chartLab.js';
import { alignLaps, comparisonKeys } from './lapComparison.js';
import { sampleAtGate } from './spatialComparison.js';

test('chart lab accepts numeric arbitrary CSV without speed and retains missing samples', () => {
  const d = parseLabCSV('Time;pressure;temperature;label\n00:00:00;100;20;hot\n00:00:02;;30;warm', 'sensors');
  assert.equal(d.rows[1].Time, 2); assert.equal(d.rows[1].pressure, null); assert.ok(!d.columns.includes('label'));
  const c = { title: 'Pressure', mode: 'line', x: 'Time', series: [{ key: 'pressure', axis: 'right', color: '#abcdef' }] };
  assert.equal(validateChart(c, d).leftMin, '');
  assert.throws(() => validateChart({ ...c, xMin: 3, xMax: 1 }, d), /minimum/);
  assert.throws(() => parseLabCSV('p,p\n1,2\n3,4', 'bad'), /unique/);
});
test('derived signals respect uneven time spacing, zero division and integral gaps', () => {
  const d = parseLabCSV('t,a,b\n0,0,0\n1,1,1\n3,9,3\n4,,4', 'signals');
  const derivative = addDerived(d, { name: 'da', operation: 'derivative', a: 'a', x: 't' });
  assert.equal(derivative.rows[1].da, 2); assert.equal(derivative.rows[2].da, null);
  const ratio = addDerived(d, { name: 'ratio', operation: 'ratio', a: 'a', b: 'b' });
  assert.equal(ratio.rows[0].ratio, null); assert.equal(ratio.rows[2].ratio, 3);
  const integral = addDerived(d, { name: 'int', operation: 'integral', a: 'a', x: 't' });
  assert.equal(integral.rows[2].int, 10.5); assert.equal(integral.rows[3].int, null);
  assert.throws(() => addDerived(d, { name: 'bad', operation: 'integral', a: 'a', x: 'a' }), /strictly increasing/);
});
test('plot reduction never bridges a missing interval', () => {
  const rows = Array.from({ length: 5000 }, (_, i) => ({ x: i, y: i === 2011 ? null : 10 }));
  const plotted = prepareChartData(rows, { x: 'x', mode: 'line', series: [{ key: 'y' }] });
  assert.ok(plotted.some(r => r.y === null)); assert.ok(plotted.length < 1500);
});
test('comparison exposes custom channels and computes differences without fractional gears', () => {
  const files = [{ data: [{ arc_length_m: 0, timestamp_s: 100, rpm: 1000, gear: 1, sensor: 10 }, { arc_length_m: 10, timestamp_s: 110, rpm: 2000, gear: 2, sensor: 20 }] },
    { data: [{ arc_length_m: 0, timestamp_s: 0, rpm: 1500, gear: 1, sensor: 12 }, { arc_length_m: 10, timestamp_s: 12, rpm: 2500, gear: 2, sensor: 22 }] }];
  const rows = alignLaps(files, 3);
  assert.ok(comparisonKeys(files).includes('sensor')); assert.equal(rows[1]['1_diff_sensor'], 2);
  assert.equal(rows[1]['0_gear'], 1); assert.equal(rows[2]['1_diff_timestamp_s'], 2);
});
test('spatial gate aligns different racing lines by physical position and rejects distant lines', () => {
  const ref = Array.from({ length: 11 }, (_, i) => ({ pos_x_m: i * 10, pos_y_m: 0, arc_length_m: i * 10, speed_kmh: 100, timestamp_s: i }));
  const other = Array.from({ length: 6 }, (_, i) => ({ pos_x_m: i * 20, pos_y_m: 3, arc_length_m: i * 20, speed_kmh: 110, timestamp_s: i * 2.2 }));
  const match = sampleAtGate(ref, 5, other);
  assert.equal(match.sample.pos_x_m, 50); assert.equal(match.lateral_m, 3); assert.equal(match.sample.timestamp_s, 5.5);
  assert.equal(sampleAtGate(ref, 5, other.map(r => ({ ...r, pos_y_m: 200 }))), null);
  assert.equal(sampleAtGate(ref, 5, [...other].reverse()), null);
});
