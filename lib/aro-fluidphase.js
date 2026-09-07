/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — FLUID BOILING / FREEZING POINT REFERENCE  (window.AROFLUIDPHASE)
   ---------------------------------------------------------------------------
   "user click all fluid properties cold and hot, they no idea about
    selected fluid at what temperature boil, freeze — add for STHE, DPHE, PHE"

   One shared table, because the three heat-exchanger modules already pick
   fluids from three separately-typed libraries (STHE_FLUIDS / DPHE_FLUIDS
   in app.js, FLUIDS in aro-phe.js) that don't share key names — a second
   copy of boiling/freezing data per module would drift the moment one of
   them changed a fluid list. This file only reads the DISPLAY NAME already
   sitting in each module's fluid-name field (the one thing all three
   agree on) and matches it, loosely, to one entry here.

   THE NUMBERS. Normal boiling point and freezing/melting point at 1 atm,
   standard chemical engineering reference values (Perry's, CRC, vendor
   datasheets for the antifreeze/brine mixtures). A process fluid's ACTUAL
   boiling point moves with operating pressure — these are the 1-atm
   reference point an engineer checks a duty against, not a substitute for
   a real vapour-pressure calculation. Said outright in the UI, not implied.

   WHAT "FREEZE" MEANS FOR AN OIL. A mineral or synthetic heat-transfer oil
   does not freeze sharply the way water does — the number given is its
   POUR POINT (where it stops flowing), the practical figure a plant heat-
   traces or drains against, and is labelled as such rather than as a true
   freezing point.

   WHAT THIS FILE DOES NOT DO. It does not feed the thermal or hydraulic
   calculation anywhere — advisory text only, so a wrong or missing match
   never changes a sizing result, only what an engineer is shown beside it.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* boil / freeze in °C at 1 atm. freeze is a pour point where noted. */
  var DATA = {
    'water': { boil: 100, freeze: 0 },
    'hot water': { boil: 100, freeze: 0 },
    'cooling water': { boil: 100, freeze: 0 },
    'seawater': { boil: 100.6, freeze: -2 },
    'sea water': { boil: 100.6, freeze: -2 },
    'steam condensate': { boil: 100, freeze: 0 },
    'steam': { boil: 100, freeze: 0, note: 'boiling point of the water it condenses from, at 1 atm' },
    'milk': { boil: 100.5, freeze: -0.5 },

    'ethylene glycol 30': { boil: 101, freeze: -15, note: 'aqueous mix; freeze point depends on the exact %' },
    'ethylene glycol 50': { boil: 107, freeze: -37, note: 'aqueous mix; freeze point depends on the exact %' },
    'propylene glycol 30': { boil: 101, freeze: -13, note: 'aqueous mix; freeze point depends on the exact %' },
    'propylene glycol 50': { boil: 106, freeze: -34, note: 'aqueous mix; freeze point depends on the exact %' },
    'brine cacl2 20': { boil: 103, freeze: -18, note: 'aqueous CaCl₂; freeze point depends on the exact %' },

    'therminol 66': { boil: 359, freeze: -9, note: 'freeze figure is the pour point, not a sharp freeze' },
    'therminol vp1': { boil: 257, freeze: 12, note: 'solidifies near room temperature — heat-traced in service' },
    'dowtherm a': { boil: 257, freeze: 12, note: 'solidifies near room temperature — heat-traced in service' },
    'hot oil': { boil: null, freeze: -9, note: 'no sharp boiling point; freeze figure is the pour point' },
    'thermal oil': { boil: null, freeze: -9, note: 'no sharp boiling point; freeze figure is the pour point' },

    'kerosene': { boil: 205, freeze: -40, note: 'boiling range ~150–250 °C; freeze figure is a typical pour point' },
    'diesel': { boil: 280, freeze: -15, note: 'boiling range ~180–360 °C; freeze figure is a typical pour point (grade-dependent)' },
    'gasoline': { boil: 100, freeze: -60, note: 'boiling range ~30–200 °C' },
    'naphtha': { boil: 100, freeze: -60, note: 'boiling range ~30–200 °C' },
    'crude oil (light)': { boil: null, freeze: -10, note: 'boiling range varies widely; freeze figure is an indicative pour point' },
    'crude oil (heavy)': { boil: null, freeze: 15, note: 'boiling range varies widely; freeze figure is an indicative pour point — waxy heavy crudes can be much higher' },
    'crude oil': { boil: null, freeze: -5, note: 'boiling range varies widely; freeze figure is an indicative pour point' },
    'vegetable oil': { boil: null, freeze: 5, note: 'no sharp boiling point; freeze figure is an indicative cloud point' },
    'natural gas': { boil: -162, freeze: null, note: 'mainly methane' },

    'methanol': { boil: 64.7, freeze: -97.6 },
    'ethanol': { boil: 78.3, freeze: -114 },
    'toluene': { boil: 110.6, freeze: -95 },
    'benzene': { boil: 80.1, freeze: 5.5, note: 'freezes just below room temperature — a real design point' },
    'acetone': { boil: 56, freeze: -95 },
    'xylene': { boil: 144, freeze: -25 },
    'mek': { boil: 79.6, freeze: -86 },
    'chlorobenzene': { boil: 131, freeze: -45 },
    'aniline': { boil: 184, freeze: -6 },
    'acetic acid': { boil: 118, freeze: 16.6, note: 'glacial acetic acid freezes near room temperature — commonly heat-traced' },
    'sulfuric acid 98': { boil: 290, freeze: 3, note: '98% acid freezes near 3 °C — commonly heat-traced' },
    'caustic soda 50': { boil: 140, freeze: 12, note: '50% NaOH solidifies near 12 °C — always heat-traced in service' },
    'glycerol': { boil: 290, freeze: 18, note: 'solidifies near room temperature' },
    'hexane': { boil: 69, freeze: -95 },
    'heptane': { boil: 98, freeze: -91 },
    'styrene': { boil: 145, freeze: -30 },

    'ammonia': { boil: -33.3, freeze: -77.7, note: 'boils well below room temperature at 1 atm — "liquid ammonia" in service is under pressure' },
    'r134a': { boil: -26.3, freeze: -108, note: 'a refrigerant — liquid in service only because it is kept under pressure' },

    'air': { boil: -194, freeze: null },
    'nitrogen': { boil: -196, freeze: -210 },
    'hydrogen': { boil: -253, freeze: -259 },
    'co2': { boil: -78.5, freeze: -56.6, note: 'sublimes at 1 atm rather than melting; the freeze figure is its triple point (5.1 atm)' }
  };

  /* A handful of spellings/synonyms this app's three fluid libraries use
     for the same substance. Checked AFTER the plain normalize() below has
     already stripped punctuation/percent signs/parentheticals, so entries
     here are themselves pre-normalized. */
  var ALIAS = {
    'sea water 25c': 'seawater',
    'water 25c': 'water',
    'hot water 80c': 'hot water',
    'cooling water 32c': 'cooling water',
    'naoh 50': 'caustic soda 50',
    'glycerin': 'glycerol',
    'nhexane': 'hexane',
    'nheptane': 'heptane',
    'acetic acid glacial': 'acetic acid',
    'ammonia liq': 'ammonia',
    'ammonia liquid': 'ammonia',
    'co2 gas': 'co2',
    'nitrogen gas': 'nitrogen',
    'hydrogen gas': 'hydrogen',
    'air 1 atm': 'air',
    'steam lp 2 bar': 'steam',
    'steam lp': 'steam',
    'custom manual': null,
    'user defined': null
  };

  function normalize(name) {
    if (!name) return '';
    var s = String(name).toLowerCase();
    s = s.replace(/\([^)]*\)/g, ' ');           // drop parenthetical notes
    s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, function (c) {
      return '0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(c)];
    });
    s = s.replace(/%/g, ' ');
    s = s.replace(/-/g, '');                    // "n-hexane" / "R-134a" / "VP-1" join up, not split
    s = s.replace(/[^a-z0-9]+/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  /* info(name) -> { boil, freeze, note, label } | null. boil/freeze are
     °C at 1 atm or null when there is no meaningful single figure
     (natural gas, air — no ordinary-service freeze point). label is the
     matched substance name, so the UI can say what it matched against
     when the typed name isn't a literal match. */
  function info(name) {
    var key = normalize(name);
    if (!key) return null;
    if (ALIAS.hasOwnProperty(key)) {
      if (ALIAS[key] === null) return null;
      key = ALIAS[key];
    }
    var d = DATA[key];
    if (!d) return null;
    return { boil: d.boil, freeze: d.freeze, note: d.note || '', label: key };
  }

  /* A short, ready-to-insert line: "Boiling 100 °C · Freezing 0 °C (1 atm)"
     with whichever half is unavailable dropped, and the pour-point/other
     note appended when the entry carries one. null in means "show nothing"
     (name field blank or not recognised) rather than a placeholder dash —
     an unmatched fluid is common (many are free-typed) and is not itself
     something to flag. */
  function line(name) {
    var d = info(name);
    if (!d) return '';
    var parts = [];
    if (d.boil != null) parts.push('Boiling ' + Math.round(d.boil * 10) / 10 + ' °C');
    if (d.freeze != null) parts.push('Freezing ' + Math.round(d.freeze * 10) / 10 + ' °C');
    if (!parts.length) return '';
    return parts.join(' · ') + ' (at 1 atm)' + (d.note ? ' — ' + d.note : '');
  }

  /* Compares an operating temperature against the matched fluid's boiling
     point, for a quick "is the phase you picked plausible" check — a
     stream entered as Liquid at 120 °C when its fluid boils at 100 °C (1
     atm) usually means either the phase pick or the operating pressure
     needs a second look, not a silent pass. Advisory text only. */
  function phaseNote(name, tempC) {
    var d = info(name);
    if (!d || d.boil == null || !isFinite(tempC)) return '';
    if (tempC > d.boil + 2) {
      return '⚠ ' + Math.round(tempC) + ' °C is above this fluid\'s ' + Math.round(d.boil)
        + ' °C boiling point at 1 atm — check the phase selected, or confirm the line is above atmospheric pressure.';
    }
    return '';
  }

  window.AROFLUIDPHASE = { info: info, line: line, phaseNote: phaseNote, normalize: normalize };
})();
