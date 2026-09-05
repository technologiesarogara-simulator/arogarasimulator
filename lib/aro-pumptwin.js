/* ══════════════════════════════════════════════════════════════════════
   AROGARA — TRUE 3D Pump Digital Twin
   window.AROPUMPTWIN

   Phase 16 of the Pump Hydraulics Advanced Upgrade. This is NOT the
   existing 3D loop simulation (the plant walkthrough) and NOT Phase 5's
   parametric impeller-only viewer — it is a single assembled 3D model of
   the whole pump train (casing / impeller / shaft / bearings / seal /
   coupling / driver) where clicking any component surfaces that
   component's already-computed engineering result.

   Split the same way every other engine in this suite is split:

     1. buildComponentManifest(...) — pure data assembly, no THREE.js and
        no DOM. Takes the RESULT OBJECTS already produced by Phases 4/5/
        7/8/9/10 (verbatim — nothing here recomputes a single formula)
        and turns them into a flat list of {id, label, group, verdict,
        color, lines[]} records the viewer can render into an info card.
        Loadable and unit-testable in Node exactly like the other pump
        engines.

     2. Viewer — a thin THREE.js scene builder + raycaster that places a
        simplified assembly on a <canvas> and reports which componentId
        was clicked. Browser-only (touches THREE/document/WebGL),
        verified visually like the rest of the app's 3D work.

   Every component's status/verdict is a straight readout of a field that
   already exists on that phase's result object — this file never
   invents a new judgement about whether a component is suitable.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STATUS_COLOR = {
    'SUITABLE': '#22c55e',
    'CHECK': '#eab308',
    'NOT RECOMMENDED': '#ef4444',
    'NOT APPLICABLE': '#64748b',
    'DATA REQUIRED': '#94a3b8',
    'PRELIMINARY ASSUMPTION': '#a78bfa',
  };
  function colorFor(verdict) { return STATUS_COLOR[verdict] || '#94a3b8'; }

  function dataRequired(id, group, label, reason) {
    return { id: id, group: group, label: label, verdict: 'DATA REQUIRED', color: colorFor('DATA REQUIRED'),
      lines: [reason || 'Run the pump hydraulic calculation to populate this component.'] };
  }

  /* p = { impeller, casing, shaft, bearing, seal, coupling, driverEnclosure }
     — each the verbatim result object from that phase's engine (or the
     ".top" of a ranked result, exactly as app.js already reads it). */
  function buildComponentManifest(p) {
    p = p || {};
    var out = [];

    // ── Impeller (Phase 4 — AROPUMPIMPELLER.eulerHead) ──
    var imp = p.impeller;
    if (imp && imp.applicable) {
      out.push({
        id: 'impeller', group: 'wet-end', label: 'Impeller', verdict: imp.status, color: colorFor('SUITABLE'),
        lines: [
          'Shape family: ' + imp.shapeFamily,
          'Specific speed Ns: ' + Math.round(imp.Ns),
          'Impeller OD (D2): ' + (imp.D2_m * 1000).toFixed(0) + ' mm',
          'Exit blade angle β2: ' + imp.beta2Deg.toFixed(1) + '°',
          'Tip speed U2: ' + imp.U2_ms.toFixed(2) + ' m/s',
        ],
      });
    } else {
      out.push(dataRequired('impeller', 'wet-end', 'Impeller', imp && imp.reason));
    }

    // ── Casing (Phase 5 — AROPUMPCASING.screenCasing) ──
    var cas = p.casing;
    if (cas && cas.applicable) {
      out.push({
        id: 'casing', group: 'wet-end', label: 'Casing', verdict: cas.pressureClass.cls, color: colorFor('SUITABLE'),
        lines: [
          'Shape family: ' + cas.shapeFamily,
          'Volute throat velocity: ' + cas.volute.Vth_ms.toFixed(2) + ' m/s',
          'Cutwater ID: ' + cas.cutwater.casingID_mm.toFixed(0) + ' mm',
          'Design pressure class: ' + cas.pressureClass.cls + ' (' + cas.pressureClass.designPressBarG.toFixed(1) + ' barg)',
        ],
      });
    } else {
      out.push(dataRequired('casing', 'wet-end', 'Casing', cas && cas.reason));
    }

    // ── Shaft (Phase 7 — AROPUMPSHAFT.screenAllShaftMaterials().top) ──
    var sh = p.shaft;
    if (sh && sh.applicable) {
      var shTop = sh.top || sh;
      out.push({
        id: 'shaft', group: 'shaft-train', label: 'Shaft', verdict: shTop.verdict, color: colorFor(shTop.verdict),
        lines: [
          'Material: ' + shTop.materialName,
          'Diameter: ' + shTop.shaftDiameter_mm.toFixed(1) + ' mm',
          'Deflection: ' + shTop.deflection_mm.toFixed(3) + ' mm (' + shTop.deflectionVerdict + ')',
          '1st critical speed: ' + Math.round(shTop.firstCriticalSpeed_rpm) + ' rpm (' + (shTop.criticalSpeedRatio * 100).toFixed(0) + '% margin, ' + shTop.criticalVerdict + ')',
        ],
      });
    } else {
      out.push(dataRequired('shaft', 'shaft-train', 'Shaft', sh && sh.reason));
    }

    // ── Bearings (Phase 8 — AROPUMPBEARING.screenAllBearingTypes().top) ──
    var br = p.bearing;
    if (br && br.applicable) {
      var brTop = br.top || br;
      out.push({
        id: 'bearings', group: 'shaft-train', label: 'Bearings', verdict: brTop.verdict, color: colorFor(brTop.verdict),
        lines: [
          'Type: ' + brTop.bearingName,
          'Bore: ' + brTop.bore_mm + ' mm',
          'L10 life: ' + Math.round(brTop.L10h).toLocaleString() + ' h',
          'Equivalent load P: ' + Math.round(brTop.P_N).toLocaleString() + ' N',
        ],
      });
    } else {
      out.push(dataRequired('bearings', 'shaft-train', 'Bearings', br && br.reason));
    }

    // ── Seal (Phase 9 — AROPUMPSEAL.selectSealPlan().top) ──
    var sl = p.seal;
    if (sl && sl.applicable) {
      var slTop = sl.top;
      out.push({
        id: 'seal', group: 'shaft-train', label: 'Mechanical Seal', verdict: slTop.verdict, color: colorFor(slTop.verdict),
        lines: [
          'Recommended plan: API 682 Plan ' + slTop.id + ' (' + slTop.name + ')',
          'Hazard class: ' + sl.hazard,
        ].concat(sl.quenchRecommended ? ['Quench (Plan 62) recommended: ' + sl.quenchReason] : [])
         .concat(sl.flashingWarning ? [sl.flashingWarning] : []),
      });
    } else {
      out.push(dataRequired('seal', 'shaft-train', 'Mechanical Seal', sl && sl.reason));
    }

    // ── Coupling (Phase 10 — AROPUMPDRIVER.recommendCoupling) ──
    var co = p.coupling;
    if (co && co.applicable) {
      var coTop = co.top;
      out.push({
        id: 'coupling', group: 'driver-train', label: 'Coupling', verdict: coTop.verdict, color: colorFor(coTop.verdict),
        lines: [
          'Type: ' + coTop.name,
          'Required continuous torque rating: ' + Math.round(co.requiredContinuousTorque_Nm) + ' N·m',
          'Required peak torque rating: ' + Math.round(co.requiredPeakTorque_Nm) + ' N·m',
        ],
      });
    } else if (co && co.status === 'NOT APPLICABLE') {
      out.push({ id: 'coupling', group: 'driver-train', label: 'Coupling', verdict: 'NOT APPLICABLE', color: colorFor('NOT APPLICABLE'),
        lines: [co.reason] });
    } else {
      out.push(dataRequired('coupling', 'driver-train', 'Coupling', co && co.reason));
    }

    // ── Driver (Phase 10 — AROPUMPDRIVER.screenMotorEnclosure().top) ──
    var dr = p.driverEnclosure;
    if (dr && dr.applicable) {
      var drTop = dr.top;
      out.push({
        id: 'driver', group: 'driver-train', label: 'Driver (Motor)', verdict: drTop.verdict, color: colorFor(drTop.verdict),
        lines: [
          'Enclosure: ' + drTop.name,
          'Hazard class: ' + dr.hazardClass,
        ],
      });
    } else {
      out.push(dataRequired('driver', 'driver-train', 'Driver (Motor)', dr && dr.reason));
    }

    // ── Baseplate — Phase 22's foundation/baseplate design, when available ──
    var fnd = p.foundation;
    var fndStyle = fnd && fnd.items && fnd.items.filter(function (i) { return i.id === 'baseplate-style'; })[0];
    if (fndStyle) {
      out.push({ id: 'baseplate', group: 'structure', label: 'Baseplate / Skid', verdict: fndStyle.status, color: colorFor(fndStyle.status),
        lines: [fndStyle.detail, 'See section 31 · FOUNDATION & BASEPLATE DESIGN for grout, foundation-mass and anchor-bolt guidance.'] });
    } else {
      out.push({ id: 'baseplate', group: 'structure', label: 'Baseplate / Skid', verdict: 'NOT APPLICABLE', color: colorFor('NOT APPLICABLE'),
        lines: ['Foundation/baseplate sizing is a later item in this upgrade — shown here for assembly context only.'] });
    }

    return out;
  }

  var AROPUMPTWIN = { buildComponentManifest: buildComponentManifest, STATUS_COLOR: STATUS_COLOR };

  /* ── Viewer: THREE.js scene builder + raycast picking — browser only ── */
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.THREE) {
    var THREE = window.THREE;

    function themePalette() {
      return (window.AROVIZTHEME && window.AROVIZTHEME.palette) ? window.AROVIZTHEME.palette() : { bgHex: 0x050810, ambientLight: 0x8899aa, ambientIntensity: 0.65 };
    }

    function Viewer(canvas) {
      var self = this;
      this.canvas = canvas;
      this.scene = new THREE.Scene();
      var p0 = themePalette();
      this.scene.background = new THREE.Color(p0.bgHex);
      this.camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.01, 50);
      // preserveDrawingBuffer so the report's canvas.toDataURL() capture can
      // read a real frame from a later report-button click, not only right
      // after this viewer's own animation frame renders.
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      /* A single flat key light plus a saturated blue point light is what
         made this read as an "animated cartoon" render rather than a real
         assembly — a proper 3-point rig (hemisphere fill + key + rim) plus
         cast shadows gives the same PBR materials something real to show,
         the same fix already verified on the impeller viewer. */
      this.renderer.shadowMap.enabled = true;
      if (THREE.PCFSoftShadowMap) this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this._ambient = new THREE.HemisphereLight(0xeef2ff, 0x11141c, p0.ambientIntensity * 0.85);
      this.scene.add(this._ambient);
      var key = new THREE.DirectionalLight(0xfff4e0, 1.15);
      key.position.set(2.2, 3.2, 1.8);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0015;
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
      this._floor.receiveShadow = true;
      this.scene.add(this._floor);

      this.group = new THREE.Group();
      this.scene.add(this.group);

      this._raf = null;
      this._pickables = [];
      this._raycaster = new THREE.Raycaster();
      this._selectedId = null;

      /* 360° drag-to-orbit + scroll/pinch-to-zoom — the same
         CustomOrbitControls class app.js already built for the
         pre-existing 3D loop simulation, reused rather than reimplemented. */
      this.controls = (typeof CustomOrbitControls === 'function') ? new CustomOrbitControls(this.camera, canvas) : null;
      if (this.controls) {
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.6;
        this.controls.enableDamping = true;
      }

      /* Dragging to orbit still ends in a native 'click' at mouseup — the
         browser doesn't know "drag" from "tap" on its own. Only treat a
         click as a component pick when the pointer barely moved between
         press and release; otherwise it was an orbit drag, not a pick. */
      this._downPos = null;
      canvas.addEventListener('mousedown', function (ev) { self._downPos = { x: ev.clientX, y: ev.clientY }; });
      canvas.addEventListener('touchstart', function (ev) {
        if (ev.touches && ev.touches[0]) self._downPos = { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      }, { passive: true });

      this._onClick = function (ev) {
        var moved = self._downPos ? Math.hypot(ev.clientX - self._downPos.x, ev.clientY - self._downPos.y) : 0;
        self._downPos = null;
        if (moved > 5) return; // an orbit drag, not a pick
        var rect = canvas.getBoundingClientRect();
        var x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        var y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        self._raycaster.setFromCamera({ x: x, y: y }, self.camera);
        var hits = self._raycaster.intersectObjects(self._pickables, false);
        if (hits.length && self.onPick) self.onPick(hits[0].object.userData.componentId);
      };
      canvas.addEventListener('click', this._onClick);

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

    function mat(color) { return new THREE.MeshStandardMaterial({ color: color, metalness: 0.55, roughness: 0.4 }); }

    /* Builds a simplified, schematic assembly along a single shaft axis
       (local X). Proportions are illustrative, not a manufacturing
       layout — the whole point is a clickable index into the real
       computed results, not a dimensionally accurate GA drawing (that is
       a separate, later item in this upgrade). */
    Viewer.prototype.buildAssembly = function (manifest) {
      var self = this;
      this.resize();
      while (this.group.children.length) {
        var c = this.group.children.pop();
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      }
      this._pickables = [];
      var byId = {};
      (manifest || []).forEach(function (m) { byId[m.id] = m; });

      function add(id, mesh) {
        mesh.userData.componentId = id;
        mesh.userData.baseColor = mesh.material.color.getHex();
        mesh.castShadow = true; mesh.receiveShadow = true;
        self.group.add(mesh);
        self._pickables.push(mesh);
        return mesh;
      }

      // baseplate
      add('baseplate', new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.5), mat(0x1e293b)))
        .position.set(0.2, -0.35, 0);
      this._floor.position.y = -0.39;

      /* Every part used to be its own saturated primary colour (hot-pink
         impeller, neon-blue coupling) — reads as a labelled toy diagram,
         not an assembly. Real rotating equipment is mostly steel/cast-iron
         greys; the seal (amber, a genuinely distinct wear part) and the
         coupling guard (safety orange, the one part actually painted a
         bright colour on a real skid) are the only colour accents kept. */
      // casing (volute housing) — wet end, x < 0
      var casingMesh = add('casing', new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.28, 32), mat(0x4b5563)));
      casingMesh.rotation.z = Math.PI / 2;
      casingMesh.position.set(-0.75, 0, 0);

      // impeller — small disc inside the casing (a hint, not a full blade
      // model; Phase 5's own viewer already owns the detailed blade geometry)
      var impellerMesh = add('impeller', new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 24), mat(0xa87b46)));
      impellerMesh.rotation.z = Math.PI / 2;
      impellerMesh.position.set(-0.75, 0, 0);

      // shaft — long thin cylinder from casing through to driver
      var shaftMesh = add('shaft', new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 20), mat(0x9aa3af)));
      shaftMesh.rotation.z = Math.PI / 2;
      shaftMesh.position.set(0.05, 0, 0);

      // bearings — two rings on the shaft
      [-0.55, 0.35].forEach(function (bx) {
        var ring = add('bearings', new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 20), mat(0x5c6470)));
        ring.rotation.z = Math.PI / 2;
        ring.position.set(bx, 0, 0);
      });

      // seal — thin ring right at the casing/shaft interface
      var sealMesh = add('seal', new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 20), mat(0xf59e0b)));
      sealMesh.rotation.z = Math.PI / 2;
      sealMesh.position.set(-0.42, 0, 0);

      // coupling — short wide cylinder mid-shaft (guard: safety orange)
      var couplingMesh = add('coupling', new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 24), mat(0xea7c2c)));
      couplingMesh.rotation.z = Math.PI / 2;
      couplingMesh.position.set(0.55, 0, 0);

      // driver — box housing at the far end
      add('driver', new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.42), mat(0x475569)))
        .position.set(1.15, 0, 0);

      /* Tint every mesh by its manifest verdict color, if known - blended
         into the base metal tone rather than replacing it outright. A
         full color.set() here painted every part flat solid green/red/
         amber plastic, drowning out the PBR metalness/roughness shading
         that makes a part read as machined metal instead of a toy - the
         verdict is still unmistakable at this blend ratio, just as a tint
         on a metal surface rather than a block of flat colour. */
      this._pickables.forEach(function (mesh) {
        var m = byId[mesh.userData.componentId];
        if (m && m.color) {
          mesh.material.color.lerp(new THREE.Color(m.color), 0.6);
          mesh.userData.baseColor = mesh.material.color.getHex();
        }
      });

      this.setSelected(this._selectedId);
      this.camera.position.set(1.1, 0.9, 1.6);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        // Fresh baseline framing for this rebuild — sync both the live and
        // target orbit state so update() doesn't damp back toward
        // wherever the camera was left before this assembly was rebuilt.
        this.controls.updateSphericalFromCamera();
        this.controls.targetSpherical.radius = this.controls.spherical.radius;
        this.controls.targetSpherical.phi = this.controls.spherical.phi;
        this.controls.targetSpherical.theta = this.controls.spherical.theta;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 6;
      }
    };

    Viewer.prototype.setSelected = function (componentId) {
      this._selectedId = componentId;
      this._pickables.forEach(function (mesh) {
        var isSel = componentId && mesh.userData.componentId === componentId;
        mesh.material.emissive = new THREE.Color(isSel ? 0xffffff : 0x000000);
        mesh.material.emissiveIntensity = isSel ? 0.35 : 0;
      });
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
      this.canvas.removeEventListener('click', this._onClick);
      this.renderer.dispose();
    };

    AROPUMPTWIN.Viewer = Viewer;
  }

  window.AROPUMPTWIN = AROPUMPTWIN;
})();
