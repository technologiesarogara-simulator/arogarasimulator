/* ══════════════════════════════════════════════════════════════════════
   LIQUID LINE SIZING — DESIGN LADDER

     node tools/linesize_design_test.js      (serve dist/ on :8765 first)

   When no standard bore satisfies every check, the module used to answer
   "no standard bore or schedule satisfies every check at this duty — reduce
   the flow, shorten the run, or revisit the service selection." That is a
   shrug, not a design.

   There is normally one design decision in the way and it can be named with
   the number attached to it. These tests cover the ladder:

     rung 1  bore and schedule — pure sizing, may be applied automatically
     rung 2  the erosional set point — a design criterion, so it is offered
             with the figure and never applied on its own
     rung 3  neither works — report the closest bore and how far it misses,
             and offer nothing, because there is nothing to offer
   ══════════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = process.env.URL || 'http://localhost:8765/index.html';
let pass = 0, fail = 0;
const ok = (n, good, d) => { good ? pass++ : fail++; console.log((good ? '  PASS  ' : '  FAIL  ') + n + (d ? '   ' + d : '')); };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const pg = await (await br.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(URL);
  await pg.evaluate(() => localStorage.setItem('aro_session_v1', JSON.stringify({ name: 'T', email: 't@e.com', ts: Date.now() })));
  await pg.reload(); await pg.waitForTimeout(3500);

  const run = (fields) => pg.evaluate(async (f) => {
    document.querySelector('.nav-tab[data-tab="line-tab"]').click();
    await new Promise(r => setTimeout(r, 700));
    Object.entries(f).forEach(([k, v]) => {
      const e = document.getElementById(k);
      if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    window.AROLINE.liquid.calc();
    await new Promise(r => setTimeout(r, 900));
    /* The verdict banner is in the results panel; the check list and the
       all-clear are in the advisor panel beneath it. Read both. */
    const res = document.getElementById('lq-results');
    const adv = document.getElementById('lq-advisor');
    const t = ((res ? res.innerText : '') + '\n' + (adv ? adv.innerText : ''));
    return {
      text: t,
      giveUp: /No standard bore or schedule satisfies/.test(t),
      upgrade: /DESIGN UPGRADE/.test(t),
      noSize: /NO SIZE SATISFIES THIS DUTY/.test(t),
      autoSize: /AUTO DESIGN &rarr;|AUTO DESIGN →/.test(t),
      stabilised: /STABILISED DESIGN/.test(t),
      applyPct: !!document.getElementById('lq-fixpct'),
      applySize: !!document.getElementById('lq-fixnow'),
      pct: (document.getElementById('lq-pcterosion') || {}).value,
      nps: (document.getElementById('lq-nps') || {}).value
    };
  }, fields);

  console.log('\n1 · A DUTY THAT ONLY THE SET POINT BLOCKS');
  /* 100 m³/hr of water held at 20 % of the erosional velocity: the allowable
     is crushed to about a fifth of the API figure and no bore can pass. */
  const A = await run({ 'lq-q': 100, 'lq-pcterosion': 20, 'lq-len': 40 });
  ok('the old shrug is gone', !A.giveUp);
  ok('the blocking decision is named', A.upgrade);
  ok('the set point that caused it is quoted', /held at 20 % of the erosional velocity/.test(A.text));
  ok('the API RP 14E normal range is cited', /75–100 % for a clean, non-erosive service/.test(A.text));
  ok('a passing size at the new set point is given', /the smallest bore that satisfies every check is/.test(A.text));
  ok('it is offered, not applied', A.applyPct && /never applied on its own/.test(A.text));

  console.log('\n2 · APPLYING IT STABILISES THE DESIGN');
  const B = await pg.evaluate(async () => {
    document.getElementById('lq-fixpct').click();
    await new Promise(r => setTimeout(r, 1200));
    const t = document.getElementById('lq-results').innerText + '\n'
            + (document.getElementById('lq-advisor') || {}).innerText;
    return { pct: document.getElementById('lq-pcterosion').value,
             stabilised: /STABILISED DESIGN/.test(t),
             note: /AUTO-DESIGN/.test(t), text: t };
  });
  ok('the set point moved into the API range', Number(B.pct) >= 75, 'set point now ' + B.pct + ' %');
  ok('every check then passes', B.stabilised);
  ok('the change is stated, not silent', B.note);

  console.log('\n3 · A DUTY NOTHING CAN SATISFY');
  /* An enormous flow down a very long run with a tight allowance: no bore and
     no set point can rescue it, and the module must say so plainly. */
  const C = await run({ 'lq-q': 40000, 'lq-pcterosion': 100, 'lq-len': 4000, 'lq-dpallow': 0.01 });
  ok('it is reported as unachievable', C.noSize, C.noSize ? '' : 'got upgrade=' + C.upgrade);
  ok('the closest standard size is still named', /The closest standard size is/.test(C.text));
  ok('no fix is offered where none exists', !C.applyPct && /there is no size that would be one/.test(C.text));

  console.log('\n4 · AN ORDINARY DUTY IS UNAFFECTED');
  const D = await run({ 'lq-q': 100, 'lq-pcterosion': 75, 'lq-len': 40, 'lq-dpallow': '' });
  ok('a workable duty needs no ladder', !D.noSize && !D.upgrade);

  ok('no page errors during the run', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await br.close();
  process.exit(fail ? 1 : 0);
})();
