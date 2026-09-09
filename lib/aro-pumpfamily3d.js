/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Procedural 3D Digital Twin for the PD full-track pump
   families (Pump build Step 8, part B)
   window.AROPUMPFAMILY3D

   The existing 3D infrastructure (aro-pumpimpeller3d.js's parametric
   impeller, aro-pumptwin.js's assembled digital twin) both model a
   centrifugal machine — casing, impeller disc, shaft, bearings — which
   already covers a submersible too, since a submersible IS a
   centrifugal pump. This file is the non-centrifugal counterpart: one
   THREE.js Viewer, built with the exact same scene/camera/lighting/
   CustomOrbitControls/singleton/dispose pattern every other 3D viewer
   in this app uses, whose buildAssembly(familyId, params) switches on
   which of the four non-centrifugal families to build:
     - 'screw'    — N parallel rotor cylinders in a barrel casing
     - 'gearlobe' — two meshing rotors (or one inside another, for the
                    internal-gear row) in a compact casing
     - 'hose'     — a torus standing in for the hose loop, with a rotor
                    disc and roller spheres, inside an open casing shell
     - 'recip'    — a crankcase box + crank cylinder + rod line + a
                    fluid-end cylinder with the plunger/piston inside it

   Proportions are illustrative and parametrised from that family's own
   calculated geometry (rotor OD, bore, stroke, etc.) — schematic, not a
   manufacturing layout, the same explicit framing aro-pumptwin.js
   already carries for its own assembly.

   API
     AROPUMPFAMILY3D.Viewer (browser only, requires window.THREE)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined' || !window.THREE) return;
  var THREE = window.THREE;

  function themePalette() {
    return (window.AROVIZTHEME && window.AROVIZTHEME.palette) ? window.AROVIZTHEME.palette() : { bgHex: 0x050810, ambientLight: 0x8899aa, ambientIntensity: 0.65 };
  }
  function mat(color) { return new THREE.MeshStandardMaterial({ color: color, metalness: 0.55, roughness: 0.4 }); }

  function Viewer(canvas) {
    var self = this;
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    var p0 = themePalette();
    this.scene.background = new THREE.Color(p0.bgHex);
    this.camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.01, 50);
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    if (THREE.PCFSoftShadowMap) this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this._ambient = new THREE.HemisphereLight(0xeef2ff, 0x11141c, p0.ambientIntensity * 0.85);
    this.scene.add(this._ambient);
    var key = new THREE.DirectionalLight(0xfff4e0, 1.15);
    key.position.set(2.2, 3.2, 1.8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0015;
    this.scene.add(key);
    var fill = new THREE.DirectionalLight(0xcfe0ff, 0.4);
    fill.position.set(-2.4, 0.9, -1.2);
    this.scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffffff, 0.55);
    rim.position.set(-1.2, 2.4, -2.6);
    this.scene.add(rim);

    var floorMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    this._floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
    this._floor.rotation.x = -Math.PI / 2;
    this._floor.position.y = -0.5;
    this._floor.receiveShadow = true;
    this.scene.add(this._floor);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._raf = null;

    this.controls = (typeof CustomOrbitControls === 'function') ? new CustomOrbitControls(this.camera, canvas) : null;
    if (this.controls) { this.controls.autoRotate = true; this.controls.autoRotateSpeed = 0.6; this.controls.enableDamping = true; }

    if (window.AROVIZTHEME && window.AROVIZTHEME.onChange) {
      window.AROVIZTHEME.onChange(function (p) {
        self.scene.background = new THREE.Color(p.bgHex);
        self._ambient.color.setHex(p.ambientLight);
        self._ambient.intensity = p.ambientIntensity;
      });
    }
  }

  Viewer.prototype.resize = function () {
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    }
  };

  function clearGroup(group) {
    while (group.children.length) {
      var c = group.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }
  function addMesh(group, mesh) {
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function fitCamera(camera, controls, extent) {
    var r = Math.max(0.3, extent);
    camera.position.set(r * 1.4, r * 0.9, r * 1.6);
    camera.lookAt(0, 0, 0);
    if (controls) {
      controls.updateSphericalFromCamera();
      controls.targetSpherical.radius = controls.spherical.radius;
      controls.targetSpherical.phi = controls.spherical.phi;
      controls.targetSpherical.theta = controls.spherical.theta;
      controls.minDistance = r * 0.4;
      controls.maxDistance = r * 6;
    }
  }

  /* ── buildAssembly(familyId, params) — clears and rebuilds the group.
     params carries the family's own calculated geometry, in mm unless
     noted; scaled here to a 1-2 unit scene, illustrative not exact. */
  Viewer.prototype.buildAssembly = function (familyId, params) {
    params = params || {};
    this.resize();
    clearGroup(this.group);
    var extent = 1;

    if (familyId === 'screw') extent = this._buildScrew(params);
    else if (familyId === 'gearlobe') extent = this._buildGearLobe(params);
    else if (familyId === 'hose') extent = this._buildHose(params);
    else if (familyId === 'recip') extent = this._buildRecip(params);

    fitCamera(this.camera, this.controls, extent);
  };

  /* rotorOD_mm, effectiveLength_mm, rotors (1-3), timingGears (bool) */
  Viewer.prototype._buildScrew = function (p) {
    var od = Math.max(0.15, (p.rotorOD_mm || 50) / 200);
    var len = Math.max(0.6, (p.effectiveLength_mm || 200) / 200);
    var n = p.rotors || 1;
    var gap = od * 0.35;
    var casH = n * (od + gap) + gap;

    addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(casH / 1.7, casH / 1.7, len * 1.06, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })))
      .rotation.z = Math.PI / 2;

    for (var i = 0; i < n; i++) {
      var y = (i - (n - 1) / 2) * (od + gap);
      var rotor = addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(od / 2, od / 2, len, 20), mat(0xcbd5e1)));
      rotor.rotation.z = Math.PI / 2;
      rotor.position.set(0, y, 0);
    }
    if (p.timingGears) {
      var gx = len / 2 + od * 0.5;
      addMesh(this.group, new THREE.Mesh(new THREE.BoxGeometry(od * 0.6, casH, casH * 0.7), mat(0x334155))).position.set(gx, 0, 0);
    }
    return Math.max(len, casH) * 1.1;
  };

  /* OD_mm, faceWidth_mm, pumpTypeId */
  Viewer.prototype._buildGearLobe = function (p) {
    var r = Math.max(0.15, (p.OD_mm || 60) / 130);
    var w = Math.max(0.15, (p.faceWidth_mm || 30) / 130);

    addMesh(this.group, new THREE.Mesh(new THREE.BoxGeometry(r * 4.2, r * 2.6, w * 1.3),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.5, roughness: 0.5, transparent: true, opacity: 0.35 })));

    if (p.pumpTypeId === 'gear-internal') {
      addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28), mat(0xe2e8f0))).rotation.x = Math.PI / 2;
      var inner = addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w * 1.02, 24), mat(0x94a3b8)));
      inner.rotation.x = Math.PI / 2; inner.position.set(r * 0.32, 0, 0);
    } else {
      [-1, 1].forEach(function (s) {
        var rot = addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w, 24), mat(0xcbd5e1)));
        rot.rotation.x = Math.PI / 2; rot.position.set(s * r * 0.62, 0, 0);
      }, this);
    }
    return r * 3.5;
  };

  /* rollerCount, bore_mm (unused for scale — kept simple/schematic) */
  Viewer.prototype._buildHose = function (p) {
    var R = 1.0;
    addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.5, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })))
      .rotation.x = Math.PI / 2;
    addMesh(this.group, new THREE.Mesh(new THREE.TorusGeometry(R * 0.78, 0.09, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.2, roughness: 0.7 })));
    addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 16), mat(0x94a3b8))).rotation.x = Math.PI / 2;
    var n = p.rollerCount || 2;
    for (var i = 0; i < n; i++) {
      var th = (i * 2 * Math.PI / n) - Math.PI / 2;
      var rx = (R * 0.55) * Math.cos(th), rz = (R * 0.55) * Math.sin(th);
      addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 16), mat(0xe2e8f0)))
        .position.set(rx, 0, rz);
    }
    return R * 2.4;
  };

  /* bore_mm, stroke_mm, sealType ('packing'|'ring-cup') */
  Viewer.prototype._buildRecip = function (p) {
    var bore = Math.max(0.12, (p.bore_mm || 60) / 150);
    var stroke = Math.max(0.2, (p.stroke_mm || 80) / 150);

    // crankcase
    addMesh(this.group, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(0x334155))).position.set(-0.9, 0, 0);
    addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 20), mat(0x94a3b8)))
      .rotation.x = Math.PI / 2;
    // rod
    var rodMesh = addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), mat(0xcbd5e1)));
    rodMesh.rotation.z = Math.PI / 2; rodMesh.position.set(-0.5, 0, 0);
    // fluid-end cylinder
    var cylLen = stroke + bore * 1.5;
    addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(bore, bore, cylLen, 24),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.5, roughness: 0.5, transparent: true, opacity: 0.35 })))
      .rotation.z = Math.PI / 2;
    addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(bore * 0.55, bore * 0.55, cylLen * 0.4, 20),
      mat(p.sealType === 'ring-cup' ? 0xe2e8f0 : 0xcbd5e1)))
      .rotation.z = Math.PI / 2;
    var glandColor = p.sealType === 'packing' ? 0xf59e0b : 0x64748b;
    addMesh(this.group, new THREE.Mesh(new THREE.CylinderGeometry(bore * 0.7, bore * 0.7, bore * 0.4, 20), mat(glandColor)))
      .rotation.z = Math.PI / 2;

    this.group.position.x = 0.5;
    return (1.4 + cylLen) * 0.7;
  };

  Viewer.prototype.start = function () {
    var self = this;
    function tick() {
      self._raf = requestAnimationFrame(tick);
      /* Idle while the canvas is off screen — see lib/aro-raf.js. This
         viewer predates that gate and never got wired to it, so it kept
         doing a resize() layout read plus a full render() every frame
         forever, even scrolled miles away. */
      if (window.AROVIS && !window.AROVIS.visible(self.canvas)) return;
      self.resize();
      if (self.controls) self.controls.update();
      self.renderer.render(self.scene, self.camera);
    }
    if (!this._raf) tick();
  };

  Viewer.prototype.dispose = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.renderer.dispose();
  };

  window.AROPUMPFAMILY3D = { Viewer: Viewer };
})();
