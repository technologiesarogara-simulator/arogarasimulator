/* Reference check on every conversion in the table. Run with:
     node lib/../scratchpad/unit_table_test.js
   It reads UNIT_CONVERSIONS straight out of app.js so it cannot drift from
   the code it is checking. */
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
let i = src.indexOf('const UNIT_CONVERSIONS = {'); i = src.indexOf('{', i);
let d = 0, j = i;
while (j < src.length) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } j++; }
const UC = eval('(' + src.slice(i, j + 1) + ')');

/* value of one SI unit expressed in the target system, with the source */
const REF = {
  temperature:      { US: [32, '0 °C = 32 °F', 0],       CGS: [273.15, '0 °C = 273.15 K', 0] },
  pressure:         { US: [14.50377, '1 bar = 14.50377 psi'], CGS: [1.019716, '1 bar = 1.019716 kg/cm²'] },
  'press-drop':     { US: [14.50377, '1 bar = 14.50377 psi'], CGS: [1.019716, '1 bar = 1.019716 kg/cm²'] },
  'press-drop-rate':{ US: [4.42075, '1 bar/100 m = 4.42075 psi/100 ft'], CGS: [1.019716, '1 bar = 1.019716 kg/cm²'] },
  'press-drop-kpa': { US: [0.1450377, '1 kPa = 0.1450377 psi'], CGS: [0.01019716, '1 kPa = 0.01019716 kg/cm²'] },
  density:          { US: [0.0624280, '1 kg/m³ = 0.062428 lb/ft³'], CGS: [0.001, '1 kg/m³ = 0.001 g/cm³'] },
  viscosity:        { US: [1, 'cP in both'], CGS: [1, 'cP in both'] },
  'mass-flow':      { US: [2.204623, '1 kg/hr = 2.204623 lb/hr'], CGS: [0.2777778, '1 kg/hr = 0.27778 g/s'] },
  'mass-flow-s':    { US: [2.204623, '1 kg/s = 2.204623 lb/s'], CGS: [1000, '1 kg/s = 1000 g/s'] },
  'vol-flow':       { US: [4.402868, '1 m³/hr = 4.402868 GPM'], CGS: [16.66667, '1 m³/hr = 16.6667 L/min'] },
  'length-m':       { US: [3.280840, '1 m = 3.28084 ft'], CGS: [100, '1 m = 100 cm'] },
  'length-mm':      { US: [0.0393701, '1 mm = 0.0393701 in'], CGS: [1, 'mm in both'] },
  velocity:         { US: [3.280840, '1 m/s = 3.28084 ft/s'], CGS: [1, 'm/s in both'] },
  'vol-flow-lhr':   { US: [0.004402868, '1 l/hr = 0.0044029 US gpm'], CGS: [0.01666667, '1 l/hr = 1/60 L/min'] },
  volume:           { US: [35.31467, '1 m³ = 35.31467 ft³'], CGS: [1, 'm³ in both'] },
  mass:             { US: [2.204623, '1 kg = 2.204623 lb'], CGS: [1000, '1 kg = 1000 g'] },
  stress:           { US: [145.0377, '1 MPa = 145.0377 psi'], CGS: [10.19716, '1 MPa = 10.19716 kg/cm²'] },
  power:            { US: [1.341022, '1 kW = 1.341022 HP'], CGS: [1, 'kW in both — a motor is rated in kW'] },
  'heat-duty':      { US: [3412.142, '1 kW = 3412.142 BTU/hr'], CGS: [859.845, '1 kW = 859.845 kcal/hr (IT calorie)'] },
  cp:               { US: [0.2388459, '1 kJ/kg·K = 0.2388459 BTU/lb·°F'], CGS: [0.2388459, '1 kJ/kg·K = 0.2388459 cal/g·°C'] },
  'thermal-cond':   { US: [0.5777893, '1 W/m·K = 0.5777893 BTU/hr·ft·°F'], CGS: [0.8598452, '1 W/m·K = 0.8598452 kcal/hr·m·°C'] },
  htc:              { US: [0.1761102, '1 W/m²K = 0.1761102 BTU/hr·ft²·°F'], CGS: [0.8598452, '1 W/m²K = 0.8598452 kcal/hr·m²·°C'] },
  fouling:          { US: [5.678263, '1 m²K/W = 5.678263 hr·ft²·°F/BTU — the reciprocal of htc'], CGS: [1.163000, '1 m²K/W = 1.163 hr·m²·°C/kcal — the reciprocal of htc'] },
  area:             { US: [10.76391, '1 m² = 10.76391 ft²'], CGS: [1, 'm² in both'] },
  'temp-diff':      { US: [1.8, '1 °C interval = 1.8 °F'], CGS: [1, 'K interval = °C interval'] }
};

let checked = 0, bad = 0, missing = [];
Object.keys(UC).forEach(function (t) {
  if (!REF[t]) { missing.push(t); return; }
  ['US', 'CGS'].forEach(function (sys) {
    const [exp, note, probe] = REF[t][sys];
    const at = (probe === 0) ? 0 : 1;
    const got = UC[t].fromSI(at, sys);
    const ok = Math.abs(got - exp) < Math.max(1e-9, Math.abs(exp) * 0.0005);
    const rt = UC[t].toSI(UC[t].fromSI(7.3, sys), sys);
    const rtOk = Math.abs(rt - 7.3) < 1e-9;
    checked++;
    if (!ok || !rtOk) {
      bad++;
      console.log('WRONG ' + t + ' [' + sys + '] got ' + got + ' expected ' + exp + (rtOk ? '' : ' + ROUND-TRIP FAIL') + '  (' + note + ')');
    }
  });
});
if (missing.length) console.log('NO REFERENCE FOR: ' + missing.join(', '));
console.log(checked + ' conversions checked against reference values, ' + bad + ' wrong');
process.exit(bad ? 1 : 0);
