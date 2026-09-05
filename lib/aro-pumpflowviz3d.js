/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Internal Flow Visualization, 3D / Industrial views
   window.AROPUMPFLOWVIZ3D

   The 2D flow-path diagram (lib/aro-pumpflowviz.js) stays exactly as it
   was — this file adds two more ways to look at the SAME six stations,
   selectable from one workbench, not a replacement:

     '3d'         a schematic 3D flow path: the same six colored segments
                  and moving particles as the 2D diagram, laid out along a
                  pump-shaped curve (suction in, up through the casing,
                  discharge out) instead of a flat line, so direction and
                  the suction->casing->discharge layout read at a glance.
     'industrial' the same path, now threaded through simple opaque casing/
                  pipe hardware rendered with the same real-metal PBR
                  lighting rig as the impeller viewer and digital twin
                  (lib/aro-pumpimpeller3d.js, lib/aro-pumptwin.js), so the
                  flow reads as something moving through an actual machine
                  rather than a floating colored line.

   THIS IS STILL NOT CFD. No flow field is solved here either — same as
   aro-pumpflowviz.js, every color and every particle speed comes from
   window.AROPUMPFLOWVIZ.colorForIntensity() and the station list already
   built by buildFlowStations(); this file only re-lays that data out in
   3D and never recomputes a velocity.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined' || !window.THREE) return;
  var THREE = window.THREE;

  function themePalette() {
    return (window.AROVIZTHEME && window.AROVIZTHEME.palette) ? window.AROVIZTHEME.palette() : { bgHex: 0x050810, ambientLight: 0x8899aa, ambientIntensity: 0.6 };
  }
  function intensityColor(t) {
    var hex = (window.AROPUMPFLOWVIZ ? window.AROPUMPFLOWVIZ.colorForIntensity(t) : '#64748b');
    return new THREE.Color(hex);
  }

  /* One S-shaped curve stands in for "suction pipe -> volute casing ->
     discharge pipe" — proportion-accurate to nothing, just a recognizable
     silhouette to hang the six real velocities on, exactly as schematic
     as the 2D version's flat line. Six evenly-spaced points along it are
     handed out as the station positions, same even-spacing rule the 2D
     canvas uses along X. */
  function buildPathCurve() {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.1, 0.0, 0),
      new THREE.Vector3(-1.15, 0.0, 0),
      new THREE.Vector3(-0.55, 0.0, 0),
      new THREE.Vector3(-0.15, 0.35, 0.28),
      new THREE.Vector3(0.15, 0.85, 0.10),
      new THREE.Vector3(0.55, 1.35, -0.05),
      new THREE.Vector3(1.35, 1.55, -0.05)
    ], false, 'catmullrom', 0.5);
  }

  function Viewer(canvas) {
    var self = this;
    this.canvas = canvas;
    this.mode = 'threeD'; // 'threeD' | 'industrial'
    this.scene = new THREE.Scene();
    var p0 = themePalette();
    this.scene.background = new THREE.Color(p0.bgHex);
    this.camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.01, 50);
    this.camera.position.set(1.6, 1.7, 2.6);
    this.camera.lookAt(-0.3, 0.6, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    if (THREE.PCFSoftShadowMap) this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this._ambient = new THREE.HemisphereLight(0xeef2ff, 0x11141c, p0.ambientIntensity * 0.85);
    this.scene.add(this._ambient);
    var key = new THREE.DirectionalLight(0xfff4e0, 1.15);
    key.position.set(2.2, 3.4, 1.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0015;
    this.scene.add(key);
    var fill = new THREE.DirectionalLight(0xcfe0ff, 0.4);
    fill.position.set(-2.4, 1.0, -1.2);
    this.scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-1, 2.4, -2.4);
    this.scene.add(rim);

    var floorMat = new THREE.ShadowMaterial({ opacity: 0.22 });
    this._floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), floorMat);
    this._floor.rotation.x = -Math.PI / 2;
    this._floor.position.y = -0.55;
    this._floor.receiveShadow = true;
    this.scene.add(this._floor);

    this.curve = buildPathCurve();
    this.hardwareGroup = new THREE.Group();
    this.flowGroup = new THREE.Group();
    this.scene.add(this.hardwareGroup);
    this.scene.add(this.flowGroup);
    this._buildHardware();

    this._stations = [];
    this._particles = [];
    this._t = 0;
    this._raf = null;

    this.controls = (typeof CustomOrbitControls === 'function') ? new CustomOrbitControls(this.camera, canvas) : null;
    if (this.controls) {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.7;
      this.controls.enableDamping = true;
      this.controls.minDistance = 1.2;
      this.controls.maxDistance = 8;
    }

    if (window.AROVIZTHEME && window.AROVIZTHEME.onChange) {
      window.AROVIZTHEME.onChange(function (p) {
        self.scene.background = new THREE.Color(p.bgHex);
        self._ambient.color.setHex(p.ambientLight);
      });
    }
  }

  /* Simple opaque casing/pipe hardware the flow path threads through -
     built once, reused by both modes; only its material opacity/roughness
     (via setMode) changes, never its geometry. */
  Viewer.prototype._buildHardware = function () {
    var metalMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.75, roughness: 0.35 });
    var casingMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.7, roughness: 0.4 });
    this._metalMat = metalMat; this._casingMat = casingMat;

    // suction pipe stub
    var suc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 24), metalMat);
    suc.rotation.z = Math.PI / 2;
    suc.position.set(-1.6, 0, 0);
    suc.castShadow = true; suc.receiveShadow = true;
    this.hardwareGroup.add(suc);

    // volute casing — a squat cylinder around the "impeller" zone of the curve
    var casing = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 40), casingMat);
    casing.rotation.x = Math.PI / 2;
    casing.position.set(-0.35, 0.17, 0.1);
    casing.castShadow = true; casing.receiveShadow = true;
    this.hardwareGroup.add(casing);

    // impeller hint disc, visible through the casing at low opacity
    var impMat = new THREE.MeshStandardMaterial({ color: 0xa87b46, metalness: 0.7, roughness: 0.35, transparent: true, opacity: 0.85 });
    var imp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 28), impMat);
    imp.rotation.x = Math.PI / 2;
    imp.position.set(-0.35, 0.17, 0.1);
    imp.castShadow = true;
    this.hardwareGroup.add(imp);
    this._impellerMesh = imp;

    // discharge pipe stub
    var dis = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 24), metalMat);
    dis.rotation.z = Math.PI / 2 - 0.35;
    dis.position.set(1.15, 1.45, -0.05);
    dis.castShadow = true; dis.receiveShadow = true;
    this.hardwareGroup.add(dis);

    // baseplate
    var base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 1.0), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.5 }));
    base.position.set(-0.3, -0.5, 0);
    base.receiveShadow = true;
    this.hardwareGroup.add(base);
  };

  /* 'threeD': hardware translucent/dim so the colored flow path is the
     subject, brighter flat-ish lighting. 'industrial': hardware opaque
     and fully shaded/shadowed like a real machine, flow path thinner and
     more subdued so it reads as an overlay on the real part, not a toy
     tube floating over it. */
  Viewer.prototype.setMode = function (mode) {
    this.mode = mode;
    var industrial = mode === 'industrial';
    this.hardwareGroup.children.forEach(function (mesh) {
      if (!mesh.material) return;
      if (mesh === this._impellerMesh) { mesh.material.opacity = industrial ? 0.95 : 0.35; mesh.material.transparent = true; return; }
      mesh.material.transparent = !industrial;
      mesh.material.opacity = industrial ? 1 : 0.22;
    }, this);
    this._flowScale = industrial ? 0.45 : 1;
    this._draw();
  };

  Viewer.prototype.setStations = function (stations) {
    this._stations = stations || [];
    this._rebuildFlow();
  };

  Viewer.prototype._rebuildFlow = function () {
    var self = this;
    while (this.flowGroup.children.length) {
      var c = this.flowGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    this._particles = [];
    var stations = this._stations;
    if (!stations.length) return;

    var n = stations.length;
    var scale = this._flowScale == null ? 1 : this._flowScale;
    var tubeR = 0.035 * scale + 0.01;

    for (var i = 0; i < n - 1; i++) {
      var s = stations[i];
      var t0 = i / (n - 1), t1 = (i + 1) / (n - 1);
      var pts = [];
      for (var k = 0; k <= 12; k++) pts.push(this.curve.getPointAt(t0 + (t1 - t0) * (k / 12)));
      var segCurve = new THREE.CatmullRomCurve3(pts);
      var known = s.known;
      var color = intensityColor(s.intensity);
      var mat = new THREE.MeshStandardMaterial({
        color: color, emissive: color, emissiveIntensity: known ? 0.55 : 0.1,
        metalness: 0.2, roughness: 0.5, transparent: !known, opacity: known ? 1 : 0.4
      });
      var tube = new THREE.Mesh(new THREE.TubeGeometry(segCurve, 12, known ? (tubeR * (0.6 + (s.intensity || 0) * 0.8)) : tubeR * 0.5, 10, false), mat);
      tube.castShadow = this.mode === 'industrial';
      this.flowGroup.add(tube);
      this._particles.push({ curve: segCurve, known: known, speed: 0.15 + (s.intensity || 0) * 0.7, phase: i * 0.31, color: color });
    }

    // station markers
    stations.forEach(function (s, i) {
      var pos = self.curve.getPointAt(i / (n - 1));
      var col = intensityColor(s.intensity);
      var marker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: s.known ? 0.5 : 0.05, metalness: 0.3, roughness: 0.4 }));
      marker.position.copy(pos);
      self.flowGroup.add(marker);
    });

    // moving particles per segment
    this._particleMeshes = this._particles.map(function (p) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10),
        new THREE.MeshBasicMaterial({ color: p.color }));
      self.flowGroup.add(m);
      return m;
    });

    this._draw();
  };

  Viewer.prototype.resize = function () {
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    }
  };

  Viewer.prototype._draw = function () {
    this.resize();
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  Viewer.prototype.start = function () {
    var self = this;
    function tick() {
      self._t += 0.016;
      (self._particles || []).forEach(function (p, i) {
        if (!p.known) return;
        var mesh = self._particleMeshes && self._particleMeshes[i];
        if (!mesh) return;
        var phase = (self._t * p.speed + p.phase) % 1;
        mesh.position.copy(p.curve.getPointAt(phase));
      });
      self._draw();
      self._raf = requestAnimationFrame(tick);
    }
    if (!this._raf) tick();
  };

  Viewer.prototype.dispose = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.renderer.dispose();
  };

  if (!window.AROPUMPFLOWVIZ3D) window.AROPUMPFLOWVIZ3D = {};
  window.AROPUMPFLOWVIZ3D.Viewer = Viewer;
})();
