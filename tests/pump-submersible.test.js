/* ══════════════════════════════════════════════════════════════════════
   PUMP BUILD STEP 5 REGRESSION — lib/aro-pumpsubmersible.js (AROPUMPSUBMERSIBLE)

   Run:  node tests/pump-submersible.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpsubmersible.js'));
const SUB = global.AROPUMPSUBMERSIBLE;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('\nAROPUMPSUBMERSIBLE — window.AROPUMPSUBMERSIBLE\n');

test('SUB_BRANCHES: exactly the four submersible rows, correct duty class per branch', () => {
  const ids = Object.keys(SUB.SUB_BRANCHES).sort();
  assert.deepStrictEqual(ids, ['submersible-borehole', 'submersible-dewatering', 'submersible-sewage', 'submersible-slurry']);
  assert.strictEqual(SUB.SUB_BRANCHES['submersible-dewatering'].duty, 'intermittent');
  assert.strictEqual(SUB.SUB_BRANCHES['submersible-sewage'].duty, 'continuous');
  assert.strictEqual(SUB.SUB_BRANCHES['submersible-borehole'].duty, 'continuous');
  assert.strictEqual(SUB.SUB_BRANCHES['submersible-slurry'].duty, 'continuous');
});

test('screenSealCartridge: abrasive duty always gets a hard-vs-hard lower face regardless of corrosivity', () => {
  const r = SUB.screenSealCartridge({ corrosivityClass: 'mild', abrasives: true, subBranchId: 'submersible-slurry' });
  assert.strictEqual(r.lowerFace, 'Silicon Carbide vs Silicon Carbide');
});

test('screenSealCartridge: non-abrasive duty follows the corrosivity ladder', () => {
  const mild = SUB.screenSealCartridge({ corrosivityClass: 'mild', abrasives: false, subBranchId: 'submersible-dewatering' });
  const severe = SUB.screenSealCartridge({ corrosivityClass: 'severe', abrasives: false, subBranchId: 'submersible-dewatering' });
  assert.notStrictEqual(mild.lowerFace, severe.lowerFace);
  assert.strictEqual(severe.lowerFace, 'Silicon Carbide vs Silicon Carbide');
});

test('screenSealCartridge: upper (oil-side) seal is always the base pairing regardless of process fluid', () => {
  const r = SUB.screenSealCartridge({ corrosivityClass: 'severe', abrasives: true, subBranchId: 'submersible-slurry' });
  assert.strictEqual(r.upperFace, 'Carbon-Graphite vs Ceramic (Al₂O₃)');
});

test('screenSealCartridge: continuous-duty branches get a stronger moisture-sensor verdict than intermittent', () => {
  const cont = SUB.screenSealCartridge({ corrosivityClass: 'mild', abrasives: false, subBranchId: 'submersible-sewage' });
  const intermittent = SUB.screenSealCartridge({ corrosivityClass: 'mild', abrasives: false, subBranchId: 'submersible-dewatering' });
  assert.strictEqual(cont.moistureVerdict, 'SUITABLE');
  assert.strictEqual(intermittent.moistureVerdict, 'CHECK');
});

test('cableEntryNote: borehole branch carries the column/cable voltage-drop caveat, others do not', () => {
  const bore = SUB.cableEntryNote('submersible-borehole');
  const sewage = SUB.cableEntryNote('submersible-sewage');
  assert.ok(/voltage drop/.test(bore));
  assert.ok(!/voltage drop/.test(sewage));
  assert.ok(/IP68/.test(bore) && /IP68/.test(sewage));
});

test('selectDischargeConfig: each branch has a distinct, correct discharge type', () => {
  assert.strictEqual(SUB.selectDischargeConfig('submersible-dewatering').dischargeType, 'portable-hose');
  assert.strictEqual(SUB.selectDischargeConfig('submersible-sewage').dischargeType, 'guide-rail-auto-coupling');
  assert.strictEqual(SUB.selectDischargeConfig('submersible-borehole').dischargeType, 'column-pipe');
  assert.strictEqual(SUB.selectDischargeConfig('submersible-slurry').dischargeType, 'guide-rail-auto-coupling-heavy');
  const bad = SUB.selectDischargeConfig('not-a-branch');
  assert.strictEqual(bad.applicable, false);
});

test('verticalThrustAddition: passes the rotor weight straight through as added axial load, DATA REQUIRED shape for bad input', () => {
  const r = SUB.verticalThrustAddition(150);
  assert.strictEqual(r.applicable, true);
  assert.strictEqual(r.addedAxial_N, 150);
  assert.strictEqual(SUB.verticalThrustAddition(NaN).applicable, false);
  assert.strictEqual(SUB.verticalThrustAddition(-5).applicable, false);
});

test('design: DATA REQUIRED for an unknown branch, applicable end to end for a real one, carries the HI standards basis', () => {
  const bad = SUB.design({ subBranchId: 'not-a-branch' });
  assert.strictEqual(bad.applicable, false);
  const d = SUB.design({ subBranchId: 'submersible-sewage', corrosivityClass: 'moderate', abrasives: true, rotorWeight_N: 80 });
  assert.strictEqual(d.applicable, true);
  assert.ok(/HI \(Hydraulic Institute\)/.test(d.standardsBasis));
  assert.strictEqual(d.subBranchName, 'Sewage / Wastewater');
  assert.ok(d.sealCartridge.applicable);
  assert.ok(d.dischargeConfig.applicable);
  assert.strictEqual(d.verticalThrust.addedAxial_N, 80);
});

test('design: pure function — identical input yields identical output', () => {
  const input = { subBranchId: 'submersible-borehole', corrosivityClass: 'mild', abrasives: false, rotorWeight_N: 40 };
  const a = JSON.stringify(SUB.design(Object.assign({}, input)));
  const b = JSON.stringify(SUB.design(Object.assign({}, input)));
  assert.strictEqual(a, b);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
