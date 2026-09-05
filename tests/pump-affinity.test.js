/* ══════════════════════════════════════════════════════════════════════
   PHASE 11 REGRESSION — lib/aro-pumpaffinity.js (AROPUMPAFFINITY)

   Run:  node tests/pump-affinity.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpcurve.js')); // for the integration test
require(path.join(__dirname, '..', 'lib', 'aro-pumpaffinity.js'));
const CURVE = global.AROPUMPCURVE;
const AFF = global.AROPUMPAFFINITY;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('\nAROPUMPAFFINITY — window.AROPUMPAFFINITY\n');

test('quickScale: Q scales linearly, H quadratically, power cubically with the ratio, exactly', () => {
  const r = AFF.quickScale(100, 50, 20, 0.8);
  close(r.Q, 80, 1e-9);
  close(r.H, 50 * 0.64, 1e-9);
  close(r.powerKw, 20 * 0.512, 1e-9);
});

test('quickScale: missing base values propagate as NaN rather than a fabricated number', () => {
  const r = AFF.quickScale(null, 50, undefined, 0.8);
  assert.ok(Number.isNaN(r.Q));
  assert.ok(Number.isNaN(r.powerKw));
});

test('trimEfficiencyPenalty: zero above the 95% threshold, exact linear formula below it, capped at 10 points', () => {
  close(AFF.trimEfficiencyPenalty(0.95), 0, 1e-9);
  close(AFF.trimEfficiencyPenalty(1.0), 0, 1e-9);
  close(AFF.trimEfficiencyPenalty(0.90), 5 * 0.3, 1e-9);
  close(AFF.trimEfficiencyPenalty(0.80), 15 * 0.3, 1e-9);
  close(AFF.trimEfficiencyPenalty(0.0), 10, 1e-9, 'must be capped at 10 points even for an absurd trim');
});

test('scaleBEP: missing curve parameters or an invalid ratio/mode report DATA REQUIRED', () => {
  assert.strictEqual(AFF.scaleBEP({}).status, 'DATA REQUIRED');
  assert.strictEqual(AFF.scaleBEP({ Qbep: 50, Hbep: 40, etaBep: 70, npshrBep: 4, Ns: 2000, ratio: -1, mode: 'speed' }).status, 'DATA REQUIRED');
  assert.strictEqual(AFF.scaleBEP({ Qbep: 50, Hbep: 40, etaBep: 70, npshrBep: 4, Ns: 2000, ratio: 0.8, mode: 'orbital' }).status, 'DATA REQUIRED');
});

test('scaleBEP: Qbep/Hbep/npshrBep scale exactly by ratio/ratio^2/ratio^2 for both modes', () => {
  const base = { Qbep: 50, Hbep: 40, etaBep: 70, npshrBep: 4, Ns: 2000 };
  for (const mode of ['speed', 'trim']) {
    const r = AFF.scaleBEP(Object.assign({}, base, { ratio: 0.8, mode: mode }));
    close(r.scaled.Qbep, 50 * 0.8, 1e-9, mode);
    close(r.scaled.Hbep, 40 * 0.64, 1e-9, mode);
    close(r.scaled.npshrBep, 4 * 0.64, 1e-9, mode);
  }
});

test('scaleBEP: specific speed Ns is invariant under the scaling in both modes — the identity the module design rests on', () => {
  const base = { Qbep: 50, Hbep: 40, etaBep: 70, npshrBep: 4, Ns: 2137.4 };
  for (const mode of ['speed', 'trim']) {
    for (const ratio of [0.6, 0.8, 1.0, 1.2]) {
      const r = AFF.scaleBEP(Object.assign({}, base, { ratio: ratio, mode: mode }));
      close(r.scaled.Ns, 2137.4, 1e-9, mode + ' @ ' + ratio);
    }
  }
});

test('scaleBEP: efficiency is unchanged for a speed change but reduced for a deep trim', () => {
  const base = { Qbep: 50, Hbep: 40, etaBep: 70, npshrBep: 4, Ns: 2000 };
  const speed = AFF.scaleBEP(Object.assign({}, base, { ratio: 0.7, mode: 'speed' }));
  close(speed.scaled.etaBep, 70, 1e-9);
  const trim = AFF.scaleBEP(Object.assign({}, base, { ratio: 0.7, mode: 'trim' }));
  assert.ok(trim.scaled.etaBep < 70);
  close(trim.scaled.etaBep, 70 - AFF.trimEfficiencyPenalty(0.7), 1e-9);
});

test('scaleBEP: warns on a deep trim, a very low VFD speed, and an overspeed condition — but not on an ordinary VFD range', () => {
  const base = { Qbep: 50, Hbep: 40, etaBep: 70, npshrBep: 4, Ns: 2000 };
  assert.ok(AFF.scaleBEP(Object.assign({}, base, { ratio: 0.80, mode: 'trim' })).warnings.length > 0);
  assert.ok(AFF.scaleBEP(Object.assign({}, base, { ratio: 0.40, mode: 'speed' })).warnings.length > 0);
  assert.ok(AFF.scaleBEP(Object.assign({}, base, { ratio: 1.10, mode: 'speed' })).warnings.length > 0);
  assert.strictEqual(AFF.scaleBEP(Object.assign({}, base, { ratio: 0.80, mode: 'speed' })).warnings.length, 0);
  assert.strictEqual(AFF.scaleBEP(Object.assign({}, base, { ratio: 0.98, mode: 'trim' })).warnings.length, 0);
});

test('integration: feeding scaleBEP output into the real AROPUMPCURVE engine reproduces the affinity-law duty point', () => {
  // Build a base pump curve whose duty point sits exactly at BEP by
  // construction (system curve passes through (Qbep, Hbep)).
  const base = { Qbep: 100, Hbep: 50, etaBep: 70, npshrBep: 4, Ns: 2000 };
  const basePump = CURVE.make(base);
  const sys = CURVE.systemCurve(20, 100, 50); // static head 20m, duty (100, 50)
  const baseOp = CURVE.operatingPoint(basePump, sys);
  close(baseOp.Q, 100, 1e-6);
  close(baseOp.H, 50, 1e-6);

  // Turn the speed down to 85%: the system curve (fixed, unchanged by
  // speed) is what the scaled pump curve now has to cross — not simply
  // 85% of the original duty point. Assert it lands wherever that
  // intersection actually is.
  const r = 0.85;
  const scaledResult = AFF.scaleBEP(Object.assign({}, base, { ratio: r, mode: 'speed' }));
  assert.strictEqual(scaledResult.applicable, true);
  const scaledPump = CURVE.make(scaledResult.scaled);
  const newOp = CURVE.operatingPoint(scaledPump, sys);
  assert.ok(newOp, 'the scaled curve should still cross the system curve within its flow range');
  // The scaled curve's own BEP shrank by the affinity laws, exactly:
  close(scaledPump.Qbep, 100 * r, 1e-9);
  close(scaledPump.Hbep, 50 * r * r, 1e-9);
  // And the new operating point must itself satisfy the fixed system curve.
  close(newOp.H, sys.head(newOp.Q), 1e-6, 'operating point must lie on the unchanged system curve');
  // Turning the speed down must reduce delivered flow (a basic sanity/direction check).
  assert.ok(newOp.Q < baseOp.Q);
});

test('integration: a deep-enough speed turn-down on a high-static-head system correctly reports no operating point', () => {
  // At r=0.5 the scaled shutoff head (≈14.75m) falls below the system's
  // 20m static head — the pump physically cannot overcome static head at
  // that speed. AROPUMPCURVE.operatingPoint() is expected to return null
  // for that case, and this module must not paper over it.
  const base = { Qbep: 100, Hbep: 50, etaBep: 70, npshrBep: 4, Ns: 2000 };
  const sys = CURVE.systemCurve(20, 100, 50);
  const scaledResult = AFF.scaleBEP(Object.assign({}, base, { ratio: 0.5, mode: 'speed' }));
  const scaledPump = CURVE.make(scaledResult.scaled);
  const shutoffHead = scaledPump.head(0);
  assert.ok(shutoffHead < sys.Hstatic, 'test setup check: scaled shut-off head should fall below the static head');
  assert.strictEqual(CURVE.operatingPoint(scaledPump, sys), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
