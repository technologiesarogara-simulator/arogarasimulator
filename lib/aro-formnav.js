/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — SECTION MAP FOR THE LONG SHEETS  (window.AROFORMNAV)
   ---------------------------------------------------------------------------
   "Very long to input (9 stages) and no option to track progress. Can be
    added 'progress bar' or 'jump to section' menu."

   The pump sheet is ten accordions deep — 00 USER MANUAL through 09 NOZZLE
   SELECTION — and the exchangers are not far behind. Once a section is
   scrolled past there is nothing that says how much is left, which section
   holds the box that is still empty, or how far off a run the sheet is. The
   only feedback came at the very end, from the missing-inputs dialog.

   A single strip at the top of each long sheet, and it stays put while the
   sheet scrolls:

     · one chip per section, in order, each carrying its own filled/total
     · a chip goes solid once its section is complete, so the gaps are
       visible from the top of the page without opening anything
     · clicking a chip opens that section and goes to it
     · a thin bar across the top for the sheet as a whole

   What counts as "filled" is the required set the missing-inputs check
   already uses, where it knows one — so the bar answers the question the
   engineer is actually asking, which is not "how many boxes are there" but
   "how far am I from being able to run this". Where there is no required
   list, every editable box in the section counts.

   Nothing here reads or writes an engineering value. It counts boxes.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var CSSID = 'aro-fnav-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '.aro-fnav{position:sticky;top:0;z-index:40;background:var(--bg-panel,#0d1420);',
      '  border:1px solid var(--border-color,#1e293b);border-radius:5px;',
      '  padding:7px 9px 8px;margin:0 0 10px;font-family:var(--font-mono);}',
      '.aro-fnav-top{display:flex;align-items:center;gap:8px;margin-bottom:6px;}',
      '.aro-fnav-lab{font-size:9px;letter-spacing:0.1em;color:var(--text-muted,#64748b);',
      '  font-weight:800;white-space:nowrap;}',
      '.aro-fnav-bar{flex:1;height:4px;border-radius:2px;background:rgba(100,116,139,0.25);overflow:hidden;}',
      /* This is a span, and a plain inline span ignores width/height —
         .aro-fnav-bar (its parent) only escapes that because flex blockifies
         it. Without display:block here the fill always rendered at 0×0, so
         the bar showed nothing but its own flat gray track no matter what
         percentage JS set the width to. */
      '.aro-fnav-fill{display:block;height:100%;width:0;border-radius:2px;background:linear-gradient(90deg,#0284c7,#22c55e);',
      '  transition:width 180ms ease;}',
      '.aro-fnav-pct{font-size:9.5px;font-weight:800;color:#22c55e;white-space:nowrap;min-width:52px;text-align:right;}',
      /* One row that scrolls sideways, not a wrapping block. Nine chips in a
         form column wrap to five rows, and a sticky element five rows tall
         takes back more of the screen than the map is worth. */
      '.aro-fnav-chips{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;',
      /* scrollbar-width alone still leaves the THUMB uncoloured — without
         scrollbar-color some Chromium builds (Windows Edge's Fluent overlay
         scrollbars in particular) paint the OS's own light default thumb/track
         instead of repainting the thin custom ::-webkit-scrollbar below. */
      '  scrollbar-width:thin;scrollbar-color:rgba(100,116,139,0.45) transparent;',
      '  padding-bottom:2px;}',
      '.aro-fnav-chips::-webkit-scrollbar{height:5px;}',
      '.aro-fnav-chips::-webkit-scrollbar-thumb{background:rgba(100,116,139,0.45);border-radius:3px;}',
      '.aro-fnav-chips::-webkit-scrollbar-track{background:transparent;}',
      '.aro-fnav-chip{font-family:var(--font-mono);font-size:9px;letter-spacing:0.03em;',
      '  padding:3px 7px;border-radius:3px;cursor:pointer;border:1px solid rgba(100,116,139,0.4);',
      '  background:transparent;color:var(--text-muted,#94a3b8);white-space:nowrap;line-height:1.4;}',
      '.aro-fnav-chip:hover{border-color:#0284c7;color:#38bdf8;}',
      '.aro-fnav-chip .n{opacity:0.75;margin-left:5px;}',
      '.aro-fnav-chip.done{border-color:rgba(34,197,94,0.55);color:#22c55e;background:rgba(34,197,94,0.08);}',
      '.aro-fnav-chip.part{border-color:rgba(217,119,6,0.55);color:#d97706;}',
      '.aro-fnav-chip.here{box-shadow:0 0 0 1px #38bdf8 inset;}',
      'body.theme-day .aro-fnav{background:#fff;border-color:#dfe5ea;}',
      'body.theme-day .aro-fnav-chip{color:#475569;border-color:#cbd5e1;}',
      'body.theme-day .aro-fnav-chip.done{color:#15803d;}',
      'body.theme-day .aro-fnav-chip.part{color:#b45309;}',
      /* The bar's own rgba(100,116,139,0.25) fill washed out to almost
         nothing against a white light-theme panel — no border, barely any
         fill contrast, so it read as a stray thin line rather than the
         progress track it is. A visible track colour + border make it
         legible as a UI element in either theme. */
      'body.theme-day .aro-fnav-bar{background:#e2e8f0;border:1px solid #cbd5e1;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  /* A sheet is any element that holds four or more accordions of its own.
     That finds the pump, the two exchangers written into the page and the
     ones the modules build later, without naming any of them here. */
  function hosts() {
    var byParent = [];
    var seen = [];
    var det = document.querySelectorAll('details');
    for (var i = 0; i < det.length; i++) {
      var par = det[i].parentElement;
      if (!par) continue;
      var k = seen.indexOf(par);
      if (k < 0) { seen.push(par); byParent.push([par, 1]); }
      else byParent[k][1]++;
    }
    var out = [];
    for (var j = 0; j < byParent.length; j++) if (byParent[j][1] >= 4) out.push(byParent[j][0]);
    return out;
  }

  function sectionsOf(host) {
    var out = [];
    for (var i = 0; i < host.children.length; i++) {
      var d = host.children[i];
      if (d.tagName !== 'DETAILS') continue;
      var s = d.querySelector('summary');
      if (!s) continue;
      var txt = (s.textContent || '').replace(/\s+/g, ' ').trim();
      /* the manual is reading, not entry — it does not belong on a progress bar */
      if (/USER MANUAL|HOW TO SIZE|HOW TO DESIGN/i.test(txt)) continue;
      out.push({ el: d, text: txt });
    }
    return out;
  }

  /* "01 · DESIGN DATA SHEET" → code 01, name DESIGN DATA SHEET */
  function labelOf(text) {
    var t = text.replace(/[▼▲]|&#9660;/g, '').trim();
    var m = t.match(/^([0-9]{1,2}|[A-Z])\s*[·.\-–]\s*(.+)$/);
    var code = m ? m[1] : '';
    var name = m ? m[2] : t;
    name = name.replace(/\s*\(.*?\)\s*$/, '').trim();
    return { code: code, name: name, short: name.length > 22 ? name.slice(0, 20).trim() + '…' : name };
  }

  /* Which required list, if any, governs this sheet. */
  function requiredIds(host) {
    var RQ = (window.ARORQ && typeof window.ARORQ.required === 'function')
      ? window.ARORQ.required() : null;
    if (!RQ) return null;
    var id = host.id || '';
    var key = null;
    if (/pump/.test(id)) key = 'pump';
    else if (/sthe/.test(id)) key = 'sthe';
    else if (/dphe/.test(id)) key = 'dphe';
    else if (/phe/.test(id)) key = 'phe';
    else if (/tank/.test(id)) key = 'tank';
    if (!key) {
      /* the module libraries build their sheets without a form around them,
         so fall back to whichever list this sheet's own ids belong to */
      var ids = {};
      var l = host.querySelectorAll('input,select');
      for (var i = 0; i < l.length; i++) if (l[i].id) ids[l[i].id] = 1;
      var best = null, bestN = 0;
      for (var k in RQ) {
        if (!Object.prototype.hasOwnProperty.call(RQ, k)) continue;
        var n = 0, list = RQ[k];
        for (var j = 0; j < list.length; j++) if (ids[list[j]]) n++;
        if (n > bestN) { bestN = n; best = k; }
      }
      if (bestN >= 3) key = best;
    }
    return key && RQ[key] ? RQ[key] : null;
  }

  function countable(el) {
    if (!el) return false;
    if (el.tagName === 'SELECT') return !el.disabled;
    if (el.tagName !== 'INPUT') return false;
    if (el.readOnly || el.disabled) return false;
    return el.type === 'number' || el.type === 'text' || el.type === 'date';
  }
  function filled(el) {
    var v = String(el.value == null ? '' : el.value).trim();
    return v !== '';
  }
  /* For a REQUIRED box, "filled in" means whatever the missing-inputs check
     already means by it — a select with no option chosen, or a number that
     does not parse, is missing there and must be missing here too, or the
     bar would read complete while that dialog still refuses the run. */
  function present(el) {
    if (window.ARORQ && typeof window.ARORQ.isMissing === 'function') {
      try { return !window.ARORQ.isMissing(el); } catch (e) {}
    }
    return filled(el);
  }

  function tally(sec, req) {
    var list = sec.el.querySelectorAll('input,select');
    var t = 0, f = 0;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (req) {
        if (!el.id || req.indexOf(el.id) < 0) continue;
        t++;
        if (present(el)) f++;
      } else {
        if (!countable(el)) continue;
        t++;
        if (filled(el)) f++;
      }
    }
    return { total: t, filled: f };
  }

  function build(host) {
    if (host.__aroFnav && host.__aroFnav.parentNode === host) return host.__aroFnav;
    var secs = sectionsOf(host);
    if (secs.length < 4) return null;
    css();
    var n = document.createElement('div');
    n.className = 'aro-fnav';
    n.innerHTML = '<div class="aro-fnav-top">'
      + '<span class="aro-fnav-lab">SECTIONS</span>'
      + '<span class="aro-fnav-bar"><span class="aro-fnav-fill"></span></span>'
      + '<span class="aro-fnav-pct"></span></div>'
      + '<div class="aro-fnav-chips"></div>';
    host.insertBefore(n, host.firstChild);
    host.__aroFnav = n;

    var chips = n.querySelector('.aro-fnav-chips');
    for (var i = 0; i < secs.length; i++) {
      (function (sec) {
        var L = labelOf(sec.text);
        var c = document.createElement('button');
        c.type = 'button';                       /* never submits the sheet */
        c.className = 'aro-fnav-chip';
        c.innerHTML = (L.code ? L.code + ' ' : '') + L.short + '<span class="n"></span>';
        c.title = sec.text;
        c.addEventListener('click', function (e) {
          e.preventDefault();
          if (!sec.el.open) sec.el.open = true;
          try { sec.el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
          catch (err) { sec.el.scrollIntoView(); }
          var first = sec.el.querySelector('input:not([readonly]):not([disabled]),select:not([disabled])');
          if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (err2) {} }, 320);
          paint(host);
        });
        chips.appendChild(c);
        sec.chip = c;
      })(secs[i]);
    }
    host.__aroSecs = secs;
    return n;
  }

  function paint(host) {
    var n = host.__aroFnav, secs = host.__aroSecs;
    if (!n || !secs) return;
    var req = requiredIds(host);
    /* Two different counts, because they answer two different questions.
       The chips count every box in their section — "how much of this section
       have I been through". The bar counts only the REQUIRED boxes — "how
       far am I from being able to run this", which is the question the
       engineer is actually asking of a ten-section sheet. */
    var T = 0, F = 0;
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      var c = tally(s, null);
      if (req) { var rc = tally(s, req); T += rc.total; F += rc.filled; }
      else { T += c.total; F += c.filled; }
      var chip = s.chip;
      if (!chip) continue;
      var num = chip.querySelector('.n');
      chip.classList.remove('done', 'part');
      if (c.total === 0) { if (num) num.textContent = ''; continue; }
      if (num) num.textContent = c.filled + '/' + c.total;
      if (c.filled >= c.total) chip.classList.add('done');
      else if (c.filled > 0) chip.classList.add('part');
    }
    var pct = T ? Math.round(100 * F / T) : 0;
    var fill = n.querySelector('.aro-fnav-fill');
    var lab = n.querySelector('.aro-fnav-pct');
    if (fill) fill.style.width = pct + '%';
    if (lab) lab.textContent = req ? (F + ' / ' + T + ' REQUIRED') : (F + ' / ' + T);
  }

  var TIMER = null;
  function refresh() {
    if (TIMER) return;
    TIMER = setTimeout(function () {
      TIMER = null;
      var h = hosts();
      for (var i = 0; i < h.length; i++) { if (build(h[i])) paint(h[i]); }
    }, 160);
  }

  document.addEventListener('input', refresh, true);
  document.addEventListener('change', refresh, true);
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && (t.closest('.nav-tab') || t.closest('.hex-subtab') || t.closest('.line-type-tab'))) refresh();
  }, true);

  function boot() {
    [300, 900, 2000, 4000, 7000].forEach(function (t) { setTimeout(refresh, t); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.AROFORMNAV = { hosts: hosts, build: build, paint: paint, refresh: refresh,
                        sectionsOf: sectionsOf, requiredIds: requiredIds };
})();
