/* ══════════════════════════════════════════════════════════════════════
   PHASE 19 REGRESSION — lib/aro-pumppid.js (AROPUMPPID)

   Run:  node tests/pump-pid.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumppid.js'));
const PID = global.AROPUMPPID;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function byId(items, id) { return items.filter(i => i.id === id)[0]; }

console.log('\nAROPUMPPID — window.AROPUMPPID\n');

test('buildPidRequirements: with no input at all, returns all 7 documented items, mostly DATA REQUIRED', () => {
  const r = PID.buildPidRequirements({});
  assert.strictEqual(r.items.length, 7);
  ['seal-support', 'seal-quench', 'min-flow-line', 'hazard-instrumentation'].forEach(id => {
    assert.strictEqual(byId(r.items, id).status, 'DATA REQUIRED', id);
  });
  // pulsation/relief default to NOT APPLICABLE because topFamilyCategory is undefined (not PD)
  assert.strictEqual(byId(r.items, 'pulsation-dampener').status, 'NOT APPLICABLE');
  assert.strictEqual(byId(r.items, 'relief-valve').status, 'NOT APPLICABLE');
  assert.strictEqual(byId(r.items, 'suction-discharge-gauges').status, 'RECOMMENDED');
});

test('buildPidRequirements: seal support piping is looked up by the ACTUAL selected plan id, not invented', () => {
  const r52 = PID.buildPidRequirements({ sealPlanResult: { applicable: true, top: { id: '52', name: 'Plan 52 — Dual Seal, Unpressurized Buffer' } } });
  assert.strictEqual(byId(r52.items, 'seal-support').status, 'REQUIRED');
  assert.strictEqual(byId(r52.items, 'seal-support').detail, PID.SEAL_SUPPORT_PIPING['52']);

  const r11 = PID.buildPidRequirements({ sealPlanResult: { applicable: true, top: { id: '11', name: 'Plan 11 — Discharge Recirculation' } } });
  assert.strictEqual(byId(r11.items, 'seal-support').detail, PID.SEAL_SUPPORT_PIPING['11']);
  assert.notStrictEqual(byId(r52.items, 'seal-support').detail, byId(r11.items, 'seal-support').detail);
});

test('buildPidRequirements: quench item reflects the seal engine\'s own quenchRecommended flag verbatim', () => {
  const yes = PID.buildPidRequirements({ sealPlanResult: { applicable: true, top: { id: '11', name: 'x' }, quenchRecommended: true, quenchReason: 'because caustic' } });
  assert.strictEqual(byId(yes.items, 'seal-quench').status, 'RECOMMENDED');
  assert.strictEqual(byId(yes.items, 'seal-quench').detail, 'because caustic');

  const no = PID.buildPidRequirements({ sealPlanResult: { applicable: true, top: { id: '11', name: 'x' }, quenchRecommended: false } });
  assert.strictEqual(byId(no.items, 'seal-quench').status, 'NOT APPLICABLE');
});

test('buildPidRequirements: pulsation dampening is REQUIRED only for a reciprocating PD family with an applicable Phase-14 result, NOT APPLICABLE otherwise', () => {
  const recip = PID.buildPidRequirements({ topFamilyCategory: 'pd-reciprocating', pulsationResult: { applicable: true, message: 'must dampen' } });
  assert.strictEqual(byId(recip.items, 'pulsation-dampener').status, 'REQUIRED');

  const rotary = PID.buildPidRequirements({ topFamilyCategory: 'pd-rotary', pulsationResult: { applicable: false, status: 'NOT APPLICABLE', reason: 'rotary machine' } });
  assert.strictEqual(byId(rotary.items, 'pulsation-dampener').status, 'NOT APPLICABLE');

  const centrifugal = PID.buildPidRequirements({ topFamilyCategory: 'radial-centrifugal' });
  assert.strictEqual(byId(centrifugal.items, 'pulsation-dampener').status, 'NOT APPLICABLE');
});

test('buildPidRequirements: relief valve verdict is read straight from Phase 14\'s overpressure screening, including a NOT RECOMMENDED (missing relief) case', () => {
  const missing = PID.buildPidRequirements({ topFamilyCategory: 'pd-reciprocating', overpressureResult: { applicable: true, verdict: 'NOT RECOMMENDED', message: 'no relief fitted' } });
  assert.strictEqual(byId(missing.items, 'relief-valve').status, 'NOT RECOMMENDED');
  assert.strictEqual(byId(missing.items, 'relief-valve').detail, 'no relief fitted');

  const ok = PID.buildPidRequirements({ topFamilyCategory: 'pd-reciprocating', overpressureResult: { applicable: true, verdict: 'SUITABLE', message: 'sized correctly' } });
  assert.strictEqual(byId(ok.items, 'relief-valve').status, 'SUITABLE');

  const centrifugal = PID.buildPidRequirements({ topFamilyCategory: 'radial-centrifugal' });
  assert.strictEqual(byId(centrifugal.items, 'relief-valve').status, 'NOT APPLICABLE');
});

test('buildPidRequirements: minimum-flow line carries the actual MCSF figures through untouched, never a recomputed value', () => {
  const r = PID.buildPidRequirements({ mcsfFlow: 42.7, mcsfFrac: 0.35 });
  const item = byId(r.items, 'min-flow-line');
  assert.strictEqual(item.status, 'RECOMMENDED');
  assert.ok(item.detail.indexOf('42.7 m³/h') !== -1);
  assert.ok(item.detail.indexOf('35%') !== -1);
});

test('buildPidRequirements: hazard-driven instrumentation follows the given hazard class exactly, benign = NOT APPLICABLE', () => {
  assert.strictEqual(byId(PID.buildPidRequirements({ hazardClass: 'benign' }).items, 'hazard-instrumentation').status, 'NOT APPLICABLE');
  assert.strictEqual(byId(PID.buildPidRequirements({ hazardClass: 'flammable' }).items, 'hazard-instrumentation').status, 'RECOMMENDED');
  assert.strictEqual(byId(PID.buildPidRequirements({ hazardClass: 'toxic-corrosive' }).items, 'hazard-instrumentation').status, 'RECOMMENDED');
});

test('buildPidRequirements: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const input = { topFamilyCategory: 'pd-reciprocating', mcsfFlow: 10, mcsfFrac: 0.3, hazardClass: 'toxic' };
  assert.deepStrictEqual(PID.buildPidRequirements(input), PID.buildPidRequirements(input));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
