/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Parametric Impeller 3D Viewer
   window.AROPUMPIMPELLER3D

   Phase 5b of the Pump Hydraulics Advanced Upgrade. This file is split
   in two, deliberately:

     1. computeBladeLayout(...) — pure geometry math, no THREE.js and no
        DOM. Loadable and unit-testable in Node exactly like the other
        pump engines (`global.window = global`). This is the part that
        can be wrong in a way a test can catch.

     2. Viewer — a thin THREE.js scene builder that turns a layout from
        part 1 into meshes on a <canvas>. This half only runs in a real
        browser (it touches `THREE`, `document`, WebGL) and is verified
        visually, the same way the rest of the app's 3D work is.

   GEOMETRY MODEL
   Each vane is modelled as a logarithmic-spiral blade — the standard
   first-pass centrifugal-impeller blade curve when the blade angle β is
   held constant along its length: for a curve r(φ) = r1·exp(φ/tanβ),
   the local angle between the tangent and the radial direction is
   exactly β everywhere. Given the inlet/outlet radii (r1, r2) from
   AROPUMPIMPELLER's eye ratio and D2, and the exit angle β2 from its
   Euler-triangle result, this fixes the blade's total wrap angle:
       φ_wrap = tanβ2 · ln(r2 / r1)
   vaneCount blades are then spaced evenly around the hub.

   THIS IS A SCHEMATIC, NOT A MANUFACTURING DRAWING. β is held constant
   along the whole blade (real impellers usually vary β1→β2 for
   incidence-free entry) and every dimension traces back to Phase 4's
   typical-range coefficients, not a vendor design — the viewer panel
   says so.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── computeBladeLayout: pure geometry, unit-testable ─────────────── */
  function computeBladeLayout(input) {
    input = input || {};
    var vaneCount = Math.round(input.vaneCount);
    var r1 = input.D1_m / 2, r2 = input.D2_m / 2;
    var beta2Deg = input.beta2Deg;
    var samples = (input.samples == null || !isFinite(input.samples) || input.samples < 2) ? 16 : Math.round(input.samples);

    if (!isFinite(vaneCount) || vaneCount < 2 || !isFinite(r1) || !isFinite(r2) || r1 <= 0 || r2 <= r1
      || !isFinite(beta2Deg) || beta2Deg <= 0 || beta2Deg >= 90) {
      return { valid: false, reason: 'Invalid geometry inputs — need vaneCount >= 2, 0 < D1 < D2, and 0 < beta2 < 90 deg.' };
    }

    var beta2Rad = beta2Deg * Math.PI / 180;
    var tanBeta = Math.tan(beta2Rad);
    var phiWrapRad = tanBeta * Math.log(r2 / r1);

    var blades = [];
    for (var i = 0; i < vaneCount; i++) {
      var angle0 = i * (2 * Math.PI / vaneCount);
      var points = [];
      for (var s = 0; s <= samples; s++) {
        var phi = (s / samples) * phiWrapRad;
        var r = r1 * Math.exp(phi / tanBeta);
        var theta = angle0 + phi;
        points.push({ r: r, phi: phi, theta: theta, x: r * Math.cos(theta), y: r * Math.sin(theta) });
      }
      blades.push({ angle0: angle0, points: points });
    }

    return { valid: true, vaneCount: vaneCount, r1: r1, r2: r2, beta2Deg: beta2Deg, phiWrapRad: phiWrapRad, blades: blades };
  }

  var AROPUMPIMPELLER3D = { computeBladeLayout: computeBladeLayout };

  /* ── Viewer: THREE.js scene builder — browser only ────────────────── */
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.THREE) {
    var THREE = window.THREE;

    function themePalette() {
      return (window.AROVIZTHEME && window.AROVIZTHEME.palette) ? window.AROVIZTHEME.palette() : { bgHex: 0x050810, ambientLight: 0x8899aa, ambientIntensity: 0.6 };
    }

    function Viewer(canvas) {
      var self = this;
      this.canvas = canvas;
      this.scene = new THREE.Scene();
      var p0 = themePalette();
      this.scene.background = new THREE.Color(p0.bgHex);
      this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.01, 50);
      this.camera.position.set(0.35, 0.30, 0.42);
      this.camera.lookAt(0, 0, 0);
      /* preserveDrawingBuffer so the report's canvas.toDataURL() capture
         (app.js's pumpChartsHTML()) can read a real frame even though it
         runs on a report-button click, not synchronously after a render -
         without it the browser is free to clear the buffer right after
         compositing each animation frame. */
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      /* Flat-lit MeshStandardMaterial under two plain lights is what reads
         as "animated cartoon" - a proper 3-point rig (key/fill/rim) with
         a hemisphere fill gives PBR metals something real to reflect.
         (physicallyCorrectLights/ACES tonemapping were tried here too, but
         this bundled THREE revision's physically-correct light falloff
         needs candela-scale intensities to look right at metre scale and
         at the tuned values below rendered the scene essentially black -
         staying on the classic light model keeps this predictable.) */
      this.renderer.shadowMap.enabled = true;
      if (THREE.PCFSoftShadowMap) this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this._ambient = new THREE.HemisphereLight(0xeef2ff, 0x11141c, 0.65);
      this.scene.add(this._ambient);
      var key = new THREE.DirectionalLight(0xfff4e0, 1.1);
      key.position.set(2.2, 3.2, 1.6);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0015;
      this.scene.add(key);
      var fill = new THREE.DirectionalLight(0xcfe0ff, 0.45);
      fill.position.set(-2.4, 0.8, -1.2);
      this.scene.add(fill);
      var rim = new THREE.DirectionalLight(0xffffff, 0.6);
      rim.position.set(-1, 2.6, -2.6);
      this.scene.add(rim);

      // a plain shadow-catcher floor makes the part read as a physical
      // object sitting somewhere, rather than a shape floating in a void
      var floorMat = new THREE.ShadowMaterial({ opacity: 0.28 });
      this._floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), floorMat);
      this._floor.rotation.x = -Math.PI / 2;
      this._floor.receiveShadow = true;
      this.scene.add(this._floor);

      this.group = new THREE.Group();
      this.scene.add(this.group);

      this._raf = null;

      /* 360° drag-to-orbit + scroll/pinch-to-zoom, using the same
         CustomOrbitControls class app.js already built and wired up for
         the pre-existing 3D loop simulation — reused here rather than a
         second implementation of the same mouse/touch/wheel math. */
      this.controls = (typeof CustomOrbitControls === 'function') ? new CustomOrbitControls(this.camera, canvas) : null;
      if (this.controls) {
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 1.1;
        this.controls.enableDamping = true;
      }

      if (window.AROVIZTHEME && window.AROVIZTHEME.onChange) {
        window.AROVIZTHEME.onChange(function (p) {
          self.scene.background = new THREE.Color(p.bgHex);
          self._ambient.color.setHex(p.ambientLight);
          self._ambient.intensity = p.ambientIntensity;
        });
      }
    }

    Viewer.prototype.resize = function () {
      // The canvas can still be at display:none (zero clientWidth/Height)
      // the first time the Viewer is constructed — mid-calculation, before
      // the results panel has switched out of its "not calculated" state —
      // which would otherwise wedge the WebGL drawing buffer at 1x1
      // forever. Re-syncing on every setGeometry() call is cheap and self-
      // heals once the canvas actually has a real size.
      var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
      }
    };

    Viewer.prototype.setGeometry = function (layout, opts) {
      var self = this;
      opts = opts || {};
      this.resize();
      while (this.group.children.length) {
        var c = this.group.children.pop();
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      }
      if (!layout || !layout.valid) return;

      var thickness = opts.thickness_m || Math.max(0.003, layout.r2 * 0.03);
      var hubHeight = opts.hubHeight_m || thickness * 2.2;
      var backplateH = hubHeight * 0.35;
      var backplateY = -hubHeight / 2 - backplateH / 2;

      /* Real semi-open impellers (the common case this schematic models)
         are vanes cast onto a solid backplate disk, with the hub/shaft
         boss rising from its centre - not bare blades cantilevered off a
         thin cylinder with nothing under them, which is what made this
         read as a toy rather than a machined part. Cast-iron/steel grey
         PBR materials (high metalness, low roughness) replace the flat
         saturated pink/blue/orange so the 3-point light rig above actually
         has something to put a real highlight and shadow on. */
      var metalMat = new THREE.MeshStandardMaterial({ color: 0x8b93a0, metalness: 0.82, roughness: 0.32 });
      var hubMat = new THREE.MeshStandardMaterial({ color: 0x565d68, metalness: 0.75, roughness: 0.38 });

      var backplate = new THREE.Mesh(new THREE.CylinderGeometry(layout.r2 * 1.03, layout.r2 * 1.03, backplateH, 64), hubMat);
      backplate.position.y = backplateY;
      backplate.castShadow = true; backplate.receiveShadow = true;
      this.group.add(backplate);

      // hub / shaft boss, rising from the backplate through the vane height
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(layout.r1 * 0.9, layout.r1 * 0.95, hubHeight + backplateH, 32), hubMat);
      hub.position.y = backplateY + backplateH / 2;
      hub.castShadow = true; hub.receiveShadow = true;
      this.group.add(hub);

      // bolt-circle detail on the hub face — a small, cheap touch that
      // reads immediately as "machined part", not extra engineering data
      var boltMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.6, roughness: 0.45 });
      var boltCount = 6, boltR = layout.r1 * 0.65;
      for (var bi = 0; bi < boltCount; bi++) {
        var ba = (bi / boltCount) * Math.PI * 2;
        var bolt = new THREE.Mesh(new THREE.CylinderGeometry(layout.r1 * 0.09, layout.r1 * 0.09, hubHeight * 0.12, 12), boltMat);
        bolt.position.set(boltR * Math.cos(ba), hub.position.y + hubHeight / 2 + 0.001, boltR * Math.sin(ba));
        bolt.castShadow = true;
        this.group.add(bolt);
      }

      // eye ring (inlet, r1) and OD ring (outlet, r2) — thin dimension-line
      // references, not the part itself, so they stay unlit and slim
      [layout.r1, layout.r2].forEach(function (r, idx) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.005, 8, 64),
          new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x38bdf8 : 0xf59e0b, transparent: true, opacity: 0.85 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = backplateY + backplateH / 2 + 0.0005;
        self.group.add(ring);
      });

      // vanes — extrude a thin blade shape along the curve, standing on the backplate
      layout.blades.forEach(function (blade) {
        var shape = new THREE.Shape();
        var pts = blade.points;
        shape.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
        // give the blade a little width by offsetting a parallel curve back
        for (var j = pts.length - 1; j >= 0; j--) {
          var p = pts[j];
          var nx = -Math.sin(p.theta), ny = Math.cos(p.theta);
          shape.lineTo(p.x + nx * thickness, p.y + ny * thickness);
        }
        var geo = new THREE.ExtrudeGeometry(shape, { depth: hubHeight, bevelEnabled: true, bevelThickness: thickness * 0.15, bevelSize: thickness * 0.12, bevelSegments: 2 });
        geo.rotateX(Math.PI / 2);
        geo.translate(0, backplateY + backplateH / 2, 0);
        var mesh = new THREE.Mesh(geo, metalMat);
        mesh.castShadow = true; mesh.receiveShadow = true;
        self.group.add(mesh);
      });

      this._floor.position.y = backplateY - backplateH / 2 - Math.max(0.01, layout.r2 * 0.05);
      this._fitCamera(layout.r2);
    };

    Viewer.prototype._fitCamera = function (r2) {
      var d = Math.max(0.15, r2 * 3.2);
      this.camera.position.set(d * 0.7, d * 0.55, d * 0.8);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        // Re-derive the controls' internal orbit state from the camera
        // position just set, on BOTH the live and target spherical, so the
        // next update() doesn't damp back toward wherever the user last
        // left it — this is a fresh baseline framing for the new geometry.
        this.controls.updateSphericalFromCamera();
        this.controls.targetSpherical.radius = this.controls.spherical.radius;
        this.controls.targetSpherical.phi = this.controls.spherical.phi;
        this.controls.targetSpherical.theta = this.controls.spherical.theta;
        this.controls.minDistance = Math.max(0.02, r2 * 0.3);
        this.controls.maxDistance = Math.max(1, r2 * 14);
      }
    };

    Viewer.prototype.start = function () {
      var self = this;
      function tick() {
        if (self.controls) self.controls.update();
        self.renderer.render(self.scene, self.camera);
        self._raf = requestAnimationFrame(tick);
      }
      if (!this._raf) tick();
    };

    Viewer.prototype.dispose = function () {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      this.renderer.dispose();
    };

    AROPUMPIMPELLER3D.Viewer = Viewer;
  }

  window.AROPUMPIMPELLER3D = AROPUMPIMPELLER3D;
})();
