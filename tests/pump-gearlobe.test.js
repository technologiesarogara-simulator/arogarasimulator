/* ══════════════════════════════════════════════════════════════════════
   PUMP BUILD STEP 4 REGRESSION — lib/aro-pumpgearlobe.js (AROPUMPGEARLOBE)

   Run:  node tests/pump-gearlobe.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpgearlobe.js'));
const GL = global.AROPUMPGEARLOBE;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('\nAROPUMPGEARLOBE — window.AROPUMPGEARLOBE\n');

test('PUMP_TYPES: exactly the three meshing-rotor rows, timing gears only on lobe', () => {
  const ids = Object.keys(GL.PUMP_TYPES).sort();
  assert.deepStrictEqual(ids, ['gear-external', 'gear-internal', 'lobe-rotary']);
  assert.strictEqual(GL.PUMP_TYPES['gear-external'].hasTimingGears, false);
  assert.strictEqual(GL.PUMP_TYPES['gear-internal'].hasTimingGears, false);
  assert.strictEqual(GL.PUMP_TYPES['lobe-rotary'].hasTimingGears, true);
});

test('estimateGeometry: DATA REQUIRED shape for an unknown type or missing flow/speed', () => {
  assert.strictEqual(GL.estimateGeometry({}).applicable, false);
  assert.strictEqual(GL.estimateGeometry({ pumpTypeId: 'not-a-type', Q_m3h: 10, N_rpm: 1000 }).applicable, false);
});

test('estimateGeometry: OD grows with flow, shrinks with speed, differs sensibly by type', () => {
  const ext1 = GL.estimateGeometry({ pumpTypeId: 'gear-external', Q_m3h: 10, N_rpm: 1750 });
  const ext2 = GL.estimateGeometry({ pumpTypeId: 'gear-external', Q_m3h: 40, N_rpm: 1750 });
  assert.ok(ext2.OD_mm > ext1.OD_mm);
  const ext3 = GL.estimateGeometry({ pumpTypeId: 'gear-external', Q_m3h: 10, N_rpm: 3500 });
  assert.ok(ext3.OD_mm < ext1.OD_mm);
  const lobe1 = GL.estimateGeometry({ pumpTypeId: 'lobe-rotary', Q_m3h: 10, N_rpm: 1750 });
  assert.ok(lobe1.OD_mm !== ext1.OD_mm, 'different types should not share identical geometry');
});

test('estimateBearingLoads: DATA REQUIRED without a valid type/flow/speed, otherwise positive Fr, zero axial thrust', () => {
  const bad = GL.estimateBearingLoads({});
  assert.strictEqual(bad.applicable, false);
  const r = GL.estimateBearingLoads({ pumpTypeId: 'gear-external', Q_m3h: 20, N_rpm: 1750, diffPressureBar: 30, bhpKw: 15 });
  assert.ok(r.applicable);
  assert.ok(r.Fr_N > 0);
  assert.strictEqual(r.Fa_N, 0, 'spur gears/lobes should carry no axial thrust in this screening');
});

test('estimateBearingLoads: radial load grows with differential pressure', () => {
  const low = GL.estimateBearingLoads({ pumpTypeId: 'gear-external', Q_m3h: 20, N_rpm: 1750, diffPressureBar: 5, bhpKw: 15 });
  const high = GL.estimateBearingLoads({ pumpTypeId: 'gear-external', Q_m3h: 20, N_rpm: 1750, diffPressureBar: 150, bhpKw: 15 });
  assert.ok(high.Fr_N > low.Fr_N);
});

test('estimateBearingLoads: mesh-driven types carry a mesh-force warning', () => {
  const r = GL.estimateBearingLoads({ pumpTypeId: 'gear-external', Q_m3h: 20, N_rpm: 1750, diffPressureBar: 30, bhpKw: 15 });
  assert.ok(r.warnings.length > 0);
});

test('torque: same 9549*P/N relation as the shaft module, NaN on bad input', () => {
  const t = GL.torque(15, 1750);
  assert.ok(Math.abs(t - (9549 * 15 / 1750)) < 1e-9);
  assert.ok(Number.isNaN(GL.torque(0, 1750)));
});

test('screenShaft: DATA REQUIRED without loads, otherwise a positive shaft diameter that grows with load', () => {
  assert.strictEqual(GL.screenShaft({}).applicable, false);
  const low = GL.screenShaft({ bhpKw: 15, N_rpm: 1750, Fr_N: 300, span_m: 0.15 });
  const high = GL.screenShaft({ bhpKw: 15, N_rpm: 1750, Fr_N: 3000, span_m: 0.15 });
  assert.ok(low.applicable && high.applicable);
  assert.ok(high.shaftDiameter_mm > low.shaftDiameter_mm);
});

test('checkDriveTrain: near a standard motor speed allows direct coupling; off-speed needs a reducer', () => {
  const direct = GL.checkDriveTrain(1450);
  assert.strictEqual(direct.directDrivePossible, true);
  const geared = GL.checkDriveTrain(1200);
  assert.strictEqual(geared.directDrivePossible, false);
  assert.ok(geared.ratio !== 1);
});

test('screenSeallessOption: toxic-corrosive favors sealless, abrasives/dry-run rule it out', () => {
  const toxic = GL.screenSeallessOption({ hazard: 'toxic-corrosive', abrasives: false, dryRunRequired: false, viscosityCst: 20 });
  assert.strictEqual(toxic.verdict, 'SUITABLE');
  const abrasive = GL.screenSeallessOption({ hazard: 'toxic-corrosive', abrasives: true, dryRunRequired: false, viscosityCst: 20 });
  assert.strictEqual(abrasive.verdict, 'NOT RECOMMENDED');
  const dryRun = GL.screenSeallessOption({ hazard: 'benign', abrasives: false, dryRunRequired: true, viscosityCst: 20 });
  assert.strictEqual(dryRun.verdict, 'NOT RECOMMENDED');
});

test('screenSeallessOption: benign fluid still applicable but demoted to CHECK, high viscosity flags a slip check', () => {
  const benign = GL.screenSeallessOption({ hazard: 'benign', abrasives: false, dryRunRequired: false, viscosityCst: 20 });
  assert.strictEqual(benign.verdict, 'CHECK');
  const viscous = GL.screenSeallessOption({ hazard: 'toxic', abrasives: false, dryRunRequired: false, viscosityCst: 8000 });
  assert.strictEqual(viscous.verdict, 'CHECK');
  assert.ok(viscous.warnings.some(w => /breakaway/.test(w)));
});

test('design: full orchestration is applicable end to end and carries the right standards basis per type', () => {
  const ext = GL.design({ pumpTypeId: 'gear-external', Q_m3h: 20, N_rpm: 1750, diffPressureBar: 30, bhpKw: 15, hazard: 'flammable', abrasives: false, dryRunRequired: false, viscosityCst: 50 });
  assert.strictEqual(ext.applicable, true);
  assert.strictEqual(ext.standardsBasis, 'API 676');
  const lobe = GL.design({ pumpTypeId: 'lobe-rotary', Q_m3h: 20, N_rpm: 400, diffPressureBar: 5, bhpKw: 5, hazard: 'benign', abrasives: false, dryRunRequired: false, viscosityCst: 50 });
  assert.strictEqual(lobe.applicable, true);
  assert.ok(/3-A/.test(lobe.standardsBasis));
});

test('design: pure function — identical input yields identical output', () => {
  const input = { pumpTypeId: 'gear-internal', Q_m3h: 30, N_rpm: 1450, diffPressureBar: 10, bhpKw: 10, hazard: 'toxic', abrasives: false, dryRunRequired: false, viscosityCst: 100 };
  const a = JSON.stringify(GL.design(Object.assign({}, input)));
  const b = JSON.stringify(GL.design(Object.assign({}, input)));
  assert.strictEqual(a, b);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
