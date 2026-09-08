/* ══════════════════════════════════════════════════════════════════════
   PUMP BUILD STEP 7 REGRESSION — lib/aro-pumprecip.js (AROPUMPRECIP)

   Run:  node tests/pump-recip.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumprecip.js'));
const R = global.AROPUMPRECIP;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('\nAROPUMPRECIP — window.AROPUMPRECIP\n');

test('sealConstruction: plunger gets packing, piston gets ring/cup, unknown type is DATA REQUIRED', () => {
  assert.strictEqual(R.sealConstruction('plunger-pump').type, 'packing');
  assert.strictEqual(R.sealConstruction('piston-pump').type, 'ring-cup');
  assert.strictEqual(R.sealConstruction('not-a-type').applicable, false);
});

test('estimatePlungerGeometry: DATA REQUIRED without flow/speed/cylinders, otherwise positive bore that grows with flow', () => {
  assert.strictEqual(R.estimatePlungerGeometry({}).applicable, false);
  const g1 = R.estimatePlungerGeometry({ Q_m3h: 5, N_rpm: 150, numCylinders: 3 });
  const g2 = R.estimatePlungerGeometry({ Q_m3h: 20, N_rpm: 150, numCylinders: 3 });
  assert.ok(g1.applicable && g1.bore_mm > 0);
  assert.ok(g2.bore_mm > g1.bore_mm);
  close(g1.stroke_mm, g1.bore_mm * 1.2, 1e-6);
});

test('estimateRodLoad: positive force that grows with differential pressure', () => {
  const low = R.estimateRodLoad({ Q_m3h: 5, N_rpm: 150, numCylinders: 3, diffPressureBar: 20 });
  const high = R.estimateRodLoad({ Q_m3h: 5, N_rpm: 150, numCylinders: 3, diffPressureBar: 200 });
  assert.ok(low.Frod_N > 0);
  assert.ok(high.Frod_N > low.Frod_N);
});

test('screenCrankShaft: DATA REQUIRED without inputs, otherwise a positive crank-pin diameter that grows with rod load', () => {
  assert.strictEqual(R.screenCrankShaft({}).applicable, false);
  const low = R.screenCrankShaft({ bhpKw: 20, N_rpm: 150, Frod_N: 2000, stroke_mm: 30 });
  const high = R.screenCrankShaft({ bhpKw: 20, N_rpm: 150, Frod_N: 20000, stroke_mm: 30 });
  assert.ok(low.applicable && high.applicable);
  assert.ok(low.crankPinDiameter_mm > 0);
  assert.ok(high.crankPinDiameter_mm > low.crankPinDiameter_mm);
});

test('screenCrankShaft: crank-pin sizing is independent of plunger bore, driven by rod load/torque/stroke instead — a small-bore high-pressure plunger can still need a large crank pin', () => {
  // Small bore, huge rod load (high pressure) vs large bore, tiny rod load (low pressure) —
  // the crank pin must track the load, not the bore, unlike the old (removed) bore-fraction approach.
  const highPressureSmallBore = R.screenCrankShaft({ bhpKw: 20, N_rpm: 150, Frod_N: 20000, stroke_mm: 30 });
  const lowPressureLargeBore = R.screenCrankShaft({ bhpKw: 20, N_rpm: 150, Frod_N: 500, stroke_mm: 60 });
  assert.ok(highPressureSmallBore.crankPinDiameter_mm > lowPressureLargeBore.crankPinDiameter_mm);
});

test('accelerationHead: sanity-checked against a known-plausible triplex example (a few feet/metres, not tens or hundreds)', () => {
  // L=10ft(=3.048m), V=2ft/s(=0.6096m/s), N=150rpm, triplex single-acting C=0.066, K=1.4
  // hand calc: ha_ft = 10*2*150*0.066/(1.4*32.174) = 4.3957 ft = 1.3398 m
  const r = R.accelerationHead({ L_m: 3.048, V_ms: 0.6096, N_rpm: 150, numCylinders: 3, actingType: 'single', K: 1.4 });
  assert.ok(r.applicable);
  close(r.ha_m, 1.3398, 0.01, 'acceleration head');
  assert.ok(r.ha_m < 5, 'a plausible triplex ha should be a few metres, not tens or hundreds');
});

test('accelerationHead: DATA REQUIRED without inputs; grows with suction line length, velocity and speed', () => {
  assert.strictEqual(R.accelerationHead({}).applicable, false);
  const base = R.accelerationHead({ L_m: 5, V_ms: 1, N_rpm: 100, numCylinders: 1 });
  const longer = R.accelerationHead({ L_m: 20, V_ms: 1, N_rpm: 100, numCylinders: 1 });
  const faster = R.accelerationHead({ L_m: 5, V_ms: 1, N_rpm: 300, numCylinders: 1 });
  assert.ok(longer.ha_m > base.ha_m);
  assert.ok(faster.ha_m > base.ha_m);
});

test('accelerationHead: more cylinders (phase-shifted) gives a smaller ha for the same duty', () => {
  const simplex = R.accelerationHead({ L_m: 10, V_ms: 1, N_rpm: 150, numCylinders: 1 });
  const triplex = R.accelerationHead({ L_m: 10, V_ms: 1, N_rpm: 150, numCylinders: 3 });
  assert.ok(triplex.ha_m < simplex.ha_m);
});

test('accelerationHead: double-acting gives a smaller ha than single-acting at the same cylinder count', () => {
  const single = R.accelerationHead({ L_m: 10, V_ms: 1, N_rpm: 150, numCylinders: 1, actingType: 'single' });
  const double = R.accelerationHead({ L_m: 10, V_ms: 1, N_rpm: 150, numCylinders: 1, actingType: 'double' });
  assert.ok(double.ha_m < single.ha_m);
});

test('correctedNpshMargin: exact subtraction, correct verdict banding', () => {
  const r = R.correctedNpshMargin(10, 2, 6);
  close(r.npshaCorrected_m, 8, 1e-9);
  close(r.marginCorrected_m, 2, 1e-9);
  assert.strictEqual(r.verdict, 'SUITABLE');
  const tight = R.correctedNpshMargin(10, 2, 7.5);
  assert.strictEqual(tight.verdict, 'CHECK');
  const fail = R.correctedNpshMargin(10, 2, 9);
  assert.strictEqual(fail.verdict, 'NOT RECOMMENDED');
  assert.strictEqual(R.correctedNpshMargin(NaN, 2, 6).applicable, false);
});

test('sizePulsationDampener: DATA REQUIRED without inputs; volume shrinks with cylinder count, grows with a tighter allowable pulsation target', () => {
  assert.strictEqual(R.sizePulsationDampener({}).applicable, false);
  const simplex = R.sizePulsationDampener({ Q_m3h: 10, N_rpm: 150, numCylinders: 1 });
  const triplex = R.sizePulsationDampener({ Q_m3h: 10, N_rpm: 150, numCylinders: 3 });
  assert.ok(triplex.chamberVolume_L < simplex.chamberVolume_L);
  const loose = R.sizePulsationDampener({ Q_m3h: 10, N_rpm: 150, numCylinders: 3, allowablePulsationPct: 10 });
  const tight = R.sizePulsationDampener({ Q_m3h: 10, N_rpm: 150, numCylinders: 3, allowablePulsationPct: 2 });
  assert.ok(tight.chamberVolume_L > loose.chamberVolume_L);
});

test('sizePulsationDampener: precharge is 70% of operating pressure when given, NaN when not', () => {
  const withPress = R.sizePulsationDampener({ Q_m3h: 10, N_rpm: 150, numCylinders: 3, operatingPressureBarG: 100 });
  close(withPress.prechargeBarG, 70, 1e-9);
  const noPress = R.sizePulsationDampener({ Q_m3h: 10, N_rpm: 150, numCylinders: 3 });
  assert.ok(Number.isNaN(noPress.prechargeBarG));
});

test('checkSpeedPlausibility: flags a centrifugal-appropriate speed as implausible for a crank-driven pump, accepts a realistic crank speed', () => {
  const tooFast = R.checkSpeedPlausibility(2900);
  assert.strictEqual(tooFast.plausible, false);
  assert.ok(/generic/.test(tooFast.warning));
  const realistic = R.checkSpeedPlausibility(150);
  assert.strictEqual(realistic.plausible, true);
  assert.strictEqual(R.checkSpeedPlausibility(NaN).applicable, false);
});

test('design: carries the speed-plausibility warning through when the speed looks like the generic default', () => {
  const bad = R.design({ pumpTypeId: 'plunger-pump', Q_m3h: 0.5, N_rpm: 2900, diffPressureBar: 300, numCylinders: 3, L_m: 8, V_ms: 1, npsha_m: 12, npshr_m: 3, operatingPressureBarG: 300 });
  assert.strictEqual(bad.speedPlausibility.plausible, false);
  const good = R.design({ pumpTypeId: 'plunger-pump', Q_m3h: 0.5, N_rpm: 150, diffPressureBar: 300, numCylinders: 3, L_m: 8, V_ms: 1, npsha_m: 12, npshr_m: 3, operatingPressureBarG: 300 });
  assert.strictEqual(good.speedPlausibility.plausible, true);
});

test('checkDriveTrain: near a standard motor speed allows direct coupling; a slow crank speed needs a reducer', () => {
  const direct = R.checkDriveTrain(1450);
  assert.strictEqual(direct.directDrivePossible, true);
  const geared = R.checkDriveTrain(150);
  assert.strictEqual(geared.directDrivePossible, false);
  assert.ok(geared.ratio > 1);
});

test('design: full orchestration is applicable end to end and carries the API 674 basis', () => {
  const d = R.design({
    pumpTypeId: 'plunger-pump', Q_m3h: 5, N_rpm: 150, diffPressureBar: 100, numCylinders: 3, bhpKw: 20,
    L_m: 5, V_ms: 1, npsha_m: 8, npshr_m: 3, operatingPressureBarG: 100, allowablePulsationPct: 5,
  });
  assert.strictEqual(d.applicable, true);
  assert.strictEqual(d.standardsBasis, 'API 674');
  assert.strictEqual(d.seal.type, 'packing');
  assert.ok(d.rodLoad.Frod_N > 0);
  assert.ok(d.crankShaft.applicable);
  assert.ok(d.crankShaft.crankPinDiameter_mm > 0);
  assert.ok(d.accelerationHead.ha_m > 0);
  assert.ok(d.npshCorrection.applicable);
  assert.ok(d.dampener.applicable);
  assert.ok(d.driveTrain.applicable);
});

test('design: without bhpKw, crankShaft screening is DATA REQUIRED and the whole result is not applicable', () => {
  const d = R.design({
    pumpTypeId: 'plunger-pump', Q_m3h: 5, N_rpm: 150, diffPressureBar: 100, numCylinders: 3,
    L_m: 5, V_ms: 1, npsha_m: 8, npshr_m: 3, operatingPressureBarG: 100, allowablePulsationPct: 5,
  });
  assert.strictEqual(d.crankShaft.applicable, false);
  assert.strictEqual(d.applicable, false);
});

test('design: pure function — identical input yields identical output', () => {
  const input = { pumpTypeId: 'piston-pump', Q_m3h: 8, N_rpm: 200, diffPressureBar: 50, numCylinders: 2, bhpKw: 15, L_m: 8, V_ms: 1.2, npsha_m: 6, npshr_m: 2.5, operatingPressureBarG: 50, allowablePulsationPct: 5 };
  const a = JSON.stringify(R.design(Object.assign({}, input)));
  const b = JSON.stringify(R.design(Object.assign({}, input)));
  assert.strictEqual(a, b);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
