/* ══════════════════════════════════════════════════════════════════════
   PHASE 20 REGRESSION — lib/aro-pumpinspection.js (AROPUMPINSPECTION)

   Run:  node tests/pump-inspection.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpinspection.js'));
const INSP = global.AROPUMPINSPECTION;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function byNo(points, no) { return points.filter(p => p.no === no)[0]; }

console.log('\nAROPUMPINSPECTION — window.AROPUMPINSPECTION\n');

test('classifyStatusText: reads the ALREADY-COMPUTED motor status text, never re-derives a threshold', () => {
  assert.strictEqual(INSP.classifyStatusText('NORMAL LOADING'), 'SUITABLE');
  assert.strictEqual(INSP.classifyStatusText('GOOD LOADING'), 'SUITABLE');
  assert.strictEqual(INSP.classifyStatusText('HIGH - Monitor'), 'CHECK');
  assert.strictEqual(INSP.classifyStatusText('OVERSIZED - Review'), 'CHECK');
  assert.strictEqual(INSP.classifyStatusText('OVERLOADED - Upsize'), 'NOT RECOMMENDED');
  assert.strictEqual(INSP.classifyStatusText('ABOVE STANDARD RANGE - x'), 'NOT RECOMMENDED');
  assert.strictEqual(INSP.classifyStatusText('N/A - PUMP NOT REQUIRED AT THIS DUTY'), 'NOT APPLICABLE');
  assert.strictEqual(INSP.classifyStatusText(''), 'DATA REQUIRED');
  assert.strictEqual(INSP.classifyStatusText(null), 'DATA REQUIRED');
});

test('buildInspectionPoints: returns exactly 14 points, numbered 1-14 in order, with no data DATA REQUIRED/NOT APPLICABLE only', () => {
  const r = INSP.buildInspectionPoints({});
  assert.strictEqual(r.points.length, 14);
  r.points.forEach((p, i) => assert.strictEqual(p.no, i + 1));
  r.points.forEach(p => assert.ok(['DATA REQUIRED', 'NOT APPLICABLE', 'RECOMMENDED'].indexOf(p.status) !== -1, p.label + ' got ' + p.status));
});

test('buildInspectionPoints: cavitation reads Phase 1\'s cavType verbatim (ok/warn/anything else)', () => {
  assert.strictEqual(byNo(INSP.buildInspectionPoints({ cavType: 'ok', cavText: 'safe' }).points, 1).status, 'SUITABLE');
  assert.strictEqual(byNo(INSP.buildInspectionPoints({ cavType: 'warn', cavText: 'marginal' }).points, 1).status, 'CHECK');
  assert.strictEqual(byNo(INSP.buildInspectionPoints({ cavType: 'fail', cavText: 'cavitating' }).points, 1).status, 'NOT RECOMMENDED');
  const withText = INSP.buildInspectionPoints({ cavType: 'ok', cavText: 'SAFE - NO CAVITATION' });
  assert.strictEqual(byNo(withText.points, 1).detail, 'SAFE - NO CAVITATION');
});

test('buildInspectionPoints: every upstream-sourced point reads its phase\'s verdict/values straight through, never inventing one', () => {
  const r = INSP.buildInspectionPoints({
    pSucA: 2.345, pDischA: 9.876,
    motorStatus: 'NORMAL LOADING', motorLoading: 73.3,
    bearingResult: { applicable: true, top: { verdict: 'SUITABLE', bearingName: 'Deep-groove ball', L10h: 32000 } },
    sealPlanResult: { applicable: true, top: { verdict: 'CHECK', name: 'Plan 32 — External Clean Flush' } },
    shaftResult: { applicable: true, top: { criticalVerdict: 'SUITABLE', criticalSpeedRatio: 1.4 } },
    mocCasing: { applicable: true, top: { verdict: 'SUITABLE', name: 'Duplex Stainless Steel' } },
    coupling: { applicable: true, top: { verdict: 'CHECK', name: 'Elastomeric' } },
    driverEnclosure: { applicable: true, hazardClass: 'flammable', top: { verdict: 'SUITABLE', name: 'Ex-e' } },
    pidItems: [
      { id: 'seal-support', label: 'Mechanical Seal Support System — Plan 32', status: 'REQUIRED', detail: 'flush piping' },
      { id: 'min-flow-line', label: 'Minimum-Flow Recirculation Line', status: 'RECOMMENDED', detail: '36.0 m3/h' },
      { id: 'relief-valve', label: 'Discharge Relief Valve', status: 'NOT APPLICABLE', detail: 'centrifugal' },
      { id: 'pulsation-dampener', label: 'Pulsation Dampeners', status: 'NOT APPLICABLE', detail: 'centrifugal' },
    ],
  });
  assert.ok(byNo(r.points, 2).detail.indexOf('2.345 bar a') !== -1);
  assert.ok(byNo(r.points, 2).detail.indexOf('9.876 bar a') !== -1);
  assert.strictEqual(byNo(r.points, 3).status, 'SUITABLE');
  assert.strictEqual(byNo(r.points, 4).status, 'SUITABLE');
  assert.ok(byNo(r.points, 4).detail.indexOf('32,000 h') !== -1);
  assert.strictEqual(byNo(r.points, 5).status, 'CHECK');
  assert.strictEqual(byNo(r.points, 6).status, 'REQUIRED');
  assert.strictEqual(byNo(r.points, 6).detail, 'flush piping');
  assert.strictEqual(byNo(r.points, 7).status, 'CHECK');
  assert.strictEqual(byNo(r.points, 8).status, 'SUITABLE');
  assert.ok(byNo(r.points, 8).detail.indexOf('140%') !== -1);
  assert.strictEqual(byNo(r.points, 9).status, 'SUITABLE');
  assert.strictEqual(byNo(r.points, 10).status, 'RECOMMENDED');
  assert.strictEqual(byNo(r.points, 10).detail, '36.0 m3/h');
  assert.strictEqual(byNo(r.points, 12).status, 'SUITABLE');
  assert.strictEqual(byNo(r.points, 13).status, 'NOT APPLICABLE');
});

test('buildInspectionPoints: a close-coupled configuration reports point 7 as NOT APPLICABLE, not DATA REQUIRED', () => {
  const r = INSP.buildInspectionPoints({ coupling: { applicable: false, status: 'NOT APPLICABLE', reason: 'Close-coupled.' } });
  assert.strictEqual(byNo(r.points, 7).status, 'NOT APPLICABLE');
  assert.strictEqual(byNo(r.points, 7).detail, 'Close-coupled.');
});

test('buildInspectionPoints: relief/pulsation combine into point 13 as REQUIRED when either upstream item is REQUIRED', () => {
  const r = INSP.buildInspectionPoints({
    pidItems: [
      { id: 'relief-valve', label: 'x', status: 'SUITABLE', detail: 'relief ok' },
      { id: 'pulsation-dampener', label: 'y', status: 'REQUIRED', detail: 'dampeners required' },
    ],
  });
  assert.strictEqual(byNo(r.points, 13).status, 'REQUIRED');
});

test('buildInspectionPoints: points 11 (baseplate) and 14 (housekeeping) are duty-independent and always present', () => {
  const a = INSP.buildInspectionPoints({});
  const b = INSP.buildInspectionPoints({ cavType: 'ok', motorLoading: 50 });
  assert.strictEqual(byNo(a.points, 11).status, 'NOT APPLICABLE');
  assert.strictEqual(byNo(b.points, 11).status, 'NOT APPLICABLE');
  assert.strictEqual(byNo(a.points, 14).status, 'RECOMMENDED');
  assert.strictEqual(byNo(a.points, 14).detail, byNo(b.points, 14).detail);
});

test('buildInspectionPoints: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const input = { cavType: 'ok', cavText: 'safe', motorStatus: 'NORMAL LOADING', motorLoading: 60 };
  assert.deepStrictEqual(INSP.buildInspectionPoints(input), INSP.buildInspectionPoints(input));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
