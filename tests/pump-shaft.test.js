/* ══════════════════════════════════════════════════════════════════════
   PHASE 7 REGRESSION — lib/aro-pumpshaft.js (AROPUMPSHAFT)

   Run:  node tests/pump-shaft.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpshaft.js'));
const SH = global.AROPUMPSHAFT;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}
const VALID_VERDICTS = ['SUITABLE', 'CHECK', 'NOT RECOMMENDED'];

console.log('\nAROPUMPSHAFT — window.AROPUMPSHAFT\n');

test('torque: matches T = 9549 * P(kW) / N(rpm) exactly', () => {
  close(SH.torque(15, 2900), 9549 * 15 / 2900, 1e-9);
  assert.ok(Number.isNaN(SH.torque(0, 2900)));
  assert.ok(Number.isNaN(SH.torque(15, 0)));
});

test('radialThrustFactor: matches Kr = 0.36*(1-(pctBep/100)^2), floored at 0.05 and capped at 0.36', () => {
  close(SH.radialThrustFactor(0), 0.36, 1e-9);
  close(SH.radialThrustFactor(50), 0.36 * (1 - 0.25), 1e-9);
  close(SH.radialThrustFactor(100), 0.05, 1e-9, 'raw value at BEP is 0, floored to 0.05');
  close(SH.radialThrustFactor(150), 0.05, 1e-9, 'beyond BEP stays at the floor, never negative');
});

test('estimateImpellerMass: uses the supplied density when given, a documented default otherwise', () => {
  const withDefault = SH.estimateImpellerMass({ D2_m: 0.2, shapeFamily: 'radial' });
  assert.strictEqual(withDefault.densityAssumed, true);
  assert.strictEqual(withDefault.densityUsed, 7200);
  const withOverride = SH.estimateImpellerMass({ D2_m: 0.2, shapeFamily: 'radial', densityKgM3: 8000 });
  assert.strictEqual(withOverride.densityAssumed, false);
  close(withOverride.mass_kg, withDefault.mass_kg * (8000 / 7200), 1e-9, 'mass should scale linearly with density');
});

test('estimateImpellerMass: mass is exactly density * (pi/4) * D2^2 * b2 * solidity', () => {
  const r = SH.estimateImpellerMass({ D2_m: 0.3, shapeFamily: 'Francis / mixed flow', densityKgM3: 7500 });
  const expectedVolume = (Math.PI / 4) * 0.3 * 0.3 * r.b2_m * r.solidity;
  close(r.mass_kg, 7500 * expectedVolume, 1e-9);
});

test('estimateImpellerMass: wider shape families (axial) give a proportionally heavier impeller at the same D2', () => {
  const radial = SH.estimateImpellerMass({ D2_m: 0.3, shapeFamily: 'radial' });
  const axial = SH.estimateImpellerMass({ D2_m: 0.3, shapeFamily: 'axial flow' });
  assert.ok(axial.mass_kg > radial.mass_kg);
});

test('combinedStressDiameter: keyway derating reduces the allowable stress by exactly 25%, so the derated shaft is larger', () => {
  const noKeyway = SH.combinedStressDiameter({ torque_Nm: 100, bendingMoment_Nm: 200, materialId: 'carbon-steel', keywayDerate: false });
  const withKeyway = SH.combinedStressDiameter({ torque_Nm: 100, bendingMoment_Nm: 200, materialId: 'carbon-steel', keywayDerate: true });
  close(withKeyway.tauAllowMPa, noKeyway.tauAllowMPa * 0.75, 1e-9);
  assert.ok(withKeyway.d_m > noKeyway.d_m, 'a lower allowable stress must require a larger diameter for the same loads');
});

test('combinedStressDiameter: unknown material returns null rather than a fabricated diameter', () => {
  assert.strictEqual(SH.combinedStressDiameter({ torque_Nm: 100, bendingMoment_Nm: 200, materialId: 'unobtainium' }), null);
});

test('staticDeflection and firstCriticalSpeed: both scale with I = pi*d^4/64 exactly, verified via a doubled diameter', () => {
  const d1 = SH.staticDeflection({ F_N: 500, L_m: 0.2, d_m: 0.03, E_GPa: 200 });
  const d2 = SH.staticDeflection({ F_N: 500, L_m: 0.2, d_m: 0.06, E_GPa: 200 });
  // y is inversely proportional to I ~ d^4, so doubling d should cut deflection by 2^4=16
  close(d1.y_m / d2.y_m, 16, 1e-6);

  const c1 = SH.firstCriticalSpeed({ mass_kg: 5, L_m: 0.2, d_m: 0.03, E_GPa: 200 });
  const c2 = SH.firstCriticalSpeed({ mass_kg: 5, L_m: 0.2, d_m: 0.06, E_GPa: 200 });
  // Nc ~ sqrt(I) ~ sqrt(d^4) = d^2, so doubling d should quadruple Nc
  close(c2.Nc_rpm / c1.Nc_rpm, 4, 1e-6);
});

test('screenShaft: missing duty inputs report DATA REQUIRED, never a fabricated shaft size', () => {
  assert.strictEqual(SH.screenShaft({}).status, 'DATA REQUIRED');
  assert.strictEqual(SH.screenShaft({ bhpKw: 10, N_rpm: 2900, D2_m: 0.2, shapeFamily: 'radial', pctBep: 100, H_stage_m: 50 }).status, 'DATA REQUIRED'); // no materialId
});

test('screenShaft: a comfortable, ordinary duty comes back SUITABLE with a physically sane shaft size', () => {
  const r = SH.screenShaft({ bhpKw: 10, N_rpm: 2900, D2_m: 0.2, shapeFamily: 'radial', pctBep: 100, H_stage_m: 50, materialId: 'carbon-steel' });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.status, 'PRELIMINARY ASSUMPTION');
  assert.ok(VALID_VERDICTS.includes(r.verdict));
  assert.ok(r.shaftDiameter_mm > 5 && r.shaftDiameter_mm < 200, 'expected a plausible pump shaft diameter, got ' + r.shaftDiameter_mm);
});

test('screenShaft: a much higher torque duty needs a larger shaft diameter, all else equal', () => {
  const low = SH.screenShaft({ bhpKw: 5, N_rpm: 2900, D2_m: 0.2, shapeFamily: 'radial', pctBep: 100, H_stage_m: 50, materialId: 'carbon-steel' });
  const high = SH.screenShaft({ bhpKw: 200, N_rpm: 2900, D2_m: 0.2, shapeFamily: 'radial', pctBep: 100, H_stage_m: 50, materialId: 'carbon-steel' });
  assert.ok(high.shaftDiameter_mm > low.shaftDiameter_mm);
});

test('screenShaft: a stronger material (super-duplex) needs a smaller diameter than a weaker one (carbon steel) for the identical duty', () => {
  const duty = { bhpKw: 30, N_rpm: 2900, D2_m: 0.25, shapeFamily: 'Francis / mixed flow', pctBep: 80, H_stage_m: 60 };
  const cs = SH.screenShaft(Object.assign({}, duty, { materialId: 'carbon-steel' }));
  const sd = SH.screenShaft(Object.assign({}, duty, { materialId: 'super-duplex' }));
  assert.ok(sd.shaftDiameter_mm < cs.shaftDiameter_mm);
});

test('screenShaft: operating far off BEP (higher radial thrust) needs a larger shaft than operating at BEP', () => {
  const duty = { bhpKw: 30, N_rpm: 2900, D2_m: 0.25, shapeFamily: 'Francis / mixed flow', H_stage_m: 60, materialId: 'carbon-steel' };
  const atBep = SH.screenShaft(Object.assign({}, duty, { pctBep: 100 }));
  const atShutoff = SH.screenShaft(Object.assign({}, duty, { pctBep: 0 }));
  assert.ok(atShutoff.shaftDiameter_mm > atBep.shaftDiameter_mm);
  assert.ok(atShutoff.radialThrust_N > atBep.radialThrust_N);
});

test('screenAllShaftMaterials: ranks all five shaft-capable materials, smallest diameter first among equal verdicts', () => {
  const r = SH.screenAllShaftMaterials({ bhpKw: 30, N_rpm: 2900, D2_m: 0.25, shapeFamily: 'Francis / mixed flow', pctBep: 80, H_stage_m: 60 });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.ranked.length, 5);
  for (let i = 1; i < r.ranked.length; i++) {
    const prevRank = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 }[r.ranked[i - 1].verdict];
    const curRank = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 }[r.ranked[i].verdict];
    assert.ok(prevRank <= curRank, 'verdicts should be sorted best-first');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
