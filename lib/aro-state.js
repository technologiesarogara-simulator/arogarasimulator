/* ═══════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — CALCULATION STATE

   NO RESULT, NO VERDICT.

   Three of the nine modules render a verdict before anybody has entered
   anything. Open the application and the Line Sizing panel already says
   "Line velocity — FAIL", the Tank panel already says "⚠ CRITICAL FAILURES —
   DESIGN WILL NOT WORK", and the exchanger offers to correct a cooling-water
   outlet temperature it prints as "-". Those are not findings. They are the
   module's own defaults being judged against a criterion, and presenting
   them as engineering verdicts is worse than showing nothing: it teaches the
   engineer that a red mark on this screen means nothing, which is exactly
   the habit that makes them miss a real one.

   The second half of the same problem is the opposite: a result that stays
   on screen, still looking valid, after the input that produced it has been
   changed. A design that reads PASS at 1000 kg/h and is still reading PASS
   after the flow has been retyped as 3000 is a false statement with the
   authority of a calculation behind it.

   So every module now has ONE state, and the state decides what may be said:

     NOT CALCULATED  nothing has been run — no verdict, no warning, no
                     recommendation, no auto-correction. Values read "—".
     CALCULATING     a run is in progress.
     CALCULATED      a run completed against the inputs currently on screen;
                     verdicts are real and are shown.
     OUTDATED        the inputs have changed since that run. The results are
                     still on screen because they are still the last thing
                     that was actually computed, but they are marked as
                     belonging to superseded inputs and the panel says so.
     ERROR           the run could not complete. The reason is stated; no
                     verdict is claimed.

   HOW A RUN IS RECOGNISED. Modules already publish their checks to the
   engineering layer when a calculation completes. That is the signal — but
   several modules also render once at boot, so a publish only counts as a
   calculation if a human gesture happened inside that module first. Boot
   renders have no gesture behind them and stay gated.

   Nothing in this file touches a formula, a correlation or a result. It
   decides only WHEN the application is entitled to state a verdict.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var NOT = 'NOT_CALCULATED', RUN = 'CALCULATING', OK = 'CALCULATED',
      OLD = 'OUTDATED', ERR = 'ERROR';

  /* ── Which surfaces carry a verdict, per module ───────────────────────
     A gate is a selector for something that may only be shown once a real
     calculation stands behind it: a results panel, a design advisor, an
     auto-correction offer, a warning banner. Inputs, help text, drawings
     and the 3D geometry preview are deliberately NOT gated — geometry is
     not a verdict, and hiding the inputs would be absurd. */
  var MODULES = {
    pump: {
      tab: 'pump-tab', label: 'Pump Hydraulics',
      gates: ['#pump-results', '#pump-assistant-panel', '#pump-end-slogan'],
      inputs: '#pump-form input, #pump-form select, #pump-tab input, #pump-tab select'
    },
    'line-liquid': { tab: 'line-tab', label: 'Liquid Line Sizing',
      gates: ['#lq-results', '#lq-advisor'], inputs: '#line-liquid-content input, #line-liquid-content select' },
    'line-gas': { tab: 'line-tab', label: 'Gas Line Sizing',
      gates: ['#gs-results', '#gs-advisor'], inputs: '#line-gas-content input, #line-gas-content select' },
    'line-steam': { tab: 'line-tab', label: 'Steam Line Sizing',
      gates: ['#st-results', '#st-advisor'], inputs: '#line-steam-content input, #line-steam-content select' },
    'line-slurry': { tab: 'line-tab', label: 'Slurry Line Sizing',
      gates: ['#sl-results', '#sl-advisor'], inputs: '#line-slurry-content input, #line-slurry-content select' },
    'line-twophase': { tab: 'line-tab', label: 'Two-Phase Line Sizing',
      gates: ['#tp2-results', '#tp2-advisor'], inputs: '#line-twophase-content input, #line-twophase-content select' },
    sthe: { tab: 'sthe-tab', label: 'Shell & Tube Exchanger',
      gates: ['#sthe-water-warning', '#sthe-tuning-panel', '#sthe-recommendations',
              '#sthe-key-summary', '#sthe-flow-compare', '#sthe-tab .panel-output .analysis-section'],
      inputs: '#sthe-form input, #sthe-form select' },
    dphe: { tab: 'sthe-tab', label: 'Double Pipe Exchanger',
      gates: ['#dphe-results', '#dphe-summary-report', '#dphe-suggestions', '#dphe-charts'],
      inputs: '#dphe-form input, #dphe-form select' },
    phe: { tab: 'sthe-tab', label: 'Plate Heat Exchanger',
      gates: ['#phe-results'], inputs: '#sthe-sub [id^="phe-"]' },
    tank: { tab: 'tank-tab', label: 'Storage Tank',
      gates: ['#tk-results', '#tk-apply-fixes'], inputs: '#tank-tab input, #tank-tab select' }
  };

  var ST = {};          // moduleId -> { state, at, fp, msg, checks }
  var GESTURE = {};     // tabId    -> a human has acted in this tab
  var PLACED = {};      // gate selector -> placeholder element

  function $(s) { try { return document.querySelector(s); } catch (e) { return null; } }
  function all(s) { try { return Array.prototype.slice.call(document.querySelectorAll(s)); } catch (e) { return []; } }
  function get(id) { return ST[id] || (ST[id] = { state: NOT, at: 0, fp: '', msg: '' }); }

  /* ── The input fingerprint ────────────────────────────────────────────
     What the calculation was run against. Readonly and disabled fields are
     the module's own outputs written back into the form (a solved outlet
     temperature, an auto-selected bore), so including them would mark a
     design outdated the instant it finished calculating. */
  function fingerprint(id) {
    var m = MODULES[id];
    if (!m) return '';
    var parts = [], els = all(m.inputs);
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (!e.id || e.type === 'hidden' || e.type === 'button' || e.type === 'submit') continue;
      if (e.readOnly || e.disabled) continue;
      if (/^aro-/.test(e.id)) continue;
      parts.push(e.id + '=' + ((e.type === 'checkbox' || e.type === 'radio') ? (e.checked ? 1 : 0) : e.value));
    }
    /* the unit system is part of what a number means, so it belongs in the
       fingerprint — but only as a label; changing it re-expresses the same
       design and must NOT mark it outdated */
    return parts.join('|');
  }

  /* ── CSS ──────────────────────────────────────────────────────────── */
  var CSS = [
    '[data-aro-gate="1"]{display:none !important;}',
    '.aro-nc{border:1px dashed var(--border-muted);border-radius:5px;padding:22px 18px;',
    '  margin:10px 0;text-align:center;font-family:var(--font-mono);}',
    '.aro-nc-t{font-size:12px;font-weight:800;letter-spacing:.12em;color:var(--text-muted);}',
    '.aro-nc-d{font-size:11px;color:var(--text-muted);margin-top:7px;line-height:1.6;}',
    '.aro-nc-b{margin-top:12px;background:transparent;border:1px solid var(--color-saffron);',
    '  color:var(--color-saffron);font-family:var(--font-mono);font-size:10px;font-weight:800;',
    '  letter-spacing:.07em;padding:6px 14px;border-radius:3px;cursor:pointer;}',
    '.aro-nc-b:hover{background:rgba(217,107,22,0.10);}',
    /* the outdated strip sits above the results it is describing */
    '.aro-stale{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px;',
    '  padding:9px 13px;border-radius:4px;font-family:var(--font-mono);font-size:11px;',
    '  border:1px solid rgba(183,121,31,0.55);border-left:3px solid #b7791f;',
    '  background:rgba(183,121,31,0.10);color:var(--color-warn,#b7791f);}',
    '.aro-stale b{color:var(--color-warn,#b7791f);letter-spacing:.08em;}',
    '.aro-stale span{color:var(--text-muted);flex:1;min-width:200px;}',
    'body.theme-day .aro-stale{background:#fdf6ea;color:#8a5a0f;}',
    'body.theme-day .aro-stale b{color:#8a5a0f;}',
    /* results belonging to superseded inputs read as a record, not a verdict */
    '[data-aro-stale="1"]{opacity:0.62;filter:saturate(0.55);}'
  ].join('');

  function injectCss() {
    if (document.getElementById('aro-state-css')) return;
    var s = document.createElement('style');
    s.id = 'aro-state-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── The NOT CALCULATED placeholder ───────────────────────────────── */
  function placeholderFor(id) {
    var m = MODULES[id];
    var d = document.createElement('div');
    d.className = 'aro-nc';
    d.setAttribute('data-aro-nc', id);
    d.innerHTML = '<div class="aro-nc-t">&mdash;&nbsp; NOT CALCULATED</div>'
      + '<div class="aro-nc-d">Enter the design inputs for ' + (m ? m.label : 'this module')
      + ' and run the calculation.<br>No verdict, warning or recommendation is shown until a '
      + 'calculation has actually been made.</div>'
      + '<button type="button" class="aro-nc-b" data-aro-run="' + id + '">RUN CALCULATION</button>';
    return d;
  }

  function runControl(id) {
    var m = MODULES[id];
    if (!m) return null;
    var tab = document.getElementById(m.tab);
    if (!tab) return null;
    var pref = { pump: '#pump-form button[type=submit]', dphe: '#dphe-form button[type=submit]',
                 sthe: '#sthe-form button[type=submit]', 'line-liquid': '#lq-calc',
                 'line-gas': '#gs-calc', 'line-steam': '#st-calc', 'line-slurry': '#sl-calc',
                 'line-twophase': '#tp2-calc', tank: '#tk-calc', phe: '#phe-calc' }[id];
    var b = pref ? $(pref) : null;
    if (b) return b;
    var any = tab.querySelectorAll('button[type=submit]');
    for (var i = 0; i < any.length; i++) if (any[i].offsetParent !== null) return any[i];
    return null;
  }

  /* ── Applying a state to the DOM ──────────────────────────────────── */
  function apply(id) {
    var m = MODULES[id];
    if (!m) return;
    var s = get(id).state;
    var gated = (s === NOT || s === ERR);

    for (var i = 0; i < m.gates.length; i++) {
      var sel = m.gates[i], els = all(sel);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (gated) el.setAttribute('data-aro-gate', '1');
        else el.removeAttribute('data-aro-gate');
        if (s === OLD) el.setAttribute('data-aro-stale', '1');
        else el.removeAttribute('data-aro-stale');
      }
      /* one placeholder per gate, inserted where the panel would have been */
      var key = id + '::' + sel;
      var ph = PLACED[key];
      if (gated) {
        var host = els[0];
        if (host && host.parentNode) {
          if (!ph || !ph.parentNode) {
            ph = placeholderFor(id);
            host.parentNode.insertBefore(ph, host);
            PLACED[key] = ph;
          }
          /* Three modules share the Heat Exchanger tab and only one of them
             is on screen at a time. A placeholder belongs to the panel it
             replaces, so it is shown only when that panel's own container is
             the one being displayed — otherwise the shell-and-tube view
             carries a "run the double-pipe calculation" notice. */
          ph.style.display = 'none';
          ph.style.display = (ph.parentNode && ph.parentNode.offsetParent !== null) ? '' : 'none';
        }
      } else if (ph) {
        ph.style.display = 'none';
      }
    }
    staleStrip(id, s === OLD);
  }

  /* Only the first gate of a module carries the placeholder message and the
     outdated strip — repeating it above every panel is noise. */
  function staleStrip(id, on) {
    var m = MODULES[id];
    var host = m && all(m.gates[0])[0];
    var existing = document.querySelector('[data-aro-stale-strip="' + id + '"]');
    if (!on || !host || !host.parentNode) { if (existing) existing.remove(); return; }
    if (existing) return;
    var d = document.createElement('div');
    d.className = 'aro-stale';
    d.setAttribute('data-aro-stale-strip', id);
    d.innerHTML = '<b>&#9888; DESIGN OUTDATED</b>'
      + '<span>The inputs have changed since this calculation. The results below are from the '
      + 'previous run and no longer describe the design on screen.</span>'
      + '<button type="button" class="aro-nc-b" style="margin:0;" data-aro-run="' + id + '">RE-CALCULATE</button>';
    host.parentNode.insertBefore(d, host);
  }

  /* ── Transitions ──────────────────────────────────────────────────── */
  function set(id, state, extra) {
    if (!MODULES[id]) return;
    var s = get(id);
    s.state = state;
    if (extra) for (var k in extra) s[k] = extra[k];
    apply(id);
    notify(id);
  }

  function calculated(id, payload) {
    var s = get(id);
    s.at = Date.now();
    s.fp = fingerprint(id);
    s.msg = '';
    set(id, OK, payload || {});
  }

  function outdatedCheck(id) {
    var s = get(id);
    if (s.state !== OK && s.state !== OLD) return;
    var now = fingerprint(id);
    var next = (now === s.fp) ? OK : OLD;
    if (next !== s.state) set(id, next);
  }

  var LISTENERS = [];
  function notify(id) {
    for (var i = 0; i < LISTENERS.length; i++) {
      try { LISTENERS[i](id, get(id).state); } catch (e) {}
    }
  }

  /* ── Wiring ───────────────────────────────────────────────────────── */
  function tabOf(id) { return MODULES[id] ? MODULES[id].tab : null; }

  /* A publish from the engineering layer means a module finished a run. It
     only counts as a calculation if a human acted in that tab first —
     otherwise it is the module drawing its own defaults at boot. */
  function hookPublish() {
    if (!window.AROENG || !window.AROENG.publish || window.AROENG.__stateHooked) return false;
    var orig = window.AROENG.publish;
    window.AROENG.publish = function (id, payload) {
      var r = orig.apply(this, arguments);
      try {
        var tab = tabOf(id);
        if (tab && GESTURE[tab]) calculated(id, { checks: payload && payload.checks });
        else if (MODULES[id]) apply(id);          // keep it gated, keep it tidy
      } catch (e) {}
      return r;
    };
    window.AROENG.__stateHooked = true;
    return true;
  }

  function boot() {
    injectCss();

    /* Gate everything up front, before a module has a chance to render a
       verdict over its own defaults. */
    for (var id in MODULES) apply(id);

    /* A gesture inside a tab is what turns a later publish into a real
       calculation.

       This listens on CLICK rather than pointerdown. A pointerdown fires only
       for a real pointer, so a control activated any other way — el.click()
       from a keyboard handler, an APPLY button that presses RUN for you, an
       accessibility action — produced a calculation the gate then refused to
       show, which is a worse failure than the one being prevented. A click
       event is raised by all of those. What still does not count is the boot
       render, because nothing was activated at all. */
    ['click', 'keydown', 'change'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        var t = e.target && e.target.closest ? e.target.closest('.tab-content') : null;
        if (t && t.id) GESTURE[t.id] = true;
      }, true);
    });

    /* Any edit re-tests every module on that tab for staleness. */
    ['input', 'change'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        var t = e.target && e.target.closest ? e.target.closest('.tab-content') : null;
        if (!t || !t.id) return;
        for (var id in MODULES) if (MODULES[id].tab === t.id) outdatedCheck(id);
      }, true);
    });

    /* RUN CALCULATION / RE-CALCULATE on the placeholder and the strip. */
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-aro-run]') : null;
      if (!b) return;
      var id = b.getAttribute('data-aro-run');
      GESTURE[tabOf(id)] = true;
      var ctl = runControl(id);
      if (ctl) { ctl.scrollIntoView({ block: 'center' }); ctl.click(); }
      else if (id === 'pump' && typeof window.runActualPumpCalculations === 'function') {
        window.runActualPumpCalculations();
      }
    }, true);

    /* Modules build their panels asynchronously, so re-apply as tabs open
       and shortly after any button press. This is a handful of attribute
       writes, not a re-render. */
    document.addEventListener('click', function () {
      setTimeout(function () { for (var id in MODULES) apply(id); }, 700);
    }, true);
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.nav-tab')) {
        setTimeout(function () { for (var id in MODULES) apply(id); }, 400);
      }
    }, true);

    if (!hookPublish()) {
      var tries = 0;
      var iv = setInterval(function () { if (hookPublish() || ++tries > 40) clearInterval(iv); }, 250);
    }
    /* the modules finish building after us */
    [400, 1200, 2500].forEach(function (t) {
      setTimeout(function () { for (var id in MODULES) apply(id); }, t);
    });
  }

  /* ── Is this field actually missing? ──────────────────────────────────
     Every module's input validator treated a zero as "not entered". For a
     flow, a density, a viscosity or a bore that is right — zero is not a
     duty, it is a blank. For a TEMPERATURE and a GAUGE PRESSURE it is
     wrong, and wrong in the most ordinary cases there are: 0 °C is a real
     chilled-water inlet, and 0 barg is the design pressure of every
     atmospheric tank the API 650 module exists to design. Both were being
     refused with "REQUIRED INPUTS MISSING" against a field the engineer had
     filled in correctly.

     The quantity decides, and every field already declares its quantity
     through data-unit-type, so this needs no per-module list. */
  var ZERO_IS_A_VALUE = { temperature: 1, pressure: 1 };

  window.AROVALID = {
    missing: function (el) {
      if (!el) return false;
      var raw = String(el.value == null ? '' : el.value).trim();
      if (raw === '') return true;

      /* A choice is not a number. "Water" and "CS (A36 / IS 2062)" are
         perfectly good answers that parseFloat cannot read, so a numeric
         test applied to a dropdown reports every material and every fluid
         as missing. Only the placeholder row counts as unanswered. */
      if (el.tagName === 'SELECT') {
        var opt = el.options[el.selectedIndex];
        var txt = opt ? String(opt.text || '').trim() : '';
        return /^[—–-]*\s*select\b/i.test(txt) || txt === '';
      }
      /* Free text — a tag, a service description, a date — is answered as
         soon as it is not blank. A field is treated as a quantity when it
         says it is one: type=number, or a declared unit type (several
         numeric fields in this application are authored as type=text so
         they can carry a formatted value). */
      var numeric = (el.type === 'number') || !!el.getAttribute('data-unit-type');
      if (!numeric) return false;

      var v = parseFloat(raw);
      if (!isFinite(v)) return true;
      if (v !== 0) return false;
      return !ZERO_IS_A_VALUE[el.getAttribute('data-unit-type') || ''];
    }
  };

  window.AROSTATE = {
    STATES: { NOT: NOT, RUN: RUN, OK: OK, OLD: OLD, ERR: ERR },
    state: function (id) { return get(id).state; },
    at: function (id) { return get(id).at; },
    isCalculated: function (id) { var s = get(id).state; return s === OK || s === OLD; },
    isCurrent: function (id) { return get(id).state === OK; },
    /* modules may call these directly; the publish hook covers the rest */
    begin: function (id) { set(id, RUN); },
    calculated: calculated,
    error: function (id, msg) { set(id, ERR, { msg: msg || '' }); },
    reset: function (id) { var s = get(id); s.at = 0; s.fp = ''; set(id, NOT); },
    refresh: function () { for (var id in MODULES) apply(id); },
    onChange: function (fn) { if (typeof fn === 'function') LISTENERS.push(fn); },
    modules: function () { return Object.keys(MODULES); },
    label: function (id) { return MODULES[id] ? MODULES[id].label : id; },
    tab: tabOf
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
