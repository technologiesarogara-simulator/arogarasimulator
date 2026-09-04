/* ══════════════════════════════════════════════════════════════════════
   PHASE 6 REGRESSION — lib/aro-pumpmoc.js (AROPUMPMOC)

   Run:  node tests/pump-moc.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpmoc.js'));
const MOC = global.AROPUMPMOC;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ' + expected + ' got ' + actual + ' (tol ' + tol + ')');
}
const VALID_VERDICTS = ['SUITABLE', 'CHECK', 'NOT RECOMMENDED'];

console.log('\nAROPUMPMOC — window.AROPUMPMOC\n');

test('MATERIALS database: ten well-formed materials with sorted envelopes', () => {
  assert.strictEqual(MOC.MATERIALS.length, 10);
  const ids = new Set();
  for (const m of MOC.MATERIALS) {
    assert.ok(!ids.has(m.id)); ids.add(m.id);
    assert.ok(m.applicableComponents.length > 0, m.id + ' has no applicable components');
    assert.ok(['mild', 'moderate', 'severe'].includes(m.corrosivityTolerance), m.id + ' bad tolerance');
    assert.ok(Array.isArray(m.avoidFluids));
    for (let i = 1; i < m.envelope.length; i++) {
      assert.ok(m.envelope[i].t > m.envelope[i - 1].t, m.id + ' envelope temps not strictly increasing');
      assert.ok(m.envelope[i].p <= m.envelope[i - 1].p, m.id + ' envelope pressure should not increase with temperature');
    }
  }
});

test('FLUID_CORROSIVITY: every entry has a valid class and a boolean chloride flag', () => {
  for (const key of Object.keys(MOC.FLUID_CORROSIVITY)) {
    const f = MOC.FLUID_CORROSIVITY[key];
    assert.ok(['mild', 'moderate', 'severe'].includes(f.corrosivityClass), key + ' bad class');
    assert.strictEqual(typeof f.chlorideRisk, 'boolean', key + ' chlorideRisk must be boolean');
  }
  assert.strictEqual(MOC.FLUID_CORROSIVITY.custom, undefined, '"custom" must stay unclassified — it is the DATA REQUIRED test case');
});

test('envelopeRatingAt: exact values at breakpoints, linear interpolation at the midpoint, clamped outside the table', () => {
  const cs = MOC.MATERIALS.find((m) => m.id === 'carbon-steel');
  close(MOC.envelopeRatingAt(cs, 0), 50, 1e-9);
  close(MOC.envelopeRatingAt(cs, 100), 46, 1e-9);
  close(MOC.envelopeRatingAt(cs, 50), 48, 1e-9, 'midpoint between 0->50barg and 100->46barg should be exactly 48');
  close(MOC.envelopeRatingAt(cs, -50), 50, 1e-9, 'below table range clamps to the first point');
  close(MOC.envelopeRatingAt(cs, 9999), 28, 1e-9, 'above table range clamps to the last point');
});

test('screenMaterials: an unclassified fluid ("custom") reports DATA REQUIRED, never a guessed verdict', () => {
  const r = MOC.screenMaterials({ component: 'casing', fluidKey: 'custom', tempC: 25, designPressBarG: 5 });
  assert.strictEqual(r.applicable, false);
  assert.strictEqual(r.status, 'DATA REQUIRED');
});

test('screenMaterials: missing temperature/pressure reports DATA REQUIRED', () => {
  assert.strictEqual(MOC.screenMaterials({ component: 'casing', fluidKey: 'water' }).status, 'DATA REQUIRED');
});

test('screenMaterials: shaft component only ever offers materials actually used for shafts', () => {
  const r = MOC.screenMaterials({ component: 'shaft', fluidKey: 'water', tempC: 25, designPressBarG: 5 });
  const ids = r.ranked.map((x) => x.id);
  assert.ok(!ids.includes('cast-iron') && !ids.includes('bronze') && !ids.includes('ni-resist') && !ids.includes('titanium'),
    'shaft list must not include materials never used for shafts, got ' + ids.join(','));
  assert.ok(ids.includes('carbon-steel') && ids.includes('316-stainless'));
});

test('screenMaterials: mild clean-water duty at ambient conditions is SUITABLE across the board', () => {
  const r = MOC.screenMaterials({ component: 'casing', fluidKey: 'water', tempC: 25, designPressBarG: 5 });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.status, 'PREDICTED');
  for (const entry of r.ranked) {
    assert.ok(VALID_VERDICTS.includes(entry.verdict));
    assert.strictEqual(entry.verdict, 'SUITABLE', entry.id + ' should be SUITABLE for ambient water, got ' + entry.verdict);
  }
});

test('screenMaterials: hydrochloric acid rules out cast iron/carbon steel/316/titanium but leaves duplex/hastelloy suitable', () => {
  const r = MOC.screenMaterials({ component: 'casing', fluidKey: 'hydrochloric_acid', tempC: 40, designPressBarG: 5 });
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.strictEqual(byId['carbon-steel'].verdict, 'NOT RECOMMENDED');
  assert.strictEqual(byId['316-stainless'].verdict, 'NOT RECOMMENDED');
  assert.strictEqual(byId['titanium'].verdict, 'NOT RECOMMENDED');
  assert.strictEqual(byId['hastelloy-c'].verdict, 'SUITABLE');
  assert.strictEqual(byId['duplex-stainless'].verdict, 'SUITABLE');
});

test('screenMaterials: hot brine flags 316 for chloride SCC review but leaves duplex clear', () => {
  const r = MOC.screenMaterials({ component: 'impeller', fluidKey: 'brine', tempC: 80, designPressBarG: 5 });
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.strictEqual(byId['316-stainless'].verdict, 'CHECK');
  assert.ok(byId['316-stainless'].warnings.some((w) => /chloride/i.test(w)));
  assert.strictEqual(byId['duplex-stainless'].verdict, 'SUITABLE', 'duplex\'s higher chloride-SCC threshold (150C) should not trigger at 80C');
});

test('screenMaterials: hot caustic flags carbon steel for embrittlement review', () => {
  const r = MOC.screenMaterials({ component: 'casing', fluidKey: 'caustic_50', tempC: 70, designPressBarG: 5 });
  const cs = r.ranked.find((e) => e.id === 'carbon-steel');
  assert.strictEqual(cs.verdict, 'CHECK');
  assert.ok(cs.warnings.some((w) => /caustic/i.test(w)));
});

test('screenMaterials: a design pressure beyond the screened rating is NOT RECOMMENDED, near it is CHECK', () => {
  const cs = MOC.MATERIALS.find((m) => m.id === 'carbon-steel');
  const ratingAt300 = MOC.envelopeRatingAt(cs, 300); // 36 barg
  const over = MOC.screenMaterials({ component: 'casing', fluidKey: 'water', tempC: 300, designPressBarG: ratingAt300 + 5 });
  const near = MOC.screenMaterials({ component: 'casing', fluidKey: 'water', tempC: 300, designPressBarG: ratingAt300 * 0.95 });
  assert.strictEqual(over.ranked.find((e) => e.id === 'carbon-steel').verdict, 'NOT RECOMMENDED');
  assert.strictEqual(near.ranked.find((e) => e.id === 'carbon-steel').verdict, 'CHECK');
});

test('screenAllComponents: returns all four components, each independently applicable', () => {
  const r = MOC.screenAllComponents({ fluidKey: 'water', tempC: 25, designPressBarG: 5 });
  for (const c of ['casing', 'impeller', 'shaft', 'wearRings']) {
    assert.ok(r[c] && r[c].applicable, c + ' should be applicable');
    assert.strictEqual(r[c].component, c);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
