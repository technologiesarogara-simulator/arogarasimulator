/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — SYSTEM RESET  (window.AROSYSRESET)
   ---------------------------------------------------------------------------
   Every module has its own RESET, and each one clears that module. There was
   no way to clear the whole workspace: an engineer starting a different job
   had to walk five line services, three exchangers, the pump and the tank and
   press RESET on each, and even then the project, the library selections and
   the saved revisions were still there.

   THIS IS DESTRUCTIVE AND IT SAYS SO. It asks first, it states exactly what
   each scope removes, and it will not accept the wider scope without the word
   RESET typed in. A single click that silently erases a day's work is not a
   convenience.

   TWO SCOPES, AND THE DIFFERENCE MATTERS:

     DESIGNS ONLY   clears every module's inputs, results, drawings, models
                    and calculation state. The project, the engineering data
                    library and the saved projects in this browser survive.

     EVERYTHING     the above, plus the open project, the project archive, the
                    library's user values, project overrides and design
                    mappings, and the stored preferences. It is the state a
                    first-time visitor gets.

   WHAT IT DOES NOT TOUCH IN EITHER SCOPE. The reference library itself — the
   migrated property tables, the component and symbol libraries, the criteria
   and standards register. Those are the application, not the engineer's work,
   and no reset should be able to take them away.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Every per-module RESET button in the application, by the module it
     belongs to. Pressing the module's own control is better than
     reimplementing what it does — each one knows its own panels, its undo
     stack and its P&ID. */
  var MODULE_RESET = [
    ['pump', 'pump-reset-btn'],
    ['line-liquid', 'lq-reset'],
    ['line-gas', 'gs-reset'],
    ['line-steam', 'st-reset'],
    ['line-slurry', 'sl-reset'],
    ['line-twophase', 'tp2-reset'],
    ['sthe', 'sthe-reset-btn'],
    ['dphe', 'dphe-reset-btn'],
    ['phe', 'phe-reset'],
    ['tank', 'tk-reset']
  ];

  /* localStorage keys the engineer's work lives in. Reference data is not
     here, deliberately. */
  var WORK_KEYS = [
    'aro_dl_uservalues_v1', 'aro_dl_usersubjects_v1', 'aro_dl_projoverride_v1',
    'aro_dl_mappings_v1', 'aro_dl_modoverride_v1', 'aro_dl_revisions_v1',
    'aro_dl_userprops_v1', 'aro_datalib_selection_v1', 'aro_datalib_favourites_v1',
    'aro_userlib_v1', 'aro_engdata_v1', 'aro_criteria_override_v1', 'aro_impact_log_v1'
  ];
  /* Anything under these prefixes is project work too. */
  var WORK_PREFIXES = ['aro_project', 'aro_proj_', 'arogara_project', 'aro_pid_', 'aro_wb_'];

  function isWorkKey(k) {
    if (WORK_KEYS.indexOf(k) >= 0) return true;
    for (var i = 0; i < WORK_PREFIXES.length; i++) {
      if (k.indexOf(WORK_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  /* ── The work ─────────────────────────────────────────────────────── */
  function resetDesigns(report) {
    var done = [], missed = [];
    MODULE_RESET.forEach(function (pair) {
      var mod = pair[0], btnId = pair[1];
      var b = $(btnId);
      if (b) {
        try { b.click(); done.push(mod); } catch (e) { missed.push(mod + ' (' + e.message + ')'); }
      } else {
        missed.push(mod);
      }
      /* Whether or not the button was reachable, the state machine and the
         model are told — a module on a tab that has never been opened has no
         button in the DOM yet, and it must still come back cleared. */
      try { if (window.AROSTATE && window.AROSTATE.reset) window.AROSTATE.reset(mod); } catch (e) {}
      try { if (window.ARO3DI && window.ARO3DI.clear) window.ARO3DI.clear(mod); } catch (e) {}
      try { if (window.ARORESET && window.ARORESET.mark) window.ARORESET.mark(mod); } catch (e) {}
    });
    try { if (window.AROSTATE && window.AROSTATE.refresh) window.AROSTATE.refresh(); } catch (e) {}
    if (report) { report.reset = done; report.notOnScreen = missed; }
    return done.length;
  }

  function resetEverything(report) {
    resetDesigns(report);
    var removed = [];
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(function (k) {
        if (!k || !isWorkKey(k)) return;
        try { localStorage.removeItem(k); removed.push(k); } catch (e) {}
      });
    } catch (e) {}
    if (report) report.cleared = removed;
    return removed.length;
  }

  /* ── The dialog ───────────────────────────────────────────────────── */
  var CSSID = 'aro-sysreset-css';
  function css() {
    if ($(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '#aro-sysreset-back{position:fixed;inset:0;z-index:99997;background:rgba(2,6,16,.72);',
      '  display:flex;align-items:flex-start;justify-content:center;padding:52px 16px;overflow:auto;}',
      '#aro-sysreset-box{background:var(--bg-panel,#0f172a);color:var(--text-main,#e2e8f0);',
      '  border:1px solid var(--border-muted,#1e293b);border-radius:9px;width:100%;max-width:640px;',
      '  font-family:var(--font-sans,system-ui,sans-serif);box-shadow:0 24px 70px rgba(0,0,0,.55);}',
      '#aro-sysreset-box *{box-sizing:border-box;}',
      '.srx-h{padding:13px 17px;border-bottom:1px solid var(--border-muted,#1e293b);}',
      '.srx-h b{font-family:var(--font-mono,ui-monospace,monospace);font-size:12px;letter-spacing:.09em;color:#f87171;}',
      '.srx-b{padding:15px 17px;}',
      '.srx-opt{border:1px solid var(--border-muted,#334155);border-radius:6px;padding:11px 13px;',
      '  margin-bottom:9px;cursor:pointer;}',
      '.srx-opt:hover{border-color:#38bdf8;}',
      '.srx-opt.on{border-color:#f87171;background:rgba(248,113,113,.07);}',
      '.srx-opt b{display:block;font-family:var(--font-mono,monospace);font-size:11px;',
      '  letter-spacing:.05em;color:var(--text-header,#f1f5f9);margin-bottom:4px;}',
      '.srx-opt span{font-size:11px;line-height:1.6;color:var(--text-muted,#94a3b8);}',
      '.srx-keep{font-size:10.5px;line-height:1.6;color:#93c5fd;border-left:2px solid #38bdf8;',
      '  padding-left:9px;margin-top:11px;}',
      '.srx-warn{font-size:10.5px;line-height:1.6;color:#fca5a5;border-left:2px solid #f87171;',
      '  padding-left:9px;margin-top:11px;}',
      '.srx-conf{margin-top:12px;display:none;}',
      '.srx-conf.on{display:block;}',
      '.srx-conf label{display:block;font-family:var(--font-mono,monospace);font-size:9px;',
      '  letter-spacing:.06em;color:var(--text-muted,#94a3b8);margin-bottom:4px;}',
      '.srx-conf input{width:100%;background:var(--bg-app,#0b1220);border:1px solid #334155;',
      '  border-radius:4px;color:var(--text-main,#e2e8f0);padding:8px 9px;font-size:12px;',
      '  font-family:var(--font-mono,monospace);letter-spacing:.12em;}',
      '.srx-f{padding:11px 17px;border-top:1px solid var(--border-muted,#1e293b);display:flex;',
      '  gap:7px;justify-content:flex-end;flex-wrap:wrap;}',
      '.srx-btn{font-family:var(--font-mono,monospace);font-size:10px;font-weight:700;letter-spacing:.05em;',
      '  padding:8px 14px;border-radius:4px;cursor:pointer;border:1px solid #334155;',
      '  background:transparent;color:var(--text-main,#cbd5e1);}',
      '.srx-btn:hover{border-color:#38bdf8;color:#38bdf8;}',
      '.srx-btn.go{background:#dc2626;border-color:#dc2626;color:#fff;}',
      '.srx-btn.go:hover{color:#fff;border-color:#ef4444;background:#ef4444;}',
      '.srx-btn:disabled{opacity:.4;cursor:not-allowed;}',
      '.srx-done{font-family:var(--font-mono,monospace);font-size:10.5px;line-height:1.75;',
      '  color:var(--text-main,#cbd5e1);}',
      '#aro-eb-sysreset{color:#f87171 !important;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  function openDialog() {
    css();
    if ($('aro-sysreset-back')) return;
    var scope = 'designs';
    var back = document.createElement('div');
    back.id = 'aro-sysreset-back';
    back.innerHTML = '<div id="aro-sysreset-box">'
      + '<div class="srx-h"><b>↺ SYSTEM RESET</b></div>'
      + '<div class="srx-b">'
      + '<div style="font-size:11.5px;line-height:1.65;color:var(--text-muted,#94a3b8);margin-bottom:12px;">'
      + 'Choose how much to clear. Nothing happens until you press the red button, '
      + 'and neither scope can be undone.</div>'
      + '<div class="srx-opt on" data-srx-scope="designs"><b>◉ DESIGNS ONLY</b>'
      + '<span>Clears every module — pump, all five line services, all three heat '
      + 'exchangers and the tank. Inputs, results, drawings, 3D models and calculation '
      + 'state all go back to NOT CALCULATED.</span></div>'
      + '<div class="srx-opt" data-srx-scope="all"><b>○ EVERYTHING IN THIS BROWSER</b>'
      + '<span>The above, plus the open project and the saved project archive, the '
      + 'engineering data library’s user values, project overrides and design mappings, '
      + 'the revision trail and the stored preferences. This is the state a first-time '
      + 'visitor sees.</span></div>'
      + '<div class="srx-keep">Neither scope touches the reference library: the property '
      + 'tables, the component and symbol libraries and the criteria and standards register '
      + 'are part of the application, not your work, and a reset cannot remove them.</div>'
      + '<div class="srx-warn" id="srx-warn" style="display:none;">Clearing everything removes '
      + 'saved projects that are stored in this browser only. If any of them matter, close this '
      + 'and use EXPORT PROJECT first — there is no copy anywhere else.</div>'
      + '<div class="srx-conf" id="srx-conf"><label>TYPE RESET TO CONFIRM</label>'
      + '<input id="srx-word" type="text" autocomplete="off" placeholder="RESET"></div>'
      + '</div>'
      + '<div class="srx-f">'
      + '<button class="srx-btn" data-srx="cancel">CANCEL</button>'
      + '<button class="srx-btn go" data-srx="go">RESET DESIGNS</button>'
      + '</div></div>';
    document.body.appendChild(back);

    function sync() {
      [].forEach.call(back.querySelectorAll('[data-srx-scope]'), function (o) {
        var on = o.getAttribute('data-srx-scope') === scope;
        o.classList.toggle('on', on);
        var b = o.querySelector('b');
        if (b) b.textContent = (on ? '◉ ' : '○ ') + b.textContent.replace(/^[◉○]\s*/, '');
      });
      var all = scope === 'all';
      $('srx-conf').classList.toggle('on', all);
      $('srx-warn').style.display = all ? '' : 'none';
      var go = back.querySelector('[data-srx="go"]');
      go.textContent = all ? 'CLEAR EVERYTHING' : 'RESET DESIGNS';
      go.disabled = all && String(($('srx-word') || {}).value || '').trim().toUpperCase() !== 'RESET';
    }
    sync();

    back.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'srx-word') sync();
    });
    back.addEventListener('click', function (e) {
      if (e.target === back) { back.remove(); return; }
      var o = e.target.closest ? e.target.closest('[data-srx-scope]') : null;
      if (o) { scope = o.getAttribute('data-srx-scope'); sync(); return; }
      var b = e.target.closest ? e.target.closest('[data-srx]') : null;
      if (!b) return;
      if (b.getAttribute('data-srx') === 'cancel') { back.remove(); return; }
      if (b.getAttribute('data-srx') === 'go') {
        /* Take this dialog down BEFORE doing the work, and put a fresh one up
           afterwards. The work presses every module's own RESET button, and
           somewhere in that cascade a document-level handler clears overlays —
           so a result panel built by mutating this element was removed the
           moment it appeared. Reporting the outcome matters more than reusing
           the node. */
        var chosen = scope;
        back.remove();
        setTimeout(function () {
          var report = {};
          if (chosen === 'all') resetEverything(report); else resetDesigns(report);
          setTimeout(function () { showDone(chosen, report); }, 250);
        }, 30);
      }
    }, true);
  }

  function showDone(scope, report) {
    css();
    var old = $('aro-sysreset-back');
    if (old) old.remove();
    var back = document.createElement('div');
    back.id = 'aro-sysreset-back';
    var box = document.createElement('div');
    box.id = 'aro-sysreset-box';
    back.appendChild(box);
    var n = (report.reset || []).length;
    box.innerHTML = '<div class="srx-h"><b>↺ SYSTEM RESET — DONE</b></div>'
      + '<div class="srx-b"><div class="srx-done">'
      + n + ' design module' + (n === 1 ? '' : 's') + ' cleared and returned to NOT CALCULATED.'
      + (report.notOnScreen && report.notOnScreen.length
        ? '<br><span style="color:var(--text-muted);">' + report.notOnScreen.length
          + ' of them had not been opened this session, so their state was cleared directly.</span>'
        : '')
      + (scope === 'all'
        ? '<br>' + (report.cleared || []).length + ' stored item'
          + ((report.cleared || []).length === 1 ? '' : 's') + ' removed from this browser.'
          + '<br><span style="color:var(--text-muted);">Reload the page to finish returning to '
          + 'a first-time state — some panels hold their data in memory until then.</span>'
        : '')
      + '</div></div>'
      + '<div class="srx-f">'
      + (scope === 'all' ? '<button class="srx-btn go" data-srx="reload">RELOAD NOW</button>' : '')
      + '<button class="srx-btn" data-srx="close">CLOSE</button></div>';
    document.body.appendChild(back);
    back.addEventListener('click', function (e) {
      if (e.target === back) { back.remove(); return; }
      var b = e.target.closest ? e.target.closest('[data-srx]') : null;
      if (!b) return;
      if (b.getAttribute('data-srx') === 'reload') { location.reload(); return; }
      back.remove();
    }, true);
  }

  /* ── The control ──────────────────────────────────────────────────────
     The button itself is built by the engineering bar, which owns that row and
     rewrites it on every module and status change. Appending from here worked
     for about a second at a time. This is left as a fallback for any surface
     that shows the bar without it. */
  function mount() {
    if ($('aro-eb-sysreset')) { css(); return true; }
    var anchor = $('aro-eb-dwg') || $('aro-eb-report');
    if (!anchor || !anchor.parentNode) return false;
    css();
    var b = document.createElement('button');
    b.className = anchor.className;
    b.id = 'aro-eb-sysreset';
    b.style.color = '#f87171';
    b.textContent = '\u21ba RESET SYSTEM';
    b.title = 'Clear every design module — and optionally everything stored in this browser';
    b.addEventListener('click', function (e) { e.preventDefault(); openDialog(); });
    anchor.parentNode.appendChild(b);
    return true;
  }

  window.AROSYSRESET = {
    open: openDialog, mount: mount,
    resetDesigns: resetDesigns, resetEverything: resetEverything,
    modules: function () { return MODULE_RESET.map(function (x) { return x[0]; }); }
  };

  function boot() {
    /* The engineering bar rebuilds its own innerHTML whenever the active
       module or the design status changes, and that takes this button with
       it. Mounting once and stopping meant the control appeared for a second
       on load and was gone by the time anyone looked for it, so the check is
       permanent — it is one getElementById a second, and it is the difference
       between the control being there and not. */
    mount();
    setInterval(mount, 2000);
    document.addEventListener('click', function () { setTimeout(mount, 200); }, true);
    try {
      if (window.AROSTATE && window.AROSTATE.onChange) window.AROSTATE.onChange(function () {
        setTimeout(mount, 60);
      });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
