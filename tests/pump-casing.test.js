/* ══════════════════════════════════════════════════════════════════════
   PHASE 5a REGRESSION — lib/aro-pumpcasing.js (AROPUMPCASING)

   Run:  node tests/pump-casing.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpcasing.js'));
const CAS = global.AROPUMPCASING;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('\nAROPUMPCASING — window.AROPUMPCASING\n');

test('SHAPE_BANDS: four bands, well-formed, gap widens and volute fraction narrows as Ns rises', () => {
  assert.strictEqual(CAS.SHAPE_BANDS.length, 4);
  for (const b of CAS.SHAPE_BANDS) {
    assert.ok(b.voluteVelocityFraction.min < b.voluteVelocityFraction.max);
    assert.ok(b.cutwaterClearancePct.min < b.cutwaterClearancePct.max);
  }
  for (let i = 1; i < CAS.SHAPE_BANDS.length; i++) {
    assert.ok(CAS.SHAPE_BANDS[i].voluteVelocityFraction.mid < CAS.SHAPE_BANDS[i - 1].voluteVelocityFraction.mid);
    assert.ok(CAS.SHAPE_BANDS[i].cutwaterClearancePct.mid > CAS.SHAPE_BANDS[i - 1].cutwaterClearancePct.mid);
  }
});

test('PRESSURE_CLASSES: six classes, strictly increasing ratings', () => {
  assert.strictEqual(CAS.PRESSURE_CLASSES.length, 6);
  for (let i = 1; i < CAS.PRESSURE_CLASSES.length; i++) {
    assert.ok(CAS.PRESSURE_CLASSES[i].maxBarG > CAS.PRESSURE_CLASSES[i - 1].maxBarG);
  }
});

test('screenCasing: missing inputs report DATA REQUIRED, never invent a casing', () => {
  assert.strictEqual(CAS.screenCasing({}).status, 'DATA REQUIRED');
  assert.strictEqual(CAS.screenCasing({ Q_m3h: 50, H_m: 47.5 }).status, 'DATA REQUIRED'); // no U2/D2/shapeFamily
});

test('screenCasing: volute throat area is exactly Q / (kVolute * U2), algebraically', () => {
  const r = CAS.screenCasing({ Q_m3h: 50, H_m: 47.5, shapeFamily: 'radial', U2_ms: 29.12, D2_m: 0.192 });
  assert.strictEqual(r.applicable, true);
  const Qm3s = 50 / 3600;
  const VthExpected = r.volute.kVolute * 29.12;
  close(r.volute.Vth_ms, VthExpected, 1e-9);
  close(r.volute.A3_m2, Qm3s / VthExpected, 1e-9);
  close(r.volute.D3eq_mm, Math.sqrt(4 * (Qm3s / VthExpected) / Math.PI) * 1000, 1e-6);
});

test('screenCasing: cutwater casing ID equals D2 plus twice the radial clearance, exactly', () => {
  const r = CAS.screenCasing({ Q_m3h: 50, H_m: 47.5, shapeFamily: 'radial', U2_ms: 29.12, D2_m: 0.192 });
  const D2mm = 0.192 * 1000;
  const gapMm = (r.cutwater.gapPct / 100) * (D2mm / 2);
  close(r.cutwater.gapRadial_mm, gapMm, 1e-9);
  close(r.cutwater.casingID_mm, D2mm + 2 * gapMm, 1e-9);
});

test('screenCasing: axial-flow band gives a wider cutwater gap than radial for the same D2', () => {
  const radial = CAS.screenCasing({ Q_m3h: 500, H_m: 10, shapeFamily: 'radial', U2_ms: 20, D2_m: 0.3 });
  const axial = CAS.screenCasing({ Q_m3h: 500, H_m: 10, shapeFamily: 'axial flow', U2_ms: 20, D2_m: 0.3 });
  assert.ok(axial.cutwater.gapRadial_mm > radial.cutwater.gapRadial_mm);
  assert.ok(axial.volute.Vth_ms < radial.volute.Vth_ms, 'axial band uses a lower volute-velocity fraction of the same U2');
});

test('screenCasing: pressure class picks the smallest class whose rating covers the design pressure, exactly at the boundaries', () => {
  // shutoffHeadM supplied directly to make the design pressure land on
  // exact, easily hand-checked class boundaries. designPressBarG = pSucBarG + rho*g*H/1e5.
  const mkPress = (targetBarG) => {
    // solve H such that rho*g*H/1e5 == targetBarG (rho=1000)
    const H = (targetBarG * 1e5) / (1000 * 9.81);
    return CAS.screenCasing({ Q_m3h: 50, H_m: 47.5, shapeFamily: 'radial', U2_ms: 29.12, D2_m: 0.192, pSucBarG: 0, shutoffHeadM: H, rho: 1000 }).pressureClass;
  };
  close(mkPress(19.6).designPressBarG, 19.6, 1e-6);
  assert.strictEqual(mkPress(19.6).cls, '150#');
  assert.strictEqual(mkPress(19.60001).cls, '300#');
  assert.strictEqual(mkPress(51.1).cls, '300#');
  assert.strictEqual(mkPress(102.1).cls, '600#');
  assert.strictEqual(mkPress(425.5).cls, '2500#');
  assert.strictEqual(mkPress(500).cls, 'BEYOND TABLE');
});

test('screenCasing: falls back to a 1.2x-rated-head shutoff assumption and says so, unless one is supplied', () => {
  const withFallback = CAS.screenCasing({ Q_m3h: 50, H_m: 100, shapeFamily: 'radial', U2_ms: 29.12, D2_m: 0.192 });
  assert.strictEqual(withFallback.pressureClass.shutoffAssumed, true);
  close(withFallback.pressureClass.shutoffHeadM, 120, 1e-9);
  const withSupplied = CAS.screenCasing({ Q_m3h: 50, H_m: 100, shapeFamily: 'radial', U2_ms: 29.12, D2_m: 0.192, shutoffHeadM: 115 });
  assert.strictEqual(withSupplied.pressureClass.shutoffAssumed, false);
  close(withSupplied.pressureClass.shutoffHeadM, 115, 1e-9);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
