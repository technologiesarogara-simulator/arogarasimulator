/* ══════════════════════════════════════════════════════════════════════
   PHASE 25 REGRESSION — lib/aro-pumpcompare.js (AROPUMPCOMPARE)

   Run:  node tests/pump-compare.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpcompare.js'));
const CMP = global.AROPUMPCOMPARE;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}
function byId(rows, id) { return rows.filter(r => r.id === id)[0]; }

console.log('\nAROPUMPCOMPARE — window.AROPUMPCOMPARE\n');

test('buildComparison: with no snapshots, reports DATA REQUIRED rather than crashing', () => {
  assert.strictEqual(CMP.buildComparison(null, null).status, 'DATA REQUIRED');
  assert.strictEqual(CMP.buildComparison({}, null).status, 'DATA REQUIRED');
});

test('buildComparison: covers exactly the 7 documented metrics', () => {
  const r = CMP.buildComparison({}, {});
  assert.strictEqual(r.rows.length, 7);
});

test('buildComparison: a metric missing from either snapshot reports DATA REQUIRED for that row only', () => {
  const r = CMP.buildComparison({ bhp_kW: 22 }, {});
  assert.strictEqual(byId(r.rows, 'bhp_kW').status, 'DATA REQUIRED');
});

test('buildComparison: delta and percent change are exact subtraction/division, no hidden rounding rule', () => {
  const r = CMP.buildComparison({ bhp_kW: 20 }, { bhp_kW: 25 });
  const row = byId(r.rows, 'bhp_kW');
  close(row.delta, 5, 1e-9);
  close(row.pctChange, 25, 1e-9);
});

test('buildComparison: efficiency verdict favors the higher value as B BETTER / A BETTER correctly', () => {
  const bBetter = CMP.buildComparison({ pumpEffPct: 70 }, { pumpEffPct: 78 });
  assert.strictEqual(byId(bBetter.rows, 'pumpEffPct').verdict, 'B BETTER');

  const aBetter = CMP.buildComparison({ pumpEffPct: 78 }, { pumpEffPct: 70 });
  assert.strictEqual(byId(aBetter.rows, 'pumpEffPct').verdict, 'A BETTER');

  const tie = CMP.buildComparison({ pumpEffPct: 75 }, { pumpEffPct: 75 });
  assert.strictEqual(byId(tie.rows, 'pumpEffPct').verdict, 'TIE');
});

test('buildComparison: brake power and annual energy cost verdicts favor the LOWER value, inverted from efficiency', () => {
  const r = CMP.buildComparison({ bhp_kW: 30, annualEnergyCost: 20000 }, { bhp_kW: 22, annualEnergyCost: 25000 });
  assert.strictEqual(byId(r.rows, 'bhp_kW').verdict, 'B BETTER'); // lower bhp wins
  assert.strictEqual(byId(r.rows, 'annualEnergyCost').verdict, 'A BETTER'); // lower cost wins, and A is lower here
});

test('buildComparison: a metric with no defined "better" direction (flow, head, motor loading) is always NEUTRAL, never judged', () => {
  const r = CMP.buildComparison({ Q_m3h: 80, H_m: 78, motorLoadingPct: 60 }, { Q_m3h: 120, H_m: 50, motorLoadingPct: 95 });
  assert.strictEqual(byId(r.rows, 'Q_m3h').verdict, 'NEUTRAL');
  assert.strictEqual(byId(r.rows, 'H_m').verdict, 'NEUTRAL');
  assert.strictEqual(byId(r.rows, 'motorLoadingPct').verdict, 'NEUTRAL');
});

test('buildComparison: carries the given snapshot labels through, defaulting sensibly when absent', () => {
  const withLabels = CMP.buildComparison({ label: 'Baseline' }, { label: 'Trimmed impeller' });
  assert.strictEqual(withLabels.labelA, 'Baseline');
  assert.strictEqual(withLabels.labelB, 'Trimmed impeller');

  const withoutLabels = CMP.buildComparison({}, {});
  assert.strictEqual(withoutLabels.labelA, 'Snapshot A');
  assert.strictEqual(withoutLabels.labelB, 'Snapshot B');
});

test('buildComparison: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const a = { label: 'A', bhp_kW: 22, pumpEffPct: 74, npshMargin_m: 3.2 };
  const b = { label: 'B', bhp_kW: 24, pumpEffPct: 71, npshMargin_m: 2.8 };
  assert.deepStrictEqual(CMP.buildComparison(a, b), CMP.buildComparison(a, b));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
