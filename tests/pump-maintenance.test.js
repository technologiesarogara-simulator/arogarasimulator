/* ══════════════════════════════════════════════════════════════════════
   PHASE 21 REGRESSION — lib/aro-pumpmaintenance.js (AROPUMPMAINTENANCE)

   Run:  node tests/pump-maintenance.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpmaintenance.js'));
const MAINT = global.AROPUMPMAINTENANCE;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}
function byId(items, id) { return items.filter(i => i.id === id)[0]; }

console.log('\nAROPUMPMAINTENANCE — window.AROPUMPMAINTENANCE\n');

test('buildMaintenanceEnvelopes: with no input, both items are DATA REQUIRED', () => {
  const r = MAINT.buildMaintenanceEnvelopes({});
  assert.strictEqual(r.items.length, 2);
  r.items.forEach(it => assert.strictEqual(it.status, 'DATA REQUIRED', it.label));
});

test('buildMaintenanceEnvelopes: rotor withdrawal is NOT APPLICABLE for a between-bearings configuration, not DATA REQUIRED', () => {
  const r = MAINT.buildMaintenanceEnvelopes({
    configResult: { applicable: true, top: { id: 'BB1', couplingType: 'flexible', bearingFrame: 'between-bearings, both ends supported' } },
  });
  const it = byId(r.items, 'rotor-withdrawal');
  assert.strictEqual(it.status, 'NOT APPLICABLE');
  assert.ok(it.detail.indexOf('BB1') !== -1);
});

test('buildMaintenanceEnvelopes: rotor withdrawal is NOT APPLICABLE for a close-coupled (no separate bearing housing) configuration', () => {
  const r = MAINT.buildMaintenanceEnvelopes({
    configResult: { applicable: true, top: { id: 'OH3', couplingType: 'none (close-coupled)', bearingFrame: 'none — impeller on motor shaft extension' } },
  });
  assert.strictEqual(byId(r.items, 'rotor-withdrawal').status, 'NOT APPLICABLE');
});

test('buildMaintenanceEnvelopes: rotor withdrawal clearance = (overhang + impeller OD) exactly, for a genuinely BPO-capable configuration', () => {
  const r = MAINT.buildMaintenanceEnvelopes({
    configResult: { applicable: true, top: { id: 'OH2', couplingType: 'flexible', bearingFrame: 'separate bearing housing' } },
    shaftResult: { applicable: true, top: { overhang_m: 0.18 } },
    eulerResult: { applicable: true, D2_m: 0.25 },
  });
  const it = byId(r.items, 'rotor-withdrawal');
  assert.strictEqual(it.status, 'PRELIMINARY ASSUMPTION');
  close(it.clearance_mm, (0.18 + 0.25) * 1000, 1e-6);
  assert.ok(it.detail.indexOf('coupling spacer') !== -1, 'must flag the un-modelled coupling spacer length rather than silently omit it');
});

test('buildMaintenanceEnvelopes: BPO-capable configuration but missing shaft/impeller data reports DATA REQUIRED, not a partial/invented number', () => {
  const r = MAINT.buildMaintenanceEnvelopes({
    configResult: { applicable: true, top: { id: 'OH2', couplingType: 'flexible', bearingFrame: 'separate bearing housing' } },
  });
  assert.strictEqual(byId(r.items, 'rotor-withdrawal').status, 'DATA REQUIRED');
});

test('buildMaintenanceEnvelopes: casing cover clearance = casingID_mm * COVER_LIFT_MULTIPLIER exactly', () => {
  const r = MAINT.buildMaintenanceEnvelopes({
    casingResult: { applicable: true, cutwater: { casingID_mm: 300 } },
  });
  const it = byId(r.items, 'casing-cover-clearance');
  assert.strictEqual(it.status, 'PRELIMINARY ASSUMPTION');
  close(it.clearance_mm, 300 * MAINT.COVER_LIFT_MULTIPLIER, 1e-9);
});

test('buildMaintenanceEnvelopes: an inapplicable casing result reports DATA REQUIRED with the real upstream reason', () => {
  const r = MAINT.buildMaintenanceEnvelopes({ casingResult: { applicable: false, reason: 'no casing screened' } });
  assert.strictEqual(byId(r.items, 'casing-cover-clearance').status, 'DATA REQUIRED');
  assert.strictEqual(byId(r.items, 'casing-cover-clearance').detail, 'no casing screened');
});

test('buildMaintenanceEnvelopes: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const input = {
    configResult: { applicable: true, top: { id: 'OH2', couplingType: 'flexible with spacer', bearingFrame: 'separate bearing housing' } },
    shaftResult: { applicable: true, top: { overhang_m: 0.2 } },
    eulerResult: { applicable: true, D2_m: 0.3 },
    casingResult: { applicable: true, cutwater: { casingID_mm: 320 } },
  };
  assert.deepStrictEqual(MAINT.buildMaintenanceEnvelopes(input), MAINT.buildMaintenanceEnvelopes(input));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
