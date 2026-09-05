/* ══════════════════════════════════════════════════════════════════════
   PHASE 24 REGRESSION — lib/aro-pumplcc.js (AROPUMPLCC)

   Run:  node tests/pump-lcc.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumplcc.js'));
const LCC = global.AROPUMPLCC;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('\nAROPUMPLCC — window.AROPUMPLCC\n');

test('buildLifeCycleCost: missing electrical power reports DATA REQUIRED', () => {
  assert.strictEqual(LCC.buildLifeCycleCost({}).status, 'DATA REQUIRED');
  assert.strictEqual(LCC.buildLifeCycleCost({ mhp_kW: 0 }).status, 'DATA REQUIRED');
});

test('buildLifeCycleCost: missing any economic input (rate/hours/years) reports DATA REQUIRED, never a partial estimate', () => {
  assert.strictEqual(LCC.buildLifeCycleCost({ mhp_kW: 30 }).status, 'DATA REQUIRED');
  assert.strictEqual(LCC.buildLifeCycleCost({ mhp_kW: 30, electricityRate: 0.12 }).status, 'DATA REQUIRED');
  assert.strictEqual(LCC.buildLifeCycleCost({ mhp_kW: 30, electricityRate: 0.12, annualOperatingHours: 8000 }).status, 'DATA REQUIRED');
});

test('buildLifeCycleCost: rejects annual operating hours above 8,760 (the hours in a year)', () => {
  const r = LCC.buildLifeCycleCost({ mhp_kW: 30, electricityRate: 0.12, annualOperatingHours: 9000, horizonYears: 10 });
  assert.strictEqual(r.status, 'DATA REQUIRED');
});

test('buildLifeCycleCost: annual energy and cost are exact — kW * hours, then * rate — no hidden factor', () => {
  const r = LCC.buildLifeCycleCost({ mhp_kW: 30, electricityRate: 0.12, annualOperatingHours: 8000, horizonYears: 15 });
  assert.strictEqual(r.applicable, true);
  close(r.annualEnergy_kWh, 30 * 8000, 1e-9);
  close(r.annualEnergyCost, 30 * 8000 * 0.12, 1e-9);
});

test('buildLifeCycleCost: with a 0% discount rate (the default), the NPV total equals the plain undiscounted sum exactly', () => {
  const r = LCC.buildLifeCycleCost({ mhp_kW: 30, electricityRate: 0.12, annualOperatingHours: 8000, horizonYears: 15 });
  close(r.npvEnergyCost, r.undiscountedTotalEnergyCost, 1e-6);
  close(r.undiscountedTotalEnergyCost, r.annualEnergyCost * 15, 1e-9);
});

test('buildLifeCycleCost: a positive discount rate always reduces the NPV total below the undiscounted sum', () => {
  const r = LCC.buildLifeCycleCost({ mhp_kW: 30, electricityRate: 0.12, annualOperatingHours: 8000, horizonYears: 15, discountRatePct: 8 });
  assert.ok(r.npvEnergyCost < r.undiscountedTotalEnergyCost);
  assert.ok(r.npvEnergyCost > 0);
});

test('buildLifeCycleCost: never invents capital/installation/maintenance/downtime/decommissioning costs — always lists them as not modeled', () => {
  const r = LCC.buildLifeCycleCost({ mhp_kW: 30, electricityRate: 0.12, annualOperatingHours: 8000, horizonYears: 15 });
  assert.strictEqual(r.notModeledBuckets.length, 5);
  ['capital', 'installation', 'maintenance', 'downtime', 'decommissioning'].forEach(id => {
    assert.ok(r.notModeledBuckets.some(b => b.id === id), id + ' missing');
  });
});

test('buildLifeCycleCost: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const input = { mhp_kW: 22, electricityRate: 0.1, annualOperatingHours: 7000, horizonYears: 10, discountRatePct: 5 };
  assert.deepStrictEqual(LCC.buildLifeCycleCost(input), LCC.buildLifeCycleCost(input));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
