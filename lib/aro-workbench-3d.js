/* ══════════════════════════════════════════════════════════════════════
   ARO WORKBENCH 3D — real Three.js CAD viewport (no SVG / no pseudo-3D)
   Every equipment is a genuine THREE.Group of meshes (CylinderGeometry,
   BoxGeometry, TorusGeometry, ExtrudeGeometry …) with PBR MeshStandardMaterial,
   perspective camera, orbit (360° rotate / zoom / pan), directional + ambient
   + hemisphere lighting, shadow-mapped ground, raycast selection, view presets,
   wireframe / transparency / section-clip / explode, live spin animation and
   OBJ export. Uses the global THREE (r128) already loaded by the app.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { console.warn('ARO3D: THREE not loaded'); return; }

  var A3 = window.ARO3D = { open: open, initialized: false };
  var embedded = false, embCanvas = null, embStatus = null;
  var scene, camera, renderer, raf, ground, grid, clipPlane;
  var picked = null, pickedPipe = null, objects = [], spinList = [];
  var portMeshes = [], pipes3d = [], pipeMode = false, pendingPort = null, rebuilding = false;
  var sph = { r: 14, theta: 0.9, phi: 1.0, tx: 0, ty: 2, tz: 0 };
  var host;

  /* ─────────── PBR materials (metallic / roughness workflow) ─────────── */
  function M() { return {
    steel:   new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.95, roughness: 0.32 }),
    cs:      new THREE.MeshStandardMaterial({ color: 0x8a8f98, metalness: 0.85, roughness: 0.5 }),
    blue:    new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.55, roughness: 0.45 }),
    navy:    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6, roughness: 0.4 }),
    orange:  new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.5, roughness: 0.45 }),
    copper:  new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1.0, roughness: 0.35 }),
    brass:   new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 1.0, roughness: 0.35 }),
    dark:    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.5 }),
    bolt:    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.4 }),
    red:     new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.5 }),
    green:   new THREE.MeshStandardMaterial({ color: 0x16a34a, metalness: 0.5, roughness: 0.45 }),
    glass:   new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35 })
  }; }
  var mats;

  function mesh(geo, mat) { var m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }
  function cyl(rt, rb, h, mat, seg) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 32), mat); }
  function box(w, h, d, mat) { return mesh(new THREE.BoxGeometry(w, h, d), mat); }
  function torus(r, t, mat) { return mesh(new THREE.TorusGeometry(r, t, 16, 32), mat); }
  // ring of bolts around a flange face
  function boltCircle(n, R, x, axis, mat) {
    var g = new THREE.Group();
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      var b = cyl(0.05, 0.05, 0.18, mat, 6);
      if (axis === 'x') { b.rotation.z = Math.PI / 2; b.position.set(x, Math.cos(a) * R, Math.sin(a) * R); }
      else { b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * R, x, Math.sin(a) * R); }
      g.add(b);
    }
    return g;
  }
  // flange disc on the X axis at position x with bolt ring
  function flangeX(x, R, mat) {
    var g = new THREE.Group();
    var f = cyl(R, R, 0.16, mat); f.rotation.z = Math.PI / 2; f.position.x = x; g.add(f);
    g.add(boltCircle(8, R * 0.78, x, 'x', mats.bolt));
    return g;
  }
  function nozzleX(x, len, r, mat) {
    var g = new THREE.Group();
    var n = cyl(r, r, len, mat); n.rotation.z = Math.PI / 2; n.position.x = x + (len / 2) * Math.sign(x || 1); g.add(n);
    g.add(flangeX(x + len * Math.sign(x || 1), r * 1.7, mats.steel));
    return g;
  }
  function nozzleY(y, len, r, mat, xoff) {
    var g = new THREE.Group();
    var n = cyl(r, r, len, mat); n.position.set(xoff || 0, y + (len / 2) * Math.sign(y || 1), 0); g.add(n);
    var f = cyl(r * 1.7, r * 1.7, 0.14, mats.steel); f.position.set(xoff || 0, y + len * Math.sign(y || 1), 0); g.add(f);
    return g;
  }
  function saddle(x, R, mat) {
    var g = new THREE.Group();
    var leg = box(1.2, R + 1, 0.4, mat); leg.position.set(x, -(R + 1) / 2 - 0.0, 0); g.add(leg);
    var base = box(1.6, 0.25, 1.6, mats.dark); base.position.set(x, -(R + 1), 0); g.add(base);
    return g;
  }
  function legs(R, h, mat, n) {
    var g = new THREE.Group(); n = n || 4;
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2 + Math.PI / n; var l = cyl(0.12, 0.12, h, mat, 8); l.position.set(Math.cos(a) * R * 0.8, -h / 2, Math.sin(a) * R * 0.8); g.add(l); }
    return g;
  }
  function dishTop(R, y, mat) { var d = mesh(new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat); d.position.y = y; return d; }
  function dishBot(R, y, mat) { var d = mesh(new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat); d.position.y = y; return d; }

  /* ─────────── Equipment factories (real industrial geometry) ─────────── */
  var FAC = {
    'centrifugal-pump': function () {
      var g = new THREE.Group();
      // volute casing (blue)
      var vol = cyl(1.5, 1.5, 1.1, mats.blue); vol.rotation.x = Math.PI / 2; vol.position.set(-1.6, 1.4, 0); g.add(vol);
      var volFace = cyl(1.55, 1.55, 0.14, mats.navy); volFace.rotation.x = Math.PI / 2; volFace.position.set(-1.6, 1.4, 0.6); g.add(volFace);
      // impeller (spins) — orange
      var imp = new THREE.Group();
      for (var i = 0; i < 6; i++) { var bld = box(1.1, 0.14, 0.34, mats.orange); bld.rotation.y = i / 6 * Math.PI * 2; imp.add(bld); }
      imp.position.set(-1.6, 1.4, 0); imp.rotation.x = Math.PI / 2; imp.userData.spin = 'z'; g.add(imp); spinTag(imp);
      // suction nozzle (axial, +Z) and discharge (up)
      var suc = cyl(0.55, 0.55, 1.0, mats.blue); suc.rotation.x = Math.PI / 2; suc.position.set(-1.6, 1.4, 1.2); g.add(suc);
      g.add(flgZ(-1.6, 1.4, 1.7, 0.75));
      var dis = cyl(0.5, 0.5, 1.3, mats.blue); dis.position.set(-1.6, 2.6, 0); g.add(dis);
      g.add(nozzleY(3.2, 0.0, 0.5, mats.blue, -1.6));
      // motor (finned cylinder) coupled behind
      var mot = cyl(1.0, 1.0, 2.6, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.set(1.1, 1.4, 0); g.add(mot);
      for (var f = 0; f < 10; f++) { var fin = torus(1.02, 0.04, mats.dark); fin.rotation.y = Math.PI / 2; fin.position.set(-0.1 + f * 0.26, 1.4, 0); mot.add(fin); }
      var coup = cyl(0.35, 0.35, 0.5, mats.bolt); coup.rotation.z = Math.PI / 2; coup.position.set(-0.5, 1.4, 0); g.add(coup);
      // baseplate
      var bp = box(5.2, 0.3, 2.4, mats.dark); bp.position.set(0, 0.15, 0); g.add(bp);
      g.userData.props = { Type: 'Centrifugal Pump', 'Flow (m³/h)': 50, 'Head (m)': 45, 'Efficiency (%)': 72, 'RPM': 2950, 'NPSHr (m)': 3.5, 'Motor (kW)': 11, 'Material': 'CS/SS316', 'Weight (kg)': 320 };
      return g;
    },
    'sthe': function () {
      var g = new THREE.Group();
      var R = 1.6, L = 7;
      var shell = cyl(R, R, L, mats.steel); shell.rotation.z = Math.PI / 2; shell.position.y = 2.4; g.add(shell);
      // tubesheets + tube bundle
      var ts1 = cyl(R * 0.95, R * 0.95, 0.2, mats.dark); ts1.rotation.z = Math.PI / 2; ts1.position.set(-L / 2, 2.4, 0); g.add(ts1);
      var ts2 = ts1.clone(); ts2.position.x = L / 2; g.add(ts2);
      for (var t = 0; t < 18; t++) {
        var a = t / 18 * Math.PI * 2, rr = R * 0.62;
        var tube = cyl(0.11, 0.11, L, mats.copper, 8); tube.rotation.z = Math.PI / 2;
        tube.position.set(0, 2.4 + Math.sin(a) * rr, Math.cos(a) * rr); g.add(tube);
      }
      // channel heads (dished) both ends
      var h1 = dishSideNeg(R, -L / 2, 2.4, mats.blue); g.add(h1);
      var h2 = dishSidePos(R, L / 2, 2.4, mats.blue); g.add(h2);
      // nozzles: shell in (top-left), shell out (bottom-right), tube in/out on heads
      g.add(nozzleY(2.4 + R + 0.8, 0, 0.4, mats.steel, -L / 2 + 1.2));
      var so = nozzleY(-(0), 0, 0.4, mats.steel, L / 2 - 1.2); so.position.y = 2.4 - R - 0.8; so.children.forEach(function(c){c.position.y=-Math.abs(c.position.y);}); g.add(so);
      g.add(nozzleX2(-L / 2 - 0.7, 2.4, 0.4, mats.blue, -1));
      g.add(nozzleX2(L / 2 + 0.7, 2.4, 0.4, mats.blue, 1));
      // saddles
      g.add(saddleAt(-L / 3, R, 2.4, mats.dark)); g.add(saddleAt(L / 3, R, 2.4, mats.dark));
      g.userData.props = { Type: 'Shell & Tube HX (TEMA)', 'Shell ID (mm)': 320, 'Tube OD (mm)': 19, 'Tube L (m)': 6, 'No. Tubes': 118, 'Pitch (mm)': 24, 'Baffle cut (%)': 25, 'Baffle spacing (mm)': 180, 'Material': 'CS shell / SS tubes' };
      return g;
    },
    'v-vessel': function () {
      var g = new THREE.Group();
      var R = 1.6, H = 5;
      var sh = cyl(R, R, H, mats.steel); sh.position.y = 2 + H / 2; g.add(sh);
      g.add(dishTop(R, 2 + H, mats.steel)); g.add(dishBot(R, 2, mats.steel));
      g.add(nozzleY(2 + H + R + 0.6, 0, 0.35, mats.steel, 0));
      var dr = cyl(0.35, 0.35, 1.2, mats.steel); dr.position.y = 2 - 0.6; g.add(dr);
      g.add(legs(R, 2, mats.dark, 4));
      g.userData.props = { Type: 'Vertical Vessel', 'ID (mm)': 320, 'T/T (mm)': 5000, 'Design P (barg)': 10, 'Design T (°C)': 150, 'Material': 'SA-516-70', 'Corr. all. (mm)': 3 };
      return g;
    },
    'h-vessel': function () {
      var g = new THREE.Group();
      var R = 1.5, L = 6;
      var sh = cyl(R, R, L, mats.steel); sh.rotation.z = Math.PI / 2; sh.position.y = 2.4; g.add(sh);
      g.add(dishSideNeg(R, -L / 2, 2.4, mats.steel)); g.add(dishSidePos(R, L / 2, 2.4, mats.steel));
      g.add(nozzleY(2.4 + R + 0.6, 0, 0.35, mats.steel, -1.5));
      g.add(saddleAt(-L / 3, R, 2.4, mats.dark)); g.add(saddleAt(L / 3, R, 2.4, mats.dark));
      g.userData.props = { Type: 'Horizontal Vessel', 'ID (mm)': 300, 'T/T (mm)': 6000, 'Design P (barg)': 8, 'Material': 'SA-516-70' };
      return g;
    },
    'column': function () {
      var g = new THREE.Group();
      var R = 1.2, H = 9;
      var sh = cyl(R, R, H, mats.blue); sh.position.y = 2 + H / 2; g.add(sh);
      g.add(dishTop(R, 2 + H, mats.blue)); g.add(dishBot(R, 2, mats.blue));
      // trays
      for (var tr = 0; tr < 8; tr++) { var tray = cyl(R * 0.92, R * 0.92, 0.06, mats.steel); tray.position.y = 2.6 + tr * (H - 1) / 8; g.add(tray); }
      g.add(nozzleY(2 + H + R + 0.6, 0, 0.3, mats.steel, 0));   // overhead
      g.add(nozzleX2(-R - 0.6, 2 + H * 0.45, 0.3, mats.steel, -1)); // feed
      var bt = cyl(0.3, 0.3, 1, mats.steel); bt.position.y = 2 - 0.5; g.add(bt);
      // skirt
      var sk = cyl(R, R, 2, mats.dark, 24); sk.material = mats.dark; sk.position.y = 1; g.add(sk);
      g.userData.props = { Type: 'Distillation Column', 'ID (mm)': 240, 'Tan-Tan (mm)': 9000, 'Trays': 8, 'Tray type': 'Sieve', 'Material': 'SS304' };
      return g;
    },
    'cone-tank': function () {
      var g = new THREE.Group();
      var R = 3, H = 4;
      var sh = cyl(R, R, H, mats.blue, 40); sh.position.y = 0.2 + H / 2; g.add(sh);
      var roof = cyl(0.05, R, 1.3, mats.navy, 40); roof.position.y = 0.2 + H + 0.65; g.add(roof);
      var floor = cyl(R, R, 0.2, mats.dark, 40); floor.position.y = 0.1; g.add(floor);
      g.add(nozzleX2(-R - 0.6, 0.9, 0.35, mats.steel, -1));
      g.userData.props = { Type: 'Cone Roof Tank', 'Diameter (m)': 6, 'Height (m)': 4, 'Capacity (m³)': 113, 'Standard': 'API 650', 'Material': 'CS' };
      return g;
    },
    'bullet': function () {
      var g = new THREE.Group();
      var R = 1.4, L = 6;
      var sh = cyl(R, R, L, mats.steel); sh.rotation.z = Math.PI / 2; sh.position.y = 2.2; g.add(sh);
      var c1 = mesh(new THREE.SphereGeometry(R, 20, 12), mats.steel); c1.scale.x = 0.6; c1.position.set(-L / 2, 2.2, 0); g.add(c1);
      var c2 = c1.clone(); c2.position.x = L / 2; g.add(c2);
      g.add(saddleAt(-L / 3, R, 2.2, mats.dark)); g.add(saddleAt(L / 3, R, 2.2, mats.dark));
      g.userData.props = { Type: 'LPG Bullet Tank', 'ID (mm)': 280, 'Length (mm)': 6000, 'Design P (barg)': 17, 'Material': 'SA-516-70' };
      return g;
    },
    'gate-valve': function () {
      var g = new THREE.Group();
      var body = mesh(new THREE.SphereGeometry(0.9, 20, 16), mats.blue); body.scale.y = 1.1; body.position.y = 1.4; g.add(body);
      g.add(flgZ(0, 1.4, 1.0, 0.55)); g.add(flgZ(0, 1.4, -1.0, 0.55));
      var e1 = cyl(0.4, 0.4, 0.8, mats.blue); e1.rotation.x = Math.PI / 2; e1.position.set(0, 1.4, 0.6); g.add(e1);
      var e2 = e1.clone(); e2.position.z = -0.6; g.add(e2);
      var bonnet = box(0.7, 0.9, 0.7, mats.navy); bonnet.position.y = 2.3; g.add(bonnet);
      g.add(boltCircle(6, 0.5, 2.0, 'y', mats.bolt));
      var stem = cyl(0.09, 0.09, 1.6, mats.steel); stem.position.y = 3.1; g.add(stem);
      var wheel = torus(0.7, 0.09, mats.dark); wheel.rotation.x = Math.PI / 2; wheel.position.y = 3.9; g.add(wheel);
      for (var s = 0; s < 3; s++) { var sp = box(1.3, 0.06, 0.06, mats.dark); sp.rotation.y = s / 3 * Math.PI; sp.position.y = 3.9; g.add(sp); }
      g.userData.props = { Type: 'Gate Valve', 'Size (NPS)': 3, 'Rating': 'CL150', 'End': 'RF Flanged', 'Body': 'WCB', 'Trim': 'SS316' };
      return g;
    },
    'ball-valve': function () {
      var g = new THREE.Group();
      var body = cyl(0.75, 0.75, 2.0, mats.steel); body.rotation.x = Math.PI / 2; body.position.y = 1.4; g.add(body);
      var ball = mesh(new THREE.SphereGeometry(0.7, 20, 16), mats.dark); ball.position.y = 1.4; g.add(ball);
      g.add(flgZ(0, 1.4, 1.1, 0.6)); g.add(flgZ(0, 1.4, -1.1, 0.6));
      var stem = cyl(0.09, 0.09, 0.9, mats.steel); stem.position.y = 2.1; g.add(stem);
      var lever = box(2.2, 0.16, 0.28, mats.red); lever.position.set(1.0, 2.5, 0); g.add(lever);
      g.userData.props = { Type: 'Ball Valve', 'Size (NPS)': 2, 'Rating': 'CL150', 'Bore': 'Full', 'Body': 'SS316', 'Seat': 'PTFE' };
      return g;
    },
    'compressor': function () {
      var g = new THREE.Group();
      var body = cyl(1.5, 1.5, 3, mats.navy); body.rotation.z = Math.PI / 2; body.position.y = 2; g.add(body);
      var rotor = new THREE.Group();
      for (var i = 0; i < 10; i++) { var bl = box(0.1, 2.4, 0.5, mats.steel); bl.rotation.x = i / 10 * Math.PI * 2; rotor.add(bl); }
      rotor.rotation.z = Math.PI / 2; rotor.position.y = 2; rotor.userData.spin = 'x'; spinTag(rotor); g.add(rotor);
      g.add(nozzleY(2 + 1.5 + 0.6, 0, 0.5, mats.steel, -1));
      var d = cyl(0.5, 0.5, 1.2, mats.steel); d.position.set(1.7, 3, 0); g.add(d);
      var bp = box(5, 0.3, 3, mats.dark); bp.position.y = 0.3; g.add(bp);
      g.userData.props = { Type: 'Centrifugal Compressor', 'Flow (Am³/h)': 5000, 'Disch P (barg)': 12, 'RPM': 11000, 'Power (kW)': 450, 'Material': 'CS/SS' };
      return g;
    },
    'reboiler': function () {
      var g = new THREE.Group();
      var R = 1.6, L = 5.5;
      var sh = cyl(R, R, L, mats.copper); sh.rotation.z = Math.PI / 2; sh.position.y = 2.4; g.add(sh);
      g.add(dishSidePos(R, L / 2, 2.4, mats.copper));
      var kettle = cyl(R * 1.4, R, 2, mats.copper); kettle.rotation.z = Math.PI / 2; kettle.position.set(-L / 2 + 1, 2.4, 0); g.add(kettle);
      for (var t = 0; t < 12; t++) { var a = t / 12 * Math.PI * 2; var tube = cyl(0.1, 0.1, L - 1, mats.brass, 8); tube.rotation.z = Math.PI / 2; tube.position.set(0.3, 2.4 + Math.sin(a) * R * 0.5, Math.cos(a) * R * 0.5); g.add(tube); }
      g.add(nozzleY(2.4 + R * 1.4 + 0.6, 0, 0.4, mats.steel, -L / 2 + 1));  // vapor
      g.add(saddleAt(-L / 3, R, 2.4, mats.dark)); g.add(saddleAt(L / 3, R, 2.4, mats.dark));
      g.userData.props = { Type: 'Kettle Reboiler', 'Shell ID (mm)': 320, 'Duty (kW)': 1200, 'Tube OD (mm)': 19, 'Material': 'CS/SS' };
      return g;
    },
    'plate-hx': function () {
      var g = new THREE.Group();
      var frameA = box(0.5, 3.4, 2.6, mats.dark); frameA.position.set(-2.2, 2.1, 0); g.add(frameA);
      var frameB = box(0.5, 3.4, 2.6, mats.dark); frameB.position.set(2.2, 2.1, 0); g.add(frameB);
      for (var i = 0; i < 22; i++) {
        var pl = box(0.12, 3.0, 2.3, i % 2 ? mats.orange : mats.blue);
        pl.position.set(-1.9 + i * 0.17, 2.1, 0); g.add(pl);
      }
      var tb1 = cyl(0.09, 0.09, 4.6, mats.bolt); tb1.rotation.z = Math.PI / 2; tb1.position.set(0, 3.5, 0.9); g.add(tb1);
      var tb2 = tb1.clone(); tb2.position.set(0, 3.5, -0.9); g.add(tb2);
      g.add(nozzleX2(-2.7, 3.0, 0.28, mats.blue, -1)); g.add(nozzleX2(-2.7, 1.2, 0.28, mats.orange, -1));
      var foot = box(5.4, 0.3, 2.8, mats.dark); foot.position.y = 0.15; g.add(foot);
      g.userData.props = { Type: 'Plate & Frame HX', 'Plates': 22, 'Area (m²)': 34, 'Duty (kW)': 850, 'Gasket': 'NBR', 'Material': 'SS316' };
      return g;
    },
    'aircooler': function () {
      var g = new THREE.Group();
      var bund = box(6.5, 0.9, 4.2, mats.steel); bund.position.y = 3.4; g.add(bund);
      for (var t = 0; t < 9; t++) { var tube = cyl(0.14, 0.14, 4.0, mats.copper, 8); tube.rotation.x = Math.PI / 2; tube.position.set(-2.8 + t * 0.7, 3.4, 0); g.add(tube); }
      [-1.6, 1.6].forEach(function (fx) {
        var ring = torus(1.3, 0.12, mats.dark); ring.position.set(fx, 2.7, 0); g.add(ring);
        var fan = new THREE.Group();
        for (var b = 0; b < 5; b++) { var bl = box(1.2, 0.05, 0.4, mats.navy); bl.rotation.y = b / 5 * Math.PI * 2; fan.add(bl); }
        fan.position.set(fx, 2.7, 0); fan.userData.spin = 'y'; spinTag(fan); g.add(fan);
      });
      [[-2.9, -1.8], [2.9, -1.8], [-2.9, 1.8], [2.9, 1.8]].forEach(function (p) { var lg = box(0.3, 2.7, 0.3, mats.dark); lg.position.set(p[0], 1.35, p[1]); g.add(lg); });
      g.add(nozzleX2(-3.4, 3.4, 0.3, mats.blue, -1)); g.add(nozzleX2(3.4, 3.4, 0.3, mats.blue, 1));
      g.userData.props = { Type: 'Air-Cooled Exchanger', 'Bays': 2, 'Fans': 2, 'Duty (kW)': 1400, 'Air flow (Am³/h)': 90000, 'Material': 'CS finned' };
      return g;
    },
    'reactor': function () {
      var g = new THREE.Group();
      var R = 1.5, H = 6;
      var sh = cyl(R, R, H, mats.navy); sh.position.y = 2.4 + H / 2; g.add(sh);
      g.add(dishTop(R, 2.4 + H, mats.navy)); g.add(dishBot(R, 2.4, mats.navy));
      var bed = cyl(R * 0.92, R * 0.92, H * 0.55, mats.green); bed.position.y = 2.4 + H * 0.42; g.add(bed);
      var grid1 = cyl(R * 0.94, R * 0.94, 0.12, mats.steel); grid1.position.y = 2.4 + H * 0.14; g.add(grid1);
      g.add(nozzleY(2.4 + H + R + 0.6, 0, 0.32, mats.steel, 0));
      var out = cyl(0.32, 0.32, 1, mats.steel); out.position.y = 2.4 - 0.5; g.add(out);
      g.add(nozzleX2(-R - 0.6, 2.4 + H * 0.7, 0.26, mats.orange, -1));
      g.add(legs(R, 2.4, mats.dark, 4));
      g.userData.props = { Type: 'Catalytic Reactor', 'ID (mm)': 300, 'Bed depth (mm)': 3300, 'Catalyst': 'Ni-Mo', 'Design P (barg)': 55, 'Design T (°C)': 420, 'Material': 'SS347 clad' };
      return g;
    },
    'filter': function () {
      var g = new THREE.Group();
      var R = 1.1, H = 3.4;
      var sh = cyl(R, R, H, mats.blue); sh.position.y = 2 + H / 2; g.add(sh);
      g.add(dishTop(R, 2 + H, mats.blue));
      var domeBot = mesh(new THREE.SphereGeometry(R, 18, 10), mats.blue); domeBot.scale.y = 0.5; domeBot.position.y = 2; domeBot.rotation.x = Math.PI; g.add(domeBot);
      for (var c = 0; c < 5; c++) { var a = c / 5 * Math.PI * 2; var el = cyl(0.16, 0.16, H * 0.7, mats.brass, 8); el.position.set(Math.cos(a) * R * 0.45, 2 + H * 0.5, Math.sin(a) * R * 0.45); g.add(el); }
      g.add(boltCircle(8, R * 0.9, 2 + H + 0.05, 'y', mats.bolt));
      g.add(nozzleX2(-R - 0.6, 2 + H * 0.8, 0.24, mats.blue, -1)); g.add(nozzleX2(R + 0.6, 2 + H * 0.8, 0.24, mats.steel, 1));
      var dr = cyl(0.22, 0.22, 0.8, mats.steel); dr.position.y = 1.6; g.add(dr);
      g.add(legs(R, 2, mats.dark, 3));
      g.userData.props = { Type: 'Cartridge Filter', 'Housing ID (mm)': 220, 'Elements': 5, 'Rating (µm)': 25, 'Design P (barg)': 10, 'Material': 'SS316' };
      return g;
    },
    'fan': function () {
      var g = new THREE.Group();
      var scroll = cyl(1.6, 1.6, 1.0, mats.green); scroll.rotation.x = Math.PI / 2; scroll.position.y = 2.2; g.add(scroll);
      var face = cyl(1.65, 1.65, 0.12, mats.dark); face.rotation.x = Math.PI / 2; face.position.set(0, 2.2, 0.55); g.add(face);
      var inlet = cyl(0.9, 0.6, 0.8, mats.steel); inlet.rotation.x = Math.PI / 2; inlet.position.set(0, 2.2, 1.1); g.add(inlet);
      var outlet = box(1.0, 1.4, 1.0, mats.green); outlet.position.set(0, 3.6, 0); g.add(outlet);
      var rotor = new THREE.Group();
      for (var b = 0; b < 12; b++) { var bl = box(0.1, 1.1, 0.35, mats.steel); bl.rotation.z = b / 12 * Math.PI * 2; rotor.add(bl); }
      rotor.position.set(0, 2.2, 0.1); rotor.userData.spin = 'z'; spinTag(rotor); g.add(rotor);
      var mot = cyl(0.7, 0.7, 1.6, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.set(2.0, 1.4, 0); g.add(mot);
      var bp = box(4.4, 0.3, 2.4, mats.dark); bp.position.y = 0.15; g.add(bp);
      g.userData.props = { Type: 'Centrifugal Fan / Blower', 'Flow (Am³/h)': 12000, 'Static (mmWC)': 250, 'RPM': 1450, 'Power (kW)': 15, 'Material': 'CS' };
      return g;
    }
  };

  /* helper variants that need mats defined at call-time */
  function spinTag(o) { spinList.push(o); }
  function flgZ(x, y, z, R) { var f = cyl(R, R, 0.14, mats.steel); f.rotation.x = Math.PI / 2; f.position.set(x, y, z); var g = new THREE.Group(); g.add(f); g.add(boltCircle(8, R * 0.78, z, 'z', mats.bolt)); return g; }
  function nozzleX2(x, y, r, mat, dir) { var g = new THREE.Group(); var n = cyl(r, r, 1.0, mat); n.rotation.z = Math.PI / 2; n.position.set(x + dir * 0.5, y, 0); g.add(n); var f = cyl(r * 1.7, r * 1.7, 0.14, mats.steel); f.rotation.z = Math.PI / 2; f.position.set(x + dir * 1.0, y, 0); g.add(f); return g; }
  function saddleAt(x, R, cy, mat) { var g = new THREE.Group(); var leg = box(1.2, cy - R + 0.4, 0.5, mat); leg.position.set(x, (cy - R) / 2, 0); g.add(leg); var base = box(1.8, 0.25, 1.8, mats.dark); base.position.set(x, 0.12, 0); g.add(base); return g; }
  function dishSideNeg(R, x, cy, mat) { var d = mesh(new THREE.SphereGeometry(R, 20, 12), mat); d.scale.x = 0.55; d.position.set(x, cy, 0); return d; }
  function dishSidePos(R, x, cy, mat) { return dishSideNeg(R, x, cy, mat); }
  // fix boltCircle for z axis
  var _bc = boltCircle;
  boltCircle = function (n, R, coord, axis, mat) {
    var g = new THREE.Group();
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; var b = cyl(0.05, 0.05, 0.18, mat, 6);
      if (axis === 'x') { b.rotation.z = Math.PI / 2; b.position.set(coord, Math.cos(a) * R, Math.sin(a) * R); }
      else if (axis === 'z') { b.position.set(Math.cos(a) * R, Math.sin(a) * R + 0, coord); }
      else { b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * R, coord, Math.sin(a) * R); }
      g.add(b); }
    return g;
  };

  /* Generic parametric factory for any workbench equipment type that has no
     dedicated model — chooses a realistic base shape from the type keyword. */
  function generic(type, label) {
    var t = String(type || '').toLowerCase();
    var g;
    if (/pump/.test(t)) g = FAC['centrifugal-pump']();
    else if (/blower|fan/.test(t)) g = FAC['fan']();
    else if (/comp|turbo|ejector/.test(t)) g = FAC['compressor']();
    else if (/plate|phe|gasket|brazed|welded-plate|spiral/.test(t)) g = FAC['plate-hx']();
    else if (/air-?cool|aircooler|fin-?fan|finned|air cooler/.test(t)) g = FAC['aircooler']();
    else if (/reboiler|kettle|evaporator|thermosiphon/.test(t)) g = FAC['reboiler']();
    else if (/sthe|shell|hx|exchanger|cooler|condenser|dphe|hairpin|economizer|chiller|heater/.test(t)) g = FAC['sthe']();
    else if (/reactor|cstr|pfr|pbr|fbr|bubble|loop|slurry|batch|catalytic|converter|hydrotreat|hdt|reform|cracker|coker|hcu|fcc/.test(t)) g = FAC['reactor']();
    else if (/column|absorber|stripper|scrubber|tower|fractionat|deaerator|extraction|distill|splitter|debutan|depropan|deethan/.test(t)) g = FAC['column']();
    else if (/filter|strainer|cartridge|bag|basket|duplex|coalescer|self-clean|cyclone|hydrocyclone/.test(t)) g = FAC['filter']();
    else if (/bullet|lpg|sphere|receiver|accumulator|air-receiver/.test(t)) g = FAC['bullet']();
    else if (/cone|floating|api6|dome-roof|silo|hopper|storage/.test(t)) g = FAC['cone-tank']();
    else if (/tank/.test(t)) g = FAC['cone-tank']();
    else if (/v-vessel|vertical|surge|knockout/.test(t)) g = FAC['v-vessel']();
    else if (/separat|drum|ko|flash|demister|vessel|vacuum-vessel|h-vessel|horizontal/.test(t)) g = FAC['h-vessel']();
    else if (/ball|plug/.test(t)) g = FAC['ball-valve']();
    else if (/valve|gate|globe|butterfly|check|psv|prv|solenoid|needle|control|knife|foot|pinch|diaphragm|safety|relief|cryo-valve|angle|sampling|flush|3way/.test(t)) g = FAC['gate-valve']();
    else if (/mixer|agitat|blend/.test(t)) g = FAC['v-vessel']();
    else {
      // fallback: a labelled, colourful parametric block (still better than a grey box)
      g = new THREE.Group();
      var pal = [mats.blue, mats.orange, mats.green, mats.copper, mats.navy];
      var col = pal[Math.abs(hashStr(t)) % pal.length];
      var bb = box(2.6, 2.6, 2.6, col); bb.position.y = 1.7; g.add(bb);
      var cap = cyl(1.35, 1.35, 0.4, mats.steel); cap.position.y = 3.2; g.add(cap);
      var n1 = cyl(0.32, 0.32, 1, mats.steel); n1.rotation.z = Math.PI / 2; n1.position.set(-1.6, 1.7, 0); g.add(n1);
      var n2 = n1.clone(); n2.position.x = 1.6; g.add(n2);
      var bp = box(3.2, 0.3, 3.2, mats.dark); bp.position.y = 0.15; g.add(bp);
      g.userData.props = { Type: label || type, Note: 'Parametric 3D model' };
    }
    if (g.userData.props && label) g.userData.props.Type = label;
    return g;
  }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function addPort(g, role, localPos) {
    var col = role === 'in' ? 0x16a34a : 0x2563eb;
    var s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.4 }));
    s.position.copy(localPos); s.userData.port = { role: role, group: g };
    g.add(s); portMeshes.push(s);
    (g.userData.ports = g.userData.ports || []).push(s);
  }
  A3.addByType = function (type, label, nid) {
    if (!mats) mats = M();
    var g = FAC[type] ? FAC[type]() : generic(type, label);
    // Connection ports from the equipment's own bounding box (inlet = -X, outlet = +X)
    var bb = new THREE.Box3().setFromObject(g);
    var midY = (bb.min.y + bb.max.y) / 2;
    addPort(g, 'in', new THREE.Vector3(bb.min.x - 0.35, midY, 0));
    addPort(g, 'out', new THREE.Vector3(bb.max.x + 0.35, midY, 0));
    // generous grid so large models never overlap (each cell ~13 units)
    g.position.x = (objects.length % 5) * 13 - 26;
    g.position.z = Math.floor(objects.length / 5) * 13 - 13;
    g.userData.key = type;
    if (nid) g.userData.nid = nid;
    scene.add(g); objects.push(g); select(g);
    if (embStatus) embStatus((g.userData.props ? g.userData.props.Type : type) + ' added as real 3D mesh (' + countTris(g) + ' tris). ' + (pipeMode ? 'Click its blue OUT port then another IN port to pipe them.' : 'Turn on the Pipe tool to connect equipment.'));
    return g;
  };

  // straight steel pipe cylinder from world point p to q
  function tube(p, q, r, mat) {
    var dir = new THREE.Vector3().subVectors(q, p), len = dir.length();
    if (len < 0.001) return null;
    var m = mesh(new THREE.CylinderGeometry(r, r, len, 16), mat);
    m.position.copy(p).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return m;
  }
  function elbow(p, r, mat) { var e = mesh(new THREE.SphereGeometry(r * 1.15, 12, 10), mat); e.position.copy(p); return e; }
  // orthogonal 3D pipe route between two ports (out along X, across Z, into target)
  function buildPipe(fromPort, toPort, color) {
    var pa = new THREE.Vector3(), pb = new THREE.Vector3();
    fromPort.getWorldPosition(pa); toPort.getWorldPosition(pb);
    // each pipe carries its OWN material so it can be recoloured individually
    var col = color || '#b8c0cc';
    var mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col), metalness: 0.9, roughness: 0.35 });
    var emat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.6), metalness: 0.85, roughness: 0.45 });
    var r = 0.22, y = (pa.y + pb.y) / 2;
    var w1 = new THREE.Vector3(pa.x + Math.sign(pb.x - pa.x || 1) * 1.2, pa.y, pa.z);
    var w2 = new THREE.Vector3(w1.x, y, pa.z);
    var w3 = new THREE.Vector3(pb.x - Math.sign(pb.x - pa.x || 1) * 1.2, y, pb.z);
    var pts = [pa, w1, w2, w3, pb];
    var grp = new THREE.Group();
    for (var i = 0; i < pts.length - 1; i++) { var t = tube(pts[i], pts[i + 1], r, mat); if (t) grp.add(t); }
    for (var j = 1; j < pts.length - 1; j++) grp.add(elbow(pts[j], r, emat));
    var fg = fromPort.userData.port.group, tg = toPort.userData.port.group;
    grp.userData.pipe = { from: fromPort, to: toPort, fromNid: fg.userData.nid, toNid: tg.userData.nid, mat: mat, emat: emat, color: col };
    scene.add(grp); pipes3d.push(grp);
    // write the connection back to the shared 2D model so it survives a 2D toggle
    if (!rebuilding && typeof A3.onConnect === 'function' && fg.userData.nid && tg.userData.nid) {
      A3.onConnect(fg.userData.nid, tg.userData.nid, fromPort.userData.port.role, toPort.userData.port.role);
    }
    if (embStatus) embStatus('Pipe connected: ' + portLabel(fromPort) + ' → ' + portLabel(toPort) + ' · ' + pipes3d.length + ' pipe(s). Keep clicking ports to add more.');
    return grp;
  }
  function groupByNid(nid) { for (var i = 0; i < objects.length; i++) if (objects[i].userData.nid === nid) return objects[i]; return null; }
  function portOf(g, role) { return (g && g.userData.ports || []).filter(function (p) { return p.userData.port.role === role; })[0]; }
  function portLabel(pm) { var g = pm.userData.port.group; return (g.userData.props ? g.userData.props.Type : 'equip') + ' ' + pm.userData.port.role.toUpperCase(); }

  // connect equipment i's OUT port to equipment j's IN port (programmatic)
  A3.connect = function (i, j) {
    var a = objects[i], b = objects[j]; if (!a || !b) return null;
    var op = (a.userData.ports || []).filter(function (p) { return p.userData.port.role === 'out'; })[0];
    var ip = (b.userData.ports || []).filter(function (p) { return p.userData.port.role === 'in'; })[0];
    if (op && ip) return buildPipe(op, ip);
    return null;
  };
  A3.pipeCount = function () { return pipes3d.length; };
  // Rebuild the whole 3D scene from the shared 2D model (nodes + pipes) so the
  // entire current process carries over when the user toggles 2D → 3D.
  A3.buildFromModel = function (nodes, pipes, nameOf) {
    if (!scene) return;
    rebuilding = true;
    A3.clearAll();
    // lay equipment out on a roomy grid in flow order — fixed cells keep even the
    // largest models (columns, air-coolers) clear of one another (no overlap).
    var cols = Math.max(1, Math.min(5, Math.ceil(Math.sqrt((nodes || []).length))));
    (nodes || []).forEach(function (n, idx) {
      var g = A3.addByType(n.t, nameOf ? nameOf(n.t) : n.t, n.id);
      g.position.x = (idx % cols) * 15 - (cols - 1) * 7.5;
      g.position.z = Math.floor(idx / cols) * 14 - 7;
      if (n.rot) g.rotation.y = -n.rot * Math.PI / 180;
    });
    (pipes || []).forEach(function (p) {
      var a = groupByNid(p.from.id), b = groupByNid(p.to.id);
      var op = portOf(a, 'out') || portOf(a, 'in'), ip = portOf(b, 'in') || portOf(b, 'out');
      if (op && ip) { var g = buildPipe(op, ip, p.color); if (g) g.userData.pipe.pid = p.id; }
    });
    rebuilding = false;
    if (objects.length) {
      // frame the whole flowsheet
      var bb = new THREE.Box3(); objects.forEach(function (o) { bb.expandByObject(o); });
      var c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      sph.tx = c.x; sph.ty = c.y; sph.tz = c.z;
      sph.theta = Math.PI / 4; sph.phi = 1.0;
      sph.r = Math.max(16, Math.max(sz.x, sz.y, sz.z) * 1.7);
      updateCamera();
    }
    if (embStatus) embStatus(objects.length + ' equipment · ' + pipes3d.length + ' pipe(s) loaded into 3D from your flowsheet. Drag to orbit, wheel to zoom.');
  };
  // rotate the currently-selected equipment about its vertical axis (360° control)
  A3.rotateSelected = function (deg) {
    if (!picked) { if (embStatus) embStatus('Click an equipment first, then use the rotate buttons to turn it.'); return false; }
    picked.rotation.y += deg * Math.PI / 180;
    if (embStatus) embStatus('Rotated ' + (picked.userData.props ? picked.userData.props.Type : 'equipment') + '.');
    return true;
  };
  A3.hasSelection = function () { return !!picked; };
  A3.setPipeMode = function (on) {
    pipeMode = on; pendingPort = null;
    portMeshes.forEach(function (s) { s.material.emissiveIntensity = on ? 0.9 : 0.5; s.scale.setScalar(on ? 1.4 : 1); });
    if (embStatus) embStatus(on ? 'PIPE TOOL ON — click an equipment OUT port (blue), then another IN port (green) to route a real 3D pipe between them.' : 'Pipe tool off.');
  };
  function colorPipe(grp, hex) {
    var pd = grp.userData.pipe; if (!pd) return;
    pd.color = hex; pd.mat.color.set(hex); pd.emat.color.set(new THREE.Color(hex).multiplyScalar(0.6));
  }
  // recolour every pipe in the scene
  A3.setAllPipeColor = function (hex) { pipes3d.forEach(function (g) { colorPipe(g, hex); }); if (embStatus) embStatus('All ' + pipes3d.length + ' pipe(s) recoloured to ' + hex + '.'); };
  // recolour the currently selected pipe only (returns its 2D pipe id if any)
  A3.setSelectedPipeColor = function (hex) {
    if (!pickedPipe) return null;
    colorPipe(pickedPipe, hex);
    if (embStatus) embStatus('Line recoloured to ' + hex + '.');
    return pickedPipe.userData.pipe.pid || null;
  };
  A3.selectedPipeId = function () { return pickedPipe ? (pickedPipe.userData.pipe.pid || null) : null; };
  A3.clearAll = function () { objects.forEach(function (o) { scene.remove(o); }); pipes3d.forEach(function (o) { scene.remove(o); }); objects = []; pipes3d = []; portMeshes = []; spinList = []; picked = null; pickedPipe = null; pendingPort = null; };
  A3.view = function (v) { view(v); };
  A3.setMode = function (m, on) { setMode(m, on); };
  A3.explode = function (f) { explode(f); };
  A3.setBg = function (hex) { if (scene) scene.background = new THREE.Color(hex); };
  A3.selectedProps = function () { return picked ? picked.userData.props : null; };
  A3.exportOBJ = function () { exportOBJ(); };

  var CATALOG = [
    ['centrifugal-pump', 'Centrifugal Pump'], ['compressor', 'Compressor'],
    ['sthe', 'Shell & Tube HX'], ['reboiler', 'Kettle Reboiler'],
    ['v-vessel', 'Vertical Vessel'], ['h-vessel', 'Horizontal Vessel'],
    ['column', 'Distillation Column'], ['cone-tank', 'Cone Roof Tank'],
    ['bullet', 'LPG Bullet Tank'], ['gate-valve', 'Gate Valve'], ['ball-valve', 'Ball Valve']
  ];

  /* ─────────── Scene / renderer / lighting ─────────── */
  function buildScene(canvas) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;

    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2b3242, 0.7));
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    var dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(12, 20, 10); dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048); dir.shadow.camera.near = 1; dir.shadow.camera.far = 80;
    dir.shadow.camera.left = -30; dir.shadow.camera.right = 30; dir.shadow.camera.top = 30; dir.shadow.camera.bottom = -30;
    scene.add(dir);
    var fill = new THREE.DirectionalLight(0x99bbff, 0.3); fill.position.set(-10, 8, -8); scene.add(fill);

    ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x141b2b, metalness: 0, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    grid = new THREE.GridHelper(120, 60, 0x334155, 0x1e293b); scene.add(grid);

    clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 40);
  }

  function updateCamera() {
    var x = sph.r * Math.sin(sph.phi) * Math.sin(sph.theta);
    var y = sph.r * Math.cos(sph.phi);
    var z = sph.r * Math.sin(sph.phi) * Math.cos(sph.theta);
    camera.position.set(sph.tx + x, sph.ty + y, sph.tz + z);
    camera.lookAt(sph.tx, sph.ty, sph.tz);
  }

  /* ─────────── Add / select / display modes ─────────── */
  function addEquipment(key) {
    if (!FAC[key]) return;
    var g = FAC[key]();
    g.position.x = (objects.length % 4) * 8 - 12;
    g.position.z = Math.floor(objects.length / 4) * 8;
    g.userData.key = key;
    scene.add(g); objects.push(g);
    select(g);
    setStatus('Added ' + (g.userData.props ? g.userData.props.Type : key) + ' — real 3D mesh (' + countTris(g) + ' triangles).');
  }
  function countTris(g) { var n = 0; g.traverse(function (o) { if (o.isMesh && o.geometry) { var p = o.geometry.attributes.position; if (p) n += (o.geometry.index ? o.geometry.index.count : p.count) / 3; } }); return Math.round(n); }

  function select(g) {
    if (picked) picked.traverse(function (o) { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0x000000); });
    picked = g;
    if (g) g.traverse(function (o) { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0x1e3a5f); });
    renderProps();
  }

  function setMode(mode, on) {
    objects.forEach(function (g) { g.traverse(function (o) {
      if (!o.isMesh) return;
      if (mode === 'wire') o.material.wireframe = on;
      if (mode === 'xray') { o.material.transparent = on; o.material.opacity = on ? 0.4 : 1; o.material.needsUpdate = true; }
    }); });
    if (mode === 'section') renderer.clippingPlanes = on ? [clipPlane] : [];
  }
  function explode(f) {
    objects.forEach(function (g) {
      g.children.forEach(function (c) {
        if (!c.userData.home) c.userData.home = c.position.clone();
        var d = c.userData.home.clone().sub(new THREE.Vector3(0, 2, 0)).normalize();
        c.position.copy(c.userData.home).addScaledVector(d, f);
      });
    });
  }

  /* ─────────── View presets ─────────── */
  function view(v) {
    var d = 16;
    var P = { top: [0.001, 0.001], front: [0, Math.PI / 2], back: [Math.PI, Math.PI / 2], left: [-Math.PI / 2, Math.PI / 2], right: [Math.PI / 2, Math.PI / 2], iso: [Math.PI / 4, 1.0] };
    if (v === 'perspective') { camera.fov = 45; camera.updateProjectionMatrix(); return; }
    var p = P[v] || P.iso; sph.theta = p[0]; sph.phi = Math.max(0.05, p[1]); sph.r = d; updateCamera();
  }

  /* ─────────── OBJ export (real vertex/face geometry) ─────────── */
  function exportOBJ() {
    var out = '# ARO Workbench 3D export (OBJ)\n', vOff = 1;
    var v = new THREE.Vector3();
    objects.forEach(function (g, gi) {
      out += 'o equipment_' + gi + '_' + (g.userData.key || 'obj') + '\n';
      g.updateWorldMatrix(true, true);
      g.traverse(function (o) {
        if (!o.isMesh || !o.geometry) return;
        var geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
        var pos = geo.attributes.position, cnt = pos.count, base = vOff;
        for (var i = 0; i < cnt; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); out += 'v ' + v.x.toFixed(4) + ' ' + v.y.toFixed(4) + ' ' + v.z.toFixed(4) + '\n'; }
        for (var f = 0; f < cnt; f += 3) out += 'f ' + (base + f) + ' ' + (base + f + 1) + ' ' + (base + f + 2) + '\n';
        vOff += cnt;
      });
    });
    var blob = new Blob([out], { type: 'text/plain' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aro-workbench-3d.obj'; a.click();
    setStatus('Exported ' + objects.length + ' equipment as OBJ (real mesh geometry).');
  }
  // Scene JSON (Three.js Object format — importable / convertible to glTF)
  function exportJSON() {
    var root = new THREE.Group(); objects.forEach(function (g) { root.add(g.clone()); });
    var json = JSON.stringify(root.toJSON());
    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aro-workbench-3d.json'; a.click();
    setStatus('Exported scene as Three.js JSON (convertible to glTF/GLB).');
  }

  /* ─────────── UI ─────────── */
  function css() {
    if (document.getElementById('aro3d-css')) return;
    var s = document.createElement('style'); s.id = 'aro3d-css';
    s.textContent = [
      '#aro3d{position:fixed;inset:0;z-index:100050;background:#0b1220;display:flex;flex-direction:column;font-family:Arial,sans-serif;}',
      '.a3-bar{display:flex;align-items:center;gap:5px;background:#0f172a;padding:7px 12px;flex-wrap:wrap;border-bottom:1px solid #1e293b;}',
      '.a3-brand{color:#38bdf8;font-weight:800;font-family:monospace;font-size:13px;margin-right:12px;letter-spacing:0.05em;}',
      '.a3-btn{background:#1e293b;border:1px solid #334155;color:#cbd5e1;font-size:11px;padding:5px 9px;border-radius:5px;cursor:pointer;}',
      '.a3-btn:hover{background:#334155;color:#fff;}',
      '.a3-btn.on{background:#0ea5e9;color:#fff;border-color:#0284c7;}',
      '.a3-sep{width:1px;height:20px;background:#334155;margin:0 4px;}',
      '.a3-close{margin-left:auto;background:#dc2626;border:none;color:#fff;padding:6px 14px;border-radius:5px;cursor:pointer;font-weight:700;}',
      '.a3-body{flex:1;display:grid;grid-template-columns:180px 1fr 220px;min-height:0;}',
      '.a3-lib{background:#0f172a;border-right:1px solid #1e293b;overflow-y:auto;padding:8px;}',
      '.a3-lib h4{color:#38bdf8;font-size:10px;letter-spacing:0.08em;margin:6px 4px;text-transform:uppercase;}',
      '.a3-lib button{display:block;width:100%;text-align:left;background:#1e293b;border:1px solid #334155;color:#e2e8f0;font-size:11px;padding:7px 9px;border-radius:5px;margin-bottom:5px;cursor:pointer;}',
      '.a3-lib button:hover{background:#0ea5e9;color:#fff;}',
      '.a3-view{position:relative;background:#0b1220;}',
      '.a3-canvas{width:100%;height:100%;display:block;cursor:grab;}',
      '.a3-canvas:active{cursor:grabbing;}',
      '.a3-props{background:#0f172a;border-left:1px solid #1e293b;overflow-y:auto;padding:10px;color:#cbd5e1;}',
      '.a3-props h4{color:#38bdf8;font-size:11px;margin:0 0 8px;letter-spacing:0.05em;}',
      '.a3-prow{display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid #1e293b;}',
      '.a3-prow b{color:#fff;font-family:monospace;}',
      '.a3-status{background:#0f172a;border-top:1px solid #1e293b;color:#94a3b8;font-family:monospace;font-size:11px;padding:6px 12px;}',
      '.a3-hint{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);background:rgba(15,23,42,0.85);color:#cbd5e1;font-size:10px;padding:4px 12px;border-radius:20px;pointer-events:none;}'
    ].join('');
    document.head.appendChild(s);
  }

  function buildUI() {
    css();
    var lib = CATALOG.map(function (c) { return '<button data-add="' + c[0] + '">' + c[1] + '</button>'; }).join('');
    host = document.createElement('div'); host.id = 'aro3d';
    host.innerHTML =
      '<div class="a3-bar"><span class="a3-brand">🧊 ARO 3D CAD ENGINE</span>'
      + '<button class="a3-btn" data-view="iso">ISO</button><button class="a3-btn" data-view="top">Top</button><button class="a3-btn" data-view="front">Front</button><button class="a3-btn" data-view="left">Left</button><button class="a3-btn" data-view="right">Right</button><button class="a3-btn" data-view="perspective">Persp</button>'
      + '<span class="a3-sep"></span>'
      + '<button class="a3-btn" data-mode="wire">Wireframe</button><button class="a3-btn" data-mode="xray">Transparent</button><button class="a3-btn" data-mode="section">Section</button>'
      + '<span class="a3-sep"></span>'
      + '<button class="a3-btn" data-explode="up">Explode +</button><button class="a3-btn" data-explode="dn">Explode −</button>'
      + '<span class="a3-sep"></span>'
      + '<button class="a3-btn" data-exp="obj">Export OBJ</button><button class="a3-btn" data-exp="json">Export JSON</button>'
      + '<button class="a3-close" id="a3-close">✕ CLOSE 3D</button></div>'
      + '<div class="a3-body">'
      + '<div class="a3-lib"><h4>Equipment Library</h4>' + lib + '</div>'
      + '<div class="a3-view"><canvas class="a3-canvas" id="a3-canvas"></canvas><div class="a3-hint">Left-drag = orbit 360° · wheel = zoom · right/middle-drag = pan · click = select</div></div>'
      + '<div class="a3-props"><h4>PROPERTIES</h4><div id="a3-props-body">Add equipment from the library, then click it to see live properties.</div></div>'
      + '</div><div class="a3-status" id="a3-status">Ready — real Three.js CAD viewport. Add equipment from the left library.</div>';
    document.body.appendChild(host);
    wire();
  }
  function setStatus(m) { var el = document.getElementById('a3-status'); if (el) el.textContent = m; }
  function renderProps() {
    if (embedded && typeof A3.onSelect === 'function') { A3.onSelect(picked ? picked.userData.props : null, picked ? countTris(picked) : 0); }
    var el = document.getElementById('a3-props-body'); if (!el) return;
    if (!picked || !picked.userData.props) { el.innerHTML = 'Add equipment from the library, then click it to see live properties.'; return; }
    var p = picked.userData.props;
    el.innerHTML = Object.keys(p).map(function (k) { return '<div class="a3-prow"><span>' + k + '</span><b>' + p[k] + '</b></div>'; }).join('')
      + '<div style="margin-top:8px;font-size:10px;color:#64748b;">Real mesh · ' + countTris(picked) + ' triangles · PBR MeshStandardMaterial</div>';
  }

  function wire() {
    var canvas = document.getElementById('a3-canvas');
    buildScene(canvas); updateCamera();
    host.querySelectorAll('[data-add]').forEach(function (b) { b.addEventListener('click', function () { addEquipment(b.getAttribute('data-add')); }); });
    host.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { view(b.getAttribute('data-view')); }); });
    host.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('on'); setMode(b.getAttribute('data-mode'), b.classList.contains('on')); }); });
    var exf = 0; host.querySelector('[data-explode="up"]').addEventListener('click', function () { exf = Math.min(exf + 0.8, 4); explode(exf); });
    host.querySelector('[data-explode="dn"]').addEventListener('click', function () { exf = Math.max(exf - 0.8, 0); explode(exf); });
    host.querySelector('[data-exp="obj"]').addEventListener('click', exportOBJ);
    host.querySelector('[data-exp="json"]').addEventListener('click', exportJSON);
    document.getElementById('a3-close').addEventListener('click', close);
    wireControls(canvas);
    animate(); view('iso');
    addEquipment('sthe'); addEquipment('centrifugal-pump');   // seed examples
  }

  // Real spherical orbit + raycast selection on any canvas (reused for embed)
  function wireControls(canvas) {
    var down = null, dragConn = null;
    var ray = new THREE.Raycaster(), m2 = new THREE.Vector2();
    // find a port under the cursor — a tiny port sphere, or the nearest free port
    // of whatever equipment body the cursor is over (preferRole picked first).
    function portAt(e, preferRole) {
      var r = canvas.getBoundingClientRect(); m2.x = ((e.clientX - r.left) / r.width) * 2 - 1; m2.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(m2, camera);
      var ph = ray.intersectObjects(portMeshes, false);
      if (ph.length) return ph[0].object;
      var bh = ray.intersectObjects(objects, true);
      if (bh.length) { var og = bh[0].object; while (og.parent && objects.indexOf(og) < 0) og = og.parent; return portOf(og, preferRole) || portOf(og, preferRole === 'in' ? 'out' : 'in'); }
      return null;
    }
    canvas.addEventListener('mousedown', function (e) {
      // In pipe mode, a left-press on a port/equipment starts a drag-to-connect
      // (just like 2D). Otherwise it orbits the camera.
      if (pipeMode && e.button === 0) {
        var sp = portAt(e, 'out');
        if (sp) { dragConn = { start: sp }; sp.material.emissive.setHex(0xffffff); sp.scale.setScalar(1.9); if (embStatus) embStatus('Drag to the second equipment and release to connect…'); return; }
      }
      down = { x: e.clientX, y: e.clientY, b: e.button, th: sph.theta, ph: sph.phi, tx: sph.tx, ty: sph.ty, tz: sph.tz };
    });
    window.addEventListener('mousemove', function (e) {
      if (dragConn) return; // suppress orbit while wiring a pipe
      if (!down) return; var dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (down.b === 0) { sph.theta = down.th - dx * 0.01; sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, down.ph - dy * 0.01)); }
      else { var pan = sph.r * 0.0016; sph.tx = down.tx - dx * pan * Math.cos(sph.theta); sph.tz = down.tz + dx * pan * Math.sin(sph.theta); sph.ty = down.ty + dy * pan; }
      updateCamera();
    });
    window.addEventListener('mouseup', function (e) {
      if (dragConn) {
        var tp = portAt(e, 'in'), sp = dragConn.start;
        if (tp && tp !== sp && tp.userData.port.group !== sp.userData.port.group) buildPipe(sp, tp);
        sp.material.emissive.setHex(sp.userData.port.role === 'in' ? 0x16a34a : 0x2563eb); sp.scale.setScalar(1.4);
        dragConn = null;
      }
      down = null;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); sph.r = Math.max(3, Math.min(80, sph.r * (e.deltaY < 0 ? 0.9 : 1.1))); updateCamera(); }, { passive: false });
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect(); m2.x = ((e.clientX - r.left) / r.width) * 2 - 1; m2.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(m2, camera);
      // Pipe tool: connect equipment ports. Clicking a tiny port OR anywhere on
      // the equipment body works — the body click grabs that equipment's nearest
      // free port automatically, so connecting is easy and forgiving.
      if (pipeMode) {
        var pm = null;
        var ph = ray.intersectObjects(portMeshes, false);
        if (ph.length) { pm = ph[0].object; }
        else {
          var bh = ray.intersectObjects(objects, true);
          if (bh.length) {
            var og = bh[0].object; while (og.parent && objects.indexOf(og) < 0) og = og.parent;
            // if no pending yet, prefer the OUT port; once pending, prefer the IN port
            pm = portOf(og, pendingPort ? 'in' : 'out') || portOf(og, pendingPort ? 'out' : 'in');
          }
        }
        if (pm) {
          if (!pendingPort) { pendingPort = pm; pm.material.emissive.setHex(0xffffff); pm.scale.setScalar(1.9); if (embStatus) embStatus('Start: ' + portLabel(pm) + ' — now click the SECOND equipment (or its green IN port) to connect.'); }
          else if (pendingPort !== pm && pendingPort.userData.port.group !== pm.userData.port.group) {
            buildPipe(pendingPort, pm);
            pendingPort.material.emissive.setHex(pendingPort.userData.port.role === 'in' ? 0x16a34a : 0x2563eb); pendingPort.scale.setScalar(1.4);
            pendingPort = null;
          }
        }
        return;
      }
      // normal mode: select equipment, or a pipe (for recolouring)
      var hit = ray.intersectObjects(objects, true);
      if (hit.length) { var o = hit[0].object; while (o.parent && objects.indexOf(o) < 0) o = o.parent; pickedPipe = null; select(o); return; }
      var hp = ray.intersectObjects(pipes3d, true);
      if (hp.length) {
        var pg = hp[0].object; while (pg.parent && pipes3d.indexOf(pg) < 0) pg = pg.parent;
        pickedPipe = pg; select(null);
        if (embStatus) embStatus('Line selected — use the LINE colour swatch to recolour just this line, or “all lines” for the whole flowsheet.');
        if (typeof A3.onPipeSelect === 'function') A3.onPipeSelect(pg.userData.pipe.pid || null);
        return;
      }
      pickedPipe = null; select(null);
    });
    window.addEventListener('resize', function () { A3.resize(); });
  }

  // ── Embed the real 3D scene into an existing container (the workbench) ──
  A3.embed = function (canvas, statusCb) {
    if (embedded) { embCanvas = canvas; A3.resize(); return; }
    mats = M(); embedded = true; embCanvas = canvas; embStatus = statusCb || null;
    buildScene(canvas); updateCamera(); wireControls(canvas); animate(); view('iso');
  };
  A3.resize = function () {
    var c = embedded ? embCanvas : document.getElementById('a3-canvas');
    if (!renderer || !c || !c.clientWidth) return;
    camera.aspect = c.clientWidth / c.clientHeight; camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth, c.clientHeight, false);
  };
  function onResize() { A3.resize(); }
  function animate() {
    raf = requestAnimationFrame(animate);
    spinList.forEach(function (o) { var ax = o.userData.spin; if (ax === 'z') o.rotation.z += 0.08; else o.rotation.x += 0.08; });
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function open() {
    if (host) { host.style.display = 'flex'; onResize(); return; }
    mats = M();
    buildUI();
  }
  function close() { if (raf) cancelAnimationFrame(raf); if (host) host.remove(); host = null; renderer && renderer.dispose && renderer.dispose(); renderer = null; objects = []; spinList = []; picked = null; }
})();
