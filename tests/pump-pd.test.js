/* ══════════════════════════════════════════════════════════════════════
   PHASE 14 REGRESSION — lib/aro-pumppd.js (AROPUMPPD)

   Run:  node tests/pump-pd.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumppd.js'));
const PD = global.AROPUMPPD;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('\nAROPUMPPD — window.AROPUMPPD\n');

test('screenOverpressureProtection: missing rated flow reports DATA REQUIRED', () => {
  assert.strictEqual(PD.screenOverpressureProtection({}).status, 'DATA REQUIRED');
});

test('screenOverpressureProtection: no relief device specified is NOT RECOMMENDED (fails closed), never a neutral DATA REQUIRED', () => {
  const r = PD.screenOverpressureProtection({ ratedFlow_m3h: 20 });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.status, 'NOT RECOMMENDED');
  assert.strictEqual(r.mandatory, true);
  assert.ok(/MANDATORY/.test(r.message));
});

test('screenOverpressureProtection: a correctly sized relief device is SUITABLE', () => {
  const r = PD.screenOverpressureProtection({ ratedFlow_m3h: 20, pipingDesignPress_barG: 25, reliefSetPress_barG: 20, reliefRatedCapacity_m3h: 25 });
  assert.strictEqual(r.verdict, 'SUITABLE');
  assert.strictEqual(r.warnings.length, 0);
});

test('screenOverpressureProtection: a relief set pressure above the piping design pressure is NOT RECOMMENDED', () => {
  const r = PD.screenOverpressureProtection({ ratedFlow_m3h: 20, pipingDesignPress_barG: 20, reliefSetPress_barG: 25, reliefRatedCapacity_m3h: 25 });
  assert.strictEqual(r.verdict, 'NOT RECOMMENDED');
  assert.ok(r.warnings.some((w) => /exceeds the piping design pressure/.test(w)));
});

test('screenOverpressureProtection: a relief capacity below rated flow is NOT RECOMMENDED', () => {
  const r = PD.screenOverpressureProtection({ ratedFlow_m3h: 20, pipingDesignPress_barG: 25, reliefSetPress_barG: 20, reliefRatedCapacity_m3h: 10 });
  assert.strictEqual(r.verdict, 'NOT RECOMMENDED');
  assert.ok(r.warnings.some((w) => /cannot pass the full pump output/.test(w)));
});

test('screenPulsationDampening: not applicable for a rotary PD family', () => {
  const r = PD.screenPulsationDampening({ pumpType: 'rotary' });
  assert.strictEqual(r.applicable, false);
  assert.strictEqual(r.status, 'NOT APPLICABLE');
});

test('screenPulsationDampening: always mandatory for reciprocating regardless of cylinder count being known', () => {
  const known = PD.screenPulsationDampening({ pumpType: 'reciprocating', numCylinders: 1 });
  const unknown = PD.screenPulsationDampening({ pumpType: 'reciprocating' });
  assert.strictEqual(known.mandatory, true);
  assert.strictEqual(unknown.mandatory, true);
  assert.ok(/BOTH suction and discharge/.test(known.message));
  assert.ok(/BOTH suction and discharge/.test(unknown.message));
  assert.strictEqual(unknown.cylinderKnown, false);
});

test('screenPulsationDampening: severity eases as cylinder count rises, at the documented band edges', () => {
  assert.strictEqual(PD.screenPulsationDampening({ pumpType: 'reciprocating', numCylinders: 1 }).severity, 'severe');
  assert.strictEqual(PD.screenPulsationDampening({ pumpType: 'reciprocating', numCylinders: 2 }).severity, 'significant');
  assert.strictEqual(PD.screenPulsationDampening({ pumpType: 'reciprocating', numCylinders: 3 }).severity, 'moderate');
  assert.strictEqual(PD.screenPulsationDampening({ pumpType: 'reciprocating', numCylinders: 6 }).severity, 'reduced');
});

test('estimateVolumetricEfficiency: missing/invalid viscosity reports DATA REQUIRED', () => {
  assert.strictEqual(PD.estimateVolumetricEfficiency(NaN).status, 'DATA REQUIRED');
  assert.strictEqual(PD.estimateVolumetricEfficiency(0).status, 'DATA REQUIRED');
});

test('estimateVolumetricEfficiency: efficiency band rises with viscosity — the opposite trend from a centrifugal impeller', () => {
  const thin = PD.estimateVolumetricEfficiency(5);
  const mid = PD.estimateVolumetricEfficiency(500);
  const thick = PD.estimateVolumetricEfficiency(5000);
  assert.ok(thin.etaVolMinPct < mid.etaVolMinPct);
  assert.ok(mid.etaVolMinPct < thick.etaVolMinPct);
  assert.ok(thin.etaVolMaxPct < thick.etaVolMaxPct);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
