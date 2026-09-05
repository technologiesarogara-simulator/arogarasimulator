/* ══════════════════════════════════════════════════════════════════════
   PHASE 17 REGRESSION — lib/aro-pumpflowviz.js (AROPUMPFLOWVIZ)

   Run:  node tests/pump-flowviz.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpflowviz.js'));
const FV = global.AROPUMPFLOWVIZ;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}
function byId(list, id) { return list.filter(s => s.id === id)[0]; }

console.log('\nAROPUMPFLOWVIZ — window.AROPUMPFLOWVIZ\n');

test('eyeVelocity_ms: Cm1 = Q / (pi/4 * D1^2) exactly, and NaN for invalid inputs', () => {
  const Q = 360, D1 = 0.1; // 360 m3/h = 0.1 m3/s
  const A1 = Math.PI / 4 * D1 * D1;
  close(FV.eyeVelocity_ms(Q, D1), 0.1 / A1, 1e-9);
  assert.ok(isNaN(FV.eyeVelocity_ms(0, D1)));
  assert.ok(isNaN(FV.eyeVelocity_ms(Q, 0)));
  assert.ok(isNaN(FV.eyeVelocity_ms(Q, NaN)));
});

test('buildFlowStations: missing suction/discharge velocity or an inapplicable Euler result reports DATA REQUIRED', () => {
  assert.strictEqual(FV.buildFlowStations({}).status, 'DATA REQUIRED');
  assert.strictEqual(FV.buildFlowStations({ vs_ms: 2, vd_ms: 3 }).status, 'DATA REQUIRED'); // no eulerResult
  assert.strictEqual(FV.buildFlowStations({ vs_ms: 2, vd_ms: 3, eulerResult: { applicable: false } }).status, 'DATA REQUIRED');
});

test('buildFlowStations: returns exactly the 6 documented stations in wetted-path order', () => {
  const r = FV.buildFlowStations({
    vs_ms: 2, vd_ms: 3.5, Q_m3h: 100, D1_m: 0.08,
    eulerResult: { applicable: true, Cu2_ms: 12, Cm2_ms: 5, W2_ms: 8 },
    casingResult: { applicable: true, volute: { Vth_ms: 9 } },
  });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.status, 'CALCULATED');
  assert.deepStrictEqual(r.stations.map(s => s.id),
    ['suction-nozzle', 'impeller-eye', 'impeller-exit-relative', 'impeller-exit-absolute', 'volute-throat', 'discharge-nozzle']);
});

test('buildFlowStations: each station\'s velocity is read straight from the given inputs/results, with only the two documented new combinations', () => {
  const r = FV.buildFlowStations({
    vs_ms: 2, vd_ms: 3.5, Q_m3h: 100, D1_m: 0.08,
    eulerResult: { applicable: true, Cu2_ms: 12, Cm2_ms: 5, W2_ms: 8 },
    casingResult: { applicable: true, volute: { Vth_ms: 9 } },
  });
  assert.strictEqual(byId(r.stations, 'suction-nozzle').velocity_ms, 2);
  assert.strictEqual(byId(r.stations, 'discharge-nozzle').velocity_ms, 3.5);
  assert.strictEqual(byId(r.stations, 'impeller-exit-relative').velocity_ms, 8); // W2_ms verbatim
  assert.strictEqual(byId(r.stations, 'volute-throat').velocity_ms, 9); // Vth_ms verbatim
  close(byId(r.stations, 'impeller-eye').velocity_ms, FV.eyeVelocity_ms(100, 0.08), 1e-9);
  close(byId(r.stations, 'impeller-exit-absolute').velocity_ms, Math.sqrt(12 * 12 + 5 * 5), 1e-9);
});

test('buildFlowStations: an inapplicable casing result marks the volute-throat station unknown, not zero or invented', () => {
  const r = FV.buildFlowStations({
    vs_ms: 2, vd_ms: 3.5, Q_m3h: 100, D1_m: 0.08,
    eulerResult: { applicable: true, Cu2_ms: 12, Cm2_ms: 5, W2_ms: 8 },
    casingResult: { applicable: false },
  });
  const throat = byId(r.stations, 'volute-throat');
  assert.strictEqual(throat.known, false);
  assert.strictEqual(throat.intensity, null);
  assert.ok(!isFinite(throat.velocity_ms));
});

test('buildFlowStations: intensity is normalized 0-1 across known stations, with the fastest at 1 and the slowest at 0', () => {
  const r = FV.buildFlowStations({
    vs_ms: 1, vd_ms: 2, Q_m3h: 100, D1_m: 0.08,
    eulerResult: { applicable: true, Cu2_ms: 12, Cm2_ms: 5, W2_ms: 8 },
    casingResult: { applicable: true, volute: { Vth_ms: 9 } },
  });
  const known = r.stations.filter(s => s.known);
  const fastest = known.reduce((a, b) => a.velocity_ms > b.velocity_ms ? a : b);
  const slowest = known.reduce((a, b) => a.velocity_ms < b.velocity_ms ? a : b);
  close(fastest.intensity, 1, 1e-9);
  close(slowest.intensity, 0, 1e-9);
  known.forEach(s => assert.ok(s.intensity >= 0 && s.intensity <= 1));
});

test('colorForIntensity: returns a valid hex color across the range and the documented endpoint colors', () => {
  for (let t = 0; t <= 1; t += 0.1) assert.ok(/^#[0-9a-f]{6}$/i.test(FV.colorForIntensity(t)), 't=' + t);
  assert.strictEqual(FV.colorForIntensity(0).toLowerCase(), '#38bdf8');
  assert.strictEqual(FV.colorForIntensity(0.5).toLowerCase(), '#f59e0b');
  assert.strictEqual(FV.colorForIntensity(1).toLowerCase(), '#ef4444');
  assert.strictEqual(FV.colorForIntensity(null), '#64748b');
  assert.strictEqual(FV.colorForIntensity(NaN), '#64748b');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
