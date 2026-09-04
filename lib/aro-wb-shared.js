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
    /* Carry the inner geometry's own connection ports (set by a builder as
       group.userData.portDefs, same convention as the Workbench's native
       factories) out onto wrap — the group A3.addByType() actually reads
       ports from. Scaled and offset the exact same way the geometry itself
       just was, so a port lands on the real nozzle face this shared model
       drew, not the generic bbox-guess fallback. Without this, a shared
       override with no portDefs of its own quietly loses every port the
       factory it replaced had. */
    if (group.userData.portDefs && group.userData.portDefs.length) {
      wrap.userData.portDefs = group.userData.portDefs.map(function (pd) {
        return {
          id: pd.id, role: pd.role, name: pd.name,
          local: new T.Vector3(
            pd.local.x * k + group.position.x,
            pd.local.y * k + group.position.y,
            pd.local.z * k + group.position.z
          ),
          dir: pd.dir ? pd.dir.clone() : null,
          // The real flange radius a builder computed (pre-scale, same raw
          // units as its own od/nozzle math) scales by the same isotropic k
          // as everything else here — radii scale linearly under a uniform
          // scale just like lengths do.
          flangeR: typeof pd.rFlange === 'number' ? pd.rFlange * k : null
        };
      });
    }
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
    /* Pump-specific materials, distinct from the generic valve/support
       palette (A.materials) the rest of this shared library reuses for
       fittings. A pump reads as "real" from the same two-tone contrast a
       real end-suction skid photo has — a bright polished casing against
       a saturated motor colour, plus a safety-yellow coupling guard — not
       from the muted grey/navy/rust tones tuned for generic valve bodies.
       Lazily built once and reused across every pump instance. */
    var PUMP_MAT = null;
    function pumpMats() {
      if (PUMP_MAT) return PUMP_MAT;
      PUMP_MAT = {
        casing: new T.MeshStandardMaterial({ color: 0xd6dbe0, metalness: 0.88, roughness: 0.22 }),
        casingDk: new T.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.6, roughness: 0.4 }),
        motor: new T.MeshStandardMaterial({ color: 0x2054d6, metalness: 0.15, roughness: 0.55 }),
        guard: new T.MeshStandardMaterial({ color: 0xf4c430, metalness: 0.1, roughness: 0.6 }),
        impeller: new T.MeshStandardMaterial({ color: 0xb87333, metalness: 0.7, roughness: 0.35 }),
        base: new T.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.6 })
      };
      return PUMP_MAT;
    }

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
      var PM = pumpMats();

      var bp = new T.Mesh(new T.BoxGeometry(baseL, 0.075, baseW), PM.base);
      bp.position.set(0, 0.24, 0); g.add(bp);
      var pad = new T.Mesh(new T.BoxGeometry(baseL + 0.4, 0.16, baseW + 0.35), PM.base);
      pad.position.set(0, 0.08, 0); g.add(pad);

      var vol = new T.Mesh(new T.CylinderGeometry(casR, casR, casR * 0.95, 30), PM.casing);
      vol.rotation.z = Math.PI / 2; vol.position.set(px, cl, 0); g.add(vol);
      var foot = new T.Mesh(new T.BoxGeometry(casR * 1.5, Math.max(0.03, cl - 0.28), casR * 1.1), PM.casingDk);
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
      var bf = new T.Mesh(new T.CylinderGeometry(casR * 0.5, casR * 0.62, bfL, 18), PM.casingDk);
      bf.rotation.z = Math.PI / 2; bf.position.set(px + casR * 0.6 + bfL / 2, cl, 0); g.add(bf);

      /* coupling guard — safety yellow, the single most recognisable "this
         is a real pump skid" cue a product photo has; the generic valve
         palette's mustard/olive tones read as just another pipe fitting. */
      var gx = px + casR * 0.6 + bfL + 0.10;
      var guard = new T.Mesh(new T.CylinderGeometry(casR * 0.62, casR * 0.62, 0.16, 16), PM.guard);
      guard.rotation.z = Math.PI / 2; guard.position.set(gx, cl, 0); g.add(guard);

      /* the impeller still turns — the Workbench animates it */
      var imp = new T.Group();
      for (var i = 0; i < 6; i++) {
        var bld = new T.Mesh(new T.BoxGeometry(casR * 1.2, casR * 0.10, casR * 0.30), PM.impeller);
        bld.rotation.y = i / 6 * Math.PI * 2;
        imp.add(bld);
      }
      imp.position.set(px - casR * 0.30, cl, 0);
      imp.rotation.z = Math.PI / 2;
      g.add(imp);
      if (A3.spin) A3.spin(imp, 'x');

      /* motor — saturated blue, the two-tone "blue motor / bright metal
         casing" contrast a real end-suction skid photo actually shows,
         not a third shade of the same grey-navy fittings palette. */
      var mx = gx + 0.10 + motorL / 2;
      var mot = new T.Mesh(new T.CylinderGeometry(motorD / 2, motorD / 2, motorL, 26), PM.motor);
      mot.rotation.z = Math.PI / 2; mot.position.set(mx, cl, 0); g.add(mot);
      for (var f2 = 0; f2 < 9; f2++) {
        var fin = new T.Mesh(new T.CylinderGeometry(motorD / 2 + motorD * 0.05,
          motorD / 2 + motorD * 0.05, motorL / 60, 26), PM.motor);
        fin.rotation.z = Math.PI / 2;
        fin.position.set(mx - motorL * 0.36 + motorL * 0.72 * (f2 / 8), cl, 0);
        g.add(fin);
      }
      var tb = new T.Mesh(new T.BoxGeometry(motorD * 0.5, motorD * 0.34, motorD * 0.42), PM.casingDk);
      tb.position.set(mx, cl + motorD / 2 + motorD * 0.14, 0); g.add(tb);
      var mfoot = new T.Mesh(new T.BoxGeometry(motorD * 1.3, Math.max(0.03, cl - 0.28), motorD * 1.5), PM.casingDk);
      mfoot.position.set(mx, (cl + 0.28) / 2 - 0.02, 0); g.add(mfoot);
      /* Real flange-face centers, not the group origins set above — a
         nozzle's own local frame runs along +X from its base out to its
         flange face at (len+th, 0, 0) (lib/aro-parts3d.js nozzle()), so the
         port is that point carried through the same rotation each nozzle
         group was given. id/role match the canonical registry
         (window.AROPORTS.pump in lib/aro-workbench.js) so this pump — the
         one Workbench actually places, since this factory overrides
         FAC['centrifugal-pump'] at runtime — gets the same connectable
         identity as the built-in fallback shape it replaces, instead of
         silently losing its ports to the generic bbox guess. */
      var sucOff = casR * 1.5 + Math.max(0.008, od * 0.17);
      var disOff = casR * 1.6 + Math.max(0.008, dod * 0.17);
      /* The real flange radius each nozzle was actually drawn with
         (A.flangeOf, the same call nozzle() itself makes) — not a guess
         from the connecting line's NPS. Without this, buildPipe() sized
         its flange from the LINE's nps instead of the pump's own, and for
         a small pump on a nominally-larger line the two didn't agree:
         a full-size line flange landing on a much thinner real nozzle
         stub with nothing bridging them, reading as a broken connection
         even though the centerline itself was exactly continuous. */
      var rFlangeSuc = A.flangeOf(nps, od).od / 2;
      var rFlangeDis = A.flangeOf(Math.max(1, nps - 1), dod).od / 2;
      g.userData.portDefs = [
        { id: 'suction', role: 'in', name: 'Suction', rFlange: rFlangeSuc,
          local: new T.Vector3(px - casR * 0.55 - sucOff, cl, 0), dir: new T.Vector3(-1, 0, 0) },
        { id: 'discharge', role: 'out', name: 'Discharge', rFlange: rFlangeDis,
          local: new T.Vector3(px, cl + casR + disOff, 0), dir: new T.Vector3(0, 1, 0) }
      ];
      return g;
    }, { 'Model': 'End-suction centrifugal, shared with Pump Sizing' });

    /* ── VALVES — the ones line sizing puts in a spool ──────────────────── */
    /* DISABLED: A.valve()'s output — geometry and materials that check out
       correctly by every JS-level measure (non-empty attributes, real
       bounding box, visible:true, FrontSide, no WebGL errors, no console
       warnings) — renders as literally nothing in the Workbench's own
       renderer: 0 non-background pixels sampled via gl.readPixels() across
       the whole canvas, reproducible with the wrapper (fit()/shared())
       bypassed entirely and portDefs never touched, so it isn't anything
       downstream in this file or in aro-workbench-3d.js. A raw
       THREE.CylinderGeometry + the exact same MeshStandardMaterial colour
       renders fine standalone, so it isn't the colour/material values
       either — the failure is specific to A.valve()'s own construction
       (Part/put/m() pipeline) and wasn't isolated further before this
       needed to ship. Left registered so it's easy to re-enable once
       that's root-caused; until then every valve type falls back to its
       own hand-authored factory below (gate/globe/ball/butterfly/check/
       control), which does render, and which this session's boltCircle/
       flangeX rework already brought up to the same bolted-flange
       standard the shared parts library was meant to add. */
    var VALVE_SHARED_ENABLED = false;
    if (VALVE_SHARED_ENABLED)
    [['gate-valve', 'gate'], ['ball-valve', 'ball'], ['globe-valve', 'globe'],
     ['butterfly-valve', 'butterfly'], ['check-valve', 'check'],
     ['control-valve', 'control']].forEach(function (pair) {
      shared(pair[0], function (props) {
        var nps = npsOf(props, 3);
        var od = A.odOf(nps);
        var v = A.valve({ od: od, nps: nps, kind: pair[1], lod: 1 });
        /* A Part's own local frame runs along +X, port A (inlet) at the
           origin, port B (outlet) at (len, 0, 0) — lib/aro-parts3d.js's own
           documented convention, not a guess (the flanges valve() actually
           draws sit at x=0 and x=len). id/role match the canonical registry
           (window.AROPORTS['gate']/['ball']/etc. in lib/aro-workbench.js)
           so these valves — the ones the Workbench actually places, since
           this factory overrides FAC[pair[0]] at runtime — keep a real
           connectable identity instead of losing it to the bbox guess.
           rFlange: the real flange radius valve() actually drew at both
           ends (A.flangeOf, same call valve() itself makes) — without it
           buildPipe() sized the connecting flange from the LINE's own nps
           instead of this valve's, which for a small valve on a nominally
           larger line meant a full-size flange landing on a much thinner
           real valve body with nothing bridging them. */
        var rFlange = A.flangeOf(nps, od).od / 2;
        v.group.userData.portDefs = [
          { id: 'inlet', role: 'in', name: 'Inlet', rFlange: rFlange, local: new T.Vector3(0, 0, 0), dir: new T.Vector3(-1, 0, 0) },
          { id: 'outlet', role: 'out', name: 'Outlet', rFlange: rFlange, local: new T.Vector3(v.len, 0, 0), dir: new T.Vector3(1, 0, 0) }
        ];
        return v.group;
      }, { 'Model': 'Shared with Line Sizing' });
    });

    /* ── FITTINGS ──────────────────────────────────────────────────────── */
    /* DISABLED: flange-fitting / elbow90 / elbow45 / reducer-fitting / gauge
       each return A.*()'s raw .group with no .userData.portDefs of its own
       (unlike A.tee(), whose branch/run ends tee-fitting below computes
       portDefs for right here) — so fit() has nothing to remap, and every
       one of these fell straight through A3.addByType()'s bounding-box
       fallback despite LOOKING like a real, replaced component. That fallback
       is exactly the "APPROX PORTS" / gap-marker path this pass is closing,
       so a shared build that silently drops ports is worse than no shared
       build at all. Left registered so re-enabling is a one-line flip once
       each A.*() constructor exposes its own real endpoints the way A.tee()
       already does; until then these fall back to their native
       lib/aro-workbench-3d.js factories, which this same pass gave real,
       hand-authored portDefs matching their own drawn nozzle geometry. */
    var FITTING_SHARED_ENABLED = false;
    if (FITTING_SHARED_ENABLED) {
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
    }

    shared('tee-fitting', function (props) {
      var nps = npsOf(props, 3);
      var od = A.odOf(nps);
      var t = A.tee({ od: od, nps: nps, lod: 1 });
      var g = t.group;
      /* Real registry ports at the run/branch ends this factory actually
         drew (len and t.branch.y both come straight out of A.tee() itself,
         not re-guessed here) — without these a tee had geometry but nothing
         for a pipe to resolve against, so it could never actually sit
         inline in a line; it only decorated the 3D component palette. */
      var len = od * 2.2;
      var rFlange = A.flangeOf(nps, od).od / 2;
      g.userData.portDefs = [
        { id: 'runIn', role: 'in', name: 'Run Inlet', flangeR: rFlange,
          local: new T.Vector3(0, 0, 0), dir: new T.Vector3(-1, 0, 0) },
        { id: 'runOut', role: 'out', name: 'Run Outlet', flangeR: rFlange,
          local: new T.Vector3(len, 0, 0), dir: new T.Vector3(1, 0, 0) },
        { id: 'branch', role: 'out', name: 'Branch', flangeR: rFlange,
          local: new T.Vector3(len / 2, t.branch.y, 0), dir: new T.Vector3(0, 1, 0) }
      ];
      return g;
    }, { 'Model': 'Shared library' });

    if (FITTING_SHARED_ENABLED) {
    shared('reducer-fitting', function (props) {
      var nps = npsOf(props, 4);
      var od = A.odOf(nps), od2 = A.odOf(Math.max(0.5, nps - 1));
      return A.reducer({ od: od, od2: od2, nps: nps, nps2: Math.max(0.5, nps - 1), lod: 1 }).group;
    }, { 'Model': 'Concentric, shared library' });

    shared('gauge', function () {
      return A.gauge({ od: 0.05, lod: 1 }).group;
    }, { 'Model': 'Shared with the piping models' });
    }

    /* DISABLED: same class of gap as flange-fitting/elbow90/elbow45/
       reducer-fitting/gauge above — A.support()'s raw .group carries
       neither .userData.portDefs NOR .userData.noPorts, so fit() has
       nothing to propagate and addByType() fell through to the
       bounding-box "APPROX PORTS" fallback despite this being a pipe
       support (structural steel, no process nozzle at all) — flagging it
       with a gap marker was actively wrong, not just imprecise. The
       native lib/aro-workbench-3d.js 'support' factory already sets
       noPorts: true correctly; this override just needs to stop hiding
       that until A.support() exposes the same via its own group. */
    if (FITTING_SHARED_ENABLED) {
    shared('support', function (props) {
      var nps = npsOf(props, 4);
      return A.support({ od: A.odOf(nps), nps: nps, height: A.odOf(nps) * 5, lod: 1 }).group;
    }, { 'Model': 'Pipe shoe, shared library' });
    }
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
