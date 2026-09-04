/* ══════════════════════════════════════════════════════════════════════
   PHASE 8 REGRESSION — lib/aro-pumpbearing.js (AROPUMPBEARING)

   Run:  node tests/pump-bearing.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpbearing.js'));
const BRG = global.AROPUMPBEARING;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('\nAROPUMPBEARING — window.AROPUMPBEARING\n');

test('standardBore: rounds up to the nearest standard bore, exact at table entries', () => {
  assert.strictEqual(BRG.standardBore(25), 25);
  assert.strictEqual(BRG.standardBore(26), 30);
  assert.strictEqual(BRG.standardBore(9), 10);
  assert.strictEqual(BRG.standardBore(9999), BRG.STANDARD_BORES_MM[BRG.STANDARD_BORES_MM.length - 1]);
});

test('dynamicRating: calibration point at 25mm deep-groove ball lands at the stated ~14.8/6.95 kN, and rises monotonically with bore', () => {
  const r25 = BRG.dynamicRating(25, 'deep-groove-ball');
  close(r25.C_kN, 14.8, 1e-6);
  close(r25.C0_kN, 6.95, 1e-6);
  const r50 = BRG.dynamicRating(50, 'deep-groove-ball');
  assert.ok(r50.C_kN > r25.C_kN);
  assert.strictEqual(BRG.dynamicRating(25, 'not-a-bearing'), null);
});

test('dynamicRating: cylindrical roller has materially higher capacity than deep-groove ball at the same bore', () => {
  const ball = BRG.dynamicRating(40, 'deep-groove-ball');
  const roller = BRG.dynamicRating(40, 'cylindrical-roller');
  close(roller.C_kN / ball.C_kN, 1.6, 1e-9, 'capacity ratio should equal the stated 1.6x multiplier exactly');
});

test('equivalentLoad: below the e-threshold, P = Fr exactly (X=1, Y=0)', () => {
  const eq = BRG.equivalentLoad(1000, 100, 'deep-groove-ball'); // ratio 0.1 < e=0.24
  assert.strictEqual(eq.exceedsE, false);
  close(eq.P_N, 1000, 1e-9);
});

test('equivalentLoad: above the e-threshold, P = 0.56*Fr + Y*Fa exactly', () => {
  const eq = BRG.equivalentLoad(1000, 800, 'deep-groove-ball'); // ratio 0.8 > e=0.24
  assert.strictEqual(eq.exceedsE, true);
  close(eq.P_N, 0.56 * 1000 + 1.2 * 800, 1e-9);
});

test('equivalentLoad: a non-axial-capable bearing (cylindrical roller) ignores Fa in P but warns about it', () => {
  const eq = BRG.equivalentLoad(1000, 500, 'cylindrical-roller');
  close(eq.P_N, 1000, 1e-9);
  assert.ok(eq.warnings.length > 0);
  const eqNoAxial = BRG.equivalentLoad(1000, 0, 'cylindrical-roller');
  assert.strictEqual(eqNoAxial.warnings.length, 0);
});

test('l10Life: matches (C/P)^p exactly for both ball (p=3) and roller (p=10/3) exponents', () => {
  close(BRG.l10Life(10000, 2000, 3), Math.pow(5, 3), 1e-9);
  close(BRG.l10Life(10000, 2000, 10 / 3), Math.pow(5, 10 / 3), 1e-6);
  assert.ok(Number.isNaN(BRG.l10Life(0, 2000, 3)));
});

test('l10Hours: matches L10*1e6/(60*N) exactly, and a higher speed gives fewer hours for the same L10', () => {
  close(BRG.l10Hours(10, 1800), 10 * 1e6 / (60 * 1800), 1e-6);
  const slow = BRG.l10Hours(10, 1000);
  const fast = BRG.l10Hours(10, 3000);
  assert.ok(fast < slow, 'more revolutions per minute burns through the same L10 million-rev life in fewer hours');
});

test('estimateAxialThrust: Fa = K * deltaP * (pi/4 * D1^2) exactly', () => {
  const r = BRG.estimateAxialThrust({ D1_m: 0.08, deltaP_Pa: 465000 });
  const expected = 0.675 * 465000 * (Math.PI / 4) * 0.08 * 0.08;
  close(r.Fa_N, expected, 1e-6);
});

test('screenBearing: missing duty inputs report DATA REQUIRED, never a fabricated life', () => {
  assert.strictEqual(BRG.screenBearing({}).status, 'DATA REQUIRED');
  assert.strictEqual(BRG.screenBearing({ shaftDiameter_mm: 25, N_rpm: 2900, Fr_N: 500 }).status, 'DATA REQUIRED'); // no bearingTypeId
});

test('screenBearing: a light, low-speed duty comes back SUITABLE with a life comfortably above 25,000h', () => {
  const r = BRG.screenBearing({ shaftDiameter_mm: 25, N_rpm: 1450, Fr_N: 300, Fa_N: 0, bearingTypeId: 'deep-groove-ball' });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.status, 'PRELIMINARY ASSUMPTION');
  assert.strictEqual(r.verdict, 'SUITABLE');
  assert.ok(r.L10h >= 25000);
});

test('screenBearing: verdict boundaries land exactly at the API 610 25,000h / 16,000h thresholds', () => {
  // Solve Fr such that L10h lands exactly on a threshold, holding bore/speed/Fa fixed.
  const bore = 25, N = 1800, bt = 'deep-groove-ball';
  const rating = BRG.dynamicRating(bore, bt);
  const solveFrForHours = (hoursTarget) => {
    const L10rev = hoursTarget * 60 * N / 1e6;
    return rating.C_N / Math.pow(L10rev, 1 / 3); // P=Fr since Fa=0
  };
  const frAt25000 = solveFrForHours(25000);
  const rAt25000 = BRG.screenBearing({ shaftDiameter_mm: bore, N_rpm: N, Fr_N: frAt25000, Fa_N: 0, bearingTypeId: bt });
  close(rAt25000.L10h, 25000, 1);
  assert.strictEqual(rAt25000.verdict, 'SUITABLE');

  const frJustBelow25000 = solveFrForHours(24999);
  const rJustBelow = BRG.screenBearing({ shaftDiameter_mm: bore, N_rpm: N, Fr_N: frJustBelow25000, Fa_N: 0, bearingTypeId: bt });
  assert.strictEqual(rJustBelow.verdict, 'CHECK');

  const frAt16000 = solveFrForHours(16000);
  const rAt16000 = BRG.screenBearing({ shaftDiameter_mm: bore, N_rpm: N, Fr_N: frAt16000, Fa_N: 0, bearingTypeId: bt });
  close(rAt16000.L10h, 16000, 1);
  assert.strictEqual(rAt16000.verdict, 'CHECK');

  const frJustBelow16000 = solveFrForHours(15999);
  const rJustBelowB = BRG.screenBearing({ shaftDiameter_mm: bore, N_rpm: N, Fr_N: frJustBelow16000, Fa_N: 0, bearingTypeId: bt });
  assert.strictEqual(rJustBelowB.verdict, 'NOT RECOMMENDED');
});

test('screenAllBearingTypes: returns all three types, sorted best-verdict-then-longest-life first', () => {
  const r = BRG.screenAllBearingTypes({ shaftDiameter_mm: 25, N_rpm: 2900, Fr_N: 800, Fa_N: 200 });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.ranked.length, 3);
  const rank = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
  for (let i = 1; i < r.ranked.length; i++) {
    assert.ok(rank[r.ranked[i - 1].verdict] <= rank[r.ranked[i].verdict]);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
