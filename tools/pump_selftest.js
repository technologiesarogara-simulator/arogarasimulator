/* ══════════════════════════════════════════════════════════════════════
   PUMP HYDRAULICS — END-TO-END SELF TEST

   Serve dist/ on :8765, then:  node tools/pump_selftest.js

   Checks, in order:
     1  hand calculation, first principles, every quantity
     2  nozzle selection tracks the duty across four decades of flow
     3  standards checks fire and report against their clauses
     4  unit systems change presentation only
     5  the schematic never overlaps its own labels
     6  the report exports and paginates
   ══════════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = process.env.URL || 'http://localhost:8765/index.html';
let pass = 0, fail = 0;
const ok = (name, good, detail) => { good ? pass++ : fail++; console.log((good ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : '')); };
const near = (a, b, tol) => isFinite(a) && isFinite(b) && Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * (tol == null ? 0.002 : tol));

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(URL);
  await pg.evaluate(() => localStorage.setItem('aro_session_v1', JSON.stringify({ name: 'T', email: 't@e.com', ts: Date.now() })));
  await pg.reload(); await pg.waitForTimeout(4000);

  const setDuty = (d) => pg.evaluate(async (d) => {
    const nav = [...document.querySelectorAll('.nav-tab')].find(e => /PUMP SIZING/.test(e.textContent)); nav.click();
    await new Promise(r => setTimeout(r, 300));
    const set = (id, v) => {
      /* The suction/discharge loss basis is a radio in the DP table now, not
         a checkbox. Keep the old key working so the tests read the same. */
      if (id === 'suc-line-calc' || id === 'dis-line-calc') {
        const side = id.slice(0, 3);
        const want = v ? 'calc' : 'normal';
        const r = document.querySelector(`input[name="${side}-dp-radio"][value="${want}"]`);
        if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
        return;
      }
      const e = document.getElementById(id);
      if (e) { if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    Object.keys(d).forEach(k => set(k, d[k]));
    const b = [...document.querySelectorAll('button')].find(x => /RUN|CALCULAT/i.test(x.textContent)); if (b) b.click();
    await new Promise(r => setTimeout(r, 2300));
    return { i: window.state.pump.inputs, r: window.state.pump.results };
  }, d);

  console.log('\n1 · HAND CALCULATION — water 25 °C, 200 m³/hr +10 %, LLL 4.2 m, CL 0.5 m, disch 25 m to 4 barg');
  const S = await setDuty({ 'pump-fluid': 'water', 'pump-temp-op': 25, 'pump-vol-flow-lhr': 200000, 'pump-margin': 10,
    'pump-vessel-el': 3, 'pump-lll': 50, 'pump-centreline-el': 0.5, 'pump-vessel-press-g': 0,
    'pump-discharge-el': 25, 'pump-dest-a': 4, 'pump-npshr': 10 });
  const g = 9.81, rho = S.i.rho, Q = S.r.designVolFlow / 3600;
  const pvap = Math.pow(10, 8.07131 - 1730.630 / (233.426 + 25)) * 1.01325 / 760;
  const Hs = S.i.lll - S.i.zPump;
  const pSucA = 1.01325 + rho * g * Hs / 1e5 - S.i.sucDp;
  const npsha = (pSucA * 1e5 - pvap * 1e5) / (rho * g);
  const pDisG = S.i.destA + rho * g * (S.i.zDisch - S.i.zPump) / 1e5 + S.i.dischDp;
  const H = ((pDisG + 1.01325) - pSucA) * 1e5 / (rho * g);
  const Ph = rho * g * Q * H / 1000, bhp = Ph / (S.r.pumpEffVisc / 100);
  ok('vapour pressure  (Antoine, Perry T2-8)', near(S.i.pVapBarA, pvap, 0.01), S.i.pVapBarA.toFixed(5) + ' vs ' + pvap.toFixed(5) + ' bar A');
  ok('static head      Hs = LLL − CL', near(S.r.Hs, Hs), S.r.Hs.toFixed(4) + ' m');
  ok('suction pressure P_suc(A)', near(S.r.pSucA, pSucA), S.r.pSucA.toFixed(5) + ' bar A');
  ok('NPSHa            h_suc − h_vap', near(S.r.npsha, npsha), S.r.npsha.toFixed(4) + ' vs ' + npsha.toFixed(4) + ' m');
  ok('discharge press  dest + static + line', near(S.r.pDischG, pDisG), S.r.pDischG.toFixed(4) + ' barg');
  ok('differential head', near(S.r.diffHeadCal, H), S.r.diffHeadCal.toFixed(4) + ' vs ' + H.toFixed(4) + ' m');
  ok('hydraulic power  ρgQH', near(S.r.hydPower, Ph), S.r.hydPower.toFixed(4) + ' kW');
  ok('brake power      P/η', near(S.r.bhp, bhp), S.r.bhp.toFixed(4) + ' kW');
  ok('motor is an IEC 60072 rating', [0.75,1.1,1.5,2.2,3,4,5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110,132,160,200,250,315,355,400,450,500,560,630,710,800,900,1000].indexOf(S.r.stdMotorKw) >= 0, S.r.stdMotorKw + ' kW');
  ok('lift measured from the pump centreline, not grade',
     near(S.r.pDischG, S.i.destA + rho * g * (S.i.zDisch - S.i.zPump) / 1e5 + S.i.dischDp));

  console.log('\n2 · NOZZLE SELECTION vs DUTY');
  const NZ = [];
  for (const lhr of [5, 500, 5000, 50000, 200000, 800000, 2000000]) {
    const r = await setDuty({ 'pump-vol-flow-lhr': lhr, 'pump-margin': 0 });
    NZ.push({ lhr, q: r.r.designVolFlow, suc: r.r.sucNozzle.nps, vs: r.r.velSuc, dis: r.r.disNozzle.nps, vd: r.r.velDis, id: r.r.sucNozzle.id });
  }
  NZ.forEach(n => console.log('        ' + String(n.q.toFixed(2)).padStart(9) + ' m³/hr →  suction ' + String(n.suc).padStart(5) + ' @ ' + n.vs.toFixed(2) + ' m/s   discharge ' + String(n.dis).padStart(5) + ' @ ' + n.vd.toFixed(2) + ' m/s'));
  ok('selection is monotonic in flow', NZ.every((n, i) => i === 0 || n.id >= NZ[i - 1].id));
  ok('velocity never exceeds its target (bar the table limit)', NZ.slice(0, -1).every(n => n.vs <= 2.0 * 1.02));
  ok('suction is never smaller than discharge', NZ.every(n => n.vs <= n.vd + 1e-9));

  console.log('\n3 · STANDARDS CHECKS');
  const ST = await setDuty({ 'pump-fluid': 'caustic_50', 'pump-temp-op': 25, 'pump-vol-flow-lhr': 60000, 'pump-margin': 10, 'pump-speed': 1450, 'pump-npshr': 20 });
  const chk = ST.r.stdChecks || [];
  ok('every clause reports', chk.length >= 9, chk.length + ' checks');
  ok('API 610 §6.1.6 NPSH margin rule applied', chk.some(c => /6\.1\.6/.test(c.clause)), 'required ' + (ST.r.npshReq || 0).toFixed(2) + ' m, actual ' + (ST.r.npshMargin || 0).toFixed(2) + ' m');
  ok('API 610 §6.1.7 Nss computed', isFinite(ST.r.Nss), 'Nss ' + Math.round(ST.r.Nss));
  ok('API 610 §6.1.11 MCSF computed', isFinite(ST.r.mcsfFlow), ST.r.mcsfFlow.toFixed(1) + ' m³/hr');
  ok('ANSI/HI 9.6.7 correction applied to a viscous duty', ST.r.pumpEffVisc < ST.r.pumpEffWater, ST.r.pumpEffWater.toFixed(1) + ' % → ' + ST.r.pumpEffVisc.toFixed(1) + ' % at ' + ST.r.nu_cSt.toFixed(1) + ' cSt');
  ok('water-equivalent duty reported for the enquiry', isFinite(ST.r.eqWaterQ) && ST.r.eqWaterQ > ST.r.designVolFlow, ST.r.eqWaterQ.toFixed(1) + ' m³/hr at ' + ST.r.eqWaterH.toFixed(1) + ' m');
  const W = await setDuty({ 'pump-fluid': 'water', 'pump-temp-op': 25, 'pump-vol-flow-lhr': 200000 });
  ok('no correction on a thin liquid', W.r.pumpEffVisc === W.r.pumpEffWater, 'ν ' + W.r.nu_cSt.toFixed(2) + ' cSt');

  console.log('\n4 · UNIT SYSTEMS CHANGE PRESENTATION ONLY');
  const base = await setDuty({ 'pump-fluid': 'water', 'pump-temp-op': 25, 'pump-vol-flow-lhr': 200000, 'pump-npshr': 20 });
  const keys = ['npsha', 'diffHeadCal', 'bhp', 'stdMotorKw', 'velSuc', 'velDis', 'pDischG', 'Hs'];
  for (const sys of ['US', 'CGS']) {
    const now = await pg.evaluate(async (sys) => {
      const s = document.getElementById('global-unit-system'); s.value = sys; s.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 3000));
      const el = document.getElementById('out-pump-npshr-val') || document.getElementById('out-pump-npshr-display');
      return { r: window.state.pump.results, npshrShown: el ? parseFloat(el.textContent) : NaN, i: window.state.pump.inputs };
    }, sys);
    ok(sys + ' — engine results unchanged', keys.every(k => near(base.r[k], now.r[k])),
       keys.filter(k => !near(base.r[k], now.r[k])).join(',') || 'all ' + keys.length + ' identical');
    const f = sys === 'US' ? 3.28084 : 100;
    ok(sys + ' — NPSHr displayed correctly', near(now.npshrShown, base.i.npshr * f, 0.005),
       base.i.npshr + ' m shown as ' + now.npshrShown + ' (expected ' + (base.i.npshr * f).toFixed(2) + ')');
    await pg.evaluate(async () => { const s = document.getElementById('global-unit-system'); s.value = 'SI'; s.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 2400)); });
  }

  console.log('\n4b · PUMP CURVE, NPSHr AND EFFICIENCY PREDICTION');
  const C1 = await setDuty({ 'pump-fluid': 'water', 'pump-temp-op': 25, 'pump-vol-flow-lhr': 200000, 'pump-margin': 10,
    'pump-vessel-el': 3, 'pump-lll': 50, 'pump-centreline-el': 0.5, 'pump-discharge-el': 25, 'pump-dest-a': 4,
    'pump-speed': 1450, 'pump-npshr': '', 'pump-npshr-vendor': '', 'pump-nss-design': 9000, 'pump-rated-pct-bep': 100 });
  const Qg = C1.r.designVolFlow * 4.402868, ftPred = C1.r.predNpshr * 3.280840;
  ok('NPSHr predicted back-calculates to the design Nss',
     near(1450 * Math.sqrt(Qg) / Math.pow(ftPred, 0.75), 9000, 0.005),
     C1.r.predNpshr.toFixed(3) + ' m from Nss 9000');
  ok('predicted NPSHr is the one in force when nothing is entered', near(C1.i.npshr, C1.r.predNpshr), C1.r.npshrSource);
  ok('efficiency predicted from flow and specific speed', C1.r.predEff > 40 && C1.r.predEff < 92, C1.r.predEff.toFixed(1) + ' %');
  ok('curve has ' + (C1.r.curvePoints || []).length + ' points', (C1.r.curvePoints || []).length > 20);
  ok('head falls continuously to shut-off (API 610 §6.1.11)',
     (C1.r.curvePoints || []).every((p, i, a2) => i === 0 || p.h <= a2[i - 1].h + 1e-9),
     'shut-off rise ' + ((C1.r.curveShutoff - 1) * 100).toFixed(0) + ' %');
  ok('shut-off rise inside the 5–20 % the code expects', C1.r.curveShutoff >= 1.05 && C1.r.curveShutoff <= 1.20);
  ok('NPSHr rises with flow', (C1.r.curvePoints || []).every((p, i, a2) => i === 0 || p.n >= a2[i - 1].n - 1e-9));
  const V = await setDuty({ 'pump-npshr-vendor': 6.5 });
  ok('a vendor NPSHr overrides the prediction', near(V.i.npshr, 6.5) && /vendor/.test(V.r.npshrSource), V.r.npshrSource);
  const OFF = await setDuty({ 'pump-npshr-vendor': '', 'pump-rated-pct-bep': 125 });
  ok('rated point outside 80–110 % of BEP is flagged',
     (OFF.r.stdChecks || []).some(c => c.key === 'rated-bep' && !c.ok), '125 % of BEP');
  const BACK = await setDuty({ 'pump-rated-pct-bep': 100 });
  ok('rated point inside the band passes', (BACK.r.stdChecks || []).some(c => c.key === 'rated-bep' && c.ok));

  console.log('\n4c · LINE LOSS FROM THE PIPING');
  const L0 = await setDuty({ 'suc-line-calc': false, 'dis-line-calc': false });
  const L1 = await setDuty({ 'suc-line-nps': 8, 'suc-line-sch': '40', 'suc-line-len': 30,
    'suc-line-elbow': 4, 'suc-line-gate': 1, 'suc-line-check': 0, 'suc-line-calc': true });
  const D = 0.20272, A = Math.PI / 4 * D * D, v = (L1.r.designVolFlow / 3600) / A;
  const Re = L1.i.rho * v * D / (L1.i.mu / 1000);
  const f = 1.3255 / Math.pow(Math.log(0.045 / (3.7 * 202.72) + 5.74 / Math.pow(Re, 0.9)), 2);
  const dp = (f * 30 / D + (4 * 0.30 + 0.15 + 0.50)) * 0.5 * L1.i.rho * v * v / 1e5;
  ok('suction loss matches Darcy–Weisbach by hand', near(L1.i.sucDp, dp, 0.001), L1.i.sucDp.toFixed(5) + ' vs ' + dp.toFixed(5) + ' bar');
  ok('the ΔP table governs until "calculated" is picked', L0.i.sucDp !== L1.i.sucDp, L0.i.sucDp + ' → ' + L1.i.sucDp.toFixed(5));
  const L2 = await setDuty({ 'suc-line-nps': 4 });
  ok('a smaller suction bore costs NPSHa', L2.r.npsha < L1.r.npsha, L1.r.npsha.toFixed(2) + ' → ' + L2.r.npsha.toFixed(2) + ' m');
  await setDuty({ 'suc-line-nps': 8, 'suc-line-calc': false, 'dis-line-calc': false });

  console.log('\n4d · NO SI UNITS LEAK INTO A US-UNITS VIEW');
  /* Every previous unit bug was the same shape: a number converted while the
     unit written beside it did not. This walks the rendered output, the chart
     configuration and the report in US customary and looks for any SI unit
     still attached to a number. The manual is excluded — it is prose about
     the unit systems and names them all deliberately. */
  await setDuty({ 'pump-fluid': 'water', 'pump-temp-op': 25, 'pump-vol-flow-lhr': 200000,
                  'pump-npshr': 5, 'pump-discharge-el': 25, 'pump-dest-a': 4 });
  await pg.evaluate(async () => {
    const s = document.getElementById('global-unit-system');
    s.value = 'US'; s.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 3200));
  });
  const leak = await pg.evaluate(() => {
    const SI = /(\d)\s*(m³\/hr|kg\/hr|l\/hr|L\/min|kg\/cm²|m\/s|kW|\bbar\b|\bcm\b|\bmm\b|\bm\b)(?![a-z])/g;
    const found = [];
    const scan = (where, text) => {
      if (!text) return;
      let m; SI.lastIndex = 0;
      while ((m = SI.exec(text)) !== null) {
        found.push(where + ': …' + text.slice(Math.max(0, m.index - 34), m.index + m[0].length + 6).replace(/\s+/g, ' ') + '…');
        if (found.length > 40) return;
      }
    };
    const out = document.getElementById('pump-output-section');
    if (out) {
      const clone = out.cloneNode(true);
      /* .si-citation marks text quoted verbatim from a standard that is
         itself written in SI (API 610 Table 12 tabulates kW). Converting a
         citation would misquote the code, so it is exempt by design. */
      clone.querySelectorAll('#pump-manual, canvas, script, .si-citation').forEach(e => e.remove());
      scan('output', clone.innerText);
    }
    [['flow/head chart', typeof pumpFlowHeadChart !== 'undefined' && pumpFlowHeadChart],
     ['suction nozzle chart', typeof pumpSucNozzleChart !== 'undefined' && pumpSucNozzleChart],
     ['pump curve chart', typeof pumpCurveChart !== 'undefined' && pumpCurveChart]].forEach(([n, c]) => {
      if (!c || !c.options) return;
      const bits = [];
      Object.values(c.options.scales || {}).forEach(s => { if (s && s.title && s.title.text) bits.push(s.title.text); });
      (c.data.datasets || []).forEach(d => { if (d.label) bits.push(d.label); });
      scan(n, bits.join(' | '));
    });
    return found;
  });
  ok('no SI unit is written beside a number in the US view', leak.length === 0,
     leak.length ? leak.slice(0, 6).join('  ||  ') : 'output, 3 charts clean');
  await pg.evaluate(async () => {
    const s = document.getElementById('global-unit-system');
    s.value = 'SI'; s.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 3000));
  });

  console.log('\n4e · THE PANEL HAS EXACTLY TWO SCROLL REGIONS');
  /* The input column used to be max-height:100vh inside an area shorter than
     that, so .terminal-main gained a scrollbar of its own on the right — and
     dragging it moved the inputs while the reader was looking at results. */
  const scr = await pg.evaluate(async () => {
    const L = document.querySelector('.pump-left-panel');
    const R = document.getElementById('pump-output-section');
    const M = document.querySelector('.terminal-main');
    L.scrollTop = 0; R.scrollTop = 0;
    await new Promise(r => setTimeout(r, 120));
    R.scrollTop = 900; await new Promise(r => setTimeout(r, 160));
    const leftMovedByRight = L.scrollTop;
    R.scrollTop = 0; L.scrollTop = 900; await new Promise(r => setTimeout(r, 160));
    const rightMovedByLeft = R.scrollTop;
    L.scrollTop = 0;
    const regions = [...document.querySelectorAll('#pump-tab *')].filter(e => {
      const s = getComputedStyle(e);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4;
    }).length;
    return { mainScrolls: M.scrollHeight > M.clientHeight + 4, regions, leftMovedByRight, rightMovedByLeft };
  });
  ok('the page behind the panels does not scroll', !scr.mainScrolls);
  ok('exactly two scroll regions — inputs and results', scr.regions === 2, scr.regions + ' regions');
  ok('scrolling the results leaves the inputs alone', scr.leftMovedByRight === 0, 'left moved ' + scr.leftMovedByRight);
  ok('scrolling the inputs leaves the results alone', scr.rightMovedByLeft === 0, 'right moved ' + scr.rightMovedByLeft);

  console.log('\n5 · SCHEMATIC LAYOUT');
  for (const c of [{ n: 'small tank', v: 2, l: 70, cl: 1, d: 2 }, { n: 'tall tower', v: 20, l: 60, cl: 1, d: 35 },
                   { n: 'pump above vessel', v: 5, l: 20, cl: 10, d: 1 }, { n: 'buried vessel', v: -3, l: 40, cl: 1, d: 8 }]) {
    await setDuty({ 'pump-vessel-el': c.v, 'pump-lll': c.l, 'pump-centreline-el': c.cl, 'pump-discharge-el': c.d });
    const r = await pg.evaluate(async () => {
      const rb = [...document.querySelectorAll('button')].find(x => /REPORT/i.test(x.textContent)); if (rb) rb.click();
      await new Promise(r => setTimeout(r, 1500));
      const m = document.getElementById('pump-report-modal'); const sv = m && m.querySelector('svg');
      if (!sv) return { err: 1 };
      const it = []; sv.querySelectorAll('text').forEach(t => { const b = t.getBBox(); it.push(b); });
      let ov = 0;
      for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++)
        if (Math.min(it[i].x + it[i].width, it[j].x + it[j].width) - Math.max(it[i].x, it[j].x) > 1.5 &&
            Math.min(it[i].y + it[i].height, it[j].y + it[j].height) - Math.max(it[i].y, it[j].y) > 1.5) ov++;
      const vb = sv.getAttribute('viewBox'); m.remove();
      return { ov, n: it.length, vb };
    });
    ok('no overlapping labels — ' + c.n, r.ov === 0, r.n + ' labels, viewBox ' + r.vb);
  }

  console.log('\n6 · REPORT');
  await setDuty({ 'pump-vessel-el': 3, 'pump-lll': 50, 'pump-centreline-el': 0.5, 'pump-discharge-el': 25 });
  const dl = pg.waitForEvent('download', { timeout: 90000 }).catch(() => null);
  const built = await pg.evaluate(async () => {
    const rb = [...document.querySelectorAll('button')].find(x => /REPORT/i.test(x.textContent)); if (rb) rb.click();
    await new Promise(r => setTimeout(r, 1600));
    const m = document.getElementById('pump-report-modal'); if (!m) return null;
    const o = { graphs: /PERFORMANCE GRAPHS/.test(m.textContent), standards: /STANDARDS COMPLIANCE/.test(m.textContent), imgs: m.querySelectorAll('img').length, svg: m.querySelectorAll('svg').length };
    const b = [...m.querySelectorAll('button')].find(x => /DOWNLOAD/i.test(x.textContent)); if (b) b.click();
    return o;
  });
  ok('report carries the schematic', built && built.svg >= 1);
  ok('report carries the standards table', built && built.standards);
  ok('report carries the performance graphs', built && built.graphs, built ? built.imgs + ' images' : '');
  const d = await dl;
  ok('report downloads as a PDF', !!d, d ? 'saved' : 'no download event');

  ok('no page errors during the run', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await br.close();
  process.exit(fail ? 1 : 0);
})();
