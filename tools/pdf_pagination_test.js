/* ══════════════════════════════════════════════════════════════════════
   PDF PAGINATION — CUT RULE TEST

     node tools/pdf_pagination_test.js       (serve dist/ on :8765 first)

   Reports were printing a section heading at the foot of one page with the
   content it introduces on the next. The cut rule that decides where a page
   ends is a pure function, so it is driven here directly with synthetic
   spans rather than by rasterising a report and reading the result by eye.

   Two kinds of span are protected:
     atomic  a table row, a drawing, a card — must not be severed
     keep    a heading bound to the block it introduces — must not be split,
             and is allowed to push the cut further back than a row, because
             an orphaned heading reads as a fault in the document.

   Then the whole export is run end to end on a real report to confirm a PDF
   still comes out with pages in it.
   ══════════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = process.env.URL || 'http://localhost:8765/index.html';
let pass = 0, fail = 0;
const ok = (name, good, detail) => { good ? pass++ : fail++; console.log((good ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : '')); };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(URL);
  await pg.evaluate(() => localStorage.setItem('aro_session_v1', JSON.stringify({ name: 'T', email: 't@e.com', ts: Date.now() })));
  await pg.reload(); await pg.waitForTimeout(3500);

  console.log('\n1 · THE CUT RULE');
  const has = await pg.evaluate(() => !!(window.AROPDF && window.AROPDF.chooseCut));
  ok('the cut rule is reachable', has);
  if (!has) { console.log('\n' + pass + ' passed, ' + (fail + 1) + ' failed'); await br.close(); process.exit(1); }

  const cut = (y, slice, total, blocks, k) => pg.evaluate(
    ([y, slice, total, blocks, k]) => window.AROPDF.chooseCut(y, slice, total, blocks, k),
    [y, slice, total, blocks, k]);

  /* k = 1 keeps canvas px and CSS px the same, so the numbers read directly. */
  const PAGE = 1000;

  ok('a clear page is cut at the full slice height',
     await cut(0, PAGE, 5000, [], 1) === PAGE);

  ok('the last slice ends exactly at the content',
     await cut(4000, PAGE, 4600, [], 1) === 4600);

  const row = [{ t: 960, b: 1010, kind: 'atomic' }];
  ok('a table row is never severed',
     await cut(0, PAGE, 5000, row, 1) === 960, 'cut pulled back to the row top');

  /* A heading at 980 introducing a chart that runs to 1600. Splitting at 1000
     would print the heading alone at the foot of the page. */
  const heading = [{ t: 980, b: 1600, kind: 'keep' }];
  const c1 = await cut(0, PAGE, 5000, heading, 1);
  ok('a heading travels with the block it introduces', c1 === 980,
     'cut ' + c1 + ' (heading top 980), so both move to the next page');

  /* The same heading sitting very high on the page: pulling the cut back to it
     would leave a nearly empty page, so the split is accepted instead. */
  const early = [{ t: 60, b: 1400, kind: 'keep' }];
  const c2 = await cut(0, PAGE, 5000, early, 1);
  ok('a near-empty page is refused even to save a heading', c2 === PAGE,
     'cut ' + c2 + ', span top 60 is below the floor');

  /* A row is allowed less pull-back than a heading pair. */
  const rowEarly = [{ t: 200, b: 1400, kind: 'atomic' }];
  ok('a row gets a tighter floor than a heading', await cut(0, PAGE, 5000, rowEarly, 1) === PAGE);
  ok('a heading gets the looser floor',
     await cut(0, PAGE, 5000, [{ t: 200, b: 1400, kind: 'keep' }], 1) === 200);

  /* Pulling back into an earlier span must be resolved too. */
  const chain = [{ t: 900, b: 1200, kind: 'keep' }, { t: 700, b: 950, kind: 'atomic' }];
  const c3 = await cut(0, PAGE, 5000, chain, 1);
  ok('pulling back into an earlier span resolves', c3 === 700,
     'cut ' + c3 + ' clears both spans');

  ok('a span that does not straddle the cut is ignored',
     await cut(0, PAGE, 5000, [{ t: 1200, b: 1400, kind: 'keep' }], 1) === PAGE);

  /* Scale must be honoured: spans are CSS px, the cut is canvas px. */
  ok('the canvas scale is applied', await cut(0, 2000, 10000, [{ t: 960, b: 1010, kind: 'atomic' }], 2) === 1920,
     '960 CSS px × 2 = 1920 canvas px');

  console.log('\n2 · WHAT THE COLLECTOR PROTECTS');
  /* The first version of this fix matched headings by class name and missed
     the nozzle charts, whose titles are unclassed divs. This builds that exact
     structure and asks the collector directly. */
  const spans = await pg.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:760px;background:#fff;z-index:-1;';
    host.innerHTML =
      '<div id="t-sec"><h3>SECTION HEADING</h3><p style="height:120px;margin:0;">body</p></div>' +
      '<div style="display:flex;gap:12px;">' +
        '<div style="flex:1 1 46%;"><div style="height:14px;">SUCTION NOZZLE — VELOCITY BY SIZE</div>' +
          '<img id="t-img1" style="display:block;width:100%;height:220px;background:#ccc;"/></div>' +
        '<div style="flex:1 1 46%;"><div style="height:14px;">DISCHARGE NOZZLE — VELOCITY BY SIZE</div>' +
          '<img id="t-img2" style="display:block;width:100%;height:220px;background:#ccc;"/></div>' +
      '</div>' +
      '<table><tr id="t-row"><td style="height:30px;">row</td></tr></table>';
    document.body.appendChild(host);
    const padTop = host.getBoundingClientRect().top;
    const out = window.AROPDF.collectSpans(host, padTop, 1000);
    const img1 = document.getElementById('t-img1').getBoundingClientRect();
    const capTop = document.getElementById('t-img1').previousElementSibling.getBoundingClientRect().top - padTop;
    host.remove();
    return { spans: out, img1Top: img1.top - padTop, capTop: capTop };
  });

  const fig = spans.spans.filter(s => s.kind === 'figure');
  ok('the caption-plus-picture cell is found', fig.length >= 2, fig.length + ' figure spans');
  const coversCaption = fig.some(s => s.t <= spans.capTop + 1 && s.b >= spans.img1Top + 100);
  ok('the figure span starts at the caption, not the picture', coversCaption,
     'caption top ' + Math.round(spans.capTop) + ', picture top ' + Math.round(spans.img1Top));
  ok('the heading is bound to its body', spans.spans.some(s => s.kind === 'keep'));
  ok('table rows are still protected', spans.spans.some(s => s.kind === 'atomic'));

  /* And the cut rule must actually refuse to split one. */
  const figSpan = fig[0];
  const splitAt = Math.round((figSpan.t + figSpan.b) / 2);
  const c4 = await cut(Math.max(0, splitAt - 900), 900, 9000, spans.spans, 1);
  ok('a cut never lands inside a figure',
     !(c4 > figSpan.t + 0.5 && c4 < figSpan.b - 0.5),
     'cut ' + c4 + ' vs figure ' + Math.round(figSpan.t) + '–' + Math.round(figSpan.b));

  console.log('\n3 · THE WHOLE EXPORT STILL RUNS');
  const made = await pg.evaluate(async () => {
    const nav = [...document.querySelectorAll('.nav-tab')].find(e => /PUMP SIZING/.test(e.textContent)); nav.click();
    await new Promise(r => setTimeout(r, 400));
    const s = (i, v) => { const e = document.getElementById(i); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
    s('pump-vol-flow-lhr', 1000); s('pump-npshr', 10); s('pump-discharge-el', 1.2);
    const b = [...document.querySelectorAll('button')].find(x => /RUN PUMP/i.test(x.textContent)); if (b) b.click();
    await new Promise(r => setTimeout(r, 2600));
    return !!document.getElementById('report-viewport');
  });
  ok('the report viewport exists', made);

  /* The report opens in a modal; the download control lives inside it. */
  const dl = pg.waitForEvent('download', { timeout: 90000 }).catch(() => null);
  const opened = await pg.evaluate(async () => {
    const rb = [...document.querySelectorAll('button')].find(x => /REPORT/i.test(x.textContent)); if (rb) rb.click();
    await new Promise(r => setTimeout(r, 1800));
    const m = document.getElementById('pump-report-modal'); if (!m) return false;
    const b = [...m.querySelectorAll('button')].find(x => /DOWNLOAD/i.test(x.textContent)); if (b) b.click();
    return true;
  });
  ok('the report opens', opened);
  const file = await dl;
  ok('a PDF is produced', !!file, file ? file.suggestedFilename() : 'no download event');

  /* The exporter is shared, so a fix to it has to hold for every module that
     uses it — the point of putting the rule in one place. */
  console.log('\n4 · OTHER SYSTEMS EXPORT THROUGH THE SAME RULE');
  /* Line sizing is driven through its own module API — its report button lives
     inside whichever phase panel is showing, and hunting for it by text picked
     up the previous module's modal instead. */
  {
    const d3 = pg.waitForEvent('download', { timeout: 90000 }).catch(() => null);
    await pg.evaluate(async () => {
      document.querySelectorAll('[id$="-modal"], [id$="-report-modal"]').forEach(m => { try { m.remove(); } catch (e) {} });
      const nav = document.querySelector('.nav-tab[data-tab="line-tab"]'); if (nav) nav.click();
      await new Promise(r => setTimeout(r, 900));
      window.AROLINE.liquid.calc();
      await new Promise(r => setTimeout(r, 600));
      window.AROLINE.liquid.report();
      await new Promise(r => setTimeout(r, 1400));
      const pdf = document.getElementById('lq-pdf'); if (pdf) pdf.click();
    });
    const f3 = await d3;
    const fn3 = f3 ? f3.suggestedFilename() : '';
    ok('Line sizing exports its own PDF', !!f3 && /line|liquid/i.test(fn3), fn3 || 'no download event');
  }

  for (const [tab, name, expect] of [['tank-tab', 'Tank design', /tank|storage/i]]) {
    const d2 = pg.waitForEvent('download', { timeout: 90000 }).catch(() => null);
    await pg.evaluate(async (t) => {
      /* Any modal left open from the previous module would swallow the next
         click and hand back the previous module's PDF. */
      [...document.querySelectorAll('[id$="-report-modal"], [id$="-modal"], [id$="-mwrap"], .aro-modal, .modal')]
        .forEach(m => { try { m.remove(); } catch (e) { m.style.display = 'none'; } });
      [...document.querySelectorAll('body > div')].forEach(d => {
        const s = getComputedStyle(d);
        if (s.position === 'fixed' && parseInt(s.zIndex || 0, 10) > 500 && d.offsetHeight > 300) {
          try { d.remove(); } catch (e) {}
        }
      });
      await new Promise(r => setTimeout(r, 400));
      const nav = document.querySelector(`.nav-tab[data-tab="${t}"]`); if (nav) nav.click();
      await new Promise(r => setTimeout(r, 900));
      const run = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null)
        .find(b => /calculat|run |design|size/i.test(b.textContent) && !/reset|pdf|copy|pause/i.test(b.textContent));
      if (run) run.click();
      await new Promise(r => setTimeout(r, 2400));
      /* Each module names its own report button; take whichever is on screen. */
      const rep = document.getElementById('tk-report')
        || [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null)
             .find(b => /REPORT/i.test(b.textContent));
      if (rep) rep.click();
      await new Promise(r => setTimeout(r, 2200));
      const dl = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null)
        .find(b => /DOWNLOAD|PDF/i.test(b.textContent));
      if (dl) dl.click();
    }, tab);
    const f2 = await d2;
    const fn = f2 ? f2.suggestedFilename() : '';
    ok(name + ' exports its own PDF', !!f2 && expect.test(fn), fn || 'no download event');
  }

  ok('no page errors during the run', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await br.close();
  process.exit(fail ? 1 : 0);
})();
