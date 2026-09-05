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
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      this._ambient = new THREE.AmbientLight(p0.ambientLight, p0.ambientIntensity);
      this.scene.add(this._ambient);
      var key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(2, 3, 2);
      this.scene.add(key);
      var rim = new THREE.PointLight(0x38bdf8, 0.6);
      rim.position.set(-2, -1, -2);
      this.scene.add(rim);

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

      // hub
      var hubMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(layout.r1 * 0.9, layout.r1 * 0.9, hubHeight, 32), hubMat);
      this.group.add(hub);

      // eye ring (inlet, r1) and OD ring (outlet, r2) — wireframe references
      [layout.r1, layout.r2].forEach(function (r, idx) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.006, 8, 64),
          new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x38bdf8 : 0xf59e0b }));
        ring.rotation.x = Math.PI / 2;
        self.group.add(ring);
      });

      // vanes — extrude a thin blade shape along the curve
      var vaneMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide });
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
        var geo = new THREE.ExtrudeGeometry(shape, { depth: hubHeight, bevelEnabled: false });
        geo.rotateX(Math.PI / 2);
        geo.translate(0, -hubHeight / 2, 0);
        var mesh = new THREE.Mesh(geo, vaneMat);
        self.group.add(mesh);
      });

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
