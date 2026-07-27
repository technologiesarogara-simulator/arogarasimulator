/* ══════════════════════════════════════════════════════════════════════
   AROGARA — "USER DEFINED" FIELD CLEARING  (window.AROUSERDEF)

   Every system in the suite has selectors that auto-fill numeric fields
   from a library (fluid, material, C-factor, tube metal …). When the
   engineer picks the "User defined" / "Custom" entry, the fields must be
   BLANK so they type their own value — leaving the previous library
   numbers behind is how wrong properties silently reach a design.

   This module registers one delegated 'change' listener on the document,
   so it also covers panels that are mounted later (PHE, Tank, Two-phase).
   It runs after the module's own handler, so clearing always wins.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* selectId → { values: option values that mean "user defined",
                  fields: input ids to blank } */
  var MAP = {
    /* 01 · PUMP SIZING */
    'pump-fluid': {
      values: ['custom', 'user_defined'],
      fields: ['pump-density', 'pump-viscosity', 'pump-vapor-pres', 'pump-temp-min', 'pump-temp-norm', 'pump-temp-max']
    },
    /* 02 · LINE SIZING — liquid */
    'line-fluid':    { values: ['custom', 'user_defined'], fields: ['line-density', 'line-viscosity'] },
    'line-material': { values: ['custom'],                 fields: ['line-roughness'] },
    'line-c-factor': { values: ['custom'],                 fields: ['line-c-factor-val'] },
    /* 02 · LINE SIZING — gas */
    'gas-fluid':     { values: ['User'], fields: ['gas-mw', 'gas-viscosity', 'gas-gamma'] },
    'gas-material':  { values: ['User'], fields: ['gas-roughness'] },
    /* 03 · HEAT EXCHANGER — STHE */
    'sthe-tube-mat': { values: ['custom'], fields: ['sthe-kw', 'sthe-rdi', 'sthe-rdo'] },
    /* 02 · LINE SIZING — two-phase */
    /* The fluid pair fixes both phases, so every property it implies clears —
       not just the surface tension read from the σ table. */
    'tp2-pair':      { values: ['User defined'], fields: ['tp2-sigma', 'tp2-rhol', 'tp2-rhog', 'tp2-mul', 'tp2-mug'] }
  };

  /* Some selectors carry the "user defined" meaning in the option TEXT
     rather than a fixed value (dynamically built dropdowns). */
  var TEXT_RE = /^\s*(?:—\s*)?(?:user[\s-]*defined|custom(?:\s*\(manual\))?)\s*(?:—\s*)?$/i;

  function isUserDefined(sel, cfg) {
    var v = sel.value;
    if (cfg && cfg.values.indexOf(v) !== -1) return true;
    var opt = sel.options && sel.options[sel.selectedIndex];
    return !!(opt && TEXT_RE.test(opt.textContent || ''));
  }

  function blank(ids) {
    ids.forEach(function (id) {
      var e = document.getElementById(id);
      if (!e) return;
      // Value only — no synthetic 'input' event. Some modules auto-fill a
      // blank field from a neighbouring one (pump vapour pressure follows
      // max temperature), which would immediately undo the clearing.
      e.value = '';
    });
  }

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t || t.tagName !== 'SELECT' || !t.id) return;
    var cfg = MAP[t.id];
    if (!cfg) return;
    if (isUserDefined(t, cfg)) blank(cfg.fields);
  }, false);

  window.AROUSERDEF = { map: MAP, blank: blank, isUserDefined: isUserDefined };
})();
