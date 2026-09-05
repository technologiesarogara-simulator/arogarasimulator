/* ══════════════════════════════════════════════════════════════════════
   PHASE 12 REGRESSION — lib/aro-pumpvendor.js (AROPUMPVENDOR)

   Run:  node tests/pump-vendor.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpcurve.js')); // for the integration test
require(path.join(__dirname, '..', 'lib', 'aro-pumpvendor.js'));
const CURVE = global.AROPUMPCURVE;
const VEN = global.AROPUMPVENDOR;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('\nAROPUMPVENDOR — window.AROPUMPVENDOR\n');

test('interpolate: exact at entered breakpoints and exact linear midpoint', () => {
  const pts = [{ q: 0, h: 60 }, { q: 50, h: 50 }, { q: 100, h: 30 }];
  close(VEN.interpolate(pts, 0), 60, 1e-9);
  close(VEN.interpolate(pts, 50), 50, 1e-9);
  close(VEN.interpolate(pts, 100), 30, 1e-9);
  close(VEN.interpolate(pts, 25), 55, 1e-9, 'midpoint of the first segment');
  close(VEN.interpolate(pts, 75), 40, 1e-9, 'midpoint of the second segment');
});

test('interpolate: holds flat outside the entered range rather than extrapolating a slope', () => {
  const pts = [{ q: 10, h: 55 }, { q: 90, h: 35 }];
  close(VEN.interpolate(pts, 0), 55, 1e-9);
  close(VEN.interpolate(pts, 1000), 35, 1e-9);
});

test('buildVendorCurve: fewer than two valid points is invalid, not a fabricated curve', () => {
  assert.strictEqual(VEN.buildVendorCurve([], 50).valid, false);
  assert.strictEqual(VEN.buildVendorCurve([{ q: 50, h: 40 }], 50).valid, false);
  assert.strictEqual(VEN.buildVendorCurve([{ q: NaN, h: 40 }, { q: 10, h: NaN }], 50).valid, false, 'invalid rows must be filtered, not coerced');
});

test('buildVendorCurve: sorts unsorted input and reports the correct Qmin/Qmax', () => {
  const v = VEN.buildVendorCurve([{ q: 100, h: 30 }, { q: 0, h: 60 }, { q: 50, h: 50 }], 50);
  assert.strictEqual(v.valid, true);
  assert.strictEqual(v.Qmin, 0);
  assert.strictEqual(v.Qmax, 100);
  close(v.head(25), 55, 1e-9, 'head() must interpolate the sorted points correctly regardless of input order');
});

test('buildVendorCurve: Qbep defaults to the middle entered point when not supplied', () => {
  const v = VEN.buildVendorCurve([{ q: 0, h: 60 }, { q: 50, h: 50 }, { q: 100, h: 30 }], undefined);
  assert.strictEqual(v.Qbep, 50);
});

test('buildVendorCurve: atOrPastRange correctly flags extrapolation', () => {
  const v = VEN.buildVendorCurve([{ q: 10, h: 55 }, { q: 90, h: 35 }], 50);
  assert.strictEqual(v.atOrPastRange(5), true);
  assert.strictEqual(v.atOrPastRange(50), false);
  assert.strictEqual(v.atOrPastRange(95), true);
});

test('integration: a vendor curve plugs into the real AROPUMPCURVE.operatingPoint() unmodified', () => {
  const vendor = VEN.buildVendorCurve([{ q: 0, h: 60 }, { q: 50, h: 47.5 }, { q: 100, h: 20 }], 50);
  const sys = CURVE.systemCurve(20, 50, 47.5); // duty point coincides exactly with the vendor's middle point
  const op = CURVE.operatingPoint(vendor, sys);
  assert.ok(op, 'operatingPoint must find a crossing against a vendor curve object, using only its head()/Qbep interface');
  close(op.Q, 50, 1e-3);
  close(op.H, 47.5, 1e-3);
  close(op.pctBep, 100, 1e-3);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
