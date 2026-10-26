/* AROGARA — selected-pump live flow and section overlay.
   Adds a visible fluid core, tracer slugs and section behaviour to the existing
   selected-pump WebGL viewer. The route reads the same calculated ports and
   duty that drive the base model; it is a mechanism visualisation, not CFD. */
(function () {
  'use strict';
  if (!window.AROPUMPOPERATING || !window.THREE) return;
  var T = window.THREE;
  var originalDecorate = window.AROPUMPOPERATING.decorate;
  var originalAnimate = window.AROPUMPOPERATING.animate;

  function pointAlong(a, n, distance) { return a.clone().addScaledVector(n, distance); }
  function normal(v, fallback) {
    return v && v.lengthSq && v.lengthSq() > 1e-10 ? v.clone().normalize() : fallback.clone();
  }
  function pathFrom(points) {
    var p = new T.CurvePath();
    for (var i = 1; i < points.length; i++) {
      if (points[i].distanceTo(points[i - 1]) > 1e-8) p.add(new T.LineCurve3(points[i - 1], points[i]));
    }
    return p;
  }
  function vaneRoute(built) {
    var sp = built.ports.suction.clone(), dp = built.ports.discharge.clone();
    var sn = normal(built.ports.suctionNormal, new T.Vector3(0, -1, 0));
    var dn = normal(built.ports.dischargeNormal, new T.Vector3(0, 1, 0));
    return pathFrom([
      pointAlong(sp, sn, 0.95), sp,
      new T.Vector3(0.05, -0.18, 0.32), new T.Vector3(0.05, 0.90, 0.32),
      new T.Vector3(0.08, 0.90, 0), new T.Vector3(0, 1.50, 0), dp,
      pointAlong(dp, dn, 1.05)
    ]);
  }
  function fluidColor(panel) {
    try { return window.AROPUMPOPERATING.operatingData(panel).color; } catch (e) { return 0x38bdf8; }
  }
  function addFluidOverlay(panel, built) {
    if (!built || !built.group || !built.flowPath) return;
    if (panel.familyId === 'vane-pump') built.flowPath = vaneRoute(built);
    var curve = built.flowPath;
    if (!curve || !isFinite(curve.getLength()) || curve.getLength() <= 0) return;
    var colour = fluidColor(panel);
    var overlay = new T.Group();
    overlay.userData.partName = 'Live fluid route — calculated suction to discharge';
    overlay.userData.curve = curve;
    overlay.userData.phase = 0;
    var fluid = new T.MeshStandardMaterial({
      color: colour, emissive: colour, emissiveIntensity: 0.44, transparent: true,
      opacity: 0.48, depthWrite: false, depthTest: false, metalness: 0.05, roughness: 0.28
    });
    try {
      var core = new T.Mesh(new T.TubeGeometry(curve, 240, 0.036, 12, false), fluid);
      core.userData.partName = 'Fluid core — actual inlet, wetted route and outlet';
      core.renderOrder = 10;
      overlay.add(core);
    } catch (e) { /* tracer slugs below remain available */ }
    var dropGeo = new T.SphereGeometry(0.052, 12, 12);
    for (var i = 0; i < 24; i++) {
      var dropMat = new T.MeshStandardMaterial({
        color: colour, emissive: colour, emissiveIntensity: 1.25, transparent: true,
        opacity: 0.96, depthWrite: false, depthTest: false, metalness: 0.06, roughness: 0.22
      });
      var drop = new T.Mesh(dropGeo, dropMat);
      drop.userData.flowOffset = i / 24;
      drop.userData.flowTracer = true;
      drop.userData.partName = 'Moving fluid tracer';
      drop.renderOrder = 11;
      overlay.add(drop);
    }
    built.group.add(overlay);
    built.group.userData.liveFluidOverlay = overlay;
  }
  window.AROPUMPOPERATING.decorate = function (panel, built) {
    var result = originalDecorate.apply(this, arguments);
    addFluidOverlay(panel, built);
    return result;
  };
  window.AROPUMPOPERATING.animate = function (viewer, dt) {
    originalAnimate.apply(this, arguments);
    var overlay = viewer && viewer.currentGroup && viewer.currentGroup.userData.liveFluidOverlay;
    if (!overlay || !viewer.flowSimOn) return;
    var panel = viewer.operatingPanel;
    var running = false;
    try { running = window.AROPUMPOPERATING.operatingData(panel).running; } catch (e) {}
    if (!running) return;
    var curve = overlay.userData.curve;
    if (!curve || !isFinite(curve.getLength()) || curve.getLength() <= 0) return;
    overlay.userData.phase = (overlay.userData.phase + 0.010 * (viewer.flowSpeedMul || 1) * (dt || 1)) % 1;
    overlay.children.forEach(function (node) {
      if (!node.userData || node.userData.flowTracer !== true) return;
      var t = (node.userData.flowOffset + overlay.userData.phase) % 1;
      node.position.copy(curve.getPointAt(t));
      var edge = 0.06, fade = t < edge ? t / edge : (t > 1 - edge ? (1 - t) / edge : 1);
      node.material.opacity = 0.24 + 0.72 * fade;
    });
  };

  function applySection() {
    var v = window.pumpLiveViewer3D;
    if (!v || !v.caseMat) return;
    var control = document.getElementById('pump-3d-cutaway');
    var on = control ? !!control.checked : true;
    v.cutawayOn = on;
    v.caseMat.transparent = on;
    v.caseMat.opacity = on ? 0.26 : 1;
    v.caseMat.depthWrite = !on;
    if (v.currentGroup && v.currentGroup.userData.liveFluidOverlay) {
      v.currentGroup.userData.liveFluidOverlay.visible = !document.getElementById('pump-3d-flowsim') || document.getElementById('pump-3d-flowsim').checked;
    }
  }
  var originalUpdate = window.updatePumpLiveViewer3D;
  if (typeof originalUpdate === 'function') {
    window.updatePumpLiveViewer3D = function () {
      var result = originalUpdate.apply(this, arguments);
      applySection();
      return result;
    };
  }
  document.addEventListener('change', function (event) {
    if (!event.target) return;
    if (event.target.id === 'pump-3d-cutaway') applySection();
    if (event.target.id === 'pump-3d-flowsim') {
      var v = window.pumpLiveViewer3D;
      var overlay = v && v.currentGroup && v.currentGroup.userData.liveFluidOverlay;
      if (overlay) overlay.visible = !!event.target.checked;
    }
  }, false);
})();
