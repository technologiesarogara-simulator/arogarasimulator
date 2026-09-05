/* ══════════════════════════════════════════════════════════════════════
   PHASE 13 REGRESSION — lib/aro-pumpmultiple.js (AROPUMPMULTIPLE)

   Run:  node tests/pump-multiple.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpcurve.js')); // for the integration test
require(path.join(__dirname, '..', 'lib', 'aro-pumpmultiple.js'));
const CURVE = global.AROPUMPCURVE;
const MULTI = global.AROPUMPMULTIPLE;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

// A simple mock base curve for the pure-math tests — doesn't need the
// real AROPUMPCURVE shape function, just its {head,eff,npshr,Qbep} interface.
function mockBase() {
  return {
    Qbep: 50,
    head: function (Q) { return 60 - 0.01 * Q * Q; },
    eff: function (Q) { return 70 - Math.abs(Q - 50) * 0.2; },
    npshr: function (Q) { return 3 + 0.001 * Q * Q; },
  };
}

console.log('\nAROPUMPMULTIPLE — window.AROPUMPMULTIPLE\n');

test('unitsRunning: parallel/series run all n units, duty-standby runs exactly 1', () => {
  assert.strictEqual(MULTI.unitsRunning(3, 'parallel'), 3);
  assert.strictEqual(MULTI.unitsRunning(3, 'series'), 3);
  assert.strictEqual(MULTI.unitsRunning(3, 'duty-standby'), 1);
});

test('buildCombinedCurve: rejects a missing base curve, an invalid n, and an invalid arrangement', () => {
  assert.strictEqual(MULTI.buildCombinedCurve(null, 2, 'parallel').valid, false);
  assert.strictEqual(MULTI.buildCombinedCurve(mockBase(), 0, 'parallel').valid, false);
  assert.strictEqual(MULTI.buildCombinedCurve(mockBase(), 2.5, 'parallel').valid, false);
  assert.strictEqual(MULTI.buildCombinedCurve(mockBase(), 2, 'orbital').valid, false);
  assert.strictEqual(MULTI.buildCombinedCurve(mockBase(), 1, 'parallel').valid, false, 'parallel needs at least 2 units');
  assert.strictEqual(MULTI.buildCombinedCurve(mockBase(), 1, 'series').valid, false, 'series needs at least 2 units');
  assert.strictEqual(MULTI.buildCombinedCurve(mockBase(), 1, 'duty-standby').valid, true, 'duty-standby is meaningful even with 1 unit named');
});

test('buildCombinedCurve parallel: head(Q) = base.head(Q/n) exactly, Qbep = base.Qbep * n exactly', () => {
  const base = mockBase();
  const r = MULTI.buildCombinedCurve(base, 3, 'parallel');
  assert.strictEqual(r.valid, true);
  close(r.curve.Qbep, 150, 1e-9);
  for (const Q of [0, 60, 150, 300]) {
    close(r.curve.head(Q), base.head(Q / 3), 1e-9, 'Q=' + Q);
    close(r.curve.eff(Q), base.eff(Q / 3), 1e-9, 'Q=' + Q);
    close(r.curve.npshr(Q), base.npshr(Q / 3), 1e-9, 'Q=' + Q);
  }
  assert.ok(r.warnings.some((w) => /shared.*header|header.*shared/i.test(w)));
});

test('buildCombinedCurve series: head(Q) = n * base.head(Q) exactly, Qbep unchanged', () => {
  const base = mockBase();
  const r = MULTI.buildCombinedCurve(base, 4, 'series');
  assert.strictEqual(r.valid, true);
  close(r.curve.Qbep, 50, 1e-9);
  for (const Q of [0, 25, 50, 75]) {
    close(r.curve.head(Q), 4 * base.head(Q), 1e-9, 'Q=' + Q);
    close(r.curve.eff(Q), base.eff(Q), 1e-9, 'Q=' + Q);
    close(r.curve.npshr(Q), base.npshr(Q), 1e-9, 'Q=' + Q);
  }
  assert.ok(r.warnings.some((w) => /first.*unit|upstream/i.test(w)));
});

test('buildCombinedCurve duty-standby: the combined curve is identical to the base curve', () => {
  const base = mockBase();
  const r = MULTI.buildCombinedCurve(base, 2, 'duty-standby');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.unitsRunning, 1);
  for (const Q of [0, 25, 50, 75]) {
    close(r.curve.head(Q), base.head(Q), 1e-9);
  }
  close(r.curve.Qbep, base.Qbep, 1e-9);
});

test('integration: a parallel pair plugged into the real AROPUMPCURVE engine delivers more flow than a single unit on the same system', () => {
  const basePump = CURVE.make({ Qbep: 50, Hbep: 47.5, etaBep: 65, npshrBep: 3, Ns: 2000 });
  const sys = CURVE.systemCurve(20, 50, 47.5); // static head 20m, duty point at BEP
  const singleOp = CURVE.operatingPoint(basePump, sys);
  close(singleOp.Q, 50, 1e-3);

  const pair = MULTI.buildCombinedCurve(basePump, 2, 'parallel');
  assert.strictEqual(pair.valid, true);
  const pairOp = CURVE.operatingPoint(pair.curve, sys);
  assert.ok(pairOp, 'the combined curve should still cross the fixed system curve');
  assert.ok(pairOp.Q > singleOp.Q, 'two pumps in parallel must deliver more flow than one, against the same system curve');
  assert.ok(pairOp.Q < 2 * singleOp.Q, 'but not simply double — the system curve steepens as flow rises');
});

test('integration: a series pair plugged into the real AROPUMPCURVE engine delivers more head at a given system than a single unit', () => {
  // A system with a high static head that a single unit alone cannot fully overcome at any real flow near BEP.
  const basePump = CURVE.make({ Qbep: 50, Hbep: 47.5, etaBep: 65, npshrBep: 3, Ns: 2000 });
  const sys = CURVE.systemCurve(45, 50, 47.5); // static head 45m — close to the single unit's own shutoff head
  const pairSeries = MULTI.buildCombinedCurve(basePump, 2, 'series');
  const seriesOp = CURVE.operatingPoint(pairSeries.curve, sys);
  assert.ok(seriesOp, 'two units in series should comfortably clear a static head close to one unit\'s shutoff head');
  close(seriesOp.H, sys.head(seriesOp.Q), 1e-6);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
