/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — INDUSTRIAL 3D VISUALISATION LAYER
   ---------------------------------------------------------------------------
   An ADDITIVE layer. It does not touch the existing 3D scenes, the calculation
   engines, the units, the project system or the reports. Every module keeps
   the visualisation it already had; this adds a second, plant-realistic model
   beside it and a selector:

        [ INDUSTRIAL ]  [ ANALYTICAL ]

   ANALYTICAL is the existing scene, untouched and one click away. INDUSTRIAL
   is the model built here.

   Two rules govern what is drawn:

   1. GEOMETRY IS DATA-DRIVEN. Nozzle sizes, shell diameters, tube counts,
      hairpin counts, run lengths, liquid levels and plate counts come from
      the module's own calculated result — the same object the 2D drawing and
      the report read. Nothing is scaled to look good.

   2. A NUMBER IS ONLY SHOWN IF IT WAS CALCULATED. Before the engineer presses
      RUN, the equipment still appears — an engineer should be able to see the
      arrangement while entering data — but every numerical overlay reads
      "— NOT CALCULATED", and the viewport carries the calculation state. When
      inputs move away from the last run, the overlay says SUPERSEDED rather
      than quietly showing stale numbers next to new geometry.

   Anything shown that is NOT a design output (access steel, plate seams,
   foundations, coupling guards) is declared as indicative in the viewport
   footer, so the model can never be mistaken for a fabrication deliverable.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var T = null;
  function three() {
    if (!T && typeof THREE !== 'undefined') T = THREE;
    return T;
  }

  /* ── Industrial colour system ────────────────────────────────────────────
     Restrained. Plant equipment is painted, dusty and grey-blue; it is not
     neon. Colour is reserved for meaning: hot service, cold service, and the
     one safety-yellow guard. */
  var C = {
    bg: 0x121a22, deck: 0x2c353d, grid: 0x36424c,
    concrete: 0x8f8f8a, steel: 0x98a3ab, steelDk: 0x616b73,
    machine: 0x3d6072, machineDk: 0x2b4553, motor: 0x36454e,
    bundle: 0xa9834a, insul: 0xd2d6da, gasket: 0x2f353b,
    hot: 0xb04430, cold: 0x2f6ea8, guard: 0xb99229, ink: 0xdfe6ec
  };

  var MATS = {};
  function mat(hex, o) {
    o = o || {};
    var key = hex + '|' + (o.m == null ? 9 : o.m) + '|' + (o.r == null ? 9 : o.r)
            + '|' + (o.op == null ? 1 : o.op) + '|' + (o.side ? 1 : 0);
    if (MATS[key]) return MATS[key];
    MATS[key] = new T.MeshStandardMaterial({
      color: hex,
      metalness: o.m == null ? 0.55 : o.m,
      roughness: o.r == null ? 0.5 : o.r,
      transparent: o.op != null && o.op < 1,
      opacity: o.op == null ? 1 : o.op,
      side: o.side ? T.DoubleSide : T.FrontSide
    });
    return MATS[key];
  }
  var M = {
    steel: function () { return mat(C.steel, { m: 0.72, r: 0.38 }); },
    steelDk: function () { return mat(C.steelDk, { m: 0.78, r: 0.34 }); },
    machine: function () { return mat(C.machine, { m: 0.35, r: 0.55 }); },
    machineDk: function () { return mat(C.machineDk, { m: 0.4, r: 0.5 }); },
    motor: function () { return mat(C.motor, { m: 0.45, r: 0.5 }); },
    concrete: function () { return mat(C.concrete, { m: 0.02, r: 0.96 }); },
    bundle: function () { return mat(C.bundle, { m: 0.8, r: 0.32 }); },
    insul: function () { return mat(C.insul, { m: 0.04, r: 0.92 }); },
    gasket: function () { return mat(C.gasket, { m: 0.1, r: 0.85 }); },
    hot: function () { return mat(C.hot, { m: 0.35, r: 0.5 }); },
    cold: function () { return mat(C.cold, { m: 0.35, r: 0.5 }); },
    guard: function () { return mat(C.guard, { m: 0.4, r: 0.5 }); },
    deck: function () { return mat(C.deck, { m: 0.05, r: 0.95 }); }
  };

  /* NPS → outside diameter, mm (ASME B36.10M). Used only to draw a nozzle at
     the size the calculation selected — the calculation itself owns the bore. */
  var NPS_OD = {
    0.5: 21.3, 0.75: 26.7, 1: 33.4, 1.25: 42.2, 1.5: 48.3, 2: 60.3, 2.5: 73.0,
    3: 88.9, 3.5: 101.6, 4: 114.3, 5: 141.3, 6: 168.3, 8: 219.1, 10: 273.1,
    12: 323.9, 14: 355.6, 16: 406.4, 18: 457.2, 20: 508.0, 22: 559.0,
    24: 610.0, 26: 660.0, 30: 762.0, 36: 914.0
  };
  function odOfNps(nps, fallbackMm) {
    var n = parseFloat(nps);
    if (isFinite(n) && NPS_OD[n]) return NPS_OD[n] / 1000;
    if (isFinite(n) && n > 0) return (n * 25.4 * 1.13) / 1000;
    return (fallbackMm || 100) / 1000;
  }

  /* ── Primitive kit ──────────────────────────────────────────────────────
     Everything is built in METRES and framed automatically, so a 20 m tank
     and a 60 mm nozzle both arrive at a sensible camera distance. */
  function grp() { return new T.Group(); }
  /* CylinderGeometry's theta runs from +Z toward +X. To leave the cut-away
     facing a given bearing, the SOLID arc has to start half a gap past it. */
  function cutStart(bearing, solidArc) { return bearing + (Math.PI * 2 - solidArc) / 2; }
  function cyl(rTop, rBot, len, m, seg) {
    return new T.Mesh(new T.CylinderGeometry(rTop, rBot, len, seg || 26), m);
  }
  function box(w, h, d, m) { return new T.Mesh(new T.BoxGeometry(w, h, d), m); }
  function alongX(mesh) { mesh.rotation.z = Math.PI / 2; return mesh; }
  function alongZ(mesh) { mesh.rotation.x = Math.PI / 2; return mesh; }
  function at(o, x, y, z) { o.position.set(x || 0, y || 0, z || 0); return o; }

  /* A flanged joint: raised-face flange with a bolt circle. The bolt count is
     indicative — it is a visual cue that this is a flanged connection, not a
     bolting design. */
  function flange(od, m) {
    var g = grp();
    var fo = od * 1.6 + 0.010, ft = Math.max(0.006, od * 0.16);
    g.add(alongX(cyl(fo / 2, fo / 2, ft, m || M.steelDk(), 30)));
    g.add(alongX(cyl(od * 0.82, od * 0.82, ft * 1.7, m || M.steelDk(), 26)));
    var n = Math.max(4, Math.min(16, 4 * Math.round((od * 26 + 4) / 4)));
    var br = fo / 2 - Math.max(0.008, od * 0.16), bd = Math.max(0.004, od * 0.07);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      g.add(at(alongX(cyl(bd, bd, ft * 2.2, M.steelDk(), 8)),
        0, br * Math.sin(a), br * Math.cos(a)));
    }
    return g;
  }

  /* A run of pipe along +X, centred on the origin, optionally flanged. */
  function pipe(od, len, o) {
    o = o || {};
    var g = grp();
    var m = o.mat || M.steel();
    g.add(alongX(cyl(od / 2, od / 2, len, m, o.seg || 26)));
    if (o.bore) {
      g.add(alongX(cyl(od * o.bore / 2, od * o.bore / 2, len * 1.002,
        mat(0x0d141a, { m: 0.2, r: 0.9, side: true }), 26)));
    }
    if (o.flanges !== false) {
      g.add(at(flange(od, o.fmat), -len / 2, 0, 0));
      g.add(at(flange(od, o.fmat), len / 2, 0, 0));
    }
    return g;
  }

  /* A 90° bend in the XY plane. */
  function elbow(od, R, m) {
    var g = new T.Mesh(new T.TorusGeometry(R, od / 2, 14, 22, Math.PI / 2), m || M.steel());
    return g;
  }

  /* Gate / globe / check valve, body along +X. */
  function valve(od, kind, m) {
    var g = grp(), body = od * 1.5;
    g.add(alongX(cyl(body / 2, body / 2, od * 1.5, m || M.machine(), 20)));
    g.add(at(flange(od, M.steelDk()), -od * 0.85, 0, 0));
    g.add(at(flange(od, M.steelDk()), od * 0.85, 0, 0));
    if (kind === 'check') {
      g.add(at(box(od * 0.16, body * 0.9, body * 0.9, M.steelDk()), 0, 0, 0));
      return g;
    }
    g.add(at(cyl(od * 0.22, od * 0.28, od * 1.1, m || M.machine(), 14), 0, body * 0.75, 0));
    g.add(at(cyl(od * 0.07, od * 0.07, od * 1.3, M.steelDk(), 10), 0, body * 1.35, 0));
    var hw = new T.Mesh(new T.TorusGeometry(od * 0.55, od * 0.07, 8, 20), M.guard());
    hw.rotation.x = Math.PI / 2;
    g.add(at(hw, 0, body * 1.9, 0));
    for (var s = 0; s < 4; s++) {
      var spk = alongX(cyl(od * 0.035, od * 0.035, od * 1.1, M.guard(), 6));
      spk.rotation.y = s * Math.PI / 4;
      g.add(at(spk, 0, body * 1.9, 0));
    }
    return g;
  }

  /* Concentric reducer, large end at −X. */
  function reducer(od1, od2, len, m) {
    return alongX(cyl(od2 / 2, od1 / 2, len, m || M.steel(), 24));
  }

  /* Pipe support: shoe on a stanchion down to grade. */
  function support(od, h) {
    var g = grp();
    g.add(at(box(od * 0.9, od * 0.22, od * 1.5, M.steelDk()), 0, -od * 0.62, 0));
    g.add(at(box(od * 0.28, h, od * 0.28, M.steelDk()), 0, -od * 0.7 - h / 2, 0));
    g.add(at(box(od * 1.4, 0.03, od * 1.4, M.steelDk()), 0, -od * 0.7 - h, 0));
    return g;
  }

  /* Saddle support for a horizontal vessel. */
  function saddle(od, h) {
    var g = grp();
    var web = new T.Mesh(new T.CylinderGeometry(od / 2 + od * 0.035, od / 2 + od * 0.035,
      od * 0.22, 22, 1, false, Math.PI * 1.10, Math.PI * 0.80), M.steelDk());
    g.add(alongX(web));
    g.add(at(box(od * 0.22, h, od * 1.15, M.steelDk()), 0, -od / 2 - h / 2, 0));
    g.add(at(box(od * 0.42, Math.max(0.04, od * 0.05), od * 1.35, M.steelDk()), 0, -od / 2 - h, 0));
    return g;
  }

  /* Nozzle standing off a shell: a stub with a flange on its free end. */
  function nozzle(od, len, m) {
    var g = grp();
    g.add(at(alongX(cyl(od / 2, od / 2, len, m || M.steel(), 20)), len / 2, 0, 0));
    g.add(at(flange(od, M.steelDk()), len, 0, 0));
    return g;
  }

  /* ── Labels ─────────────────────────────────────────────────────────────
     Screen-space sprites, so they stay readable at every zoom. */
  function roundRect(x, w, h, r) {
    x.beginPath();
    x.moveTo(r, 0); x.lineTo(w - r, 0); x.quadraticCurveTo(w, 0, w, r);
    x.lineTo(w, h - r); x.quadraticCurveTo(w, h, w - r, h);
    x.lineTo(r, h); x.quadraticCurveTo(0, h, 0, h - r);
    x.lineTo(0, r); x.quadraticCurveTo(0, 0, r, 0); x.closePath();
  }
  function label(text, o) {
    o = o || {};
    var fs = 36, pad = 12, font = '700 ' + fs + 'px ui-monospace, "IBM Plex Mono", monospace';
    var cv = document.createElement('canvas'), cx = cv.getContext('2d');
    cx.font = font;
    cv.width = Math.ceil(cx.measureText(text).width) + pad * 2;
    cv.height = fs + pad * 1.3;
    cx = cv.getContext('2d');
    cx.font = font;
    roundRect(cx, cv.width, cv.height, 7);
    cx.fillStyle = o.bg || 'rgba(11,17,23,0.86)'; cx.fill();
    cx.strokeStyle = o.line || 'rgba(148,163,184,0.5)'; cx.lineWidth = 2.5; cx.stroke();
    cx.fillStyle = o.fg || '#e2e8f0';
    cx.textBaseline = 'middle';
    cx.fillText(text, pad, cv.height / 2 + 1);
    var tex = new T.CanvasTexture(cv);
    tex.needsUpdate = true;
    var sp = new T.Sprite(new T.SpriteMaterial({
      map: tex, transparent: true, sizeAttenuation: false, depthTest: false
    }));
    var h = o.h || 0.030;
    sp.scale.set(h * (cv.width / cv.height), h, 1);
    sp.renderOrder = 20;
    return sp;
  }
  function tagLabel(text) {
    return label(text, { bg: 'rgba(8,14,20,0.92)', line: 'rgba(56,189,248,0.85)', fg: '#7dd3fc', h: 0.038 });
  }
  function hotLabel(t) { return label(t, { line: 'rgba(220,110,80,0.8)', fg: '#f4a58e' }); }
  function coldLabel(t) { return label(t, { line: 'rgba(80,150,220,0.8)', fg: '#9ec8f0' }); }

  /* A flow arrow with its own caption. Points along +X. */
  function flowArrow(len, colour, text) {
    var g = grp();
    var m = mat(colour, { m: 0.2, r: 0.6 });
    g.add(at(alongX(cyl(len * 0.045, len * 0.045, len * 0.7, m, 10)), -len * 0.15, 0, 0));
    var head = alongX(new T.Mesh(new T.ConeGeometry(len * 0.11, len * 0.3, 14), m));
    g.add(at(head, len * 0.35, 0, 0));
    if (text) g.add(at(label(text, { h: 0.026 }), 0, len * 0.22, 0));
    return g;
  }

  /* ── Viewport ───────────────────────────────────────────────────────────── */
  var LOOP = [];
  var looping = false;

  function Viewport(mount, height) {
    this.mount = mount;
    this.h = height || 340;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(C.bg);
    var w = mount.clientWidth || 520;
    this.camera = new T.PerspectiveCamera(38, w / this.h, 0.02, 6000);
    this.camera.position.set(3, 2, 4);
    this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, this.h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = this.h + 'px';
    this.renderer.domElement.style.cursor = 'grab';
    mount.appendChild(this.renderer.domElement);

    this.scene.add(new T.HemisphereLight(0xc9d8e8, 0x2a3038, 0.95));
    var key = new T.DirectionalLight(0xffffff, 0.75);
    key.position.set(1, 2.2, 1.4);
    this.scene.add(key);
    var fill = new T.DirectionalLight(0xa8c0d8, 0.32);
    fill.position.set(-1.4, 0.6, -1.2);
    this.scene.add(fill);

    this.root = grp();
    this.scene.add(this.root);
    this.ground = grp();
    this.scene.add(this.ground);

    this.controls = new CustomOrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.autoRotate = false;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.22;

    var self = this;
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(function () { self.resize(); });
      this.ro.observe(mount);
    }
    LOOP.push(this);
    startLoop();
  }

  Viewport.prototype.resize = function () {
    var w = this.mount.clientWidth;
    if (!w) return;
    this.camera.aspect = w / this.h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, this.h);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = this.h + 'px';
  };

  Viewport.prototype.clear = function () {
    var self = this;
    (function wipe(o) {
      for (var i = o.children.length - 1; i >= 0; i--) {
        var c = o.children[i];
        wipe(c);
        if (c.geometry && c.geometry.dispose) c.geometry.dispose();
        if (c.material && c.material.map && c.material.map.dispose && c.isSprite) {
          c.material.map.dispose();
          c.material.dispose();
        }
        o.remove(c);
      }
    })(this.root);
    this.ground.position.set(0, 0, 0);
    (function wipe2(o) {
      for (var i = o.children.length - 1; i >= 0; i--) {
        var c = o.children[i];
        if (c.geometry && c.geometry.dispose) c.geometry.dispose();
        if (c.__ownMaterial && c.material && c.material.dispose) c.material.dispose();
        o.remove(c);
      }
    })(this.ground);
    self.root.position.set(0, 0, 0);
  };

  /* Ground: a deck the equipment stands on, and a grid at a metre pitch so
     the eye can read scale without a dimension anywhere on the model. */
  Viewport.prototype.laydown = function (span) {
    if (!isFinite(span) || span <= 0) return;
    var step = span > 40 ? 5 : (span > 12 ? 2 : (span > 4 ? 1 : 0.25));
    var n = Math.max(8, Math.ceil(span * 1.6 / step));
    var g = new T.GridHelper(n * step, n, C.grid, C.grid);
    g.material.transparent = true;
    g.material.opacity = 0.4;
    g.__ownMaterial = true;
    this.ground.add(g);
    var plane = new T.Mesh(new T.PlaneGeometry(n * step, n * step), M.deck());
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.006;
    this.ground.add(plane);
    try {
      var bc = new T.Box3().setFromObject(this.root).getCenter(new T.Vector3());
      if (isFinite(bc.x)) { this.ground.position.x = bc.x; this.ground.position.z = bc.z; }
    } catch (e) {}
  };

  /* Frame the model. The camera is placed from the bounding sphere, so the
     builders never have to know what a good camera distance is. */
  Viewport.prototype.frame = function (o) {
    o = o || {};
    var b = new T.Box3().setFromObject(this.root);
    if (!isFinite(b.min.x) || b.isEmpty()) return;
    var c = b.getCenter(new T.Vector3());
    var s = b.getSize(new T.Vector3());
    /* the silhouette, not the bounding sphere: a long horizontal spool in a
       wide panel is limited by the horizontal field of view, and a tall tank
       in the same panel is limited by the vertical one */
    var halfW = 0.5 * Math.sqrt(s.x * s.x + s.z * s.z);
    var halfH = 0.5 * s.y;
    var vt = Math.tan((this.camera.fov * Math.PI / 180) / 2);
    var ht = vt * Math.max(0.3, this.camera.aspect);
    var dist = Math.max(halfH / vt, halfW / ht) * (o.zoom || 1.08) + halfW * 0.45 + 0.05;
    var az = o.az == null ? 0.72 : o.az, el = o.el == null ? 1.07 : o.el;
    this.controls.target.set(c.x, c.y, c.z);
    this.camera.position.set(
      c.x + dist * Math.sin(el) * Math.sin(az),
      c.y + dist * Math.cos(el),
      c.z + dist * Math.sin(el) * Math.cos(az));
    this.camera.near = Math.max(0.01, dist / 900);
    this.camera.far = dist * 60;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = dist * 0.18;
    this.controls.maxDistance = dist * 5.5;
    var cc = this.controls;
    cc.updateSphericalFromCamera();
    cc.targetSpherical.radius = cc.spherical.radius;
    cc.targetSpherical.phi = cc.spherical.phi;
    cc.targetSpherical.theta = cc.spherical.theta;
    this.span = Math.max(s.x, s.z);
    this.homeSpan = this.span;
  };

  Viewport.prototype.visible = function () {
    var el = this.renderer.domElement;
    if (!el.offsetParent) return false;
    var r = el.getBoundingClientRect();
    return r.bottom > -120 && r.top < (window.innerHeight || 800) + 120 && r.width > 8;
  };

  function startLoop() {
    if (looping) return;
    looping = true;
    (function tick() {
      window.requestAnimationFrame(tick);
      for (var i = 0; i < LOOP.length; i++) {
        var v = LOOP[i];
        try {
          if (!v.visible()) continue;
          v.controls.update();
          v.renderer.render(v.scene, v.camera);
        } catch (e) { /* a viewport must never take the page down */ }
      }
    })();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MODULE REGISTRY
     Each entry: where it mounts, how it reads its data, how it builds, and
     what it puts in the overlay.
     ═══════════════════════════════════════════════════════════════════════ */
  var OUTDATED = 'OUTDATED';
  var REG = {};
  function register(id, def) { REG[id] = def; }

  function num(id) {
    var e = document.getElementById(id);
    if (!e) return NaN;
    if (window.siOf) { var s = window.siOf(id, NaN); if (isFinite(s)) return s; }
    return parseFloat(e.value);
  }
  function raw(id) {
    var e = document.getElementById(id);
    return e ? parseFloat(e.value) : NaN;
  }
  function txt(id) {
    var e = document.getElementById(id);
    return e ? String(e.value || '') : '';
  }
  function f(v, d) { return isFinite(v) ? Number(v).toFixed(d == null ? 2 : d) : '—'; }
  function pick(a, b) { return isFinite(a) && a > 0 ? a : b; }

  function vals(id) {
    try { return window.AROENG && window.AROENG.values ? window.AROENG.values(id) : null; }
    catch (e) { return null; }
  }
  function calcState(id) {
    var st = window.AROSTATE;
    if (!st) return 'unknown';
    var s = st.state ? st.state(id) : null;
    return s || 'unknown';
  }
  function isCalc(id) {
    var st = window.AROSTATE;
    return st && st.isCalculated ? !!st.isCalculated(id) : false;
  }

  /* ── PUMP ─────────────────────────────────────────────────────────────────
     End-suction centrifugal unit on a baseplate: volute with an axial suction
     and a top discharge at the nozzle sizes the calculation selected, bearing
     frame, coupling under a guard, and the motor the calculation sized. */
  register('pump', {
    height: 330, az: -0.95, el: 1.24,
    title: 'CENTRIFUGAL PUMP UNIT',
    data: function () {
      var s = window.state && window.state.pump;
      var ok = !!(s && s.calculated && s.results);
      var r = ok ? s.results : {}, i = ok ? (s.inputs || {}) : {};
      var sucOd = ok && r.sucNozzle ? odOfNps(r.sucNozzle.nps) : 0.114;
      var disOd = ok && r.disNozzle ? odOfNps(r.disNozzle.nps) : 0.0889;
      var kw = pick(r.stdMotorKw, 15);
      return {
        ok: ok,
        tag: (window.AROPROJECT && window.AROPROJECT.context && window.AROPROJECT.context()
              && window.AROPROJECT.context().tag) || i.pumpTag || txt('pump-tag') || 'P-101',
        sucOd: sucOd, disOd: disOd, kw: kw,
        sucNps: ok && r.sucNozzle ? r.sucNozzle.nps : null,
        disNps: ok && r.disNozzle ? r.disNozzle.nps : null,
        Q: r.designVolFlow, H: r.diffHeadCal, eff: r.pumpEff, rpm: r.pumpSpeedRpm,
        vs: r.velSuc, vd: r.velDis, p1: r.pSucA, p2: r.pDischA,
        npsha: r.npsha, npshr: i.npshr, fluid: i.fluidVal || txt('fluid-select')
      };
    },
    build: function (d, vp) {
      var g = grp();
      /* baseplate + grouted foundation — arrangement steel, not a design output */
      var motorD = Math.max(0.22, Math.pow(d.kw, 0.34) * 0.15);
      var motorL = motorD * 1.9;
      var casR = Math.max(d.sucOd, d.disOd) * 1.55;
      var baseL = motorL + casR * 3.4 + 0.35;
      var baseW = Math.max(motorD * 1.9, casR * 2.4);
      var cl = casR + 0.10;                       /* shaft centreline above the plate */

      g.add(at(box(baseL + 0.5, 0.16, baseW + 0.45, M.concrete()), 0, 0.08, 0));
      g.add(at(box(baseL, 0.075, baseW, M.steelDk()), 0, 0.195, 0));
      for (var e = -1; e <= 1; e += 2) {
        g.add(at(box(0.05, 0.10, baseW, M.steelDk()), e * (baseL / 2 - 0.03), 0.28, 0));
      }

      /* pump end: volute + suction eye + top discharge */
      var px = -baseL / 2 + casR + 0.16;
      var vol = alongX(cyl(casR, casR, casR * 0.95, M.machine(), 34));
      g.add(at(vol, px, cl, 0));
      g.add(at(alongX(cyl(casR * 1.06, casR * 1.06, casR * 0.16, M.machineDk(), 34)),
        px - casR * 0.48, cl, 0));
      /* casing feet */
      g.add(at(box(casR * 1.5, Math.max(0.03, cl - 0.23), casR * 1.1, M.machineDk()), px + casR * 0.2, (cl + 0.23) / 2 - 0.02, 0));

      /* suction — axial into the eye, horizontal, with a reducer at the flange */
      var sucLen = casR * 2.4;
      var suc = pipe(d.sucOd, sucLen, { mat: M.steel(), flanges: false });
      g.add(at(suc, px - casR * 0.55 - sucLen / 2, cl, 0));
      g.add(at(flange(d.sucOd, M.steelDk()), px - casR * 0.55 - sucLen, cl, 0));
      g.add(at(label('SUCTION' + (d.sucNps ? '  NPS ' + d.sucNps + '″' : ''), { h: 0.027 }),
        px - casR * 0.55 - sucLen, cl + d.sucOd * 1.6 + 0.06, 0));

      /* discharge — vertical off the volute top, then a bend to the battery
         limit. The torus arc runs 0 → 90°; turning it a further 90° about Z
         puts its two ends where the vertical and the horizontal actually are. */
      var disH = casR * 1.9, Ytop = cl + casR + disH, Rb = d.disOd * 1.5;
      g.add(at(cyl(d.disOd / 2, d.disOd / 2, disH, M.steel(), 22), px, cl + casR + disH / 2, 0));
      var eb = elbow(d.disOd, Rb, M.steel());
      eb.rotation.z = Math.PI / 2;
      g.add(at(eb, px + Rb, Ytop, 0));
      var runL = casR * 2.2;
      g.add(at(pipe(d.disOd, runL, { mat: M.steel(), flanges: false }),
        px + Rb + runL / 2, Ytop + Rb, 0));
      g.add(at(flange(d.disOd, M.steelDk()), px + Rb + runL, Ytop + Rb, 0));
      g.add(at(label('DISCHARGE' + (d.disNps ? '  NPS ' + d.disNps + '″' : ''), { h: 0.027 }),
        px + Rb + runL * 0.6, Ytop + Rb + d.disOd * 2.2, 0));

      /* bearing frame, coupling guard, motor */
      var bfL = casR * 1.3;
      g.add(at(alongX(cyl(casR * 0.5, casR * 0.62, bfL, M.machineDk(), 20)), px + casR * 0.6 + bfL / 2, cl, 0));
      var gx = px + casR * 0.6 + bfL + 0.10;
      var guard = alongX(cyl(casR * 0.62, casR * 0.62, 0.16, mat(C.guard, { m: 0.4, r: 0.55, op: 0.5, side: true }), 18));
      g.add(at(guard, gx, cl, 0));
      g.add(at(alongX(cyl(casR * 0.12, casR * 0.12, 0.22, M.steelDk(), 12)), gx, cl, 0));

      var mx = gx + 0.10 + motorL / 2;
      g.add(at(alongX(cyl(motorD / 2, motorD / 2, motorL, M.motor(), 30)), mx, cl, 0));
      for (var i2 = 0; i2 < 9; i2++) {
        g.add(at(alongX(cyl(motorD / 2 + motorD * 0.05, motorD / 2 + motorD * 0.05, motorL / 70, M.motor(), 30)),
          mx - motorL * 0.36 + motorL * 0.72 * (i2 / 8), cl, 0));
      }
      g.add(at(alongX(cyl(motorD * 0.36, motorD * 0.36, motorD * 0.28, M.machineDk(), 20)), mx + motorL / 2 + motorD * 0.12, cl, 0));
      g.add(at(box(motorD * 0.5, motorD * 0.34, motorD * 0.42, M.machineDk()), mx, cl + motorD / 2 + motorD * 0.14, 0));
      g.add(at(box(motorD * 1.3, Math.max(0.03, cl - 0.23), motorD * 1.5, M.motor()), mx, (cl + 0.23) / 2 - 0.02, 0));
      g.add(at(label(f(d.kw, 1) + ' kW MOTOR', { h: 0.026 }), mx, cl + motorD * 1.15, 0));

      g.add(at(tagLabel(d.tag), px - casR * 0.4, Ytop + Rb + d.disOd * 5.5, 0));
      g.add(at(flowArrow(casR * 1.6, C.cold, ''), px - casR * 2.6, cl - casR * 1.25, 0));
      return g;
    },
    overlay: function (d) {
      return [
        ['DUTY', f(d.Q, 1) + ' m³/h @ ' + f(d.H, 1) + ' m'],
        ['SUCTION P1', f(d.p1, 3) + ' bar a  ·  ' + f(d.vs, 2) + ' m/s'],
        ['DISCHARGE P2', f(d.p2, 3) + ' bar a  ·  ' + f(d.vd, 2) + ' m/s'],
        ['NPSHa / NPSHr', f(d.npsha, 2) + ' / ' + f(d.npshr, 2) + ' m'],
        ['DRIVER', f(d.kw, 2) + ' kW  ·  ' + f(d.eff, 1) + ' % eff']
      ];
    },
    note: 'Baseplate, foundation and coupling guard are arrangement steel shown for context — they are not sized by this calculation.'
  });

  /* ── LINE SIZING ────────────────────────────────────────────────────────
     The spool the calculation sized: correct bore, correct run, the design
     rise drawn as a rise, the fittings actually counted in the ΣK, and pipe
     supports along the run. */
  ['line-liquid', 'line-gas', 'line-steam', 'line-slurry', 'line-twophase'].forEach(function (mod) {
    var nice = { 'line-liquid': 'LIQUID', 'line-gas': 'GAS', 'line-steam': 'STEAM',
                 'line-slurry': 'SLURRY', 'line-twophase': 'TWO-PHASE' }[mod];
    var tint = { 'line-liquid': C.cold, 'line-gas': 0x6ea8c0, 'line-steam': C.hot,
                 'line-slurry': 0x8a7f6a, 'line-twophase': 0x7f9ec0 }[mod];
    register(mod, {
      height: 320, az: 0.55, el: 1.28,
      title: nice + ' LINE — PIPING SPOOL',
      data: function () {
        var r = vals(mod);
        var ok = !!(r && isFinite(r.V));
        if (!ok) return { ok: false, od: 0.1143, id: 0.1023, L: 6, dz: 0, fits: [] };
        return {
          ok: true, r: r,
          od: r.odIn ? r.odIn * 0.0254 : (r.Dmm * 1.12) / 1000,
          id: (r.Dmm || 100) / 1000,
          L: pick(r.L, 6), dz: isFinite(r.dz) ? r.dz : 0,
          nps: r.nps, sch: r.sch, V: r.V, dP: r.dpTotal,
          p1: r.pUp, p2: r.pDown, svc: r.svc, matName: r.matName,
          Re: r.Re, vAllow: r.Vallow,
          fits: (r.fitList || []).filter(function (x) { return x && (x.qty || 0) > 0; })
        };
      },
      build: function (d, vp) {
        var g = grp();
        var L = Math.max(0.6, Math.min(d.L, 60));
        var rise = Math.max(-L * 0.6, Math.min(L * 0.6, d.dz || 0));
        var od = d.od, segs = 5;
        var yBase = Math.max(od * 3, 0.9) + Math.max(0, -rise);

        /* the run, drawn as a chain of short spools so a rise reads as a rise */
        var stepL = L / segs, ang = Math.atan2(rise, L);
        for (var i = 0; i < segs; i++) {
          var t = (i + 0.5) / segs;
          var sp = pipe(od, stepL * 1.004, { mat: M.steel(), flanges: false });
          sp.rotation.z = ang;
          g.add(at(sp, -L / 2 + t * L, yBase + rise * t, 0));
        }
        var endFa = flange(od, M.steelDk()); endFa.rotation.z = ang;
        g.add(at(endFa, -L / 2, yBase, 0));
        var endFb = flange(od, M.steelDk()); endFb.rotation.z = ang;
        g.add(at(endFb, L / 2, yBase + rise, 0));

        /* pipe supports at a spacing that keeps them out of the fittings */
        var nSup = Math.max(2, Math.min(6, Math.round(L / 3)));
        for (var s = 0; s < nSup; s++) {
          var ts = (s + 0.5) / nSup;
          g.add(at(support(od, Math.max(0.05, yBase + rise * ts - od * 0.7)),
            -L / 2 + ts * L, yBase + rise * ts, 0));
        }

        /* the fittings that are actually in the design */
        var shown = d.fits.slice(0, 6);
        shown.forEach(function (ft, k) {
          var tf = (k + 1) / (shown.length + 1);
          var x = -L / 2 + tf * L, y = yBase + rise * tf;
          var nm = String(ft.name || '').toLowerCase();
          var piece;
          if (nm.indexOf('valve') >= 0) piece = valve(od, nm.indexOf('check') >= 0 ? 'check' : 'gate');
          else if (nm.indexOf('reduc') >= 0 || nm.indexOf('enlarg') >= 0) piece = reducer(od, od * 0.72, od * 2);
          else if (nm.indexOf('tee') >= 0) {
            piece = grp();
            piece.add(alongX(cyl(od * 0.56, od * 0.56, od * 1.8, M.steel(), 20)));
            piece.add(at(cyl(od / 2, od / 2, od * 1.5, M.steel(), 20), 0, od * 0.75, 0));
            piece.add(at(flange(od, M.steelDk()), 0, od * 1.5, 0));
          } else {
            piece = grp();
            piece.add(alongX(cyl(od * 0.58, od * 0.58, od * 1.5, M.machine(), 20)));
            piece.add(at(flange(od, M.steelDk()), -od * 0.8, 0, 0));
            piece.add(at(flange(od, M.steelDk()), od * 0.8, 0, 0));
          }
          piece.rotation.z = ang;
          g.add(at(piece, x, y, 0));
          g.add(at(label((ft.qty || 1) + ' × ' + (ft.name || 'fitting'), { h: 0.024 }),
            x, y + od * 2.2 + L * 0.02, 0));
        });
        if (d.ok && !d.fits.length) {
          g.add(at(label('NO FITTINGS IN THE DESIGN \u2014 STRAIGHT RUN', { h: 0.024 }),
            0, yBase + rise / 2 - Math.max(od * 4, L * 0.05), 0));
        }
        if (d.fits.length > shown.length) {
          g.add(at(label('+ ' + (d.fits.length - shown.length) + ' further fitting type(s)', { h: 0.024 }),
            0, yBase + rise / 2 - od * 3, 0));
        }

        /* terminal points */
        g.add(at(label('P1', { h: 0.030, line: 'rgba(56,189,248,0.8)' }), -L / 2 - od * 2.4, yBase, 0));
        g.add(at(label('P2', { h: 0.030, line: 'rgba(56,189,248,0.8)' }), L / 2 + od * 2.4, yBase + rise, 0));
        g.add(at(flowArrow(Math.max(od * 6, L * 0.18), tint,
          d.ok ? 'FLOW  ' + f(d.V, 2) + ' m/s' : 'FLOW'),
          -L * 0.22, yBase + rise * 0.28 - Math.max(od * 2.6, L * 0.035), 0));
        if (d.ok) {
          g.add(at(tagLabel('NPS ' + d.nps + '″ SCH ' + d.sch), 0, yBase + rise / 2 + od * 3.6 + L * 0.03, 0));
        }
        return g;
      },
      overlay: function (d) {
        var r = d.r || {};
        return [
          ['LINE SIZE', d.ok ? 'NPS ' + d.nps + '″ SCH ' + d.sch : '—'],
          ['BORE', f(r.Dmm, 2) + ' mm'],
          ['VELOCITY', f(d.V, 3) + ' m/s'],
          ['REYNOLDS', isFinite(r.Re) ? Math.round(r.Re).toLocaleString() : '—'],
          ['TOTAL ΔP', f(d.dP, 5) + ' bar'],
          ['P1 → P2', f(d.p1, 3) + ' → ' + f(d.p2, 3) + ' bar']
        ];
      },
      note: 'Pipe supports and their spacing are shown for context — support design is not part of this calculation.'
    });
  });

  /* ── DOUBLE PIPE EXCHANGER ──────────────────────────────────────────────
     The hairpin stack the calculation arrived at: n hairpins, each two legs
     of the calculated length, return bends, annulus nozzles, support frame. */
  register('dphe', {
    height: 360, az: 0.75, el: 1.24,
    title: 'DOUBLE PIPE HEAT EXCHANGER — HAIRPIN STACK',
    data: function () {
      var d = window.dpheReportData;
      var ok = !!(d && isFinite(d.L) && isFinite(d.D2));
      if (!ok) {
        return { ok: false, L: 4.88, nHp: 2, Do: 0.0483, D2: 0.0779, Di: 0.0409 };
      }
      return {
        ok: true, L: pick(d.L, 4.88), nHp: Math.max(1, Math.min(12, Math.round(d.nHp || 1))),
        Do: pick(d.Do, 0.0483), D2: pick(d.D2, 0.0779), Di: pick(d.Di, 0.0409),
        Q: d.Q, LMTD: d.LMTD, Ud: d.Ud, Aavail: d.Aavail, Areq: d.Areq,
        excess: d.excessArea, dPi: d.dP_inner, dPa: d.dP_annulus,
        fluidTube: d.fluidTube, fluidAnn: d.fluidAnn,
        Thi: d.Thi, Tho: d.Tho, Tci: d.Tci, Tco: d.Tco,
        velTube: d.velTube, velAnn: d.velAnn,
        stdInner: d.stdInnerPipe, stdOuter: d.stdOuterPipe
      };
    },
    build: function (d, vp) {
      var g = grp();
      var L = Math.max(0.5, Math.min(d.L, 12));
      var shellOd = d.D2 * 1.18, innerOd = d.Do;
      var pitchY = shellOd * 1.8;               /* leg-to-leg in a hairpin */
      var stackY = pitchY * 1.55;               /* hairpin-to-hairpin */
      var y0 = shellOd * 2.4;
      var top = y0 + (d.nHp - 1) * stackY + pitchY + shellOd;

      for (var hp = 0; hp < d.nHp; hp++) {
        var yb = y0 + hp * stackY;
        [0, 1].forEach(function (leg) {
          var y = yb + leg * pitchY;
          /* outer (annulus) pipe, cut away so the inner tube reads */
          var outer = new T.Mesh(new T.CylinderGeometry(shellOd / 2, shellOd / 2, L, 30, 1, true,
            cutStart(0.44, Math.PI * 1.40), Math.PI * 1.40),
            mat(C.steel, { m: 0.72, r: 0.38, side: true }));
          g.add(at(alongX(outer), 0, y, 0));
          g.add(at(alongX(cyl(innerOd / 2, innerOd / 2, L * 1.01, M.bundle(), 22)), 0, y, 0));
          /* end unions */
          [-1, 1].forEach(function (e2) {
            g.add(at(flange(shellOd, M.steelDk()), e2 * L / 2, y, 0));
          });
        });
        /* return bend joining the two legs at +X, annulus crossover at −X */
        var rb = new T.Mesh(new T.TorusGeometry(pitchY / 2, innerOd / 2, 12, 20, Math.PI),
          M.bundle());
        rb.rotation.y = Math.PI / 2;
        rb.rotation.z = -Math.PI / 2;
        g.add(at(rb, L / 2 + innerOd * 1.2, yb + pitchY / 2, 0));
        var rbo = new T.Mesh(new T.TorusGeometry(pitchY / 2, shellOd / 2.6, 10, 18, Math.PI),
          mat(C.steel, { m: 0.7, r: 0.4 }));
        rbo.rotation.y = Math.PI / 2;
        rbo.rotation.z = -Math.PI / 2;
        g.add(at(rbo, L / 2 + innerOd * 1.2, yb + pitchY / 2, 0));

        /* annulus nozzles on each leg */
        [0, 1].forEach(function (leg) {
          var y = yb + leg * pitchY;
          var nz = nozzle(shellOd * 0.42, shellOd * 0.8, M.steel());
          nz.rotation.z = Math.PI / 2;
          g.add(at(nz, (leg ? -1 : 1) * L * 0.42, y + shellOd / 2, 0));
        });
        /* support frame */
        g.add(at(box(0.05, yb + pitchY + shellOd, 0.05, M.steelDk()), -L * 0.36, (yb + pitchY + shellOd) / 2, shellOd * 0.9));
        g.add(at(box(0.05, yb + pitchY + shellOd, 0.05, M.steelDk()), -L * 0.36, (yb + pitchY + shellOd) / 2, -shellOd * 0.9));
        g.add(at(box(0.05, yb + pitchY + shellOd, 0.05, M.steelDk()), L * 0.36, (yb + pitchY + shellOd) / 2, shellOd * 0.9));
        g.add(at(box(0.05, yb + pitchY + shellOd, 0.05, M.steelDk()), L * 0.36, (yb + pitchY + shellOd) / 2, -shellOd * 0.9));
      }

      g.add(at(tagLabel(d.nHp + ' × HAIRPIN  ·  ' + f(L, 2) + ' m LEG'), 0, top + shellOd * 2.6, 0));
      /* the two services are one pipe diameter apart on the model; put their
         callouts at opposite ends so the text does not sit on top of itself */
      g.add(at(hotLabel('TUBE  ' + (d.fluidTube || 'TUBE SIDE')),
        -L / 2 - Math.max(shellOd * 3, L * 0.10), y0 - shellOd * 1.6, 0));
      g.add(at(coldLabel('ANNULUS  ' + (d.fluidAnn || 'SHELL SIDE')),
        -L / 2 - Math.max(shellOd * 3, L * 0.10), top - shellOd * 1.2, 0));
      return g;
    },
    overlay: function (d) {
      return [
        ['DUTY', f(d.Q, 2) + ' kW  ·  LMTD ' + f(d.LMTD, 2) + ' °C'],
        ['U DIRTY', f(d.Ud, 1) + ' W/m²·K'],
        ['AREA', f(d.Aavail, 3) + ' / ' + f(d.Areq, 3) + ' m²  (' + f(d.excess, 1) + ' % excess)'],
        ['VELOCITY', 'tube ' + f(d.velTube, 2) + '  annulus ' + f(d.velAnn, 2) + ' m/s'],
        ['ΔP', 'tube ' + f(d.dPi, 2) + '  annulus ' + f(d.dPa, 2) + ' kPa'],
        ['HAIRPINS', isFinite(d.nHp) ? String(d.nHp) : '—']
      ];
    },
    note: 'Support frame is shown for context — it is not sized by this calculation.'
  });

  /* ── SHELL & TUBE EXCHANGER ─────────────────────────────────────────────
     The TEMA arrangement the calculation produced: shell at the selected
     diameter, channel head, saddles, the four nozzles at their selected NPS,
     and the bundle at the calculated tube count, shown through a cutaway. */
  register('sthe', {
    height: 380, az: 0.68, el: 1.24,
    title: 'SHELL & TUBE HEAT EXCHANGER — TEMA ARRANGEMENT',
    data: function () {
      var s = window.state && window.state.sthe;
      var ok = !!(s && s.calculated && s.results);
      var r = ok ? s.results : {}, i = ok ? (s.inputs || {}) : {};
      var Ds = pick(r.Ds_used_mm, raw('sthe-shell-id')) / 1000;
      var L = pick(num('sthe-tube-L'), 4.88);
      if (L > 40) L = L / 1000;                 /* a length entered in mm */
      var tubeOd = pick(num('sthe-tube-od'), 0.01905);
      if (tubeOd > 0.5) tubeOd = tubeOd / 1000;
      return {
        ok: ok,
        Ds: isFinite(Ds) && Ds > 0 ? Ds : 0.387,
        L: Math.max(0.5, Math.min(L, 12)),
        tubeOd: tubeOd,
        Nt: pick(r.Nt, 0), Np: i.Np || raw('sthe-tube-passes') || 2,
        Db: pick(r.Db_mm, NaN) / 1000,
        nozT: r.noz_tube_nps, nozS: r.noz_shell_nps,
        dT: pick(r.D_nozzle_tube_in, NaN) / 1000, dS: pick(r.D_nozzle_shell_in, NaN) / 1000,
        tema: r.temaDesignation, type: r.stheType,
        Q: r.Q_kW, lmtd: r.dT_lm, U: r.U_calc, Aa: r.Aa, Ar: r.Ar,
        excess: r.excessArea, dpt: r.dp_tube_kPa, dps: r.dp_shell_kPa,
        tubeFluid: i.tubeSideFluid, shellFluid: i.shellSideFluid,
        baffle: pick(num('sthe-baffle-space'), NaN)
      };
    },
    build: function (d, vp) {
      var g = grp();
      /* a head 0.75 D long is longer than the shell on a large-diameter
         exchanger; hold it to a fraction of the unit as well */
      var Ds = d.Ds, L = d.L, headL = Math.min(Ds * 0.7, L * 0.28);
      var y = Ds * 0.95 + 0.25;
      var odT = isFinite(d.dT) && d.dT > 0 ? d.dT : odOfNps(d.nozT, 100);
      var odS = isFinite(d.dS) && d.dS > 0 ? d.dS : odOfNps(d.nozS, 150);

      /* shell, cut away on the near side so the bundle is visible */
      var shell = new T.Mesh(new T.CylinderGeometry(Ds / 2, Ds / 2, L, 40, 1, true,
        cutStart(0.42, Math.PI * 1.48), Math.PI * 1.48),
        mat(C.steel, { m: 0.7, r: 0.4, side: true }));
      g.add(at(alongX(shell), 0, y, 0));

      /* tube bundle at the calculated count, on a square-ish lattice inside
         the bundle diameter the calculation reported */
      var Db = isFinite(d.Db) && d.Db > 0 ? d.Db : Ds * 0.86;
      var Nt = Math.max(0, Math.round(d.Nt));
      if (Nt > 0) {
        var pitch = d.tubeOd * 1.25;
        var pts = [];
        var half = Math.ceil(Db / 2 / pitch) + 1;
        for (var ri = -half; ri <= half; ri++) {
          for (var ci = -half; ci <= half; ci++) {
            var tx = ci * pitch + (ri % 2 ? pitch / 2 : 0), tz = ri * pitch * 0.866;
            if (tx * tx + tz * tz <= (Db / 2 - d.tubeOd / 2) * (Db / 2 - d.tubeOd / 2)) {
              pts.push([tx, tz]);
            }
          }
        }
        pts.sort(function (a, b) { return (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]); });
        var show = Math.min(pts.length, Nt, 900);
        var geo = new T.CylinderGeometry(d.tubeOd / 2, d.tubeOd / 2, L * 1.01, 8);
        var inst = show > 0 ? new T.InstancedMesh(geo, M.bundle(), show) : null;
        var mtx = new T.Matrix4(), qt = new T.Quaternion()
          .setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2);
        var one = new T.Vector3(1, 1, 1);
        for (var k = 0; inst && k < show; k++) {
          mtx.compose(new T.Vector3(0, y + pts[k][1], pts[k][0]), qt, one);
          inst.setMatrixAt(k, mtx);
        }
        if (inst) {
          inst.instanceMatrix.needsUpdate = true;
          g.add(inst);
        } else {
          geo.dispose();
        }
      }

      /* tubesheets and segmental baffles */
      [-1, 1].forEach(function (e2) {
        g.add(at(alongX(cyl(Ds / 2 * 0.99, Ds / 2 * 0.99, Ds * 0.04, M.steelDk(), 34)), e2 * L / 2, y, 0));
      });
      var B = isFinite(d.baffle) && d.baffle > 0 ? (d.baffle > 5 ? d.baffle / 1000 : d.baffle) : Ds;
      var nB = Math.max(0, Math.min(24, Math.floor(L / Math.max(B, Ds * 0.2)) - 1));
      for (var b = 1; b <= nB; b++) {
        var bx = -L / 2 + (L * b) / (nB + 1);
        var bf = new T.Mesh(new T.CylinderGeometry(Db / 2 * 0.99, Db / 2 * 0.99, 0.006, 30, 1, false,
          Math.PI * 0.25, Math.PI * (b % 2 ? 1.5 : 1.5)), M.steelDk());
        var bfm = alongX(bf);
        bfm.rotation.x = b % 2 ? 0 : Math.PI;
        g.add(at(bfm, bx, y, 0));
      }

      /* channel head (front) and bonnet (rear) */
      var ch = alongX(cyl(Ds / 2 * 1.02, Ds / 2 * 1.02, headL, M.machine(), 34));
      g.add(at(ch, -L / 2 - headL / 2 - Ds * 0.03, y, 0));
      g.add(at(flange(Ds * 0.62, M.steelDk()), -L / 2 - Ds * 0.03, y, 0));
      var cover = alongX(cyl(Ds / 2 * 1.08, Ds / 2 * 1.08, Ds * 0.06, M.machineDk(), 34));
      g.add(at(cover, -L / 2 - headL - Ds * 0.06, y, 0));
      var bon = new T.Mesh(new T.SphereGeometry(Ds / 2 * 1.02, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
        M.machine());
      bon.scale.y = 0.5;                       /* 2:1 ellipsoidal — depth D/4 */
      bon.rotation.z = -Math.PI / 2;
      g.add(at(bon, L / 2 + Ds * 0.03, y, 0));
      g.add(at(flange(Ds * 0.62, M.steelDk()), L / 2 + Ds * 0.03, y, 0));

      /* nozzles: shell in/out on the top, tube in/out on the channel */
      /* both shell callouts used to sit at one height, so at most camera
         bearings the upstream one hid behind the downstream one */
      function upNoz(x, od, lab, col, lift) {
        var nz = nozzle(od, Ds * 0.42, M.steel());
        nz.rotation.z = Math.PI / 2;
        g.add(at(nz, x, y + Ds / 2, 0));
        g.add(at(col ? hotLabel(lab) : coldLabel(lab),
          x, y + Ds / 2 + Ds * (0.55 + lift) + od, 0));
      }
      upNoz(-L * 0.36, odS, 'SHELL IN' + (d.nozS ? '  NPS ' + d.nozS + '″' : ''), true, 0.30);
      upNoz(L * 0.36, odS, 'SHELL OUT' + (d.nozS ? '  NPS ' + d.nozS + '″' : ''), false, 0);
      [1, -1].forEach(function (sgn, i2) {
        var nz2 = nozzle(odT, Ds * 0.4, M.steel());
        nz2.rotation.y = -Math.PI / 2;
        g.add(at(nz2, -L / 2 - headL * 0.55, y + sgn * Ds * 0.26, Ds / 2));
        g.add(at(i2 === 0 ? coldLabel('TUBE IN' + (d.nozT ? '  NPS ' + d.nozT + '″' : ''))
                          : hotLabel('TUBE OUT' + (d.nozT ? '  NPS ' + d.nozT + '″' : '')),
          -L / 2 - headL * 0.55, y + sgn * Ds * 0.26, Ds / 2 + Ds * 0.6));
      });

      /* saddles */
      [-1, 1].forEach(function (e3) {
        g.add(at(saddle(Ds, y - Ds / 2), e3 * L * 0.32, y, 0));
      });

      g.add(at(tagLabel((d.tema ? 'TEMA ' + d.tema + '  ·  ' : '')
        + (isFinite(d.Nt) && d.Nt ? d.Nt + ' TUBES × ' + d.Np + ' PASS' : 'SHELL & TUBE')),
        0, y + Ds * 1.25, 0));
      return g;
    },
    overlay: function (d) {
      return [
        ['DUTY', f(d.Q, 2) + ' kW  ·  LMTD ' + f(d.lmtd, 2) + ' °C'],
        ['U CALCULATED', f(d.U, 1) + ' W/m²·K'],
        ['AREA', f(d.Aa, 2) + ' / ' + f(d.Ar, 2) + ' m²  (' + f(d.excess, 1) + ' % excess)'],
        ['SHELL', isFinite(d.Ds) && d.ok ? f(d.Ds * 1000, 0) + ' mm ID' : '—'],
        ['TUBES', d.ok && d.Nt ? d.Nt + ' × ' + f(d.L, 3) + ' m, ' + d.Np + ' pass' : '—'],
        ['ΔP', 'tube ' + f(d.dpt, 2) + '  shell ' + f(d.dps, 2) + ' kPa']
      ];
    },
    note: 'Saddles, baffle orientation and the cutaway are shown for context. Tubes are drawn to the calculated count and bundle diameter; the lattice is indicative of the selected layout.'
  });

  /* ── PLATE HEAT EXCHANGER ───────────────────────────────────────────────
     Frame, pressure plate, tie bars, the calculated number of plates, and the
     four ports at the calculated port diameter. */
  register('phe', {
    height: 350, az: -1.15, el: 1.16,
    title: 'PLATE HEAT EXCHANGER — FRAME ASSEMBLY',
    data: function () {
      var r = vals('phe');
      var ok = !!(r && isFinite(r.N) && isFinite(r.Lp));
      if (!ok) {
        return { ok: false, N: 41, Lp: 1.2, Wp: 0.5, Dp: 0.15, pitch: 0.0035 };
      }
      /* the module's result object carries plate geometry in METRES and the
         duty in WATTS — reading them as millimetres drew a 1 mm plate pack */
      return {
        ok: true, N: Math.max(3, Math.round(r.N)),
        Lp: r.Lp, Wp: r.Wp, Dp: r.Dp,
        pitch: r.pitch || 0.0035, npass: r.npass, Ncp: r.Ncp,
        Q: r.Q / 1000, lmtd: r.lmtd, dTm: r.dTm, Ud: r.Ud, Aprov: r.Aprov, Areq: r.Areq,
        overSurf: r.overSurf, dpH: r.dpH && r.dpH.dp, dpC: r.dpC && r.dpC.dp
      };
    },
    build: function (d, vp) {
      var g = grp();
      var Lp = d.Lp, Wp = d.Wp, Dp = d.Dp;
      var packL = Math.max(0.05, Math.min(d.N * d.pitch, Lp * 1.6));
      var frameT = Math.max(0.07, Wp * 0.20);
      var y = Lp / 2 + 0.22;
      var xFix = -packL / 2 - frameT / 2, xPress = packL / 2 + frameT / 2;

      /* fixed cover and movable pressure plate — heavier and darker than the
         pack, so the assembly does not read as one undifferentiated slab */
      g.add(at(box(frameT, Lp * 1.14, Wp * 1.18, M.machineDk()), xFix, y, 0));
      g.add(at(box(frameT * 0.8, Lp * 1.14, Wp * 1.18, M.machineDk()), xPress, y, 0));

      /* the plate pack, drawn plate by plate up to a legible limit */
      var shown = Math.min(d.N, 90), step = packL / shown;
      for (var i = 0; i < shown; i++) {
        var px = -packL / 2 + step * (i + 0.5);
        g.add(at(box(step * 0.55, Lp, Wp, i % 2 ? M.steel() : mat(0xb9c4cc, { m: 0.78, r: 0.3 })), px, y, 0));
        g.add(at(box(step * 0.22, Lp * 1.005, Wp * 1.005, M.gasket()), px + step * 0.38, y, 0));
      }

      /* carrying bar above, guide bar below, tie bolts around the frame */
      g.add(at(box(packL + frameT * 2.6, Wp * 0.09, Wp * 0.09, M.steelDk()), 0, y + Lp * 0.58, 0));
      g.add(at(box(packL + frameT * 2.6, Wp * 0.07, Wp * 0.07, M.steelDk()), 0, y - Lp * 0.58, 0));
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c2) {
        g.add(at(alongX(cyl(Wp * 0.028, Wp * 0.028, packL + frameT * 2.4, M.steelDk(), 10)),
          0, y + c2[0] * Lp * 0.42, c2[1] * Wp * 0.64));
      });

      /* the four ports, on the fixed cover */
      var ports = [[-1, 1, 'HOT IN', true], [-1, -1, 'HOT OUT', true],
                   [1, 1, 'COLD OUT', false], [1, -1, 'COLD IN', false]];
      ports.forEach(function (p) {
        var yy = y + p[1] * Lp * 0.32, zz = p[0] * Wp * 0.28;
        var nz = nozzle(Dp, frameT * 1.5, p[3] ? M.hot() : M.cold());
        nz.rotation.y = Math.PI;
        g.add(at(nz, xFix - frameT / 2, yy, zz));
        g.add(at(p[3] ? hotLabel(p[2]) : coldLabel(p[2]),
          xFix - frameT * 3.4, yy, zz + p[0] * Wp * 0.22));
      });

      /* feet */
      [-1, 1].forEach(function (e2) {
        g.add(at(box(frameT * 1.3, y - Lp / 2 - 0.02, Wp * 1.3, M.machineDk()),
          e2 * (packL / 2 + frameT / 2), (y - Lp / 2) / 2, 0));
      });

      g.add(at(tagLabel(d.ok ? d.N + ' PLATES  ·  ' + f(Lp, 3) + ' × ' + f(Wp, 3) + ' m'
        : 'PLATE PACK'), 0, y + Lp * 0.78, 0));
      if (d.ok && d.N > shown) {
        g.add(at(label('pack drawn to ' + shown + ' of ' + d.N + ' plates for legibility', { h: 0.024 }),
          0, y + Lp * 0.66, Wp * 0.9));
      }
      return g;
    },
    overlay: function (d) {
      return [
        ['DUTY', f(d.Q, 2) + ' kW  ·  LMTD ' + f(d.lmtd, 2) + ' °C'],
        ['U DIRTY', f(d.Ud, 1) + ' W/m²·K'],
        ['AREA', f(d.Aprov, 2) + ' / ' + f(d.Areq, 2) + ' m²  (' + f(d.overSurf, 1) + ' % over)'],
        ['PLATES', d.ok ? d.N + ' plates, ' + (d.npass || 1) + ' pass' : '—'],
        ['PLATE', d.ok ? f(d.Lp, 3) + ' × ' + f(d.Wp, 3) + ' m' : '—'],
        ['ΔP', 'hot ' + f(d.dpH, 1) + '  cold ' + f(d.dpC, 1) + ' kPa']
      ];
    },
    note: 'Frame, tie bars and feet are shown for context — the calculation sizes the plate pack, not the frame.'
  });

  /* ── STORAGE TANK ───────────────────────────────────────────────────────
     Shell at the design diameter and height, the roof that was selected, the
     product at the calculated working level, and the calculated alarm levels
     drawn where the calculation put them. */
  register('tank', {
    height: 400, az: 0.8, el: 1.30,
    title: 'VERTICAL STORAGE TANK — GENERAL ARRANGEMENT',
    data: function () {
      var r = vals('tank');
      var ok = !!(r && isFinite(r.Dm) && isFinite(r.Hm));
      if (!ok) return { ok: false, D: 6, H: 8, roof: 'cone' };
      return {
        ok: true, r: r, D: r.Dm, H: r.Hm, roof: String(r.roof || 'cone').toLowerCase(),
        workH: (r.workH || 0) / 1000,
        elHHLL: r.elHHLL / 1000, elHLL: r.elHLL / 1000,
        elLLL: r.elLLL / 1000, elLLLL: r.elLLLL / 1000,
        tag: r.tag, fluid: r.fluid, geoCap: r.geoCap, workCap: r.workCap,
        reqCap: r.reqCap, LD: r.LD, t: r.t, freeboard: r.freeboard, wEmpty: r.wEmpty
      };
    },
    build: function (d, vp) {
      var g = grp();
      var D = Math.max(0.8, d.D), H = Math.max(0.8, d.H), R = D / 2;

      /* ring wall foundation */
      g.add(at(cyl(R * 1.12, R * 1.16, 0.35, M.concrete(), 48), 0, 0.175, 0));
      /* bottom plate */
      g.add(at(cyl(R * 1.01, R * 1.01, 0.02, M.steelDk(), 48), 0, 0.36, 0));

      /* shell, open-ended so the product inside reads through the cutaway */
      var shell = new T.Mesh(new T.CylinderGeometry(R, R, H, 52, 1, true,
        cutStart(0.80, Math.PI * 1.56), Math.PI * 1.56),
        mat(C.steel, { m: 0.55, r: 0.5, side: true }));
      g.add(at(shell, 0, 0.36 + H / 2, 0));

      /* plate seams — visual only, declared indicative in the footer */
      var courses = Math.max(1, Math.min(10, Math.round(H / 2)));
      for (var s = 1; s < courses; s++) {
        var sy = 0.36 + (H * s) / courses;
        g.add(at(cyl(R * 1.004, R * 1.004, 0.018, M.steelDk(), 52), 0, sy, 0));
      }

      /* product at the calculated working level */
      var lvl = isFinite(d.workH) && d.workH > 0 ? Math.min(d.workH, H) : 0;
      if (lvl > 0) {
        g.add(at(cyl(R * 0.985, R * 0.985, lvl, mat(C.cold, { m: 0.15, r: 0.25, op: 0.55 }), 48),
          0, 0.37 + lvl / 2, 0));
      }

      /* roof */
      var roofH;
      if (d.roof.indexOf('dome') >= 0) {
        roofH = R * 0.35;
        var dome = new T.Mesh(new T.SphereGeometry(R, 44, 20, 0, Math.PI * 2, 0, Math.PI * 0.36),
          mat(C.steelDk, { m: 0.6, r: 0.5 }));
        /* the segment stands 0.574 R tall; squash it to the roof rise */
        dome.scale.y = roofH / (R * 0.574);
        g.add(at(dome, 0, 0.36 + H, 0));
      } else if (d.roof.indexOf('float') >= 0) {
        roofH = 0.12;
        g.add(at(cyl(R * 0.97, R * 0.97, 0.12, mat(C.steelDk, { m: 0.6, r: 0.5 }), 48),
          0, 0.36 + Math.max(lvl, H * 0.3) + 0.06, 0));
      } else if (d.roof.indexOf('open') >= 0) {
        roofH = 0;
        g.add(at(cyl(R * 1.02, R * 1.02, 0.05, M.steelDk(), 52), 0, 0.36 + H, 0));
      } else {
        roofH = R * 0.19;
        g.add(at(cyl(R * 0.06, R, roofH, mat(C.steelDk, { m: 0.6, r: 0.5 }), 52), 0, 0.36 + H + roofH / 2, 0));
      }

      /* calculated alarm levels */
      function ring(m2, lab, colour) {
        if (!isFinite(m2) || m2 <= 0 || m2 > H) return;
        var t2 = new T.Mesh(new T.TorusGeometry(R * 1.02, Math.max(0.012, R * 0.008), 6, 60),
          mat(colour, { m: 0.2, r: 0.6 }));
        t2.rotation.x = Math.PI / 2;
        g.add(at(t2, 0, 0.37 + m2, 0));
        g.add(at(label(lab + '  ' + f(m2, 3) + ' m', { h: 0.026 }), R * 1.35, 0.37 + m2, 0));
      }
      ring(d.elHHLL, 'HHLL', C.hot);
      ring(d.elHLL, 'HLL', 0x8fa3b4);
      ring(d.elLLL, 'LLL', 0x8fa3b4);
      ring(d.elLLLL, 'LLLL', C.hot);

      /* nozzles: inlet high, outlet low, overflow, plus a manway and a vent */
      var nzOd = Math.max(0.06, D * 0.03);
      function sideNoz(yy, ang, lab, tone) {
        var nz = nozzle(nzOd, R * 0.16, M.steel());
        nz.rotation.y = ang;
        g.add(at(nz, R * Math.cos(ang) * 0.99, 0.37 + yy, -R * Math.sin(ang) * 0.99));
        var lx = (R + R * 0.42) * Math.cos(ang), lz = -(R + R * 0.42) * Math.sin(ang);
        g.add(at(tone === 'hot' ? hotLabel(lab) : coldLabel(lab), lx, 0.37 + yy, lz));
      }
      /* the level callouts sit on +X; put the nozzles round the other side so
         the two sets of labels do not land on each other */
      sideNoz(H * 0.9, 2.25, 'INLET', 'cold');
      sideNoz(0.35, 2.75, 'OUTLET', 'hot');
      var manR = Math.min(0.35, D * 0.09);
      var mw = nozzle(manR * 2, R * 0.09, M.machine());
      mw.rotation.y = 3.5;
      g.add(at(mw, R * Math.cos(3.5) * 0.99, 0.37 + Math.max(0.7, H * 0.09), -R * Math.sin(3.5) * 0.99));
      g.add(at(cyl(nzOd * 0.7, nzOd * 0.7, R * 0.22, M.steel(), 16), R * 0.35, 0.36 + H + roofH + R * 0.11, 0));
      g.add(at(label('VENT', { h: 0.025 }), R * 0.35, 0.36 + H + roofH + R * 0.34, 0));

      /* access steel — declared indicative */
      var turns = 1.0, steps = 46, sR = R + 0.55;
      for (var i2 = 0; i2 <= steps; i2++) {
        var a2 = -0.5 + (i2 / steps) * turns * Math.PI * 2;
        var yy2 = 0.36 + (i2 / steps) * (H + roofH * 0.4);
        var tread = box(0.55, 0.035, 0.28, M.steelDk());
        tread.rotation.y = a2;
        g.add(at(tread, sR * Math.cos(a2), yy2, -sR * Math.sin(a2)));
        /* outer stringer, so the stair reads as a stair and not as debris */
        g.add(at(box(0.04, 0.90, 0.04, M.steelDk()),
          (sR + 0.24) * Math.cos(a2), yy2 + 0.45, -(sR + 0.24) * Math.sin(a2)));
      }

      g.add(at(tagLabel(d.tag || 'T-101'), 0, 0.36 + H + roofH + R * 0.55, 0));
      return g;
    },
    overlay: function (d) {
      var r = d.r || {};
      return [
        ['SHELL', d.ok ? 'Ø ' + f(d.D, 3) + ' m × ' + f(d.H, 3) + ' m' : '—'],
        ['CAPACITY', f(r.workCap, 2) + ' m³ working / ' + f(r.geoCap, 2) + ' m³ geometric'],
        ['REQUIRED', f(r.reqCap, 2) + ' m³'],
        ['H / D', f(r.LD, 2)],
        ['SHELL THICKNESS', f(r.t, 2) + ' mm'],
        ['WORKING LEVEL', f(d.workH, 3) + ' m']
      ];
    },
    note: 'Stairway, plate seams, ring wall and manway position are shown for context — they are not sized by this calculation.'
  });

  /* ═══════════════════════════════════════════════════════════════════════
     MOUNTING — the selector and the panel
     ═══════════════════════════════════════════════════════════════════════ */
  var MOUNTS = {
    pump: '#pump-3d-container',
    'line-liquid': '#lq-3dblock',
    'line-gas': '#gs-3dblock',
    'line-steam': '#st-3dblock',
    'line-slurry': '#sl-3dblock',
    'line-twophase': '#tp2-3dblock',
    dphe: '#dphe-3d-wrapper',
    sthe: '#sthe-3d-container',
    phe: '#phe-3dwrap',
    tank: '#tk-3dwrap'
  };

  var PANELS = {};   /* moduleId -> {wrap, vp, legacy, legacyDisp, ovl, foot, view} */

  function prefView() {
    try { return localStorage.getItem('aro3di_view') || 'ind'; } catch (e) { return 'ind'; }
  }
  function setPrefView(v) { try { localStorage.setItem('aro3di_view', v); } catch (e) {} }

  function injectCss() {
    if (document.getElementById('aro3di-css')) return;
    var s = document.createElement('style');
    s.id = 'aro3di-css';
    s.textContent = [
      '.aro3di{margin:0 0 var(--space-md,12px) 0;}',
      '.aro3di-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;',
      'font-family:var(--font-mono,monospace);font-size:9.5px;letter-spacing:0.06em;',
      'padding:5px 6px;border:1px solid var(--border-muted,#334);border-bottom:none;',
      'border-radius:6px 6px 0 0;background:rgba(148,163,184,0.07);}',
      '.aro3di-bar .aro3di-lab{font-weight:800;color:var(--text-muted,#94a3b8);margin-right:2px;}',
      '.aro3di-btn{font-family:inherit;font-size:9.5px;font-weight:800;letter-spacing:0.06em;',
      'padding:3px 9px;border-radius:4px;cursor:pointer;background:transparent;',
      'border:1px solid var(--border-muted,#334);color:var(--text-muted,#94a3b8);}',
      '.aro3di-btn:hover{border-color:#38bdf8;color:#38bdf8;}',
      '.aro3di-btn.on{background:rgba(56,189,248,0.16);border-color:#38bdf8;color:#38bdf8;}',
      '.aro3di-sp{flex:1 1 auto;}',
      '.aro3di-view{position:relative;border:1px solid var(--border-muted,#334);',
      'overflow:hidden;background:#121a22;}',
      /* the model is the picture; the numbers live under it, never across it */
      '.aro3di-ovl{position:absolute;left:8px;top:8px;right:8px;pointer-events:none;',
      'font-family:var(--font-mono,monospace);font-size:9px;line-height:1.5;}',
      '.aro3di-st{display:inline-block;font-weight:800;letter-spacing:0.08em;',
      'background:rgba(9,14,19,0.82);border:1px solid rgba(148,163,184,0.3);',
      'border-radius:4px;padding:3px 7px;}',
      '.aro3di-st.ok{color:#4ade80;border-color:rgba(74,222,128,0.5);}',
      '.aro3di-st.no{color:#94a3b8;}',
      '.aro3di-st.old{color:#fbbf24;border-color:rgba(251,191,36,0.55);}',
      '.aro3di-ttl{display:block;margin-top:4px;color:#cbd5e1;font-weight:700;',
      'background:rgba(9,14,19,0.7);border-radius:4px;padding:2px 6px;max-width:max-content;}',
      '.aro3di-data{border:1px solid var(--border-muted,#334);border-top:none;',
      'border-radius:0 0 6px 6px;padding:7px 9px;font-family:var(--font-mono,monospace);',
      'font-size:9.5px;line-height:1.6;background:rgba(148,163,184,0.05);}',
      '.aro3di-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:2px 16px;}',
      '.aro3di-rows div{display:flex;justify-content:space-between;gap:10px;',
      'border-bottom:1px dotted rgba(148,163,184,0.22);}',
      '.aro3di-rows i{color:var(--text-muted,#94a3b8);font-style:normal;white-space:nowrap;}',
      '.aro3di-rows b{color:var(--text-primary,#e2e8f0);font-weight:800;text-align:right;}',
      '.aro3di-msg{color:var(--text-muted,#94a3b8);margin-top:5px;}',
      '.aro3di-foot{font-size:8px;color:#7c8794;line-height:1.45;margin-top:5px;',
      'border-top:1px solid rgba(148,163,184,0.18);padding-top:4px;}',
      'body.theme-day .aro3di-data{background:rgba(15,23,42,0.04);border-color:#c8d0d8;}',
      'body.theme-day .aro3di-rows b{color:#0f172a;}',
      'body.theme-day .aro3di-rows i{color:#475569;}',
      'body.theme-day .aro3di-foot{color:#64748b;}',
      'body.theme-day .aro3di-bar{background:rgba(15,23,42,0.05);}',
      'body.theme-day .aro3di-btn{color:#475569;border-color:#c8d0d8;}',
      'body.theme-day .aro3di-btn.on{background:rgba(2,132,199,0.12);border-color:#0284c7;color:#0369a1;}',
      'body.theme-day .aro3di-view{border-color:#c8d0d8;}'
    ].join('');
    document.head.appendChild(s);
  }

  function mount(id) {
    if (PANELS[id]) return PANELS[id];
    if (!three() || typeof CustomOrbitControls !== 'function') return null;
    var def = REG[id];
    if (!def) return null;
    var legacy = document.querySelector(MOUNTS[id] || '');
    if (!legacy || !legacy.parentNode) return null;

    injectCss();
    var wrap = document.createElement('div');
    wrap.className = 'aro3di';
    wrap.setAttribute('data-aro3di', id);
    wrap.innerHTML =
      '<div class="aro3di-bar">'
      + '<span class="aro3di-lab">3D VIEW</span>'
      + '<button type="button" class="aro3di-btn" data-v="ind">INDUSTRIAL</button>'
      + '<button type="button" class="aro3di-btn" data-v="ana">ANALYTICAL</button>'
      + '<span class="aro3di-sp"></span>'
      + '<button type="button" class="aro3di-btn" data-a="fit">FIT</button>'
      + '<button type="button" class="aro3di-btn" data-a="png">SNAPSHOT</button>'
      + '</div>'
      + '<div class="aro3di-view">'
      + '<div class="aro3di-canvas"></div>'
      + '<div class="aro3di-ovl"></div>'
      + '</div>'
      + '<div class="aro3di-data">'
      + '<div class="aro3di-rows"></div>'
      + '<div class="aro3di-msg"></div>'
      + '<div class="aro3di-foot"></div>'
      + '</div>';
    legacy.parentNode.insertBefore(wrap, legacy);

    var p = {
      id: id, wrap: wrap, legacy: legacy,
      legacyDisp: legacy.style.display || '',
      view: wrap.querySelector('.aro3di-view'),
      canvas: wrap.querySelector('.aro3di-canvas'),
      ovl: wrap.querySelector('.aro3di-ovl'),
      data: wrap.querySelector('.aro3di-data'),
      rows: wrap.querySelector('.aro3di-rows'),
      msg: wrap.querySelector('.aro3di-msg'),
      foot: wrap.querySelector('.aro3di-foot'),
      vp: null, mode: prefView(), sig: null
    };
    PANELS[id] = p;

    wrap.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.aro3di-btn') : null;
      if (!b) return;
      if (b.getAttribute('data-v')) { setMode(id, b.getAttribute('data-v'), true); return; }
      var a = b.getAttribute('data-a');
      if (a === 'fit' && p.vp) p.vp.frame({ az: REG[id].az, el: REG[id].el });
      if (a === 'png') snapshot(id);
    });

    setMode(id, p.mode, false);
    return p;
  }

  /* Several modules build their existing 3D scene lazily, the first time their
     container reports a width. Defaulting to INDUSTRIAL hides that container,
     so the moment never arrives and ANALYTICAL would open an empty box. When
     the engineer switches back, give the module its moment. */
  var WAKE = {
    pump: ['pump-3d-container', 'initPump3D'],
    dphe: ['dphe-3d-container', 'initDPHE3D'],
    sthe: ['sthe-3d-container', 'initSTHE3D']
  };
  function wakeLegacy(id) {
    var w = WAKE[id];
    if (!w) return;
    var c = document.getElementById(w[0]);
    if (!c || !c.clientWidth || c.querySelector('canvas')) return;
    var fn = window[w[1]];
    if (typeof fn === 'function') { try { fn(c); } catch (e) {} }
  }

  function setMode(id, mode, remember) {
    var p = PANELS[id];
    if (!p) return;
    p.mode = mode;
    if (remember) setPrefView(mode);
    var btns = p.wrap.querySelectorAll('.aro3di-btn[data-v]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-v') === mode);
    }
    if (mode === 'ana') {
      p.view.style.display = 'none';
      p.data.style.display = 'none';
      p.legacy.style.display = p.legacyDisp;
      window.dispatchEvent(new Event('resize'));
      /* two frames: one for layout to give the container a width, one for the
         module's own visibility watchers to notice it */
      setTimeout(function () { wakeLegacy(id); window.dispatchEvent(new Event('resize')); }, 60);
      setTimeout(function () { wakeLegacy(id); window.dispatchEvent(new Event('resize')); }, 400);
    } else {
      p.view.style.display = '';
      p.data.style.display = '';
      p.legacy.style.display = 'none';
      build(id);
    }
  }

  /* A signature of everything the model is drawn from, so the scene is only
     rebuilt when the geometry it depends on has actually moved. */
  function signature(id, d) {
    try { return calcState(id) + '|' + JSON.stringify(d); }
    catch (e) { return calcState(id) + '|unserialisable'; }
  }

  function build(id, force) {
    var p = PANELS[id];
    var def = REG[id];
    if (!p || !def || p.mode !== 'ind') return;
    if (!three() || typeof CustomOrbitControls !== 'function') return;
    if (!p.canvas.clientWidth) return;                 /* still off-screen */

    var d;
    try { d = def.data(); } catch (e) { d = { ok: false }; }
    var sig = signature(id, d);
    if (!force && sig === p.sig && p.vp) { paintOverlay(id, d); return; }
    p.sig = sig;

    if (!p.vp) p.vp = new Viewport(p.canvas, def.height || 340);
    p.vp.clear();
    var g;
    try { g = def.build(d, p.vp); } catch (e) {
      p.ovl.innerHTML = '<span class="aro3di-st no">— MODEL UNAVAILABLE</span>'
        + 'The industrial model could not be built from the current design. '
        + 'The analytical view is unaffected.';
      return;
    }
    p.vp.root.add(g);
    try {
      var bb = new T.Box3().setFromObject(p.vp.root);
      var sz = bb.getSize(new T.Vector3());
      p.vp.laydown(Math.max(sz.x, sz.z) * 1.35);
    } catch (e2) {}
    p.vp.frame({ az: def.az, el: def.el });
    paintOverlay(id, d);
  }

  function paintOverlay(id, d) {
    var p = PANELS[id], def = REG[id];
    if (!p || !def) return;
    var st = calcState(id);
    var calculated = isCalc(id) && d && d.ok !== false;
    var rows = [];
    try { rows = def.overlay(d) || []; } catch (e) { rows = []; }

    var head;
    if (st === OUTDATED) {
      head = '<span class="aro3di-st old">⚠ SUPERSEDED — INPUTS CHANGED SINCE THE LAST RUN</span>';
      calculated = false;
    } else if (calculated) {
      head = '<span class="aro3di-st ok">\u25cf CALCULATED</span>';
    } else {
      head = '<span class="aro3di-st no">— NOT CALCULATED</span>';
    }

    p.ovl.innerHTML = head + '<span class="aro3di-ttl">' + esc(def.title) + '</span>';

    var h = '';
    rows.forEach(function (r) {
      h += '<div><i>' + esc(r[0]) + '</i><b>' + (calculated ? esc(r[1]) : '\u2014') + '</b></div>';
    });
    p.rows.innerHTML = h;
    p.msg.textContent = calculated ? ''
      : (st === OUTDATED
        ? 'Geometry follows the inputs on screen. Run the calculation again before reading any number off this model.'
        : 'The arrangement is drawn from the inputs entered so far. Numbers appear once the calculation has run.');
    p.foot.textContent = def.note || '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function snapshot(id) {
    var p = PANELS[id];
    if (!p || !p.vp) return;
    try {
      p.vp.renderer.render(p.vp.scene, p.vp.camera);
      var url = p.vp.renderer.domElement.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = 'AROGARA_' + id.toUpperCase() + '_INDUSTRIAL_3D.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {}
  }

  /* ── Wiring ─────────────────────────────────────────────────────────────── */
  var pending = null;
  function refreshAll(force) {
    Object.keys(REG).forEach(function (id) {
      var p = PANELS[id] || mount(id);
      if (p && p.mode === 'ind') build(id, force);
    });
  }
  function schedule(force) {
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () { pending = null; refreshAll(force); }, 220);
  }

  function boot() {
    if (!three()) return;
    refreshAll(true);
    /* mount points appear as tabs are opened and as modules render their own
       markup, so keep looking for a while rather than assuming one pass */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var missing = Object.keys(REG).some(function (id) { return !PANELS[id]; });
      if (!missing || tries > 40) { clearInterval(iv); }
      refreshAll(false);
    }, 900);

    /* Tabs, sub-tabs and view switches are spelt half a dozen different ways
       across the modules — hex-subtab, line-type-tab, tk-viewbtn — so listen
       to every click rather than to a list that will fall out of date. The
       work is trivial: a build on a panel with no width returns immediately. */
    document.addEventListener('click', function () { schedule(false); }, true);
    window.addEventListener('resize', function () { schedule(false); });
    document.addEventListener('input', function () { schedule(false); }, true);
    document.addEventListener('change', function () { schedule(false); }, true);
    if (window.AROSTATE && window.AROSTATE.onChange) {
      window.AROSTATE.onChange(function () { schedule(true); });
    }
  }

  /* A still of the industrial model, for the engineering report. Returns null
     unless the module has been calculated and the viewport is live, so a
     report can never carry a picture of a design that was never run. */
  function snapshotDataUrl(id) {
    var p = PANELS[id];
    if (!p || !p.vp || !isCalc(id)) return null;
    if (calcState(id) === OUTDATED) return null;
    try {
      p.vp.renderer.render(p.vp.scene, p.vp.camera);
      return p.vp.renderer.domElement.toDataURL('image/png');
    } catch (e) { return null; }
  }

  window.ARO3DI = {
    register: register,
    snapshot: snapshotDataUrl,
    title: function (id) { return REG[id] ? REG[id].title : ''; },
    refresh: function (id) { if (id) build(id, true); else refreshAll(true); },
    mount: mount,
    setMode: setMode,
    modules: function () { return Object.keys(REG); },
    panels: function () { return PANELS; },
    lib: {
      pipe: pipe, flange: flange, elbow: elbow, valve: valve, reducer: reducer,
      nozzle: nozzle, saddle: saddle, support: support, label: label,
      flowArrow: flowArrow, colours: C, materials: M, odOfNps: odOfNps
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  } else {
    setTimeout(boot, 400);
  }
})();
