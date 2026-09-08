/* ══════════════════════════════════════════════════════════════════════
   PUMP BUILD STEP 8 (part A) REGRESSION — lib/aro-pumpfamilydwg.js
   2D schematic registrations against the real ARODWG kit + real design()
   outputs from the four PD family calculation modules.

   Run:  node tests/pump-familydwg.test.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');

global.window = global;
global.document = {
  readyState: 'complete',
  getElementById: function () { return null; },
  createElement: function () { return { setAttribute: function () {}, appendChild: function () {} }; },
  head: { appendChild: function () {} },
  documentElement: { appendChild: function () {} },
  addEventListener: function () {},
};

require(path.join(__dirname, '..', 'lib', 'aro-drawing.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumpscrew.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumpgearlobe.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumphose.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumprecip.js'));
require(path.join(__dirname, '..', 'lib', 'aro-pumpfamilydwg.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  OK   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.stack.split('\n').slice(0, 3).join('\n       ')); }
}

console.log('\naro-pumpfamilydwg.js — window.ARODWG registrations\n');

function setBaseCalc(overrides) {
  window.state = { pump: Object.assign({
    calculated: true,
    inputs: { pumpTag: 'P-201' },
    results: { designVolFlow: 20, pumpDp: 15, stdMotorKw: 22, pumpSpeedRpm: 1450 },
  }, overrides || {}) };
}

test('pump-screw: registered, null before calculation, real SVG after', () => {
  window.pumpAdvancedState = {};
  window.state = { pump: { calculated: false } };
  assert.strictEqual(window.ARODWG.has('pump-screw'), true);
  assert.strictEqual(window.ARODWG.svgFor('pump-screw'), null);

  setBaseCalc();
  window.pumpAdvancedState.screw = global.AROPUMPSCREW.design({
    Q_m3h: 20, N_rpm: 1450, diffPressureBar: 15, viscosityCst: 40, tempC: 50, bhpKw: 22,
    abrasives: false, shearSensitive: false,
  });
  const svg = window.ARODWG.svgFor('pump-screw');
  assert.ok(svg && svg.indexOf('<svg') !== -1);
  assert.ok(svg.indexOf('ROTOR OD') !== -1);
});

test('pump-screw: null again if the screw result is not applicable', () => {
  setBaseCalc();
  window.pumpAdvancedState = { screw: { applicable: false } };
  assert.strictEqual(window.ARODWG.svgFor('pump-screw'), null);
});

test('pump-gearlobe: registered, real SVG for each of the three pump types', () => {
  setBaseCalc();
  ['gear-external', 'gear-internal', 'lobe-rotary'].forEach(function (typeId) {
    window.pumpAdvancedState = {};
    window.pumpAdvancedState.gearLobe = global.AROPUMPGEARLOBE.design({
      pumpTypeId: typeId, Q_m3h: 20, N_rpm: 1450, diffPressureBar: 10, bhpKw: 10,
      hazard: 'benign', abrasives: false, dryRunRequired: false, viscosityCst: 50,
    });
    const svg = window.ARODWG.svgFor('pump-gearlobe');
    assert.ok(svg && svg.indexOf('<svg') !== -1, typeId + ' should draw');
    assert.ok(svg.indexOf('FACE WIDTH') !== -1, typeId);
  });
});

test('pump-hose: registered, null before calculation, real SVG after', () => {
  window.pumpAdvancedState = {};
  assert.strictEqual(window.ARODWG.svgFor('pump-hose'), null);
  setBaseCalc();
  window.pumpAdvancedState.hose = global.AROPUMPHOSE.design({
    corrosivityClass: 'mild', tempC: 40, hygienicRequired: false, diffPressureBar: 5, N_rpm: 80,
    abrasives: false, pulsationSensitive: true, Q_m3h: 5,
  });
  const svg = window.ARODWG.svgFor('pump-hose');
  assert.ok(svg && svg.indexOf('<svg') !== -1);
  assert.ok(svg.indexOf('HOSE (WETTED PART)') !== -1);
});

test('pump-recip: registered, null before calculation, real SVG after for both seal types', () => {
  setBaseCalc();
  ['plunger-pump', 'piston-pump'].forEach(function (typeId) {
    window.pumpAdvancedState = {};
    window.pumpAdvancedState.recip = global.AROPUMPRECIP.design({
      pumpTypeId: typeId, Q_m3h: 5, N_rpm: 150, diffPressureBar: 100, numCylinders: 3, bhpKw: 20,
      L_m: 5, V_ms: 1, npsha_m: 8, npshr_m: 3, operatingPressureBarG: 100, allowablePulsationPct: 5,
    });
    const svg = window.ARODWG.svgFor('pump-recip');
    assert.ok(svg && svg.indexOf('<svg') !== -1, typeId);
    assert.ok(svg.indexOf('STROKE') !== -1, typeId);
  });
});

test('all four new drawings carry the NOT FOR FABRICATION stamp (shared sheet(), not bypassed)', () => {
  setBaseCalc();
  window.pumpAdvancedState = {
    screw: global.AROPUMPSCREW.design({ Q_m3h: 20, N_rpm: 1450, diffPressureBar: 15, viscosityCst: 40, tempC: 50, bhpKw: 22, abrasives: false, shearSensitive: false }),
  };
  const svg = window.ARODWG.svgFor('pump-screw');
  assert.ok(/NOT FOR FABRICATION/.test(svg));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
