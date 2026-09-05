/* ══════════════════════════════════════════════════════════════════════
   PHASE 15 REGRESSION — lib/aro-pumpservice.js (AROPUMPSERVICE)

   Run:  node tests/pump-service.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpservice.js'));
const SVC = global.AROPUMPSERVICE;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}

console.log('\nAROPUMPSERVICE — window.AROPUMPSERVICE\n');

test('screenSlurryTransport: missing flow/bore or an invalid SG reports DATA REQUIRED', () => {
  assert.strictEqual(SVC.screenSlurryTransport({}).status, 'DATA REQUIRED');
  assert.strictEqual(SVC.screenSlurryTransport({ Q_m3h: 50, pipeBore_mm: 100 }).status, 'DATA REQUIRED'); // no SG
  assert.strictEqual(SVC.screenSlurryTransport({ Q_m3h: 50, pipeBore_mm: 100, SG_solids: 1 }).status, 'DATA REQUIRED', 'SG must exceed 1');
});

test('screenSlurryTransport: vActual and vCritical match the stated formulas exactly', () => {
  const r = SVC.screenSlurryTransport({ Q_m3h: 100, pipeBore_mm: 154.1, SG_solids: 2.65, particleSizeMicron: 200 });
  assert.strictEqual(r.applicable, true);
  const D = 0.1541, area = Math.PI / 4 * D * D;
  close(r.vActual_ms, (100 / 3600) / area, 1e-9);
  close(r.vCritical_ms, r.FL * Math.sqrt(2 * 9.81 * D * (2.65 - 1)), 1e-9);
  close(r.ratio, r.vActual_ms / r.vCritical_ms, 1e-9);
});

test('screenSlurryTransport: particle size defaults to 150 microns (documented) when not entered', () => {
  const r = SVC.screenSlurryTransport({ Q_m3h: 100, pipeBore_mm: 154.1, SG_solids: 2.65 });
  assert.strictEqual(r.particleAssumed, true);
  assert.strictEqual(r.particleSizeMicron, 150);
});

test('screenSlurryTransport: verdict bands react correctly on both sides of the critical velocity', () => {
  // Use a fixed bore/SG/particle size and vary flow to push the ratio through each band.
  const base = { pipeBore_mm: 154.1, SG_solids: 2.65, particleSizeMicron: 200 };
  const vc = SVC.screenSlurryTransport(Object.assign({ Q_m3h: 100 }, base)).vCritical_ms;
  const D = 0.1541, area = Math.PI / 4 * D * D;
  const qForRatio = (ratio) => ratio * vc * area * 3600;

  assert.strictEqual(SVC.screenSlurryTransport(Object.assign({ Q_m3h: qForRatio(0.8) }, base)).verdict, 'NOT RECOMMENDED');
  assert.strictEqual(SVC.screenSlurryTransport(Object.assign({ Q_m3h: qForRatio(1.15) }, base)).verdict, 'CHECK');
  assert.strictEqual(SVC.screenSlurryTransport(Object.assign({ Q_m3h: qForRatio(1.6) }, base)).verdict, 'SUITABLE');
  assert.strictEqual(SVC.screenSlurryTransport(Object.assign({ Q_m3h: qForRatio(2.5) }, base)).verdict, 'CHECK');
});

test('screenSlurryTransport: a coarser particle band needs a higher critical velocity at the same SG/bore', () => {
  const fine = SVC.screenSlurryTransport({ Q_m3h: 100, pipeBore_mm: 154.1, SG_solids: 2.65, particleSizeMicron: 50 });
  const coarse = SVC.screenSlurryTransport({ Q_m3h: 100, pipeBore_mm: 154.1, SG_solids: 2.65, particleSizeMicron: 800 });
  assert.ok(coarse.vCritical_ms > fine.vCritical_ms);
});

test('HYGIENIC_MATERIALS: at least four hygienic-grade and at least two clearly non-hygienic materials', () => {
  const hygienic = SVC.HYGIENIC_MATERIALS.filter((m) => m.hygienicGrade);
  const nonHygienic = SVC.HYGIENIC_MATERIALS.filter((m) => !m.hygienicGrade);
  assert.ok(hygienic.length >= 4);
  assert.ok(nonHygienic.length >= 2);
});

test('screenHygienicMaterials: missing corrosivity class or temperature reports DATA REQUIRED', () => {
  assert.strictEqual(SVC.screenHygienicMaterials({ tempC: 25 }).status, 'DATA REQUIRED');
  assert.strictEqual(SVC.screenHygienicMaterials({ corrosivityClass: 'mild' }).status, 'DATA REQUIRED');
});

test('screenHygienicMaterials: a non-hygienic material is NOT RECOMMENDED even when its corrosivity/temp would otherwise pass', () => {
  const r = SVC.screenHygienicMaterials({ corrosivityClass: 'mild', tempC: 25 });
  const cs = r.ranked.find((m) => m.id === 'carbon-steel');
  assert.strictEqual(cs.verdict, 'NOT RECOMMENDED');
  assert.ok(cs.reasons.some((x) => /not a hygienic-grade material/i.test(x)));
});

test('screenHygienicMaterials: 316L is SUITABLE for a mild fluid at a comfortable temperature', () => {
  const r = SVC.screenHygienicMaterials({ corrosivityClass: 'mild', tempC: 60 });
  const ss = r.ranked.find((m) => m.id === '316l-hygienic');
  assert.strictEqual(ss.verdict, 'SUITABLE');
});

test('screenHygienicMaterials: results are sorted best-verdict-first', () => {
  const r = SVC.screenHygienicMaterials({ corrosivityClass: 'severe', tempC: 25 });
  const rank = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
  for (let i = 1; i < r.ranked.length; i++) {
    assert.ok(rank[r.ranked[i - 1].verdict] <= rank[r.ranked[i].verdict]);
  }
});

test('CIP_SIP_CHECKLIST and HYGIENIC_SURFACE_FINISH_NOTE are non-empty reference content', () => {
  assert.ok(Array.isArray(SVC.CIP_SIP_CHECKLIST) && SVC.CIP_SIP_CHECKLIST.length >= 4);
  assert.ok(typeof SVC.HYGIENIC_SURFACE_FINISH_NOTE === 'string' && /Ra/.test(SVC.HYGIENIC_SURFACE_FINISH_NOTE));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
