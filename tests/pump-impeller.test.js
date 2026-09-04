/* ══════════════════════════════════════════════════════════════════════
   PHASE 4 REGRESSION — lib/aro-pumpimpeller.js (AROPUMPIMPELLER)

   Unit tests for the pure Specific Speed / Impeller Family engine, run
   the same way as the other pump-engine test files: attach `window` to
   `global` so the DOM-free IIFE can load in plain Node.

   Run:  node tests/pump-impeller.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpstd.js'));       // for the cross-check against impellerType
require(path.join(__dirname, '..', 'lib', 'aro-pumpimpeller.js'));
const STD = global.AROPUMPSTD;
const IMP = global.AROPUMPIMPELLER;

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
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('\nAROPUMPIMPELLER — window.AROPUMPIMPELLER\n');

test('SHAPE_BANDS: four well-formed bands, ranges increasing/decreasing monotonically with Ns', () => {
  assert.strictEqual(IMP.SHAPE_BANDS.length, 4);
  for (const b of IMP.SHAPE_BANDS) {
    for (const key of ['headCoefficient', 'flowCoefficient', 'vaneCount', 'vaneExitAngleDeg', 'eyeRatio']) {
      assert.ok(b[key].min < b[key].max, b.shapeFamily + '.' + key + ' min/max out of order');
      close(b[key].mid, (b[key].min + b[key].max) / 2, 1e-9, b.shapeFamily + '.' + key + '.mid');
    }
  }
  // head coefficient falls as Ns band rises; flow coefficient rises
  for (let i = 1; i < IMP.SHAPE_BANDS.length; i++) {
    assert.ok(IMP.SHAPE_BANDS[i].headCoefficient.mid < IMP.SHAPE_BANDS[i - 1].headCoefficient.mid, 'head coefficient should fall as Ns band rises');
    assert.ok(IMP.SHAPE_BANDS[i].flowCoefficient.mid > IMP.SHAPE_BANDS[i - 1].flowCoefficient.mid, 'flow coefficient should rise as Ns band rises');
  }
});

test('classify: shape-family thresholds match AROPUMPSTD.impellerType exactly at every boundary', () => {
  const boundaries = [1, 1499.999, 1500, 4199.999, 4200, 8999.999, 9000, 50000];
  for (const Ns of boundaries) {
    assert.strictEqual(IMP.classify(Ns).shapeFamily, STD.impellerType(Ns), 'mismatch at Ns=' + Ns);
  }
});

test('classify: missing/invalid Ns reports DATA REQUIRED, never guesses a shape', () => {
  for (const bad of [null, undefined, NaN, 0, -5]) {
    const r = IMP.classify(bad);
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.status, 'DATA REQUIRED');
  }
});

test('eulerHead: missing head/speed/Ns reports DATA REQUIRED, never invents a triangle', () => {
  assert.strictEqual(IMP.eulerHead({}).status, 'DATA REQUIRED');
  assert.strictEqual(IMP.eulerHead({ H_m: 50, N_rpm: 2900 }).status, 'DATA REQUIRED'); // Ns missing
  assert.strictEqual(IMP.eulerHead({ H_m: 50, Ns: 2000 }).status, 'DATA REQUIRED'); // N_rpm missing
});

test('eulerHead: internal identity — the Euler equation round-trips exactly by construction', () => {
  const r = IMP.eulerHead({ H_m: 47.5, N_rpm: 2900, stages: 1, Ns: 2500, hydraulicEff: 0.78 });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.status, 'PRELIMINARY ASSUMPTION');
  // H_euler_stage = U2*Cu2/g must equal Hstage/eta exactly (that's how Cu2 was derived)
  const HeulerFromTriangle = (r.U2_ms * r.Cu2_ms) / 9.81;
  close(HeulerFromTriangle, r.Hstage_m / r.hydraulicEff, 1e-6, 'Euler head identity');
  // W2^2 = Cm2^2 + W2u^2 must close exactly
  const W2u = r.U2_ms - r.Cu2_ms;
  close(r.W2_ms * r.W2_ms, r.Cm2_ms * r.Cm2_ms + W2u * W2u, 1e-6, 'velocity triangle closure');
  // D2 <-> U2 round trip: U2 = D2 * pi * N / 60
  close(r.U2_ms, r.D2_m * Math.PI * 2900 / 60, 1e-6, 'tip speed / diameter relation');
});

test('eulerHead: multistage divides the duty head by stage count before solving the triangle', () => {
  const single = IMP.eulerHead({ H_m: 300, N_rpm: 2900, stages: 1, Ns: 2500 });
  const triple = IMP.eulerHead({ H_m: 300, N_rpm: 2900, stages: 3, Ns: 2500 });
  close(triple.Hstage_m, single.Hstage_m / 3, 1e-9);
  assert.ok(triple.U2_ms < single.U2_ms, 'a lower per-stage head should need a lower tip speed');
});

test('eulerHead: a lower head coefficient (axial-band) needs a higher tip speed than a higher one (radial-band) for the same duty', () => {
  const radial = IMP.eulerHead({ H_m: 50, N_rpm: 2900, stages: 1, Ns: 500, psiOverride: 0.55 });
  const axial = IMP.eulerHead({ H_m: 50, N_rpm: 2900, stages: 1, Ns: 20000, psiOverride: 0.10 });
  assert.ok(axial.U2_ms > radial.U2_ms, 'U2 should scale as 1/sqrt(psi)');
  close(axial.U2_ms / radial.U2_ms, Math.sqrt(0.55 / 0.10), 1e-6, 'U2 ratio should match sqrt(psi ratio) exactly');
});

test('eulerHead: an inconsistent efficiency/coefficient combination is flagged, not silently accepted', () => {
  // Cu2/U2 reduces exactly to psi/eta (independent of H, N) — so a head
  // coefficient large relative to the assumed hydraulic efficiency pushes
  // Cu2 past U2, which is not physically possible for a real impeller.
  const r = IMP.eulerHead({ H_m: 50, N_rpm: 2900, stages: 1, Ns: 2500, hydraulicEff: 0.30, psiOverride: 0.55 });
  close(r.slipFactor, 0.55 / 0.30, 1e-9, 'slip factor should reduce exactly to psi/eta');
  assert.ok(r.warnings.length > 0, 'expected at least one physical-consistency warning');
});

test('eulerHead: assumptions array documents psi/phi/eta in plain terms every time', () => {
  const r = IMP.eulerHead({ H_m: 47.5, N_rpm: 2900, stages: 1, Ns: 2500 });
  assert.ok(r.assumptions.length >= 3);
  assert.ok(r.assumptions.some((a) => /head coefficient/i.test(a)));
  assert.ok(r.assumptions.some((a) => /hydraulic efficiency/i.test(a)));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
