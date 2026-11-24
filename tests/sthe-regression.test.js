/* Regression checks for the STHE configuration contract. */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('app.js', 'utf8');
const industrial = fs.readFileSync('lib/aro-industrial3d.js', 'utf8');
const reference = fs.readFileSync('lib/aro-heat-exchanger-reference.js', 'utf8');
const splitter = fs.readFileSync('lib/aro-split.js', 'utf8');
const start = app.indexOf('window.stheFtLMTD = function');
const end = app.indexOf('// Draw the Ft feasibility chart', start);
assert(start >= 0 && end > start, 'STHE Ft correlation must be present');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(app.slice(start, end), context);

assert.strictEqual(context.window.stheFtLMTD(0.50, 0.36, 1, 1), 1, 'true 1-shell/1-tube-pass STHE must use its actual LMTD path');
[[0.25, 1.0, 1, 2], [0.25, 1.0, 2, 2], [0.50, 0.36, 1, 2], [0.51, 0.36, 2, 4]].forEach(([P, R, shells, tubePasses]) => {
  const ft = context.window.stheFtLMTD(P, R, shells, tubePasses);
  assert(Number.isFinite(ft) && ft > 0 && ft <= 1, `valid R/P point must calculate Ft: ${P}, ${R}, ${shells}`);
});

assert(app.includes('const Nt = Math.max(Np, Math.ceil(Nt_required / Np) * Np);'), 'tube count must be pass-balanced');
assert(app.includes('no assumed Ft has been used'), 'invalid R/P points must not receive a made-up Ft');
assert(app.includes('Nt_required') && app.includes('Nt_suggested_raw'), 'trace/report must expose thermal and selected tube counts');
assert(industrial.includes('Number(i.L_m)') && industrial.includes('Number(r.Pt_m)') && industrial.includes('shellShape: i.shellShape'), 'industrial view must use saved calculated STHE dimensions');
assert(industrial.includes('var seriesCount = Math.max(1, Math.round(d.shellPasses || 1));'), 'industrial view must render every selected shell in series');
assert(industrial.includes('var tubeOutAtFront = tubePasses % 2 === 0;'), 'industrial tube outlet must follow the selected pass parity');
assert(industrial.includes('var rearHeadEndX = L / 2 + Ds * 0.53;') && industrial.includes('var tubeOutDir = tubeOutAtFront ? new T.Vector3(0, 0, 1) : new T.Vector3(1, 0, 0);'), 'rear tube outlet must originate on and point normal to the rear-head end face');
assert(industrial.includes('function attachTubeNozzle(root, direction)') && industrial.includes('welded neck'), 'tube-side nozzles must include an attached welded collar as sizes change');
assert(industrial.includes('frontHead: i.frontHead') && industrial.includes('var channelL = headL *') && industrial.includes('var frontChannelX = -L / 2 - channelL / 2'), 'TEMA stationary-head changes must rebuild the channel and tube-nozzle root together');
assert(industrial.includes('for (var pass = 0; pass < tubePasses; pass++)'), 'industrial tube flow must traverse the selected number of passes');
assert(industrial.includes("'TUBE IN  →'"), 'industrial flow must explicitly identify its inlet direction');
assert(app.includes("U-tube bundles require an even number of tube passes"), 'U-tube pass constraint must be enforced');
assert(app.includes('window.openStheCalculationTrace = function'), 'STHE trace must expose a non-silent public opener');
assert(app.includes('const dutyTube = r.dutyTube ||'), 'STHE trace must initialize the tube-side duty record before rendering phase-aware film guidance');
assert(reference.includes('window.openHeatExchangerReference = function'), 'heat-exchanger reference must expose a non-silent public opener');
assert(app.includes('isKettleReboiler') && app.includes('baffleCutEffective'), 'kettle reboiler must not be treated as a segmental-baffle shell');
assert(reference.includes('ceil(x)') && reference.includes('What to do with a cross') && reference.includes('STHE - true 1-1'), 'reference must explain rounding, cross cases and STHE Ft basis');
assert(reference.includes("['data-tables', '15'") && reference.includes("['construction-atlas', '16'") && reference.includes("['correlations', '17'"), 'reference must expose the added data, construction and correlation sections');
assert(reference.includes('Typical overall service coefficients') && reference.includes('Fouling resistance') && reference.includes('Standard steel-tube sizes'), 'reference must include U0, fouling and tube selection tables');
assert(reference.includes('Tube pass partitions') && reference.includes('Shell-side leakage and bypass') && reference.includes('Laminar internal flow'), 'reference must include construction/flow diagrams and correlation guidance');
assert(reference.includes("['optimisation', '18'") && reference.includes('Shell ID versus bundle diameter') && reference.includes('Pull-through floating head'), 'reference must include rear-head clearance selection guidance');
assert(reference.includes('Temperature–enthalpy design map') && reference.includes('Temperature cross or F') && reference.includes('Tube OD choice'), 'reference must include temperature-profile and optimisation guidance');
assert(reference.includes('data-hex-chart-pan="left"') && reference.includes('chart.scrollBy'), 'wide reference charts must provide working left/right pan controls');
assert(reference.includes('hex-splitter') && reference.includes('data-hex-pane="nav"') && reference.includes('Shift+wheel'), 'heat-exchanger reference panes must be adjustable and support horizontal mouse navigation');
assert(splitter.includes('bindHorizontalPanning') && splitter.includes('xScrollParent') && splitter.includes('pointerdown'), 'pump and STHE reference overflow content must receive shared drag/trackpad horizontal panning');
assert(!reference.includes('idealized j / heat-transfer trend</text>') && reference.includes('hex-chart-legend'), 'reference chart labels must use an external legend rather than overlap plotted trends');
assert(app.includes('window.renderStheResponseAdvisor = function') && app.includes('relative enthalpy change / heat transferred'), 'STHE results must render live thermal/hydraulic advice and enthalpy-based phase plot');
assert(app.includes("'sthe-response-advisor'"), 'STHE reset must clear the live response advisor');
assert(app.includes('window.stheBalanceTubeVelocity = function') && app.includes('APPLY TUBE-VELOCITY BALANCE'), 'STHE must provide a direct, re-rated tube-velocity balancing action');
assert(!app.includes('${colorType} FLAG') && app.includes('DESIGN NOTICE'), 'STHE notices must not expose the old colour-flag label');

/* The Calculation toolbar and the Calculation Trace button share this
   renderer.  Execute it with a minimal saved STHE record so an undeclared
   value in a newly added trace row cannot turn both buttons into dead ends. */
const traceStart = app.indexOf('window.showStheCalculationTrace = function()');
const traceEnd = app.indexOf('  window.stheTraceMinimize', traceStart);
assert(traceStart >= 0 && traceEnd > traceStart, 'STHE trace renderer must be present');
let renderedTrace = '';
const traceContext = {
  window: { state: { sthe: { calculated: true, inputs: { shellPasses: 1, Np: 2, flowArrangement: 'counter' }, results: { dutyShell: { changing: false }, dutyTube: { changing: false }, resistances: {}, uIterations: [] } } } },
  document: { getElementById: () => null, body: { insertAdjacentHTML: (_where, html) => { renderedTrace = html; } } },
  console, alert: () => {}, isFinite, Number, Math, String
};
vm.createContext(traceContext);
vm.runInContext(app.slice(traceStart, traceEnd), traceContext);
traceContext.window.showStheCalculationTrace();
assert(renderedTrace.includes('CALCULATION TRACE'), 'minimal valid STHE record must render the calculation trace');
console.log('STHE regression: Ft, U-tube passes, kettle basis, canonical 3D inputs and reference guidance passed.');
