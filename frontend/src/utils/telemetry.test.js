import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, parseTrackCSV, sampleExtrema } from './csvParser.js';
import { calculateStats, cumulativeEnergy } from './telemetryCalculations.js';
import { alignLaps } from './lapComparison.js';

test('quoted headers, aliases, missing channels and invalid numbers', () => {
  const data = parseCSV('\uFEFF"Time","Distance","Speed","Brake",rpm\r\n0,0,36,false,\r\n1,10,72,true,3000\r\n');
  assert.equal(data[0].speed_kmh, 36); assert.equal(data[0].rpm, null);
  assert.equal(data[1].brake_pct, 100);
  assert.throws(() => parseCSV('speed_kmh\nInfinity\n80'), /finite/);
  assert.throws(() => parseCSV('Time,Speed\n1,20\n0,30'), /Time must increase/);
});
test('statistics use time weights and count braking transitions', () => {
  const data = [{ timestamp_s: 0, arc_length_m: 0, speed_kmh: 0, brake_pct: 0 },
    { timestamp_s: 1, arc_length_m: 1, speed_kmh: 10, brake_pct: 100 },
    { timestamp_s: 10, arc_length_m: 100, speed_kmh: 10, brake_pct: 100 }];
  const stats = calculateStats(data);
  assert.equal(stats.avgSpeed, 9.5); assert.equal(stats.brakeEvents, 1);
  assert.equal(stats.maxRPM, null); assert.equal(stats.lapTime, 10);
});
test('gross ERS energy integrates kW and seconds into MJ', () => {
  const rows = cumulativeEnergy([{ timestamp_s: 0, ers_power_kw: 100 }, { timestamp_s: 10, ers_power_kw: 100 }]);
  assert.equal(rows[1].deployed_energy_mj, 1);
});
test('distance alignment is independent of sample index and absolute timestamps', () => {
  const files = [{ data: [{ arc_length_m: 0, speed_kmh: 10, timestamp_s: 10 }, { arc_length_m: 100, speed_kmh: 30, timestamp_s: 20 }] },
    { data: [{ arc_length_m: 0, speed_kmh: 10, timestamp_s: 100 }, { arc_length_m: 25, speed_kmh: 15, timestamp_s: 103 }, { arc_length_m: 100, speed_kmh: 30, timestamp_s: 112 }] }];
  const rows = alignLaps(files, 3);
  assert.equal(rows[1]['0_speed_kmh'], rows[1]['1_speed_kmh']);
  assert.equal(rows[2]['1_delta'], 2);
  const missing = alignLaps([{ data: [{ arc_length_m: 0, speed_kmh: 1 }, { arc_length_m: 10, speed_kmh: 2 }] },
    { data: [{ arc_length_m: 0, speed_kmh: 1, timestamp_s: 0 }, { arc_length_m: 10, speed_kmh: 2, timestamp_s: 1 }] }]);
  assert.equal(missing[1]['1_delta'], null);
});
test('plot reduction preserves short braking events and boundaries', () => {
  const data = Array.from({ length: 10000 }, (_, i) => ({ index: i, speed_kmh: 200, brake_pct: i === 555 ? 100 : 0 }));
  const rows = sampleExtrema(data, 700);
  assert.ok(rows.some(r => r.index === 555)); assert.equal(rows[0].index, 0); assert.equal(rows.at(-1).index, 9999);
  assert.ok(rows.length < 800);
});
test('TUM comment/header handling does not invent a zero coordinate', () => {
  const track = parseTrackCSV('# x_m,y_m,w_tr_right_m,w_tr_left_m\nx_m,y_m,right,left\n1,2,3,4\n5,6,3,4\n7,8,3,4', 'test');
  assert.equal(track.data.length, 3); assert.deepEqual(track.data[0], { x: 1, y: 2 });
});
