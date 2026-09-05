/* ══════════════════════════════════════════════════════════════════════
   PHASE 23 REGRESSION — lib/aro-pumpreliability.js (AROPUMPRELIABILITY)

   Run:  node tests/pump-reliability.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpinspection.js')); // for the reused motor-status classifier
require(path.join(__dirname, '..', 'lib', 'aro-pumpreliability.js'));
const REL = global.AROPUMPRELIABILITY;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function byId(causes, id) { return causes.filter(c => c.id === id)[0]; }

console.log('\nAROPUMPRELIABILITY — window.AROPUMPRELIABILITY\n');

test('listSymptoms: returns a non-empty catalog of {id,label} symptoms', () => {
  const list = REL.listSymptoms();
  assert.ok(list.length >= 4);
  list.forEach(s => { assert.ok(s.id); assert.ok(s.label); });
});

test('buildFailureAnalysis: an unknown symptom id reports DATA REQUIRED rather than crashing', () => {
  const r = REL.buildFailureAnalysis('not-a-real-symptom', {});
  assert.strictEqual(r.applicable, false);
  assert.strictEqual(r.status, 'DATA REQUIRED');
});

test('buildFailureAnalysis: marks the reported symptom as a USER-ENTERED CONDITION, distinct from calculated evidence', () => {
  const r = REL.buildFailureAnalysis('cavitation-noise', {});
  assert.strictEqual(r.condition, 'USER-ENTERED CONDITION');
  assert.strictEqual(r.symptomId, 'cavitation-noise');
});

test('buildFailureAnalysis: with no evidence, every calculable cause reports DATA REQUIRED, never a guessed verdict', () => {
  const r = REL.buildFailureAnalysis('cavitation-noise', {});
  r.causes.forEach(c => assert.ok(['DATA REQUIRED', 'NOT APPLICABLE'].indexOf(c.supportStatus) !== -1, c.cause + ' got ' + c.supportStatus));
});

test('buildFailureAnalysis: a cause this app cannot check from a calculation is always REQUIRES FIELD INSPECTION / DATA REQUIRED, never SUPPORTED or ruled out', () => {
  const r = REL.buildFailureAnalysis('high-bearing-temp', {
    bearingResult: { applicable: true, top: { verdict: 'NOT RECOMMENDED', L10h: 5000 } },
  });
  const misalign = byId(r.causes, 'misalignment-bearing');
  assert.strictEqual(misalign.evidenceType, 'REQUIRES FIELD INSPECTION');
  assert.strictEqual(misalign.supportStatus, 'DATA REQUIRED');
});

test('buildFailureAnalysis: cavitation-noise correctly flags low-npsh-margin as SUPPORTED for a tight margin, NOT SUPPORTED for a comfortable one', () => {
  const tight = REL.buildFailureAnalysis('cavitation-noise', { npshMargin: 0.4 });
  assert.strictEqual(byId(tight.causes, 'low-npsh-margin').supportStatus, 'SUPPORTED');

  const comfortable = REL.buildFailureAnalysis('cavitation-noise', { npshMargin: 8 });
  assert.strictEqual(byId(comfortable.causes, 'low-npsh-margin').supportStatus, 'NOT SUPPORTED');
});

test('buildFailureAnalysis: causes are sorted SUPPORTED before POSSIBLE before NOT SUPPORTED before DATA REQUIRED', () => {
  const r = REL.buildFailureAnalysis('cavitation-noise', { npshMargin: 0.4, opPctBep: 60 });
  const order = r.causes.map(c => c.supportStatus);
  const ranks = { SUPPORTED: 0, POSSIBLE: 1, 'NOT SUPPORTED': 2, 'DATA REQUIRED': 3, 'NOT APPLICABLE': 4 };
  for (let i = 1; i < order.length; i++) assert.ok(ranks[order[i]] >= ranks[order[i - 1]], JSON.stringify(order));
});

test('buildFailureAnalysis: seal-leak reads the seal engine\'s own flashingWarning and verdict verbatim, never re-deriving them', () => {
  const r = REL.buildFailureAnalysis('seal-leak', {
    sealPlanResult: { applicable: true, flashingWarning: 'NPSH margin is tight', top: { verdict: 'NOT RECOMMENDED' } },
  });
  assert.strictEqual(byId(r.causes, 'flashing-risk').supportStatus, 'SUPPORTED');
  assert.strictEqual(byId(r.causes, 'flashing-risk').evidenceText, 'NPSH margin is tight');
  assert.strictEqual(byId(r.causes, 'wrong-seal-plan').supportStatus, 'SUPPORTED');
});

test('buildFailureAnalysis: motor-overload reuses AROPUMPINSPECTION.classifyStatusText rather than re-deriving a threshold', () => {
  const r = REL.buildFailureAnalysis('motor-overload', { motorLoading: 105, motorStatus: 'OVERLOADED - Upsize' });
  assert.strictEqual(byId(r.causes, 'undersized-motor').supportStatus, 'SUPPORTED');
});

test('buildFailureAnalysis: pd-overpressure cause is NOT APPLICABLE for a centrifugal duty, and reads Phase 14\'s real verdict for a PD duty', () => {
  const centrifugal = REL.buildFailureAnalysis('motor-overload', { topFamilyCategory: 'radial-centrifugal' });
  assert.strictEqual(byId(centrifugal.causes, 'restricted-discharge').supportStatus, 'NOT APPLICABLE');

  const pd = REL.buildFailureAnalysis('motor-overload', {
    topFamilyCategory: 'pd-reciprocating',
    overpressureResult: { applicable: true, verdict: 'NOT RECOMMENDED', message: 'no relief fitted' },
  });
  assert.strictEqual(byId(pd.causes, 'restricted-discharge').supportStatus, 'SUPPORTED');
});

test('buildFailureAnalysis: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const evidence = { npshMargin: 2, opPctBep: 95, motorLoading: 80, motorStatus: 'NORMAL LOADING' };
  assert.deepStrictEqual(REL.buildFailureAnalysis('high-vibration', evidence), REL.buildFailureAnalysis('high-vibration', evidence));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
