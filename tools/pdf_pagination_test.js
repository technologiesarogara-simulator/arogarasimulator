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

  console.log('\n2 · THE WHOLE EXPORT STILL RUNS');
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

  ok('no page errors during the run', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await br.close();
  process.exit(fail ? 1 : 0);
})();
