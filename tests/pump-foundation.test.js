/* ══════════════════════════════════════════════════════════════════════
   PHASE 22 REGRESSION — lib/aro-pumpfoundation.js (AROPUMPFOUNDATION)

   Run:  node tests/pump-foundation.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpfoundation.js'));
const FND = global.AROPUMPFOUNDATION;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function byId(items, id) { return items.filter(i => i.id === id)[0]; }

console.log('\nAROPUMPFOUNDATION — window.AROPUMPFOUNDATION\n');

test('buildFoundationDesign: with no input, all 4 items are DATA REQUIRED', () => {
  const r = FND.buildFoundationDesign({});
  assert.strictEqual(r.items.length, 4);
  r.items.forEach(it => assert.strictEqual(it.status, 'DATA REQUIRED', it.label));
});

test('buildFoundationDesign: a non-baseplate mounting (e.g. pipe-mounted) reports all 4 items NOT APPLICABLE, never DATA REQUIRED', () => {
  const r = FND.buildFoundationDesign({
    configResult: { applicable: true, top: { id: 'OH3', baseplateStyle: 'none — pipe-mounted' } },
  });
  r.items.forEach(it => assert.strictEqual(it.status, 'NOT APPLICABLE', it.label));
});

test('buildFoundationDesign: a genuine baseplate configuration reports the real style and RECOMMENDED grout guidance', () => {
  const r = FND.buildFoundationDesign({
    configResult: { applicable: true, top: { id: 'OH2', baseplateStyle: 'common fabricated baseplate' } },
  });
  const style = byId(r.items, 'baseplate-style');
  assert.strictEqual(style.status, 'PRELIMINARY ASSUMPTION');
  assert.ok(style.detail.indexOf('common fabricated baseplate') !== -1);
  assert.ok(style.detail.indexOf('OH2') !== -1);
  assert.strictEqual(byId(r.items, 'grout-thickness').status, 'RECOMMENDED');
});

test('buildFoundationDesign: foundation mass NEVER invents a number — always DATA REQUIRED for an actual baseplate config, but states the correct ratio', () => {
  const centrifugal = FND.buildFoundationDesign({
    configResult: { applicable: true, top: { id: 'OH2', baseplateStyle: 'common fabricated baseplate' } },
    topFamilyCategory: 'radial-centrifugal',
  });
  const massC = byId(centrifugal.items, 'foundation-mass');
  assert.strictEqual(massC.status, 'DATA REQUIRED');
  assert.ok(massC.detail.indexOf('3x') !== -1);

  const pd = FND.buildFoundationDesign({
    configResult: { applicable: true, top: { id: 'RP1', baseplateStyle: 'common fabricated baseplate' } },
    topFamilyCategory: 'pd-reciprocating',
  });
  const massPd = byId(pd.items, 'foundation-mass');
  assert.strictEqual(massPd.status, 'DATA REQUIRED');
  assert.ok(massPd.detail.indexOf('5x') !== -1);
  assert.notStrictEqual(massC.detail, massPd.detail);
});

test('buildFoundationDesign: anchor bolts also stay DATA REQUIRED for a real baseplate config, citing embedment practice rather than a size', () => {
  const r = FND.buildFoundationDesign({
    configResult: { applicable: true, top: { id: 'OH2', baseplateStyle: 'common fabricated baseplate' } },
  });
  const bolts = byId(r.items, 'anchor-bolts');
  assert.strictEqual(bolts.status, 'DATA REQUIRED');
  assert.ok(bolts.detail.indexOf('20-25x') !== -1);
});

test('buildFoundationDesign: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const input = { configResult: { applicable: true, top: { id: 'BB1', baseplateStyle: 'heavy fabricated baseplate' } }, topFamilyCategory: 'radial-centrifugal' };
  assert.deepStrictEqual(FND.buildFoundationDesign(input), FND.buildFoundationDesign(input));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
