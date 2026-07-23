/* ══════════════════════════════════════════════════════════════════════
   ARO — SHARED "DESIGN DATA SHEET" HEADER
   Prepends a compact project datasheet (Project · Client · Tag · Service ·
   Engineer · Date · Rev) with a CALENDAR date-picker to the input panel of the
   design modules — EXCLUDING Pump Hydraulics and Plate-HEx, which each carry
   their own datasheet. Targets: Line Sizing (liquid / gas / steam / slurry /
   two-phase), DPHE and STHE. Values persist in localStorage.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function today() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } }
  // Datasheet is intentionally NOT persisted across sessions — every fresh
  // login opens with a clean sheet (date = today, everything else blank).
  function lsGet(k) { return ''; }
  function lsSet(k, v) {}

  function fieldText(key, label, ph, isDate) {
    var id = 'ds-' + key;
    var v = (isDate ? today() : '');
    var type = isDate ? 'date' : 'text';
    return '<label style="display:block;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);letter-spacing:0.04em;">' + label
      + '<input id="' + id + '" data-dskey="' + key + '" type="' + type + '" value="' + v.replace(/"/g, '&quot;') + '" placeholder="' + (ph || '') + '" '
      + 'style="width:100%;margin-top:2px;background:rgba(2,6,18,0.55);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;box-sizing:border-box;color-scheme:dark;"/></label>';
  }

  function block(mod) {
    var g2 = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;';
    return '<div class="aro-datasheet" data-mod="' + mod + '" style="border:1px solid var(--border-muted);border-radius:6px;padding:9px 10px;margin:0 0 12px;background:rgba(255,117,56,0.04);">'
      + '<div style="display:flex;align-items:center;cursor:pointer;font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.06em;margin-bottom:8px;" data-ds-toggle>'
      + '<span style="flex:1;">1 · DESIGN DATA SHEET</span><span data-ds-caret style="font-size:10px;">▾</span></div>'
      + '<div data-ds-body>'
      + '<div style="' + g2 + '">' + fieldText(mod + '-project', 'PROJECT', 'Untitled') + fieldText(mod + '-client', 'CLIENT', '') + '</div>'
      + '<div style="' + g2 + '">' + fieldText(mod + '-tag', 'TAG No.', '') + fieldText(mod + '-service', 'SERVICE', '') + '</div>'
      + '<div style="' + g2 + '">' + fieldText(mod + '-engineer', 'ENGINEER', '') + fieldText(mod + '-date', 'DATE', '', true) + '</div>'
      + fieldText(mod + '-rev', 'REV', '0')
      + '</div></div>';
  }

  function wireBlock(el) {
    el.querySelectorAll('[data-dskey]').forEach(function (inp) {
      inp.addEventListener('change', function () { lsSet(inp.getAttribute('data-dskey'), inp.value); });
      inp.addEventListener('input', function () { lsSet(inp.getAttribute('data-dskey'), inp.value); });
    });
    var tog = el.querySelector('[data-ds-toggle]'), body = el.querySelector('[data-ds-body]'), caret = el.querySelector('[data-ds-caret]');
    if (tog && body) tog.addEventListener('click', function () {
      var open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      if (caret) caret.textContent = open ? '▸' : '▾';
    });
  }

  function inject(panelTitleEl, mod) {
    var panel = panelTitleEl.closest('.panel'); if (!panel) return false;
    if (panel.querySelector('.aro-datasheet')) return true;
    var body = panel.querySelector('.panel-body') || panel.querySelector('.panel-header');
    if (!body) return false;
    var wrap = document.createElement('div');
    wrap.innerHTML = block(mod);
    var node = wrap.firstChild;
    if (body.classList.contains('panel-body')) body.insertBefore(node, body.firstChild);
    else body.parentNode.insertBefore(node, body.nextSibling);
    wireBlock(node);
    return true;
  }

  function run() {
    var titles = document.querySelectorAll('.panel-title');
    var done = 0;
    titles.forEach(function (t) {
      var txt = (t.textContent || '').toUpperCase();
      var mod = null;
      if (/DESIGN DATA METRICS — LIQUID/.test(txt)) mod = 'line-liquid';
      else if (/DESIGN DATA METRICS — GAS/.test(txt)) mod = 'line-gas';
      else if (/DESIGN DATA METRICS — STEAM/.test(txt)) mod = 'line-steam';
      else if (/DESIGN DATA METRICS — SLURRY/.test(txt)) mod = 'line-slurry';
      else if (/DESIGN DATA METRICS — TWO-PHASE/.test(txt)) mod = 'line-twophase';
      else if (/DESIGN DATA METRICS — DPHE/.test(txt)) mod = 'dphe';
      else if (/DESIGN DATA METRICS — STHE/.test(txt)) mod = 'sthe';
      // NOTE: Pump Hydraulics and Plate-HEx are intentionally excluded — they
      // carry their own datasheet blocks.
      if (mod && inject(t, mod)) done++;
    });
    return done;
  }

  // clear a datasheet block's fields (date → today, rev → 0, rest empty)
  function resetBlock(block) {
    block.querySelectorAll('[data-dskey]').forEach(function (inp) {
      var key = inp.getAttribute('data-dskey');
      if (inp.type === 'date') inp.value = today();
      else if (/-rev$/.test(key)) inp.value = '0';
      else inp.value = '';
      lsSet(key, inp.value);
    });
  }
  // When any module RESET button is clicked, also reset the datasheet block that
  // sits in the same panel. Capture phase so it runs alongside the module's own
  // reset handler (inline onclick or JS listener).
  function wireResets() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn) return;
      var isReset = /reset/i.test(btn.id || '') || /reset/i.test(btn.getAttribute('title') || '') || /RESET/.test(btn.textContent || '');
      if (!isReset) return;
      var scope = btn.closest('.panel') || btn.closest('.tab-content');
      if (!scope) return;
      scope.querySelectorAll('.aro-datasheet').forEach(resetBlock);
    }, true);
  }

  function boot() {
    run();
    wireResets();
    var tries = 0;
    var iv = setInterval(function () { run(); if (tries++ > 15) clearInterval(iv); }, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  else setTimeout(boot, 500);

  window.ARODS = { run: run };
})();
