/* ══════════════════════════════════════════════════════════════════════
   PHASE 2 REGRESSION — lib/aro-pumpfamily.js (AROPUMPFAMILY)
   Rebuilt for Pump Selection Standard Step 2: the engine now reads
   window.PUMP_SELECTION_STANDARD (lib/aro-pumpstandard.js) instead of
   carrying its own 17-row seed database, and screens four new duty-
   character flags (abrasives, shear-sensitive, dry-run-required,
   pulsation-sensitive) alongside the original flow/head/viscosity/NPSH
   criteria.

   Unit tests for the pure Automatic Pump Family Selection engine, run
   the same way as pump-pure-calc.test.js: attach `window` to `global`
   so the DOM-free IIFEs can load in plain Node, in the same order
   index.html loads them (standard table, then the engine that reads it).

   Run:  node tests/pump-family.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpstandard.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumpmoc.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumpfamily.js'));
const FAM = global.AROPUMPFAMILY;

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
const VALID_VERDICTS = ['SUITABLE', 'CHECK', 'NOT RECOMMENDED'];
const byId = (ranked) => Object.fromEntries(ranked.map((e) => [e.id, e]));

console.log('\nAROPUMPFAMILY — window.AROPUMPFAMILY\n');

test('FAMILIES is a back-compat alias reading the full 23-row Pump Selection Standard', () => {
  assert.ok(Array.isArray(FAM.FAMILIES) && FAM.FAMILIES.length === 23, 'expected all 23 rows via the back-compat alias');
  const ids = new Set();
  const allowedCategories = ['centrifugal', 'submersible', 'pd-rotary', 'pd-reciprocating'];
  for (const f of FAM.FAMILIES) {
    assert.ok(f.id && !ids.has(f.id), 'duplicate or missing id: ' + f.id);
    ids.add(f.id);
    assert.ok(allowedCategories.includes(f.category), f.id + ' has invalid category ' + f.category);
    for (const rangeKey of ['flowRangeM3h', 'headRangeM', 'viscosityRangeCst']) {
      const r = f[rangeKey];
      assert.ok(Array.isArray(r) && r.length === 2 && r[0] < r[1], f.id + ' has invalid ' + rangeKey);
    }
    assert.ok(typeof f.note === 'string' && f.note.length > 10, f.id + ' missing engineering note');
  }
});

test('fitScore: 1.0 anywhere inside the range, including the edges', () => {
  assert.strictEqual(FAM.fitScore(50, [10, 100]), 1);
  assert.strictEqual(FAM.fitScore(10, [10, 100]), 1);
  assert.strictEqual(FAM.fitScore(100, [10, 100]), 1);
});

test('fitScore: decays smoothly and monotonically outside the range', () => {
  const near = FAM.fitScore(120, [10, 100]);
  const far = FAM.fitScore(2000, [10, 100]);
  assert.ok(near > far, 'closer-outside value should score higher than far-outside value');
  assert.ok(near < 1 && near > 0, 'just outside the edge should be a partial, not a cliff');
  assert.strictEqual(FAM.fitScore(100000, [10, 100]), 0, 'far enough outside should floor at 0');
});

test('fitScore: unknown/missing value returns a neutral 0.5, never excludes outright', () => {
  assert.strictEqual(FAM.fitScore(null, [10, 100]), 0.5);
  assert.strictEqual(FAM.fitScore(NaN, [10, 100]), 0.5);
  assert.strictEqual(FAM.fitScore(undefined, [10, 100]), 0.5);
});

test('scoreToVerdict: exact threshold boundaries', () => {
  assert.strictEqual(FAM.scoreToVerdict(100), 'SUITABLE');
  assert.strictEqual(FAM.scoreToVerdict(70), 'SUITABLE');
  assert.strictEqual(FAM.scoreToVerdict(69.999), 'CHECK');
  assert.strictEqual(FAM.scoreToVerdict(40), 'CHECK');
  assert.strictEqual(FAM.scoreToVerdict(39.999), 'NOT RECOMMENDED');
  assert.strictEqual(FAM.scoreToVerdict(0), 'NOT RECOMMENDED');
});

test('viscosityDecision: bands match the documented thresholds', () => {
  assert.strictEqual(FAM.viscosityDecision(1).band, 'low');
  assert.strictEqual(FAM.viscosityDecision(20).band, 'low');
  assert.strictEqual(FAM.viscosityDecision(20.01).band, 'moderate');
  assert.strictEqual(FAM.viscosityDecision(1000).band, 'moderate');
  assert.strictEqual(FAM.viscosityDecision(1000.01).band, 'high');
  assert.strictEqual(FAM.viscosityDecision(3000).band, 'high');
  assert.strictEqual(FAM.viscosityDecision(3000.01).band, 'very-high');
  assert.strictEqual(FAM.viscosityDecision(1).correctionRequired, false);
  assert.strictEqual(FAM.viscosityDecision(500).correctionRequired, true);
  assert.strictEqual(FAM.viscosityDecision(null).band, 'unknown');
});

test('selectFamilies: missing flow/head reports DATA REQUIRED, never invents a ranking', () => {
  const r1 = FAM.selectFamilies({});
  assert.strictEqual(r1.ready, false);
  assert.strictEqual(r1.status, 'DATA REQUIRED');
  const r2 = FAM.selectFamilies({ Q_m3h: 50 }); // head missing
  assert.strictEqual(r2.ready, false);
});

test('selectFamilies: every ranked entry uses only the documented verdict vocabulary and carries the new reference-table fields', () => {
  const r = FAM.selectFamilies({ Q_m3h: 50, H_m: 47.5, viscosityCst: 1 });
  assert.strictEqual(r.ready, true);
  assert.strictEqual(r.status, 'PREDICTED');
  assert.strictEqual(r.ranked.length, 23, 'expected all 23 reference rows scored, none excluded');
  for (const entry of r.ranked) {
    assert.ok(VALID_VERDICTS.includes(entry.verdict), 'unexpected verdict: ' + entry.verdict);
    assert.ok(entry.score >= 0 && entry.score <= 100, 'score out of range: ' + entry.score);
    assert.strictEqual(typeof entry.fullTrack, 'boolean', entry.id + ' missing fullTrack');
    assert.ok(typeof entry.application === 'string' && entry.application.length > 5, entry.id + ' missing application text');
    assert.ok(typeof entry.keyLimitations === 'string' && entry.keyLimitations.length > 5, entry.id + ' missing keyLimitations text');
    assert.ok(entry.criteria && typeof entry.criteria === 'object', entry.id + ' missing per-criterion breakdown');
    for (const k of ['flow', 'head', 'viscosity', 'npsh', 'dryRun', 'shear', 'abrasives', 'pulsation']) {
      assert.ok(['pass', 'marginal', 'fail'].includes(entry.criteria[k]), entry.id + ' criteria.' + k + ' invalid: ' + entry.criteria[k]);
    }
  }
  // sorted descending by score
  for (let i = 1; i < r.ranked.length; i++) {
    assert.ok(r.ranked[i - 1].score >= r.ranked[i].score, 'ranked list is not sorted descending');
  }
  // exactly the 12 fullTrack rows carry the flag through into the ranked output
  assert.strictEqual(r.ranked.filter((e) => e.fullTrack).length, 12);
});

test('selectFamilies: returns a held ranked shortlist of alternatives with a reason each is behind the top pick', () => {
  const r = FAM.selectFamilies({ Q_m3h: 50, H_m: 47.5, viscosityCst: 1 });
  assert.ok(Array.isArray(r.alternatives) && r.alternatives.length > 0, 'expected a non-empty alternatives shortlist');
  for (const alt of r.alternatives) {
    assert.ok(alt.id && alt.name, 'alternative missing id/name');
    assert.ok(Array.isArray(alt.whyBehindTopPick), 'alternative missing whyBehindTopPick reasons array');
  }
});

test('selectFamilies: clean-water general service duty favours centrifugal over thick-fluid PD families', () => {
  const r = FAM.selectFamilies({ Q_m3h: 50, H_m: 47.5, viscosityCst: 1 });
  assert.strictEqual(r.top.category, 'centrifugal', 'top pick for 1 cSt water should be centrifugal, got ' + r.top.id);
  const b = byId(r.ranked);
  assert.ok(b['gear-external'].score < r.top.score, 'gear pump (min useful viscosity far above 1 cSt) should not outscore the top centrifugal pick');
  assert.ok(b['screw-pump'].score < r.top.score, 'screw pump should not outscore the top centrifugal pick on thin water');
});

test('selectFamilies: very high viscosity duty flips the recommendation to positive-displacement', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 30, viscosityCst: 5000 });
  assert.strictEqual(r.viscosity.band, 'very-high');
  assert.strictEqual(r.top.category, 'pd-rotary', 'top pick at 5000 cSt should be a positive-displacement rotary family, got ' + r.top.id);
  const centrifugalScores = r.ranked.filter((e) => e.category === 'centrifugal').map((e) => e.score);
  assert.ok(Math.max(...centrifugalScores) <= 30, 'every centrifugal family must be capped at <=30 above 3000 cSt');
  assert.ok(Math.max(...centrifugalScores) < r.top.score, 'best centrifugal must still score below the PD top pick');
});

test('selectFamilies: high-head low-flow metering duty favours reciprocating PD families', () => {
  const r = FAM.selectFamilies({ Q_m3h: 0.5, H_m: 800, viscosityCst: 1 });
  assert.strictEqual(r.top.category, 'pd-reciprocating', 'top pick for 0.5 m3/h at 800 m head should be reciprocating PD, got ' + r.top.id);
  const esc = byId(r.ranked)['esc-oh2'];
  assert.ok(esc.score < r.top.score, 'end-suction centrifugal (max ~120 m head) should not outscore the reciprocating pick at 800 m');
});

test('selectFamilies: a tight/negative NPSH margin penalises high-NPSH-sensitivity families and rewards low-NPSHr ones', () => {
  const good = FAM.selectFamilies({ Q_m3h: 50, H_m: 100, viscosityCst: 1, npshMarginM: 10 });
  const bad = FAM.selectFamilies({ Q_m3h: 50, H_m: 100, viscosityCst: 1, npshMarginM: -1 });
  const bGood = byId(good.ranked), bBad = byId(bad.ranked);
  assert.ok(bBad['esc-oh2'].score < bGood['esc-oh2'].score,
    'npsh-sensitive family (end-suction centrifugal) should score lower once the margin goes negative');
  assert.ok(bBad['vs-turbine-deepwell'].score > bGood['vs-turbine-deepwell'].score,
    'low-npshr family (submerged suction, vertical turbine) should score higher once the margin goes negative');
  assert.strictEqual(bBad['esc-oh2'].criteria.npsh, 'fail', 'expected the npsh criterion to fail once penalised');
  assert.ok(bBad['esc-oh2'].warnings.some((w) => /NPSH/i.test(w)), 'expected an NPSH warning on the penalised family');
});

test('selectFamilies: dry-run/self-priming requirement rewards capable families and penalises incapable ones', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 1, dryRunRequired: true });
  const b = byId(r.ranked);
  assert.strictEqual(b['peristaltic-hose'].criteria.dryRun, 'pass');
  assert.strictEqual(b['esc-oh2'].criteria.dryRun, 'fail', 'end-suction centrifugal is not dry-run capable');
  assert.ok(b['esc-oh2'].warnings.some((w) => /dry-run/i.test(w)));
});

test('selectFamilies: shear-sensitive flag penalises centrifugal and rewards known low-shear families', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 100, shearSensitive: true });
  const b = byId(r.ranked);
  assert.strictEqual(b['esc-oh2'].criteria.shear, 'fail');
  assert.strictEqual(b['peristaltic-hose'].criteria.shear, 'pass');
  assert.strictEqual(b['lobe-rotary'].criteria.shear, 'pass');
});

test('selectFamilies: abrasives flag penalises close-clearance families and rewards abrasive-tolerant ones', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 100, abrasives: true });
  const b = byId(r.ranked);
  assert.strictEqual(b['gear-external'].criteria.abrasives, 'fail', 'close-clearance gear pump should fail on abrasives');
  assert.strictEqual(b['peristaltic-hose'].criteria.abrasives, 'pass');
  assert.strictEqual(b['submersible-slurry'].criteria.abrasives, 'pass');
});

test('selectFamilies: pulsation-sensitive (smooth flow required) penalises reciprocating and rewards rotary PD', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 100, pulsationSensitive: true });
  const b = byId(r.ranked);
  assert.strictEqual(b['plunger-pump'].criteria.pulsation, 'fail');
  assert.strictEqual(b['screw-pump'].criteria.pulsation, 'pass');
});

test('selectFamilies: temperature criterion is marginal (never invented) when tempC is not entered', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 10 });
  r.ranked.forEach((e) => assert.strictEqual(e.criteria.temp, 'marginal', e.id));
});

test('selectFamilies: temperature criterion fails a family whose rated range the duty temperature falls far outside', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 10, tempC: 1200 });
  const b = byId(r.ranked);
  assert.strictEqual(b['esc-oh2'].criteria.temp, 'fail', 'esc-oh2 rated to 180°C should fail at 1200°C');
  const r2 = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 10, tempC: 340 });
  assert.strictEqual(byId(r2.ranked)['canned-motor-centrifugal'].criteria.temp, 'pass', 'canned-motor rated to 350°C should pass at 340°C');
});

test('selectFamilies: material criterion stays marginal (DATA REQUIRED) without a fluid/pressure to screen', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 10, tempC: 25 });
  r.ranked.forEach((e) => { assert.strictEqual(e.criteria.material, 'marginal', e.id); assert.strictEqual(e.materialTop, null, e.id); });
});

test('selectFamilies: material criterion reads a real AROPUMPMOC screening verdict, identical across every row for the same duty', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 10, tempC: 25, fluidKey: 'water', designPressBarG: 3 });
  const verdicts = r.ranked.map((e) => e.criteria.material);
  assert.ok(verdicts.every((v) => v === verdicts[0]), 'casing material screening is duty-driven, not family-driven, so every row must agree');
  assert.ok(['pass', 'marginal', 'fail'].includes(verdicts[0]));
  assert.ok(r.ranked[0].materialTop && typeof r.ranked[0].materialTop.name === 'string');
});

test('selectFamilies: sizing criterion fails outright outside the family range, is marginal near a rated edge, passes mid-range', () => {
  const r = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 10 });
  const b = byId(r.ranked);
  assert.strictEqual(b['diaphragm-metering'].criteria.sizing, 'fail', 'Q=10 is above diaphragm-metering\'s 0.001-5 m3/h range');
  assert.strictEqual(b['diaphragm-mechanical'].criteria.sizing, 'pass', 'Q=10 sits comfortably mid-range in 0.01-20 m3/h');
});

test('selectFamilies: none of the three new informational criteria move the score — same ranking as before they existed', () => {
  const withExtras = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 10, tempC: 25, fluidKey: 'water', designPressBarG: 3 });
  const withoutExtras = FAM.selectFamilies({ Q_m3h: 10, H_m: 40, viscosityCst: 10 });
  const scoresWith = byId(withExtras.ranked);
  withoutExtras.ranked.forEach((e) => assert.strictEqual(scoresWith[e.id].score, e.score, e.id + ' score must not change based on temp/material/sizing'));
});

test('selectFamilies: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const duty = { Q_m3h: 20, H_m: 60, viscosityCst: 50, npshMarginM: 2, abrasives: true, shearSensitive: true, dryRunRequired: false, pulsationSensitive: true };
  const r1 = FAM.selectFamilies(Object.assign({}, duty));
  const r2 = FAM.selectFamilies(Object.assign({}, duty));
  assert.deepStrictEqual(r1, r2);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
