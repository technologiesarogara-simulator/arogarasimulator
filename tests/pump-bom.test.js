/* ══════════════════════════════════════════════════════════════════════
   PHASE 18 REGRESSION — lib/aro-pumpbom.js (AROPUMPBOM)

   Run:  node tests/pump-bom.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpbom.js'));
const BOM = global.AROPUMPBOM;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function byDesc(rows, substr) { return rows.filter(r => r.description.indexOf(substr) !== -1)[0]; }

console.log('\nAROPUMPBOM — window.AROPUMPBOM\n');

test('buildBOM: with no phase data, returns 8 rows, all DATA REQUIRED except the baseplate', () => {
  const r = BOM.buildBOM({});
  assert.strictEqual(r.rows.length, 8);
  const withoutBaseplate = r.rows.slice(0, 7);
  withoutBaseplate.forEach(row => assert.strictEqual(row.status, 'DATA REQUIRED', row.description));
  assert.strictEqual(r.rows[7].status, 'NOT APPLICABLE');
});

test('buildBOM: item numbers are sequential starting at 1', () => {
  const r = BOM.buildBOM({});
  r.rows.forEach((row, i) => assert.strictEqual(row.itemNo, i + 1));
});

test('buildBOM: reads every material/verdict straight from the given phase results — never invents one', () => {
  const r = BOM.buildBOM({
    shapeFamily: 'radial',
    mocCasing: { applicable: true, top: { name: 'Duplex Stainless Steel', verdict: 'SUITABLE', note: 'x' } },
    mocImpeller: { applicable: true, top: { name: '316L Stainless Steel', verdict: 'CHECK', note: 'y' } },
    shaft: { applicable: true, top: { verdict: 'CHECK', materialName: 'AISI 4140', shaftDiameter_mm: 45 } },
    bearing: { applicable: true, top: { verdict: 'SUITABLE', bearingName: 'Deep-groove ball', bore_mm: 45, L10h: 32000 } },
    seal: { applicable: true, top: { id: '52', name: 'Unpressurized dual seal', verdict: 'SUITABLE', reasons: ['ok'], warnings: [] } },
    coupling: { applicable: true, top: { verdict: 'CHECK', name: 'Elastomeric' }, requiredContinuousTorque_Nm: 450, requiredPeakTorque_Nm: 750 },
    driverEnclosure: { applicable: true, hazardClass: 'flammable', top: { verdict: 'SUITABLE', name: 'Ex-e' } },
    motorKw: 30,
  });

  assert.strictEqual(byDesc(r.rows, 'Casing').material, 'Duplex Stainless Steel');
  assert.strictEqual(byDesc(r.rows, 'Casing').status, 'SUITABLE');
  assert.strictEqual(byDesc(r.rows, 'Impeller').material, '316L Stainless Steel');
  assert.strictEqual(byDesc(r.rows, 'Impeller').status, 'CHECK');
  assert.strictEqual(byDesc(r.rows, 'Shaft').material, 'AISI 4140');
  assert.strictEqual(byDesc(r.rows, 'Bearings').material, 'Deep-groove ball');
  assert.strictEqual(byDesc(r.rows, 'Bearings').qty, 2);
  const sealRow = byDesc(r.rows, 'Seal');
  assert.strictEqual(sealRow.material, 'Unpressurized dual seal');
  assert.strictEqual(sealRow.status, 'SUITABLE');
  assert.ok(sealRow.description.indexOf('Plan 52') !== -1);

  assert.strictEqual(byDesc(r.rows, 'Coupling').material, 'Elastomeric');
  assert.ok(byDesc(r.rows, 'Driver').material.indexOf('Ex-e') !== -1);
  assert.ok(byDesc(r.rows, 'Driver').description.indexOf('30.0 kW') !== -1);
});

test('buildBOM: when a Phase 22 foundation result is supplied, the baseplate row reflects it instead of the old placeholder', () => {
  const r = BOM.buildBOM({
    foundation: { items: [{ id: 'baseplate-style', status: 'PRELIMINARY ASSUMPTION', detail: 'Uses a heavy fabricated baseplate.' }] },
  });
  const bp = byDesc(r.rows, 'Baseplate');
  assert.strictEqual(bp.status, 'PRELIMINARY ASSUMPTION');
  assert.strictEqual(bp.notes, 'Uses a heavy fabricated baseplate.');
});

test('buildBOM: a close-coupled configuration reports the coupling row as NOT APPLICABLE with qty 0, not DATA REQUIRED', () => {
  const r = BOM.buildBOM({ coupling: { applicable: false, status: 'NOT APPLICABLE', reason: 'Close-coupled.' } });
  const c = byDesc(r.rows, 'Coupling');
  assert.strictEqual(c.status, 'NOT APPLICABLE');
  assert.strictEqual(c.qty, 0);
  assert.strictEqual(c.notes, 'Close-coupled.');
});

test('buildBOM: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const input = { shapeFamily: 'francis', mocCasing: { applicable: true, top: { name: 'CF8M', note: 'n' } } };
  assert.deepStrictEqual(BOM.buildBOM(input), BOM.buildBOM(input));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
