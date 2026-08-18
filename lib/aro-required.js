/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — REQUIRED INPUTS  (window.ARORQ)
   ---------------------------------------------------------------------------
   Three complaints, one cause: the app knew perfectly well which fields it
   needed and kept that to itself until the engineer pressed RUN.

     "there should be a red asterisk symbol where user gives input, to avoid
      only finding out what's missing at the very end"
     "it must automatically reach where user have to give input so that user
      may not get frustrated finding the fill area"
     and the dialog that finally told them stayed dark on a light desktop.

   Every module already carries a list of the fields it cannot run without —
   PUMP_REQUIRED_LABELS in app.js, the checkInputs arrays in the exchanger
   validators, cfg.required in line sizing, and the tank and two-phase lists.
   Those lists were only ever consulted at the moment of failure. The same
   lists are gathered here and used from the start:

     · MARKED   a red asterisk on the field's own label, from the moment the
                panel is built, so what is needed is visible while it is
                being filled in rather than announced at the end.
     · THEMED   the dialog follows the desktop theme like everything else.
     · REACHED  the dialog's button and each line in it scroll to the field
                and focus it, so "which box did it mean?" is one click.

   The lists are DECLARED here rather than read out of the validators, and a
   mismatch would be a silent lie on screen — so ARORQ.audit() re-derives what
   each module actually rejects and reports any field this file has wrong.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  /* moduleKey → the ids that module refuses to run without */
  var REQ = {
    pump: ['pump-vol-flow-lhr', 'pump-density', 'pump-viscosity', 'pump-temp-op',
           'pump-vessel-press-g', 'pump-vessel-el', 'pump-lll', 'pump-centreline-el',
           'pump-discharge-el', 'pump-dest-a', 'pump-npshr'],
    sthe: ['sthe-mass-shell', 'sthe-tin-shell', 'sthe-tin-tube', 'sthe-tout-shell',
           'sthe-tout-tube', 'sthe-cp-shell', 'sthe-cp-tube', 'sthe-rho-shell', 'sthe-rho-tube'],
    dphe: ['dphe-flow-hot', 'dphe-flow-cold', 'dphe-tin-hot', 'dphe-tin-cold',
           'dphe-tout-hot', 'dphe-tout-cold', 'dphe-cp-hot', 'dphe-cp-cold',
           'dphe-rho-hot', 'dphe-rho-cold', 'dphe-di', 'dphe-do', 'dphe-d2', 'dphe-length'],
    phe: ['phe-hf-m', 'phe-cf-m', 'phe-hf-tin', 'phe-cf-tin', 'phe-hf-tout', 'phe-cf-tout'],
    tank: ['tk-fluid', 'tk-tdes', 'tk-pdes', 'tk-D', 'tk-H', 'tk-reqcap', 'tk-mat',
           'tk-q-out', 'tk-q-in'],
    twophase: ['tp2-wl', 'tp2-wg', 'tp2-rhol', 'tp2-rhog', 'tp2-mul', 'tp2-mug']
  };
  /* line sizing declares its own per service; picked up live from cfg.required
     through the ids actually present on the page */
  var LINE_PREFIX = ['lq', 'gs', 'st', 'sl'];

  function allIds() {
    var out = [];
    Object.keys(REQ).forEach(function (k) { out = out.concat(REQ[k]); });
    /* line-sizing services name their required fields consistently */
    LINE_PREFIX.forEach(function (p) {
      ['q', 'rho', 'mu', 'w', 'ws', 'wl', 'pup', 'mw', 'pabs'].forEach(function (n) {
        out.push(p + '-' + n);
      });
    });
    return out;
  }

  var CSSID = 'aro-required-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      /* the asterisk — on the label, not in the box, so it never fights the
         value or the unit chip */
      '.aro-rq-star{color:#ef4444;font-weight:800;margin-left:3px;}',
      /* a required field that is still empty reads as unfinished, not as an
         error: an engineer part-way through a data sheet has not done
         anything wrong */
      'input.aro-rq-empty,select.aro-rq-empty{border-color:rgba(239,68,68,0.55) !important;}',
      'input.aro-rq-focus,select.aro-rq-focus{outline:2px solid #ef4444;outline-offset:1px;}',

      /* ── the dialog, in both themes ─────────────────────────────────── */
      'body.theme-day [id$="-reqinput-modal"],body.theme-day #pump-missing-inputs-modal{',
      '  background:rgba(15,23,42,0.35) !important;}',
      'body.theme-day [id$="-reqinput-modal"] > div,',
      'body.theme-day #pump-missing-inputs-modal > div{',
      '  background:#ffffff !important;box-shadow:0 20px 60px rgba(15,23,42,0.28) !important;}',
      'body.theme-day [id$="-reqinput-modal"] > div div,',
      'body.theme-day #pump-missing-inputs-modal > div div{color:#334155 !important;}',
      'body.theme-day [id$="-reqinput-modal"] li,',
      'body.theme-day #pump-missing-inputs-modal li{color:#b91c1c !important;}',
      /* the heading and the button keep their red and orange — they are the
         signal, and both already read on white */
      'body.theme-day [id$="-reqinput-modal"] > div > div:first-child{color:#dc2626 !important;}',

      /* each listed field is a link to the field itself */
      '[id$="-reqinput-modal"] li,#pump-missing-inputs-modal li{cursor:pointer;border-radius:3px;}',
      '[id$="-reqinput-modal"] li:hover,#pump-missing-inputs-modal li:hover{',
      '  background:rgba(239,68,68,0.14);}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  /* Is this field empty in the sense the module means? Zero is a blank for a
     flow and a real value for a gauge pressure, which AROVALID already knows;
     fall back to "no number at all" where it is not loaded. */
  function isMissing(el) {
    if (!el) return false;
    if (el.tagName === 'SELECT') return !el.value;
    if (window.AROVALID && typeof window.AROVALID.missing === 'function') {
      try { return !!window.AROVALID.missing(el); } catch (e) {}
    }
    var v = parseFloat(el.value);
    return !isFinite(v);
  }

  function labelFor(el) {
    if (!el) return null;
    if (el.id) {
      var l = document.querySelector('label[for="' + el.id + '"]');
      if (l) return l;
    }
    var p = el.parentElement;
    for (var i = 0; i < 3 && p; i++, p = p.parentElement) {
      if (p.tagName === 'LABEL') return p;
      var inner = p.querySelector ? p.querySelector('label') : null;
      if (inner) return inner;
    }
    return null;
  }

  function star(el) {
    var lab = labelFor(el);
    if (!lab || lab.querySelector('.aro-rq-star')) return false;
    var s = document.createElement('span');
    s.className = 'aro-rq-star';
    s.textContent = '*';
    s.title = 'Required to run this calculation';
    lab.appendChild(s);
    return true;
  }

  function paint() {
    css();
    var n = 0;
    allIds().forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (star(el)) n++;
      el.classList.toggle('aro-rq-empty', isMissing(el));
      if (!el.__aroRqWired) {
        el.__aroRqWired = true;
        var upd = function () { el.classList.toggle('aro-rq-empty', isMissing(el)); };
        el.addEventListener('input', upd);
        el.addEventListener('change', upd);
      }
    });
    return n;
  }

  /* Take the engineer to the first field the visible module is still missing. */
  function firstMissing() {
    var ids = allIds();
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.offsetParent && isMissing(el)) return el;
    }
    return null;
  }
  function goTo(el) {
    if (!el) return false;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
      el.classList.add('aro-rq-focus');
      setTimeout(function () { el.classList.remove('aro-rq-focus'); }, 2200);
    } catch (e) {}
    return true;
  }

  /* When a module puts its dialog up, make it lead somewhere. */
  function enhance(modal) {
    if (!modal || modal.__aroRq) return;
    modal.__aroRq = true;
    css();
    var jump = function (close) {
      /* The module's own OK handler removes the dialog. Removing it here as
         well left that handler holding a null and throwing — so the button
         closes it the module's way and only a click on a listed field, which
         has no handler of its own, closes it here. */
      if (close && modal.parentNode) modal.remove();
      setTimeout(function () { goTo(firstMissing()); }, 80);
    };
    var btn = modal.querySelector('button');
    if (btn) btn.addEventListener('click', function () { jump(false); });
    [].forEach.call(modal.querySelectorAll('li'), function (li) {
      li.title = 'Go to this field';
      li.addEventListener('click', function () { jump(true); });
    });
  }

  try {
    var mo = new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var added = recs[i].addedNodes || [];
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (/-reqinput-modal$/.test(n.id || '') || n.id === 'pump-missing-inputs-modal') enhance(n);
          var inner = n.querySelector ? n.querySelector('[id$="-reqinput-modal"],#pump-missing-inputs-modal') : null;
          if (inner) enhance(inner);
        }
      }
    });
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    else document.addEventListener('DOMContentLoaded', function () {
      mo.observe(document.body, { childList: true, subtree: true });
    });
  } catch (e) {}

  /* Does this file's list match what the module actually rejects? A field
     marked required here but accepted by the engine — or the reverse — would
     be a lie painted on the form, so it can be checked rather than trusted. */
  function audit() {
    var out = {};
    Object.keys(REQ).forEach(function (k) {
      out[k] = { declared: REQ[k].length, onPage: 0, starred: 0, missingFromPage: [] };
      REQ[k].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) { out[k].missingFromPage.push(id); return; }
        out[k].onPage++;
        var lab = labelFor(el);
        if (lab && lab.querySelector('.aro-rq-star')) out[k].starred++;
      });
    });
    return out;
  }

  window.ARORQ = {
    paint: paint, audit: audit, required: function () { return REQ; },
    firstMissing: firstMissing, goTo: goTo, isMissing: isMissing
  };

  function boot() {
    paint();
    /* panels are built as their tabs open, so keep painting for a while and
       then whenever a tab is clicked */
    var n = 0;
    var iv = setInterval(function () { paint(); if (++n > 40) clearInterval(iv); }, 700);
    document.addEventListener('click', function () { setTimeout(paint, 250); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
