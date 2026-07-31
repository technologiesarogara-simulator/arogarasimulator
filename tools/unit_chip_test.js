/* ══════════════════════════════════════════════════════════════════════
   UNIT CHIPS — NOTHING OVERLAPS, NOTHING IS CUT OFF

     node tools/unit_chip_test.js            (serve dist/ on :8765 first)

   The unit chip beside an input used to be absolutely positioned over the
   right-hand end of the box, with a fixed 54 px of padding reserved to keep
   the value clear of it. A fixed reservation cannot work when the symbol
   changes with the unit system: bar becomes kg/cm², and with an absolute
   marker that is kg/cm² A — eight characters where three were allowed for.
   What the reader saw was a half-eaten symbol, or a number cut off inside
   its own box.

   Three things are checked, for every unit-bearing input on the screens that
   have them, in all three unit systems:

     · the input and its chip do not overlap
     · the chip is not clipped by its own box
     · the value is not clipped by its own box

   Nothing here inspects a screenshot. Each is read from the geometry, so a
   regression is caught by a number rather than by eye.
   ══════════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = process.env.URL || 'http://localhost:8765/index.html';
let pass = 0, fail = 0;
const ok = (n, good, d) => { good ? pass++ : fail++; console.log((good ? '  PASS  ' : '  FAIL  ') + n + (d ? '   ' + d : '')); };

const TABS = [
  ['pump-tab', 'Pump hydraulics'],
  ['line-tab', 'Line sizing'],
  ['tank-tab', 'Tank design']
];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const pg = await (await br.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(URL);
  await pg.evaluate(() => localStorage.setItem('aro_session_v1', JSON.stringify({ name: 'T', email: 't@e.com', ts: Date.now() })));
  await pg.reload(); await pg.waitForTimeout(3500);

  /* Give the modules something to display, so the boxes hold real figures
     rather than defaults — a long converted number is the case that fails. */
  await pg.evaluate(async () => {
    const s = (i, v) => { const e = document.getElementById(i); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
    s('pump-vol-flow-lhr', 200000); s('pump-npshr', 5);
    const b = [...document.querySelectorAll('button')].find(x => /RUN PUMP/i.test(x.textContent)); if (b) b.click();
    await new Promise(r => setTimeout(r, 2400));
  });

  const inspect = (tab) => pg.evaluate((t) => {
    const nav = document.querySelector(`.nav-tab[data-tab="${t}"]`); if (nav) nav.click();
    /* Open every accordion: a chip in a closed section is still wrong. */
    document.querySelectorAll(`#${t} details`).forEach(d => { d.open = true; });
    const bad = [];
    document.querySelectorAll(`#${t} .input-with-unit`).forEach((box) => {
      const inp = box.querySelector('input, select');
      const chip = box.querySelector('.unit');
      if (!inp || !chip) return;
      const a = inp.getBoundingClientRect(), c = chip.getBoundingClientRect();
      if (a.width === 0 || c.width === 0) return;
      const sameLine = Math.abs(a.top - c.top) < a.height * 0.6;
      const overlap = sameLine && a.right > c.left + 0.5;
      const chipClip = chip.scrollWidth > chip.clientWidth + 1;
      const valClip = inp.tagName === 'INPUT' && String(inp.value || '').length > 0
                      && inp.scrollWidth > inp.clientWidth + 1;
      if (overlap || chipClip || valClip) {
        bad.push((inp.id || '?') + ' "' + (inp.value || '') + '" chip "' + chip.textContent.trim() + '"'
          + (overlap ? ' OVERLAP' : '') + (chipClip ? ' CHIP-CLIPPED' : '') + (valClip ? ' VALUE-CLIPPED' : ''));
      }
    });
    return bad;
  }, tab);

  const setSys = (sys) => pg.evaluate(async (s) => {
    const el = document.getElementById('global-unit-system');
    el.value = s; el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 3000));
  }, sys);

  for (const sys of ['SI', 'US', 'CGS']) {
    await setSys(sys);
    console.log('\n' + sys);
    for (const [tab, name] of TABS) {
      const bad = await inspect(tab);
      await pg.waitForTimeout(250);
      ok(name.padEnd(17) + ' chips fit and clear the value', bad.length === 0,
         bad.length ? bad.slice(0, 3).join('  |  ') : 'clean');
    }
  }
  await setSys('SI');

  console.log('\nGAUGE AND ABSOLUTE MARKERS');
  const marks = await pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('.unit[data-unit-suffix]').forEach((c) => {
      out.push({ text: c.textContent.trim(), suffix: c.getAttribute('data-unit-suffix'),
                 siblings: c.parentElement.querySelectorAll('.unit').length });
    });
    return out;
  });
  ok('a marker rides inside its own chip', marks.length > 0 && marks.every(m => m.siblings === 1 && m.text.endsWith(m.suffix.trim())),
     marks.length + ' marked chips, e.g. "' + (marks[0] ? marks[0].text : '—') + '"');

  console.log('\nNO UNIT IS REPEATED AS A PLACEHOLDER');
  const ph = await pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('.input-with-unit input[placeholder]').forEach((i) => {
      const chip = i.parentElement.querySelector('.unit');
      if (chip && chip.textContent.trim() === i.placeholder.trim()) out.push(i.id || '?');
    });
    return out;
  });
  ok('no box shows its unit as a placeholder too', ph.length === 0, ph.join(', ') || 'clean');

  ok('no page errors during the run', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await br.close();
  process.exit(fail ? 1 : 0);
})();
