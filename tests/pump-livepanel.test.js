/* ══════════════════════════════════════════════════════════════════════
   LIVE PANEL STEP 1 REGRESSION — lib/aro-pumplivepanel.js (AROPUMPLIVEPANEL)

   Run:  node tests/pump-livepanel.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpstandard.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumplivepanel.js'));
const LP = global.AROPUMPLIVEPANEL;
const STD = global.AROPUMPSTANDARD;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('\nAROPUMPLIVEPANEL — window.AROPUMPLIVEPANEL\n');

test('buildLivePumpPanelData: with no familyId, reports DATA REQUIRED rather than crashing', () => {
  const r = LP.buildLivePumpPanelData({});
  assert.strictEqual(r.applicable, false);
  assert.strictEqual(r.status, 'DATA REQUIRED');
});

test('buildLivePumpPanelData: an unknown familyId reports DATA REQUIRED rather than crashing', () => {
  const r = LP.buildLivePumpPanelData({ familyId: 'not-a-real-pump' });
  assert.strictEqual(r.applicable, false);
});

test('every one of the 23 PUMP_SELECTION_STANDARD rows maps to a real archetype with a non-empty fabrication parts list', () => {
  STD.ROWS.forEach((row) => {
    const r = LP.buildLivePumpPanelData({ familyId: row.id });
    assert.strictEqual(r.applicable, true, row.id + ' should resolve');
    assert.ok(r.archetype && r.archetype.key, row.id + ' missing archetype');
    assert.ok(LP.ARCHETYPES[r.archetype.key], row.id + ' archetype key "' + (r.archetype && r.archetype.key) + '" not in ARCHETYPES');
    assert.ok(Array.isArray(r.fabricationParts) && r.fabricationParts.length > 0, row.id + ' has no fabrication parts');
  });
});

test('FAMILY_TO_ARCHETYPE has no id outside the 23-row standard, and covers every row exactly once', () => {
  const stdIds = STD.ROWS.map(r => r.id).sort();
  const mapIds = Object.keys(LP.FAMILY_TO_ARCHETYPE).sort();
  assert.deepStrictEqual(mapIds, stdIds);
});

test('buildLivePumpPanelData: axial-mixed-flow (category centrifugal) gets its own vertical archetype, not the horizontal end-suction shape', () => {
  const esc = LP.buildLivePumpPanelData({ familyId: 'esc-oh2' });
  const axial = LP.buildLivePumpPanelData({ familyId: 'axial-mixed-flow' });
  assert.strictEqual(esc.archetype.key, 'centrifugal-horizontal');
  assert.strictEqual(axial.archetype.key, 'centrifugal-vertical');
  assert.notStrictEqual(esc.archetype.key, axial.archetype.key);
});

test('buildLivePumpPanelData: a sealless / no-rotating-shaft family (AODD) reports that honestly in driveType', () => {
  const r = LP.buildLivePumpPanelData({ familyId: 'aodd' });
  assert.ok(/no rotating shaft/i.test(r.driveType), r.driveType);
});

test('buildLivePumpPanelData: a magnetic-drive centrifugal reports sealless magnetic coupling in driveType', () => {
  const r = LP.buildLivePumpPanelData({ familyId: 'mag-drive' });
  assert.ok(/sealless/i.test(r.driveType) && /magnetic coupling/i.test(r.driveType), r.driveType);
});

test('buildLivePumpPanelData: peristaltic-hose gets a hose connection type, not a flanged one', () => {
  const r = LP.buildLivePumpPanelData({ familyId: 'peristaltic-hose' });
  assert.ok(/hose/i.test(r.connectionType), r.connectionType);
});

test('buildLivePumpPanelData: passes duty/nozzles/moc straight through without altering them', () => {
  const duty = { Q_m3h: 55.2, H_m: 30, dischargePressureBarG: 2.1, dischargeElevationM: 4.5, fluidLabel: 'Water' };
  const nozzles = { suction: 'DN80', discharge: 'DN65' };
  const moc = { casing: 'CF8M' };
  const r = LP.buildLivePumpPanelData({ familyId: 'esc-oh2', duty: duty, nozzles: nozzles, moc: moc });
  assert.deepStrictEqual(r.dutyReadout, { Q_m3h: 55.2, H_m: 30, dischargePressureBarG: 2.1, dischargeElevationM: 4.5, fluidLabel: 'Water' });
  assert.deepStrictEqual(r.nozzles, nozzles);
  assert.deepStrictEqual(r.moc, moc);
});

test('buildLivePumpPanelData: missing/non-finite duty fields report null rather than NaN or crashing', () => {
  const r = LP.buildLivePumpPanelData({ familyId: 'esc-oh2', duty: { Q_m3h: NaN } });
  assert.strictEqual(r.dutyReadout.Q_m3h, null);
  assert.strictEqual(r.dutyReadout.H_m, null);
  assert.strictEqual(r.dutyReadout.fluidLabel, null);
});

test('buildLivePumpPanelData: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const input = { familyId: 'screw-pump', duty: { Q_m3h: 10, H_m: 50 } };
  assert.deepStrictEqual(LP.buildLivePumpPanelData(input), LP.buildLivePumpPanelData(input));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
