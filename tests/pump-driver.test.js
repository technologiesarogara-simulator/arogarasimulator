/* ══════════════════════════════════════════════════════════════════════
   PHASE 10 REGRESSION — lib/aro-pumpdriver.js (AROPUMPDRIVER)

   Run:  node tests/pump-driver.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpdriver.js'));
const DRV = global.AROPUMPDRIVER;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}
const VALID_VERDICTS = ['SUITABLE', 'CHECK', 'NOT RECOMMENDED'];

console.log('\nAROPUMPDRIVER — window.AROPUMPDRIVER\n');

test('screenMotorEnclosure: missing hazard classification reports DATA REQUIRED', () => {
  assert.strictEqual(DRV.screenMotorEnclosure({}).status, 'DATA REQUIRED');
});

test('screenMotorEnclosure: a benign fluid favours TEFC and downgrades both Ex ratings to CHECK', () => {
  const r = DRV.screenMotorEnclosure({ hazardClass: 'benign' });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.hazardous, false);
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.strictEqual(byId['tefc'].verdict, 'SUITABLE');
  assert.strictEqual(byId['ex-e'].verdict, 'CHECK');
  assert.strictEqual(byId['ex-d'].verdict, 'CHECK');
  assert.strictEqual(r.top.id, 'tefc');
  for (const e of r.ranked) assert.ok(VALID_VERDICTS.includes(e.verdict));
});

test('screenMotorEnclosure: a flammable or toxic fluid rules out TEFC and allows both Ex ratings', () => {
  for (const hazardClass of ['flammable', 'toxic', 'toxic-corrosive']) {
    const r = DRV.screenMotorEnclosure({ hazardClass: hazardClass });
    const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
    assert.strictEqual(byId['tefc'].verdict, 'NOT RECOMMENDED', hazardClass);
    assert.strictEqual(byId['ex-e'].verdict, 'SUITABLE', hazardClass);
    assert.strictEqual(byId['ex-d'].verdict, 'SUITABLE', hazardClass);
  }
});

test('recommendCoupling: a close-coupled API class reports NOT APPLICABLE, never a coupling recommendation', () => {
  const r = DRV.recommendCoupling({ torque_Nm: 50, apiClassCouplingType: 'none (close-coupled)' });
  assert.strictEqual(r.applicable, false);
  assert.strictEqual(r.status, 'NOT APPLICABLE');
});

test('recommendCoupling: missing torque reports DATA REQUIRED', () => {
  assert.strictEqual(DRV.recommendCoupling({}).status, 'DATA REQUIRED');
});

test('recommendCoupling: required torque ratings are exactly 1.5x (continuous) and 2.5x (peak) the running torque', () => {
  const r = DRV.recommendCoupling({ torque_Nm: 40 });
  assert.strictEqual(r.applicable, true);
  close(r.requiredContinuousTorque_Nm, 60, 1e-9);
  close(r.requiredPeakTorque_Nm, 100, 1e-9);
});

test('recommendCoupling: elastomeric is downgraded to CHECK in an API 610 process context but stays SUITABLE otherwise', () => {
  const process = DRV.recommendCoupling({ torque_Nm: 40, apiClassCouplingType: 'flexible' });
  const generic = DRV.recommendCoupling({ torque_Nm: 40 });
  assert.strictEqual(process.ranked.find((e) => e.id === 'elastomeric').verdict, 'CHECK');
  assert.strictEqual(generic.ranked.find((e) => e.id === 'elastomeric').verdict, 'SUITABLE');
  assert.strictEqual(process.ranked.find((e) => e.id === 'disc-diaphragm').verdict, 'SUITABLE');
  for (const e of process.ranked) assert.ok(VALID_VERDICTS.includes(e.verdict));
});

test('screenStartingMethod: missing motor size reports DATA REQUIRED', () => {
  assert.strictEqual(DRV.screenStartingMethod({}).status, 'DATA REQUIRED');
});

test('screenStartingMethod: bands step correctly across the 37kW and 160kW boundaries', () => {
  assert.strictEqual(DRV.screenStartingMethod({ motorKw: 37 }).band, 'small');
  assert.strictEqual(DRV.screenStartingMethod({ motorKw: 37.01 }).band, 'medium');
  assert.strictEqual(DRV.screenStartingMethod({ motorKw: 160 }).band, 'medium');
  assert.strictEqual(DRV.screenStartingMethod({ motorKw: 160.01 }).band, 'large');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
