/* ══════════════════════════════════════════════════════════════════════
   SUITE-WIDE UNIT LEAK SCAN

     node tools/unit_leak_scan.js            (serve dist/ on :8765 first)

   Every unit bug found in this suite has had the same shape: a number that
   converts with the unit system while the unit written beside it does not.
   Reading for them by hand has missed some every single time.

   This walks each module, runs it on its own defaults, switches the suite to
   US customary, and then reads the rendered output looking for an SI unit
   still attached to a number. It reports what it finds, per module, with
   enough surrounding text to locate the string in the source.

   Text marked .si-citation is skipped: that is text quoted verbatim from a
   standard which is itself written in SI (API 610 Table 12 tabulates kW),
   and converting a citation would misquote the code.
   ══════════════════════════════════════════════════════════════════════ */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = process.env.URL || 'http://localhost:8765/index.html';

/* One entry per screen worth scanning. `open` puts the module on screen and
   makes it produce output; `panel` is the region whose text is read. */
const MODULES = [
  { name: 'Pump hydraulics', tab: 'pump-tab', panel: '#pump-output-section',
    open: async (pg) => { await pg.evaluate(() => {
      const s = (i, v) => { const e = document.getElementById(i); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
      s('pump-vol-flow-lhr', 200000); s('pump-npshr', 5); s('pump-discharge-el', 25); s('pump-dest-a', 4);
      const b = [...document.querySelectorAll('button')].find(x => /RUN PUMP/i.test(x.textContent)); if (b) b.click();
    }); } },

  { name: 'Line sizing · liquid',    tab: 'line-tab', phase: 'Liquid Sizing',    panel: '#line-tab' },
  { name: 'Line sizing · gas',       tab: 'line-tab', phase: 'Gas Sizing',       panel: '#line-tab' },
  { name: 'Line sizing · steam',     tab: 'line-tab', phase: 'Steam Sizing',     panel: '#line-tab' },
  { name: 'Line sizing · slurry',    tab: 'line-tab', phase: 'Slurry Sizing',    panel: '#line-tab' },
  { name: 'Line sizing · two-phase', tab: 'line-tab', phase: 'Two-Phase Sizing', panel: '#line-tab' },

  { name: 'Shell & tube (STHE)', tab: 'sthe-tab', sub: 'sthe-sub', panel: '#sthe-tab' },
  { name: 'Double pipe (DPHE)',  tab: 'sthe-tab', sub: 'dphe-sub', panel: '#sthe-tab' },
  { name: 'Tank design',         tab: 'tank-tab', panel: '#tank-tab' }
];

/* A number, then an SI unit, with no letter following it. */
const PATTERN = String.raw`(\d)\s*(m³/hr|m3/hr|kg/hr|kg/s|l/hr|L/min|kg/cm²|kcal/hr|W/m²|W/m·K|kJ/kg|m/s|m²|m³|kW|\bbar\b|\bcm\b|\bmm\b|\bkg\b|\bm\b|°C)(?![A-Za-z])`;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 1600, height: 1100 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(URL);
  await pg.evaluate(() => localStorage.setItem('aro_session_v1', JSON.stringify({ name: 'T', email: 't@e.com', ts: Date.now() })));
  await pg.reload(); await pg.waitForTimeout(4000);

  let total = 0;
  const summary = [];

  for (const m of MODULES) {
    /* Put the module on screen. */
    await pg.evaluate((t) => {
      const nav = document.querySelector(`.nav-tab[data-tab="${t}"]`); if (nav) nav.click();
    }, m.tab);
    await pg.waitForTimeout(700);

    if (m.phase) {
      await pg.evaluate((p) => {
        const b = [...document.querySelectorAll('button, .line-tab, .sub-tab, a')].find(x => x.textContent.trim() === p);
        if (b) b.click();
      }, m.phase);
      await pg.waitForTimeout(500);
    }
    if (m.sub) {
      await pg.evaluate((s) => {
        const b = document.querySelector(`[data-subtab="${s}"]`); if (b) b.click();
      }, m.sub);
      await pg.waitForTimeout(500);
    }
    if (m.open) { await m.open(pg); await pg.waitForTimeout(2400); }
    else {
      /* No bespoke opener: submit whatever form is visible, or press the
         module's own calculate control, so the panel holds real output. */
      await pg.evaluate(() => {
        const vis = (e) => e && e.offsetParent !== null;
        const btn = [...document.querySelectorAll('button')].filter(vis)
          .find(b => /calculat|run |design|size|solve/i.test(b.textContent) && !/reset|pdf|copy|pause/i.test(b.textContent));
        if (btn) btn.click();
      });
      await pg.waitForTimeout(2200);
    }

    /* Switch the suite to US customary and let everything redraw. */
    await pg.evaluate(async () => {
      const s = document.getElementById('global-unit-system');
      s.value = 'US'; s.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 3200));
    });

    const hits = await pg.evaluate(({ sel, pat }) => {
      const root = document.querySelector(sel);
      if (!root) return ['(panel not found: ' + sel + ')'];
      /* Walk the live DOM and keep only text the engineer can actually see.
         An earlier version cloned the tree and deleted hidden nodes by index,
         which drifted and let other phases' panels into the reading. A tree
         walker asks the real element each time, so it cannot drift. */
      const skipTag = { SELECT: 1, OPTION: 1, DATALIST: 1, CANVAS: 1, SCRIPT: 1, STYLE: 1 };
      const hidden = (el) => {
        for (let n = el; n && n !== root.parentNode; n = n.parentElement) {
          if (!n.tagName) continue;
          if (skipTag[n.tagName]) return true;
          if (n.classList && (n.classList.contains('si-citation') || n.classList.contains('aro-doc'))) return true;
          if (n.id === 'pump-manual') return true;
          const cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return true;
        }
        return false;
      };
      const parts = [];
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let tn;
      while ((tn = tw.nextNode())) {
        const s = tn.nodeValue;
        if (!s || !s.trim()) continue;
        if (hidden(tn.parentElement)) continue;
        parts.push(s.trim());
      }
      const text = parts.join(' ');
      const re = new RegExp(pat, 'g');
      const out = []; let mm;
      while ((mm = re.exec(text)) !== null) {
        out.push('…' + text.slice(Math.max(0, mm.index - 40), mm.index + mm[0].length + 8).replace(/\s+/g, ' ') + '…');
        if (out.length >= 25) break;
      }
      return out;
    }, { sel: m.panel, pat: PATTERN });

    /* Back to SI for the next module. */
    await pg.evaluate(async () => {
      const s = document.getElementById('global-unit-system');
      s.value = 'SI'; s.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 2600));
    });

    const uniq = [...new Set(hits)];
    total += uniq.length;
    summary.push([m.name, uniq.length]);
    console.log('\n── ' + m.name + ' ── ' + (uniq.length ? uniq.length + ' leak(s)' : 'clean'));
    uniq.slice(0, 12).forEach(h => console.log('     ' + h));
    if (uniq.length > 12) console.log('     … and ' + (uniq.length - 12) + ' more');
  }

  console.log('\n════ SUMMARY ════');
  summary.forEach(([n, c]) => console.log('  ' + (c ? 'LEAK ' : 'ok   ') + n.padEnd(26) + (c || '')));
  console.log('\n  ' + total + ' distinct leaking strings across ' + MODULES.length + ' screens');
  console.log('  page errors during the scan: ' + errs.length);
  errs.slice(0, 5).forEach(e => console.log('     ' + e.slice(0, 160)));

  await br.close();
  process.exit(0);
})();
