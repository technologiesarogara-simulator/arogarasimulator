/* Regression checks for the STHE configuration contract. */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('app.js', 'utf8');
const industrial = fs.readFileSync('lib/aro-industrial3d.js', 'utf8');
const reference = fs.readFileSync('lib/aro-heat-exchanger-reference.js', 'utf8');
const start = app.indexOf('window.stheFtLMTD = function');
const end = app.indexOf('// Draw the Ft feasibility chart', start);
assert(start >= 0 && end > start, 'STHE Ft correlation must be present');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(app.slice(start, end), context);

[[0.25, 1.0, 1], [0.25, 1.0, 2], [0.50, 0.36, 1], [0.51, 0.36, 2]].forEach(([P, R, shells]) => {
  const ft = context.window.stheFtLMTD(P, R, shells);
  assert(Number.isFinite(ft) && ft > 0 && ft <= 1, `valid R/P point must calculate Ft: ${P}, ${R}, ${shells}`);
});

assert(app.includes('const Nt = Math.max(Np, Math.ceil(Nt_required / Np) * Np);'), 'tube count must be pass-balanced');
assert(app.includes('no assumed Ft has been used'), 'invalid R/P points must not receive a made-up Ft');
assert(app.includes('Nt_required') && app.includes('Nt_suggested_raw'), 'trace/report must expose thermal and selected tube counts');
assert(industrial.includes('Number(i.L_m)') && industrial.includes('Number(r.Pt_m)') && industrial.includes('shellShape: i.shellShape'), 'industrial view must use saved calculated STHE dimensions');
assert(industrial.includes('var seriesCount = Math.max(1, Math.round(d.shellPasses || 1));'), 'industrial view must render every selected shell in series');
assert(reference.includes('ceil(x)') && reference.includes('What to do with a cross') && reference.includes('STHE</td><td>Calculate from'), 'reference must explain rounding, cross cases and STHE Ft basis');
console.log('STHE regression: Ft, tube passes, canonical 3D inputs and reference guidance passed.');
