/* ══════════════════════════════════════════════════════════════════════
   PHASE 9 REGRESSION — lib/aro-pumpseal.js (AROPUMPSEAL)

   Run:  node tests/pump-seal.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpseal.js'));
const SEAL = global.AROPUMPSEAL;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const VALID_VERDICTS = ['SUITABLE', 'CHECK', 'NOT RECOMMENDED'];

console.log('\nAROPUMPSEAL — window.AROPUMPSEAL\n');

test('SEAL_PLANS: seven well-formed plans covering all three containment categories', () => {
  assert.strictEqual(SEAL.SEAL_PLANS.length, 7);
  const cats = new Set(SEAL.SEAL_PLANS.map((p) => p.category));
  assert.ok(cats.has('single') && cats.has('dual-unpressurized') && cats.has('dual-pressurized'));
});

test('selectSealPlan: an unclassified fluid reports DATA REQUIRED, never a guessed plan', () => {
  const r = SEAL.selectSealPlan({ fluidKey: 'custom', tempC: 25 });
  assert.strictEqual(r.applicable, false);
  assert.strictEqual(r.status, 'DATA REQUIRED');
});

test('selectSealPlan: missing temperature reports DATA REQUIRED', () => {
  assert.strictEqual(SEAL.selectSealPlan({ fluidKey: 'water' }).status, 'DATA REQUIRED');
});

test('selectSealPlan: every ranked entry uses only the documented verdict vocabulary and is sorted best-first', () => {
  const r = SEAL.selectSealPlan({ fluidKey: 'water', tempC: 60 });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.status, 'PREDICTED');
  for (const entry of r.ranked) assert.ok(VALID_VERDICTS.includes(entry.verdict));
  for (let i = 1; i < r.ranked.length; i++) {
    const rank = { 'SUITABLE': 0, 'CHECK': 1, 'NOT RECOMMENDED': 2 };
    assert.ok(rank[r.ranked[i - 1].verdict] <= rank[r.ranked[i].verdict]);
  }
});

test('selectSealPlan: mild ambient water duty favours Plan 11 and does not need a dual seal', () => {
  const r = SEAL.selectSealPlan({ fluidKey: 'water', tempC: 60 });
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.strictEqual(byId['11'].verdict, 'SUITABLE');
  assert.strictEqual(byId['53A'].verdict, 'SUITABLE', 'a pressurized dual seal is never wrong, just unnecessary here');
});

test('selectSealPlan: hot water (>220C) rules out Plan 11/13/21 and favours Plan 23', () => {
  const r = SEAL.selectSealPlan({ fluidKey: 'condensate', tempC: 260 });
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.strictEqual(byId['11'].verdict, 'NOT RECOMMENDED');
  assert.strictEqual(byId['13'].verdict, 'NOT RECOMMENDED');
  assert.strictEqual(byId['21'].verdict, 'NOT RECOMMENDED');
  assert.strictEqual(byId['23'].verdict, 'SUITABLE');
  assert.strictEqual(r.top.id, '23');
});

test('selectSealPlan: a toxic-corrosive fluid (hydrochloric acid) rules out every single seal and tops out at Plan 53A', () => {
  const r = SEAL.selectSealPlan({ fluidKey: 'hydrochloric_acid', tempC: 40 });
  for (const entry of r.ranked.filter((e) => e.category === 'single')) {
    assert.strictEqual(entry.verdict, 'NOT RECOMMENDED', entry.id + ' should be ruled out for a toxic-corrosive fluid');
  }
  assert.strictEqual(r.top.id, '53A');
});

test('selectSealPlan: dirty service strongly favours Plan 32 over an ordinary recirculation plan', () => {
  const r = SEAL.selectSealPlan({ fluidKey: 'water', tempC: 60, dirtyService: true });
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.strictEqual(byId['32'].verdict, 'SUITABLE');
  assert.strictEqual(byId['11'].verdict, 'CHECK');
});

test('selectSealPlan: a vertical orientation favours Plan 13 over Plan 11 for an otherwise identical duty', () => {
  const horiz = SEAL.selectSealPlan({ fluidKey: 'water', tempC: 60, orientation: 'horizontal' });
  const vert = SEAL.selectSealPlan({ fluidKey: 'water', tempC: 60, orientation: 'vertical' });
  const vertPlan13 = vert.ranked.find((e) => e.id === '13');
  const horizPlan13 = horiz.ranked.find((e) => e.id === '13');
  assert.ok(vertPlan13.reasons.length > horizPlan13.reasons.length, 'vertical orientation should add a reason favouring Plan 13');
});

test('selectSealPlan: caustic service recommends a quench (Plan 62) as an add-on, tight NPSH margin flags flashing risk', () => {
  const withCaustic = SEAL.selectSealPlan({ fluidKey: 'caustic_50', tempC: 60 });
  assert.strictEqual(withCaustic.quenchRecommended, true);
  const withoutCaustic = SEAL.selectSealPlan({ fluidKey: 'water', tempC: 60 });
  assert.strictEqual(withoutCaustic.quenchRecommended, false);

  const tightNpsh = SEAL.selectSealPlan({ fluidKey: 'water', tempC: 60, npshMarginM: 0.3 });
  assert.ok(tightNpsh.flashingWarning);
  const goodNpsh = SEAL.selectSealPlan({ fluidKey: 'water', tempC: 60, npshMarginM: 8 });
  assert.strictEqual(goodNpsh.flashingWarning, null);
});

test('screenSealFaces: an unclassified corrosivity or missing temperature reports DATA REQUIRED', () => {
  assert.strictEqual(SEAL.screenSealFaces({ fluidKey: 'water', tempC: 25 }).status, 'DATA REQUIRED'); // no corrosivityClass
  assert.strictEqual(SEAL.screenSealFaces({ fluidKey: 'water', corrosivityClass: 'mild' }).status, 'DATA REQUIRED'); // no tempC
});

test('screenSealFaces: tungsten-carbide-vs-SiC is ruled out for sulfuric acid (cobalt binder attack) but SiC-vs-SiC remains suitable', () => {
  const r = SEAL.screenSealFaces({ fluidKey: 'sulfuric_acid', corrosivityClass: 'severe', tempC: 40 });
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.strictEqual(byId['tungsten-carbide-vs-sic'].verdict, 'NOT RECOMMENDED');
  assert.strictEqual(byId['sic-vs-sic'].verdict, 'SUITABLE');
});

test('screenSecondarySeals: EPDM is ruled out for a hydrocarbon (swells in oil) but suitable for hot water', () => {
  const hc = SEAL.screenSecondarySeals({ fluidKey: 'diesel', corrosivityClass: 'mild', tempC: 60 });
  const water = SEAL.screenSecondarySeals({ fluidKey: 'water', corrosivityClass: 'mild', tempC: 60 });
  assert.strictEqual(hc.ranked.find((e) => e.id === 'epdm').verdict, 'NOT RECOMMENDED');
  assert.strictEqual(water.ranked.find((e) => e.id === 'epdm').verdict, 'SUITABLE');
});

test('screenSecondarySeals: Viton is ruled out for hot caustic (known incompatibility) while Kalrez remains suitable', () => {
  const r = SEAL.screenSecondarySeals({ fluidKey: 'caustic_50', corrosivityClass: 'moderate', tempC: 70 });
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.strictEqual(byId['viton'].verdict, 'NOT RECOMMENDED');
  assert.strictEqual(byId['kalrez'].verdict, 'SUITABLE');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
