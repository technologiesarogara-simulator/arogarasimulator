/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA ENGINEERING DATA LIBRARY — RECORD STORE  (window.ARODATASTORE)
   ---------------------------------------------------------------------------
   Everything an engineer adds to the library, and everywhere a value is
   allowed to be replaced on the way to a calculation. The master library is
   read-only from the engineer's side; this file holds the layers above it.

   THE HIERARCHY, IN ORDER, AND IT IS NOT NEGOTIABLE:

       MASTER LIBRARY      what the library holds, shared by every project
            ↓
       PROJECT SELECTION   which subject this project has chosen
            ↓
       PROJECT OVERRIDE    a value this project uses instead, with a reason
            ↓
       MODULE MAPPING      that value bound to one object — E-101, P-201
            ↓
       MODULE OVERRIDE     a value that one object uses instead, with a reason
            ↓
       CALCULATION

   Each layer may replace the one above it and may not touch it. An override
   entered against E-101 does not change the project, and a project override
   does not change the master library — that is the whole reason the layers
   exist, and it is enforced here rather than trusted to the interface.

   AN OVERRIDE ALWAYS CARRIES ITS PREDECESSOR. Every override records what it
   replaced, who entered it, when, and why. A value that appears in a
   calculation can always be walked back to the layer it entered at, and the
   layer under it is still there.

   NOTHING HERE INVENTS A NUMBER. This store persists what an engineer typed
   and what they said about it. Where they typed nothing, nothing is stored,
   and the property stays NOT AVAILABLE.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var KEYS = {
    values: 'aro_dl_uservalues_v1',      /* master-level records an engineer added */
    subjects: 'aro_dl_usersubjects_v1',  /* materials / fluids an engineer created */
    projOv: 'aro_dl_projoverride_v1',    /* project-level replacements */
    maps: 'aro_dl_mappings_v1',          /* subject+property bound to an object */
    modOv: 'aro_dl_modoverride_v1',      /* object-level replacements */
    rev: 'aro_dl_revisions_v1',          /* every change, in order */
    props: 'aro_dl_userprops_v1'         /* properties added to the dictionary */
  };

  function read(k, dflt) {
    try {
      var raw = localStorage.getItem(k);
      if (!raw) return dflt;
      var v = JSON.parse(raw);
      return v == null ? dflt : v;
    } catch (e) { return dflt; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  var seq = 0;
  function uid(prefix) {
    seq++;
    return prefix + '-' + Date.now().toString(36) + '-' + seq.toString(36);
  }
  function who() {
    try {
      var a = window.AROAUTH && window.AROAUTH.user ? window.AROAUTH.user() : null;
      if (a && (a.name || a.email)) return a.name || a.email;
    } catch (e) {}
    return 'PROJECT ENGINEER';
  }
  function stamp() { return new Date().toISOString(); }

  /* ══ 1 · REVISION TRAIL ═════════════════════════════════════════════════
     Written by every mutating call below, so no path into the library can
     change a value without leaving a record of having done so. */
  function revisions() { return read(KEYS.rev, []); }
  function log(entry) {
    var list = revisions();
    list.unshift({
      id: uid('rev'), at: stamp(), by: who(),
      action: entry.action || 'CHANGE',
      layer: entry.layer || 'MASTER LIBRARY',
      subjectId: entry.subjectId || null,
      subjectName: entry.subjectName || null,
      property: entry.property || null,
      propertyLabel: entry.propertyLabel || null,
      from: entry.from == null ? null : entry.from,
      to: entry.to == null ? null : entry.to,
      reason: entry.reason || null,
      detail: entry.detail || null
    });
    if (list.length > 500) list.length = 500;
    write(KEYS.rev, list);
    return list[0];
  }

  /* ══ 2 · USER PROPERTY VALUES (MASTER LAYER, USER ORIGIN) ═══════════════
     A value an engineer entered against a library subject. It joins the
     master library as a record in its own right — it never overwrites a
     migrated or imported one, and it is stamped so it can never be mistaken
     for reference data. */
  function userValues() { return read(KEYS.values, []); }

  function addValue(rec) {
    if (!rec || !rec.subjectId || !rec.property) return null;
    var list = userValues();
    var row = {
      id: rec.id || uid('uv'),
      subjectId: rec.subjectId,
      property: rec.property,
      form: rec.form || 'CONSTANT',
      /* the figure exactly as the engineer typed it, with the unit they
         typed it in — the canonical SI is derived, never the other way */
      original: rec.original == null ? null : rec.original,
      originalUnit: rec.originalUnit || null,
      si: isFinite(rec.si) ? rec.si : null,
      siMin: isFinite(rec.siMin) ? rec.siMin : null,
      siMax: isFinite(rec.siMax) ? rec.siMax : null,
      table: rec.table || null,
      xProperty: rec.xProperty || 'temperature',
      xUnit: rec.xUnit || '°C',
      correlation: rec.correlation || null,
      categorical: rec.categorical || null,
      text: rec.text || null,
      condition: rec.condition || {},
      source: rec.source || {},
      status: rec.status || 'USER INPUT',
      note: rec.note || null,
      createdAt: rec.createdAt || stamp(),
      createdBy: rec.createdBy || who(),
      updatedAt: stamp()
    };
    var i = -1;
    list.forEach(function (x, n) { if (x.id === row.id) i = n; });
    if (i >= 0) { row.createdAt = list[i].createdAt; row.createdBy = list[i].createdBy; list[i] = row; }
    else list.push(row);
    write(KEYS.values, list);
    log({ action: i >= 0 ? 'VALUE EDITED' : 'VALUE ADDED', layer: 'MASTER LIBRARY',
      subjectId: row.subjectId, subjectName: rec.subjectName || null,
      property: row.property, propertyLabel: rec.propertyLabel || null,
      to: describe(row), reason: rec.reason || null });
    /* Adding or editing a value under a mapping's feet invalidates it. */
    markOutdated(row.subjectId, row.property, 'Library value changed');
    return row;
  }

  function removeValue(id) {
    var list = userValues();
    var gone = null;
    list = list.filter(function (x) {
      if (x.id === id) { gone = x; return false; }
      return true;
    });
    if (!gone) return false;
    write(KEYS.values, list);
    log({ action: 'VALUE REMOVED', layer: 'MASTER LIBRARY', subjectId: gone.subjectId,
      property: gone.property, from: describe(gone) });
    markOutdated(gone.subjectId, gone.property, 'Library value removed');
    return true;
  }

  function describe(v) {
    if (!v) return '';
    if (v.form === 'TABULAR' || v.form === 'CURVE') {
      return (v.table ? v.table.length : 0) + ' points vs ' + (v.xProperty || 'temperature');
    }
    if (v.form === 'RANGE') return v.siMin + ' … ' + v.siMax;
    if (v.form === 'CATEGORICAL') return String(v.categorical || '');
    if (v.form === 'TEXT') return String(v.text || '');
    if (v.form === 'CORRELATION') return String((v.correlation && v.correlation.expression) || 'correlation');
    return (v.original != null ? v.original + ' ' + (v.originalUnit || '') : String(v.si));
  }

  /* ══ 3 · USER SUBJECTS ══════════════════════════════════════════════════
     A material or fluid an engineer created — usually a grade the library
     does not carry, or a copy made to start from. A duplicate copies the
     source's values as records of their own; it does not alias them, so
     editing the copy cannot reach back into the original. */
  function userSubjects() { return read(KEYS.subjects, []); }

  function addSubject(s) {
    if (!s || !s.name || !s.kind) return null;
    var list = userSubjects();
    var id = s.id || (s.kind + ':user:' + String(s.name).toLowerCase().replace(/\s+/g, '-'));
    var dup = null;
    list.forEach(function (x) { if (x.id === id) dup = x; });
    if (dup) return dup;
    var row = {
      id: id, kind: s.kind, name: s.name,
      family: s.family || (s.kind === 'fluid' ? 'User Defined Fluids' : 'User Defined Materials'),
      identity: s.identity || {},
      composition: s.composition || [],
      copiedFrom: s.copiedFrom || null,
      origin: 'USER DEFINED',
      createdAt: stamp(), createdBy: who()
    };
    list.push(row);
    write(KEYS.subjects, list);
    log({ action: s.copiedFrom ? 'SUBJECT DUPLICATED' : 'SUBJECT CREATED',
      layer: 'MASTER LIBRARY', subjectId: id, subjectName: s.name,
      to: s.name, detail: s.copiedFrom ? 'copied from ' + s.copiedFrom : null });
    return row;
  }

  function removeSubject(id) {
    var list = userSubjects().filter(function (x) { return x.id !== id; });
    write(KEYS.subjects, list);
    write(KEYS.values, userValues().filter(function (v) { return v.subjectId !== id; }));
    log({ action: 'SUBJECT REMOVED', layer: 'MASTER LIBRARY', subjectId: id });
    return true;
  }

  function setComposition(id, rows) {
    var list = userSubjects();
    var found = false;
    list.forEach(function (x) {
      if (x.id === id) { x.composition = rows || []; found = true; }
    });
    if (!found) {
      /* Composition may be recorded against a migrated subject too; it is
         held here rather than in the master record, which stays read-only. */
      list.push({ id: id, kind: id.indexOf('fluid:') === 0 ? 'fluid' : 'material',
        name: id.split(':').slice(1).join(':'), compositionOnly: true,
        composition: rows || [], origin: 'COMPOSITION RECORD',
        createdAt: stamp(), createdBy: who() });
    }
    write(KEYS.subjects, list);
    log({ action: 'COMPOSITION RECORDED', layer: 'MASTER LIBRARY', subjectId: id,
      detail: (rows || []).length + ' elements' });
    return true;
  }
  function composition(id) {
    var out = [];
    userSubjects().forEach(function (x) {
      if (x.id === id && x.composition && x.composition.length) out = x.composition;
    });
    return out;
  }

  /* ══ 4 · USER PROPERTIES ════════════════════════════════════════════════
     A property the dictionary does not carry. It lands in the USER domain
     with a declared quantity, so it is stored canonically and converted
     like any other — a property outside the dictionary is still not
     allowed to be a loose number in an unstated unit. */
  function userProps() { return read(KEYS.props, []); }
  function addProp(p) {
    if (!p || !p.key || !p.label) return null;
    var list = userProps();
    var dup = null;
    list.forEach(function (x) { if (x.key === p.key) dup = x; });
    if (dup) return dup;
    var row = { key: p.key, label: p.label, domain: p.domain || 'USER',
      qty: p.qty || 'dimensionless', applies: p.applies || 'both',
      note: p.note || null, createdAt: stamp(), createdBy: who() };
    list.push(row);
    write(KEYS.props, list);
    log({ action: 'PROPERTY ADDED TO DICTIONARY', layer: 'MASTER LIBRARY',
      property: row.key, propertyLabel: row.label, to: row.label + ' (' + row.qty + ')' });
    return row;
  }
  function removeProp(key) {
    write(KEYS.props, userProps().filter(function (x) { return x.key !== key; }));
    log({ action: 'PROPERTY REMOVED FROM DICTIONARY', layer: 'MASTER LIBRARY', property: key });
    return true;
  }

  /* ══ 5 · PROJECT OVERRIDES ══════════════════════════════════════════════
     "On this project we use this number instead." The master record is
     untouched and still visible underneath. A reason is required — an
     override without one is how a project quietly diverges from its own
     library and nobody can say when. */
  function projectOverrides() { return read(KEYS.projOv, []); }

  function projectOverride(subjectId, property) {
    var hit = null;
    projectOverrides().forEach(function (x) {
      if (x.subjectId === subjectId && x.property === property) hit = x;
    });
    return hit;
  }

  function setProjectOverride(o) {
    if (!o || !o.subjectId || !o.property) return null;
    if (!o.reason) return { error: 'A project override must state why the library value is not used.' };
    var list = projectOverrides().filter(function (x) {
      return !(x.subjectId === o.subjectId && x.property === o.property);
    });
    var row = {
      id: uid('po'), subjectId: o.subjectId, subjectName: o.subjectName || null,
      property: o.property, propertyLabel: o.propertyLabel || null,
      form: o.form || 'CONSTANT',
      si: isFinite(o.si) ? o.si : null,
      original: o.original == null ? null : o.original,
      originalUnit: o.originalUnit || null,
      table: o.table || null, xProperty: o.xProperty || 'temperature', xUnit: o.xUnit || '°C',
      categorical: o.categorical || null, text: o.text || null,
      condition: o.condition || {},
      /* what it replaced, kept verbatim so the layer beneath is legible even
         if the master record later changes again */
      was: o.was || null,
      reason: o.reason,
      status: 'PROJECT OVERRIDE',
      at: stamp(), by: who()
    };
    list.push(row);
    write(KEYS.projOv, list);
    log({ action: 'PROJECT OVERRIDE', layer: 'PROJECT OVERRIDE', subjectId: row.subjectId,
      subjectName: row.subjectName, property: row.property, propertyLabel: row.propertyLabel,
      from: o.was || null, to: describe(row), reason: row.reason });
    markOutdated(row.subjectId, row.property, 'Project override applied');
    return row;
  }

  function clearProjectOverride(subjectId, property) {
    var gone = projectOverride(subjectId, property);
    write(KEYS.projOv, projectOverrides().filter(function (x) {
      return !(x.subjectId === subjectId && x.property === property);
    }));
    if (gone) {
      log({ action: 'PROJECT OVERRIDE CLEARED', layer: 'PROJECT OVERRIDE',
        subjectId: subjectId, property: property, from: describe(gone) });
      markOutdated(subjectId, property, 'Project override cleared');
    }
    return true;
  }

  /* ══ 6 · MODULE MAPPINGS ════════════════════════════════════════════════
     One subject's properties bound to one design object — E-101, P-201,
     LINE-14 — inside one module, with an explicit AROGARA PROPERTY →
     MODULE INPUT pair for each property. The mapping carries a status:
     CURRENT while what it points at has not moved, OUTDATED the moment it
     has. Nothing is pushed into a module input by creating a mapping. */
  function mappings() { return read(KEYS.maps, []); }

  function addMapping(m) {
    if (!m || !m.subjectId || !m.module) return null;
    var list = mappings();
    var row = {
      id: m.id || uid('map'),
      subjectId: m.subjectId, subjectName: m.subjectName || null, kind: m.kind || null,
      module: m.module, moduleLabel: m.moduleLabel || m.module,
      object: m.object || null,            /* E-101 — null means the whole module */
      objectLabel: m.objectLabel || null,
      /* [{ property, propertyLabel, input, inputLabel }] */
      pairs: m.pairs || [],
      status: 'CURRENT',
      statusReason: null,
      at: stamp(), by: who()
    };
    var i = -1;
    list.forEach(function (x, n) {
      if (x.subjectId === row.subjectId && x.module === row.module
        && (x.object || '') === (row.object || '')) i = n;
    });
    if (i >= 0) { row.id = list[i].id; row.at = list[i].at; list[i] = row; }
    else list.push(row);
    write(KEYS.maps, list);
    log({ action: i >= 0 ? 'DESIGN MAPPING UPDATED' : 'DESIGN MAPPING CREATED',
      layer: 'MODULE MAPPING', subjectId: row.subjectId, subjectName: row.subjectName,
      to: (row.object ? row.object + ' · ' : '') + row.moduleLabel + ' — '
        + row.pairs.length + ' properties' });
    return row;
  }

  function removeMapping(id) {
    var gone = null;
    write(KEYS.maps, mappings().filter(function (x) {
      if (x.id === id) { gone = x; return false; }
      return true;
    }));
    write(KEYS.modOv, moduleOverrides().filter(function (x) { return x.mappingId !== id; }));
    if (gone) {
      log({ action: 'DESIGN MAPPING REMOVED', layer: 'MODULE MAPPING',
        subjectId: gone.subjectId, from: (gone.object || gone.moduleLabel) });
    }
    return true;
  }

  function mappingsFor(subjectId, property) {
    return mappings().filter(function (m) {
      if (subjectId && m.subjectId !== subjectId) return false;
      if (!property) return true;
      return m.pairs.some(function (p) { return p.property === property; });
    });
  }

  /* A mapping goes OUTDATED when the value it points at moves — at any layer
     above it. It is never silently re-pointed: an engineer decides whether
     the new number is the one their design should use. */
  function markOutdated(subjectId, property, reason) {
    var list = mappings();
    var touched = 0;
    list.forEach(function (m) {
      if (m.subjectId !== subjectId) return;
      if (property && !m.pairs.some(function (p) { return p.property === property; })) return;
      if (m.status !== 'OUTDATED') {
        m.status = 'OUTDATED';
        m.statusReason = reason || 'Source value changed';
        m.outdatedAt = stamp();
        touched++;
      }
    });
    if (touched) {
      write(KEYS.maps, list);
      log({ action: 'MAPPINGS MARKED OUTDATED', layer: 'MODULE MAPPING',
        subjectId: subjectId, property: property || null,
        detail: touched + ' mapping' + (touched === 1 ? '' : 's') + ' — ' + (reason || '') });
    }
    return touched;
  }

  function acceptMapping(id) {
    var list = mappings();
    list.forEach(function (m) {
      if (m.id === id) { m.status = 'CURRENT'; m.statusReason = null; m.acceptedAt = stamp(); }
    });
    write(KEYS.maps, list);
    log({ action: 'MAPPING RE-ACCEPTED', layer: 'MODULE MAPPING', detail: id });
    return true;
  }

  /* ══ 7 · MODULE OVERRIDES ═══════════════════════════════════════════════
     The last layer before a calculation. Bound to one mapping, so an
     override on E-101 does not reach E-102 even though both use SS316L. */
  function moduleOverrides() { return read(KEYS.modOv, []); }

  function moduleOverride(mappingId, property) {
    var hit = null;
    moduleOverrides().forEach(function (x) {
      if (x.mappingId === mappingId && x.property === property) hit = x;
    });
    return hit;
  }

  function setModuleOverride(o) {
    if (!o || !o.mappingId || !o.property) return null;
    if (!o.reason) return { error: 'A module override must state why the project value is not used.' };
    var list = moduleOverrides().filter(function (x) {
      return !(x.mappingId === o.mappingId && x.property === o.property);
    });
    var row = {
      id: uid('mo'), mappingId: o.mappingId, object: o.object || null,
      subjectId: o.subjectId || null,
      property: o.property, propertyLabel: o.propertyLabel || null,
      form: o.form || 'CONSTANT',
      si: isFinite(o.si) ? o.si : null,
      original: o.original == null ? null : o.original,
      originalUnit: o.originalUnit || null,
      table: o.table || null, xProperty: o.xProperty || 'temperature', xUnit: o.xUnit || '°C',
      categorical: o.categorical || null, text: o.text || null,
      condition: o.condition || {},
      was: o.was || null, reason: o.reason,
      status: 'MODULE OVERRIDE', at: stamp(), by: who()
    };
    list.push(row);
    write(KEYS.modOv, list);
    log({ action: 'MODULE OVERRIDE', layer: 'MODULE OVERRIDE', subjectId: row.subjectId,
      property: row.property, propertyLabel: row.propertyLabel,
      from: o.was || null, to: describe(row), reason: row.reason,
      detail: o.object || null });
    return row;
  }

  function clearModuleOverride(mappingId, property) {
    var gone = moduleOverride(mappingId, property);
    write(KEYS.modOv, moduleOverrides().filter(function (x) {
      return !(x.mappingId === mappingId && x.property === property);
    }));
    if (gone) {
      log({ action: 'MODULE OVERRIDE CLEARED', layer: 'MODULE OVERRIDE',
        property: property, from: describe(gone), detail: gone.object || null });
    }
    return true;
  }

  /* ══ 8 · EXPORT / IMPORT OF THE WHOLE LAYER SET ═════════════════════════
     So a project's data decisions travel with the project rather than
     living only in one browser. */
  function exportAll() {
    return {
      format: 'AROGARA-DATALIB-PROJECT', version: 1, exportedAt: stamp(), exportedBy: who(),
      userValues: userValues(), userSubjects: userSubjects(), userProps: userProps(),
      projectOverrides: projectOverrides(), mappings: mappings(),
      moduleOverrides: moduleOverrides(), revisions: revisions()
    };
  }
  function importAll(pkg, mode) {
    if (!pkg || pkg.format !== 'AROGARA-DATALIB-PROJECT') {
      return { ok: false, error: 'Not an AROGARA data library package.' };
    }
    var counts = {};
    function put(key, incoming, matchOn) {
      var cur = read(key, []);
      var merged = mode === 'replace' ? [] : cur.slice();
      (incoming || []).forEach(function (row) {
        var dup = merged.some(function (x) {
          return matchOn.every(function (f) { return x[f] === row[f]; });
        });
        if (!dup) merged.push(row);
      });
      counts[key] = merged.length - (mode === 'replace' ? 0 : cur.length);
      write(key, merged);
    }
    put(KEYS.subjects, pkg.userSubjects, ['id']);
    put(KEYS.props, pkg.userProps, ['key']);
    put(KEYS.values, pkg.userValues, ['id']);
    put(KEYS.projOv, pkg.projectOverrides, ['subjectId', 'property']);
    put(KEYS.maps, pkg.mappings, ['subjectId', 'module', 'object']);
    put(KEYS.modOv, pkg.moduleOverrides, ['mappingId', 'property']);
    log({ action: 'PROJECT DATA IMPORTED', layer: 'PROJECT SELECTION',
      detail: JSON.stringify(counts) });
    return { ok: true, counts: counts };
  }

  function clearAll() {
    Object.keys(KEYS).forEach(function (k) {
      if (k === 'rev') return;                    /* the trail survives a reset */
      try { localStorage.removeItem(KEYS[k]); } catch (e) {}
    });
    log({ action: 'PROJECT DATA CLEARED', layer: 'PROJECT SELECTION' });
    return true;
  }

  window.ARODATASTORE = {
    KEYS: KEYS, uid: uid, who: who, describe: describe,

    revisions: revisions, log: log,

    userValues: userValues, addValue: addValue, removeValue: removeValue,
    userSubjects: userSubjects, addSubject: addSubject, removeSubject: removeSubject,
    setComposition: setComposition, composition: composition,
    userProps: userProps, addProp: addProp, removeProp: removeProp,

    projectOverrides: projectOverrides, projectOverride: projectOverride,
    setProjectOverride: setProjectOverride, clearProjectOverride: clearProjectOverride,

    mappings: mappings, addMapping: addMapping, removeMapping: removeMapping,
    mappingsFor: mappingsFor, markOutdated: markOutdated, acceptMapping: acceptMapping,

    moduleOverrides: moduleOverrides, moduleOverride: moduleOverride,
    setModuleOverride: setModuleOverride, clearModuleOverride: clearModuleOverride,

    exportAll: exportAll, importAll: importAll, clearAll: clearAll
  };
})();
