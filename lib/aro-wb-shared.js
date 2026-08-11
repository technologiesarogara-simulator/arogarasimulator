/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — ONE COMPONENT LIBRARY, SHARED WITH THE WORKBENCH
   ---------------------------------------------------------------------------
   The engineering modules build their equipment from lib/aro-parts3d.js.
   Where the ARO Workbench places the same thing — a pump, a gate valve, a
   flange, an elbow, a tee, a reducer, a gauge, a support — it now places the
   SAME component rather than a second drawing of it. One library, one set of
   proportions, one place to correct a mistake.

   THREE THINGS THIS IS CAREFUL ABOUT

   · IT DOES NOT REPLACE THE WORKBENCH LIBRARY. Only the classes that genuinely
     overlap with the engineering modules are swapped. Everything else — the
     columns, reactors, air coolers, transformers, safety posts, the whole rest
     of the catalogue — is untouched, because there is nothing to share it with.

   · IT KEEPS THE PROPERTIES. Each Workbench item carries a property sheet that
     the selection panel, the report and the datasheet all read. The original
     factory is called once for its properties, and those are carried onto the
     shared component, so nothing downstream sees a change.

   · IT KEEPS THE CANVAS WORKING. The Workbench is a layout canvas on a 13-unit
     grid, not a scaled plant model — its own gate valve is 2 units long beside
     a pump on a 5.2-unit baseplate, which is not one scale. The shared
     component is built at true engineering proportions and then normalised to
     the footprint the Workbench builder used, so every existing layout, port,
     pipe run and export behaves exactly as before.

   If the library is missing, or a shared build throws, the original factory is
   restored for that item. A visual upgrade must never cost the engineer a
   component they were able to place yesterday.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  /* key → the footprint the Workbench's own builder occupied, in canvas units.
     Measured from lib/aro-workbench-3d.js so placement is unchanged. */
  var SPAN = {
    'centrifugal-pump': 5.2,
    'gate-valve': 2.2, 'ball-valve': 2.2, 'globe-valve': 2.2,
    'butterfly-valve': 2.2, 'check-valve': 2.2, 'control-valve': 2.6,
    'flange-fitting': 2.0,
    'elbow90': 2.8, 'elbow45': 2.8,
    'tee-fitting': 2.4, 'reducer-fitting': 2.2,
    'gauge': 1.6, 'support': 2.2
  };

  function three() { return typeof THREE !== 'undefined' ? THREE : null; }

  /* Build at engineering scale, then fit the canvas footprint the Workbench
     already used. The component is the same; only the sheet it sits on
     differs, exactly as a general arrangement differs from a plot plan. */
  function fit(group, span) {
    var T = three();
    var bb = new T.Box3().setFromObject(group);
    var size = bb.getSize(new T.Vector3());
    var reach = Math.max(size.x, size.y, size.z);
    if (!isFinite(reach) || reach <= 0) return group;
    var k = span / reach;
    var wrap = new T.Group();
    group.scale.setScalar(k);
    /* sit the component on the grid rather than through it */
    var bb2 = new T.Box3().setFromObject(group);
    group.position.y -= bb2.min.y;
    var c = new T.Box3().setFromObject(group).getCenter(new T.Vector3());
    group.position.x -= c.x;
    group.position.z -= c.z;
    wrap.add(group);
    /* A library part keeps a back-reference to itself in userData so the
       engineering viewports can inspect it. That reference is circular, and
       the Workbench serialises its objects — JSON export recursed until the
       stack gave out. The Workbench does not use inspection, so the shared
       component hands over clean userData. */
    wrap.traverse(function (o) {
      if (o.userData && o.userData.aroPart) delete o.userData.aroPart;
    });
    return wrap;
  }

  function npsOf(props, dflt) {
    if (!props) return dflt;
    var v = props['Size (NPS)'] || props['Size'] || props.NPS;
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : dflt;
  }

  /* ── the shared builders ───────────────────────────────────────────────── */
  function builders(A3, A) {
    var T = three();

    function shared(key, make, extra) {
      var prev = null;
      var factory = function () {
        try {
          /* the properties first — the size on the sheet drives the geometry */
          var probe = null;
          try { probe = prev ? prev() : null; } catch (e2) { probe = null; }
          var props = probe && probe.userData ? probe.userData.props : null;
          if (probe) probe.traverse(function (o) {
            if (o.geometry && o.geometry.dispose) o.geometry.dispose();
          });
          var inner = make(props);
          if (!inner) throw new Error('no geometry');
          var g = fit(inner, SPAN[key] || 2.5);
          g.userData.props = props || {};
          g.userData.props['Model source'] = 'AROGARA shared component library';
          if (extra) Object.keys(extra).forEach(function (k) {
            g.userData.props[k] = extra[k];
          });
          return g;
        } catch (e) {
          /* never cost the engineer a component: fall back to what was here */
          try { return prev ? prev() : null; } catch (e3) { return null; }
        }
      };
      prev = A3.registerFactory(key, factory);
      return prev;
    }

    /* ── PUMP — the unit Pump Sizing builds ─────────────────────────────── */
    shared('centrifugal-pump', function (props) {
      var g = new T.Group();
      var nps = npsOf(props, 4);
      var od = A.odOf(nps), dod = A.odOf(Math.max(1, nps - 1));
      var kw = parseFloat(props && props['Motor (kW)']) || 11;
      var motorD = Math.max(0.22, Math.pow(kw, 0.34) * 0.15), motorL = motorD * 1.9;
      var casR = Math.max(od, dod) * 1.55, cl = casR + 0.10;
      var baseL = motorL + casR * 3.4 + 0.35, baseW = Math.max(motorD * 1.9, casR * 2.4);
      var px = -baseL / 2 + casR + 0.16;
      var M = A.materials;

      var bp = new T.Mesh(new T.BoxGeometry(baseL, 0.075, baseW), M.support());
      bp.position.set(0, 0.24, 0); g.add(bp);
      var pad = new T.Mesh(new T.BoxGeometry(baseL + 0.4, 0.16, baseW + 0.35), M.support());
      pad.position.set(0, 0.08, 0); g.add(pad);

      var vol = new T.Mesh(new T.CylinderGeometry(casR, casR, casR * 0.95, 30), M.valve());
      vol.rotation.z = Math.PI / 2; vol.position.set(px, cl, 0); g.add(vol);
      var foot = new T.Mesh(new T.BoxGeometry(casR * 1.5, Math.max(0.03, cl - 0.28), casR * 1.1), M.valveDk());
      foot.position.set(px + casR * 0.2, (cl + 0.28) / 2 - 0.02, 0); g.add(foot);

      /* the suction and discharge nozzles, at the sizes on the sheet */
      var suc = A.nozzle({ od: od, nps: nps, len: casR * 1.5, lod: 1 });
      suc.group.rotation.y = Math.PI;
      suc.group.position.set(px - casR * 0.55, cl, 0);
      g.add(suc.group);
      var dis = A.nozzle({ od: dod, nps: Math.max(1, nps - 1), len: casR * 1.6, lod: 1 });
      dis.group.rotation.z = Math.PI / 2;
      dis.group.position.set(px, cl + casR, 0);
      g.add(dis.group);

      var bfL = casR * 1.3;
      var bf = new T.Mesh(new T.CylinderGeometry(casR * 0.5, casR * 0.62, bfL, 18), M.valveDk());
      bf.rotation.z = Math.PI / 2; bf.position.set(px + casR * 0.6 + bfL / 2, cl, 0); g.add(bf);

      var gx = px + casR * 0.6 + bfL + 0.10;
      var guard = new T.Mesh(new T.CylinderGeometry(casR * 0.62, casR * 0.62, 0.16, 16), M.act());
      guard.rotation.z = Math.PI / 2; guard.position.set(gx, cl, 0); g.add(guard);

      /* the impeller still turns — the Workbench animates it */
      var imp = new T.Group();
      for (var i = 0; i < 6; i++) {
        var bld = new T.Mesh(new T.BoxGeometry(casR * 1.2, casR * 0.10, casR * 0.30), M.hw());
        bld.rotation.y = i / 6 * Math.PI * 2;
        imp.add(bld);
      }
      imp.position.set(px - casR * 0.30, cl, 0);
      imp.rotation.z = Math.PI / 2;
      g.add(imp);
      if (A3.spin) A3.spin(imp, 'x');

      var mx = gx + 0.10 + motorL / 2;
      var mot = new T.Mesh(new T.CylinderGeometry(motorD / 2, motorD / 2, motorL, 26), M.pipeDk());
      mot.rotation.z = Math.PI / 2; mot.position.set(mx, cl, 0); g.add(mot);
      for (var f2 = 0; f2 < 9; f2++) {
        var fin = new T.Mesh(new T.CylinderGeometry(motorD / 2 + motorD * 0.05,
          motorD / 2 + motorD * 0.05, motorL / 60, 26), M.pipeDk());
        fin.rotation.z = Math.PI / 2;
        fin.position.set(mx - motorL * 0.36 + motorL * 0.72 * (f2 / 8), cl, 0);
        g.add(fin);
      }
      var tb = new T.Mesh(new T.BoxGeometry(motorD * 0.5, motorD * 0.34, motorD * 0.42), M.valveDk());
      tb.position.set(mx, cl + motorD / 2 + motorD * 0.14, 0); g.add(tb);
      var mfoot = new T.Mesh(new T.BoxGeometry(motorD * 1.3, Math.max(0.03, cl - 0.28), motorD * 1.5), M.pipeDk());
      mfoot.position.set(mx, (cl + 0.28) / 2 - 0.02, 0); g.add(mfoot);
      return g;
    }, { 'Model': 'End-suction centrifugal, shared with Pump Sizing' });

    /* ── VALVES — the ones line sizing puts in a spool ──────────────────── */
    [['gate-valve', 'gate'], ['ball-valve', 'ball'], ['globe-valve', 'globe'],
     ['butterfly-valve', 'butterfly'], ['check-valve', 'check'],
     ['control-valve', 'control']].forEach(function (pair) {
      shared(pair[0], function (props) {
        var nps = npsOf(props, 3);
        var v = A.valve({ od: A.odOf(nps), nps: nps, kind: pair[1], lod: 1 });
        return v.group;
      }, { 'Model': 'Shared with Line Sizing' });
    });

    /* ── FITTINGS ──────────────────────────────────────────────────────── */
    shared('flange-fitting', function (props) {
      var nps = npsOf(props, 4);
      return A.flangedJoint({ od: A.odOf(nps), nps: nps, lod: 1 }).group;
    }, { 'Model': 'Weld-neck pair with gasket and bolting, shared library' });

    shared('elbow90', function (props) {
      var nps = npsOf(props, 3), od = A.odOf(nps);
      var g = new T.Group();
      var e = A.elbow({ od: od, nps: nps, angle: 90, lod: 1 });
      g.add(e.group);
      var a1 = A.pipe({ od: od, nps: nps, len: od * 1.6, lod: 1, flanges: false });
      a1.group.position.set(od * 1.5, -od * 1.6, 0);
      a1.group.rotation.z = Math.PI / 2;
      g.add(a1.group);
      var a2 = A.pipe({ od: od, nps: nps, len: od * 1.6, lod: 1, flanges: false });
      a2.group.position.set(-od * 1.6, od * 1.5, 0);
      g.add(a2.group);
      return g;
    }, { 'Model': 'Long-radius bend, shared library' });

    shared('elbow45', function (props) {
      var nps = npsOf(props, 3), od = A.odOf(nps);
      return A.elbow({ od: od, nps: nps, angle: 45, lod: 1 }).group;
    }, { 'Model': 'Long-radius bend, shared library' });

    shared('tee-fitting', function (props) {
      var nps = npsOf(props, 3);
      return A.tee({ od: A.odOf(nps), nps: nps, lod: 1 }).group;
    }, { 'Model': 'Shared library' });

    shared('reducer-fitting', function (props) {
      var nps = npsOf(props, 4);
      var od = A.odOf(nps), od2 = A.odOf(Math.max(0.5, nps - 1));
      return A.reducer({ od: od, od2: od2, nps: nps, nps2: Math.max(0.5, nps - 1), lod: 1 }).group;
    }, { 'Model': 'Concentric, shared library' });

    shared('gauge', function () {
      return A.gauge({ od: 0.05, lod: 1 }).group;
    }, { 'Model': 'Shared with the piping models' });

    shared('support', function (props) {
      var nps = npsOf(props, 4);
      return A.support({ od: A.odOf(nps), nps: nps, height: A.odOf(nps) * 5, lod: 1 }).group;
    }, { 'Model': 'Pipe shoe, shared library' });
  }

  /* ── install, once both sides are present ──────────────────────────────── */
  var installed = false;
  function install() {
    if (installed) return true;
    var A3 = window.ARO3D, A = window.AROPARTS;
    if (!A3 || typeof A3.registerFactory !== 'function' || !A || !three()) return false;
    if (A.ready && !A.ready()) return false;
    try {
      builders(A3, A);
      installed = true;
      window.AROWBSHARED = {
        installed: true,
        keys: Object.keys(SPAN),
        span: SPAN
      };
    } catch (e) {
      /* the Workbench keeps every component it had */
      installed = false;
    }
    return installed;
  }

  function boot() {
    if (install()) return;
    var tries = 0;
    var iv = setInterval(function () {
      if (install() || ++tries > 40) clearInterval(iv);
    }, 500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  } else {
    setTimeout(boot, 500);
  }
})();
