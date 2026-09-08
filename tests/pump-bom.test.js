/* ══════════════════════════════════════════════════════════════════════
   PHASE 18 REGRESSION — lib/aro-pumpbom.js (AROPUMPBOM)

   Run:  node tests/pump-bom.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumpbom.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumpscrew.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumpgearlobe.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumphose.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumprecip.js'));
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

/* ── Pump build Step 9: buildFamilyBOM ─────────────────────────────────
   Real design() outputs from the four PD calculation modules, checked
   against the family-specific BOM rows — not the centrifugal
   impeller/API-682-seal rows, which don't apply to any of these. */
console.log('\nAROPUMPBOM.buildFamilyBOM\n');

test('buildFamilyBOM: unknown/centrifugal family returns null (caller falls back to buildBOM)', () => {
  assert.strictEqual(BOM.buildFamilyBOM('esc-oh2', {}), null);
  assert.strictEqual(BOM.buildFamilyBOM(null, {}), null);
});

test('buildFamilyBOM: screw-pump — rotor row with correct qty, timing-gear row only for twin-screw', () => {
  const screwSingle = global.AROPUMPSCREW.design({ Q_m3h: 5, N_rpm: 150, diffPressureBar: 20, viscosityCst: 50, tempC: 40, bhpKw: 10, abrasives: true });
  const rSingle = BOM.buildFamilyBOM('screw-pump', { screw: screwSingle });
  assert.strictEqual(rSingle.status, 'CALCULATED');
  assert.ok(byDesc(rSingle.rows, 'Rotor(s)'));
  assert.strictEqual(byDesc(rSingle.rows, 'Rotor(s)').qty, screwSingle.rotorConfig.top.rotors);
  assert.strictEqual(!!byDesc(rSingle.rows, 'Timing Gear'), screwSingle.rotorConfig.top.timingGears);
  assert.strictEqual(BOM.buildFamilyBOM('screw-pump', {}).status, 'DATA REQUIRED');
});

test('buildFamilyBOM: gear-lobe — sealless row reflects the real screening verdict, not a fixed choice', () => {
  const glToxic = global.AROPUMPGEARLOBE.design({ pumpTypeId: 'gear-external', Q_m3h: 20, N_rpm: 1450, diffPressureBar: 10, bhpKw: 10, hazard: 'toxic-corrosive', abrasives: false, dryRunRequired: false, viscosityCst: 50 });
  const rToxic = BOM.buildFamilyBOM('gear-external', { gearLobe: glToxic });
  assert.ok(byDesc(rToxic.rows, 'Magnetic Drive'));
  const glBenign = global.AROPUMPGEARLOBE.design({ pumpTypeId: 'gear-external', Q_m3h: 20, N_rpm: 1450, diffPressureBar: 10, bhpKw: 10, hazard: 'benign', abrasives: false, dryRunRequired: false, viscosityCst: 50 });
  const rBenign = BOM.buildFamilyBOM('gear-external', { gearLobe: glBenign });
  assert.ok(byDesc(rBenign.rows, 'Mechanical Shaft Seal'));
});

test('buildFamilyBOM: peristaltic hose — no mechanical seal row is fitted (qty 0, NOT APPLICABLE)', () => {
  const h = global.AROPUMPHOSE.design({ corrosivityClass: 'mild', tempC: 40, hygienicRequired: false, diffPressureBar: 5, N_rpm: 80, abrasives: false, pulsationSensitive: false, Q_m3h: 5 });
  const r = BOM.buildFamilyBOM('peristaltic-hose', { hose: h });
  const sealRow = byDesc(r.rows, 'Mechanical Seal');
  assert.strictEqual(sealRow.status, 'NOT APPLICABLE');
  assert.strictEqual(sealRow.qty, 0);
  assert.ok(byDesc(r.rows, 'Pump Hose'));
});

test('buildFamilyBOM: reciprocating — seal row name matches plunger packing vs piston ring/cup by type', () => {
  const rc1 = global.AROPUMPRECIP.design({ pumpTypeId: 'plunger-pump', Q_m3h: 5, N_rpm: 150, diffPressureBar: 100, numCylinders: 3, bhpKw: 20, L_m: 5, V_ms: 1, npsha_m: 8, npshr_m: 3, operatingPressureBarG: 100 });
  const r1 = BOM.buildFamilyBOM('plunger-pump', { recip: rc1 });
  assert.ok(byDesc(r1.rows, 'Packing'));
  const rc2 = global.AROPUMPRECIP.design({ pumpTypeId: 'piston-pump', Q_m3h: 5, N_rpm: 150, diffPressureBar: 100, numCylinders: 3, bhpKw: 20, L_m: 5, V_ms: 1, npsha_m: 8, npshr_m: 3, operatingPressureBarG: 100 });
  const r2 = BOM.buildFamilyBOM('piston-pump', { recip: rc2 });
  assert.ok(byDesc(r2.rows, 'Ring / Cup'));
  assert.ok(byDesc(r2.rows, 'Pulsation Dampener'));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
