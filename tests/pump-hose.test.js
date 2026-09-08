/* ══════════════════════════════════════════════════════════════════════
   PUMP BUILD STEP 6 REGRESSION — lib/aro-pumphose.js (AROPUMPHOSE)

   Run:  node tests/pump-hose.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumphose.js'));
const H = global.AROPUMPHOSE;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('\nAROPUMPHOSE — window.AROPUMPHOSE\n');

test('HOSE_ELASTOMERS: exactly the five common hose elastomers', () => {
  const ids = H.HOSE_ELASTOMERS.map(e => e.id).sort();
  assert.deepStrictEqual(ids, ['epdm', 'hypalon', 'nbr', 'nr', 'silicone']);
});

test('HOSE_BORES: ascending bore/flow, smallest is 1/4"', () => {
  assert.strictEqual(H.HOSE_BORES[0].bore, '1/4"');
  for (let i = 1; i < H.HOSE_BORES.length; i++) {
    assert.ok(H.HOSE_BORES[i].maxFlowM3h > H.HOSE_BORES[i - 1].maxFlowM3h);
  }
});

test('screenElastomer: DATA REQUIRED without corrosivity/temp', () => {
  assert.strictEqual(H.screenElastomer({}).applicable, false);
});

test('screenElastomer: severe corrosivity rules out mild-tolerance elastomers (NR, Silicone)', () => {
  const r = H.screenElastomer({ corrosivityClass: 'severe', tempC: 40 });
  const nr = r.ranked.filter(x => x.id === 'nr')[0];
  const silicone = r.ranked.filter(x => x.id === 'silicone')[0];
  assert.strictEqual(nr.verdict, 'NOT RECOMMENDED');
  assert.strictEqual(silicone.verdict, 'NOT RECOMMENDED');
  assert.strictEqual(r.top.id, 'hypalon');
});

test('screenElastomer: hygienic requirement rules out non-food-grade elastomers', () => {
  const r = H.screenElastomer({ corrosivityClass: 'mild', tempC: 40, hygienicRequired: true });
  const nbr = r.ranked.filter(x => x.id === 'nbr')[0];
  assert.strictEqual(nbr.verdict, 'NOT RECOMMENDED');
  const epdm = r.ranked.filter(x => x.id === 'epdm')[0];
  assert.notStrictEqual(epdm.verdict, 'NOT RECOMMENDED');
});

test('screenElastomer: high temperature rules out a low-temp-rated elastomer', () => {
  const r = H.screenElastomer({ corrosivityClass: 'mild', tempC: 95 });
  const nr = r.ranked.filter(x => x.id === 'nr')[0];
  assert.strictEqual(nr.verdict, 'NOT RECOMMENDED');
});

test('checkPressureCeiling: HARD NOT RECOMMENDED above rated pressure, not merely a warning', () => {
  const over = H.checkPressureCeiling(20, 'nr');
  assert.strictEqual(over.verdict, 'NOT RECOMMENDED');
  const close = H.checkPressureCeiling(13, 'nr');
  assert.strictEqual(close.verdict, 'CHECK');
  const fine = H.checkPressureCeiling(5, 'nr');
  assert.strictEqual(fine.verdict, 'SUITABLE');
  assert.strictEqual(H.checkPressureCeiling(5, 'not-an-elastomer').applicable, false);
});

test('estimateHoseLife: DATA REQUIRED without inputs, otherwise positive hours that fall with pressure/speed/abrasives', () => {
  assert.strictEqual(H.estimateHoseLife({}).applicable, false);
  const base = H.estimateHoseLife({ elastomerId: 'nr', diffPressureBar: 5, N_rpm: 80, abrasives: false });
  const highP = H.estimateHoseLife({ elastomerId: 'nr', diffPressureBar: 14, N_rpm: 80, abrasives: false });
  const highSpeed = H.estimateHoseLife({ elastomerId: 'nr', diffPressureBar: 5, N_rpm: 300, abrasives: false });
  const abrasive = H.estimateHoseLife({ elastomerId: 'nr', diffPressureBar: 5, N_rpm: 80, abrasives: true });
  assert.ok(base.estimatedHours > 0);
  assert.ok(highP.estimatedHours < base.estimatedHours);
  assert.ok(highSpeed.estimatedHours < base.estimatedHours);
  assert.ok(abrasive.estimatedHours < base.estimatedHours);
});

test('selectRollerConfig: pulsation-sensitive duty gets 3-roller/dual-head, otherwise 2-roller', () => {
  assert.strictEqual(H.selectRollerConfig(true).rollerCount, 3);
  assert.strictEqual(H.selectRollerConfig(false).rollerCount, 2);
});

test('bearingIsolationNote: mentions no shaft penetration / no seal needed', () => {
  const note = H.bearingIsolationNote();
  assert.ok(/isolated/.test(note) && /no mechanical seal/.test(note));
});

test('selectHoseBore: picks the smallest bore that comfortably carries the flow, DATA REQUIRED for bad input', () => {
  assert.strictEqual(H.selectHoseBore(0).applicable, false);
  const small = H.selectHoseBore(0.3);
  assert.strictEqual(small.bore, '1/4"');
  const bigger = H.selectHoseBore(20);
  assert.notStrictEqual(bigger.bore, '1/4"');
  const tooBig = H.selectHoseBore(500);
  assert.strictEqual(tooBig.status, 'CHECK');
});

test('design: full orchestration is applicable end to end and carries the "no single standard" basis', () => {
  const d = H.design({ corrosivityClass: 'mild', tempC: 40, hygienicRequired: false, diffPressureBar: 5, N_rpm: 80, abrasives: false, pulsationSensitive: false, Q_m3h: 5 });
  assert.strictEqual(d.applicable, true);
  assert.ok(/No single standard/.test(d.standardsBasis));
  assert.ok(d.elastomer.top);
  assert.ok(d.pressureCeiling.applicable);
  assert.ok(d.hoseLife.applicable);
  assert.ok(d.hoseBore.applicable);
});

test('design: pure function — identical input yields identical output', () => {
  const input = { corrosivityClass: 'moderate', tempC: 60, hygienicRequired: true, diffPressureBar: 4, N_rpm: 60, abrasives: true, pulsationSensitive: true, Q_m3h: 2 };
  const a = JSON.stringify(H.design(Object.assign({}, input)));
  const b = JSON.stringify(H.design(Object.assign({}, input)));
  assert.strictEqual(a, b);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
