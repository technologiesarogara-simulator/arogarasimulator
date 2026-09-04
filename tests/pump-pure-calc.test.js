/* ══════════════════════════════════════════════════════════════════════
   PHASE 1 REGRESSION — pure (DOM-free) pump calculation modules

   Locks in the current behaviour of window.AROPUMPSTD, window.AROPUMPCURVE
   and window.AROVP before any advanced pump-engineering work begins. These
   three files never touch `document`, so they can be exercised directly in
   Node by giving them a `window` to attach to (the same object they'd find
   in a browser), without a bundler, jsdom or any new dependency.

   Run:  node tests/pump-pure-calc.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpstd.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumpcurve.js'));
require(path.join(__dirname, '..', 'lib', 'aro-vapour.js'));

const STD = global.AROPUMPSTD;
const CURVE = global.AROPUMPCURVE;
const VP = global.AROVP;

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  OK   ' + name);
  } catch (e) {
    fail++;
    console.log('  FAIL ' + name + '\n       ' + e.message);
  }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol,
    (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('AROPUMPSTD — window.AROPUMPSTD');

test('viscousCorrection: B<=1 (thin liquid) applies no correction', () => {
  // Q large, nu tiny -> B well under 1
  const r = STD.viscousCorrection(1, 500, 20, 2900, 1);
  assert.strictEqual(r.applies, false);
  assert.strictEqual(r.CQ, 1); assert.strictEqual(r.CH, 1); assert.strictEqual(r.CE, 1);
});

test('viscousCorrection: documented formula reproduced independently (B, CQ, CE)', () => {
  const nu = 100, Q = 50, H = 30, N = 2900, stages = 1;
  const B_expected = 16.5 * Math.pow(nu, 0.5) * Math.pow(H / stages, 0.0625)
                    / (Math.pow(Q, 0.375) * Math.pow(N, 0.25));
  const lg = Math.log(B_expected) / Math.LN10;
  const C_expected = Math.exp(-0.165 * Math.pow(lg, 3.15));
  const CE_expected = Math.pow(B_expected, -0.0547 * Math.pow(B_expected, 0.69));
  const r = STD.viscousCorrection(nu, Q, H, N, stages);
  assert.strictEqual(r.applies, true);
  close(r.B, B_expected, 1e-9, 'B');
  close(r.CQ, C_expected, 1e-9, 'CQ');
  close(r.CH, C_expected, 1e-9, 'CH');
  close(r.CE, CE_expected, 1e-9, 'CE');
});

test('viscousCorrection: missing/zero inputs return null, never throw', () => {
  assert.strictEqual(STD.viscousCorrection(0, 50, 30, 2900, 1), null);
  assert.strictEqual(STD.viscousCorrection(10, 0, 30, 2900, 1), null);
  assert.strictEqual(STD.viscousCorrection(10, 50, 0, 2900, 1), null);
  assert.strictEqual(STD.viscousCorrection(10, 50, 30, 0, 1), null);
});

test('specificSpeed: matches the US-customary formula independently', () => {
  const N = 2900, Q = 100, H = 40, stages = 1;
  const Qg = Q * STD.M3H_TO_GPM, Hf = H * STD.M_TO_FT;
  const expected = N * Math.sqrt(Qg) / Math.pow(Hf, 0.75);
  close(STD.specificSpeed(N, Q, H, stages), expected, 1e-6);
});

test('specificSpeed: multistage divides head by stage count', () => {
  const oneStage = STD.specificSpeed(2900, 100, 200, 1);
  const fourStage = STD.specificSpeed(2900, 100, 200, 4);
  // less head per stage -> lower Hf^0.75 in the denominator -> HIGHER Ns
  assert.ok(fourStage > oneStage, 'Ns should rise as head-per-stage falls');
});

test('suctionSpecificSpeed + nssVerdict: threshold boundaries (API 610 cl. 6.1.7)', () => {
  // Solve N so Nss lands exactly on 8500 and 11000 for a fixed Q/NPSHr, then check the verdict text/ok flag either side.
  const Q = 100, NPSHr = 5, dbl = false;
  const NssAt = (N) => STD.suctionSpecificSpeed(N, Q, NPSHr, dbl);
  // find N for Nss=8500 and Nss=11000 by direct proportionality (Nss is linear in N)
  const NssPerRpm = NssAt(1) ; // Nss(N) = N * NssAt(1)
  const N_8500 = 8500 / NssPerRpm, N_11000 = 11000 / NssPerRpm;
  close(NssAt(N_8500), 8500, 1e-6);
  close(NssAt(N_11000), 11000, 1e-6);
  assert.strictEqual(STD.nssVerdict(8499).ok, true);
  assert.strictEqual(STD.nssVerdict(8500).ok, true);
  assert.strictEqual(STD.nssVerdict(10999).ok, true);
  assert.strictEqual(STD.nssVerdict(11001).ok, false);
});

test('suctionSpecificSpeed: double-suction halves the effective flow (raises Nss)', () => {
  const single = STD.suctionSpecificSpeed(2900, 200, 5, false);
  const double = STD.suctionSpecificSpeed(2900, 200, 5, true);
  close(double, single / Math.sqrt(2), single * 1e-6, 'Nss ~ sqrt(Q), halving Q scales Nss by 1/sqrt(2)');
});

test('mcsfFraction: banding by Nss (API 610 cl. 6.1.11 screening estimate)', () => {
  assert.strictEqual(STD.mcsfFraction(7999), 0.25);
  assert.strictEqual(STD.mcsfFraction(8000), 0.25);
  assert.strictEqual(STD.mcsfFraction(8001), 0.35);
  assert.strictEqual(STD.mcsfFraction(9500), 0.35);
  assert.strictEqual(STD.mcsfFraction(9501), 0.45);
  assert.strictEqual(STD.mcsfFraction(11000), 0.45);
  assert.strictEqual(STD.mcsfFraction(11001), 0.60);
  assert.strictEqual(STD.mcsfFraction(NaN), 0.30);
});

test('npshRequirement: greater of 1.0 m floor and 10% of NPSHr (API 610 cl. 6.1.6)', () => {
  assert.strictEqual(STD.npshRequirement(5), 1.0);      // 10% = 0.5 < floor
  assert.strictEqual(STD.npshRequirement(15), 1.5);     // 10% = 1.5 > floor
  assert.strictEqual(STD.npshRequirement(0), 1.0);
  assert.strictEqual(STD.npshRequirement(-3), 1.0);
});

test('driverMargin: API 610 Table 12 bands', () => {
  assert.strictEqual(STD.driverMargin(10).factor, 1.25);
  assert.strictEqual(STD.driverMargin(22).factor, 1.25);
  assert.strictEqual(STD.driverMargin(22.01).factor, 1.15);
  assert.strictEqual(STD.driverMargin(55).factor, 1.15);
  assert.strictEqual(STD.driverMargin(55.01).factor, 1.10);
  assert.strictEqual(STD.driverMargin(0).factor, 1.25);
});

test('lineLoss: laminar case (Re<2100) matches f=64/Re by hand, exactly', () => {
  // Pick a very viscous, very slow flow so Re is comfortably laminar.
  const o = { nps: 2, sch: '40', Q_m3h: 0.5, rho: 900, mu_cP: 500, length_m: 50, fittings: {} };
  const Dmm = STD.bore(2, '40'), D = Dmm / 1000;
  const Qs = o.Q_m3h / 3600, A = Math.PI / 4 * D * D, v = Qs / A;
  const mu = o.mu_cP / 1000, Re = o.rho * v * D / mu;
  assert.ok(Re < 2100, 'test setup must actually be laminar, Re=' + Re);
  const f_expected = 64 / Re;
  const dpPa_expected = (f_expected * o.length_m / D) * 0.5 * o.rho * v * v;
  const r = STD.lineLoss(o);
  close(r.Re, Re, 1e-6);
  close(r.f, f_expected, 1e-9);
  close(r.dp_bar, dpPa_expected / 1e5, 1e-9);
});

test('lineLoss: fitting K-values sum correctly and split fric/fitting drop', () => {
  const o = { nps: 3, sch: '40', Q_m3h: 40, rho: 1000, mu_cP: 1, length_m: 20,
              fittings: { elbow90: 2, gate: 1 } };
  const r = STD.lineLoss(o);
  const K_expected = STD.FIT_K.elbow90 * 2 + STD.FIT_K.gate * 1;
  close(r.K, K_expected, 1e-9);
  close(r.dpFric_bar + r.dpFit_bar, r.dp_bar, 1e-9, 'friction + fitting components must sum to total dp');
});

console.log('\nAROPUMPCURVE — window.AROPUMPCURVE');

test('npshrPredict: inverts the Nss definition (round-trips through suctionSpecificSpeed)', () => {
  const N = 2900, Q = 150, Nss = 9000;
  const npshr = CURVE.npshrPredict(N, Q, Nss, false);
  const back = STD.suctionSpecificSpeed(N, Q, npshr, false);
  close(back, Nss, 1e-4, 'NPSHr predicted from Nss must reproduce that same Nss when fed back through the standard definition');
});

test('attainableEfficiency: flat plateau across Ns 2000-3000, penalised outside it', () => {
  const eOnPlateau = CURVE.attainableEfficiency(500, 2500);
  const eBelow = CURVE.attainableEfficiency(500, 1000);
  const eAbove = CURVE.attainableEfficiency(500, 6000);
  assert.ok(eBelow < eOnPlateau, 'low Ns should be penalised below the plateau value');
  assert.ok(eAbove < eOnPlateau, 'high Ns should be penalised above the plateau value');
  assert.ok(eOnPlateau >= 20 && eOnPlateau <= 92, 'efficiency must stay within the clamped 20-92% band');
});

test('attainableEfficiency: monotonically non-decreasing with flow at a fixed Ns', () => {
  const Ns = 2500;
  const flows = [10, 50, 200, 1000, 5000];
  let prev = -1;
  flows.forEach((q) => {
    const e = CURVE.attainableEfficiency(q, Ns);
    assert.ok(e >= prev - 1e-9, 'efficiency should not fall as flow rises on the HI data curve, at ' + q + ' m3/h');
    prev = e;
  });
});

test('make()+systemCurve()+operatingPoint(): exact analytic intersection at the duty point', () => {
  // Construct pump+system curves that, by design, cross exactly at Q=Qbep.
  const Ns = 2000; // < 2500 band -> shutoffRatio = 1.18
  const pump = CURVE.make({ Qbep: 100, Hbep: 50, etaBep: 70, npshrBep: 4, Ns: Ns });
  close(pump.shutoff, 1.18, 1e-9);
  close(pump.head(100), 50, 1e-9, 'head(Qbep) must equal Hbep by construction');
  const sys = CURVE.systemCurve(20, 100, 50); // static 20 m, duty point (100, 50) -> passes through BEP
  close(sys.head(100), 50, 1e-9);
  const op = CURVE.operatingPoint(pump, sys);
  assert.ok(op, 'operating point must be found');
  close(op.Q, 100, 1e-3);
  close(op.H, 50, 1e-2);
  close(op.pctBep, 100, 1e-2);
  const region = CURVE.region(op.pctBep);
  assert.strictEqual(region.ok, true);
  assert.ok(/preferred/.test(region.name));
});

test('region(): API 610 cl. 6.1.11 boundary behaviour', () => {
  assert.strictEqual(CURVE.region(70).ok, true);
  assert.strictEqual(CURVE.region(120).ok, true);
  assert.strictEqual(CURVE.region(121).ok, false);
  assert.strictEqual(CURVE.region(49).ok, false);
  assert.strictEqual(CURVE.region(130).ok, false);
  assert.strictEqual(CURVE.region(131).ok, false);
});

console.log('\nAROVP — window.AROVP');

test('water vapour pressure at 100 degC is ~1 atm (physical sanity check)', () => {
  // 100 C is water's boiling point at 1 atm by definition -- this is the
  // one number in the whole vapour-pressure model with an exact, independently
  // known right answer, not just "the formula reproduces itself".
  close(VP.pBarA('water', 100), 1.01325, 0.01, 'water must boil at ~1.013 bar(a) at 100 C');
});

test('water vapour pressure rises monotonically with temperature', () => {
  const temps = [10, 30, 50, 70, 90, 100, 150, 200];
  let prev = 0;
  temps.forEach((t) => {
    const p = VP.pBarA('water', t);
    assert.ok(p > prev, 'vapour pressure must increase with temperature at ' + t + ' C');
    prev = p;
  });
});

test('tSat inverts pBarA (round-trip) for water', () => {
  const p = VP.pBarA('water', 152.0);
  const t = VP.tSat('water', p);
  close(t, 152.0, 0.05);
});

test('aqueous solution vapour pressure = water pressure x stated activity factor', () => {
  const T = 60;
  const pWater = VP.pBarA('water', T);
  const pCaustic = VP.pBarA('caustic_50', T);
  close(pCaustic, pWater * 0.17, 1e-9);
});

test('tSat: an unreachable pressure (outside the correlation range) returns NaN, not a false root', () => {
  assert.ok(isNaN(VP.tSat('water', 1e9)));
  assert.ok(isNaN(VP.tSat('unknown_fluid_xyz', 1.0)));
});

test('note(): flags extrapolation outside the fitted Antoine range', () => {
  assert.strictEqual(VP.note('ethanol', 50), '');            // inside 20-93
  assert.ok(/Extrapolated/.test(VP.note('ethanol', 150)));   // above 93
  assert.ok(/Extrapolated/.test(VP.note('ammonia', -90)));   // below -83
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
