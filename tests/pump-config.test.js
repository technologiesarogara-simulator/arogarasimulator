/* ══════════════════════════════════════════════════════════════════════
   PHASE 3 REGRESSION — lib/aro-pumpconfig.js (AROPUMPCONFIG)

   Unit tests for the pure Centrifugal Pump Configuration engine, run the
   same way as pump-family.test.js: attach `window` to `global` so the
   DOM-free IIFE can load in plain Node.

   Run:  node tests/pump-config.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpconfig.js'));
const CFG = global.AROPUMPCONFIG;

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

console.log('\nAROPUMPCONFIG — window.AROPUMPCONFIG\n');

test('API_CLASSES database: 18 well-formed OH/BB/VS classes', () => {
  assert.strictEqual(CFG.API_CLASSES.length, 18);
  const ids = new Set();
  for (const c of CFG.API_CLASSES) {
    assert.ok(/^(OH|BB|VS)[1-7]$/.test(c.id), 'unexpected id format: ' + c.id);
    assert.ok(!ids.has(c.id), 'duplicate id: ' + c.id);
    ids.add(c.id);
    assert.ok(['single', 'multistage'].includes(c.stageType), c.id + ' bad stageType');
    assert.ok(['horizontal', 'vertical'].includes(c.orientation), c.id + ' bad orientation');
    assert.ok(Array.isArray(c.flowRangeM3h) && c.flowRangeM3h[0] < c.flowRangeM3h[1], c.id + ' bad flow range');
    assert.ok(Array.isArray(c.headRangeM) && c.headRangeM[0] < c.headRangeM[1], c.id + ' bad head range');
    assert.ok(Array.isArray(c.compatibleFamilyIds), c.id + ' compatibleFamilyIds must be an array (possibly empty)');
    assert.ok(typeof c.note === 'string' && c.note.length > 10, c.id + ' missing note');
  }
  const ohCount = CFG.API_CLASSES.filter((c) => c.id.startsWith('OH')).length;
  const bbCount = CFG.API_CLASSES.filter((c) => c.id.startsWith('BB')).length;
  const vsCount = CFG.API_CLASSES.filter((c) => c.id.startsWith('VS')).length;
  assert.strictEqual(ohCount, 6);
  assert.strictEqual(bbCount, 5);
  assert.strictEqual(vsCount, 7);
});

test('scoreToVerdict: exact threshold boundaries (matches AROPUMPFAMILY convention)', () => {
  assert.strictEqual(CFG.scoreToVerdict(70), 'SUITABLE');
  assert.strictEqual(CFG.scoreToVerdict(69.999), 'CHECK');
  assert.strictEqual(CFG.scoreToVerdict(40), 'CHECK');
  assert.strictEqual(CFG.scoreToVerdict(39.999), 'NOT RECOMMENDED');
});

test('configure: declines to run for a non-centrifugal family', () => {
  const r = CFG.configure({ familyId: 'gear-external', category: 'pd-rotary', Q_m3h: 10, H_m: 50, stages: 1 });
  assert.strictEqual(r.applicable, false);
  assert.strictEqual(r.status, 'NOT APPLICABLE');
});

test('configure: missing flow/head reports DATA REQUIRED', () => {
  const r = CFG.configure({ familyId: 'esc-oh2', category: 'centrifugal' });
  assert.strictEqual(r.applicable, false);
  assert.strictEqual(r.status, 'DATA REQUIRED');
});

test('configure: end-suction process duty narrows to an OH class', () => {
  const r = CFG.configure({ familyId: 'esc-oh2', category: 'centrifugal', Q_m3h: 50, H_m: 47.5, stages: 1 });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.status, 'PREDICTED');
  assert.strictEqual(r.usedFallback, false);
  assert.ok(r.top.id.startsWith('OH'), 'expected an OH class, got ' + r.top.id);
  assert.strictEqual(r.top.stageType, 'single');
  for (const entry of r.ranked) {
    assert.ok(VALID_VERDICTS.includes(entry.verdict), 'unexpected verdict: ' + entry.verdict);
  }
  for (let i = 1; i < r.ranked.length; i++) {
    assert.ok(r.ranked[i - 1].score >= r.ranked[i].score, 'ranked list is not sorted descending');
  }
});

test('configure: bb-split single-stage duty favours BB1/BB2 over BB3', () => {
  const r = CFG.configure({ familyId: 'bb-split', category: 'centrifugal', Q_m3h: 500, H_m: 50, stages: 1 });
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.ok(byId.BB1.score > byId.BB3.score || byId.BB2.score > byId.BB3.score,
    'a single-stage class should outscore the multistage BB3 at stages=1');
  assert.strictEqual(r.top.stageType, 'single');
});

test('configure: bb-split multistage high-head duty favours BB3 over BB1/BB2', () => {
  const r = CFG.configure({ familyId: 'bb-split', category: 'centrifugal', Q_m3h: 500, H_m: 400, stages: 6 });
  const byId = Object.fromEntries(r.ranked.map((e) => [e.id, e]));
  assert.ok(byId.BB3.score > byId.BB1.score, 'BB3 (multistage, high head) should outscore BB1 (single-stage, low head) at stages=6, H=400');
  assert.strictEqual(r.top.stageType, 'multistage');
});

test('configure: vs-multistage extreme-pressure duty favours BB4/BB5 over BB3', () => {
  const r = CFG.configure({ familyId: 'vs-multistage', category: 'centrifugal', Q_m3h: 100, H_m: 1800, stages: 12 });
  assert.ok(['BB4', 'BB5'].includes(r.top.id), 'expected BB4 or BB5 for a 1800 m head duty, got ' + r.top.id);
});

test('configure: vs-turbine-can duty narrows to a VS wet-pit/can class', () => {
  const r = CFG.configure({ familyId: 'vs-turbine-can', category: 'centrifugal', Q_m3h: 200, H_m: 100, stages: 1 });
  assert.ok(['VS1', 'VS2', 'VS5'].includes(r.top.id), 'expected VS1/VS2/VS5, got ' + r.top.id);
  assert.strictEqual(r.usedFallback, false);
});

test('configure: submersible duty narrows to a VS submerged-motor class', () => {
  const r = CFG.configure({ familyId: 'submersible', category: 'centrifugal', Q_m3h: 100, H_m: 50, stages: 1 });
  assert.ok(['VS4', 'VS6', 'VS7'].includes(r.top.id), 'expected VS4/VS6/VS7, got ' + r.top.id);
});

test('configure: a family with no seeded mapping falls back to screening every class', () => {
  const r = CFG.configure({ familyId: 'regen-turbine', category: 'centrifugal', Q_m3h: 5, H_m: 150, stages: 1 });
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.usedFallback, true);
  assert.strictEqual(r.ranked.length, CFG.API_CLASSES.length, 'fallback should screen the entire database');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
