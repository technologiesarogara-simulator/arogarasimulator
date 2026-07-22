/* ══════════════════════════════════════════════════════════════════════
   ARO — SHARED "DESIGN DATA SHEET" HEADER
   Prepends a compact project datasheet (Project · Client · Tag · Service ·
   Design Code · Engineer · Date · Rev) with a CALENDAR date-picker to the
   input panel of every design module: Pump Hydraulics, Line Sizing (liquid /
   gas / steam / slurry / two-phase), DPHE and STHE. Values persist in
   localStorage so they survive navigation. (The Plate-HEx module already has
   its own datasheet.)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CODES = ['ASME Sec VIII Div 1', 'ASME B31.3', 'API 610', 'API 660', 'API 662', 'TEMA', 'EN 13445', 'IS 4503', 'Client Spec'];

  function today() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
  function lsGet(k) { try { return localStorage.getItem('aro-ds-' + k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { localStorage.setItem('aro-ds-' + k, v); } catch (e) {} }

  function fieldText(key, label, ph, isDate) {
    var id = 'ds-' + key;
    var saved = lsGet(key);
    var v = saved || (isDate ? today() : '');
    var type = isDate ? 'date' : 'text';
    return '<label style="display:block;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);letter-spacing:0.04em;">' + label
      + '<input id="' + id + '" data-dskey="' + key + '" type="' + type + '" value="' + v.replace(/"/g, '&quot;') + '" placeholder="' + (ph || '') + '" '
      + 'style="width:100%;margin-top:2px;background:rgba(2,6,18,0.55);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;box-sizing:border-box;color-scheme:dark;"/></label>';
  }
  function fieldSelect(key, label, opts) {
    var id = 'ds-' + key; var saved = lsGet(key) || opts[0];
    return '<label style="display:block;font-family:var(--font-mono);font-size:9.5px;color:var(--text-muted);letter-spacing:0.04em;">' + label
      + '<select id="' + id + '" data-dskey="' + key + '" style="width:100%;margin-top:2px;background:rgba(2,6,18,0.55);border:1px solid var(--border-muted);color:#e2e8f0;font-family:var(--font-mono);font-size:11px;padding:5px 7px;border-radius:3px;">'
      + opts.map(function (o) { return '<option' + (o === saved ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>';
  }

  function block(mod) {
    var g2 = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;';
    var h = '<div class="aro-datasheet" data-mod="' + mod + '" style="border:1px solid var(--border-muted);border-radius:6px;padding:9px 10px;margin:0 0 12px;background:rgba(255,117,56,0.04);">'
      + '<div style="display:flex;align-items:center;cursor:pointer;font-family:var(--font-mono);font-size:11px;font-weight:800;color:var(--color-saffron);letter-spacing:0.06em;margin-bottom:8px;" data-ds-toggle>'
      + '<span style="flex:1;">📋 DESIGN DATA SHEET</span><span data-ds-caret style="font-size:10px;">▾</span></div>'
      + '<div data-ds-body>'
      + '<div style="' + g2 + '">' + fieldText(mod + '-project', 'PROJECT', 'Untitled') + fieldText(mod + '-client', 'CLIENT', '') + '</div>'
      + '<div style="' + g2 + '">' + fieldText(mod + '-tag', 'TAG No.', '') + fieldText(mod + '-service', 'SERVICE', '') + '</div>'
      + '<div style="' + g2 + '">' + fieldSelect(mod + '-code', 'DESIGN CODE', CODES) + fieldText(mod + '-engineer', 'ENGINEER', '') + '</div>'
      + '<div style="' + g2 + '">' + fieldText(mod + '-date', 'DATE', '', true) + fieldText(mod + '-rev', 'REV', '0') + '</div>'
      + '</div></div>';
    return h;
  }

  function wireBlock(el) {
    // persist on change
    el.querySelectorAll('[data-dskey]').forEach(function (inp) {
      inp.addEventListener('change', function () { lsSet(inp.getAttribute('data-dskey'), inp.value); });
      inp.addEventListener('input', function () { lsSet(inp.getAttribute('data-dskey'), inp.value); });
    });
    // collapse / expand
    var tog = el.querySelector('[data-ds-toggle]'), body = el.querySelector('[data-ds-body]'), caret = el.querySelector('[data-ds-caret]');
    if (tog && body) tog.addEventListener('click', function () {
      var open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      if (caret) caret.textContent = open ? '▸' : '▾';
    });
  }

  // find the input panel body for a panel whose title matches, then prepend the block
  function inject(panelTitleEl, mod) {
    var panel = panelTitleEl.closest('.panel'); if (!panel) return false;
    if (panel.querySelector('.aro-datasheet')) return true;   // already present
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
      if (mod && inject(t, mod)) done++;
    });
    // Pump Hydraulics — its input panel uses a different header
    var pumpPanel = document.querySelector('#pump-tab .pump-input-panel, #pump-tab .panel-input');
    if (pumpPanel && !pumpPanel.querySelector('.aro-datasheet')) {
      var pbody = pumpPanel.querySelector('.panel-body') || pumpPanel;
      var w = document.createElement('div'); w.innerHTML = block('pump');
      var n = w.firstChild;
      // place just under the console header if present
      var anchor = pbody.querySelector('form') || pbody.firstChild;
      if (anchor && anchor.parentNode === pbody) pbody.insertBefore(n, anchor); else pbody.insertBefore(n, pbody.firstChild);
      wireBlock(n); done++;
    }
    return done;
  }

  function boot() {
    run();
    // modules / sub-tabs can be built lazily; retry a few times
    var tries = 0;
    var iv = setInterval(function () { var d = run(); tries++; if (tries > 15) clearInterval(iv); }, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  else setTimeout(boot, 500);

  window.ARODS = { run: run };
})();
