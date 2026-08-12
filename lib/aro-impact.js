/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — IMPACT ANALYSIS AND REVISION TRACEABILITY  (window.AROIMPACT)
   ---------------------------------------------------------------------------
   Phases 21 and 22. Adopting the design basis into a module already worked and
   already marked the module superseded. Two things were missing, and they are
   the two that matter when the change is wrong.

   BEFORE — WHAT IS ABOUT TO BREAK. Adopting into one module asked nothing at
   all; adopting across the project asked "proceed?" and listed the values it
   would replace. Neither said which CALCULATED designs would stop being
   current. A basis change that supersedes three finished designs and a basis
   change that touches nothing looked identical at the moment of deciding, and
   the difference is the whole decision.

   AFTER — WHAT WAS DONE, AND BY WHOM. Nothing recorded that the change had
   happened. A superseded design says it needs recalculating; it does not say
   what moved underneath it. Now every applied change is a numbered revision
   carrying the old value, the new value, the engineer, the date, the designs
   it superseded and — where the engineer gives one — the reason.

   THE RULE THAT SHAPES BOTH. Nothing is re-run on the engineer's behalf, and
   nothing is claimed about the outcome that has not been observed.

   That second half was learned the hard way. The first version of this file
   announced "N calculated designs will become outdated" and was wrong about
   the pump: the pump recalculates as its inputs change, so adopting a
   different fluid moved its head from 33.46 m to 24.52 m and republished, and
   it stayed correctly current. A module that holds its last result is
   superseded instead. Predicting which is which would be guesswork, so the
   preview states both outcomes and the revision records the one that actually
   happened — measured after the change, not asserted before it.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Which module in the calculation state machine a given control belongs to.
     Without this the impact list can name a module but not say whether it
     holds a finished design. */
  var OWNER = [
    [/^pump-/, 'pump'],
    [/^lq-/, 'line-liquid'],
    [/^gs-/, 'line-gas'],
    [/^st-/, 'line-steam'],
    [/^sl-/, 'line-slurry'],
    [/^tp2?-/, 'line-twophase'],
    [/^sthe-/, 'sthe'],
    [/^dphe-/, 'dphe'],
    [/^phe-/, 'phe'],
    [/^tk-/, 'tank']
  ];
  function ownerOf(controlId) {
    for (var i = 0; i < OWNER.length; i++) if (OWNER[i][0].test(controlId)) return OWNER[i][1];
    return null;
  }

  function stateOf(m) {
    try { return window.AROSTATE ? window.AROSTATE.state(m) : 'unknown'; } catch (e) { return 'unknown'; }
  }

  /* ══ ASSESS ═════════════════════════════════════════════════════════════
     What a set of pending changes would do. Reported per design, and split
     by consequence — a design that has never been run cannot be superseded
     by anything, and saying it would be overstates the damage. */
  function assess(changes) {
    var out = { changes: [], supersede: [], untouched: [], missing: [] };
    (changes || []).forEach(function (c) {
      var m = ownerOf(c.id);
      var st = m ? stateOf(m) : null;
      var row = {
        id: c.id, module: c.module || c.id, field: c.field || '',
        from: c.from, to: c.to, owner: m, state: st
      };
      out.changes.push(row);
      if (!m) out.missing.push(row);
      else if (st === 'CALCULATED') out.supersede.push(row);
      else out.untouched.push(row);
    });
    return out;
  }

  /* ══ REVISION LOG ═══════════════════════════════════════════════════════ */
  var KEY = 'aro_revisions_v1';
  function revisions() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function engineer() {
    try {
      var b = window.AROENGDATA ? window.AROENGDATA.basis() : {};
      if (b && b.engineer) return b.engineer;
    } catch (e) {}
    try {
      var s = JSON.parse(localStorage.getItem('aro_session_v1') || '{}');
      return s.name || (s.email ? String(s.email).split('@')[0] : '') || 'Not recorded';
    } catch (e) {}
    return 'Not recorded';
  }
  function log(entry) {
    var all = revisions();
    var rec = {
      rev: all.length + 1,
      at: Date.now(),
      engineer: engineer(),
      title: entry.title || 'Change',
      source: entry.source || 'User Override',
      reason: entry.reason || null,
      changes: (entry.changes || []).map(function (c) {
        return { module: c.module, field: c.field, from: c.from, to: c.to, owner: c.owner };
      }),
      superseded: (entry.superseded || []).map(function (c) { return c.module; }),
      outcome: entry.outcome || null
    };
    all.push(rec);
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
    render(true);
    return rec;
  }
  function clearLog() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    render(true);
  }

  /* ══ THE CONFIRMATION ═══════════════════════════════════════════════════
     Deliberately not window.confirm. A native dialog cannot show which
     designs are finished and which are not, and that distinction is the only
     reason to stop and read. It also cannot take a reason, and a revision
     with a reason is worth several without one. */
  var CSSID = 'aro-impact-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      '.im-back{position:fixed;inset:0;background:rgba(2,6,16,.72);z-index:99998;',
      '  display:flex;align-items:center;justify-content:center;padding:20px;}',
      /* The dialog sits over a dark scrim and carries its own palette rather
         than inheriting the page's. Inheriting put the light theme's dark
         text on this dark panel and most of the sentence disappeared. */
      '.im-box{background:#0f172a;color:#e2e8f0;border:1px solid #334155;',
      '  border-radius:8px;max-width:660px;width:100%;max-height:86vh;overflow-y:auto;',
      '  box-shadow:0 24px 60px rgba(0,0,0,.5);}',
      '.im-h{padding:14px 18px;border-bottom:1px solid #334155;}',
      '.im-h b{font-family:var(--font-mono);font-size:12px;letter-spacing:.09em;color:#fbbf24;}',
      '.im-b{padding:14px 18px;font-size:12px;line-height:1.6;}',
      '.im-sec{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.08em;',
      '  color:#94a3b8;margin:12px 0 6px;}',
      '.im-r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:6px 9px;',
      '  border:1px solid #334155;border-left-width:3px;border-radius:4px;margin-bottom:5px;color:#e2e8f0;}',
      '.im-r.sup{border-left-color:#fbbf24;}',
      '.im-r.ok{border-left-color:#4ade80;}',
      '.im-r.bad{border-left-color:#f87171;}',
      '.im-m{font-family:var(--font-mono);font-weight:700;font-size:11px;}',
      '.im-v{font-size:10.5px;color:#94a3b8;margin-top:2px;}',
      '.im-v b{color:#e2e8f0;}',
      '.im-s{font-family:var(--font-mono);font-size:8.5px;letter-spacing:.05em;align-self:center;}',
      '.im-s.sup{color:#fbbf24;} .im-s.ok{color:#4ade80;} .im-s.bad{color:#f87171;}',
      '.im-lead{font-size:12.5px;line-height:1.65;color:#cbd5e1;}',
      '.im-lead b{color:#fbbf24;}',
      '.im-reason{width:100%;margin-top:10px;background:rgba(148,163,184,.10);',
      '  border:1px solid #334155;border-radius:4px;padding:8px 9px;',
      '  color:#e2e8f0;font-size:11.5px;font-family:inherit;resize:vertical;min-height:54px;}',
      '.im-f{padding:12px 18px;border-top:1px solid #334155;',
      '  display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;}',
      '.im-btn{font-family:var(--font-mono);font-size:10.5px;font-weight:700;letter-spacing:.05em;',
      '  padding:9px 15px;border-radius:5px;cursor:pointer;border:1px solid #475569;',
      '  background:transparent;color:#cbd5e1;}',
      '.im-btn.go{background:#f59e0b;border-color:#f59e0b;color:#1a1204;}',
      '#aro-imp{margin-top:18px;border:1px solid var(--border-muted);border-radius:6px;overflow:hidden;}',
      '.iv-h{background:rgba(251,191,36,.08);border-bottom:1px solid var(--border-muted);padding:10px 12px;}',
      '.iv-h b{font-family:var(--font-mono);font-size:12px;letter-spacing:.09em;color:#fbbf24;}',
      '.iv-sub{font-size:10.5px;color:var(--text-muted);margin-top:3px;line-height:1.5;}',
      '.iv-r{padding:9px 12px;border-bottom:1px dashed var(--border-muted);font-size:11px;line-height:1.6;}',
      '.iv-t{font-family:var(--font-mono);font-size:10px;font-weight:800;}',
      '.iv-rev{color:#fbbf24;}',
      '.iv-meta{font-size:9.5px;color:var(--text-muted);margin-top:2px;}',
      '.iv-ch{font-size:10.5px;margin-top:4px;}',
      '.iv-ch code{font-family:var(--font-mono);font-size:10px;}',
      '.iv-why{font-size:10.5px;color:#93c5fd;border-left:2px solid #38bdf8;padding-left:7px;margin-top:5px;}',
      '.iv-empty{padding:20px 12px;font-size:11px;color:var(--text-muted);line-height:1.6;}',
      '.iv-bar{padding:9px 12px;border-bottom:1px solid var(--border-muted);}',
      /* The panel is on the page, so its button follows the page theme. It
         had been borrowing the dialog's palette, which is fixed dark, and
         went nearly invisible on the light one. */
      '.iv-btn{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.05em;',
      '  padding:7px 12px;border-radius:4px;cursor:pointer;border:1px solid var(--border-muted);',
      '  background:transparent;color:var(--text-muted);}',
      '.iv-btn:hover{border-color:#f87171;color:#f87171;}'
    ].join('');
    document.head.appendChild(s);
  }

  function row(r, cls, note) {
    return '<div class="im-r ' + cls + '"><div><div class="im-m">' + esc(r.module) + '</div>'
      + '<div class="im-v">' + esc(String(r.from == null || r.from === '' ? '—' : r.from))
      + ' &rarr; <b>' + esc(String(r.to == null ? '—' : r.to)) + '</b></div></div>'
      + '<div class="im-s ' + cls + '">' + esc(note) + '</div></div>';
  }

  /* Shows the consequence, takes a reason, and calls back only on confirm. */
  function confirmChange(o, onOk) {
    css();
    var a = assess(o.changes);
    var back = document.createElement('div');
    back.className = 'im-back';
    var n = a.supersede.length;
    /* What actually happens to a finished design depends on the module. The
       pump recalculates as its inputs change — changing its fluid moved the
       head from 33.46 m to 24.52 m and republished, so it stays current and
       correct. Others hold their last result and are marked superseded.

       Predicting which is which would be guesswork, so the preview states
       both outcomes and the revision records the one that occurred, measured
       after the change rather than assumed before it. */
    back.innerHTML = '<div class="im-box">'
      + '<div class="im-h"><b>' + esc(o.title || 'PROPERTY CHANGE IMPACT') + '</b></div>'
      + '<div class="im-b">'
      + '<div class="im-lead">'
      + (n
        ? '<b>' + n + ' finished design' + (n === 1 ? ' is' : 's are') + ' affected.</b> '
          + 'A module that recalculates as its inputs change will update in place and stay '
          + 'current; one that does not keeps its results and its report, marked superseded, '
          + 'and waits for you to re-run it. Nothing is re-run on your behalf, and the '
          + 'revision records which of the two actually happened.'
        : 'No finished design is affected. Nothing here has been calculated yet, so there is '
          + 'nothing to supersede.')
      + '</div>'
      + (a.supersede.length ? '<div class="im-sec">FINISHED DESIGNS AFFECTED</div>'
        + a.supersede.map(function (r) { return row(r, 'sup', 'CALCULATED'); }).join('') : '')
      + (a.untouched.length ? '<div class="im-sec">CHANGED, NOTHING TO SUPERSEDE</div>'
        + a.untouched.map(function (r) { return row(r, 'ok', r.state || '—'); }).join('') : '')
      + (a.missing.length ? '<div class="im-sec">NOT LINKED TO A DESIGN MODULE</div>'
        + a.missing.map(function (r) { return row(r, 'bad', 'NO OWNER'); }).join('') : '')
      + '<div class="im-sec">REASON FOR THE CHANGE (OPTIONAL)</div>'
      + '<textarea class="im-reason" id="im-reason" placeholder="Why is this value changing? '
      + 'A revision with a reason is worth several without one."></textarea>'
      + '</div>'
      + '<div class="im-f"><button class="im-btn" data-im="cancel">CANCEL</button>'
      + '<button class="im-btn go" data-im="go">'
      + (n ? 'UPDATE &amp; RECORD THE IMPACT' : 'UPDATE') + '</button></div>'
      + '</div>';
    document.body.appendChild(back);
    var reason = back.querySelector('#im-reason');
    if (reason) setTimeout(function () { reason.focus(); }, 30);

    function close() { if (back.parentNode) back.parentNode.removeChild(back); }
    back.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-im]') : null;
      if (!t) { if (e.target === back) close(); return; }
      e.preventDefault();
      var go = t.getAttribute('data-im') === 'go';
      var why = reason ? reason.value.trim() : '';
      close();
      if (!go) return;

      /* What each affected design looked like immediately before the change,
         so the outcome can be measured rather than assumed. */
      var beforeAt = {};
      a.supersede.forEach(function (r) {
        try { beforeAt[r.owner] = window.AROSTATE ? window.AROSTATE.at(r.owner) : 0; }
        catch (x) { beforeAt[r.owner] = 0; }
      });

      var applied = onOk ? onOk() : null;

      /* A live recalculation lands asynchronously; wait for it before
         deciding what happened. */
      setTimeout(function () {
        var outcome = a.supersede.map(function (r) {
          var st = stateOf(r.owner), at = 0;
          try { at = window.AROSTATE ? window.AROSTATE.at(r.owner) : 0; } catch (x) {}
          var what = st === 'OUTDATED' ? 'superseded'
            : (at > (beforeAt[r.owner] || 0) ? 'recalculated in place' : 'unchanged');
          return { module: r.module, owner: r.owner, state: st, outcome: what };
        });
        log({
          title: o.title || 'Property change',
          source: o.source || 'User Override',
          reason: why || null,
          changes: a.changes,
          superseded: a.supersede,
          outcome: outcome
        });
        if (o.after) o.after(applied);
      }, 600);
    }, true);
    return back;
  }

  /* ══ THE REVISION PANEL ═════════════════════════════════════════════════ */
  function when(ms) {
    if (!ms) return '—';
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }

  function html() {
    var all = revisions().slice().reverse();
    return '<div id="aro-imp">'
      + '<div class="iv-h"><b>REVISION HISTORY</b>'
      + '<div class="iv-sub">Every applied change to a shared property, with the value it '
      + 'replaced, who applied it, when, which designs it superseded and why — where a reason '
      + 'was given. A superseded design says it needs recalculating; this says what moved '
      + 'underneath it.</div></div>'
      + (all.length
        ? '<div class="iv-bar"><button class="iv-btn" data-im-clear="1">CLEAR HISTORY</button></div>'
          + all.map(function (r) {
            return '<div class="iv-r">'
              + '<div class="iv-t"><span class="iv-rev">REV '
              + String(r.rev).padStart(2, '0') + '</span> &nbsp; ' + esc(r.title) + '</div>'
              + '<div class="iv-meta">' + esc(when(r.at)) + ' &nbsp;·&nbsp; ' + esc(r.engineer)
              + ' &nbsp;·&nbsp; ' + esc(r.source) + '</div>'
              + (r.changes || []).map(function (c) {
                return '<div class="iv-ch">' + esc(c.module) + ': <code>'
                  + esc(String(c.from == null || c.from === '' ? '—' : c.from)) + '</code> &rarr; <code>'
                  + esc(String(c.to == null ? '—' : c.to)) + '</code></div>';
              }).join('')
              + (r.outcome && r.outcome.length
                ? r.outcome.map(function (o2) {
                  return '<div class="iv-meta">' + esc(o2.module) + ' — ' + esc(o2.outcome)
                    + ' (' + esc(o2.state) + ')</div>';
                }).join('')
                : (r.superseded && r.superseded.length
                  ? '<div class="iv-meta">Affected: ' + esc(r.superseded.join(', ')) + '</div>'
                  : '<div class="iv-meta">No finished design was affected.</div>'))
              + (r.reason ? '<div class="iv-why">' + esc(r.reason) + '</div>' : '')
              + '</div>';
          }).join('')
        : '<div class="iv-empty">No changes recorded yet. Adopting the design basis into a '
          + 'module, or changing a shared property, is logged here with its impact.</div>')
      + '</div>';
  }

  function render(force) {
    var tab = document.getElementById('project-tab');
    if (!tab || !tab.offsetParent) return;
    css();
    var host = document.getElementById('aro-imp-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aro-imp-host';
      tab.appendChild(host);
    }
    var sig = String(revisions().length);
    if (!force && host.getAttribute('data-sig') === sig) return;
    host.setAttribute('data-sig', sig);
    try { host.innerHTML = html(); } catch (e) { host.innerHTML = ''; }
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-im-clear]') : null;
    if (t) {
      e.preventDefault();
      if (window.confirm('Clear the revision history? The designs themselves are not touched.')) clearLog();
      return;
    }
    setTimeout(function () { render(false); }, 80);
  }, true);

  window.AROIMPACT = {
    assess: assess,
    confirm: confirmChange,
    log: log,
    revisions: revisions,
    clear: clearLog,
    ownerOf: ownerOf,
    render: function () { render(true); }
  };

  /* ══ WIRING THE ADOPTION PATH THROUGH IT ════════════════════════════════
     The registry owns adoption and keeps owning it. What is intercepted is
     the decision: adopt() applied a value to a module with no confirmation
     at all, and adoptAll() asked a native dialog that could not tell a
     finished design from an empty one. Both now go through the impact
     preview, and both are recorded afterwards.

     Wrapping rather than editing keeps the registry's own behaviour intact —
     if this file is absent, adoption still works exactly as it did. */
  function wire() {
    var D = window.AROENGDATA;
    if (!D || D.__impactWired) return !!D;
    D.__impactWired = true;

    var rawAdopt = D.adopt, rawAdoptAll = D.adoptAll;

    D.adopt = function (id, skipConfirm) {
      if (skipConfirm) return rawAdopt(id);
      var rows = [];
      try {
        (D.compare() || []).forEach(function (c) {
          if (c.id !== id) return;
          rows.push({ id: c.id, module: c.module, field: c.field,
            from: c.module_value, to: c.adoptText });
        });
      } catch (e) {}
      if (!rows.length) return rawAdopt(id);
      confirmChange({
        title: 'ADOPT THE DESIGN BASIS — ' + rows[0].module,
        source: 'Design basis', changes: rows
      }, function () { return rawAdopt(id); });
      return true;
    };

    D.adoptAll = function () {
      var list = [];
      try { list = D.adoptable() || []; } catch (e) {}
      if (!list.length) return 0;
      var rows = list.map(function (c) {
        return { id: c.id, module: c.module, field: c.field,
          from: c.module_value, to: c.adoptText };
      });
      confirmChange({
        title: 'ADOPT THE DESIGN BASIS IN ' + rows.length + ' MODULE'
          + (rows.length === 1 ? '' : 'S'),
        source: 'Design basis', changes: rows
      }, function () {
        var n = 0;
        list.forEach(function (c) { if (rawAdopt(c.id)) n++; });
        return n;
      });
      return rows.length;
    };
    return true;
  }

  /* The ADOPT buttons are handled by a capture-phase listener inside the
     registry, which calls its own internal adopt() — so wrapping the exported
     one caught programmatic calls and missed every click, which is the path
     an engineer actually uses. Capture on window runs before capture on
     document, so this sees the click first, stops it there and routes it
     through the impact preview. */
  function intercept(e) {
    var t = e.target && e.target.closest
      ? e.target.closest('[data-ed-adopt],[data-ed-adopt-all]') : null;
    if (!t) return;
    var D = window.AROENGDATA;
    if (!D) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    if (t.hasAttribute('data-ed-adopt-all')) D.adoptAll();
    else D.adopt(t.getAttribute('data-ed-adopt'));
  }

  function boot() {
    window.addEventListener('click', intercept, true);
    var tries = 0;
    var iv = setInterval(function () {
      if (wire() || ++tries > 40) clearInterval(iv);
    }, 400);
    var iv2 = setInterval(function () {
      var tab = document.getElementById('project-tab');
      if (tab && tab.offsetParent) { render(true); clearInterval(iv2); }
    }, 700);
    setTimeout(function () { clearInterval(iv2); }, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
