/* ══════════════════════════════════════════════════════════════════════
   PUMP BUILD STEP 1 — lib/aro-pumpstandard.js (PUMP_SELECTION_STANDARD)

   Structural regression for the new pump selection reference table.
   Verifies row coverage, column completeness, and internal consistency
   (fullTrack rows match the build spec's twelve, ranges are ordered
   numeric tuples, no duplicate ids) before Phase 2 wires this table into
   the rebuilt Section 10 ranking engine.

   Run:  node tests/pump-standard.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpstandard.js'));
const STD = global.AROPUMPSTANDARD;
const ROWS = global.PUMP_SELECTION_STANDARD;

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

console.log('\nAROPUMPSTANDARD — window.PUMP_SELECTION_STANDARD\n');

test('exposes both the raw array and the AROPUMPSTANDARD namespace, same rows', () => {
  assert.ok(Array.isArray(ROWS), 'window.PUMP_SELECTION_STANDARD should be an array');
  assert.strictEqual(ROWS, STD.ROWS, 'AROPUMPSTANDARD.ROWS should be the same array reference');
});

test('exactly 23 rows, matching the build spec row count', () => {
  assert.strictEqual(ROWS.length, 23, 'expected 23 rows (7 centrifugal + 4 submersible + 7 pd-rotary + 5 pd-reciprocating)');
});

test('no duplicate ids', () => {
  const ids = new Set();
  for (const r of ROWS) {
    assert.ok(r.id && !ids.has(r.id), 'duplicate or missing id: ' + r.id);
    ids.add(r.id);
  }
});

test('category counts match the spec exactly', () => {
  const counts = {};
  for (const r of ROWS) counts[r.category] = (counts[r.category] || 0) + 1;
  assert.strictEqual(counts['centrifugal'], 7, 'centrifugal row count');
  assert.strictEqual(counts['submersible'], 4, 'submersible row count');
  assert.strictEqual(counts['pd-rotary'], 7, 'pd-rotary row count');
  assert.strictEqual(counts['pd-reciprocating'], 5, 'pd-reciprocating row count');
});

test('exactly 12 fullTrack rows, matching the build spec\'s named list', () => {
  const full = STD.fullTrackRows().map(r => r.id).sort();
  const expected = [
    'esc-oh2', 'submersible-dewatering', 'submersible-sewage', 'submersible-borehole',
    'submersible-slurry', 'screw-pump', 'gear-external', 'gear-internal', 'lobe-rotary',
    'peristaltic-hose', 'plunger-pump', 'piston-pump'
  ].sort();
  assert.strictEqual(full.length, 12, 'expected exactly 12 fullTrack rows');
  assert.deepStrictEqual(full, expected, 'fullTrack row set does not match the build spec');
});

test('all 4 submersible rows are fullTrack (spec: all four are ✓ FULL)', () => {
  const sub = STD.byCategory('submersible');
  assert.strictEqual(sub.length, 4);
  for (const r of sub) assert.ok(r.fullTrack, r.id + ' should be fullTrack');
});

test('every row has well-formed numeric ranges', () => {
  for (const r of ROWS) {
    for (const rangeKey of ['flowRangeM3h', 'headRangeM', 'viscosityRangeCst']) {
      const v = r[rangeKey];
      assert.ok(Array.isArray(v) && v.length === 2, r.id + ' missing/malformed ' + rangeKey);
      assert.ok(isFinite(v[0]) && isFinite(v[1]) && v[0] < v[1], r.id + ' ' + rangeKey + ' should be an ordered [lo,hi]');
    }
    const t = r.tempRangeC;
    assert.ok(Array.isArray(t) && t.length === 2 && t[0] < t[1], r.id + ' invalid tempRangeC');
    if (r.maxDiffPressureBar != null) assert.ok(isFinite(r.maxDiffPressureBar) && r.maxDiffPressureBar > 0, r.id + ' invalid maxDiffPressureBar');
    const e = r.efficiencyBandPct;
    assert.ok(Array.isArray(e) && e.length === 2 && e[0] > 0 && e[0] < e[1] && e[1] <= 100, r.id + ' invalid efficiencyBandPct');
  }
});

test('every row declares the full criteria-column set from the build spec', () => {
  const requiredStringFields = ['application', 'keyLimitations', 'viscosityBehavior', 'npshCharacteristic', 'standardsBasis'];
  for (const r of ROWS) {
    for (const f of requiredStringFields) {
      assert.ok(typeof r[f] === 'string' && r[f].length > 3, r.id + ' missing/short field: ' + f);
    }
    assert.ok(typeof r.selfPriming === 'string' && r.selfPriming.length > 0, r.id + ' missing selfPriming');
    assert.ok(r.fluidSuitability && typeof r.fluidSuitability === 'object', r.id + ' missing fluidSuitability');
    for (const flag of ['clean', 'viscous', 'abrasiveSlurry', 'shearSensitive', 'corrosive', 'hazardousToxic', 'cryogenic', 'hygienicSanitary']) {
      assert.strictEqual(typeof r.fluidSuitability[flag], 'boolean', r.id + ' fluidSuitability.' + flag + ' should be boolean');
    }
    assert.strictEqual(typeof r.dryRunCapable, 'boolean', r.id + ' dryRunCapable should be boolean');
    assert.strictEqual(typeof r.fullTrack, 'boolean', r.id + ' fullTrack should be boolean');
  }
});

test('viscosityBehavior is one of the three documented values', () => {
  const allowed = ['degrades', 'tolerant', 'improves-then-degrades'];
  for (const r of ROWS) assert.ok(allowed.includes(r.viscosityBehavior), r.id + ' has unexpected viscosityBehavior: ' + r.viscosityBehavior);
});

test('cells with no citable basis say so plainly rather than inventing precision', () => {
  const suspect = ROWS.filter(r => r.standardsBasis.indexOf('API') === -1 && r.standardsBasis.indexOf('HI') === -1
    && r.standardsBasis.indexOf('3-A') === -1 && r.standardsBasis.indexOf('ANSI') === -1);
  for (const r of suspect) {
    assert.ok(/manufacturer|No single standard/i.test(r.standardsBasis), r.id + ' standardsBasis should admit no citable standard: ' + r.standardsBasis);
  }
});

test('byId / byCategory / referenceOnlyRows lookups are consistent with the raw array', () => {
  assert.strictEqual(STD.byId('esc-oh2').name.indexOf('End Suction') === 0, true);
  assert.strictEqual(STD.byId('does-not-exist'), null);
  assert.strictEqual(STD.byCategory('pd-reciprocating').length, 5);
  assert.strictEqual(STD.referenceOnlyRows().length, ROWS.length - 12);
  for (const r of STD.referenceOnlyRows()) assert.ok(!r.fullTrack, r.id + ' should not appear in referenceOnlyRows');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
