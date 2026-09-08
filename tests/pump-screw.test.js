/* ══════════════════════════════════════════════════════════════════════
   PUMP BUILD STEP 3 REGRESSION — lib/aro-pumpscrew.js (AROPUMPSCREW)

   Run:  node tests/pump-screw.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpscrew.js'));
const SCR = global.AROPUMPSCREW;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('\nAROPUMPSCREW — window.AROPUMPSCREW\n');

test('ROTOR_CONFIGS: exactly single/twin/triple, timing gears only on twin', () => {
  const ids = SCR.ROTOR_CONFIGS.map(c => c.id);
  assert.deepStrictEqual(ids.sort(), ['single-screw', 'triple-screw', 'twin-screw']);
  const byId = {}; SCR.ROTOR_CONFIGS.forEach(c => byId[c.id] = c);
  assert.strictEqual(byId['single-screw'].timingGears, false);
  assert.strictEqual(byId['twin-screw'].timingGears, true);
  assert.strictEqual(byId['triple-screw'].timingGears, false);
});

test('selectRotorConfig: abrasive duty ranks single-screw first, twin-screw NOT RECOMMENDED', () => {
  const r = SCR.selectRotorConfig({ viscosityCst: 50, abrasives: true, abrasivesSizeMicron: 200 });
  assert.strictEqual(r.top.id, 'single-screw');
  const twin = r.ranked.filter(x => x.id === 'twin-screw')[0];
  assert.strictEqual(twin.verdict, 'NOT RECOMMENDED');
  const triple = r.ranked.filter(x => x.id === 'triple-screw')[0];
  assert.strictEqual(triple.verdict, 'NOT RECOMMENDED');
});

test('selectRotorConfig: clean viscous lubricating fluid (e.g. lube oil ~40 cSt, no abrasives) favors triple-screw', () => {
  const r = SCR.selectRotorConfig({ viscosityCst: 40, abrasives: false, shearSensitive: false });
  assert.strictEqual(r.top.id, 'triple-screw');
});

test('selectRotorConfig: thin clean fluid with no abrasives favors twin-screw over triple', () => {
  const r = SCR.selectRotorConfig({ viscosityCst: 2, abrasives: false });
  assert.strictEqual(r.top.id, 'twin-screw');
});

test('selectRotorConfig: single-screw flags high-temperature elastomer-stator limit', () => {
  const r = SCR.selectRotorConfig({ viscosityCst: 50, abrasives: true, tempC: 200 });
  const single = r.ranked.filter(x => x.id === 'single-screw')[0];
  assert.strictEqual(single.verdict, 'CHECK');
  assert.ok(single.warnings.some(w => /150/.test(w)));
});

test('estimateRotorGeometry: DATA REQUIRED shape without flow/speed, otherwise grows with flow and shrinks with speed', () => {
  assert.strictEqual(SCR.estimateRotorGeometry({}).applicable, false);
  const g1 = SCR.estimateRotorGeometry({ Q_m3h: 50, N_rpm: 1450, diffPressureBar: 10 });
  assert.ok(g1.applicable);
  assert.ok(g1.rotorOD_mm > 0);
  const g2 = SCR.estimateRotorGeometry({ Q_m3h: 200, N_rpm: 1450, diffPressureBar: 10 });
  assert.ok(g2.rotorOD_mm > g1.rotorOD_mm, 'more flow at the same speed should need a bigger rotor');
  const g3 = SCR.estimateRotorGeometry({ Q_m3h: 50, N_rpm: 2900, diffPressureBar: 10 });
  assert.ok(g3.rotorOD_mm < g1.rotorOD_mm, 'more speed at the same flow should need a smaller rotor');
});

test('estimateRotorGeometry: effective length grows with differential pressure', () => {
  const low = SCR.estimateRotorGeometry({ Q_m3h: 50, N_rpm: 1450, diffPressureBar: 2 });
  const high = SCR.estimateRotorGeometry({ Q_m3h: 50, N_rpm: 1450, diffPressureBar: 90 });
  assert.ok(high.lengthToOdRatio > low.lengthToOdRatio);
  assert.ok(high.effectiveLength_mm > low.effectiveLength_mm);
});

test('estimateBearingLoads: DATA REQUIRED without flow/speed; otherwise positive Fr/Fa, axial thrust grows with dP', () => {
  const bad = SCR.estimateBearingLoads({});
  assert.strictEqual(bad.applicable, false);
  const lowDp = SCR.estimateBearingLoads({ Q_m3h: 50, N_rpm: 1450, diffPressureBar: 5 });
  const highDp = SCR.estimateBearingLoads({ Q_m3h: 50, N_rpm: 1450, diffPressureBar: 50 });
  assert.ok(lowDp.applicable && highDp.applicable);
  assert.ok(lowDp.Fr_N > 0 && lowDp.Fa_N >= 0);
  assert.ok(highDp.Fa_N > lowDp.Fa_N);
  assert.ok(highDp.warnings.length > 0);
});

test('torque: same 9549*P/N relation as the shaft module, NaN on bad input', () => {
  const t = SCR.torque(37, 1450);
  assert.ok(Math.abs(t - (9549 * 37 / 1450)) < 1e-9);
  assert.ok(Number.isNaN(SCR.torque(0, 1450)));
  assert.ok(Number.isNaN(SCR.torque(37, 0)));
});

test('screenRotorShaft: DATA REQUIRED without loads, otherwise a positive shaft diameter that grows with load', () => {
  assert.strictEqual(SCR.screenRotorShaft({}).applicable, false);
  const low = SCR.screenRotorShaft({ bhpKw: 37, N_rpm: 1450, Fr_N: 500, span_m: 0.3 });
  const high = SCR.screenRotorShaft({ bhpKw: 37, N_rpm: 1450, Fr_N: 5000, span_m: 0.3 });
  assert.ok(low.applicable && high.applicable);
  assert.ok(low.shaftDiameter_mm > 0);
  assert.ok(high.shaftDiameter_mm > low.shaftDiameter_mm);
});

test('checkDriveTrain: near a standard motor speed allows direct coupling; off-speed needs a reducer', () => {
  const direct = SCR.checkDriveTrain(1450);
  assert.strictEqual(direct.directDrivePossible, true);
  assert.strictEqual(direct.reducerNeeded, false);
  const geared = SCR.checkDriveTrain(300);
  assert.strictEqual(geared.directDrivePossible, false);
  assert.strictEqual(geared.reducerNeeded, true);
  assert.ok(geared.ratio > 1);
});

test('nozzleViscosityCaveat: null for ordinary fluids, present and escalating for viscous ones', () => {
  assert.strictEqual(SCR.nozzleViscosityCaveat(1), null);
  assert.strictEqual(SCR.nozzleViscosityCaveat(NaN), null);
  assert.ok(typeof SCR.nozzleViscosityCaveat(150) === 'string');
  assert.ok(typeof SCR.nozzleViscosityCaveat(1000) === 'string');
});

test('design: full orchestration is applicable end to end for a realistic duty and carries the API 676 basis', () => {
  const d = SCR.design({ Q_m3h: 50, N_rpm: 1450, diffPressureBar: 15, viscosityCst: 40, tempC: 60, bhpKw: 37, abrasives: false, shearSensitive: false });
  assert.strictEqual(d.applicable, true);
  assert.strictEqual(d.standardsBasis, 'API 676');
  assert.ok(d.rotorConfig.top);
  assert.ok(d.geometry.rotorOD_mm > 0);
  assert.ok(d.loads.Fr_N > 0);
  assert.ok(d.shaft.shaftDiameter_mm > 0);
  assert.ok(d.driveTrain.applicable);
});

test('design: pure function — identical input yields identical output', () => {
  const input = { Q_m3h: 80, N_rpm: 970, diffPressureBar: 30, viscosityCst: 10, tempC: 40, bhpKw: 55, abrasives: true, abrasivesSizeMicron: 300 };
  const a = JSON.stringify(SCR.design(Object.assign({}, input)));
  const b = JSON.stringify(SCR.design(Object.assign({}, input)));
  assert.strictEqual(a, b);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
