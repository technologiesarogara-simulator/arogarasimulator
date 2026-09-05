/* ══════════════════════════════════════════════════════════════════════
   PHASE 5b REGRESSION — lib/aro-pumpimpeller3d.js, computeBladeLayout only

   The THREE.js Viewer half of this module only runs in a browser (it
   needs `document`/WebGL); it is verified visually via Playwright, not
   here. This file tests only the pure geometry math.

   Run:  node tests/pump-impeller3d.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpimpeller3d.js'));
const V3D = global.AROPUMPIMPELLER3D;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('\nAROPUMPIMPELLER3D — window.AROPUMPIMPELLER3D (computeBladeLayout)\n');

test('does not load a THREE.js Viewer in a non-browser environment', () => {
  assert.strictEqual(V3D.Viewer, undefined);
});

test('rejects invalid geometry rather than silently drawing something wrong', () => {
  assert.strictEqual(V3D.computeBladeLayout({ vaneCount: 1, D1_m: 0.1, D2_m: 0.2, beta2Deg: 20 }).valid, false, 'vaneCount < 2');
  assert.strictEqual(V3D.computeBladeLayout({ vaneCount: 6, D1_m: 0.2, D2_m: 0.1, beta2Deg: 20 }).valid, false, 'D2 <= D1');
  assert.strictEqual(V3D.computeBladeLayout({ vaneCount: 6, D1_m: 0.1, D2_m: 0.2, beta2Deg: 0 }).valid, false, 'beta2 == 0');
  assert.strictEqual(V3D.computeBladeLayout({ vaneCount: 6, D1_m: 0.1, D2_m: 0.2, beta2Deg: 90 }).valid, false, 'beta2 == 90');
  assert.strictEqual(V3D.computeBladeLayout({ vaneCount: 6, D1_m: 0.1, D2_m: 0.2, beta2Deg: NaN }).valid, false, 'beta2 NaN');
});

test('wrap angle matches the logarithmic-spiral formula exactly: phiWrap = tan(beta2) * ln(r2/r1)', () => {
  const layout = V3D.computeBladeLayout({ vaneCount: 6, D1_m: 0.10, D2_m: 0.20, beta2Deg: 25, samples: 10 });
  assert.strictEqual(layout.valid, true);
  const expected = Math.tan(25 * Math.PI / 180) * Math.log(0.10 / 0.05);
  close(layout.phiWrapRad, expected, 1e-9);
});

test('blades are spaced evenly around the hub', () => {
  const layout = V3D.computeBladeLayout({ vaneCount: 5, D1_m: 0.10, D2_m: 0.20, beta2Deg: 25 });
  assert.strictEqual(layout.blades.length, 5);
  for (let i = 0; i < 5; i++) {
    close(layout.blades[i].angle0, i * (2 * Math.PI / 5), 1e-9);
  }
});

test('every blade curve starts exactly at r1 and ends exactly at r2', () => {
  const layout = V3D.computeBladeLayout({ vaneCount: 4, D1_m: 0.08, D2_m: 0.24, beta2Deg: 30, samples: 20 });
  for (const blade of layout.blades) {
    close(blade.points[0].r, layout.r1, 1e-9);
    close(blade.points[blade.points.length - 1].r, layout.r2, 1e-9);
  }
});

test('every sampled point lies on the logarithmic spiral r(phi) = r1 * exp(phi / tan(beta2))', () => {
  const layout = V3D.computeBladeLayout({ vaneCount: 4, D1_m: 0.08, D2_m: 0.24, beta2Deg: 30, samples: 25 });
  const tanBeta = Math.tan(30 * Math.PI / 180);
  for (const p of layout.blades[0].points) {
    close(p.r, layout.r1 * Math.exp(p.phi / tanBeta), 1e-9);
    close(Math.hypot(p.x, p.y), p.r, 1e-9, 'x/y must land on radius r at angle theta');
  }
});

test('a larger blade exit angle wraps the blade further around the hub', () => {
  const shallow = V3D.computeBladeLayout({ vaneCount: 6, D1_m: 0.10, D2_m: 0.20, beta2Deg: 15 });
  const steep = V3D.computeBladeLayout({ vaneCount: 6, D1_m: 0.10, D2_m: 0.20, beta2Deg: 45 });
  assert.ok(steep.phiWrapRad > shallow.phiWrapRad);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
