/* ══════════════════════════════════════════════════════════════════════
   PHASE 16 REGRESSION — lib/aro-pumptwin.js (AROPUMPTWIN)

   Run:  node tests/pump-twin.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'lib', 'aro-pumptwin.js'));
const TWIN = global.AROPUMPTWIN;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function byId(list, id) { return list.filter(c => c.id === id)[0]; }

console.log('\nAROPUMPTWIN — window.AROPUMPTWIN\n');

const EXPECTED_IDS = ['impeller', 'casing', 'shaft', 'bearings', 'seal', 'coupling', 'driver', 'baseplate'];

test('buildComponentManifest: with no phase data at all, returns all 8 components as DATA REQUIRED (except baseplate, which is structural)', () => {
  const list = TWIN.buildComponentManifest({});
  assert.strictEqual(list.length, EXPECTED_IDS.length);
  EXPECTED_IDS.forEach(id => assert.ok(byId(list, id), 'missing component ' + id));
  ['impeller', 'casing', 'shaft', 'bearings', 'seal', 'coupling', 'driver'].forEach(id => {
    assert.strictEqual(byId(list, id).verdict, 'DATA REQUIRED', id + ' should be DATA REQUIRED with no input');
  });
  assert.strictEqual(byId(list, 'baseplate').verdict, 'NOT APPLICABLE');
});

test('buildComponentManifest: never invents a verdict — every populated component reads its verdict/status straight from the given phase result', () => {
  const list = TWIN.buildComponentManifest({
    impeller: { applicable: true, status: 'PRELIMINARY ASSUMPTION', shapeFamily: 'radial', Ns: 1800, D2_m: 0.25, beta2Deg: 22.5, U2_ms: 18.2 },
    casing: { applicable: true, shapeFamily: 'radial', volute: { Vth_ms: 9.1 }, cutwater: { casingID_mm: 280 }, pressureClass: { cls: 'CL150', designPressBarG: 12.4 } },
    shaft: { applicable: true, top: { verdict: 'CHECK', materialName: 'AISI 4140', shaftDiameter_mm: 45, deflection_mm: 0.06, deflectionVerdict: 'CHECK', firstCriticalSpeed_rpm: 4200, criticalSpeedRatio: 1.4, criticalVerdict: 'SUITABLE' } },
    bearing: { applicable: true, top: { verdict: 'SUITABLE', bearingName: 'Deep-groove ball', bore_mm: 45, L10h: 32000, P_N: 5200 } },
    seal: { applicable: true, hazard: 'flammable', top: { verdict: 'SUITABLE', id: '52', name: 'Unpressurized dual seal' } },
    coupling: { applicable: true, top: { verdict: 'CHECK', name: 'Elastomeric' }, requiredContinuousTorque_Nm: 450, requiredPeakTorque_Nm: 750 },
    driverEnclosure: { applicable: true, hazardClass: 'flammable', top: { verdict: 'SUITABLE', name: 'Ex-e' } },
  });

  assert.strictEqual(byId(list, 'impeller').verdict, 'PRELIMINARY ASSUMPTION');
  assert.strictEqual(byId(list, 'casing').verdict, 'CL150');
  assert.strictEqual(byId(list, 'shaft').verdict, 'CHECK');
  assert.strictEqual(byId(list, 'bearings').verdict, 'SUITABLE');
  assert.strictEqual(byId(list, 'seal').verdict, 'SUITABLE');
  assert.strictEqual(byId(list, 'coupling').verdict, 'CHECK');
  assert.strictEqual(byId(list, 'driver').verdict, 'SUITABLE');

  // spot-check that the actual figures are threaded through into the lines, not re-derived
  assert.ok(byId(list, 'shaft').lines.some(l => l.indexOf('45.0 mm') !== -1));
  assert.ok(byId(list, 'bearings').lines.some(l => l.indexOf('32,000 h') !== -1));
  assert.ok(byId(list, 'coupling').lines.some(l => l.indexOf('450') !== -1));
});

test('buildComponentManifest: when a Phase 22 foundation result is supplied, the baseplate component reflects it instead of the old placeholder', () => {
  const withFoundation = TWIN.buildComponentManifest({
    foundation: { items: [{ id: 'baseplate-style', status: 'PRELIMINARY ASSUMPTION', detail: 'Uses a common fabricated baseplate.' }] },
  });
  const bp = byId(withFoundation, 'baseplate');
  assert.strictEqual(bp.verdict, 'PRELIMINARY ASSUMPTION');
  assert.strictEqual(bp.lines[0], 'Uses a common fabricated baseplate.');

  const withoutFoundation = TWIN.buildComponentManifest({});
  assert.strictEqual(byId(withoutFoundation, 'baseplate').verdict, 'NOT APPLICABLE');
});

test('buildComponentManifest: coupling reports NOT APPLICABLE (not DATA REQUIRED) for a close-coupled configuration', () => {
  const list = TWIN.buildComponentManifest({
    coupling: { applicable: false, status: 'NOT APPLICABLE', reason: 'This configuration is close-coupled.' },
  });
  const c = byId(list, 'coupling');
  assert.strictEqual(c.verdict, 'NOT APPLICABLE');
  assert.strictEqual(c.lines[0], 'This configuration is close-coupled.');
});

test('buildComponentManifest: every component color comes from the shared STATUS_COLOR table and is a valid hex string', () => {
  const list = TWIN.buildComponentManifest({
    shaft: { applicable: true, top: { verdict: 'NOT RECOMMENDED', materialName: 'x', shaftDiameter_mm: 10, deflection_mm: 0.2, deflectionVerdict: 'NOT RECOMMENDED', firstCriticalSpeed_rpm: 1000, criticalSpeedRatio: 0.5, criticalVerdict: 'CHECK' } },
  });
  list.forEach(c => assert.ok(/^#[0-9a-f]{6}$/i.test(c.color), c.id + ' has an invalid color ' + c.color));
  assert.strictEqual(byId(list, 'shaft').color, TWIN.STATUS_COLOR['NOT RECOMMENDED']);
});

test('buildComponentManifest: a DATA REQUIRED component carries the upstream reason string through untouched', () => {
  const list = TWIN.buildComponentManifest({
    impeller: { applicable: false, status: 'DATA REQUIRED', reason: 'Head and pump speed are not available yet.' },
  });
  assert.strictEqual(byId(list, 'impeller').lines[0], 'Head and pump speed are not available yet.');
});

test('buildComponentManifest: is a pure function — calling it twice with the same input yields deep-equal output', () => {
  const input = { impeller: { applicable: true, status: 'PREDICTED', shapeFamily: 'francis', Ns: 2200, D2_m: 0.3, beta2Deg: 25, U2_ms: 20 } };
  assert.deepStrictEqual(TWIN.buildComponentManifest(input), TWIN.buildComponentManifest(input));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
