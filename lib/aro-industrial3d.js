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
    /* the deck plane itself never went theme-aware — only the scene
       background and the grid lines did — so the equipment kept standing
       on a dark slab in daylight mode, with barely any contrast against it */
    deck: function () { return mat(deckColor(), { m: 0.05, r: 0.95 }); }
  };

  /* NPS → outside diameter, mm (ASME B36.10M). Used only to draw a nozzle at
     the size the calculation selected — the calculation itself owns the bore. */
  var NPS_OD = {
    0.5: 21.3, 0.75: 26.7, 1: 33.4, 1.25: 42.2, 1.5: 48.3, 2: 60.3, 2.5: 73.0,
    3: 88.9, 3.5: 101.6, 4: 114.3, 5: 141.3, 6: 168.3, 8: 219.1, 10: 273.1,
    12: 323.9, 14: 355.6, 16: 406.4, 18: 457.2, 20: 508.0, 22: 559.0,
    24: 610.0, 26: 660.0, 30: 762.0, 36: 914.0
  };
  /* The pump's own nozzle table (STANDARD_NOZZLES in app.js) writes NPS as
     "1/2"", "3/4"" and "1½"" — a fraction or a half symbol, then the inch
     mark. parseFloat stops at the first character that isn't part of a
     plain number, which for a slash or a "½" is the digit before it: it
     read "1/2"" as 1 and "3/4"" as 3. NPS_OD[1] is a genuine 1″ nozzle
     (33.4 mm OD) — 57% wider than the 21.3 mm the calculation actually
     selected — so a pump sized to 1/2″ or 3/4″ was drawn, spaced and
     scaled as if it were one size larger throughout the whole assembly.
     Whole sizes ('2"', '6"') parse correctly today only because the inch
     mark is the very next character after the digit. */
  function npsValue(nps) {
    var s = String(nps == null ? '' : nps).trim();
    var m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);      /* "1 1/2"" */
    if (m) return (+m[1]) + (+m[2]) / (+m[3]);
    m = s.match(/^(\d+)\s*\/\s*(\d+)/);                  /* "1/2"" */
    if (m) return (+m[1]) / (+m[2]);
    m = s.match(/^(\d+)\s*½/);                           /* "1½"" */
    if (m) return (+m[1]) + 0.5;
    if (/^½/.test(s)) return 0.5;
    return parseFloat(s);                                /* "2"", "6"", 2, 0.75 */
  }
  function odOfNps(nps, fallbackMm) {
    var n = npsValue(nps);
    if (isFinite(n) && NPS_OD[n]) return NPS_OD[n] / 1000;
    if (isFinite(n) && n > 0) return (n * 25.4 * 1.13) / 1000;
    return (fallbackMm || 100) / 1000;
  }
  /* The reverse of odOfNps, off the SAME B36.10M table — for a module (PHE)
     that sizes its own ports directly to a bore in mm rather than picking
     an NPS from a nozzle-selection table the way pump/STHE do. Nearest
     table entry to the port's OD, not "smallest that fits" — this is a
     label for the size already drawn, not a fresh selection. */
  function npsOfOd(odM) {
    if (!isFinite(odM) || odM <= 0) return null;
    var odMm = odM * 1000, best = null, bestDiff = Infinity;
    for (var k in NPS_OD) {
      var diff = Math.abs(NPS_OD[k] - odMm);
      if (diff < bestDiff) { bestDiff = diff; best = k; }
    }
    return best;
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
  function label3(text, kind) {
    if (kind === 'node') return label(text, { h: 0.030, line: 'rgba(56,189,248,0.85)', fg: '#9fd8f5' });
    return label(text, { h: 0.024 });
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

  /* The scene ground follows the application theme. It used to be a fixed
     near-black, so an engineer working in the light theme had a black hole
     in the middle of a white page — the one part of the screen that had not
     been told the theme had changed. The model's own materials do not
     change: steel reads as steel on either ground. */
  function sceneBg() {
    try {
      if (document.body && document.body.classList.contains('theme-day')) return 0xe9edf1;
    } catch (e) {}
    return C.bg;
  }
  function gridColor() {
    try {
      if (document.body && document.body.classList.contains('theme-day')) return 0xb9c3cd;
    } catch (e) {}
    return C.grid;
  }
  function deckColor() {
    try {
      if (document.body && document.body.classList.contains('theme-day')) return 0xdde3e8;
    } catch (e) {}
    return C.deck;
  }

  function Viewport(mount, height) {
    this.mount = mount;
    this.h = height || 340;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(sceneBg());
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

    /* A second, orthographic camera on the same scene. FRONT, TOP and SIDE
       are only true projections without perspective — an elevation taken
       through a perspective lens is not an elevation. */
    this.ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, 8000);
    this.ortho.position.copy(this.camera.position);
    this.isOrtho = false;

    this.controls = new CustomOrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.autoRotate = false;
    /* Was [0.12, PI/2+0.22] — under the horizon and most of the overhead
       dome were unreachable by dragging; a VIEW button (frameLegacy/camera()
       below) widened this to [0.02, PI-0.02] but only after the engineer
       found and clicked one. This is the shared viewport every module's
       INDUSTRIAL tab renders through (pump, all five line-sizing services,
       DPHE, STHE, PHE, tank) so it starts at the same full range those
       buttons already grant, everywhere, without needing that discovery. */
    this.controls.minPolarAngle = 0.02;
    this.controls.maxPolarAngle = Math.PI - 0.02;

    var self = this;
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(function () { self.resize(); });
      this.ro.observe(mount);
    }
    /* ── Redraw only when there is something new to draw ────────────────
       Ten panels each redrawing sixty times a second is sixty times the
       work a still model needs, and the page stutters under it. A viewport
       draws when it is dirty — after a rebuild, a resize, a lens change or
       an orbit — and otherwise sits idle. Damping is off, so the camera
       settles in one frame and nothing is lost by stopping.

       Flow animation sets the flag every frame, so a running particle
       stream is unaffected. */
    this.dirty = true;
    this.lastDraw = 0;
    this.camX = this.camY = this.camZ = Infinity;  /* nothing equals this, so frame one always draws */
    var mark = function () { self.dirty = true; };
    ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchstart',
      'touchmove', 'touchend', 'dblclick'].forEach(function (ev) {
        self.renderer.domElement.addEventListener(ev, mark, { passive: true });
      });

    LOOP.push(this);
    startLoop();
  }

  /* Ask for one more frame. Anything that changes the scene calls this. */
  Viewport.prototype.invalidate = function () { this.dirty = true; };

  /* Swap the lens without touching the model. The controls drive whichever
     camera is live, so the orbit the engineer already set is kept. */
  Viewport.prototype.setOrtho = function (on) {
    if (!!on === this.isOrtho) return;
    this.isOrtho = !!on;
    var from = on ? this.camera : this.ortho;
    var to = on ? this.ortho : this.camera;
    to.position.copy(from.position);
    to.quaternion.copy(from.quaternion);
    this.controls.camera = to;
    this.controls.updateSphericalFromCamera();
    this.controls.targetSpherical.radius = this.controls.spherical.radius;
    this.controls.targetSpherical.phi = this.controls.spherical.phi;
    this.controls.targetSpherical.theta = this.controls.spherical.theta;
    this.syncOrtho();
    this.dirty = true;
  };
  Viewport.prototype.live = function () { return this.isOrtho ? this.ortho : this.camera; };
  Viewport.prototype.syncOrtho = function () {
    if (!this.isOrtho) return;
    var d = this.ortho.position.distanceTo(this.controls.target);
    var h = Math.max(0.05, d * Math.tan((this.camera.fov * Math.PI / 180) / 2));
    var w = h * this.camera.aspect;
    this.ortho.left = -w; this.ortho.right = w;
    this.ortho.top = h; this.ortho.bottom = -h;
    this.ortho.near = 0.001; this.ortho.far = Math.max(10, d * 60);
    this.ortho.updateProjectionMatrix();
  };

  Viewport.prototype.resize = function () {
    var w = this.mount.clientWidth;
    if (!w) return;
    this.camera.aspect = w / this.h;
    this.camera.updateProjectionMatrix();
    this.syncOrtho();
    this.renderer.setSize(w, this.h);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = this.h + 'px';
    /* Changing aspect alone leaves the camera at whatever DISTANCE fit the
       OLD aspect — harmless for a small width wobble, but DETACH (module
       tab pops open in its own, differently-proportioned layout) can swing
       the aspect enough that labels sitting near the top/bottom of the
       model fall outside the new frustum. refit() re-solves distance for
       the current aspect without touching az/el, so the user's own orbit
       survives a resize instead of snapping back to the module default. */
    this.refit();
    this.dirty = true;
  };

  /* Re-solve camera DISTANCE for the current aspect/model, keeping the
     existing view direction and orbit target — the resize-safe counterpart
     to frame(), which also resets az/el back to the module's default. */
  Viewport.prototype.refit = function () {
    var b = new T.Box3().setFromObject(this.root);
    if (!isFinite(b.min.x) || b.isEmpty()) return;
    var c = b.getCenter(new T.Vector3());
    var s = b.getSize(new T.Vector3());
    var halfW = 0.5 * Math.sqrt(s.x * s.x + s.z * s.z);
    var halfH = 0.5 * s.y;
    var vt = Math.tan((this.camera.fov * Math.PI / 180) / 2);
    var ht = vt * Math.max(0.3, this.camera.aspect);
    var dist = Math.max(halfH / vt, halfW / ht) * 1.08 + Math.max(halfW, halfH) * 0.45 + 0.05;
    var live = this.live();
    var dir = live.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-9) return;
    dir.normalize();
    live.position.copy(c).addScaledVector(dir, dist);
    this.camera.position.copy(live.position);
    this.ortho.position.copy(live.position);
    this.camera.near = Math.max(0.01, dist / 900);
    this.camera.far = dist * 60;
    this.camera.updateProjectionMatrix();
    this.syncOrtho();
    this.controls.target.copy(c);
    this.controls.minDistance = dist * 0.18;
    this.controls.maxDistance = dist * 5.5;
    var cc = this.controls;
    cc.updateSphericalFromCamera();
    cc.targetSpherical.radius = cc.spherical.radius;
    cc.targetSpherical.phi = cc.spherical.phi;
    cc.targetSpherical.theta = cc.spherical.theta;
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
    this.dirty = true;
  };

  /* Ground: a deck the equipment stands on, and a grid at a metre pitch so
     the eye can read scale without a dimension anywhere on the model. */
  Viewport.prototype.laydown = function (span) {
    if (!isFinite(span) || span <= 0) return;
    var step = span > 40 ? 5 : (span > 12 ? 2 : (span > 4 ? 1 : 0.25));
    var n = Math.max(8, Math.ceil(span * 1.6 / step));
    var g = new T.GridHelper(n * step, n, gridColor(), gridColor());
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
     builders never have to know what a good camera distance is.

     This deliberately frames the FULL scene — machine and callouts both.
     An attempt to frame the machine alone and let callouts fall outside
     the shot was tried and measured: it fixed the crowding on a tiny
     pump, and on a normal pump it cropped the tag and the DISCHARGE
     callout out of the picture entirely, because their distance from the
     machine is not proportional to the machine's own size. Excluding them
     from HERE was the wrong place to fix crowding — the real fix is
     wherever a label's position is chosen, so it never has to compete
     with distant geometry for room in the shot. That is where the pump's
     own label placement was corrected instead (see Lh in the pump
     assembly): a floor and a guaranteed gap on the offsets, not a change
     to what the camera is allowed to see. */
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
    var hTerm = halfH / vt, wTerm = halfW / ht;
    /* Margin used to be a flat halfW*0.45 — fine while every model's FIELD
       OF VIEW was always limited by its width (hTerm < wTerm), but a pump
       with a tall discharge riser (driven by the discharge-elevation input)
       can now be limited by its height instead, and a width-only margin
       left its top/bottom labels hard against the frustum edge. Basing the
       margin on whichever TERM actually set dist — not just which raw
       extent is bigger — keeps the old framing when width still governs
       and gives height the same proportional headroom when it takes over. */
    var dist = Math.max(hTerm, wTerm) * (o.zoom || 1.08) + (hTerm > wTerm ? halfH : halfW) * 0.45 + 0.05;
    /* The part-name callouts are sprites drawn with sizeAttenuation OFF, so
       they hold a fixed size in screen pixels no matter how far the camera
       sits — unlike ordinary geometry, they do NOT shrink as dist grows.
       The Box3 above already counts their world position, but a plain
       distance-based margin was tuned for geometry that recedes normally;
       once dist grows a lot (a tall riser pulling the camera back), those
       fixed-pixel labels start eating a bigger share of the frame than the
       geometry-only margin budgeted for. A flat extra 15% of dist keeps
       them clear of the edge at any zoom level instead of only the zoom
       level this was first tuned at. */
    dist *= 1.15;
    var az = o.az == null ? 0.72 : o.az, el = o.el == null ? 1.07 : o.el;
    this.controls.target.set(c.x, c.y, c.z);
    var live = this.live();
    live.position.set(
      c.x + dist * Math.sin(el) * Math.sin(az),
      c.y + dist * Math.cos(el),
      c.z + dist * Math.sin(el) * Math.cos(az));
    this.camera.position.copy(live.position);
    this.ortho.position.copy(live.position);
    this.camera.near = Math.max(0.01, dist / 900);
    this.camera.far = dist * 60;
    this.camera.updateProjectionMatrix();
    this.syncOrtho();
    this.controls.minDistance = dist * 0.18;
    this.controls.maxDistance = dist * 5.5;
    var cc = this.controls;
    cc.updateSphericalFromCamera();
    cc.targetSpherical.radius = cc.spherical.radius;
    cc.targetSpherical.phi = cc.spherical.phi;
    cc.targetSpherical.theta = cc.spherical.theta;
    this.span = Math.max(s.x, s.z);
    this.homeSpan = this.span;
    this.dirty = true;
  };

  /* Visibility is answered from the shared IntersectionObserver gate, which
     costs nothing to ask. The old test read getBoundingClientRect() for every
     viewport on every frame: ten forced layout flushes per frame, and the
     page shuddered whenever anything else had touched the DOM. */
  Viewport.prototype.visible = function () {
    var el = this.renderer.domElement;
    if (window.AROVIS && window.AROVIS.supported) return window.AROVIS.visible(el);
    if (!el.offsetParent) return false;
    var r = el.getBoundingClientRect();
    return r.bottom > -120 && r.top < (window.innerHeight || 800) + 120 && r.width > 8;
  };

  function startLoop() {
    if (looping) return;
    looping = true;
    (function tick() {
      window.requestAnimationFrame(tick);
      var now = performance.now();
      for (var i = 0; i < LOOP.length; i++) {
        var v = LOOP[i];
        try {
          if (!v.visible()) continue;

          /* The camera is solved every frame — it is trigonometry, not a
             draw, and it costs nothing. Solving it here is what lets the
             draw be skipped: if the camera has not moved and nothing has
             marked the scene, there is no new image to produce. */
          v.controls.update();
          var cp = v.controls.camera.position;   /* whichever lens the controls drive */
          if (Math.abs(cp.x - v.camX) > 1e-4 || Math.abs(cp.y - v.camY) > 1e-4
            || Math.abs(cp.z - v.camZ) > 1e-4) {
            v.dirty = true;
            v.camX = cp.x; v.camY = cp.y; v.camZ = cp.z;
          }

          /* A moving flow stream is new every frame; a still model is not. */
          if (v.flowTick) v.dirty = true;

          /* A long, staggered floor is the safety net: a scene changed by a
             path that forgot to invalidate still comes right on its own,
             within a few seconds. It is deliberately long and offset per
             viewport — a one-second floor made every idle panel redraw on
             the same beat, which is a hitch once a second and is exactly
             what a still model has to avoid. */
          if (!v.dirty && (now - v.lastDraw) < (15000 + i * 1100)) continue;

          v.dirty = false;
          v.lastDraw = now;
          if (v.flowTick) v.flowTick(now / 1000);
          v.syncOrtho();
          v.renderer.render(v.scene, v.live());
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
  /* SIMPLE / INDUSTRIAL / ENGINEERING map onto the part library's detail
     levels; a simple view costs a fraction of an inspected one */
  var LODOF = { simple: 0, industrial: 1, engineering: 2 };
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

  /* NPS is written two different ways by the modules that feed this file.
     Line sizing, STHE and DPHE nozzle lookups hand over a bare number —
     2, 0.5, "0.75" — and every label here appends the inch mark itself.
     The pump's nozzle table (STANDARD_NOZZLES in app.js) instead stores the
     mark IN the value — '1/2"', '3/4"' — because that is how a pump datum
     picks its row. Code written for the first shape and reused for the
     second wrote both: '1/2"' + '″' printed as 1/2"″ on every pump label,
     the BOM, and the piping isometric. This strips a mark already present
     before adding the one the caller is about to add, so either shape
     comes out the same: NPS 1/2″. */
  function npsNum(v) {
    if (v == null) return v;
    return String(v).replace(/[″"'']+\s*$/, '');
  }
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
    height: 480, az: -0.95, el: 1.24, iso: true,
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
        npsha: r.npsha, npshr: i.npshr, fluid: i.fluidVal || txt('fluid-select'),
        /* discharge elevation, as entered on the pump-discharge-el input —
           the discharge riser reads this so the spool actually grows or
           shrinks with the duty instead of always drawing the same
           fixed-height stub regardless of what the user typed */
        dz: isFinite(i.zDisch) ? i.zDisch : null
      };
    },
    /* ── PUMP UNIT AS AN ASSEMBLY ─────────────────────────────────────
       The pump itself is a module-specific shell — volute, bearing frame,
       coupling guard, motor — but everything bolted to it comes from the
       component library at the nozzle sizes the calculation selected, so the
       suction and discharge spools are the real thing and the take-off
       counts what is actually on the skid. */
    assembly: function (d, lod) {
      var A = window.AROPARTS;
      var motorD = Math.max(0.22, Math.pow(d.kw, 0.34) * 0.15);
      var motorL = motorD * 1.9;
      var casR = Math.max(d.sucOd, d.disOd) * 1.55;
      var baseL = motorL + casR * 3.4 + 0.35;
      var baseW = Math.max(motorD * 1.9, casR * 2.4);
      /* skidTopY is the top face of the steel skid plate built below
         (box height 0.075 centred at y=0.195, so its top sits at 0.2325)
         — cl (the shaft centreline) has to clear that plate by a real
         margin or the pedestal block bridging plate-to-shaft (below) is
         asked to span a negative or near-zero height. casR + 0.10 alone
         does that on any small-bore duty (a 1/2" pump's casR is a few
         centimetres), which is what left the pedestal floating short of
         the casing instead of actually connecting to it. */
      var skidTopY = 0.2325;
      var cl = Math.max(casR + 0.10, skidTopY + 0.06);   /* shaft centreline above the plate */
      var px = -baseL / 2 + casR + 0.16;          /* volute centre */

      /* The tag callouts and nozzle labels are sprites drawn with
         sizeAttenuation OFF, so their apparent size does not shrink with
         camera distance — a fixed world-space height instead means a SMALL
         pump, framed close because it IS small, shows that fixed text at a
         proportionally huge size. Measured on a 1/2" discharge pump: the
         P-101-A tag sat directly on top of the DISCHARGE NPS callout, both
         merged into unreadable overlapping text, because both offsets were
         multiples of the nozzle OD — 21 mm — while the sprites themselves
         are tens of millimetres tall regardless.

         Lh ties the label height to the pump's own casing radius instead,
         floored and capped so a tiny pump gets small legible text and a
         large one does not grow oversized labels. The vertical gaps below
         are written in multiples of Lh rather than of the nozzle bore, so
         two labels are guaranteed the room their own rendered height needs
         — the guarantee a bore-sized offset could not give once the bore
         itself got small. */
      var Lh = Math.max(0.015, Math.min(0.032, casR * 0.34));

      var asm = A.Assembly({ lod: lod, x: 0, y: 0, z: 0 });
      var R = asm.root;

      /* ── skid and foundation, declared as arrangement steel ─────────── */
      var skid = grp();
      skid.add(at(box(baseL + 0.5, 0.16, baseW + 0.45, M.concrete()), 0, 0.08, 0));
      skid.add(at(box(baseL, 0.075, baseW, M.steelDk()), 0, 0.195, 0));
      for (var e = -1; e <= 1; e += 2) {
        skid.add(at(box(0.05, 0.10, baseW, M.steelDk()), e * (baseL / 2 - 0.03), 0.28, 0));
      }
      asm.custom(skid, { label: 'BASEPLATE AND GROUTED FOUNDATION', qty: 1, unit: 'off',
        material: 'CS / CONCRETE', bom: true,
        detail: 'ARRANGEMENT ITEM — NOT SIZED BY THIS CALCULATION' }, { od: baseW });

      /* ── the pump end ───────────────────────────────────────────────── */
      var pump = grp();
      pump.add(at(alongX(cyl(casR, casR, casR * 0.95, M.machine(), 34)), px, cl, 0));
      pump.add(at(alongX(cyl(casR * 1.06, casR * 1.06, casR * 0.16, M.machineDk(), 34)),
        px - casR * 0.48, cl, 0));
      pump.add(at(box(casR * 1.5, Math.max(0.03, cl - skidTopY), casR * 1.1, M.machineDk()),
        px + casR * 0.2, (cl + skidTopY) / 2 - 0.02, 0));
      var bfL = casR * 1.3;
      pump.add(at(alongX(cyl(casR * 0.5, casR * 0.62, bfL, M.machineDk(), 20)),
        px + casR * 0.6 + bfL / 2, cl, 0));
      asm.custom(pump, { label: 'CENTRIFUGAL PUMP, END SUCTION',
        size: (d.sucNps ? npsNum(d.sucNps) + '″ × ' : '') + (d.disNps ? npsNum(d.disNps) + '″' : ''),
        qty: 1, unit: 'off', material: 'CI CASING / SS IMPELLER', tag: d.tag, bom: true,
        detail: f(d.Q, 1) + ' m³/h at ' + f(d.H, 1) + ' m differential head' }, { od: casR * 2 });

      /* ── coupling guard, motor ──────────────────────────────────────── */
      var gx = px + casR * 0.6 + bfL + 0.10;
      var guard = grp();
      guard.add(at(alongX(cyl(casR * 0.62, casR * 0.62, 0.16,
        mat(C.guard, { m: 0.4, r: 0.55, op: 0.5, side: true }), 18)), gx, cl, 0));
      guard.add(at(alongX(cyl(casR * 0.12, casR * 0.12, 0.22, M.steelDk(), 12)), gx, cl, 0));
      asm.custom(guard, { label: 'COUPLING WITH GUARD', qty: 1, unit: 'off', material: 'CS',
        bom: true, detail: 'ARRANGEMENT ITEM — NOT SIZED BY THIS CALCULATION' }, { od: casR });

      var mx = gx + 0.10 + motorL / 2;
      var motor = grp();
      motor.add(at(alongX(cyl(motorD / 2, motorD / 2, motorL, M.motor(), 30)), mx, cl, 0));
      for (var i2 = 0; i2 < 9; i2++) {
        motor.add(at(alongX(cyl(motorD / 2 + motorD * 0.05, motorD / 2 + motorD * 0.05,
          motorL / 70, M.motor(), 30)), mx - motorL * 0.36 + motorL * 0.72 * (i2 / 8), cl, 0));
      }
      motor.add(at(alongX(cyl(motorD * 0.36, motorD * 0.36, motorD * 0.28, M.machineDk(), 20)),
        mx + motorL / 2 + motorD * 0.12, cl, 0));
      motor.add(at(box(motorD * 0.5, motorD * 0.34, motorD * 0.42, M.machineDk()),
        mx, cl + motorD / 2 + motorD * 0.14, 0));
      motor.add(at(box(motorD * 1.3, Math.max(0.03, cl - skidTopY), motorD * 1.5, M.motor()),
        mx, (cl + skidTopY) / 2 - 0.02, 0));
      asm.custom(motor, { label: 'ELECTRIC MOTOR', size: f(d.kw, 2) + ' kW',
        qty: 1, unit: 'off', material: 'TEFC, IEC FRAME', bom: true,
        detail: isFinite(d.rpm) ? f(d.rpm, 0) + ' rpm' : '' }, { od: motorD });

      /* ── suction spool, from the library, at the selected nozzle size ─ */
      asm.cursor.set(px - casR * 0.55, cl, 0);
      asm.dir.set(-1, 0, 0);
      var sm = { od: d.sucOd, nps: d.sucNps, lod: lod, material: 'CS' };
      asm.add(A.flange(sm));
      asm.add(A.flangedJoint(sm));
      asm.add(A.valve(Object.assign({ kind: 'gate', tag: 'XV-S' }, sm)));
      asm.add(A.flangedJoint(sm));
      asm.add(A.pipe(Object.assign({ len: casR * 2.2 }, sm)));
      asm.attach(A.gauge({ od: d.sucOd, lod: lod, tag: 'PI-S' }), { at: casR * 0.5 });
      asm.add(A.flange(sm));
      var sucEnd = asm.cursor.clone();
      R.add(at(label('SUCTION' + (d.sucNps ? '  NPS ' + npsNum(d.sucNps) + '″' : ''), { h: Lh }),
        sucEnd.x, cl - Math.max(d.sucOd * 2.6, Lh * 1.6) - 0.05, 0));

      /* ── discharge spool: riser off the volute, elbow, run to the limit ─
         disH is the riser height, drawn schematically (like casR/motorD
         above) rather than to literal 1:1 scale — a flat metres-to-units
         multiplier would either dwarf the pump at a realistic tank height
         or barely move at all across the input's normal range. 10 m is the
         module's own default discharge elevation (pump-discharge-el), so
         that duty keeps today's proportions; any other value scales the
         riser up or down from there, clamped so the model never collapses
         or runs off-frame. */
      /* d.dz <= 0 used to skip scaling entirely and just draw the 10 m
         default — the one input value that should read as "no elevation
         given" instead looked identical to the 10 m reference duty. Using
         max(d.dz, 0.5) keeps the same curve running through zero and
         unset alike, matching the analytical riser's own floor. */
      var dzScale2 = Math.max(0.6, Math.min(4.5, Math.pow(Math.max(isFinite(d.dz) ? d.dz : 10, 0.5) / 10, 0.4)));
      var disH = casR * 1.9 * dzScale2;
      var dm = { od: d.disOd, nps: d.disNps, lod: lod, material: 'CS' };
      asm.cursor.set(px, cl + casR, 0);
      asm.dir.set(0, 1, 0);
      asm.add(A.pipe(Object.assign({ len: disH }, dm)));
      asm.bend(A.elbow(Object.assign({ angle: 90 }, dm)), { axis: 'z', dir: -1 });
      asm.add(A.pipe(Object.assign({ len: casR * 0.9 }, dm)));
      asm.add(A.flangedJoint(dm));
      asm.add(A.valve(Object.assign({ kind: 'check', tag: 'NRV-D' }, dm)));
      asm.add(A.flangedJoint(dm));
      asm.add(A.pipe(Object.assign({ len: casR * 1.1 }, dm)));
      asm.attach(A.gauge({ od: d.disOd, lod: lod, tag: 'PI-D' }), { at: casR * 0.5 });
      asm.add(A.flange(dm));
      var disEnd = asm.cursor.clone();
      /* A full label-height clear of the pipe, not a fraction of its own
         bore — the bore is what got small enough to cause the overlap. */
      var disLabelY = disEnd.y + Math.max(d.disOd * 2.6, Lh * 1.4);
      R.add(at(label('DISCHARGE' + (d.disNps ? '  NPS ' + npsNum(d.disNps) + '″' : ''), { h: Lh }),
        disEnd.x, disLabelY, 0));

      R.add(at(label(f(d.kw, 1) + ' kW MOTOR', { h: Lh }),
        mx, cl + Math.max(motorD * 1.15, Lh * 1.8), 0));
      /* Anchored off the MOTOR label's height, not the DISCHARGE one — it
         used to sit a fixed 2.6 label-heights above disLabelY, which was
         fine while disH was a constant, but disH now grows with discharge
         elevation, so a discharge-relative anchor dragged the tag up right
         alongside it. In this near-overhead ISO view a Y difference that
         small reads mostly as depth, not screen height, so the two ended up
         converging on the same on-screen row and overlapping the taller the
         riser got, worst at wide-panel zoom-outs where the fixed-pixel
         label sprites eat a bigger share of the shrinking apparent gap. A
         motor-relative anchor keeps the tag's height independent of how
         tall the discharge run is, so it cannot be dragged back into
         collision by a duty with a high discharge elevation. */
      R.add(at(tagLabel(d.tag), px - casR * 1.1,
        cl + Math.max(motorD * 1.15, Lh * 1.8) + Lh * 2.6, 0));
      var fa = flowArrow(casR * 1.5, C.cold, '');
      fa.position.set(px - casR * 2.6, cl - casR * 1.35, 0);
      R.add(fa);
      return asm;
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
    note: 'Baseplate, foundation and coupling guard are arrangement steel shown for context — '
      + 'they are not sized by this calculation. The suction and discharge spools are drawn at '
      + 'the nozzle sizes the calculation selected; the valves and gauges on them are typical '
      + 'pump-station practice, not a selection this module made.'
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
      height: 480, az: 0.55, el: 1.28, iso: true,
      title: nice + ' LINE — PIPING SPOOL',
      data: function () {
        var r = vals(mod);
        /* two-phase reports a MIXTURE velocity, and calls it that — the field
           name differs because the quantity does */
        var V = r ? (isFinite(r.V) ? r.V : r.Vmix) : NaN;
        var ok = !!(r && isFinite(V));
        if (!ok) return { ok: false, od: 0.1143, id: 0.1023, L: 6, dz: 0, fits: [] };
        return {
          ok: true, r: r,
          od: r.odIn ? r.odIn * 0.0254 : (r.Dmm * 1.12) / 1000,
          id: (r.Dmm || 100) / 1000,
          L: pick(r.L, 6), dz: isFinite(r.dz) ? r.dz : 0,
          nps: r.nps, sch: r.sch, V: V, dP: r.dpTotal,
          p1: r.pUp, p2: r.pDown, svc: r.svc, matName: r.matName,
          Re: r.Re, vAllow: r.Vallow,
          fits: (r.fitList || []).filter(function (x) { return x && (x.qty || 0) > 0; })
        };
      },
      /* ── PARAMETRIC PIPE ROUTE ────────────────────────────────────────
         Built from parts, port to port. The elbows in the design decide the
         route: none is a straight run, two make a rise, four make an offset.
         Straight pipe totals the calculated run length — fittings sit on top
         of it, exactly as the hydraulics treat them. */
      assembly: function (d, lod) {
        var A = window.AROPARTS;
        var od = d.od, nps = d.nps, L = Math.max(0.6, Math.min(d.L, 60));
        var dz = Math.max(-L * 0.75, Math.min(d.dz || 0, L * 0.75));
        var mk = { od: od, nps: nps, sch: d.sch, lod: lod, material: d.matName || 'CS' };

        /* split the design's fittings into things that turn the run and
           things that sit in it */
        var bends = [], inline = [];
        (d.fits || []).forEach(function (ft) {
          var nm = String(ft.name || '').toLowerCase();
          var q = Math.max(1, Math.round(ft.qty || 1));
          for (var i = 0; i < q && bends.length + inline.length < 10; i++) {
            if (/elbow|bend/.test(nm)) bends.push(ft); else inline.push(ft);
          }
        });
        var nSeg = bends.length + 1;

        /* With alternating turns the odd segments are the vertical ones, so
           the vertical legs must total the design elevation change — not a
           share of the run length. Getting that wrong sent the outlet metres
           above the inlet on a line that rises 1.2 m. */
        var nVert = 0;
        for (var q = 1; q < nSeg; q += 2) nVert++;
        var vTot = nVert ? Math.min(Math.abs(dz), L * 0.8) : 0;
        var hTot = Math.max(L * 0.2, L - vTot);

        /* A 44 m run of 4-inch pipe is 385 diameters long: at any framing that
           fills the panel the pipe is thinner than a pixel. The run is drawn
           compressed — declared in the footer — while the bore, the fittings
           and the bill of material all stay at the calculated values. */
        var cap = Math.max(8, 60 * od);
        var squash = hTot > cap ? cap / hTot : 1;
        var hSeg = (hTot * squash) / Math.max(1, nSeg - nVert);
        var vSeg = nVert ? (vTot * squash) / nVert : 0;
        var drawnL = hTot * squash + vTot * squash;

        var y0 = Math.max(od * 3.2, 0.85) + Math.max(0, -dz * squash);
        var asm = A.Assembly({ lod: lod, x: -drawnL / 2, y: y0, z: 0 });
        asm.squash = squash;
        asm.trueLength = L;

        function label(txt, pos, kind) {
          if (lod < 1) return;
          var sp = kind === 'tag' ? tagLabel(txt) : label3(txt, kind);
          sp.position.copy(pos);
          asm.root.add(sp);
        }
        function here() { return asm.cursor.clone(); }

        /* upstream terminal: flange, and the point where P1 is read */
        asm.add(A.flange(mk));
        var p1 = here();
        asm.attach(A.gauge({ od: od, lod: lod, tag: 'PI-01' }), { at: 0 });
        label('P1', p1.clone().add(new T.Vector3(-od * 2.2, od * 1.2, 0)), 'node');

        var inlineAt = 0;
        for (var sgi = 0; sgi < nSeg; sgi++) {
          /* share the inline components out along the run */
          /* valves and in-line fittings belong on the level runs where they can
             be reached, not stacked on a riser between two elbows */
          var horiz = [];
          for (var hz = 0; hz < nSeg; hz++) if (hz % 2 === 0) horiz.push(hz);
          var myTurn = horiz.indexOf(sgi);
          var take = myTurn < 0 ? 0
            : Math.round(((myTurn + 1) / horiz.length) * inline.length) - inlineAt;
          var pieces = take + 1;
          var segLen = (sgi % 2 === 1) ? vSeg : hSeg;
          var trueSeg = (sgi % 2 === 1)
            ? (nVert ? vTot / nVert : 0)
            : (hTot / Math.max(1, nSeg - nVert));
          for (var k = 0; k < pieces; k++) {
            var runL = segLen / pieces;
            /* the model draws `runL`; the take-off counts the calculated length */
            asm.add(A.pipe(Object.assign({ len: Math.max(0.02, runL),
              bomLen: trueSeg / pieces }, mk)));
            /* supports at a spacing along each level run, not one per spool —
               a 44 m line carrying a single support is not an arrangement */
            if (Math.abs(asm.dir.y) < 0.3) {
              var nSup = Math.max(1, Math.min(8, Math.round(runL / 4)));
              var midY = asm.cursor.y;
              for (var si = 0; si < nSup; si++) {
                asm.attach(A.support({ od: od, nps: nps, lod: lod,
                  height: Math.max(0.05, midY - od * 0.72) }),
                  { at: runL * (si + 0.5) / nSup });
              }
            }
            if (k < take) {
              var ft = inline[inlineAt++];
              var nm = String(ft.name || '').toLowerCase();
              if (/valve/.test(nm)) {
                var kind = /check/.test(nm) ? 'check' : /globe/.test(nm) ? 'globe'
                         : /ball/.test(nm) ? 'ball' : /butterfly/.test(nm) ? 'butterfly'
                         : /control/.test(nm) ? 'control' : 'gate';
                asm.add(A.flangedJoint(mk));
                var v = asm.add(A.valve(Object.assign({ kind: kind, tag: 'XV-' + (inlineAt + 100) }, mk)));
                asm.add(A.flangedJoint(mk));
                label(String(ft.name || 'VALVE').toUpperCase(),
                  here().add(new T.Vector3(-od * 0.8, od * 3.4, 0)), 'part');
              } else if (/tee/.test(nm)) {
                asm.add(A.tee(Object.assign({ branchOd: od }, mk)));
                label('TEE', here().add(new T.Vector3(0, od * 2.2, 0)), 'part');
              } else if (/reduc|enlarg/.test(nm)) {
                asm.add(A.reducer(Object.assign({ od2: od * 0.75 }, mk)));
                label('REDUCER', here().add(new T.Vector3(0, od * 2.0, 0)), 'part');
              } else {
                asm.add(A.flangedJoint(mk));
                label(String(ft.name || 'FITTING').toUpperCase(),
                  here().add(new T.Vector3(0, od * 2.4, 0)), 'part');
              }
            }
          }
          if (sgi < bends.length) {
            /* alternate the turn so two elbows make a rise and four an offset */
            var up = (dz >= 0 ? 1 : -1) * (sgi % 2 === 0 ? 1 : -1);
            asm.bend(A.elbow(Object.assign({ angle: 90 }, mk)), { axis: 'z', dir: up });
          }
        }

        asm.add(A.flange(mk));
        var p2 = here();
        asm.attach(A.gauge({ od: od, lod: lod, tag: 'PI-02' }), { at: 0 });
        label('P2', p2.clone().add(new T.Vector3(od * 2.2, od * 1.2, 0)), 'node');

        if (lod >= 1 && d.ok) {
          var mid = p1.clone().add(p2).multiplyScalar(0.5);
          label('NPS ' + d.nps + '\u2033 SCH ' + d.sch, mid.clone().add(new T.Vector3(0, od * 7, 0)), 'tag');
        }
        if (d.ok) {
          /* the arrow is an annotation on the drawn model, so it is sized from
             the drawn run — scaling it off the calculated length put a 7 m
             cone across an 8 m spool */
          var fa = flowArrow(Math.min(Math.max(od * 5, drawnL * 0.10), drawnL * 0.16),
            tint, 'FLOW  ' + f(d.V, 2) + ' m/s');
          fa.position.copy(p1.clone().lerp(p2, 0.28).add(new T.Vector3(0, -od * 4.5, 0)));
          asm.root.add(fa);
        }
        if (d.ok && !(d.fits || []).length && lod >= 1) {
          label('NO FITTINGS IN THE DESIGN \u2014 STRAIGHT RUN',
            p1.clone().lerp(p2, 0.5).add(new T.Vector3(0, -od * 5.5, 0)), 'part');
        }
        return asm;
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
      /* ── the fields, from the module's own hydraulics ───────────────────
         Velocity is V = Q/A, which for a constant bore is constant — the
         model says so rather than inventing a distribution. Pressure falls
         from the calculated P1 to the calculated P2 along the route. */
      field: function (d) {
        if (!d || !d.ok) return null;
        var r = d.r || {};
        var p1 = d.p1, p2 = d.p2;
        if (!isFinite(p1) || !isFinite(p2)) return null;
        return {
          velocity: {
            label: 'VELOCITY', unit: 'm/s', dp: 2,
            lo: 0, hi: Math.max(d.V * 1.15, isFinite(r.Vallow) ? r.Vallow : d.V * 1.15),
            at: function () { return d.V; },
            note: 'Constant bore, so V = Q/A is uniform along the run. '
                + (isFinite(r.Vallow) ? 'Scale ends at the API RP 14E erosional velocity, '
                    + f(r.Vallow, 2) + ' m/s.' : '')
          },
          pressure: {
            label: 'PRESSURE', unit: 'bar', dp: 3, invert: true,
            lo: Math.min(p1, p2), hi: Math.max(p1, p2),
            at: function (t) { return p1 + (p2 - p1) * t; },
            note: 'P1 ' + f(p1, 3) + ' \u2192 P2 ' + f(p2, 3) + ' bar, \u0394P '
                + f(d.dP, 5) + ' bar distributed along the route.'
          }
        };
      },
      note: 'Pipe supports and their spacing are shown for context — support design is not part of '
        + 'this calculation. Long runs are drawn compressed so the bore stays legible; the bore, the '
        + 'fittings and the bill of material are all at the calculated values.'
    });
  });

  /* ── DOUBLE PIPE EXCHANGER ──────────────────────────────────────────────
     The hairpin stack the calculation arrived at: n hairpins, each two legs
     of the calculated length, return bends, annulus nozzles, support frame. */
  register('dphe', {
    height: 480, az: 0.75, el: 1.24,
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
    assembly: function (d, lod) {
      var A = window.AROPARTS;
      var asm = A.Assembly({ lod: lod });
      var g = grp();
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
        /* ── Hairpin return bend ──────────────────────────────────────────
           A hairpin is two legs joined at one end by a return bend, and the
           join is a bolted flanged joint: flange, gasket, bolting. That is
           what a fabricator builds and what the reference photograph shows.

           This used to be a half torus carrying two rotations at once, which
           lifted it out of the plane of the legs, positioned a fraction of a
           pipe diameter clear of the leg ends so that nothing met. The result
           was a U floating beside the exchanger rather than coupling it.

           A half torus already lies in the XY plane and sweeps +X to −X
           bulging towards +Y. One rotation about Z, and nothing else, turns
           that into a U whose two ends point along −X and whose bulge faces
           +X. Centre it on the mid-height between the legs and its ends land
           exactly on the two leg centrelines, which is the whole point. */
        var rbR = pitchY / 2;                                 /* half the leg pitch  */
        var ftk = Math.max(0.006, shellOd * 0.16);            /* as flange() builds it */
        var stubL = Math.max(0.045, shellOd * 0.75);          /* nipple past the flange */
        var jointX = L / 2 + ftk * 1.6;                       /* bolted face          */
        var bendX = jointX + stubL;                           /* torus centre         */

        var rb = new T.Mesh(new T.TorusGeometry(rbR, innerOd / 2, 16, 34, Math.PI), M.bundle());
        rb.rotation.z = -Math.PI / 2;
        g.add(at(rb, bendX, yb + rbR, 0));

        /* Each end of the bend runs back to its own bolted joint: a nipple,
           a gasket between two flange faces, and the flange's own bolting. */
        [0, 1].forEach(function (leg) {
          var yl = yb + leg * pitchY;
          /* one nipple, from the end of the leg out to where the bend begins */
          var nipL = bendX - L / 2;
          g.add(at(alongX(cyl(innerOd / 2, innerOd / 2, nipL, M.bundle(), 20)),
            L / 2 + nipL / 2, yl, 0));
          g.add(at(flange(innerOd, M.steelDk()), jointX - ftk * 0.9, yl, 0));
          g.add(at(flange(innerOd, M.steelDk()), jointX + ftk * 0.9, yl, 0));
          g.add(at(alongX(cyl(innerOd * 0.92, innerOd * 0.92, ftk * 0.42, M.gasket(), 26)),
            jointX, yl, 0));
        });

        /* The annulus is closed at this end — its fluid enters and leaves
           through the side nozzles below, not around the bend — so the outer
           pipe gets a bolted cover rather than a second bend. Drawing an
           outer U here, as before, described a flow path this exchanger
           does not have. */
        [0, 1].forEach(function (leg) {
          var yl = yb + leg * pitchY;
          g.add(at(alongX(cyl(shellOd * 0.58, shellOd * 0.58, ftk * 0.9, M.machine(), 30)),
            L / 2 + ftk * 0.75, yl, 0));
        });

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

      /* Representative streamlines through the first hairpin: tube-side
         (inner pipe) travels leg 0 out to the return bend and back through
         leg 1; annulus-side (outer pipe) is drawn separately per leg since
         the annulus is closed off at the bend end (see the note above) and
         only exchanges fluid through its own side nozzle. bendX/rbR are the
         last values the loop above computed — they don't vary with hp. */
      asm.multiRoute = [
        { pts: [new T.Vector3(-L / 2, y0, 0), new T.Vector3(bendX, y0, 0),
                new T.Vector3(bendX + rbR, y0 + rbR, 0),
                new T.Vector3(bendX, y0 + pitchY, 0), new T.Vector3(-L / 2, y0 + pitchY, 0)],
          color: 0xff5a36, bore: innerOd * 0.85, vRef: d.velTube },
        { pts: [new T.Vector3(-L / 2, y0, 0), new T.Vector3(L / 2, y0, 0)],
          color: 0x2ea6ff, bore: shellOd * 0.45, vRef: d.velAnn },
        { pts: [new T.Vector3(-L / 2, y0 + pitchY, 0), new T.Vector3(L / 2, y0 + pitchY, 0)],
          color: 0x2ea6ff, bore: shellOd * 0.45, vRef: d.velAnn }
      ];

      g.add(at(tagLabel(d.nHp + ' × HAIRPIN  ·  ' + f(L, 2) + ' m LEG'), 0, top + shellOd * 2.6, 0));
      /* the two services are one pipe diameter apart on the model; put their
         callouts at opposite ends so the text does not sit on top of itself */
      g.add(at(hotLabel('TUBE  ' + (d.fluidTube || 'TUBE SIDE')),
        -L / 2 - Math.max(shellOd * 3, L * 0.10), y0 - shellOd * 1.6, 0));
      g.add(at(coldLabel('ANNULUS  ' + (d.fluidAnn || 'SHELL SIDE')),
        -L / 2 - Math.max(shellOd * 3, L * 0.10), top - shellOd * 1.2, 0));
      asm.custom(g, {
        label: 'DOUBLE PIPE HEAT EXCHANGER', size: d.ok ? d.nHp + ' × HAIRPIN' : null,
        qty: 1, unit: 'off', material: 'CS', bom: true,
        detail: d.ok ? f(d.L, 2) + ' m leg · ' + (d.stdOuter || '') + ' / ' + (d.stdInner || '') : ''
      }, { od: d.D2 });
      if (d.ok) {
        asm.item({ label: 'HAIRPIN ASSEMBLY', size: f(d.L, 2) + ' m leg',
          qty: d.nHp, unit: 'off', material: 'CS', bom: true });
        asm.item({ label: 'INNER TUBE', size: f(d.Do * 1000, 1) + ' mm OD',
          qty: d.nHp * 2 * d.L, unit: 'm', material: 'CS', bom: true });
        asm.item({ label: 'OUTER PIPE', size: f(d.D2 * 1000, 1) + ' mm ID',
          qty: d.nHp * 2 * d.L, unit: 'm', material: 'CS', bom: true });
        asm.item({ label: 'RETURN BEND', qty: d.nHp, unit: 'off', material: 'CS', bom: true });
        asm.item({ label: 'ANNULUS NOZZLE', qty: d.nHp * 2, unit: 'off', material: 'CS', bom: true });
      }
      asm.item({ label: 'SUPPORT FRAME', qty: 1, unit: 'off', material: 'CS', bom: true,
        detail: 'ARRANGEMENT ITEM — NOT SIZED BY THIS CALCULATION' });
      return asm;
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
    height: 480, az: 0.68, el: 1.24,
    title: 'SHELL & TUBE HEAT EXCHANGER — TEMA ARRANGEMENT',
    data: function () {
      var s = window.state && window.state.sthe;
      var ok = !!(s && s.calculated && s.results);
      var r = ok ? s.results : {}, i = ok ? (s.inputs || {}) : {};
      var Ds = pick(r.Ds_used_mm, raw('sthe-shell-id')) / 1000;
      /* The tube length field is declared data-unit-type="length-mm", so it
         reads in millimetres — which is exactly what the calculation reads
         from it. This used to guess the unit from the magnitude: over forty
         meant millimetres, under forty meant metres. That agreed with the
         engine for the 7315 mm default and disagreed with it by a factor of
         a thousand for a short tube, so the model and the schedule could
         describe a different exchanger from the one that was calculated.
         Two views of one number must not each decide what its unit is. */
      var Lmm = pick(num('sthe-tube-L'), 7315);
      var L = Lmm / 1000;
      var tubeOd = pick(num('sthe-tube-od'), 19.05) / 1000;   /* the OD select carries mm */
      return {
        ok: ok,
        Ds: isFinite(Ds) && Ds > 0 ? Ds : 0.387,
        /* Drawn length is clamped so a very short or very long bundle is
           still legible; Ltrue is what the take-off reports, so the schedule
           never inherits the compression the drawing needed. */
        L: Math.max(0.5, Math.min(L, 12)),
        Ltrue: L,
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
    assembly: function (d, lod) {
      var A = window.AROPARTS;
      var asm = A.Assembly({ lod: lod });
      var g = grp();
      /* a head 0.75 D long is longer than the shell on a large-diameter
         exchanger; hold it to a fraction of the unit as well */
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

      /* Representative streamlines: tube side is a two-pass path — in one
         channel nozzle, the length of the bundle, round the bonnet, back
         through the bundle to the other channel nozzle (matches the two
         nozzles this module draws on the one channel head, Np-pass style).
         Shell side is straight across, nozzle to nozzle over the top. */
      var tubeBore = Math.min(d.tubeOd * 4, Ds * 0.16);
      asm.multiRoute = [
        { pts: [new T.Vector3(-L / 2 - headL * 0.55, y + Ds * 0.26, Ds / 2),
                new T.Vector3(-L / 2, y + Ds * 0.15, 0),
                new T.Vector3(L / 2, y + Ds * 0.15, 0),
                new T.Vector3(L / 2 + Ds * 0.15, y, 0),
                new T.Vector3(-L / 2, y - Ds * 0.15, 0),
                new T.Vector3(-L / 2 - headL * 0.55, y - Ds * 0.26, Ds / 2)],
          color: 0xff8a3d, bore: tubeBore },
        { pts: [new T.Vector3(-L * 0.36, y + Ds / 2, 0), new T.Vector3(-L * 0.36, y, 0),
                new T.Vector3(L * 0.36, y, 0), new T.Vector3(L * 0.36, y + Ds / 2, 0)],
          color: 0x2ea6ff, bore: odS * 0.9 }
      ];

      g.add(at(tagLabel((d.tema ? 'TEMA ' + d.tema + '  ·  ' : '')
        + (isFinite(d.Nt) && d.Nt ? d.Nt + ' TUBES × ' + d.Np + ' PASS' : 'SHELL & TUBE')),
        0, y + Ds * 1.25, 0));
      asm.custom(g, {
        label: 'SHELL & TUBE HEAT EXCHANGER', size: d.tema ? 'TEMA ' + d.tema : null,
        qty: 1, unit: 'off', material: 'CS SHELL / SS TUBES', bom: true,
        detail: (d.ok && isFinite(d.Ds) ? f(d.Ds * 1000, 0) + ' mm shell ID' : '')
              + (d.ok && d.Nt ? ' · ' + d.Nt + ' tubes × ' + d.Np + ' pass' : '')
      }, { od: d.Ds });
      if (d.ok) {
        if (d.Nt) {
          asm.item({ label: 'TUBE, PLAIN',
            size: f(d.tubeOd * 1000, 2) + ' mm OD × ' + f(isFinite(d.Ltrue) ? d.Ltrue : d.L, 3) + ' m',
            qty: d.Nt, unit: 'off', material: 'SS 316 / ADMIRALTY', bom: true });
        }
        asm.item({ label: 'TUBESHEET', qty: 2, unit: 'off', material: 'CS CLAD', bom: true });
        if (d.nozS) asm.item({ label: 'NOZZLE — SHELL SIDE', size: 'NPS ' + d.nozS + '″',
          rating: 'CL 150 RF', qty: 2, unit: 'off', material: 'CS', bom: true, detail: 'IN / OUT' });
        if (d.nozT) asm.item({ label: 'NOZZLE — TUBE SIDE', size: 'NPS ' + d.nozT + '″',
          rating: 'CL 150 RF', qty: 2, unit: 'off', material: 'CS', bom: true, detail: 'IN / OUT' });
      }
      asm.item({ label: 'SADDLE SUPPORT', qty: 2, unit: 'off', material: 'CS', bom: true,
        detail: 'ARRANGEMENT ITEM — NOT SIZED BY THIS CALCULATION' });
      return asm;
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
  /* az was -1.15 — close enough to -PI/2 (straight down the plate-stacking
     X axis) that the camera looked almost squarely at the fixed cover's
     face: every plate's face lines up behind the one in front of it from
     that angle, so the whole pack projected to the same flat rectangle
     the covers already draw, regardless of how many plates or how thick
     the pack itself was. -0.7 gives the Z axis (the stack's own depth)
     the dominant share instead, the one direction that actually shows
     plates as a stack rather than a silhouette, while the ports — off to
     the side and colour-coded red/blue — stay identifiable from the angle. */
  register('phe', {
    height: 480, az: -0.7, el: 1.16,
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
    assembly: function (d, lod) {
      var A = window.AROPARTS;
      var asm = A.Assembly({ lod: lod });
      var g = grp();
      var g = grp();
      var Lp = d.Lp, Wp = d.Wp, Dp = d.Dp;
      var frameT = Math.max(0.07, Wp * 0.20);
      /* True N*pitch (a real duty is commonly a few centimetres of plates
         between two much thicker covers) rendered a pack so thin against
         the frame — at the whole assembly's own natural camera distance —
         that the alternating plate colours never resolved to more than a
         couple of pixels: the pack read as part of the covers, not as its
         own textured stack. Flooring it at 1.5x the cover thickness keeps
         a genuinely thick pack (N large / pitch large) exactly as before
         while guaranteeing a thin one still occupies a legible share of
         the frame — schematic, the same trade every other module here
         already makes for parts that are real but too small to read. */
      var packL = Math.max(frameT * 1.5, Math.min(d.N * d.pitch, Lp * 1.6));
      var y = Lp / 2 + 0.22;
      var pressT = frameT * 0.8;
      var xFix = -packL / 2 - frameT / 2, xPress = packL / 2 + pressT / 2;

      /* fixed cover and movable pressure plate — heavier and darker than the
         pack, so the assembly does not read as one undifferentiated slab */
      g.add(at(box(frameT, Lp * 1.14, Wp * 1.18, M.machineDk()), xFix, y, 0));
      g.add(at(box(pressT, Lp * 1.14, Wp * 1.18, M.machineDk()), xPress, y, 0));

      /* the plate pack, drawn plate by plate up to a legible limit.
         90 was a PERFORMANCE cap (don't build hundreds of boxes) — it did
         nothing for legibility, and at any real plate count each band's
         share of packL (already the schematic floor above, not the true
         N*pitch) still came out a couple of millimetres wide: thinner
         than a pixel at the assembly's own default framing, so the
         alternating colours never actually alternated on screen, just
         blurred to the average of both. Capping at 14 keeps every band a
         legible fraction of the pack regardless of how many plates the
         duty actually has; the ANNOTATION below already says when fewer
         are drawn than the true count. */
      var shown = Math.min(d.N, 14), step = packL / shown;
      /* This scene sets no environment map, so any THREE.MeshStandardMaterial
         with real metalness reflects the (black) void around it wherever no
         light hits it directly — not its base colour. The plate pair was
         m:0.78/m:0.72, high enough that most of the pack read as near-black
         from most angles regardless of the base colour underneath (0xb9c4cc,
         0x98a3ab — both light greys anyway, so even lit dead-on they barely
         differed from each other). M.hot()/M.cold(), the nozzle materials
         that DO read clearly in every screenshot so far, use m:0.35 — low
         enough that the base colour actually dominates. Two clearly
         different, low-metalness colours here borrows that same fix and
         gives the alternating plates real contrast from each other too, not
         just from the covers. */
      var plateA = mat(0xe2e8f0, { m: 0.25, r: 0.55 });
      var plateB = mat(0x3b6ea5, { m: 0.25, r: 0.55 });
      for (var i = 0; i < shown; i++) {
        var px = -packL / 2 + step * (i + 0.5);
        g.add(at(box(step * 0.55, Lp, Wp, i % 2 ? plateB : plateA), px, y, 0));
        g.add(at(box(step * 0.22, Lp * 1.005, Wp * 1.005, M.gasket()), px + step * 0.38, y, 0));
      }

      /* carrying bar above, guide bar below, tie bolts around the frame */
      g.add(at(box(packL + frameT * 2.6, Wp * 0.09, Wp * 0.09, M.steelDk()), 0, y + Lp * 0.58, 0));
      g.add(at(box(packL + frameT * 2.6, Wp * 0.07, Wp * 0.07, M.steelDk()), 0, y - Lp * 0.58, 0));
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c2) {
        g.add(at(alongX(cyl(Wp * 0.028, Wp * 0.028, packL + frameT * 2.4, M.steelDk(), 10)),
          0, y + c2[0] * Lp * 0.42, c2[1] * Wp * 0.64));
      });

      /* the four ports, on the fixed cover — labelled with NPS the same way
         pump/STHE label their own nozzles, so a port reads as a sized
         connection instead of just a coloured disc. All four ports share
         one bore (Dp), same as the geometry already draws them. */
      var portNps = npsOfOd(Dp);
      var portTag = portNps ? '  NPS ' + npsNum(portNps) + '″' : '';
      var ports = [[-1, 1, 'HOT IN', true], [-1, -1, 'HOT OUT', true],
                   [1, 1, 'COLD OUT', false], [1, -1, 'COLD IN', false]];
      ports.forEach(function (p) {
        var yy = y + p[1] * Lp * 0.32, zz = p[0] * Wp * 0.28;
        var nz = nozzle(Dp, frameT * 1.5, p[3] ? M.hot() : M.cold());
        nz.rotation.y = Math.PI;
        g.add(at(nz, xFix - frameT / 2, yy, zz));
        g.add(at(p[3] ? hotLabel(p[2] + portTag) : coldLabel(p[2] + portTag),
          xFix - frameT * 3.4, yy, zz + p[0] * Wp * 0.22));
      });

      /* Representative streamlines: all four ports sit on the fixed cover,
         so both services enter and leave the same end — this draws each
         one running the length of the pack and back, hot top-to-bottom and
         cold bottom-to-top, i.e. counter-current, matching the flow
         arrangement the calculation selects (see the counter/co-current
         comparison in aro-phe.js). */
      var portBore = Math.min(Dp, step * 0.6) * 0.7;
      asm.multiRoute = [
        { pts: [new T.Vector3(xFix - frameT / 2, y + Lp * 0.32, -Wp * 0.28),
                new T.Vector3(xFix, y + Lp * 0.15, -Wp * 0.22),
                new T.Vector3(0, y + Lp * 0.05, -Wp * 0.12),
                new T.Vector3(xPress * 0.6, y - Lp * 0.05, -Wp * 0.08),
                new T.Vector3(xFix, y - Lp * 0.15, -Wp * 0.22),
                new T.Vector3(xFix - frameT / 2, y - Lp * 0.32, -Wp * 0.28)],
          color: 0xff5a36, bore: portBore },
        { pts: [new T.Vector3(xFix - frameT / 2, y - Lp * 0.32, Wp * 0.28),
                new T.Vector3(xFix, y - Lp * 0.15, Wp * 0.22),
                new T.Vector3(0, y - Lp * 0.05, Wp * 0.12),
                new T.Vector3(xPress * 0.6, y + Lp * 0.05, Wp * 0.08),
                new T.Vector3(xFix, y + Lp * 0.15, Wp * 0.22),
                new T.Vector3(xFix - frameT / 2, y + Lp * 0.32, Wp * 0.28)],
          color: 0x2ea6ff, bore: portBore }
      ];

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
      asm.custom(g, {
        label: 'PLATE HEAT EXCHANGER, GASKETED', size: d.ok ? d.N + ' PLATES' : null,
        qty: 1, unit: 'off', material: String(d.matName || 'SS 316 PLATES'), bom: true,
        detail: d.ok ? f(d.Lp, 3) + ' × ' + f(d.Wp, 3) + ' m plate, ' + (d.npass || 1) + ' pass' : ''
      }, { od: Math.max(d.Lp, d.Wp) });
      if (d.ok) {
        asm.item({ label: 'HEAT TRANSFER PLATE, CHEVRON', size: f(d.Lp, 3) + ' × ' + f(d.Wp, 3) + ' m',
          qty: d.N, unit: 'off', material: 'SS 316 / TITANIUM', bom: true });
        asm.item({ label: 'PLATE GASKET SET', qty: d.N, unit: 'off',
          material: 'NBR / EPDM', bom: true });
        asm.item({ label: 'PORT NOZZLE', size: f(d.Dp * 1000, 0) + ' mm', qty: 4, unit: 'off',
          material: 'CS LINED', bom: true, detail: 'HOT IN / HOT OUT / COLD IN / COLD OUT' });
        asm.item({ label: 'TIE BOLT SET WITH NUTS', qty: 4, unit: 'set',
          material: 'ASTM A193 B7', bom: true });
      }
      asm.item({ label: 'FRAME, CARRYING BAR AND FEET', qty: 1, unit: 'off', material: 'CS PAINTED',
        bom: true, detail: 'ARRANGEMENT ITEM — NOT SIZED BY THIS CALCULATION' });
      return asm;
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
    height: 480, az: 0.8, el: 1.30,
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
        elOverflow: r.elOverflow / 1000,
        tag: r.tag, fluid: r.fluid, geoCap: r.geoCap, workCap: r.workCap,
        reqCap: r.reqCap, LD: r.LD, t: r.t, freeboard: r.freeboard, wEmpty: r.wEmpty
      };
    },
    /* ── TANK AS AN ASSEMBLY ──────────────────────────────────────────
       Shell, roof and bottom are module-specific plate work; every nozzle,
       manway and vent is a library part at a real size, so the nozzle
       schedule on the take-off is counted from what the model actually
       carries rather than typed alongside it. */
    assembly: function (d, lod) {
      var A = window.AROPARTS;
      var asm = A.Assembly({ lod: lod });
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

      /* the plate work, as one equipment item carrying its design figures */
      asm.custom(g, {
        label: 'VERTICAL STORAGE TANK', size: 'Ø ' + f(D, 3) + ' m × ' + f(H, 3) + ' m',
        qty: 1, unit: 'off', material: String(d.r && d.r.matName || 'CS'),
        tag: d.tag, bom: true,
        detail: (d.r && isFinite(d.r.t) ? 'shell ' + f(d.r.t, 2) + ' mm' : '')
              + (d.roof ? ' · ' + String(d.roof).toUpperCase() + ' ROOF' : '')
      }, { od: D });

      /* the nozzle schedule, as parts */
      var nzOd2 = Math.max(0.06, D * 0.03);
      function schedNoz(yy, ang, lab, nps) {
        var nz = A.nozzle({ od: nzOd2, len: R * 0.16, lod: lod });
        nz.meta = { label: 'NOZZLE — ' + lab, size: nps ? 'NPS ' + nps + '″' : f(nzOd2 * 1000, 0) + ' mm OD',
                    rating: 'CL 150 RF', qty: 1, unit: 'off', material: 'CS', tag: lab, bom: true };
        nz.group.rotation.y = ang;
        nz.group.position.set(R * Math.cos(ang) * 0.99, 0.37 + yy, -R * Math.sin(ang) * 0.99);
        asm.root.add(nz.group);
        asm.items.push(nz);
        asm.selectable.push(nz);
      }
      schedNoz(H * 0.9, 2.25, 'INLET', d.r && d.r.noz_in_nps);
      schedNoz(0.35, 2.75, 'OUTLET', (d.r && (d.r.noz_out_nps || d.r.dOut)));
      if (isFinite(d.elOverflow) && d.elOverflow > 0) schedNoz(Math.min(d.elOverflow, H * 0.97), 1.6, 'OVERFLOW', null);
      var manR2 = Math.min(0.35, D * 0.09);
      var mw2 = A.nozzle({ od: manR2 * 2, len: R * 0.09, lod: lod });
      mw2.meta = { label: 'SHELL MANWAY', size: f(manR2 * 2000, 0) + ' mm', qty: 1, unit: 'off',
                   material: 'CS', tag: 'MW-01', bom: true, detail: 'HINGED COVER' };
      mw2.group.rotation.y = 3.5;
      mw2.group.position.set(R * Math.cos(3.5) * 0.99, 0.37 + Math.max(0.7, H * 0.09), -R * Math.sin(3.5) * 0.99);
      asm.root.add(mw2.group);
      asm.items.push(mw2);
      asm.selectable.push(mw2);
      var vt = A.nozzle({ od: nzOd2 * 1.4, len: R * 0.22, lod: lod });
      vt.meta = { label: 'ROOF VENT', size: f(nzOd2 * 1400, 0) + ' mm', qty: 1, unit: 'off',
                  material: 'CS', tag: 'VT-01', bom: true };
      vt.group.rotation.z = Math.PI / 2;
      vt.group.position.set(R * 0.35, 0.36 + H + roofH, 0);
      asm.root.add(vt.group);
      asm.items.push(vt);
      asm.selectable.push(vt);

      /* declared as arrangement steel, the way the footer says */
      asm.item({ label: 'SPIRAL STAIRWAY WITH HANDRAIL', qty: 1, unit: 'off',
        material: 'CS, GALVANISED', bom: true,
        detail: 'ARRANGEMENT ITEM — NOT SIZED BY THIS CALCULATION' });
      asm.item({ label: 'CONCRETE RING WALL FOUNDATION', size: 'Ø ' + f(D * 1.14, 2) + ' m',
        qty: 1, unit: 'off', material: 'RCC', bom: true,
        detail: 'ARRANGEMENT ITEM — NOT SIZED BY THIS CALCULATION' });
      return asm;
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
  /* Anyone who left SIMPLE or ENGINEERING selected before those buttons were
     removed has it stored in this browser. Without this they would come back
     to a panel pinned to a level with no button to leave it by. */
  function prefDetail() { return 'industrial'; }
  function setDetail(id, dtl, remember) {
    var p = PANELS[id];
    if (!p) return;
    p.detail = dtl;
    if (remember) { try { localStorage.setItem('aro3di_detail', dtl); } catch (e) {} }
  }
  function syncButtons(id) {
    var p = PANELS[id];
    if (!p) return;
    p.wrap.querySelectorAll('.aro3di-btn[data-v]').forEach(function (b) {
      var on = b.getAttribute('data-v') === p.mode
        && !(p.mode === 'ind' && p.detail !== 'industrial');
      b.classList.toggle('on', on);
    });
    p.wrap.querySelectorAll('.aro3di-btn[data-d]').forEach(function (b) {
      b.classList.toggle('on', p.mode === 'ind' && b.getAttribute('data-d') === p.detail);
    });
    var fb = p.wrap.querySelector('.aro3di-btn[data-a="flow"]');
    if (fb) fb.classList.toggle('on', !!p.flow);
    var bb = p.wrap.querySelector('.aro3di-btn[data-a="bom"]');
    if (bb) bb.classList.toggle('on', !!p.showBom);
    var ob = p.wrap.querySelector('.aro3di-btn[data-a="ortho"]');
    if (ob) ob.classList.toggle('on', !!(p.vp && p.vp.isOrtho));
    var rb = p.wrap.querySelector('.aro3di-btn[data-a="rotate"]');
    if (rb) {
      if (p.mode === 'ana') {
        var lgc = legacyOf(id);
        var canSpin = !!(lgc && lgc.controls);
        rb.disabled = !canSpin;
        rb.classList.toggle('on', canSpin && !!lgc.controls.autoRotate);
        rb.title = canSpin ? '' : '360° spin is not available for this view yet — drag to orbit manually.';
      } else {
        rb.disabled = false;
        rb.classList.toggle('on', !!(p.vp && p.vp.controls && p.vp.controls.autoRotate));
      }
    }
    p.wrap.querySelectorAll('.aro3di-btn[data-f]').forEach(function (b) {
      b.classList.toggle('on', p.field === b.getAttribute('data-f'));
    });
  }

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
      '.aro3di-btn:disabled{opacity:0.4;cursor:not-allowed;}',
      '.aro3di-btn:disabled:hover{border-color:var(--border-muted,#334);color:var(--text-muted,#94a3b8);}',
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
      '.aro3di-bar2{border-top:1px dashed rgba(148,163,184,0.28);border-radius:0;}',
      '.aro3di-tip{position:absolute;display:none;pointer-events:none;z-index:8;',
      'font-family:var(--font-mono,monospace);font-size:9px;line-height:1.5;max-width:250px;',
      'background:rgba(8,13,18,0.94);border:1px solid rgba(56,189,248,0.55);',
      'border-radius:5px;padding:6px 8px;color:#e2e8f0;}',
      '.aro3di-tip b{display:block;color:#7dd3fc;margin-bottom:3px;letter-spacing:0.05em;}',
      '.aro3di-tip i{color:#94a3b8;font-style:normal;display:inline-block;min-width:78px;}',
      '.aro3di-legend{position:absolute;right:8px;bottom:8px;z-index:7;width:210px;',
      'font-family:var(--font-mono,monospace);font-size:8.5px;pointer-events:none;',
      'background:rgba(9,14,19,0.86);border:1px solid rgba(148,163,184,0.32);',
      'border-radius:5px;padding:6px 8px;color:#cbd5e1;}',
      '.aro3di-lgt{font-weight:800;letter-spacing:0.06em;color:#e2e8f0;margin-bottom:4px;}',
      '.aro3di-lgbar{height:9px;border-radius:2px;border:1px solid rgba(148,163,184,0.3);}',
      '.aro3di-lgs{display:flex;justify-content:space-between;margin-top:2px;font-weight:700;}',
      '.aro3di-lgn{margin-top:4px;color:#8b96a3;line-height:1.4;font-size:7.5px;}',
      '.aro3di-bom{margin-top:8px;}',
      '.aro3di-bomh{font-weight:800;letter-spacing:0.06em;color:var(--text-muted,#94a3b8);',
      'margin-bottom:5px;font-size:9px;}',
      '.aro3di-bomt{width:100%;border-collapse:collapse;font-size:9px;}',
      '.aro3di-bomt th{text-align:left;font-weight:800;color:var(--text-muted,#94a3b8);',
      'border-bottom:1px solid rgba(148,163,184,0.35);padding:3px 6px;}',
      '.aro3di-bomt td{padding:3px 6px;border-bottom:1px dotted rgba(148,163,184,0.2);',
      'vertical-align:top;color:var(--text-primary,#e2e8f0);}',
      '.aro3di-bomt td:nth-child(4){text-align:right;font-weight:800;white-space:nowrap;}',
      '.aro3di-dim{color:var(--text-muted,#94a3b8);font-weight:400;}',
      '.aro3di-warn{color:#fbbf24;margin-top:5px;}',
      'body.theme-day .aro3di-bomt td{color:#0f172a;}',
      'body.theme-day .aro3di-bomt th{color:#475569;}',
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
    var hasAsm = !!REG[id].assembly;
    wrap.innerHTML =
      '<div class="aro3di-bar">'
      + '<span class="aro3di-lab">3D VIEW</span>'
      /* SIMPLE and ENGINEERING are gone from every module's toolbar.
         Measured on the pump, canvas against canvas: SIMPLE rendered
         PIXEL-IDENTICAL to INDUSTRIAL, and ENGINEERING differed only in
         some bolt and valve detail too small to read at panel size. Three
         buttons that produce one picture are three chances to wonder which
         one is right. The library still carries the detail levels — the
         assembly is built at the industrial level, which is the one the
         drawings, the BOM and the reports have always described.

         ANALYTICAL stays: it is a different view, not a detail level. */
      + '<button type="button" class="aro3di-btn" data-v="ind">INDUSTRIAL</button>'
      + '<button type="button" class="aro3di-btn" data-v="ana">ANALYTICAL</button>'
      + '<span class="aro3di-sp"></span>'
      + (hasAsm ? '<button type="button" class="aro3di-btn" data-a="flow">FLOW</button>' : '')
      + (REG[id].field ? '<button type="button" class="aro3di-btn" data-f="velocity">VELOCITY</button>' : '')
      + (REG[id].field ? '<button type="button" class="aro3di-btn" data-f="pressure">PRESSURE</button>' : '')
      + (hasAsm ? '<button type="button" class="aro3di-btn" data-a="bom">BOM</button>' : '')
      + (REG[id].iso ? '<button type="button" class="aro3di-btn" data-a="iso">ISOMETRIC</button>' : '')
      + '<button type="button" class="aro3di-btn" data-a="png">SNAPSHOT</button>'
      + '</div>'
      + '<div class="aro3di-bar aro3di-bar2">'
      + '<span class="aro3di-lab">VIEW</span>'
      + '<button type="button" class="aro3di-btn" data-c="iso">ISO</button>'
      + '<button type="button" class="aro3di-btn" data-c="front">FRONT</button>'
      + '<button type="button" class="aro3di-btn" data-c="back">BACK</button>'
      + '<button type="button" class="aro3di-btn" data-c="left">LEFT</button>'
      + '<button type="button" class="aro3di-btn" data-c="right">RIGHT</button>'
      + '<button type="button" class="aro3di-btn" data-c="top">TOP</button>'
      + '<button type="button" class="aro3di-btn" data-c="bottom">BOTTOM</button>'
      + '<span class="aro3di-sp"></span>'
      + '<button type="button" class="aro3di-btn" data-a="ortho">ORTHOGRAPHIC</button>'
      + '<button type="button" class="aro3di-btn" data-a="rotate" title="Spin the model a continuous 360° — drag to take the camera back">360°</button>'
      + '<button type="button" class="aro3di-btn" data-a="fit">FIT MODEL</button>'
      + '<button type="button" class="aro3di-btn" data-a="reset">RESET</button>'
      + '</div>'
      + '<div class="aro3di-view">'
      + '<div class="aro3di-canvas"></div>'
      + '<div class="aro3di-ovl"></div>'
      + '<div class="aro3di-tip"></div>'
      + '</div>'
      + '<div class="aro3di-data">'
      + '<div class="aro3di-rows"></div>'
      + '<div class="aro3di-msg"></div>'
      + '<div class="aro3di-bom"></div>'
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
      bomBox: wrap.querySelector('.aro3di-bom'),
      tip: wrap.querySelector('.aro3di-tip'),
      foot: wrap.querySelector('.aro3di-foot'),
      vp: null, mode: prefView(), sig: null,
      detail: prefDetail(), flow: false, showBom: false, asm: null, home: null,
      field: null, framed: false
    };
    PANELS[id] = p;

    wrap.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.aro3di-btn') : null;
      if (!b) return;
      if (b.getAttribute('data-v')) { setDetail(id, 'industrial', false); setMode(id, b.getAttribute('data-v'), true); syncButtons(id); return; }
      if (b.getAttribute('data-d')) {
        var want = b.getAttribute('data-d');
        setDetail(id, p.detail === want ? 'industrial' : want, true);
        if (p.mode !== 'ind') setMode(id, 'ind', true); else build(id, true);
        syncButtons(id);
        return;
      }
      if (b.getAttribute('data-f')) {
        var want = b.getAttribute('data-f');
        p.field = p.field === want ? null : want;
        paintField(id); syncButtons(id);
        return;
      }
      if (b.getAttribute('data-c')) { camera(id, b.getAttribute('data-c')); return; }
      var a = b.getAttribute('data-a');
      if (a === 'fit' && p.vp) p.vp.frame({ az: REG[id].az, el: REG[id].el });
      if (a === 'ortho') { if (p.vp) { p.vp.setOrtho(!p.vp.isOrtho); } syncButtons(id); }
      if (a === 'rotate') {
        /* Whichever picture is on screen is the one that spins — mirrors the
           camera() dispatch above. The CustomOrbitControls rig (pump, shell &
           tube, double pipe) already drives autoRotate on its own update()
           loop in either mode; the spherical {r,theta,phi} rig the five
           line-sizing services, PHE and the tank use has no such hook wired
           into their own animation loops, so ANALYTICAL mode there keeps the
           button disabled rather than pretending to spin something it can't. */
        if (p.mode === 'ana') {
          var lg = legacyOf(id);
          if (lg && lg.controls) lg.controls.autoRotate = !lg.controls.autoRotate;
        } else if (p.vp && p.vp.controls) { p.vp.controls.autoRotate = !p.vp.controls.autoRotate; }
        syncButtons(id);
      }
      if (a === 'reset') { p.detail = 'industrial'; p.flow = false; p.showBom = false;
                           if (p.vp) p.vp.setOrtho(false);
                           p.framed = false;
                           if (p.vp && p.vp.controls) p.vp.controls.autoRotate = false;
                           build(id, true); syncButtons(id); }
      if (a === 'png') snapshot(id);
      if (a === 'flow') { p.flow = !p.flow; setFlow(id); syncButtons(id); }
      if (a === 'bom') { p.showBom = !p.showBom; paintBom(id); syncButtons(id); }
      if (a === 'iso') openIsometric(id);
    });
    wireInspect(p);

    setMode(id, p.mode, false);
    syncButtons(id);
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
      setTimeout(function () { wakeLegacy(id); window.dispatchEvent(new Event('resize')); syncButtons(id); }, 60);
      setTimeout(function () { wakeLegacy(id); window.dispatchEvent(new Event('resize')); syncButtons(id); }, 400);
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

    /* A module that has not been calculated gets nothing drawn.
       The panel used to fall back to a default spool whenever data() reported
       ok:false — a generic 4-inch pipe, drawn for a line that had never been
       sized. After a RESET it was worse than generic: the reset cleared the
       boxes and the results, and this panel carried on showing the spool and
       the readout from the design that had just been thrown away. A picture of
       the wrong pipe is not a neutral placeholder.

       The test is the calculation state, not what data() managed to return.
       Keying it on data() left the model up whenever a module recomputed from
       leftover fields on its way to being cleared — which is exactly what a
       reset does on its last tick. An OUTDATED design still draws, under its
       SUPERSEDED banner: that one has been calculated, it is just no longer
       current. */
    if (!isCalculated(id)) { showEmpty(id); return; }

    var sig = signature(id, d);
    if (!force && sig === p.sig && p.vp) { paintOverlay(id, d); return; }
    p.sig = sig;

    if (!p.vp) p.vp = new Viewport(p.canvas, def.height || 480);
    p.vp.clear();
    var g;
    p.asm = null;
    try {
      if (def.assembly && window.AROPARTS) {
        /* an assembly-backed model: parts placed port to port, so the BOM,
           the isometric and the validation all come off the same geometry */
        p.asm = def.assembly(d, LODOF[p.detail] == null ? 1 : LODOF[p.detail]);
        g = p.asm.root;
      } else {
        g = def.build(d, p.vp);
      }
    } catch (e) {
      p.ovl.innerHTML = '<span class="aro3di-st no">— MODEL UNAVAILABLE</span>';
      p.rows.innerHTML = '';
      p.msg.textContent = 'The industrial model could not be built from the current design. '
        + 'The analytical view is unaffected.';
      return;
    }
    p.vp.root.add(g);
    try {
      var bb = new T.Box3().setFromObject(p.vp.root);
      var sz = bb.getSize(new T.Vector3());
      p.vp.laydown(Math.max(sz.x, sz.z) * 1.35);
    } catch (e2) {}
    /* Every recalculation used to re-frame the camera to fit the new
       model, every time — a single input change re-zoomed and re-centred
       the view even when nothing but a dimension changed. That hid the
       one thing a re-frame after resizing was supposed to show: a bigger
       model got a camera pulled back to match, so nothing on screen
       actually looked bigger — the discharge riser could visibly grow in
       world units (dz's own scale factor, above) and still read as
       "unchanged" because the auto-zoom absorbed it. It also meant any
       angle the engineer had dragged to was thrown away on the next
       keystroke. Framing now happens once, on the model's first build (or
       after RESET/FIT MODEL puts it back) — same behaviour the lib/
       modules' own spherical rigs already use for this exact reason. */
    if (!p.framed) {
      p.vp.frame({ az: def.az, el: def.el });
      p.framed = true;
    }
    p.home = { az: def.az, el: def.el };
    p.lastData = d;
    setFlow(id);
    paintField(id);
    paintOverlay(id, d);
    paintBom(id);
    /* the geometry check the assembly can make of itself */
    if (p.asm) {
      var issues = [];
      try { issues = p.asm.validate(); } catch (e2) {}
      p.issues = issues;
    } else { p.issues = []; }
  }

  function isCalculated(id) {
    try {
      if (window.ARORESET && window.ARORESET.is(id)) return false;
      if (window.AROSTATE && window.AROSTATE.modules().indexOf(id) >= 0) {
        return window.AROSTATE.isCalculated(id);
      }
    } catch (e) {}
    return true;                       /* a module the state machine does not
                                          track keeps its previous behaviour */
  }

  /* Empty the panel and say why, without destroying it. */
  function showEmpty(id) {
    var p = PANELS[id], def = REG[id];
    if (!p || !def) return;
    p.sig = '__empty__';
    p.asm = null;
    p.issues = [];
    p.lastData = null;
    p.framed = false;
    if (p.vp) {
      try {
        p.vp.clear();
        /* repaint once so the cleared scene actually reaches the screen —
           the render loop only runs while the panel is marked dirty */
        p.vp.renderer.render(p.vp.scene, p.vp.live());
      } catch (e) {}
    }
    if (p.rows) p.rows.innerHTML = '';
    if (p.ovl) {
      p.ovl.innerHTML = '<span class="aro3di-st no">\u2014 NOT CALCULATED</span>'
        + '<span class="aro3di-ttl">' + esc(def.title || '') + '</span>';
    }
    if (p.msg) {
      p.msg.textContent = 'Nothing is drawn. The model is built from the calculated design — '
        + 'enter the inputs and run the calculation.';
    }
    if (p.bomBox) p.bomBox.innerHTML = '';
    if (p.foot) p.foot.textContent = '';
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
    if (p.issues && p.issues.length) {
      p.msg.innerHTML = (p.msg.textContent ? esc(p.msg.textContent) + '<br>' : '')
        + '<span class="aro3di-warn">\u26a0 MODEL VALIDATION WARNING \u2014 '
        + esc(p.issues.slice(0, 3).join(' ')) + '</span>';
    }
  }

  /* ── Camera presets ────────────────────────────────────────────────────
     Azimuth is measured from +Z toward +X; elevation is the polar angle from
     +Y, so 90 degrees stands on the horizon. */
  var VIEWS = {
    iso:    { az: 0.79, el: 1.05 },
    front:  { az: 0.00, el: 1.5708 },
    back:   { az: 3.1416, el: 1.5708 },
    right:  { az: 1.5708, el: 1.5708 },
    left:   { az: -1.5708, el: 1.5708 },
    top:    { az: 0.00, el: 0.13 },
    bottom: { az: 0.00, el: 3.0116 }
  };
  /* ── THE VIEW BUTTONS WORK IN BOTH MODES ───────────────────────────────
     ISO / FRONT / BACK / LEFT / RIGHT / TOP / BOTTOM only ever drove the
     INDUSTRIAL viewport. In ANALYTICAL mode that viewport is hidden and the
     module's own scene is on screen instead, so every one of those buttons
     did nothing — the bar was there, it just had no effect on the picture
     the engineer was looking at.

     Two camera rigs are in use across the suite. The modules built in app.js
     (pump, shell & tube, double pipe) drive a THREE camera through
     CustomOrbitControls. The modules built in lib/ (all five line-sizing
     services, the plate exchanger, the tank) drive theirs from a spherical
     {r, theta, phi} and a place() function. Both are handled here, and the
     spherical convention is the same one the industrial viewport uses — az
     is theta, el is phi — so a named view means the same thing everywhere.

     A module registers its scene with registerLegacy(); nothing is guessed
     from the DOM. */
  var LEGACY = {};
  function registerLegacy(id, getter) {
    LEGACY[id] = getter;
    /* A scene built AFTER the engineer switched theme would otherwise keep
       the literal background it was constructed with — which is how a light
       desktop ended up with a night-black window inside a light frame. Paint
       it on arrival, not only when the theme next changes. */
    try { themeLegacyScenes(sceneBg(), id); } catch (e) {}
  }
  function legacyOf(id) {
    var f = LEGACY[id];
    if (!f) return null;
    try { return f() || null; } catch (e) { return null; }
  }

  function frameLegacy(g, which) {
    if (!g) return false;
    var v = VIEWS[which] || VIEWS.iso;
    var cam = g.camera || g.cam;
    if (!cam) return false;

    /* the spherical rig — set the angles it already understands */
    if (g.sph && typeof g.place === 'function') {
      g.sph.theta = v.az;
      g.sph.phi = Math.max(0.08, Math.min(Math.PI - 0.08, v.el));
      g.place();
      return true;
    }

    /* the orbit rig — frame the model the way the industrial viewport does */
    var T3 = three();
    var root = g.root || g.group || g.scene;
    if (!T3 || !root) return false;
    /* setFromObject(root) would also measure the ground plane and (on the
       pump) a fixed red grade-line dash — both sized and centred for the
       WORLD, not for wherever this particular design put the equipment. A
       12-8 floor and a 10-unit reference line comfortably outweigh a pump
       assembly a couple of units across, so every VIEW button (ISO, FRONT,
       RIGHT...) framed the camera on the middle of the floor instead of the
       middle of the model — equipment rendered visibly off to one side, the
       amount and direction changing with the angle. Union only the meshes
       that are actually part of the design; grid helpers and anything
       tagged aroIndicative (ground planes, reference lines) are drawn, just
       not counted. */
    var b = new T3.Box3();
    root.traverse(function (o) {
      if (o.isGridHelper || (o.userData && o.userData.aroIndicative)) return;
      if (o.isMesh || o.isLine || o.isPoints) b.expandByObject(o);
    });
    if (b.isEmpty() || !isFinite(b.min.x)) b.setFromObject(root);   // nothing survived the filter — fall back rather than frame on nothing
    if (b.isEmpty() || !isFinite(b.min.x)) return false;
    var c = b.getCenter(new T3.Vector3()), s = b.getSize(new T3.Vector3());
    var halfW = 0.5 * Math.sqrt(s.x * s.x + s.z * s.z), halfH = 0.5 * s.y;
    var vt = Math.tan(((cam.fov || 45) * Math.PI / 180) / 2);
    var ht = vt * Math.max(0.3, cam.aspect || 1.6);
    var dist = Math.max(halfH / vt, halfW / ht) * 1.1 + halfW * 0.45 + 0.05;
    cam.position.set(
      c.x + dist * Math.sin(v.el) * Math.sin(v.az),
      c.y + dist * Math.cos(v.el),
      c.z + dist * Math.sin(v.el) * Math.cos(v.az));
    cam.near = Math.max(0.01, dist / 900);
    cam.far = dist * 60;
    cam.lookAt(c);
    cam.updateProjectionMatrix();
    var ct = g.controls;
    if (ct) {
      if (ct.target && ct.target.set) ct.target.set(c.x, c.y, c.z);
      ct.minPolarAngle = 0.02; ct.maxPolarAngle = Math.PI - 0.02;
      /* the module's scene may be smaller or larger than the rig was set up
         for; a clamp left over from the original framing would fight this */
      if (isFinite(ct.minDistance)) ct.minDistance = Math.min(ct.minDistance, dist * 0.18);
      if (isFinite(ct.maxDistance)) ct.maxDistance = Math.max(ct.maxDistance, dist * 1.6);
      if (typeof ct.updateSphericalFromCamera === 'function') ct.updateSphericalFromCamera();
      /* CustomOrbitControls eases toward targetSpherical, which
         updateSphericalFromCamera() does not touch. Without this the very
         next animation frame pulls the camera straight back to where it was,
         and the button appears to do nothing. */
      if (ct.spherical && ct.targetSpherical) {
        ct.targetSpherical.radius = ct.spherical.radius;
        ct.targetSpherical.phi = ct.spherical.phi;
        ct.targetSpherical.theta = ct.spherical.theta;
      }
      if (typeof ct.update === 'function') ct.update();
    }
    return true;
  }

  function camera(id, which) {
    var p = PANELS[id];
    if (!p) return;
    /* whichever picture is actually on screen is the one that turns */
    if (p.mode === 'ana') { frameLegacy(legacyOf(id), which); return; }
    if (!p.vp) return;
    var v = VIEWS[which] || VIEWS.iso;
    p.vp.controls.minPolarAngle = 0.02;
    p.vp.controls.maxPolarAngle = Math.PI - 0.02;
    p.vp.frame({ az: v.az, el: v.el });
  }

  /* ── Inspection ────────────────────────────────────────────────────────
     Hovering a component reads its own metadata back. Labels are not painted
     permanently over the model — the engineer asks, the model answers. */
  function wireInspect(p) {
    if (!three()) return;
    var ray = new T.Raycaster(), pt = new T.Vector2();
    var last = null;
    function partAt(e) {
      if (!p.vp) return null;
      var el = p.vp.renderer.domElement, r = el.getBoundingClientRect();
      pt.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pt.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(pt, p.vp.live());
      var hits = ray.intersectObjects(p.vp.root.children, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        while (o) {
          if (o.userData && o.userData.aroPart) return o.userData.aroPart;
          o = o.parent;
        }
      }
      return null;
    }
    p.view.addEventListener('mousemove', function (e) {
      if (p.mode !== 'ind' || !p.asm) return;
      var part = partAt(e);
      if (part === last) {
        if (part) { p.tip.style.left = (e.offsetX + 14) + 'px'; p.tip.style.top = (e.offsetY + 14) + 'px'; }
        return;
      }
      last = part;
      if (!part) { p.tip.style.display = 'none'; return; }
      var mt = part.meta || {};
      var rows = [];
      if (mt.size) rows.push(['SIZE', mt.size]);
      if (mt.rating) rows.push(['RATING', mt.rating]);
      if (part.kind === 'PIPE') rows.push(['LENGTH', f(part.trueLen != null ? part.trueLen : part.len, 3) + ' m']);
      if (mt.material) rows.push(['MATERIAL', mt.material]);
      if (mt.boltCount) rows.push(['BOLTING', mt.boltCount + ' off']);
      if (mt.ends) rows.push(['ENDS', mt.ends]);
      if (mt.detail) rows.push(['DETAIL', mt.detail]);
      var d = p.lastData || {};
      if (part.kind === 'PIPE' && d.ok) {
        rows.push(['BORE', f(d.r && d.r.Dmm, 2) + ' mm']);
        rows.push(['VELOCITY', f(d.V, 3) + ' m/s']);
        rows.push(['TOTAL \u0394P', f(d.dP, 5) + ' bar']);
      }
      p.tip.innerHTML = '<b>' + esc(mt.label || part.kind) + (mt.tag ? '  ' + esc(mt.tag) : '') + '</b>'
        + rows.map(function (r) { return '<div><i>' + esc(r[0]) + '</i>' + esc(r[1]) + '</div>'; }).join('');
      p.tip.style.display = 'block';
      p.tip.style.left = (e.offsetX + 14) + 'px';
      p.tip.style.top = (e.offsetY + 14) + 'px';
    });
    p.view.addEventListener('mouseleave', function () { p.tip.style.display = 'none'; last = null; });
  }

  /* ── HOW THE FLUID LOOKS ────────────────────────────────────────────────
     APPEARANCE ONLY. Nothing in this table is an engineering property, none
     of it is read by any calculation, and none of it reaches a result, a
     report or a datasheet. It exists so that a line of crude does not look
     like a line of water on screen — the same reason a P&ID uses different
     line styles.

     Matched on the fluid the engineer selected. An unrecognised fluid is not
     given a made-up identity: it falls through to a neutral appearance
     shaded by the density and viscosity the design is already using, which
     is the honest answer — heavier and thicker is drawn darker and more
     opaque, and nothing is claimed beyond that. */
  var FLUIDLOOK = [
    [/crude|bitumen|residue|fuel\s*oil|heavy\s*oil|asphalt/i,   { c: 0x2a1d14, o: 0.95, name: 'dark oil' }],
    [/lube|gear\s*oil|hydraulic\s*oil|transformer\s*oil/i,      { c: 0x8a5a1e, o: 0.88, name: 'lube oil' }],
    [/diesel|gas\s*oil|hsd|light\s*oil/i,                       { c: 0xc98a2e, o: 0.80, name: 'diesel' }],
    [/kerosene|jet|naphtha|gasoline|petrol/i,                   { c: 0xe0c97a, o: 0.62, name: 'light distillate' }],
    [/caustic|sodium\s*hydroxide|naoh|lye/i,                    { c: 0xdfe6c8, o: 0.55, name: 'caustic' }],
    [/sulphuric|sulfuric|h2so4/i,                               { c: 0xb8a24a, o: 0.72, name: 'sulphuric acid' }],
    [/hydrochloric|hcl|nitric|hno3|phosphoric|acid/i,           { c: 0xd7e08a, o: 0.60, name: 'acid' }],
    [/glycol|meg|deg|teg/i,                                     { c: 0xe8d98a, o: 0.60, name: 'glycol' }],
    [/amine|mdea|dea|mea/i,                                     { c: 0xcfd9a8, o: 0.62, name: 'amine' }],
    [/methanol|ethanol|solvent|acetone|benzene|toluene/i,       { c: 0xe6f0f5, o: 0.45, name: 'solvent' }],
    [/ammonia|nh3/i,                                            { c: 0xdfeef2, o: 0.40, name: 'ammonia' }],
    [/slurry|coal|ore|sand|tailings|pulp|cement/i,              { c: 0x6b5a48, o: 0.96, name: 'slurry' }],
    [/sea\s*water|brine|salt/i,                                 { c: 0x2f8f8a, o: 0.60, name: 'brine' }],
    [/steam|condensate|vapour|vapor/i,                          { c: 0xdfeaf2, o: 0.30, name: 'steam' }],
    [/lng|propane|butane|ethylene|refrigerant/i,                { c: 0xeaf6fb, o: 0.34, name: 'light hydrocarbon' }],
    [/air|nitrogen|oxygen|hydrogen|methane|natural\s*gas|co2|gas/i, { c: 0xcfe8f5, o: 0.24, name: 'gas' }],
    [/water|aqueous|cooling|chilled|boiler\s*feed|dm\b/i,       { c: 0x4aa3d8, o: 0.55, name: 'water' }]
  ];

  function fluidLook(d) {
    d = d || {};
    var nm = String(d.fluid || d.fluidName || d.service || d.medium || '');
    if (!nm) {
      /* fall back to whichever module select is on screen — the panel does
         not always carry the name through its published data */
      var ids = ['pump-fluid', 'lq-fluid', 'gs-gas', 'st-props', 'sl-carrier',
                 'tk-fluid', 'dphe-fluid-hot-select', 'sthe-fluid-shell-select', 'phe-hot-fluid'];
      for (var i = 0; i < ids.length; i++) {
        var e = document.getElementById(ids[i]);
        if (e && e.value && e.offsetParent) { nm = String(e.value); break; }
      }
    }
    for (var k = 0; k < FLUIDLOOK.length; k++) {
      if (FLUIDLOOK[k][0].test(nm)) {
        var L = FLUIDLOOK[k][1];
        return { c: L.c, o: L.o, name: nm || L.name, matched: true };
      }
    }
    /* Nothing recognised. Shade it from the numbers the design already
       holds rather than guessing what it is. */
    var rho = Number(d.rho), mu = Number(d.mu);
    var heavy = isFinite(rho) ? Math.max(0, Math.min(1, (rho - 700) / 1600)) : 0.3;
    var thick = isFinite(mu) ? Math.max(0, Math.min(1, Math.log10(Math.max(0.1, mu)) / 3)) : 0.2;
    var t = Math.max(heavy, thick);
    /* pale blue-grey when light and thin, dark brown-grey when heavy and thick */
    var r = Math.round(0x8a + (0x3a - 0x8a) * t);
    var g = Math.round(0xa8 + (0x2e - 0xa8) * t);
    var bl = Math.round(0xc4 + (0x22 - 0xc4) * t);
    return { c: (r << 16) | (g << 8) | bl, o: 0.35 + 0.5 * t, name: nm || 'unnamed fluid', matched: false };
  }

  /* The streaming texture: soft bands along the line, so the column reads as
     moving material rather than as a row of beads. Drawn once and re-tinted
     per fluid by the material colour. */
  var FLOWTEX = null;
  function flowTexture() {
    if (FLOWTEX) return FLOWTEX;
    var c = document.createElement('canvas');
    c.width = 256; c.height = 8;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 256, 0);
    for (var i = 0; i <= 8; i++) {
      var u = i / 8;
      /* alternating dense and sheer, eased so there is no hard edge.
         The contrast is deliberately gentle: at full range the bands read
         as beads on a rope, which is the look this replaced. */
      var a = 0.62 + 0.38 * Math.pow(Math.sin(u * Math.PI * 4), 2);
      g.addColorStop(u, 'rgba(255,255,255,' + a.toFixed(3) + ')');
    }
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 8);
    FLOWTEX = new T.CanvasTexture(c);
    FLOWTEX.wrapS = T.RepeatWrapping;
    FLOWTEX.wrapT = T.ClampToEdgeWrapping;
    return FLOWTEX;
  }

  /* The bore the fluid is actually in. items[0] is whatever the assembly
     starts with — on a pump that is the CASING, 0.906 m across, and sizing
     the flow from it produced spheres wider than the whole line and drew
     them over the machine. The piping items are the ones that carry the
     fluid; the smallest of them is the bore it has to pass through. */
  var PIPING = /^(PIPE|ELBOW|BEND|TEE|REDUCER|JOINT|FLANGE|VALVE|SPOOL|NOZZLE)$/i;
  function flowBore(asm) {
    var best = Infinity;
    for (var i = 0; i < asm.items.length; i++) {
      var it = asm.items[i];
      if (!PIPING.test(String(it.kind || ''))) continue;
      var od = Number(it.od);
      if (isFinite(od) && od > 0 && od < best) best = od;
    }
    if (isFinite(best)) return best;
    for (var j = 0; j < asm.items.length; j++) {
      var o2 = Number(asm.items[j].od);
      if (isFinite(o2) && o2 > 0) return o2;
    }
    return 0.1;
  }

  /* While the flow is shown the piping is made translucent, so the column
     inside it can be seen at all — the pipe is opaque steel and a stream
     drawn inside it would otherwise be hidden by the very thing it runs
     through. Only PIPING is dimmed; equipment stays solid. The original
     material is kept on the mesh and put back when the flow is turned off,
     and a clone is used for the dimmed state so materials shared with the
     rest of the model are never altered. */
  function dimPiping(asm, on) {
    for (var i = 0; i < asm.items.length; i++) {
      var it = asm.items[i];
      if (!PIPING.test(String(it.kind || '')) || !it.group) continue;
      it.group.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        if (on) {
          if (o.__aroFlowMat) return;
          o.__aroFlowMat = o.material;
          var m2 = o.material.clone();
          m2.transparent = true;
          m2.opacity = 0.34;
          m2.depthWrite = false;
          o.material = m2;
        } else if (o.__aroFlowMat) {
          if (o.material && o.material.dispose) o.material.dispose();
          o.material = o.__aroFlowMat;
          o.__aroFlowMat = null;
        }
      });
    }
  }

  /* ── Flow ──────────────────────────────────────────────────────────────
     A column of fluid running the assembly's own centreline, in the
     direction the process actually flows. Nothing about the direction is
     inferred from how the model happens to be drawn.

     It replaces a ring of spheres that walked the same path: those read as
     beads on a string rather than as fluid, they were sized from the wrong
     item, and they were the same sky blue whatever was in the line. */
  /* Build one flow tube along a point list, with its own bore/colour/speed —
     the piece setFlow() below repeats once per cursor-tracked assembly
     (pump, line spools) or once per entry in asm.multiRoute (the heat
     exchangers, which have no cursor-tracked path at all — see there). */
  function buildFlowTube(pts, bore, colorHex, speedRef, look) {
    var curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.02);
    var span = 0;
    for (var ri = 1; ri < pts.length; ri++) span += pts[ri].distanceTo(pts[ri - 1]);
    var tube = new T.TubeGeometry(curve, Math.max(64, Math.round(span * 22)),
                                  Math.max(0.004, bore * 0.40), 14, false);
    var tex = flowTexture().clone();
    tex.needsUpdate = true;
    tex.wrapS = T.RepeatWrapping;
    tex.repeat.set(Math.max(4, Math.round(span / Math.max(0.05, bore * 2))), 1);
    var m = new T.MeshBasicMaterial({
      color: colorHex != null ? colorHex : look.c, map: tex, transparent: true, opacity: look.o,
      depthWrite: false, side: T.DoubleSide
    });
    var mesh = new T.Mesh(tube, m);
    mesh.renderOrder = 3;
    var rate = Math.max(0.05, Math.min(1.6, speedRef / Math.max(0.5, span))) * tex.repeat.x;
    return { mesh: mesh, tick: function (t) { tex.offset.x = -(t * rate) % 1; } };
  }

  function setFlow(id) {
    var p = PANELS[id];
    if (!p || !p.vp) return;
    if (p.flowObj) {
      p.vp.root.remove(p.flowObj);
      p.flowObj.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      p.flowObj = null;
    }
    if (p.asm) dimPiping(p.asm, false);
    p.vp.flowTick = null;
    p.vp.dirty = true;
    if (!p.flow || !p.asm) return;
    var look = fluidLook(p.lastData);
    var d0 = p.lastData || {};
    var vRef = isFinite(d0.V) && d0.V > 0 ? d0.V
             : (isFinite(d0.vs) && d0.vs > 0 ? d0.vs : 1);

    var group = new T.Group();
    var ticks = [];

    /* Heat exchangers (DPHE/STHE/PHE) build their main body from custom
       geometry, not cursor-tracked parts — asm.route() never has more than
       the one starting point, so the flow column this section used to
       build unconditionally silently never had anything to draw. Those
       modules instead set asm.multiRoute directly: one or two representative
       streamlines (hot/cold, tube/shell...) through the geometry they
       already placed, each with its own bore and colour so both sides of
       an exchanger show distinctly. */
    if (p.asm.multiRoute && p.asm.multiRoute.length) {
      p.asm.multiRoute.forEach(function (r) {
        if (!r || !r.pts || r.pts.length < 2) return;
        var built = buildFlowTube(r.pts, r.bore || 0.05, r.color, isFinite(r.vRef) && r.vRef > 0 ? r.vRef : vRef, look);
        group.add(built.mesh);
        ticks.push(built.tick);
      });
      if (!ticks.length) return;
    } else {
      var route = p.asm.route();
      if (route.length < 2) return;
      var bore = flowBore(p.asm);
      var built0 = buildFlowTube(route, bore, null, vRef, look);
      group.add(built0.mesh);
      ticks.push(built0.tick);
    }

    p.flowObj = group;
    p.vp.root.add(group);
    dimPiping(p.asm, true);
    p.vp.flowTick = function (t) {
      for (var i = 0; i < ticks.length; i++) ticks[i](t);
    };
    p.flowLook = look;
  }

  /* ── ENGINEERING FIELD VISUALISATION ────────────────────────────────────
     This is NOT CFD and does not claim to be. It colours the model from the
     one-dimensional result the calculation already produced: the velocity it
     computed from V = Q/A, and the pressure falling from P1 to P2 along the
     route in proportion to the friction, fitting and elevation terms the
     hydraulics used. Nothing local is invented — a fitting is coloured by the
     pressure at the point it sits, not by a made-up local field. */
  var RAMP = [
    [0.00, 0x2f6ea8], [0.25, 0x2f9fb0], [0.50, 0x4fa85f],
    [0.75, 0xc9a227], [1.00, 0xb04430]
  ];
  function ramp(t) {
    t = Math.max(0, Math.min(1, isFinite(t) ? t : 0));
    for (var i = 1; i < RAMP.length; i++) {
      if (t <= RAMP[i][0]) {
        var a = RAMP[i - 1], b = RAMP[i];
        var u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        var ca = new T.Color(a[1]), cb = new T.Color(b[1]);
        return ca.lerp(cb, u).getHex();
      }
    }
    return RAMP[RAMP.length - 1][1];
  }

  /* Walk the assembly and give every run component the colour of the field at
     its own station. Returns the legend, or null when there is nothing real
     to show. */
  function paintField(id) {
    var p = PANELS[id], def = REG[id];
    if (!p || !p.vp || !p.asm) return;
    p.vp.dirty = true;
    /* restore the metal first, whatever happens next */
    p.asm.items.forEach(function (it) {
      if (!it.__origMat) return;
      it.group.traverse(function (o) {
        if (o.isMesh && o.__fieldMat) { o.material = o.__origMat0; o.__fieldMat = false; }
      });
    });
    var box = p.wrap.querySelector('.aro3di-legend');
    if (box) box.remove();
    if (!p.field || !def.field) { return; }

    var d = p.lastData || {};
    var f2 = def.field(d);
    if (!f2 || !f2[p.field]) return;
    var spec = f2[p.field];
    if (!isFinite(spec.lo) || !isFinite(spec.hi)) return;

    /* station of each run item along the route, 0 at P1 and 1 at P2 */
    var runs = p.asm.items.filter(function (it) {
      return it.kind === 'PIPE' || it.kind === 'ELBOW' || it.kind === 'VALVE'
          || it.kind === 'TEE' || it.kind === 'REDUCER' || it.kind === 'JOINT'
          || it.kind === 'FLANGE';
    });
    var total = 0;
    runs.forEach(function (it) { total += (it.trueLen != null ? it.trueLen : it.len) || 0; });
    var walked = 0;
    runs.forEach(function (it) {
      var l = (it.trueLen != null ? it.trueLen : it.len) || 0;
      var mid = total > 0 ? (walked + l / 2) / total : 0.5;
      walked += l;
      var v = spec.at(mid);
      var t = (v - spec.lo) / Math.max(1e-9, spec.hi - spec.lo);
      var col = ramp(spec.invert ? 1 - t : t);
      var m2 = mat(col, { m: 0.35, r: 0.55 });
      it.group.traverse(function (o) {
        if (!o.isMesh || o.isInstancedMesh) return;
        if (!o.__origMat0) o.__origMat0 = o.material;
        o.material = m2;
        o.__fieldMat = true;
      });
      it.__origMat = true;
    });

    /* the legend — a field with no scale on it is decoration */
    var lg = document.createElement('div');
    lg.className = 'aro3di-legend';
    var stops = '';
    for (var q = 0; q <= 10; q++) {
      var cc = ramp(spec.invert ? 1 - q / 10 : q / 10);
      stops += '#' + ('000000' + cc.toString(16)).slice(-6) + (q < 10 ? ',' : '');
    }
    lg.innerHTML = '<div class="aro3di-lgt">' + esc(spec.label)
      + '  <span class="aro3di-dim">' + esc(spec.unit) + '</span></div>'
      + '<div class="aro3di-lgbar" style="background:linear-gradient(90deg,' + stops + ');"></div>'
      + '<div class="aro3di-lgs"><span>' + f(spec.lo, spec.dp == null ? 2 : spec.dp)
      + '</span><span>' + f((spec.lo + spec.hi) / 2, spec.dp == null ? 2 : spec.dp)
      + '</span><span>' + f(spec.hi, spec.dp == null ? 2 : spec.dp) + '</span></div>'
      + '<div class="aro3di-lgn">1-D ENGINEERING VISUALISATION — NOT CFD. '
      + esc(spec.note || '') + '</div>';
    p.view.appendChild(lg);
  }

  /* ── Bill of material, off the assembly ────────────────────────────────── */
  function bomRows(id) {
    var p = PANELS[id];
    if (!p || !p.asm || !isCalc(id) || calcState(id) === OUTDATED) return null;
    try { return p.asm.bom(); } catch (e) { return null; }
  }
  function paintBom(id) {
    var p = PANELS[id];
    if (!p || !p.bomBox) return;
    if (!p.showBom) { p.bomBox.innerHTML = ''; p.bomBox.style.display = 'none'; return; }
    p.bomBox.style.display = '';
    var rows = bomRows(id);
    if (!rows || !rows.length) {
      p.bomBox.innerHTML = '<div class="aro3di-bomh">BILL OF MATERIAL</div>'
        + '<div class="aro3di-msg">The bill of material is taken from the assembled model, so it '
        + 'appears once the design has been calculated and is current.</div>';
      return;
    }
    var h = '<div class="aro3di-bomh">BILL OF MATERIAL \u2014 TAKEN FROM THE ASSEMBLED MODEL</div>'
      + '<table class="aro3di-bomt"><tr><th>ITEM</th><th>DESCRIPTION</th><th>SIZE</th>'
      + '<th>QTY</th><th>MATERIAL</th></tr>';
    rows.forEach(function (r, i) {
      h += '<tr><td>' + String(i + 1).padStart(2, '0') + '</td><td>' + esc(r.label)
        + (r.rating ? ' <span class="aro3di-dim">' + esc(r.rating) + '</span>' : '')
        + (r.detail ? '<br><span class="aro3di-dim">' + esc(r.detail) + '</span>' : '')
        + '</td><td>' + esc(r.size) + '</td><td>'
        + (r.unit === 'm' ? f(r.qty, 2) + ' m' : Math.round(r.qty) + ' ' + esc(r.unit))
        + '</td><td>' + esc(r.material) + '</td></tr>';
    });
    p.bomBox.innerHTML = h + '</table>';
  }

  /* ── Isometric, generated from the 3D route ────────────────────────────
     Not a screenshot. The walked centreline is projected on the standard
     piping-isometric axes — horizontals at 30 degrees, verticals vertical —
     and the components are annotated along it. */
  function isometricSvg(id) {
    var p = PANELS[id], def = REG[id];
    if (!p || !p.asm || !window.ARODWG) return null;
    if (!isCalc(id) || calcState(id) === OUTDATED) return null;
    var K = window.ARODWG.K, route = p.asm.route();
    if (route.length < 2) return null;
    var W = 980, H = 700;

    /* isometric projection: x and z go out at 30 degrees, y stays vertical */
    var c30 = Math.cos(Math.PI / 6), s30 = Math.sin(Math.PI / 6);
    function proj(v) { return { x: (v.x - v.z) * c30, y: (v.x + v.z) * s30 - v.y }; }
    var pts = route.map(proj);
    var minX = Math.min.apply(null, pts.map(function (q) { return q.x; }));
    var maxX = Math.max.apply(null, pts.map(function (q) { return q.x; }));
    var minY = Math.min.apply(null, pts.map(function (q) { return q.y; }));
    var maxY = Math.max.apply(null, pts.map(function (q) { return q.y; }));
    var sc = Math.min(560 / Math.max(0.01, maxX - minX), 300 / Math.max(0.01, maxY - minY));
    var ox = 90 - minX * sc, oy = 150 - minY * sc;
    function P(q) { return { x: ox + q.x * sc, y: oy + q.y * sc }; }
    var sp = pts.map(P);

    var body = '';
    /* the run */
    body += K.path('M' + sp.map(function (q) { return q.x + ' ' + q.y; }).join(' L'),
      { stroke: K.INK, w: 3.2 });
    body += K.path('M' + sp.map(function (q) { return q.x + ' ' + q.y; }).join(' L'),
      { stroke: '#ffffff', w: 1.1 });

    /* Component ticks and callouts. Several components share a vertex — a
       terminal carries a flange and a gauge — so callouts at the same point
       are merged and then stacked, rather than printed on top of each other. */
    var vi = 0, notes = [];
    p.asm.items.forEach(function (it) {
      if (!it.meta || !it.meta.bom) return;
      if (it.kind === 'PIPE') { vi = Math.min(vi + 1, sp.length - 1); return; }
      var a = sp[Math.min(vi, sp.length - 1)];
      if (it.kind === 'ELBOW') vi = Math.min(vi + 1, sp.length - 1);
      if (it.kind === 'SUPPORT') return;             /* on the take-off, not the route */
      notes.push({ at: a, label: (it.meta.label || it.kind) + (it.meta.tag ? ' ' + it.meta.tag : '') });
    });
    /* merge by vertex, then by text */
    var groups = {};
    notes.forEach(function (nt) {
      var key = Math.round(nt.at.x / 26) + ':' + Math.round(nt.at.y / 26);
      if (!groups[key]) groups[key] = { at: nt.at, items: {} };
      groups[key].items[nt.label] = (groups[key].items[nt.label] || 0) + 1;
    });
    Object.keys(groups).slice(0, 10).forEach(function (key, gi) {
      var grp2 = groups[key];
      var texts = Object.keys(grp2.items).map(function (t) {
        return (grp2.items[t] > 1 ? grp2.items[t] + ' \u00d7 ' : '') + t;
      });
      var side = gi % 2 === 0 ? -1 : 1;
      /* flip the callout inward rather than letting it run off the sheet */
      if (grp2.at.x + side * 54 < 96) side = 1;
      if (grp2.at.x + side * 54 > W - 210) side = -1;
      var lx = Math.max(96, Math.min(W - 210, grp2.at.x + side * 54));
      var ly = Math.max(78, grp2.at.y - 40 - (gi % 3) * 22);
      body += K.circle(grp2.at.x, grp2.at.y, 3.6, { fill: K.INK, stroke: 'none', w: 0 });
      body += K.line(grp2.at.x, grp2.at.y, lx, ly, { stroke: K.THIN, w: 0.7 });
      texts.slice(0, 3).forEach(function (t, ti) {
        body += K.txt(lx + (side < 0 ? -4 : 4), ly - 2 + ti * 11, t,
          { size: 7.5, anchor: side < 0 ? 'end' : 'start' });
      });
    });

    /* north arrow and the isometric axis key */
    var kx = 806, ky = 128;
    body += K.txt(kx, ky - 34, 'ISOMETRIC AXES', { size: 8, weight: 'bold' });
    body += K.line(kx, ky, kx + 42 * c30, ky + 42 * s30, { stroke: K.INK, w: 1.2 });
    body += K.line(kx, ky, kx - 42 * c30, ky + 42 * s30, { stroke: K.INK, w: 1.2 });
    body += K.line(kx, ky, kx, ky - 42, { stroke: K.INK, w: 1.2 });
    body += K.txt(kx + 46 * c30, ky + 46 * s30 + 4, 'E', { size: 8 });
    body += K.txt(kx - 54 * c30, ky + 46 * s30 + 4, 'N', { size: 8 });
    body += K.txt(kx + 4, ky - 46, 'UP', { size: 8 });

    /* flow direction on the first leg, from the process, not from the drawing */
    if (sp.length > 1) {
      var m0 = { x: (sp[0].x + sp[1].x) / 2, y: (sp[0].y + sp[1].y) / 2 };
      body += K.txt(m0.x, m0.y + 22, 'FLOW \u25b6', { size: 9, weight: 'bold', anchor: 'middle' });
    }
    body += K.txt(sp[0].x - 26, sp[0].y + 4, 'P1', { size: 10, weight: 'bold', anchor: 'end' });
    body += K.txt(sp[sp.length - 1].x + 8, sp[sp.length - 1].y + 4, 'P2', { size: 10, weight: 'bold' });

    /* material take-off on the sheet, the same list the BOM panel shows */
    var rows = bomRows(id) || [];
    var bx = 60, by = 452;
    body += K.rect(bx, by, 860, 24 + Math.min(rows.length, 9) * 17, { stroke: K.INK, w: 0.9, fill: '#ffffff' });
    body += K.txt(bx + 8, by + 16, 'MATERIAL TAKE-OFF', { size: 9, weight: 'bold' });
    body += K.line(bx, by + 22, bx + 860, by + 22, { stroke: K.FAINT, w: 0.5 });
    rows.slice(0, 9).forEach(function (r, i) {
      var yy = by + 36 + i * 17;
      body += K.txt(bx + 8, yy, String(i + 1).padStart(2, '0'), { size: 8, fill: K.THIN });
      body += K.txt(bx + 40, yy, r.label + (r.rating ? '  ' + r.rating : ''), { size: 8.5 });
      body += K.txt(bx + 470, yy, r.size, { size: 8.5 });
      body += K.txt(bx + 640, yy, r.unit === 'm' ? f(r.qty, 2) + ' m' : Math.round(r.qty) + ' ' + r.unit,
        { size: 8.5, weight: 'bold' });
      body += K.txt(bx + 730, yy, r.material, { size: 8, fill: K.THIN });
    });
    if (rows.length > 9) {
      body += K.txt(bx + 40, by + 36 + 9 * 17, '+ ' + (rows.length - 9) + ' further item(s)',
        { size: 8, fill: K.THIN });
    }

    var d = p.lastData || {};
    var block = window.ARODWG.blockFor
      ? window.ARODWG.blockFor(id, [['GENERATED FROM', '3D MODEL ROUTE']]) : [];
    return window.ARODWG.sheet({
      w: W, h: H, block: block,
      title: (def.title || '') + ' \u2014 PIPING ISOMETRIC',
      subtitle: d.ok ? isoSubtitle(d, route) : '',
    }, function () { return body; });
  }

  /* A single NPS/SCH belongs to a LINE \u2014 one bore end to end. A pump is not
     a line: it has a suction spool and a discharge spool at two different
     sizes, and no schedule at all (a nozzle is picked by size, not wall
     thickness). Printing d.nps/d.sch for a module that never set them wrote
     the string "undefined" straight onto the sheet:

         NPS undefined\u2033 SCH undefined  \u00b7  \u2014 m RUN  \u00b7  \u2014 m/s

     This reads the module's own shape instead of assuming the line-sizing
     one. Route length and velocity, which every module's route can supply,
     are computed here rather than trusted from d \u2014 a pump's data() never
     published a single d.L either. */
  function isoSubtitle(d, route) {
    var L = 0;
    for (var i = 1; i < route.length; i++) L += route[i].distanceTo(route[i - 1]);
    var parts = [];
    if (d.nps != null) {
      parts.push('NPS ' + npsNum(d.nps) + '\u2033' + (d.sch != null ? ' SCH ' + d.sch : ''));
    } else if (d.sucNps != null || d.disNps != null) {
      var sizes = [];
      if (d.sucNps != null) sizes.push('SUCTION NPS ' + npsNum(d.sucNps) + '\u2033');
      if (d.disNps != null) sizes.push('DISCHARGE NPS ' + npsNum(d.disNps) + '\u2033');
      parts.push(sizes.join(' \u00b7 '));
    }
    parts.push(f(L, 2) + ' m RUN');
    var V = isFinite(d.V) ? d.V : (isFinite(d.vd) ? d.vd : d.vs);
    if (isFinite(V)) parts.push(f(V, 2) + ' m/s');
    parts.push('PROJECTED FROM THE 3D ROUTE');
    return parts.join('  \u00b7  ');
  }

  function openIsometric(id) {
    var svg = isometricSvg(id);
    if (!svg) {
      alert('The isometric is generated from the 3D route, so it needs a current calculation. '
        + 'Run the calculation, then generate it again.');
      return;
    }
    var stem = (window.ARODWG.stem ? window.ARODWG.stem(id) : id) + '_ISOMETRIC';
    window.ARODWG.showSvg(svg, stem,
      'PIPING ISOMETRIC — ' + ((REG[id] || {}).title || id) + ' — GENERATED FROM THE 3D ROUTE');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* SNAPSHOT captures WHAT IS ON SCREEN. It used to render the industrial
     viewport and nothing else, so pressing it while ANALYTICAL was showing
     saved a picture of the other view — or, in a module with no industrial
     assembly, saved nothing at all and said nothing about it.

     A WebGL canvas is cleared once it has been presented unless it was made
     with preserveDrawingBuffer, so BOTH paths render one more frame
     immediately before reading the pixels. That single re-render is the
     whole reason this cannot just call toDataURL on whatever canvas is
     visible.

     The two rigs name their parts differently — the module libraries use
     {scene, cam, rn} and the older scenes in app.js use
     {scene, camera, renderer} — so each is read by both names. */
  function grabLegacy(id) {
    var g = legacyOf(id);
    if (!g) return null;
    var rn = g.rn || g.renderer;
    var cam = g.cam || g.camera;
    if (!rn || !cam || !g.scene) return null;
    try {
      rn.render(g.scene, cam);
      var el = rn.domElement || g.canvas;
      return el ? el.toDataURL('image/png') : null;
    } catch (e) { return null; }
  }

  function save(url, name) {
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function snapshot(id) {
    var p = PANELS[id];
    if (!p) return;
    var ana = p.mode === 'ana';
    if (ana) {
      var lurl = grabLegacy(id);
      if (lurl) { save(lurl, 'AROGARA_' + id.toUpperCase() + '_ANALYTICAL_3D.png'); return; }
      /* Say so rather than quietly handing over the industrial picture
         under an analytical name. */
      alert('The analytical view for this module has not drawn yet, so there is nothing to capture. '
        + 'Run the calculation, let the picture appear, then press SNAPSHOT again.');
      return;
    }
    if (!p.vp) return;
    try {
      p.vp.syncOrtho();
      p.vp.renderer.render(p.vp.scene, p.vp.live());
      save(p.vp.renderer.domElement.toDataURL('image/png'),
           'AROGARA_' + id.toUpperCase() + '_INDUSTRIAL_3D.png');
    } catch (e) {}
  }

  /* ── Wiring ─────────────────────────────────────────────────────────────── */
  var pending = null;
  /* Only the panel the engineer is actually looking at is rebuilt. Mounting
     is still attempted for the rest — a panel has to exist before it can be
     seen — but a build on a zero-width canvas returns before it reads a
     single input, so nine hidden modules cost nothing. */
  function refreshAll(force) {
    Object.keys(REG).forEach(function (id) {
      var p = PANELS[id];
      if (!p) { p = mount(id); if (!p) return; }
      if (p.mode !== 'ind') return;
      if (!p.canvas.clientWidth) return;
      build(id, force);
    });
  }
  /* Typing is not a design change until the engineer stops typing. A short
     debounce meant one full model rebuild per keystroke — measured at 230 ms
     each, which is what the stutter was. Edits wait half a second; clicks,
     which rarely change the signature, are answered quickly. */
  var pendingForce = false;
  function schedule(force, delay) {
    pendingForce = pendingForce || !!force;
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () {
      pending = null;
      var f = pendingForce; pendingForce = false;
      refreshAll(f);
    }, delay == null ? 220 : delay);
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
    document.addEventListener('click', function () { schedule(false, 180); }, true);
    window.addEventListener('resize', function () { schedule(false, 300); });
    /* Only a form control can change the design. Ignoring everything else
       keeps a stray keypress or a contenteditable note from queuing a
       rebuild of the model. */
    function edited(e) {
      var t = e.target;
      if (!t || !t.tagName) return;
      var tag = t.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
      schedule(false, 520);
    }
    document.addEventListener('input', edited, true);
    document.addEventListener('change', edited, true);
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
      p.vp.syncOrtho();
      p.vp.renderer.render(p.vp.scene, p.vp.live());
      return p.vp.renderer.domElement.toDataURL('image/png');
    } catch (e) { return null; }
  }

  /* Re-ground every open viewport when the theme changes, and redraw so the
     new ground reaches the screen without waiting for the next interaction. */
  function applyTheme() {
    var bg = sceneBg();
    Object.keys(PANELS).forEach(function (id) {
      var p = PANELS[id];
      if (!p || !p.vp) return;
      try {
        p.vp.scene.background = new T.Color(bg);
        p.sig = null;                 /* the grid colour is baked into the model */
        build(id, true);
      } catch (e) {}
    });
    themeLegacyScenes(bg);
  }

  /* ── THE ANALYTICAL SCENES FOLLOW THE THEME TOO ────────────────────────
     Only the INDUSTRIAL viewport was repainted when the theme changed.
     Every module's own scene — the one ANALYTICAL actually shows — had its
     background written once, as a literal, at the moment it was built:
     0x0b1220 in the line-sizing services, the plate exchanger and the tank,
     and its own dark value in the pump and the exchangers in app.js. Switch
     the desktop to light and those windows stayed night-black in the middle
     of a white page.

     They are all reachable now, because each module hands its scene over for
     the VIEW buttons. The same registry repaints them. Only the ground
     changes: steel reads as steel on either background, so no material is
     touched. */
  function themeLegacyScenes(bg, only) {
    /* T is only warmed by three() the first time some other code path calls
       it — checking the raw variable here meant this whole function silently
       no-opped whenever it ran before that first warm-up, which is exactly
       what happens on a fresh page load: a legacy scene builds and calls
       this to sync itself to the theme before anything else has ever
       touched T. THREE itself is on window well before this file can do
       anything 3D-related, so lazily warm it the same way three() does. */
    if (!T && typeof THREE !== 'undefined') T = THREE;
    if (!T) return;
    var day = false;
    try { day = !!(document.body && document.body.classList.contains('theme-day')); } catch (e) {}
    (only ? [only] : Object.keys(LEGACY)).forEach(function (id) {
      var g = legacyOf(id);
      if (!g || !g.scene) return;
      try {
        g.scene.background = new T.Color(bg);
        /* a floor grid drawn for a dark room is invisible on a light one */
        var gridHex = day ? 0xb9c3cd : 0x333c46;
        var deckHex = day ? 0xdde3e8 : null;   /* null = restore the mesh's own dark colour */
        g.scene.traverse(function (o) {
          if (o && o.isGridHelper && o.material) {
            [].concat(o.material).forEach(function (m) {
              if (m && m.color && m.color.setHex) m.color.setHex(gridHex);
            });
          }
          /* the plant-grade / factory-floor plane: tagged at build time in
             app.js (pump, line-sizing, STHE) — its own colour never followed
             the theme, so the equipment stood on a near-black slab even
             with the rest of the room turned to daylight. */
          if (o && o.name === 'aro-grade-plane' && o.material && o.material.color && o.material.color.setHex) {
            var base = (o.userData && isFinite(o.userData.aroBaseColor)) ? o.userData.aroBaseColor : o.material.color.getHex();
            o.material.color.setHex(deckHex == null ? base : deckHex);
          }
        });
        /* redraw now rather than waiting for the next interaction */
        var cam = g.camera || g.cam, rn = g.renderer || g.rn;
        if (rn && cam) rn.render(g.scene, cam);
      } catch (e) {}
    });
  }
  try {
    var mo = new MutationObserver(function (m) {
      for (var i = 0; i < m.length; i++) {
        if (m[i].attributeName === 'class') { applyTheme(); return; }
      }
    });
    if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    else document.addEventListener('DOMContentLoaded', function () {
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });
  } catch (e) {}

  window.ARO3DI = {
    register: register,
    applyTheme: applyTheme,
    snapshot: snapshotDataUrl,
    /* the report reads these; both refuse unless the module is current */
    bom: bomRows,
    isometric: isometricSvg,
    title: function (id) { return REG[id] ? REG[id].title : ''; },
    refresh: function (id) { if (id) build(id, true); else refreshAll(true); },
    mount: mount,
    /* Used by a module's RESET so the picture goes when the design does. */
    clear: function (id) {
      if (id) showEmpty(id);
      else Object.keys(PANELS).forEach(showEmpty);
    },
    setMode: setMode,
    /* A module hands over its own 3D scene so the VIEW buttons can turn it
       when ANALYTICAL is the picture on screen. */
    registerLegacy: registerLegacy,
    legacy: legacyOf,
    view: function (id, which) { camera(id, which); },
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
