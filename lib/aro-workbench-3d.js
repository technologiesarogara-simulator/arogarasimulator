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
    glass:   new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35 }),
    teal:    new THREE.MeshStandardMaterial({ color: 0x0d9488, metalness: 0.6, roughness: 0.4 }),
    purple:  new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.5, roughness: 0.4 }),
    gold:    new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.3 }),
    maroon:  new THREE.MeshStandardMaterial({ color: 0x9f1239, metalness: 0.55, roughness: 0.45 }),
    silver:  new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.28 }),
    gunmetal:new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.85, roughness: 0.38 }),
    white:   new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.2, roughness: 0.55 }),
    forest:  new THREE.MeshStandardMaterial({ color: 0x15803d, metalness: 0.5, roughness: 0.4 }),
    sky:     new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.4, roughness: 0.4 })
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
      for (var f = 0; f < 10; f++) { var fin = torus(1.02, 0.04, mats.dark); fin.rotation.y = Math.PI / 2; fin.position.set(-0.1 + f * 0.26, 1.4, 0); g.add(fin); }
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
      var sh = cyl(R, R, H, mats.purple); sh.position.y = 2 + H / 2; g.add(sh);
      g.add(dishTop(R, 2 + H, mats.purple)); g.add(dishBot(R, 2, mats.purple));
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
    },
    'electrical-machine': function () {                     // TEFC motor / generator — finned barrel, terminal box, shaft
      var g = new THREE.Group();
      var body = cyl(1.1, 1.1, 2.6, mats.navy); body.rotation.z = Math.PI / 2; body.position.y = 1.9; g.add(body);
      for (var f = 0; f < 11; f++) { var fin = torus(1.14, 0.05, mats.dark); fin.rotation.y = Math.PI / 2; fin.position.set(-1.1 + f * 0.22, 1.9, 0); g.add(fin); }
      var db = box(0.9, 1.0, 0.8, mats.dark); db.position.set(0, 2.9, 0); g.add(db);
      var endA = cyl(1.15, 1.15, 0.3, mats.dark); endA.rotation.z = Math.PI / 2; endA.position.set(-1.3, 1.9, 0); g.add(endA);
      var endB = cyl(0.9, 0.9, 0.3, mats.dark); endB.rotation.z = Math.PI / 2; endB.position.set(1.3, 1.9, 0); g.add(endB);
      var shaft = cyl(0.22, 0.22, 0.6, mats.steel); shaft.rotation.z = Math.PI / 2; shaft.position.set(1.75, 1.9, 0); g.add(shaft);
      var bp = box(3.2, 0.25, 1.8, mats.dark); bp.position.y = 0.5; g.add(bp);
      var f1 = box(0.5, 0.5, 1.6, mats.dark); f1.position.set(-1.3, 0.35, 0); g.add(f1);
      var f2 = box(0.5, 0.5, 1.6, mats.dark); f2.position.set(1.3, 0.35, 0); g.add(f2);
      g.userData.props = { Type: 'Electric Motor (TEFC)', 'Power (kW)': 15, 'RPM': 2950, 'Voltage (V)': 415, 'Frame': 'IE3', 'Enclosure': 'TEFC', 'Material': 'CI frame' };
      return g;
    },
    'transformer': function () {                            // oil-filled distribution transformer — tank, side radiators, top bushings
      var g = new THREE.Group();
      var tank = box(2.6, 2.2, 1.8, mats.green); tank.position.y = 1.6; g.add(tank);
      [-1.5, 1.5].forEach(function (fx) {
        for (var r = 0; r < 4; r++) { var rad = box(0.06, 1.6, 1.3, mats.dark); rad.position.set(fx + (fx > 0 ? r * 0.14 : -r * 0.14), 1.6, 0); g.add(rad); }
      });
      var cons = cyl(0.35, 0.35, 0.7, mats.dark); cons.rotation.z = Math.PI / 2; cons.position.set(0, 2.9, 0); g.add(cons);
      [-0.7, 0, 0.7].forEach(function (bx) {
        var bush = cyl(0.14, 0.2, 1.1, mats.dark, 14); bush.position.set(bx, 3.3, 0.5); g.add(bush);
        var cap = cyl(0.16, 0.16, 0.16, mats.bolt); cap.position.set(bx, 3.85, 0.5); g.add(cap);
      });
      var bp = box(3.4, 0.25, 2.4, mats.dark); bp.position.y = 0.4; g.add(bp);
      g.userData.props = { Type: 'Distribution Transformer', 'Rating (kVA)': 500, 'Primary (kV)': 11, 'Secondary (V)': 415, 'Cooling': 'ONAN', 'Material': 'CS tank' };
      return g;
    },
    'panel': function () {                                  // switchgear / VFD / MCC / junction box — cabinet with door seam + glands
      var g = new THREE.Group();
      var cab = box(2.4, 3.0, 1.0, mats.steel); cab.position.y = 1.6; g.add(cab);
      var door = box(2.2, 2.8, 0.06, mats.dark); door.position.set(0, 1.6, 0.53); g.add(door);
      var seam = box(0.03, 2.8, 0.08, mats.bolt); seam.position.set(0, 1.6, 0.56); g.add(seam);
      var handle = box(0.1, 0.4, 0.14, mats.bolt); handle.position.set(0.95, 1.6, 0.58); g.add(handle);
      [2.85, 2.55].forEach(function (ly, i) {
        var lamp = mesh(new THREE.SphereGeometry(0.08, 10, 8), i === 0 ? mats.green : mats.red);
        lamp.position.set(-0.8 + i * 0.3, ly, 0.58); g.add(lamp);
      });
      for (var c = 0; c < 3; c++) { var gl = cyl(0.09, 0.09, 0.3, mats.dark, 10); gl.rotation.x = Math.PI / 2; gl.position.set(-0.7 + c * 0.7, 0.15, 0); g.add(gl); }
      var bp = box(2.6, 0.2, 1.2, mats.dark); bp.position.y = 0.05; g.add(bp);
      g.userData.props = { Type: 'Electrical Panel', 'Voltage (V)': 415, 'Rating (A)': 630, 'IP Rating': 'IP54', 'Material': 'CRCA sheet steel' };
      return g;
    },
    'support': function () {                                // pipe support — U-clamp on a stub, strut, baseplate
      var g = new THREE.Group();
      var pipe = cyl(0.4, 0.4, 2.4, mats.steel); pipe.rotation.z = Math.PI / 2; pipe.position.y = 2.4; g.add(pipe);
      var clampA = torus(0.44, 0.07, mats.dark); clampA.rotation.y = Math.PI / 2; clampA.position.set(-0.6, 2.4, 0); g.add(clampA);
      var clampB = clampA.clone(); clampB.position.x = 0.6; g.add(clampB);
      var strut = box(0.3, 2.0, 0.3, mats.dark); strut.position.y = 1.4; g.add(strut);
      var gusset = box(0.9, 0.12, 0.3, mats.dark); gusset.rotation.z = 0.5; gusset.position.set(0.35, 1.9, 0); g.add(gusset);
      var base = box(1.6, 0.25, 1.6, mats.dark); base.position.y = 0.15; g.add(base);
      g.userData.props = { Type: 'Pipe Support', 'Load (kN)': 8, 'Function': 'Fixed / Guide', 'Material': 'CS structural' };
      return g;
    },
    'flange-fitting': function () {                         // weld-neck / blind / manway — flanged nozzle stub off a wall pad
      var g = new THREE.Group();
      var stub = cyl(0.5, 0.5, 1.4, mats.steel); stub.rotation.z = Math.PI / 2; stub.position.y = 1.8; g.add(stub);
      var face = cyl(0.95, 0.95, 0.18, mats.dark); face.rotation.z = Math.PI / 2; face.position.set(0.7, 1.8, 0); g.add(face);
      g.add(boltCircle(8, 0.74, 0.7, 'x', mats.bolt));
      var pad = box(0.6, 1.8, 0.6, mats.dark); pad.position.set(-0.7, 0.9, 0); g.add(pad);
      g.userData.props = { Type: 'Weld-Neck Flange', 'Size (NPS)': 4, 'Rating': 'CL150', 'Facing': 'RF', 'Material': 'A105' };
      return g;
    },
    'safety-post': function () {                            // field safety device on a post — disc, arrestor, shower, monitor, detector
      var g = new THREE.Group();
      var post = cyl(0.14, 0.14, 2.6, mats.dark); post.position.y = 1.5; g.add(post);
      var base = cyl(0.4, 0.4, 0.2, mats.dark); base.position.y = 0.1; g.add(base);
      var head = mesh(new THREE.SphereGeometry(0.42, 16, 12), mats.red); head.position.y = 2.9; g.add(head);
      var ring = torus(0.5, 0.06, mats.steel); ring.rotation.x = Math.PI / 2; ring.position.y = 2.6; g.add(ring);
      g.userData.props = { Type: 'Safety Device', Note: 'Field-mounted safety / protective equipment' };
      return g;
    },
    'package': function () {                                // skid-mounted package unit — open frame over representative equipment
      var g = new THREE.Group();
      var skid = box(6, 0.3, 3, mats.dark); skid.position.y = 0.15; g.add(skid);
      var frameMat = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.5, roughness: 0.6, transparent: true, opacity: 0.28 });
      var frame = box(5.6, 2.4, 2.6, frameMat); frame.position.y = 1.5; g.add(frame);
      var v1 = cyl(0.5, 0.5, 1.6, mats.blue); v1.position.set(-1.6, 1.3, 0); g.add(v1);
      var m1 = cyl(0.4, 0.4, 1.2, mats.navy); m1.rotation.z = Math.PI / 2; m1.position.set(1.2, 0.9, 0); g.add(m1);
      var pipe = cyl(0.15, 0.15, 3, mats.steel); pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 2.0, 0.8); g.add(pipe);
      g.userData.props = { Type: 'Package Unit', Note: 'Skid-mounted package — see vendor datasheet for internals' };
      return g;
    },
    'sphere': function () {                                 // true storage sphere on radial support legs
      var g = new THREE.Group();
      var R = 3;
      var sph = mesh(new THREE.SphereGeometry(R, 32, 24), mats.blue); sph.position.y = R + 2; g.add(sph);
      var ring = torus(R * 1.01, 0.1, mats.dark); ring.rotation.x = Math.PI / 2; ring.position.y = R + 2; g.add(ring);
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2;
        var leg = cyl(0.18, 0.14, R + 1.2, mats.dark, 8);
        leg.position.set(Math.cos(a) * R * 0.58, (R + 2) / 2, Math.sin(a) * R * 0.58);
        leg.rotation.z = -Math.sin(a) * 0.28; leg.rotation.x = Math.cos(a) * 0.28;
        g.add(leg);
      }
      g.add(nozzleY(2 * R + 2 + 0.5, 0, 0.28, mats.steel, 0));
      var ladder = box(0.06, R + 1, 0.5, mats.dark); ladder.position.set(R * 0.9, (R + 2) / 2, 0); g.add(ladder);
      g.userData.props = { Type: 'Spherical Tank', 'Diameter (m)': 6, 'Capacity (m³)': 113, 'Design P (barg)': 5, 'Material': 'SA-516-70' };
      return g;
    },
    'elbow90': function () {                                // 90° pipe bend on stub ends, with cast weld-bead rings
      var g = new THREE.Group();
      var el = mesh(new THREE.TorusGeometry(1.5, 0.45, 12, 24, Math.PI / 2), mats.gunmetal);
      el.rotation.set(Math.PI / 2, 0, Math.PI); el.position.set(-1.5, 0, 1.5); g.add(el);
      var a1 = cyl(0.45, 0.45, 1.0, mats.gunmetal); a1.position.set(-1.5, 0, 2.3); g.add(a1);
      var a2 = cyl(0.45, 0.45, 1.0, mats.gunmetal); a2.rotation.x = Math.PI / 2; a2.position.set(-2.3, 0, 1.5); g.add(a2);
      var w1 = torus(0.46, 0.045, mats.gold); w1.rotation.x = Math.PI / 2; w1.position.set(-1.5, 0, 2.77); g.add(w1);
      var w2 = torus(0.46, 0.045, mats.gold); w2.rotation.y = Math.PI / 2; w2.position.set(-2.77, 0, 1.5); g.add(w2);
      var tag = box(0.4, 0.28, 0.03, mats.silver); tag.position.set(-0.75, 0.55, 0.75); tag.rotation.y = -Math.PI / 4; g.add(tag);
      g.userData.props = { Type: '90° Elbow', 'Size (NPS)': 3, Radius: 'Long radius', Material: 'A234-WPB' };
      return g;
    },
    'elbow45': function () {                                // 45° pipe bend on stub ends, with cast weld-bead rings + ID tag
      var g = new THREE.Group();
      var el = mesh(new THREE.TorusGeometry(1.8, 0.4, 12, 20, Math.PI / 4), mats.gunmetal);
      el.rotation.set(Math.PI / 2, 0, Math.PI * 0.875); el.position.set(-1.3, 0, 0.7); g.add(el);
      var a1 = cyl(0.4, 0.4, 1.0, mats.gunmetal); a1.position.set(-1.3 - 0.7 * 0.383, 0, 0.7 + 0.7 * 0.924); a1.rotation.x = Math.PI * 0.375; g.add(a1);
      var a2 = cyl(0.4, 0.4, 1.0, mats.gunmetal); a2.rotation.x = Math.PI / 2; a2.position.set(-2.1, 0, 0); g.add(a2);
      var w2 = torus(0.41, 0.04, mats.gold); w2.rotation.y = Math.PI / 2; w2.position.set(-2.6, 0, 0); g.add(w2);
      var tag = box(0.36, 0.26, 0.03, mats.silver); tag.position.set(-1.1, 0.5, 0.5); g.add(tag);
      g.userData.props = { Type: '45° Elbow', 'Size (NPS)': 3, Material: 'A234-WPB' };
      return g;
    },
    'tee-fitting': function () {                            // run + branch pipe tee, gunmetal with flanged/bolted ends
      var g = new THREE.Group();
      var run = cyl(0.45, 0.45, 3.4, mats.gunmetal); run.rotation.z = Math.PI / 2; g.add(run);
      var br = cyl(0.42, 0.42, 1.7, mats.gunmetal); br.position.y = -0.85; g.add(br);
      var collar = torus(0.44, 0.05, mats.gold); collar.rotation.x = Math.PI / 2; collar.position.y = -0.15; g.add(collar);
      g.add(flangeX(1.7, 0.68, mats.steel)); g.add(flangeX(-1.7, 0.68, mats.steel));
      var brFlange = cyl(0.6, 0.6, 0.14, mats.steel); brFlange.position.y = -1.7; g.add(brFlange);
      g.add(boltCircle(8, 0.5, -1.7, 'y', mats.bolt));
      g.userData.props = { Type: 'Tee', 'Size (NPS)': 3, Pattern: 'Equal tee', Material: 'A234-WPB' };
      return g;
    },
    'cross-fitting': function () {                          // four-way pipe cross, gunmetal with flanged/bolted ends on both runs
      var g = new THREE.Group();
      var run = cyl(0.45, 0.45, 3.4, mats.gunmetal); run.rotation.z = Math.PI / 2; g.add(run);
      var run2 = cyl(0.42, 0.42, 3.4, mats.gunmetal); g.add(run2);
      var collar = mesh(new THREE.SphereGeometry(0.56, 16, 12), mats.gold); g.add(collar);
      g.add(flangeX(1.7, 0.68, mats.steel)); g.add(flangeX(-1.7, 0.68, mats.steel));
      [1.7, -1.7].forEach(function (yy) {
        var fl = cyl(0.62, 0.62, 0.14, mats.steel); fl.position.y = yy; g.add(fl);
        g.add(boltCircle(8, 0.52, yy, 'y', mats.bolt));
      });
      g.userData.props = { Type: 'Cross', 'Size (NPS)': 3, Material: 'A234-WPB' };
      return g;
    },
    'reducer-fitting': function () {                        // concentric size-change cone, gunmetal with flanged/bolted ends
      var g = new THREE.Group();
      var cone = cyl(0.32, 0.62, 1.8, mats.gunmetal, 22); cone.rotation.z = Math.PI / 2; g.add(cone);
      var band = cyl(0.47, 0.47, 0.1, mats.orange, 22); band.rotation.z = Math.PI / 2; g.add(band);
      var s1 = cyl(0.32, 0.32, 0.8, mats.gunmetal); s1.rotation.z = Math.PI / 2; s1.position.x = 1.3; g.add(s1);
      var s2 = cyl(0.62, 0.62, 0.8, mats.gunmetal); s2.rotation.z = Math.PI / 2; s2.position.x = -1.3; g.add(s2);
      g.add(flangeX(1.7, 0.5, mats.steel)); g.add(flangeX(-1.7, 0.95, mats.steel));
      g.userData.props = { Type: 'Reducer', 'Size (NPS)': '4×3', Material: 'A234-WPB' };
      return g;
    },
    /* ── Piping components brought back into the visible palette ──────────
       These type keys existed but had no palette entry, so a user could only
       get them by loading an old flowsheet. A piping model that cannot place
       a long-radius bend, an eccentric reducer or a spec blind is not a
       piping model, so each gets its own casting rather than an alias to a
       fitting it merely resembles. */
    'elbow-lr': function () {                               // 1.5D long-radius bend — visibly larger throat than the std elbow
      var g = new THREE.Group();
      var el = mesh(new THREE.TorusGeometry(2.3, 0.42, 12, 28, Math.PI / 2), mats.gunmetal);
      el.rotation.set(Math.PI / 2, 0, Math.PI); el.position.set(-2.3, 0, 2.3); g.add(el);
      var a1 = cyl(0.42, 0.42, 0.9, mats.gunmetal); a1.position.set(-2.3, 0, 3.05); g.add(a1);
      var a2 = cyl(0.42, 0.42, 0.9, mats.gunmetal); a2.rotation.x = Math.PI / 2; a2.position.set(-3.05, 0, 2.3); g.add(a2);
      var w1 = torus(0.44, 0.045, mats.gold); w1.rotation.x = Math.PI / 2; w1.position.set(-2.3, 0, 3.48); g.add(w1);
      var w2 = torus(0.44, 0.045, mats.gold); w2.rotation.y = Math.PI / 2; w2.position.set(-3.48, 0, 2.3); g.add(w2);
      g.userData.props = { Type: '90° Elbow', Radius: 'Long radius (1.5 D)', 'Size (NPS)': 3, Material: 'A234-WPB' };
      return g;
    },
    'ecc-reducer': function () {                            // eccentric reducer — flat on one side, as it sits on a pump suction
      var g = new THREE.Group();
      var cone = cyl(0.32, 0.62, 1.8, mats.gunmetal, 22);
      cone.rotation.z = Math.PI / 2; cone.position.y = 0.15; g.add(cone);
      var s1 = cyl(0.32, 0.32, 0.8, mats.gunmetal); s1.rotation.z = Math.PI / 2; s1.position.set(1.3, 0.30, 0); g.add(s1);
      var s2 = cyl(0.62, 0.62, 0.8, mats.gunmetal); s2.rotation.z = Math.PI / 2; s2.position.set(-1.3, 0, 0); g.add(s2);
      var flat = box(1.9, 0.05, 1.1, mats.orange); flat.position.set(0, -0.30, 0); g.add(flat);
      /* the small end rides high, which is the whole point of an eccentric
         reducer on a pump suction — no vapour pocket at the top of the cone */
      var fSmall = flangeX(1.7, 0.5, mats.steel); fSmall.position.y = 0.30; g.add(fSmall);
      g.add(flangeX(-1.7, 0.95, mats.steel));
      g.userData.props = { Type: 'Reducer', Pattern: 'Eccentric — flat side down', 'Size (NPS)': '4×3', Material: 'A234-WPB' };
      return g;
    },
    'pipe-spool': function () {                             // a flanged run of pipe — the thing every other fitting joins
      var g = new THREE.Group();
      var run = cyl(0.45, 0.45, 4.6, mats.gunmetal); run.rotation.z = Math.PI / 2; g.add(run);
      g.add(flangeX(2.3, 0.72, mats.steel)); g.add(flangeX(-2.3, 0.72, mats.steel));
      g.add(boltCircle(8, 0.58, 2.3, 'x', mats.bolt)); g.add(boltCircle(8, 0.58, -2.3, 'x', mats.bolt));
      var tag = box(0.5, 0.3, 0.03, mats.silver); tag.position.set(0, 0.6, 0); g.add(tag);
      g.userData.props = { Type: 'Pipe Spool', 'Size (NPS)': 3, Schedule: '40', Material: 'A106 Gr.B' };
      return g;
    },
    'pipe-union': function () {                             // screwed union — hex nut between two stubs
      var g = new THREE.Group();
      var run = cyl(0.34, 0.34, 2.6, mats.gunmetal); run.rotation.z = Math.PI / 2; g.add(run);
      var nut = cyl(0.62, 0.62, 0.7, mats.steel, 6); nut.rotation.z = Math.PI / 2; g.add(nut);
      var band = torus(0.5, 0.05, mats.gold); band.rotation.y = Math.PI / 2; band.position.x = 0.42; g.add(band);
      g.userData.props = { Type: 'Union', End: 'Screwed NPT', 'Size (NPS)': 1.5, Material: 'A105' };
      return g;
    },
    'pipe-cap': function () {                               // a dead end — stub plus a domed cap
      var g = new THREE.Group();
      var run = cyl(0.45, 0.45, 2.0, mats.gunmetal); run.rotation.z = Math.PI / 2; run.position.x = -0.4; g.add(run);
      var dome = mesh(new THREE.SphereGeometry(0.45, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.gunmetal);
      dome.rotation.z = -Math.PI / 2; dome.position.x = 0.6; g.add(dome);
      var w = torus(0.46, 0.045, mats.gold); w.rotation.y = Math.PI / 2; w.position.x = 0.6; g.add(w);
      g.userData.props = { Type: 'Pipe Cap', 'Size (NPS)': 3, Material: 'A234-WPB' };
      return g;
    },
    'spectacle-blind': function () {                        // spec blind — one disc solid, one open, on a single tie
      var g = new THREE.Group();
      var run = cyl(0.42, 0.42, 2.4, mats.gunmetal); run.rotation.z = Math.PI / 2; g.add(run);
      g.add(flangeX(0.5, 0.8, mats.steel)); g.add(flangeX(-0.5, 0.8, mats.steel));
      var solid = cyl(0.72, 0.72, 0.1, mats.orange, 24); solid.rotation.z = Math.PI / 2; g.add(solid);
      var open = torus(0.55, 0.14, mats.orange); open.rotation.y = Math.PI / 2; open.position.y = 1.55; g.add(open);
      var tie = box(0.16, 0.9, 0.1, mats.orange); tie.position.y = 0.9; g.add(tie);
      g.userData.props = { Type: 'Spectacle Blind', Position: 'Blind side in line', 'Size (NPS)': 3, Material: 'A240-304' };
      return g;
    },
    'gauge': function () {                                  // dial-face field instrument on a pipe tap (PI / TI / LI)
      var g = new THREE.Group();
      var stem = cyl(0.12, 0.12, 1.2, mats.steel); stem.position.y = 0.6; g.add(stem);
      var head = cyl(0.7, 0.7, 0.35, mats.steel, 28); head.rotation.x = Math.PI / 2; head.position.y = 1.5; g.add(head);
      var face = cyl(0.6, 0.6, 0.06, mats.dark, 28); face.rotation.x = Math.PI / 2; face.position.y = 1.68; g.add(face);
      var needle = box(0.5, 0.05, 0.05, mats.red); needle.rotation.z = 0.6; needle.position.set(0.08, 1.7, 0.08); g.add(needle);
      var base = box(0.6, 0.2, 0.6, mats.dark); base.position.y = 0.1; g.add(base);
      g.userData.props = { Type: 'Field Instrument', Signal: '4-20 mA', Mount: 'Direct / stem-mounted' };
      return g;
    },
    'inline-instrument': function () {                      // flanged in-line device — flow meter / orifice / rotameter
      var g = new THREE.Group();
      var stub = cyl(0.45, 0.45, 2.0, mats.steel); stub.rotation.z = Math.PI / 2; g.add(stub);
      var collar = cyl(0.62, 0.62, 0.7, mats.dark); collar.rotation.z = Math.PI / 2; g.add(collar);
      g.add(flangeX(1.3, 0.78, mats.steel)); g.add(flangeX(-1.3, 0.78, mats.steel));
      var head = box(0.5, 0.5, 0.5, mats.dark); head.position.y = 0.85; g.add(head);
      g.userData.props = { Type: 'In-line Flow Instrument', 'Size (NPS)': 3, Signal: '4-20 mA' };
      return g;
    },
    /* ── Pump-family sub-types (were all aliasing centrifugal-pump) ── */
    'multistage-pump': function () {                        // ring-section barrel pump — stacked stage rings + finned motor
      var g = new THREE.Group();
      var R = 0.62, N = 5, segLen = 0.6, total = N * segLen;
      var x0 = -total / 2;
      var barrel = cyl(R, R, total, mats.teal, 28); barrel.rotation.z = Math.PI / 2; barrel.position.y = 1.3; g.add(barrel);
      for (var i = 0; i <= N; i++) { var ring = cyl(R * 1.12, R * 1.12, 0.07, mats.gold, 28); ring.rotation.z = Math.PI / 2; ring.position.set(x0 + i * segLen, 1.3, 0); g.add(ring); }
      var suc = cyl(R * 0.7, R * 0.7, 0.5, mats.teal); suc.rotation.z = Math.PI / 2; suc.position.set(x0 - 0.25, 1.3, 0); g.add(suc);
      g.add(flangeX(x0 - 0.5, R * 1.15, mats.steel));
      var disc = cyl(0.32, 0.32, 1.1, mats.teal); disc.position.set(x0 + segLen * 0.6, 1.95, 0); g.add(disc);
      g.add(nozzleY(1.3 + R + 1.1, 0, 0.32, mats.steel, x0 + segLen * 0.6));
      var coup = cyl(0.28, 0.28, 0.4, mats.bolt); coup.rotation.z = Math.PI / 2; coup.position.set(total / 2 + 0.2, 1.3, 0); g.add(coup);
      var guard = cyl(0.5, 0.5, 0.5, mats.dark, 16); guard.rotation.z = Math.PI / 2; guard.position.set(total / 2 + 0.55, 1.3, 0); g.add(guard);
      var mot = cyl(0.85, 0.85, 2.2, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.set(total / 2 + 1.9, 1.3, 0); g.add(mot);
      for (var f = 0; f < 8; f++) { var fin = torus(0.87, 0.035, mats.dark); fin.rotation.y = Math.PI / 2; fin.position.set(total / 2 + 0.9 + f * 0.22, 1.3, 0); g.add(fin); }
      var bp = box(6.2, 0.3, 2.0, mats.dark); bp.position.set(total / 2 - 0.5, 0.15, 0); g.add(bp);
      g.userData.props = { Type: 'Multistage Centrifugal Pump', Stages: N, 'Flow (m³/h)': 40, 'Head (m)': 220, RPM: 2950, 'Motor (kW)': 55, Material: 'Duplex SS' };
      return g;
    },
    'gear-pump': function () {                              // compact PD / gear pump — visible gear lobes on the face
      var g = new THREE.Group();
      var body = box(1.6, 1.3, 1.1, mats.maroon); body.position.set(0, 1.1, 0); g.add(body);
      var face = box(0.14, 1.1, 0.9, mats.gunmetal); face.position.set(0.87, 1.1, 0); g.add(face);
      [[-0.22, 0.18], [0.22, -0.18]].forEach(function (o) {
        var gear = cyl(0.4, 0.4, 0.16, mats.gold, 12); gear.rotation.x = Math.PI / 2; gear.position.set(0.95, 1.1 + o[0], o[1]); g.add(gear);
        var rim = torus(0.4, 0.045, mats.gold); rim.rotation.x = Math.PI / 2; rim.position.set(0.95, 1.1 + o[0], o[1]); g.add(rim);
      });
      g.add(nozzleY(1.1 + 0.65 + 0.6, 0, 0.28, mats.maroon, -0.6));
      g.add(nozzleX2(0.9, 1.1, 0.28, mats.maroon, 1));
      var mot = cyl(0.45, 0.45, 1.1, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.set(-1.3, 1.1, 0); g.add(mot);
      var bp = box(3.6, 0.25, 1.6, mats.dark); bp.position.y = 0.2; g.add(bp);
      g.userData.props = { Type: 'PD / Gear Pump', 'Flow (m³/h)': 8, 'Diff P (bar)': 12, RPM: 960, 'Motor (kW)': 5.5, Material: 'CI/SS gears' };
      return g;
    },
    /* ── Heat-exchanger sub-type ── */
    'double-pipe-hx': function () {                         // hairpin double-pipe — concentric tubes + U-bend
      var g = new THREE.Group();
      var Ro = 0.42, Ri = 0.22, L = 4.4;
      [1, -1].forEach(function (side) {
        var z = side * 0.55;
        var outer = cyl(Ro, Ro, L, mats.steel, 20); outer.rotation.z = Math.PI / 2; outer.position.set(0, 1.3, z); g.add(outer);
        var inner = cyl(Ri, Ri, L + 0.3, mats.copper, 16); inner.rotation.z = Math.PI / 2; inner.position.set(0, 1.3, z); g.add(inner);
      });
      var bend = mesh(new THREE.TorusGeometry(0.55, Ro, 12, 24, Math.PI), mats.steel); bend.rotation.set(0, Math.PI / 2, 0); bend.position.set(L / 2, 1.3, 0); g.add(bend);
      var ibend = mesh(new THREE.TorusGeometry(0.55, Ri, 10, 20, Math.PI), mats.copper); ibend.rotation.set(0, Math.PI / 2, 0); ibend.position.set(L / 2, 1.3, 0); g.add(ibend);
      g.add(flangeX(-L / 2, Ro * 1.3, mats.steel));
      var innerNoz = cyl(Ri, Ri, 0.6, mats.copper); innerNoz.rotation.z = Math.PI / 2; innerNoz.position.set(-L / 2 - 0.3, 1.3, 0.55); g.add(innerNoz);
      var annulusNoz = cyl(0.22, 0.22, 0.7, mats.steel); annulusNoz.position.set(0, 1.3 + Ro + 0.35, -0.55); g.add(annulusNoz);
      var s1 = box(1.0, 1.3, 0.3, mats.dark); s1.position.set(-L / 2 + 0.6, 0.65, 0.55); g.add(s1);
      var s2 = box(1.0, 1.3, 0.3, mats.dark); s2.position.set(-L / 2 + 0.6, 0.65, -0.55); g.add(s2);
      g.userData.props = { Type: 'Double Pipe (Hairpin) HX', 'Inner OD (mm)': 60, 'Outer OD (mm)': 100, 'Length/leg (m)': 4.4, 'Area (m²)': 3.2, Material: 'CS/SS' };
      return g;
    },
    /* ── Tank-family sub-types (were all aliasing cone-tank) ── */
    'silo-hopper': function () {                            // cylindrical silo with a conical BOTTOM discharge
      var g = new THREE.Group();
      var R = 1.4, H = 3.2, coneH = 1.6, waist = 2;
      var cone = cyl(R, 0.15, coneH, mats.gunmetal, 26); cone.position.y = waist - coneH / 2; g.add(cone);
      var body = cyl(R, R, H, mats.silver, 26); body.position.y = waist + H / 2; g.add(body);
      var dome = mesh(new THREE.SphereGeometry(R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.silver); dome.position.y = waist + H; g.add(dome);
      for (var r = 0; r < 6; r++) { var a = r / 6 * Math.PI * 2; var rib = box(0.05, H, 0.08, mats.gunmetal); rib.position.set(Math.cos(a) * R, waist + H / 2, Math.sin(a) * R); rib.rotation.y = -a; g.add(rib); }
      g.add(nozzleY(waist + H + R + 0.3, 0, 0.24, mats.steel, 0));
      var spout = cyl(0.16, 0.16, 0.5, mats.gunmetal); spout.position.y = waist - coneH - 0.1; g.add(spout);
      g.add(legs(R, waist, mats.dark, 4));
      g.userData.props = { Type: 'Silo / Hopper', 'Diameter (m)': 2.8, 'Cyl. Height (m)': 3.2, 'Cone angle (°)': 60, 'Capacity (m³)': 22, Material: 'Galvanized steel' };
      return g;
    },
    'atm-tank': function () {                               // atmospheric tank — shallow dome roof, aluminium/white, wind girders
      var g = new THREE.Group();
      var R = 2.6, H = 4.6;
      var sh = cyl(R, R, H, mats.white, 40); sh.position.y = 0.25 + H / 2; g.add(sh);
      var roof = mesh(new THREE.SphereGeometry(R, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.14), mats.silver); roof.position.y = 0.25 + H; g.add(roof);
      var floor = cyl(R, R, 0.2, mats.dark, 40); floor.position.y = 0.15; g.add(floor);
      [0.35, 0.65].forEach(function (f) { var ring = torus(R + 0.02, 0.05, mats.silver); ring.rotation.x = Math.PI / 2; ring.position.y = 0.25 + H * f; g.add(ring); });
      var ladder = box(0.06, H, 0.5, mats.dark); ladder.position.set(R + 0.1, 0.25 + H / 2, 0); g.add(ladder);
      g.add(nozzleX2(-R - 0.6, 0.9, 0.35, mats.steel, -1));
      g.add(nozzleY(0.25 + H + 0.3, 0, 0.2, mats.steel, 0));
      g.userData.props = { Type: 'Atmospheric Storage Tank', 'Diameter (m)': 5.2, 'Height (m)': 4.6, 'Capacity (m³)': 98, Standard: 'API 650 (weak roof)', Material: 'CS painted alum.' };
      return g;
    },
    /* ── Reactor sub-types (were all aliasing the packed-bed 'reactor' shape) ── */
    'reactor-cstr': function () {                           // stirred tank reactor — jacket rings + top agitator drive
      var g = new THREE.Group();
      var R = 1.4, H = 4.2, base = 2.2;
      var sh = cyl(R, R, H, mats.orange); sh.position.y = base + H / 2; g.add(sh);
      g.add(dishTop(R, base + H, mats.orange)); g.add(dishBot(R, base, mats.orange));
      for (var j = 0; j < 3; j++) { var jr = torus(R + 0.08, 0.07, mats.maroon); jr.rotation.x = Math.PI / 2; jr.position.y = base + H * (0.2 + j * 0.3); g.add(jr); }
      var drive = cyl(0.5, 0.5, 1.1, mats.navy); drive.position.y = base + H + R + 0.55; g.add(drive);
      var shaftM = cyl(0.09, 0.09, H + R, mats.steel); shaftM.position.y = base + (H + R) / 2; g.add(shaftM);
      var impeller = new THREE.Group();
      for (var b = 0; b < 3; b++) { var bl = box(0.5, 0.1, 0.16, mats.steel); bl.rotation.y = b / 3 * Math.PI * 2; impeller.add(bl); }
      impeller.position.y = base + H * 0.25; g.add(impeller);
      g.add(nozzleY(base + H + R + 1.1, 0, 0.3, mats.steel, -0.7));
      var outN = cyl(0.3, 0.3, 1, mats.steel); outN.position.y = base - 0.5; g.add(outN);
      g.add(nozzleX2(-R - 0.6, base + H * 0.7, 0.24, mats.maroon, -1));
      g.add(legs(R, base, mats.dark, 4));
      g.userData.props = { Type: 'CSTR (Stirred Tank Reactor)', 'ID (mm)': 280, 'Volume (m³)': 6.5, Agitator: 'Turbine, 3-blade', Jacket: 'Full jacket', 'Design P (barg)': 6, Material: 'SS316L' };
      return g;
    },
    'reactor-pfr': function () {                            // tubular reactor — long HORIZONTAL jacketed tube on saddles
      var g = new THREE.Group();
      var R = 0.9, L = 7.5, y = 2.0;
      var tube1 = cyl(R, R, L, mats.maroon, 28); tube1.rotation.z = Math.PI / 2; tube1.position.y = y; g.add(tube1);
      var jacket = cyl(R * 1.28, R * 1.28, L * 0.86, mats.glass, 24); jacket.rotation.z = Math.PI / 2; jacket.position.y = y; g.add(jacket);
      g.add(dishSideNeg(R, -L / 2, y, mats.maroon)); g.add(dishSidePos(R, L / 2, y, mats.maroon));
      for (var i = 0; i < 6; i++) { var band = torus(R * 1.02, 0.05, mats.gold); band.rotation.y = Math.PI / 2; band.position.set(-L / 2 + (i + 1) * L / 7, y, 0); g.add(band); }
      g.add(nozzleX2(-L / 2 - 0.7, y, 0.32, mats.steel, -1));
      g.add(nozzleX2(L / 2 + 0.7, y, 0.32, mats.steel, 1));
      g.add(saddleAt(-L / 3, R, y, mats.dark)); g.add(saddleAt(0, R, y, mats.dark)); g.add(saddleAt(L / 3, R, y, mats.dark));
      g.userData.props = { Type: 'PFR / Tubular Reactor', 'ID (mm)': 220, 'Length (m)': 7.5, Orientation: 'Horizontal', 'Residence (min)': 12, 'Design P (barg)': 25, Material: 'SS347' };
      return g;
    },
    /* ── Valve sub-types (were all aliasing gate-valve) ── */
    'globe-valve': function () {                            // conical bonnet + yoke posts distinguish it from the gate valve
      var g = new THREE.Group();
      var body = mesh(new THREE.SphereGeometry(0.85, 20, 16), mats.navy); body.scale.set(1, 1.2, 1); body.position.y = 1.4; g.add(body);
      g.add(flgZ(0, 1.4, 0.9, 0.5)); var inNoz = cyl(0.36, 0.36, 0.6, mats.navy); inNoz.rotation.x = Math.PI / 2; inNoz.position.set(0, 1.4, 0.6); g.add(inNoz);
      g.add(flgZ(0, 1.4, -0.9, 0.5)); var outNoz = cyl(0.36, 0.36, 0.6, mats.navy); outNoz.rotation.x = Math.PI / 2; outNoz.position.set(0, 1.4, -0.6); g.add(outNoz);
      var bonnet = cyl(0.5, 0.62, 0.9, mats.navy); bonnet.position.y = 2.25; g.add(bonnet);
      [-0.32, 0.32].forEach(function (ox) { var yk = box(0.16, 1.0, 0.16, mats.dark); yk.position.set(ox, 2.9, 0); g.add(yk); });
      var stem = cyl(0.08, 0.08, 1.2, mats.steel); stem.position.y = 3.5; g.add(stem);
      var wheel = torus(0.6, 0.08, mats.dark); wheel.rotation.x = Math.PI / 2; wheel.position.y = 4.1; g.add(wheel);
      for (var s = 0; s < 3; s++) { var sp = box(1.1, 0.05, 0.05, mats.dark); sp.rotation.y = s / 3 * Math.PI; sp.position.y = 4.1; g.add(sp); }
      var idPlate = box(0.3, 0.3, 0.05, mats.silver); idPlate.position.set(0, 1.0, 0.85); g.add(idPlate);
      g.userData.props = { Type: 'Globe Valve', 'Size (NPS)': 3, Rating: 'CL150', Pattern: 'Z-body', Body: 'WCB', Trim: 'SS316' };
      return g;
    },
    'butterfly-valve': function () {                        // thin wafer body + lever/gearbox operator — no long flanged stubs
      var g = new THREE.Group();
      var body = cyl(0.95, 0.95, 0.55, mats.gunmetal, 32); body.rotation.x = Math.PI / 2; body.position.y = 1.3; g.add(body);
      g.add(boltCircle(10, 0.82, 1.3, 'y', mats.bolt));
      var disc = cyl(0.72, 0.72, 0.1, mats.silver, 28); disc.rotation.z = Math.PI / 2.3; disc.position.y = 1.3; g.add(disc);
      var stem = cyl(0.09, 0.09, 0.9, mats.steel); stem.position.y = 1.85; g.add(stem);
      var gearbox = box(0.5, 0.4, 0.5, mats.gunmetal); gearbox.position.y = 2.35; g.add(gearbox);
      var lever = box(1.1, 0.09, 0.14, mats.red); lever.position.set(0.4, 2.55, 0); lever.rotation.y = 0.5; g.add(lever);
      g.userData.props = { Type: 'Butterfly Valve', 'Size (NPS)': 6, Rating: 'CL150 (wafer)', Disc: 'SS316', Seat: 'EPDM', Operator: 'Lever' };
      return g;
    },
    'check-valve': function () {                            // compact swing-check body with cast flow-direction arrow
      var g = new THREE.Group();
      var body = cyl(0.6, 0.6, 1.6, mats.brass, 24); body.rotation.z = Math.PI / 2; g.add(body);
      g.add(flangeX(-0.85, 0.76, mats.steel)); g.add(flangeX(0.85, 0.76, mats.steel));
      var flap = box(0.06, 0.85, 0.65, mats.dark); flap.rotation.z = 0.5; flap.position.x = 0.12; g.add(flap);
      var arrow = box(0.7, 0.05, 0.18, mats.gold); arrow.position.y = 0.42; g.add(arrow);
      var tip = mesh(new THREE.ConeGeometry(0.14, 0.22, 4), mats.gold); tip.rotation.z = -Math.PI / 2; tip.position.set(0.42, 0.42, 0); g.add(tip);
      g.position.y = 1.2;
      g.userData.props = { Type: 'Check Valve (Swing)', 'Size (NPS)': 3, Rating: 'CL150', Body: 'Bronze/CS', Disc: 'SS316' };
      return g;
    },
    'control-valve': function () {                          // globe body under a large pneumatic diaphragm actuator dome
      var g = new THREE.Group();
      var body = mesh(new THREE.SphereGeometry(0.8, 18, 14), mats.forest); body.scale.set(1, 1.15, 1); g.add(body);
      g.add(flgZ(0, 0, 0.85, 0.48)); var inNoz = cyl(0.34, 0.34, 0.55, mats.forest); inNoz.rotation.x = Math.PI / 2; inNoz.position.z = 0.55; g.add(inNoz);
      g.add(flgZ(0, 0, -0.85, 0.48)); var outNoz = inNoz.clone(); outNoz.position.z = -0.55; g.add(outNoz);
      var yoke = cyl(0.22, 0.32, 0.9, mats.dark); yoke.position.y = 0.85; g.add(yoke);
      var diaphragm = cyl(0.85, 0.85, 0.55, mats.silver, 24); diaphragm.position.y = 1.75; g.add(diaphragm);
      var domeTop = mesh(new THREE.SphereGeometry(0.85, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.silver); domeTop.position.y = 2.02; g.add(domeTop);
      var positioner = box(0.4, 0.35, 0.3, mats.dark); positioner.position.set(0.9, 1.75, 0); g.add(positioner);
      var gauge1 = cyl(0.12, 0.12, 0.06, mats.white, 16); gauge1.rotation.z = Math.PI / 2; gauge1.position.set(1.05, 1.9, 0); g.add(gauge1);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Control Valve (Globe + Pneumatic Actuator)', 'Size (NPS)': 3, Cv: 45, Actuator: 'Diaphragm, spring-return', Signal: '4-20 mA / 3-15 psi' };
      return g;
    },
    'psv-valve': function () {                              // angle relief valve — safety-red, pop-action cap, side lever
      var g = new THREE.Group();
      var body = cyl(0.45, 0.55, 0.9, mats.red); g.add(body);
      var inNoz = cyl(0.3, 0.3, 0.5, mats.red); inNoz.rotation.z = Math.PI / 2; inNoz.position.x = -0.5; g.add(inNoz);
      g.add(flangeX(-0.75, 0.55, mats.steel));
      var bonnet = cyl(0.32, 0.42, 1.1, mats.red); bonnet.position.y = 1.0; g.add(bonnet);
      var cap = mesh(new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.red); cap.position.y = 1.55; g.add(cap);
      var lever = box(0.5, 0.06, 0.06, mats.dark); lever.position.set(0.25, 1.55, 0.3); g.add(lever);
      var outNoz = cyl(0.24, 0.24, 0.5, mats.red); outNoz.position.y = 1.85; g.add(outNoz);
      g.position.y = 1.3;
      g.userData.props = { Type: 'PSV / Relief Valve', 'Size (NPS)': '2×3', 'Set P (barg)': 12, Action: 'Spring-loaded, pop-action', Material: 'CS/SS trim' };
      return g;
    },
    'three-way-valve': function () {                        // T-body with a third branch flange, teal-coded
      var g = new THREE.Group();
      var body = cyl(0.55, 0.55, 1.5, mats.teal); body.rotation.z = Math.PI / 2; g.add(body);
      g.add(flangeX(-0.85, 0.7, mats.steel)); g.add(flangeX(0.85, 0.7, mats.steel));
      var branch = cyl(0.5, 0.5, 0.9, mats.teal); branch.position.y = -0.55; g.add(branch);
      var bflange = cyl(0.66, 0.66, 0.14, mats.steel); bflange.position.y = -1.0; g.add(bflange);
      g.add(boltCircle(6, 0.52, -1.0, 'y', mats.bolt));
      var stem = cyl(0.08, 0.08, 0.8, mats.steel); stem.position.y = 0.9; g.add(stem);
      var wheel = torus(0.45, 0.06, mats.dark); wheel.rotation.x = Math.PI / 2; wheel.position.y = 1.35; g.add(wheel);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Three-way Valve', 'Size (NPS)': 3, Pattern: 'L-port / T-port', Body: 'SS316' };
      return g;
    },
    'needle-valve': function () {                           // small compact instrument-isolation valve — T-handle, no big wheel
      var g = new THREE.Group();
      var body = cyl(0.3, 0.3, 0.9, mats.gunmetal); body.rotation.z = Math.PI / 2; g.add(body);
      g.add(flangeX(-0.55, 0.4, mats.steel)); g.add(flangeX(0.55, 0.4, mats.steel));
      var bonnet = cyl(0.16, 0.22, 0.7, mats.gunmetal); bonnet.position.y = 0.55; g.add(bonnet);
      var knob = cyl(0.22, 0.22, 0.14, mats.dark, 16); knob.position.y = 0.98; g.add(knob);
      var tHandle1 = box(0.4, 0.06, 0.06, mats.dark); tHandle1.position.y = 1.05; g.add(tHandle1);
      var tHandle2 = box(0.06, 0.06, 0.4, mats.dark); tHandle2.position.y = 1.05; g.add(tHandle2);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Needle Valve', 'Size (NPS)': 0.75, Rating: 'CL800', Body: 'SS316', Use: 'Instrument isolation / throttling' };
      return g;
    },
    /* ── Fitting sub-type: Flange Pair (two bolted flange faces + gasket, not a stub) ── */
    'flange-pair': function () {
      var g = new THREE.Group();
      var stub1 = cyl(0.32, 0.32, 0.5, mats.steel); stub1.rotation.z = Math.PI / 2; stub1.position.x = -0.55; g.add(stub1);
      var stub2 = cyl(0.32, 0.32, 0.5, mats.steel); stub2.rotation.z = Math.PI / 2; stub2.position.x = 0.55; g.add(stub2);
      var f1 = cyl(0.56, 0.56, 0.14, mats.gunmetal); f1.rotation.z = Math.PI / 2; f1.position.x = -0.32; g.add(f1);
      var f2 = cyl(0.56, 0.56, 0.14, mats.gunmetal); f2.rotation.z = Math.PI / 2; f2.position.x = 0.32; g.add(f2);
      var gasket = cyl(0.4, 0.4, 0.05, mats.gold, 24); gasket.rotation.z = Math.PI / 2; g.add(gasket);
      g.add(boltCircle(8, 0.46, -0.25, 'x', mats.bolt)); g.add(boltCircle(8, 0.46, 0.25, 'x', mats.bolt));
      g.position.y = 1.3;
      g.userData.props = { Type: 'Flange Pair', 'Size (NPS)': 3, Rating: 'CL150 RF', Gasket: 'Spiral wound', Material: 'A105' };
      return g;
    },
    /* ── Instrument sub-types (were all aliasing 'gauge' or 'inline-instrument') ── */
    'pressure-gauge': function () {                         // Bourdon-tube dial gauge on a syphon stem, white face + red needle
      var g = new THREE.Group();
      var stem = cyl(0.1, 0.1, 1.0, mats.steel); stem.position.y = 0.5; g.add(stem);
      var syphon = mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 16, Math.PI), mats.steel); syphon.rotation.z = Math.PI; syphon.position.y = 1.05; g.add(syphon);
      var head = cyl(0.6, 0.6, 0.3, mats.gunmetal, 28); head.rotation.x = Math.PI / 2; head.position.y = 1.55; g.add(head);
      var face = cyl(0.52, 0.52, 0.06, mats.white, 28); face.rotation.x = Math.PI / 2; face.position.y = 1.7; g.add(face);
      var needle = box(0.42, 0.045, 0.045, mats.red); needle.rotation.z = 0.65; needle.position.set(0.06, 1.71, 0.06); g.add(needle);
      var base = box(0.5, 0.16, 0.5, mats.dark); base.position.y = 0.08; g.add(base);
      g.userData.props = { Type: 'Pressure Gauge (PI)', Range: '0-16 barg', Connection: '1/2" NPT syphon', Dial: '100mm SS case' };
      return g;
    },
    'temp-indicator': function () {                         // digital LED panel-mount indicator (matches field reference photos)
      var g = new THREE.Group();
      var ledMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xaa0000, emissiveIntensity: 0.7, metalness: 0.1, roughness: 0.4 });
      var stem = cyl(0.09, 0.09, 0.85, mats.steel); stem.position.y = 0.43; g.add(stem);
      var arm = box(0.5, 0.08, 0.08, mats.dark); arm.position.set(0.25, 0.85, 0); g.add(arm);
      var body = box(0.62, 0.42, 0.24, mats.dark); body.position.set(0.55, 0.9, 0); g.add(body);
      var bezel = box(0.5, 0.28, 0.03, mats.gunmetal); bezel.position.set(0.55, 0.94, 0.13); g.add(bezel);
      var screen = box(0.42, 0.2, 0.02, mats.dark); screen.position.set(0.55, 0.94, 0.15); g.add(screen);
      var digit = box(0.32, 0.1, 0.012, ledMat); digit.position.set(0.55, 0.96, 0.16); g.add(digit);
      var btn1 = cyl(0.03, 0.03, 0.02, mats.bolt, 10); btn1.rotation.x = Math.PI / 2; btn1.position.set(0.4, 0.78, 0.13); g.add(btn1);
      var btn2 = cyl(0.03, 0.03, 0.02, mats.bolt, 10); btn2.rotation.x = Math.PI / 2; btn2.position.set(0.7, 0.78, 0.13); g.add(btn2);
      g.userData.props = { Type: 'Temperature Indicator (TI)', Display: 'Digital LED, panel-mount', Range: '0-400 °C', Element: 'RTD Pt100' };
      return g;
    },
    'level-indicator': function () {                        // magnetic level gauge — red/white striped follower flags on a chamber
      var g = new THREE.Group();
      var chamber = cyl(0.13, 0.13, 2.4, mats.steel, 16); chamber.position.y = 1.3; g.add(chamber);
      for (var i = 0; i < 8; i++) {
        var flagMat = i % 2 === 0 ? mats.red : mats.white;
        var flag = box(0.24, 0.29, 0.07, flagMat); flag.position.set(0.17, 0.25 + i * 0.29, 0); g.add(flag);
      }
      var topValve = cyl(0.1, 0.1, 0.22, mats.dark, 12); topValve.rotation.z = Math.PI / 2; topValve.position.set(-0.35, 2.5, 0); g.add(topValve);
      var botValve = cyl(0.1, 0.1, 0.22, mats.dark, 12); botValve.rotation.z = Math.PI / 2; botValve.position.set(-0.35, 0.1, 0); g.add(botValve);
      var topN = cyl(0.06, 0.06, 0.25, mats.steel); topN.rotation.z = Math.PI / 2; topN.position.set(-0.58, 2.5, 0); g.add(topN);
      var botN = cyl(0.06, 0.06, 0.25, mats.steel); botN.rotation.z = Math.PI / 2; botN.position.set(-0.58, 0.1, 0); g.add(botN);
      var bracket = box(0.5, 0.06, 0.16, mats.dark); bracket.position.set(0, 1.3, -0.1); g.add(bracket);
      g.userData.props = { Type: 'Level Indicator (LI)', Type2: 'Magnetic level gauge', Range: '0-2.4 m', Connection: 'Side-mounted, top/bottom shutoff' };
      return g;
    },
    'flow-meter': function () {                              // electromagnetic flow meter — blue tube + rounded white transmitter head
      var g = new THREE.Group();
      var stub = cyl(0.4, 0.4, 1.8, mats.sky, 20); stub.rotation.z = Math.PI / 2; g.add(stub);
      g.add(flangeX(1.15, 0.68, mats.steel)); g.add(flangeX(-1.15, 0.68, mats.steel));
      var neck = cyl(0.16, 0.2, 0.32, mats.white, 16); neck.position.y = 0.58; g.add(neck);
      var head = mesh(new THREE.SphereGeometry(0.42, 20, 16), mats.white); head.scale.y = 1.1; head.position.y = 1.12; g.add(head);
      var window = cyl(0.22, 0.22, 0.05, mats.dark, 20); window.rotation.x = Math.PI / 2; window.position.set(0, 1.12, 0.4); g.add(window);
      var screenMat = new THREE.MeshStandardMaterial({ color: 0x0f2818, emissive: 0x0a3d1e, emissiveIntensity: 0.5 });
      var screen = cyl(0.16, 0.16, 0.02, screenMat, 20); screen.rotation.x = Math.PI / 2; screen.position.set(0, 1.12, 0.43); g.add(screen);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Flow Meter (FT)', Technology: 'Electromagnetic', Signal: '4-20 mA / HART', 'Size (NPS)': 3 };
      return g;
    },
    'orifice-plate': function () {                          // bare restriction disc + protruding ID handle tab between flanges
      var g = new THREE.Group();
      var s1 = cyl(0.4, 0.4, 0.7, mats.steel); s1.rotation.z = Math.PI / 2; s1.position.x = -0.55; g.add(s1);
      var s2 = cyl(0.4, 0.4, 0.7, mats.steel); s2.rotation.z = Math.PI / 2; s2.position.x = 0.55; g.add(s2);
      g.add(flangeX(-0.15, 0.62, mats.silver)); g.add(flangeX(0.15, 0.62, mats.silver));
      var plate = cyl(0.62, 0.62, 0.03, mats.gold, 28); plate.rotation.z = Math.PI / 2; g.add(plate);
      var bore = cyl(0.22, 0.22, 0.04, mats.dark, 20); bore.rotation.z = Math.PI / 2; g.add(bore);
      var tab = box(0.18, 0.3, 0.03, mats.gold); tab.position.y = 0.75; g.add(tab);
      var tabHole = cyl(0.04, 0.04, 0.04, mats.dark, 10); tabHole.rotation.z = Math.PI / 2; tabHole.position.y = 0.92; g.add(tabHole);
      var tapHi = cyl(0.05, 0.05, 0.4, mats.steel); tapHi.position.set(-0.35, 0.5, 0.3); g.add(tapHi);
      var tapLo = cyl(0.05, 0.05, 0.4, mats.steel); tapLo.position.set(0.35, 0.5, 0.3); g.add(tapLo);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Orifice Plate (dP)', Beta: 0.6, 'Size (NPS)': 3, Tapping: 'Flange taps' };
      return g;
    },
    'rotameter-tube': function () {                         // vertical tapered glass tube + visible float ball
      var g = new THREE.Group();
      var tube1 = mesh(new THREE.CylinderGeometry(0.16, 0.34, 2.2, 20), mats.glass); tube1.position.y = 1.2; g.add(tube1);
      var scaleBar = box(0.06, 2.0, 0.06, mats.dark); scaleBar.position.set(0.42, 1.2, 0); g.add(scaleBar);
      var float1 = mesh(new THREE.SphereGeometry(0.13, 14, 10), mats.gunmetal); float1.position.y = 0.9; g.add(float1);
      var inN = cyl(0.16, 0.16, 0.35, mats.steel); inN.position.y = -0.05; g.add(inN);
      var outN = cyl(0.14, 0.14, 0.35, mats.steel); outN.position.y = 2.45; g.add(outN);
      g.add(boltCircle(6, 0.36, 0.1, 'y', mats.bolt)); g.add(boltCircle(6, 0.2, 2.28, 'y', mats.bolt));
      g.position.y = 0.15;
      g.userData.props = { Type: 'Rotameter', 'Range (m³/h)': '0.5-5', Tube: 'Borosilicate glass, tapered', Float: 'SS316' };
      return g;
    },
    /* ── Utilities & Mixers sub-types (were mis-routed into column/sthe/compressor/v-vessel) ── */
    'cooling-tower': function () {                          // slatted fill lattice + top induced-draft fan + water basin
      var g = new THREE.Group();
      var basin = box(4.2, 0.6, 4.2, mats.dark); basin.position.y = 0.3; g.add(basin);
      var frame = box(3.6, 3.2, 3.6, mats.silver); frame.position.y = 2.2; frame.material = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.3, roughness: 0.7, transparent: true, opacity: 0.5 }); g.add(frame);
      for (var s = 0; s < 8; s++) { var slat = box(3.4, 0.1, 3.4, mats.sky); slat.position.y = 1.0 + s * 0.32; g.add(slat); }
      var fanRing = torus(1.3, 0.1, mats.dark); fanRing.rotation.x = Math.PI / 2; fanRing.position.y = 4.0; g.add(fanRing);
      var fan = new THREE.Group();
      for (var b = 0; b < 5; b++) { var bl = box(1.2, 0.05, 0.35, mats.forest); bl.rotation.y = b / 5 * Math.PI * 2; fan.add(bl); }
      fan.position.y = 4.0; fan.userData.spin = 'y'; spinTag(fan); g.add(fan);
      var stack = cyl(0.3, 0.3, 0.6, mats.dark); stack.position.y = 4.35; g.add(stack);
      g.add(nozzleX2(-2.1, 1.0, 0.3, mats.steel, -1)); g.add(nozzleX2(2.1, 0.5, 0.3, mats.steel, 1));
      g.userData.props = { Type: 'Cooling Tower (Induced Draft)', Cells: 1, 'Duty (kW)': 2500, Approach: '5 °C', Material: 'FRP/timber fill' };
      return g;
    },
    'fired-boiler': function () {                           // vertical package boiler — internal flame + coil cutaway, external ladder
      var g = new THREE.Group();
      var R = 1.3, H = 4.2, base = 0.2;
      var flameMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff4400, emissiveIntensity: 0.85, metalness: 0, roughness: 0.6 });
      var floor = cyl(R, R, 0.2, mats.dark, 28); floor.position.y = 0.1; g.add(floor);
      var shell = cyl(R, R, H, mats.blue, 28); shell.position.y = base + H / 2; g.add(shell);
      var domeTop = mesh(new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.navy); domeTop.position.y = base + H; g.add(domeTop);
      var burnerHead = cyl(0.2, 0.28, 0.3, mats.dark, 16); burnerHead.position.y = base + 0.3; g.add(burnerHead);
      var flameCone = mesh(new THREE.ConeGeometry(0.32, 1.7, 16), flameMat); flameCone.position.y = base + 1.05; g.add(flameCone);
      for (var i = 0; i < 9; i++) { var coil = torus(0.56, 0.045, mats.copper); coil.rotation.x = Math.PI / 2; coil.position.y = base + 0.55 + i * 0.32; g.add(coil); }
      [0.2, -0.2].forEach(function (rz) {
        var rail = box(0.05, 1.5, 0.05, mats.dark); rail.position.set(R + 0.15, base + H - 0.85, rz); g.add(rail);
      });
      for (var r = 0; r < 6; r++) { var rung = box(0.05, 0.04, 0.42, mats.dark); rung.position.set(R + 0.15, base + H - 1.5 + r * 0.27, 0); g.add(rung); }
      var handrail = torus(0.5, 0.03, mats.dark); handrail.rotation.x = Math.PI / 2; handrail.position.y = base + H - 0.1; g.add(handrail);
      g.add(nozzleY(base + H + R + 0.4, 0, 0.22, mats.steel, -0.4));
      var gaugeStem = cyl(0.05, 0.05, 0.3, mats.steel); gaugeStem.position.set(0.6, base + H + 0.15, 0); g.add(gaugeStem);
      var gaugeHead = cyl(0.16, 0.16, 0.08, mats.white, 16); gaugeHead.rotation.x = Math.PI / 2; gaugeHead.position.set(0.6, base + H + 0.3, 0); g.add(gaugeHead);
      var bfwIn = cyl(0.2, 0.2, 0.8, mats.steel); bfwIn.rotation.z = Math.PI / 2; bfwIn.position.set(-R - 0.4, base + 0.6, 0); g.add(bfwIn);
      g.userData.props = { Type: 'Fired Boiler (Vertical, Oil/Gas)', 'Capacity (TPH)': 15, 'Design P (barg)': 17.5, Fuel: 'NG/FO', Material: 'SA-516-70' };
      return g;
    },
    'steam-ejector': function () {                          // flared funnel inlet + cylindrical body on a bolted pedestal base
      var g = new THREE.Group();
      var bell = cyl(0.65, 0.22, 0.9, mats.silver, 24); bell.rotation.z = Math.PI / 2; bell.position.x = -0.85; g.add(bell);
      var throat = cyl(0.14, 0.14, 0.4, mats.gold, 16); throat.rotation.z = Math.PI / 2; throat.position.x = -0.2; g.add(throat);
      var body = cyl(0.28, 0.28, 1.3, mats.silver, 22); body.rotation.z = Math.PI / 2; body.position.x = 0.55; g.add(body);
      g.add(flangeX(-1.3, 0.68, mats.gunmetal)); g.add(flangeX(1.25, 0.34, mats.gunmetal));
      g.add(nozzleY(0.35, 0.3, 0.13, mats.steel, 0.1));
      var pedestal = box(0.2, 0.55, 0.5, mats.dark); pedestal.position.set(0.3, -0.28, 0); g.add(pedestal);
      var pbase = box(0.7, 0.1, 0.7, mats.dark); pbase.position.set(0.3, -0.55, 0); g.add(pbase);
      g.position.y = 1.6;
      g.userData.props = { Type: 'Steam Jet Ejector', Stage: '1st stage', Motive: 'MP steam', Capacity: '450 kg/h air', Material: 'SS body' };
      return g;
    },
    'static-mixer': function () {                           // short pipe spool with visible twisted internal mixing elements
      var g = new THREE.Group();
      var pipe = cyl(0.42, 0.42, 2.2, mats.gunmetal, 20); pipe.rotation.z = Math.PI / 2; g.add(pipe);
      var shell = mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.2, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.4, side: THREE.DoubleSide })); shell.rotation.z = Math.PI / 2; g.add(shell);
      for (var e = 0; e < 4; e++) {
        var elBlade = box(0.5, 0.03, 0.34, mats.gold); elBlade.position.x = -0.75 + e * 0.5; elBlade.rotation.x = e * Math.PI / 3; g.add(elBlade);
      }
      g.add(flangeX(-1.15, 0.55, mats.steel)); g.add(flangeX(1.15, 0.55, mats.steel));
      g.position.y = 1.3;
      g.userData.props = { Type: 'Static Mixer (Inline)', Elements: 4, 'Size (NPS)': 3, Material: 'SS316' };
      return g;
    },
    'agitated-tank': function () {                          // general mixing tank — single paddle impeller, no jacket (vs. CSTR)
      var g = new THREE.Group();
      var R = 1.3, H = 3.6, base = 2.0;
      var sh = cyl(R, R, H, mats.sky, 28); sh.position.y = base + H / 2; g.add(sh);
      g.add(dishTop(R, base + H, mats.sky)); g.add(dishBot(R, base, mats.sky));
      var drive = cyl(0.4, 0.4, 0.9, mats.dark); drive.position.y = base + H + R + 0.45; g.add(drive);
      var shaftM = cyl(0.07, 0.07, H, mats.steel); shaftM.position.y = base + H / 2; g.add(shaftM);
      var paddle = new THREE.Group();
      [0, Math.PI].forEach(function (ry) { var bl = box(0.9, 0.12, 0.16, mats.steel); bl.rotation.y = ry; paddle.add(bl); });
      paddle.position.y = base + H * 0.2; g.add(paddle);
      g.add(nozzleY(base + H + R + 0.9, 0, 0.26, mats.steel, -0.6));
      var outN = cyl(0.26, 0.26, 0.9, mats.steel); outN.position.y = base - 0.45; g.add(outN);
      g.add(nozzleX2(-R - 0.5, base + H * 0.6, 0.22, mats.sky, -1));
      g.add(legs(R, base, mats.dark, 4));
      g.userData.props = { Type: 'Agitated Tank', 'Volume (m³)': 4.2, Agitator: 'Paddle, 2-blade', 'Design P (barg)': 3, Material: 'SS304' };
      return g;
    },
    /* ── Filter & Strainer sub-types (were all aliasing the cartridge 'filter' shape) ── */
    'y-strainer': function () {                             // inline pipe with a 45° screen pocket + bolted cap, matches 2D icon
      var g = new THREE.Group();
      var run = cyl(0.4, 0.4, 2.2, mats.gunmetal, 20); run.rotation.z = Math.PI / 2; g.add(run);
      var pocket = cyl(0.32, 0.32, 1.3, mats.gunmetal, 18); pocket.rotation.z = Math.PI / 4; pocket.position.set(0.35, -0.35, 0); g.add(pocket);
      var cap = cyl(0.4, 0.4, 0.18, mats.gold, 18); cap.rotation.z = Math.PI / 4; cap.position.set(0.85, -0.85, 0); g.add(cap);
      g.add(boltCircle(6, 0.34, 0, 'y', mats.bolt));
      g.add(flangeX(-1.1, 0.55, mats.steel)); g.add(flangeX(1.1, 0.55, mats.steel));
      g.position.y = 1.5;
      g.userData.props = { Type: 'Y-Strainer', Mesh: '40 mesh SS', 'Size (NPS)': 3, Material: 'CS body / SS screen' };
      return g;
    },
    't-strainer': function () {                             // inline pipe with a vertical branch T + removable screen cap
      var g = new THREE.Group();
      var run = cyl(0.4, 0.4, 2.2, mats.gunmetal, 20); run.rotation.z = Math.PI / 2; g.add(run);
      var branch = cyl(0.34, 0.34, 1.2, mats.gunmetal, 18); branch.position.y = 0.6; g.add(branch);
      var cap = cyl(0.42, 0.42, 0.16, mats.gold, 18); cap.position.y = 1.25; g.add(cap);
      g.add(boltCircle(6, 0.36, 1.18, 'y', mats.bolt));
      g.add(flangeX(-1.1, 0.55, mats.steel)); g.add(flangeX(1.1, 0.55, mats.steel));
      g.position.y = 1.5;
      g.userData.props = { Type: 'T-Strainer (Basket)', Mesh: '40 mesh SS', 'Size (NPS)': 3, Material: 'CS body / SS screen' };
      return g;
    },
    'basket-filter': function () {                          // vertical housing with a large bolted top cover (basket access)
      var g = new THREE.Group();
      var R = 0.9, H = 2.6, base = 2.0;
      var sh = cyl(R, R, H, mats.silver, 24); sh.position.y = base + H / 2; g.add(sh);
      g.add(dishBot(R, base, mats.silver));
      var cover = cyl(R * 1.12, R * 1.12, 0.3, mats.gunmetal, 24); cover.position.y = base + H + 0.15; g.add(cover);
      g.add(boltCircle(10, R * 0.95, base + H + 0.3, 'y', mats.bolt));
      var handle = torus(0.22, 0.04, mats.gold); handle.rotation.x = Math.PI / 2; handle.position.y = base + H + 0.35; g.add(handle);
      g.add(nozzleX2(-R - 0.5, base + H * 0.75, 0.24, mats.steel, -1)); g.add(nozzleX2(R + 0.5, base + H * 0.75, 0.24, mats.steel, 1));
      var dr = cyl(0.18, 0.18, 0.7, mats.steel); dr.position.y = base - 0.35; g.add(dr);
      g.add(legs(R, base, mats.dark, 4));
      g.userData.props = { Type: 'Basket Filter', 'Housing ID (mm)': 300, 'Basket mesh': '80 mesh SS', 'Design P (barg)': 12, Material: 'CS/SS316' };
      return g;
    },
    'bag-filter': function () {                             // dome top, straight barrel, tapered CONE bottom holding the bag
      var g = new THREE.Group();
      var R = 0.85, H = 2.2, coneH = 1.1, base = 2.0;
      var cone = cyl(R, 0.18, coneH, mats.silver, 24); cone.position.y = base + coneH / 2; g.add(cone);
      var sh = cyl(R, R, H, mats.silver, 24); sh.position.y = base + coneH + H / 2; g.add(sh);
      var dome = mesh(new THREE.SphereGeometry(R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.silver); dome.position.y = base + coneH + H; g.add(dome);
      g.add(boltCircle(8, R * 0.95, base + coneH + H - 0.02, 'y', mats.bolt));
      g.add(nozzleX2(-R - 0.5, base + coneH + H * 0.7, 0.24, mats.steel, -1)); g.add(nozzleX2(R + 0.5, base + coneH * 1.4, 0.22, mats.steel, 1));
      var purge = cyl(0.15, 0.15, 0.5, mats.gunmetal); purge.position.y = base - 0.25; g.add(purge);
      g.add(legs(R, base, mats.dark, 4));
      g.userData.props = { Type: 'Bag Filter', 'Housing ID (mm)': 260, Bag: '10 µm felt', 'Design P (barg)': 10, Material: 'SS316' };
      return g;
    },
    'duplex-filter': function () {                          // two parallel housings + a top transfer/switching valve
      var g = new THREE.Group();
      var R = 0.6, H = 2.4, base = 2.0;
      [-0.9, 0.9].forEach(function (dx) {
        var sh = cyl(R, R, H, mats.silver, 22); sh.position.set(dx, base + H / 2, 0); g.add(sh);
        var dt = dishTop(R, base + H, mats.silver); dt.position.x = dx; g.add(dt);
        var db = dishBot(R, base, mats.silver); db.position.x = dx; g.add(db);
        var lg = legs(R, base, mats.dark, 3); lg.position.x = dx; g.add(lg);
      });
      var switchValve = cyl(0.4, 0.4, 2.2, mats.gold, 20); switchValve.rotation.z = Math.PI / 2; switchValve.position.y = base + H + 0.5; g.add(switchValve);
      var handle = box(0.9, 0.1, 0.1, mats.dark); handle.position.y = base + H + 1.0; g.add(handle);
      g.add(nozzleX2(-R - 1.4, base + H * 0.7, 0.24, mats.steel, -1)); g.add(nozzleX2(R + 1.4, base + H * 0.7, 0.24, mats.steel, 1));
      g.userData.props = { Type: 'Duplex (Twin) Filter', Housings: 2, Switching: 'Manual transfer valve, no-flow-interruption', Material: 'CS/SS316' };
      return g;
    },
    'self-clean-filter': function () {                      // housing + external motorized backwash drive
      var g = new THREE.Group();
      var R = 0.95, H = 2.8, base = 2.0;
      var sh = cyl(R, R, H, mats.silver, 26); sh.position.y = base + H / 2; g.add(sh);
      g.add(dishTop(R, base + H, mats.silver)); g.add(dishBot(R, base, mats.silver));
      var driveMot = cyl(0.35, 0.35, 0.8, mats.navy); driveMot.position.y = base + H + R + 0.4; g.add(driveMot);
      var gearbox = box(0.5, 0.4, 0.5, mats.dark); gearbox.position.y = base + H + R + 0.85; g.add(gearbox);
      var shaftM = cyl(0.06, 0.06, H, mats.steel); shaftM.position.y = base + H / 2; g.add(shaftM);
      g.add(nozzleX2(-R - 0.5, base + H * 0.75, 0.26, mats.steel, -1)); g.add(nozzleX2(R + 0.5, base + H * 0.75, 0.26, mats.steel, 1));
      var purge = cyl(0.16, 0.16, 0.6, mats.gunmetal); purge.position.y = base - 0.3; g.add(purge);
      g.add(legs(R, base, mats.dark, 4));
      g.userData.props = { Type: 'Self-Cleaning (Auto-Backwash) Filter', Drive: 'Motorized scraper/backwash', 'Design P (barg)': 10, Material: 'SS316' };
      return g;
    },
    'cyclone-sep': function () {                            // conical vortex separator with tangential inlet duct
      var g = new THREE.Group();
      var R = 0.8, cylH = 1.4, coneH = 2.2, base = 0.3;
      var body = cyl(R, R, cylH, mats.steel, 24); body.position.y = base + coneH + cylH / 2; g.add(body);
      var cone = cyl(R, 0.08, coneH, mats.gunmetal, 24); cone.position.y = base + coneH / 2; g.add(cone);
      var top = cyl(R, R, 0.15, mats.dark, 24); top.position.y = base + coneH + cylH; g.add(top);
      var inlet = box(0.9, 0.4, 0.3, mats.steel); inlet.position.set(-R - 0.35, base + coneH + cylH - 0.3, 0); g.add(inlet);
      var gasOut = cyl(0.22, 0.22, 0.8, mats.steel); gasOut.position.y = base + coneH + cylH + 0.4; g.add(gasOut);
      var solidsOut = cyl(0.1, 0.1, 0.4, mats.gunmetal); solidsOut.position.y = base - 0.2; g.add(solidsOut);
      g.userData.props = { Type: 'Cyclone Separator', 'Diameter (m)': 1.6, 'Cone angle (°)': 20, Efficiency: '95% @10µm', Material: 'CS/refractory-lined' };
      return g;
    },
    /* ── Pump sub-types that were sharing the centrifugal-pump shape ── */
    'vertical-turbine-pump': function () {                  // tall thin column pump — bowls at bottom, motor on top
      var g = new THREE.Group();
      var H = 5.5, R = 0.35;
      var column = cyl(R, R, H, mats.teal, 20); column.position.y = H / 2 + 0.3; g.add(column);
      var bowl = cyl(0.5, 0.3, 0.8, mats.gold, 20); bowl.position.y = 0.3; g.add(bowl);
      var baseFlange = cyl(0.6, 0.6, 0.15, mats.steel, 20); baseFlange.position.y = 0.05; g.add(baseFlange);
      var headPlate = cyl(0.55, 0.55, 0.2, mats.dark, 20); headPlate.position.y = H + 0.3; g.add(headPlate);
      var mot = cyl(0.35, 0.35, 0.9, mats.navy, 20); mot.position.y = H + 0.75 + 0.3; g.add(mot);
      for (var f = 0; f < 6; f++) { var fin = torus(0.37, 0.03, mats.dark); fin.rotation.x = Math.PI / 2; fin.position.y = H + 0.5 + 0.3 + f * 0.13; g.add(fin); }
      var disc = cyl(0.28, 0.28, 0.6, mats.teal, 16); disc.rotation.z = Math.PI / 2; disc.position.set(0.5, H + 0.3, 0); g.add(disc);
      g.add(flangeX(0.85, 0.4, mats.steel));
      var suction = cyl(0.2, 0.2, 0.4, mats.gunmetal); suction.position.y = 0.1; g.add(suction);
      g.userData.props = { Type: 'Vertical Turbine Pump', 'Flow (m³/h)': 250, 'Head (m)': 60, Setting: 'Wet-pit / can', Material: 'CS/SS bowls' };
      return g;
    },
    'split-case-pump': function () {                        // horizontal double-suction pump — inline flanges, visible split line
      var g = new THREE.Group();
      var casing = cyl(0.9, 0.9, 1.6, mats.blue, 24); casing.rotation.z = Math.PI / 2; casing.position.y = 1.3; g.add(casing);
      var splitLine = box(1.62, 0.03, 1.85, mats.navy); splitLine.position.y = 1.3; g.add(splitLine);
      g.add(flangeX(-0.95, 0.55, mats.steel)); g.add(flangeX(0.95, 0.55, mats.steel));
      var coup = cyl(0.22, 0.22, 0.4, mats.bolt); coup.rotation.z = Math.PI / 2; coup.position.set(1.35, 1.3, 0); g.add(coup);
      var guard = cyl(0.4, 0.4, 0.4, mats.dark, 16); guard.rotation.z = Math.PI / 2; guard.position.set(1.65, 1.3, 0); g.add(guard);
      var mot = cyl(0.75, 0.75, 1.9, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.set(2.9, 1.3, 0); g.add(mot);
      for (var fs = 0; fs < 8; fs++) { var fin2 = torus(0.78, 0.035, mats.dark); fin2.rotation.y = Math.PI / 2; fin2.position.set(2.1 + fs * 0.22, 1.3, 0); g.add(fin2); }
      var bp = box(5.6, 0.3, 2.0, mats.dark); bp.position.set(0.9, 0.15, 0); g.add(bp);
      g.userData.props = { Type: 'Split Case Pump (Double Suction)', 'Flow (m³/h)': 400, 'Head (m)': 55, RPM: 1480, 'Motor (kW)': 90, Material: 'CI/CS' };
      return g;
    },
    'screw-twin-pump': function () {                        // horizontal barrel with visible twin helical screw rotors
      var g = new THREE.Group();
      var body = cyl(0.5, 0.5, 2.2, mats.gunmetal, 20); body.rotation.z = Math.PI / 2; g.add(body);
      var win = box(0.02, 0.5, 1.6, mats.dark); g.add(win);
      [-0.16, 0.16].forEach(function (oy) {
        for (var i = 0; i < 8; i++) { var seg = torus(0.14, 0.05, mats.gold); seg.rotation.y = Math.PI / 2; seg.position.set(-0.9 + i * 0.22, oy, 0); g.add(seg); }
      });
      g.add(flangeX(-1.2, 0.5, mats.steel)); g.add(flangeX(1.2, 0.5, mats.steel));
      var mot = cyl(0.4, 0.4, 1.0, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.set(-1.9, 0, 0); g.add(mot);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Twin Screw Pump', 'Flow (m³/h)': 60, 'Diff P (bar)': 16, RPM: 1200, Material: 'CS/SS rotors' };
      return g;
    },
    'lobe-pump': function () {                              // compact sanitary rotary PD pump — twin lobe rotors on the face
      var g = new THREE.Group();
      var body = box(1.4, 1.2, 1.0, mats.forest); body.position.set(0, 1.0, 0); g.add(body);
      var face = box(0.12, 1.0, 0.85, mats.gunmetal); face.position.set(0.76, 1.0, 0); g.add(face);
      [[-0.2, 0.16], [0.2, -0.16]].forEach(function (o) {
        var lobe = mesh(new THREE.SphereGeometry(0.2, 12, 10), mats.gold); lobe.scale.z = 1.3; lobe.position.set(0.83, 1.0 + o[0], o[1]); g.add(lobe);
      });
      g.add(nozzleY(1.0 + 0.6 + 0.5, 0, 0.24, mats.forest, -0.5));
      g.add(nozzleX2(0.78, 1.0, 0.24, mats.forest, 1));
      var mot = cyl(0.38, 0.38, 0.9, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.set(-1.1, 1.0, 0); g.add(mot);
      var bp = box(3.2, 0.25, 1.4, mats.dark); bp.position.y = 0.18; g.add(bp);
      g.userData.props = { Type: 'Lobe Pump (Rotary PD)', 'Flow (m³/h)': 15, 'Diff P (bar)': 8, RPM: 400, Material: 'SS316 (sanitary)' };
      return g;
    },
    'recip-pump': function () {                             // reciprocating pump — crankcase + cylinder + plunger rod (covers plunger/piston/diaphragm)
      var g = new THREE.Group();
      var crankcase = box(1.6, 1.3, 1.1, mats.maroon); crankcase.position.set(-0.6, 1.1, 0); g.add(crankcase);
      var cylHead = cyl(0.35, 0.35, 1.3, mats.gunmetal, 16); cylHead.rotation.z = Math.PI / 2; cylHead.position.set(0.75, 1.1, 0); g.add(cylHead);
      var rod = cyl(0.08, 0.08, 0.6, mats.steel); rod.rotation.z = Math.PI / 2; rod.position.set(1.55, 1.1, 0); g.add(rod);
      g.add(flangeX(1.85, 0.32, mats.steel));
      var flywheel = torus(0.5, 0.1, mats.dark); flywheel.rotation.y = Math.PI / 2; flywheel.position.set(-1.35, 1.1, 0); g.add(flywheel);
      var mot = cyl(0.4, 0.4, 1.0, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.set(-2.2, 1.1, 0); g.add(mot);
      var bp = box(4.6, 0.3, 1.6, mats.dark); bp.position.y = 0.18; g.add(bp);
      g.userData.props = { Type: 'Reciprocating (Plunger/Piston) Pump', 'Flow (m³/h)': 12, 'Diff P (bar)': 150, Strokes: '4-cyl', Material: 'Forged steel' };
      return g;
    },
    'metering-skid': function () {                          // small dosing pump on a chemical tote skid
      var g = new THREE.Group();
      var tank = cyl(0.5, 0.55, 1.1, mats.glass, 20); tank.position.set(-0.7, 0.75, 0); g.add(tank);
      var pumpHead = box(0.5, 0.45, 0.4, mats.teal); pumpHead.position.set(0.5, 1.0, 0); g.add(pumpHead);
      var diaphragmCap = cyl(0.24, 0.24, 0.15, mats.gold, 16); diaphragmCap.rotation.z = Math.PI / 2; diaphragmCap.position.set(0.78, 1.0, 0); g.add(diaphragmCap);
      var dial = cyl(0.15, 0.15, 0.06, mats.white, 16); dial.rotation.x = Math.PI / 2; dial.position.set(0.5, 1.35, 0.05); g.add(dial);
      var mot = cyl(0.22, 0.22, 0.4, mats.navy); mot.rotation.x = Math.PI / 2; mot.position.set(0.5, 1.0, -0.35); g.add(mot);
      var skid = box(2.2, 0.15, 1.0, mats.dark); skid.position.y = 0.1; g.add(skid);
      g.add(nozzleY(1.0 + 0.3, 0, 0.1, mats.teal, 0.78));
      g.userData.props = { Type: 'Metering / Dosing Pump', 'Flow (L/h)': 40, 'Diff P (bar)': 10, Control: 'Stroke-length / speed', Material: 'PVC/SS wetted parts' };
      return g;
    },
    'submersible-pump': function () {                       // vertical pump-motor unit that hangs submerged — cable, elbow discharge
      var g = new THREE.Group();
      var motor = cyl(0.35, 0.35, 1.4, mats.dark, 20); motor.position.y = 0.9; g.add(motor);
      var pumpEnd = cyl(0.3, 0.38, 0.7, mats.gunmetal, 20); pumpEnd.position.y = 0.15; g.add(pumpEnd);
      var strainer = cyl(0.32, 0.32, 0.3, mats.steel, 16); strainer.position.y = -0.15; g.add(strainer);
      var elbow = mesh(new THREE.TorusGeometry(0.3, 0.13, 10, 16, Math.PI / 2), mats.dark); elbow.rotation.set(0, 0, Math.PI / 2); elbow.position.set(0.3, 1.75, 0); g.add(elbow);
      var disc = cyl(0.13, 0.13, 0.5, mats.dark); disc.rotation.z = Math.PI / 2; disc.position.set(0.55, 2.0, 0); g.add(disc);
      var cable = cyl(0.04, 0.04, 1.0, mats.dark, 8); cable.position.set(-0.3, 1.9, 0); g.add(cable);
      var handle = torus(0.15, 0.03, mats.steel); handle.rotation.x = Math.PI / 2; handle.position.y = 2.05; g.add(handle);
      g.userData.props = { Type: 'Submersible Pump', 'Flow (m³/h)': 30, 'Head (m)': 20, Motor: 'Wet-winding, IP68', Material: 'CI/SS316' };
      return g;
    },
    'slurry-pump': function () {                            // heavy-duty centrifugal pump — thick rubber/hard-metal-lined casing
      var g = new THREE.Group();
      var vol = cyl(1.9, 1.9, 1.4, mats.dark, 24); vol.rotation.x = Math.PI / 2; vol.position.set(-1.8, 1.6, 0); g.add(vol);
      var volFace = cyl(1.95, 1.95, 0.18, mats.maroon, 24); volFace.rotation.x = Math.PI / 2; volFace.position.set(-1.8, 1.6, 0.75); g.add(volFace);
      g.add(flgZ(-1.8, 1.6, 1.3, 0.9));
      var suc = cyl(0.7, 0.7, 1.1, mats.dark); suc.rotation.x = Math.PI / 2; suc.position.set(-1.8, 1.6, 1.6); g.add(suc);
      var dis = cyl(0.6, 0.6, 1.4, mats.dark); dis.position.set(-1.8, 2.9, 0); g.add(dis);
      g.add(nozzleY(3.7, 0, 0.6, mats.dark, -1.8));
      var mot = cyl(1.05, 1.05, 2.4, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.set(1.0, 1.6, 0); g.add(mot);
      for (var fsl = 0; fsl < 9; fsl++) { var fin3 = torus(1.08, 0.04, mats.dark); fin3.rotation.y = Math.PI / 2; fin3.position.set(-0.1 + fsl * 0.25, 1.6, 0); g.add(fin3); }
      var bp2 = box(5.8, 0.3, 2.6, mats.dark); bp2.position.set(-0.3, 0.15, 0); g.add(bp2);
      g.userData.props = { Type: 'Slurry Pump (Heavy Duty)', 'Flow (m³/h)': 350, 'Head (m)': 35, Lining: 'Natural rubber / hard metal', Material: 'CS shell' };
      return g;
    },
    /* ── Heat exchanger sub-types that were sharing the sthe / plate-hx shapes ── */
    'condenser-hx': function () {                           // shell & tube condenser — teal, vapor-in-top / condensate-out-bottom
      var g = new THREE.Group();
      var R = 1.5, L = 5;
      var shell = cyl(R, R, L, mats.teal); shell.rotation.z = Math.PI / 2; shell.position.y = 2.2; g.add(shell);
      for (var t = 0; t < 14; t++) { var a = t / 14 * Math.PI * 2, rr = R * 0.6; var tube = cyl(0.09, 0.09, L, mats.copper, 8); tube.rotation.z = Math.PI / 2; tube.position.set(0, 2.2 + Math.sin(a) * rr, Math.cos(a) * rr); g.add(tube); }
      g.add(dishSideNeg(R, -L / 2, 2.2, mats.teal)); g.add(dishSidePos(R, L / 2, 2.2, mats.teal));
      g.add(nozzleY(2.2 + R + 0.6, 0, 0.4, mats.steel, -L / 2 + 1));
      var condOut = cyl(0.3, 0.3, 0.9, mats.steel); condOut.position.y = 2.2 - R - 0.45; g.add(condOut);
      g.add(nozzleX2(-L / 2 - 0.6, 2.2, 0.35, mats.teal, -1)); g.add(nozzleX2(L / 2 + 0.6, 2.2, 0.35, mats.teal, 1));
      g.add(saddleAt(-L / 3, R, 2.2, mats.dark)); g.add(saddleAt(L / 3, R, 2.2, mats.dark));
      g.userData.props = { Type: 'Shell & Tube Condenser', 'Shell ID (mm)': 300, 'Duty (kW)': 900, Orientation: 'Horizontal', Material: 'CS shell / SS tubes' };
      return g;
    },
    'evaporator-hx': function () {                          // kettle-type evaporator — silver shell + integral vapor dome
      var g = new THREE.Group();
      var R = 1.5, L = 4.5;
      var shell = cyl(R, R, L, mats.silver); shell.rotation.z = Math.PI / 2; shell.position.y = 2.2; g.add(shell);
      var dome = mesh(new THREE.SphereGeometry(R * 0.8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.silver); dome.position.set(0.3, 2.2 + R * 0.6, 0); g.add(dome);
      g.add(dishSideNeg(R, -L / 2, 2.2, mats.silver)); g.add(dishSidePos(R, L / 2, 2.2, mats.silver));
      for (var te = 0; te < 10; te++) { var ae = te / 10 * Math.PI * 2; var tubeE = cyl(0.09, 0.09, L - 1, mats.copper, 8); tubeE.rotation.z = Math.PI / 2; tubeE.position.set(0.2, 2.2 + Math.sin(ae) * R * 0.45, Math.cos(ae) * R * 0.45); g.add(tubeE); }
      g.add(nozzleY(2.2 + R * 0.6 + R + 0.3, 0, 0.32, mats.steel, 0.3));
      g.add(nozzleX2(-L / 2 - 0.6, 2.2, 0.3, mats.silver, -1)); g.add(nozzleX2(L / 2 + 0.6, 2.2, 0.3, mats.silver, 1));
      g.add(saddleAt(-L / 3, R, 2.2, mats.dark)); g.add(saddleAt(L / 3, R, 2.2, mats.dark));
      g.userData.props = { Type: 'Evaporator', 'Shell ID (mm)': 300, 'Duty (kW)': 750, 'Vapor space': 'Integral dome', Material: 'SS316' };
      return g;
    },
    'spiral-coil-hx': function () {                         // flat spiral coil disc in a housing — single-channel self-cleaning HX
      var g = new THREE.Group();
      var cy = 1.6;
      for (var i = 0; i < 9; i++) { var r = 0.3 + i * 0.16; var coil = mesh(new THREE.TorusGeometry(r, 0.06, 10, 28), mats.copper); coil.rotation.x = Math.PI / 2; coil.position.y = cy; g.add(coil); }
      var housing = cyl(1.75, 1.75, 0.3, mats.gunmetal, 32); housing.rotation.x = Math.PI / 2; housing.position.set(0, cy, -0.5); g.add(housing);
      g.add(nozzleX2(-1.9, cy, 0.28, mats.steel, -1)); g.add(nozzleX2(1.9, cy, 0.28, mats.steel, 1));
      g.add(legs(1.6, 1.6, mats.dark, 4));
      g.userData.props = { Type: 'Spiral Heat Exchanger', 'Duty (kW)': 400, Channel: 'Single spiral, self-cleaning', Material: 'SS316' };
      return g;
    },
    /* ── Utility package sub-types that were sharing sthe / v-vessel / h-vessel ── */
    'chiller-pkg': function () {                            // package chiller unit — twin condenser fans + compressor box
      var g = new THREE.Group();
      var cab = box(3.4, 1.6, 1.8, mats.white); cab.position.y = 1.0; g.add(cab);
      [-0.9, 0.9].forEach(function (fx) {
        var grille = cyl(0.55, 0.55, 0.15, mats.dark, 20); grille.rotation.x = Math.PI / 2; grille.position.set(fx, 1.0, 0.93); g.add(grille);
        var fan = new THREE.Group();
        for (var b = 0; b < 5; b++) { var bl = box(0.9, 0.04, 0.28, mats.sky); bl.rotation.y = b / 5 * Math.PI * 2; fan.add(bl); }
        fan.position.set(fx, 1.0, 0.9); fan.userData.spin = 'y'; spinTag(fan); g.add(fan);
      });
      var compBox = box(0.7, 0.6, 0.7, mats.gunmetal); compBox.position.set(0, 1.0, -0.9); g.add(compBox);
      g.add(nozzleX2(-1.8, 0.7, 0.24, mats.blue, -1)); g.add(nozzleX2(1.8, 0.7, 0.24, mats.blue, 1));
      [[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]].forEach(function (p) { var lg = box(0.15, 0.4, 0.15, mats.dark); lg.position.set(p[0], 0.2, p[1]); g.add(lg); });
      g.userData.props = { Type: 'Package Chiller', 'Capacity (kW)': 350, Refrigerant: 'R134a/R410A', Compressor: 'Scroll', Material: 'CS painted' };
      return g;
    },
    'header-pipe': function () {                            // long utility header — main pipe with multiple valved branch take-offs
      var g = new THREE.Group();
      var main = cyl(0.35, 0.35, 6, mats.steel, 20); main.rotation.z = Math.PI / 2; main.position.y = 1.6; g.add(main);
      g.add(flangeX(-3, 0.5, mats.gunmetal)); g.add(flangeX(3, 0.5, mats.gunmetal));
      for (var i = 0; i < 5; i++) {
        var x = -2.4 + i * 1.2;
        var br = cyl(0.14, 0.14, 0.9, mats.steel); br.position.set(x, 2.1, 0); g.add(br);
        var vlv = cyl(0.16, 0.16, 0.3, mats.blue, 12); vlv.position.set(x, 2.55, 0); g.add(vlv);
      }
      g.add(legs(0.5, 1.6, mats.dark, 6));
      g.userData.props = { Type: 'Utility Header (Steam/Water)', 'Size (NPS)': 6, Branches: 5, Material: 'CS' };
      return g;
    },
    /* ── Instrument sub-types — the biggest gap vs. the reference sheet ── */
    'pressure-transmitter': function () {
      var g = new THREE.Group();
      var stem = cyl(0.08, 0.08, 0.65, mats.steel); stem.position.y = 0.33; g.add(stem);
      var manifold = box(0.3, 0.22, 0.2, mats.gunmetal); manifold.position.y = 0.75; g.add(manifold);
      var head = transmitterHead(mats.blue); head.position.y = 1.15; g.add(head);
      g.userData.props = { Type: 'Pressure Transmitter (PT)', Signal: '4-20 mA / HART', Range: '0-25 barg', Accuracy: '±0.075%' };
      return g;
    },
    'pressure-indicator': function () {                     // digital panel indicator — green LED (vs. TI's red) to stay distinct
      var g = new THREE.Group();
      var ledMat = new THREE.MeshStandardMaterial({ color: 0x30ff60, emissive: 0x009933, emissiveIntensity: 0.7, metalness: 0.1, roughness: 0.4 });
      var stem = cyl(0.09, 0.09, 0.85, mats.steel); stem.position.y = 0.43; g.add(stem);
      var arm = box(0.5, 0.08, 0.08, mats.dark); arm.position.set(0.25, 0.85, 0); g.add(arm);
      var body = box(0.62, 0.42, 0.24, mats.dark); body.position.set(0.55, 0.9, 0); g.add(body);
      var bezel = box(0.5, 0.28, 0.03, mats.gunmetal); bezel.position.set(0.55, 0.94, 0.13); g.add(bezel);
      var screen = box(0.42, 0.2, 0.02, mats.dark); screen.position.set(0.55, 0.94, 0.15); g.add(screen);
      var digit = box(0.32, 0.1, 0.012, ledMat); digit.position.set(0.55, 0.96, 0.16); g.add(digit);
      g.userData.props = { Type: 'Pressure Indicator (Digital)', Display: 'Digital LED, panel-mount', Range: '0-25 bar', Signal: '4-20 mA input' };
      return g;
    },
    'temp-transmitter': function () {
      var g = new THREE.Group();
      var well = cyl(0.08, 0.05, 0.9, mats.steel); well.rotation.z = Math.PI / 2; well.position.set(0.45, 0.5, 0); g.add(well);
      var neck = cyl(0.1, 0.1, 0.45, mats.steel); neck.position.y = 0.7; g.add(neck);
      var head = transmitterHead(mats.blue); head.position.y = 1.1; g.add(head);
      g.userData.props = { Type: 'Temperature Transmitter (TT)', Signal: '4-20 mA / HART', Element: 'RTD Pt100 + thermowell' };
      return g;
    },
    'thermowell-bare': function () {
      var g = new THREE.Group();
      var well = cyl(0.09, 0.05, 1.1, mats.steel, 16); well.rotation.z = Math.PI / 2; well.position.x = 0.5; g.add(well);
      g.add(flangeX(0, 0.22, mats.gunmetal));
      var nut = cyl(0.14, 0.14, 0.2, mats.dark, 6); nut.rotation.z = Math.PI / 2; nut.position.x = 0.06; g.add(nut);
      g.position.y = 0.6;
      g.userData.props = { Type: 'Thermowell', Material: 'SS316', Insertion: '150mm', Connection: '3/4" NPT / flanged' };
      return g;
    },
    'venturi-meter': function () {
      var g = new THREE.Group();
      var conv = cyl(0.4, 0.2, 0.7, mats.steel, 20); conv.rotation.z = Math.PI / 2; conv.position.x = -0.55; g.add(conv);
      var throat = cyl(0.2, 0.2, 0.5, mats.gold, 20); throat.rotation.z = Math.PI / 2; g.add(throat);
      var div = cyl(0.2, 0.4, 0.9, mats.steel, 20); div.rotation.z = Math.PI / 2; div.position.x = 0.7; g.add(div);
      g.add(flangeX(-0.95, 0.55, mats.gunmetal)); g.add(flangeX(1.2, 0.55, mats.gunmetal));
      var tapHi = cyl(0.04, 0.04, 0.35, mats.steel); tapHi.position.set(-0.55, 0.35, 0); g.add(tapHi);
      var tapLo = cyl(0.04, 0.04, 0.35, mats.steel); tapLo.position.set(0, 0.35, 0); g.add(tapLo);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Venturi Meter', 'Beta ratio': 0.5, 'Size (NPS)': 4, 'Permanent PL': 'Low (~10%)' };
      return g;
    },
    'vortex-meter': function () {
      var g = new THREE.Group();
      var body = cyl(0.35, 0.35, 1.6, mats.steel, 20); body.rotation.z = Math.PI / 2; g.add(body);
      var bluff = box(0.06, 0.5, 0.3, mats.dark); g.add(bluff);
      g.add(flangeX(-0.95, 0.5, mats.gunmetal)); g.add(flangeX(0.95, 0.5, mats.gunmetal));
      var neck = cyl(0.1, 0.1, 0.3, mats.dark); neck.position.y = 0.55; g.add(neck);
      var head = transmitterHead(mats.blue); head.position.y = 0.95; g.add(head);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Vortex Flow Meter', Signal: '4-20 mA / pulse', 'Size (NPS)': 3, Technology: 'Vortex shedding' };
      return g;
    },
    'coriolis-meter': function () {                         // iconic curved twin-tube sensor + electronics casing
      var g = new THREE.Group();
      var s1 = cyl(0.22, 0.22, 0.6, mats.steel, 16); s1.rotation.z = Math.PI / 2; s1.position.x = -0.8; g.add(s1);
      var s2 = cyl(0.22, 0.22, 0.6, mats.steel, 16); s2.rotation.z = Math.PI / 2; s2.position.x = 0.8; g.add(s2);
      g.add(flangeX(-1.1, 0.42, mats.gunmetal)); g.add(flangeX(1.1, 0.42, mats.gunmetal));
      var casing = box(1.4, 0.9, 0.7, mats.forest); casing.position.y = 0.35; g.add(casing);
      [0.18, -0.18].forEach(function (zz) { var tube = mesh(new THREE.TorusGeometry(0.55, 0.06, 10, 20, Math.PI), mats.steel); tube.rotation.set(0, Math.PI / 2, 0); tube.position.set(0, 0.55, zz); g.add(tube); });
      var head = transmitterHead(mats.blue); head.position.set(0, 1.1, 0); g.add(head);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Coriolis Mass Flow Meter', Signal: '4-20 mA / HART / pulse', 'Size (NPS)': 2, Accuracy: '±0.1% mass' };
      return g;
    },
    'level-transmitter': function () {
      var g = new THREE.Group();
      g.add(flangeX(0, 0.35, mats.gunmetal));
      var neck = cyl(0.12, 0.12, 0.35, mats.steel); neck.rotation.z = Math.PI / 2; neck.position.x = 0.35; g.add(neck);
      var head = transmitterHead(mats.blue); head.rotation.z = -Math.PI / 2; head.position.x = 0.75; g.add(head);
      var probe = cyl(0.04, 0.02, 1.6, mats.steel, 10); probe.position.y = -0.85; g.add(probe);
      g.position.y = 2.0;
      g.userData.props = { Type: 'Level Transmitter (Guided-Wave Radar)', Signal: '4-20 mA / HART', Range: '0-2 m' };
      return g;
    },
    'radar-level': function () {                            // top-mount radar — horn antenna aims down into the vessel
      var g = new THREE.Group();
      g.add(flangeX(0, 0.4, mats.gunmetal));
      var neck = cyl(0.14, 0.14, 0.3, mats.steel); neck.rotation.z = Math.PI / 2; neck.position.x = 0.3; g.add(neck);
      var head = transmitterHead(mats.blue); head.rotation.z = -Math.PI / 2; head.position.x = 0.65; g.add(head);
      var horn = cyl(0.18, 0.08, 0.5, mats.silver, 16); horn.position.y = -0.4; g.add(horn);
      g.position.y = 2.0;
      g.userData.props = { Type: 'Radar Level Meter (FMCW)', Signal: '4-20 mA / HART', Antenna: 'Horn, non-contact' };
      return g;
    },
    'dp-transmitter': function () {
      var g = new THREE.Group();
      var manifold = box(0.5, 0.35, 0.3, mats.gunmetal); manifold.position.y = 0.4; g.add(manifold);
      var tapHi2 = cyl(0.05, 0.05, 0.4, mats.steel); tapHi2.rotation.z = Math.PI / 2; tapHi2.position.set(-0.4, 0.32, 0); g.add(tapHi2);
      var tapLo2 = cyl(0.05, 0.05, 0.4, mats.steel); tapLo2.rotation.z = Math.PI / 2; tapLo2.position.set(0.4, 0.32, 0); g.add(tapLo2);
      var head = transmitterHead(mats.blue); head.position.y = 0.8; g.add(head);
      g.userData.props = { Type: 'Differential Pressure Transmitter (dPT)', Signal: '4-20 mA / HART', Range: '0-500 mbar' };
      return g;
    },
    'ph-meter': function () {
      var g = new THREE.Group();
      var boxBody = box(0.7, 0.9, 0.3, mats.dark); boxBody.position.y = 1.2; g.add(boxBody);
      var lcdMat = new THREE.MeshStandardMaterial({ color: 0x0a3d1e, emissive: 0x0a3d1e, emissiveIntensity: 0.4 });
      var screen = box(0.5, 0.35, 0.02, lcdMat); screen.position.set(0, 1.35, 0.16); g.add(screen);
      var probe = cyl(0.05, 0.05, 0.8, mats.steel); probe.position.set(0, 0.4, 0.2); g.add(probe);
      var bulb = mesh(new THREE.SphereGeometry(0.07, 10, 8), mats.glass); bulb.position.set(0, 0, 0.2); g.add(bulb);
      g.userData.props = { Type: 'pH Analyzer', Range: '0-14 pH', Signal: '4-20 mA', Electrode: 'Glass combination' };
      return g;
    },
    'conductivity-meter': function () {
      var g = new THREE.Group();
      var boxBody = box(0.7, 0.9, 0.3, mats.dark); boxBody.position.y = 1.2; g.add(boxBody);
      var lcdMat2 = new THREE.MeshStandardMaterial({ color: 0x0a3d1e, emissive: 0x0a3d1e, emissiveIntensity: 0.4 });
      var screen2 = box(0.5, 0.35, 0.02, lcdMat2); screen2.position.set(0, 1.35, 0.16); g.add(screen2);
      var probe2 = cyl(0.06, 0.06, 0.8, mats.gold); probe2.position.set(0, 0.4, 0.2); g.add(probe2);
      g.userData.props = { Type: 'Conductivity Analyzer', Range: '0-2000 µS/cm', Signal: '4-20 mA', Sensor: '2-electrode' };
      return g;
    },
    'o2-analyzer': function () {
      var g = new THREE.Group();
      var boxBody = box(0.7, 0.9, 0.35, mats.gunmetal); boxBody.position.y = 1.2; g.add(boxBody);
      var lcdMat3 = new THREE.MeshStandardMaterial({ color: 0x0a3d1e, emissive: 0x0a3d1e, emissiveIntensity: 0.4 });
      var screen3 = box(0.5, 0.35, 0.02, lcdMat3); screen3.position.set(0, 1.35, 0.19); g.add(screen3);
      var probe3 = cyl(0.06, 0.06, 0.9, mats.steel); probe3.rotation.x = Math.PI / 2; probe3.position.set(0, 0.75, 0.65); g.add(probe3);
      g.userData.props = { Type: 'Oxygen Analyzer', Range: '0-25% O₂', Signal: '4-20 mA', Sensor: 'Zirconia / paramagnetic' };
      return g;
    },
    'valve-positioner': function () {
      var g = new THREE.Group();
      var bodyP = box(0.5, 0.4, 0.35, mats.dark); bodyP.position.y = 0.5; g.add(bodyP);
      var gauge1 = cyl(0.12, 0.12, 0.06, mats.white, 16); gauge1.rotation.x = Math.PI / 2; gauge1.position.set(-0.12, 0.6, 0.19); g.add(gauge1);
      var gauge2 = cyl(0.12, 0.12, 0.06, mats.white, 16); gauge2.rotation.x = Math.PI / 2; gauge2.position.set(0.14, 0.6, 0.19); g.add(gauge2);
      var bracket = box(0.15, 0.6, 0.15, mats.steel); bracket.position.y = 0.15; g.add(bracket);
      g.userData.props = { Type: 'Valve Positioner', Signal: '4-20 mA / HART', Action: 'Pneumatic feedback' };
      return g;
    },
    'pressure-switch': function () {
      var g = new THREE.Group();
      var bodyPs = cyl(0.22, 0.22, 0.35, mats.dark, 16); bodyPs.rotation.x = Math.PI / 2; bodyPs.position.y = 0.55; g.add(bodyPs);
      var cap = box(0.3, 0.22, 0.28, mats.dark); cap.position.y = 0.75; g.add(cap);
      var stem = cyl(0.06, 0.06, 0.5, mats.steel); stem.position.y = 0.25; g.add(stem);
      g.userData.props = { Type: 'Pressure Switch', Setpoint: 'Adjustable', Contact: 'SPDT' };
      return g;
    },
    'temp-switch': function () {
      var g = new THREE.Group();
      var bodyTs = cyl(0.2, 0.2, 0.32, mats.dark, 16); bodyTs.position.y = 0.9; g.add(bodyTs);
      var well = cyl(0.06, 0.04, 0.9, mats.steel); well.rotation.z = Math.PI / 2; well.position.set(0.45, 0.55, 0); g.add(well);
      g.userData.props = { Type: 'Temperature Switch', Setpoint: 'Adjustable', Contact: 'SPDT' };
      return g;
    },
    'flow-switch': function () {
      var g = new THREE.Group();
      var stub = cyl(0.32, 0.32, 1.2, mats.steel, 16); stub.rotation.z = Math.PI / 2; g.add(stub);
      g.add(flangeX(-0.7, 0.44, mats.gunmetal)); g.add(flangeX(0.7, 0.44, mats.gunmetal));
      var bodyFs = box(0.3, 0.35, 0.3, mats.dark); bodyFs.position.y = 0.5; g.add(bodyFs);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Flow Switch (Paddle)', Contact: 'SPDT', Media: 'Liquid' };
      return g;
    },
    'level-switch': function () {
      var g = new THREE.Group();
      var bodyLs = box(0.34, 0.4, 0.3, mats.dark); bodyLs.position.y = 0.9; g.add(bodyLs);
      var stem = cyl(0.05, 0.05, 0.7, mats.steel); stem.position.y = 0.4; g.add(stem);
      var float1 = torus(0.14, 0.06, mats.gold); float1.rotation.x = Math.PI / 2; float1.position.y = 0.15; g.add(float1);
      g.userData.props = { Type: 'Level Switch (Float)', Contact: 'SPDT', Mount: 'Side/top' };
      return g;
    },
    'steam-trap': function () {
      var g = new THREE.Group();
      var bodySt = mesh(new THREE.SphereGeometry(0.35, 16, 12), mats.navy); bodySt.scale.y = 1.3; g.add(bodySt);
      g.add(flgZ(0, 0, 0.35, 0.28)); var inNoz = cyl(0.16, 0.16, 0.3, mats.navy); inNoz.rotation.x = Math.PI / 2; inNoz.position.z = 0.2; g.add(inNoz);
      g.add(flgZ(0, 0, -0.35, 0.28)); var outNoz = cyl(0.16, 0.16, 0.3, mats.navy); outNoz.rotation.x = Math.PI / 2; outNoz.position.z = -0.2; g.add(outNoz);
      var cap = cyl(0.25, 0.25, 0.15, mats.dark, 16); cap.position.y = 0.5; g.add(cap);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Steam Trap (Float & Thermostatic)', 'Size (NPS)': 1, 'Design P (barg)': 14, Material: 'CS/SS' };
      return g;
    },
    'sight-glass': function () {
      var g = new THREE.Group();
      var s1 = cyl(0.3, 0.3, 0.5, mats.steel); s1.rotation.z = Math.PI / 2; s1.position.x = -0.4; g.add(s1);
      var s2 = cyl(0.3, 0.3, 0.5, mats.steel); s2.rotation.z = Math.PI / 2; s2.position.x = 0.4; g.add(s2);
      g.add(flangeX(-0.1, 0.46, mats.gunmetal)); g.add(flangeX(0.1, 0.46, mats.gunmetal));
      var glass = cyl(0.3, 0.3, 0.04, mats.glass, 24); glass.rotation.z = Math.PI / 2; g.add(glass);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Sight Glass (Flow Indicator)', 'Size (NPS)': 3, Glass: 'Borosilicate', Rating: 'CL150' };
      return g;
    },
    /* ── Valve sub-types that were sharing the generic Gate Valve shape ── */
    'solenoid-valve': function () {                        // brass body + black electrical coil box
      var g = new THREE.Group();
      var body = cyl(0.35, 0.35, 0.9, mats.brass, 20); body.rotation.z = Math.PI / 2; g.add(body);
      g.add(flangeX(-0.55, 0.45, mats.steel)); g.add(flangeX(0.55, 0.45, mats.steel));
      var coilBase = cyl(0.22, 0.22, 0.3, mats.dark, 16); coilBase.position.y = 0.5; g.add(coilBase);
      var coil = box(0.5, 0.55, 0.4, mats.dark); coil.position.y = 0.9; g.add(coil);
      var conn = cyl(0.1, 0.1, 0.18, mats.gunmetal, 10); conn.position.y = 1.25; g.add(conn);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Solenoid Valve', 'Size (NPS)': 1, Voltage: '24V DC / 230V AC', Action: '2-way, normally closed' };
      return g;
    },
    'diaphragm-valve': function () {                        // weir body + large diaphragm bonnet dome
      var g = new THREE.Group();
      var body = mesh(new THREE.SphereGeometry(0.5, 18, 14), mats.white); body.scale.set(1, 0.75, 0.9); g.add(body);
      g.add(flangeX(-0.75, 0.5, mats.steel)); g.add(flangeX(0.75, 0.5, mats.steel));
      var bonnet = cyl(0.38, 0.46, 0.35, mats.dark, 20); bonnet.position.y = 0.55; g.add(bonnet);
      var dome = mesh(new THREE.SphereGeometry(0.46, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.dark); dome.position.y = 0.72; g.add(dome);
      var wheel = torus(0.28, 0.045, mats.blue); wheel.rotation.x = Math.PI / 2; wheel.position.y = 1.05; g.add(wheel);
      var stem = cyl(0.05, 0.05, 0.25, mats.steel); stem.position.y = 0.9; g.add(stem);
      g.position.y = 1.2;
      g.userData.props = { Type: 'Diaphragm Valve (Weir type)', 'Size (NPS)': 3, Body: 'PP/PVDF lined', Diaphragm: 'PTFE-faced EPDM' };
      return g;
    },
    'pinch-valve': function () {                            // rubber sleeve body pinched by external bars
      var g = new THREE.Group();
      var sleeve = mesh(new THREE.SphereGeometry(0.42, 16, 12), mats.dark); sleeve.scale.set(1.3, 1, 0.55); g.add(sleeve);
      g.add(flangeX(-0.68, 0.42, mats.steel)); g.add(flangeX(0.68, 0.42, mats.steel));
      var barTop = box(1.0, 0.08, 0.12, mats.gunmetal); barTop.position.y = 0.28; g.add(barTop);
      var barBot = box(1.0, 0.08, 0.12, mats.gunmetal); barBot.position.y = -0.28; g.add(barBot);
      var actBody = box(0.2, 0.5, 0.2, mats.gunmetal); actBody.position.y = 0.5; g.add(actBody);
      var handle = box(0.4, 0.06, 0.06, mats.red); handle.position.y = 0.78; g.add(handle);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Pinch Valve', 'Size (NPS)': 3, Sleeve: 'Natural rubber / EPDM', Use: 'Slurry / abrasive service' };
      return g;
    },
    'knife-gate': function () {                             // thin wafer body + visible flat blade, no long bonnet
      var g = new THREE.Group();
      var body = cyl(0.6, 0.6, 0.22, mats.gunmetal, 24); body.rotation.z = Math.PI / 2; g.add(body);
      g.add(boltCircle(8, 0.5, 0, 'y', mats.bolt));
      var yoke = box(0.06, 1.1, 0.4, mats.steel); yoke.position.y = 0.7; g.add(yoke);
      var blade = box(0.04, 0.9, 0.5, mats.silver); blade.position.y = 0.6; g.add(blade);
      var handwheelStem = cyl(0.04, 0.04, 0.3, mats.steel); handwheelStem.position.y = 1.55; g.add(handwheelStem);
      var wheel = torus(0.24, 0.035, mats.dark); wheel.rotation.x = Math.PI / 2; wheel.position.y = 1.75; g.add(wheel);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Knife Gate Valve', 'Size (NPS)': 4, Body: 'Lug/wafer, thin profile', Use: 'Slurry / pulp / powder' };
      return g;
    },
    'cryo-valve': function () {                             // extended bonnet / tall stem for cryogenic service
      var g = new THREE.Group();
      var body = mesh(new THREE.SphereGeometry(0.42, 18, 14), mats.silver); g.add(body);
      g.add(flgZ(0, 0, 0.5, 0.32)); var inNoz = cyl(0.2, 0.2, 0.35, mats.silver); inNoz.rotation.x = Math.PI / 2; inNoz.position.z = 0.32; g.add(inNoz);
      g.add(flgZ(0, 0, -0.5, 0.32)); var outNoz = cyl(0.2, 0.2, 0.35, mats.silver); outNoz.rotation.x = Math.PI / 2; outNoz.position.z = -0.32; g.add(outNoz);
      var extBonnet = cyl(0.14, 0.2, 1.6, mats.silver, 16); extBonnet.position.y = 1.0; g.add(extBonnet);
      var wheel = torus(0.32, 0.045, mats.dark); wheel.rotation.x = Math.PI / 2; wheel.position.y = 1.9; g.add(wheel);
      g.position.y = 1.1;
      g.userData.props = { Type: 'Cryogenic Valve (Extended Bonnet)', 'Size (NPS)': 2, 'Design T (°C)': -196, Bonnet: 'Extended, low-heat-leak' };
      return g;
    },
    'angle-valve': function () {                            // 90°-offset ports — inlet horizontal, outlet vertical
      var g = new THREE.Group();
      var body = mesh(new THREE.SphereGeometry(0.42, 18, 14), mats.blue); g.add(body);
      g.add(flgZ(0, 0, 0.5, 0.32)); var inNoz = cyl(0.2, 0.2, 0.35, mats.blue); inNoz.rotation.x = Math.PI / 2; inNoz.position.z = 0.32; g.add(inNoz);
      var outFace = cyl(0.32, 0.32, 0.12, mats.steel, 20); outFace.position.y = 0.55; g.add(outFace);
      g.add(boltCircle(6, 0.26, 0.55, 'y', mats.bolt));
      var outNoz = cyl(0.2, 0.2, 0.3, mats.blue); outNoz.position.y = 0.35; g.add(outNoz);
      var wheel = torus(0.26, 0.04, mats.dark); wheel.rotation.z = Math.PI / 2; wheel.position.x = -0.5; g.add(wheel);
      var stem = cyl(0.04, 0.04, 0.35, mats.steel); stem.rotation.z = Math.PI / 2; stem.position.x = -0.2; g.add(stem);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Angle Valve', 'Size (NPS)': 2, Pattern: '90° angle body', Body: 'SS316' };
      return g;
    },
    'foot-valve': function () {                             // check valve + screened strainer inlet, submerged suction
      var g = new THREE.Group();
      var body = cyl(0.35, 0.35, 0.7, mats.gunmetal, 20); g.add(body);
      var screen = cyl(0.3, 0.3, 0.55, mats.silver, 16); screen.position.y = -0.55; g.add(screen);
      for (var i = 0; i < 8; i++) { var slot = torus(0.31, 0.015, mats.dark); slot.rotation.x = Math.PI / 2; slot.position.y = -0.35 - i * 0.045; g.add(slot); }
      var outFace2 = cyl(0.35, 0.35, 0.1, mats.steel, 20); outFace2.position.y = 0.4; g.add(outFace2);
      g.add(boltCircle(6, 0.3, 0.4, 'y', mats.bolt));
      g.position.y = 1.3;
      g.userData.props = { Type: 'Foot Valve (Check + Strainer)', 'Size (NPS)': 3, Use: 'Pump suction, submerged', Screen: 'SS mesh' };
      return g;
    },
    'breather-valve': function () {                         // weight-loaded pallet valve on a tank vent nozzle
      var g = new THREE.Group();
      var base = cyl(0.4, 0.4, 0.3, mats.gunmetal, 20); g.add(base);
      var domeIn = mesh(new THREE.SphereGeometry(0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.silver); domeIn.position.y = 0.25; g.add(domeIn);
      var weightStem = cyl(0.03, 0.03, 0.3, mats.dark); weightStem.position.y = 0.5; g.add(weightStem);
      var weight = cyl(0.18, 0.18, 0.08, mats.dark, 16); weight.position.y = 0.62; g.add(weight);
      g.add(boltCircle(8, 0.34, -0.15, 'y', mats.bolt));
      g.position.y = 1.4;
      g.userData.props = { Type: 'Breather Valve (P/V)', 'Size (NPS)': 4, Setting: '±20 mbar', Use: 'Tank vent, conservation' };
      return g;
    },
    'deluge-valve': function () {                           // diaphragm-actuated fire-protection valve, red-painted
      var g = new THREE.Group();
      var body = mesh(new THREE.SphereGeometry(0.4, 18, 14), mats.red); body.scale.set(1, 1.1, 1); g.add(body);
      g.add(flangeX(-0.65, 0.44, mats.gunmetal)); g.add(flangeX(0.65, 0.44, mats.gunmetal));
      var bonnet = cyl(0.32, 0.4, 0.35, mats.red); bonnet.position.y = 0.55; g.add(bonnet);
      var trim = box(0.5, 0.12, 0.12, mats.gunmetal); trim.position.set(0.35, 0.35, 0); g.add(trim);
      var lever = box(0.32, 0.05, 0.05, mats.gold); lever.position.set(0.5, 0.35, 0); g.add(lever);
      g.position.y = 1.3;
      g.userData.props = { Type: 'Deluge Valve', 'Size (NPS)': 4, Actuation: 'Electric/pneumatic/hydraulic release', Use: 'Fire protection water spray' };
      return g;
    },
    'flush-bottom': function () {                           // large flanged valve flush-mounted at a vessel bottom outlet
      var g = new THREE.Group();
      var topFlange = cyl(0.55, 0.55, 0.15, mats.gunmetal, 24); g.add(topFlange);
      g.add(boltCircle(10, 0.46, 0, 'y', mats.bolt));
      var body = cyl(0.4, 0.32, 0.55, mats.steel, 20); body.position.y = -0.35; g.add(body);
      var outNoz = cyl(0.22, 0.22, 0.4, mats.steel); outNoz.rotation.z = Math.PI / 2; outNoz.position.set(0.4, -0.55, 0); g.add(outNoz);
      var outFlange = flangeX(0.6, 0.34, mats.gunmetal); outFlange.position.y = -0.55; g.add(outFlange);
      var wheel = torus(0.24, 0.035, mats.dark); wheel.rotation.z = Math.PI / 2; wheel.position.set(0.85, -0.55, 0); g.add(wheel);
      g.position.y = 1.9;
      g.userData.props = { Type: 'Flush Bottom Valve', 'Size (NPS)': 3, Mount: 'Vessel bottom outlet', Use: 'Reactor/vessel discharge' };
      return g;
    },
    /* ── Compressor / rotating-machine sub-types that were sharing the generic Compressor shape ── */
    'axial-compressor': function () {                       // long staged casing — very different silhouette from a centrifugal machine
      var g = new THREE.Group();
      var casing = cyl(0.55, 0.55, 3.2, mats.gunmetal, 24); casing.rotation.z = Math.PI / 2; g.add(casing);
      for (var i = 0; i < 8; i++) { var stage = cyl(0.58, 0.58, 0.1, mats.dark, 24); stage.rotation.z = Math.PI / 2; stage.position.x = -1.5 + i * 0.42; g.add(stage); }
      g.add(flangeX(-1.65, 0.5, mats.steel)); g.add(flangeX(1.65, 0.5, mats.steel));
      var mot = cyl(0.5, 0.5, 1.1, mats.navy); mot.rotation.z = Math.PI / 2; mot.position.x = 2.3; g.add(mot);
      var bp = box(5.2, 0.3, 1.6, mats.dark); bp.position.y = -0.75; g.add(bp);
      g.position.y = 1.05;
      g.userData.props = { Type: 'Axial Compressor', 'Flow (Am³/h)': 40000, Stages: 8, RPM: 8000, Material: 'CS/Ti blades' };
      return g;
    },
    'turbine-steam': function () {                          // tapered casing + steam chest + reduction gearbox
      var g = new THREE.Group();
      var casing = cyl(0.45, 0.75, 2.6, mats.maroon, 24); casing.rotation.z = Math.PI / 2; g.add(casing);
      var steamChest = box(0.7, 0.7, 0.7, mats.gunmetal); steamChest.position.set(-1.2, 0.3, 0); g.add(steamChest);
      var inletNoz = cyl(0.22, 0.22, 0.5, mats.steel); inletNoz.position.set(-1.2, 0.8, 0); g.add(inletNoz);
      g.add(flangeX(1.35, 0.4, mats.steel));
      var gearbox = box(0.9, 0.7, 0.9, mats.dark); gearbox.position.x = 1.9; g.add(gearbox);
      var shaft = cyl(0.12, 0.12, 0.6, mats.steel); shaft.rotation.z = Math.PI / 2; shaft.position.x = 2.6; g.add(shaft);
      var bp2 = box(5.6, 0.3, 1.8, mats.dark); bp2.position.y = -0.85; g.add(bp2);
      g.position.y = 1.15;
      g.userData.props = { Type: 'Steam Turbine', 'Power (kW)': 3000, Inlet: 'HP steam', Exhaust: 'Condensing/back-pressure', Material: 'CS/alloy blading' };
      return g;
    },
    /* ── Flange / nozzle sub-types that were sharing the weld-neck stub shape ── */
    'blind-flange': function () {                           // solid disc — no bore, caps a nozzle
      var g = new THREE.Group();
      var disc = cyl(0.6, 0.6, 0.22, mats.gunmetal, 24); disc.rotation.z = Math.PI / 2; g.add(disc);
      g.add(boltCircle(8, 0.5, 0.11, 'x', mats.bolt));
      g.position.y = 1.3;
      g.userData.props = { Type: 'Blind Flange', 'Size (NPS)': 4, Rating: 'CL150 RF', Material: 'A105' };
      return g;
    },
    'manway': function () {                                 // large access port with a hinged, davited cover
      var g = new THREE.Group();
      var neck = cyl(0.55, 0.55, 0.4, mats.steel, 28); neck.rotation.z = Math.PI / 2; g.add(neck);
      var cover = cyl(0.68, 0.68, 0.14, mats.gunmetal, 28); cover.rotation.z = Math.PI / 2; cover.position.x = 0.27; g.add(cover);
      g.add(boltCircle(12, 0.58, 0.34, 'x', mats.bolt));
      var hinge = box(0.5, 0.1, 0.1, mats.dark); hinge.position.set(0.34, 0.68, 0); g.add(hinge);
      var davit = cyl(0.05, 0.05, 0.9, mats.dark); davit.position.y = 0.9; g.add(davit);
      g.position.y = 1.5;
      g.userData.props = { Type: 'Manway', 'Size (in)': 20, Cover: 'Hinged, davited', Material: 'CS' };
      return g;
    },
    'small-nozzle': function () {                           // simple small stub nozzle + flange (inlet/vent connections)
      var g = new THREE.Group();
      var stub = cyl(0.18, 0.18, 0.6, mats.steel, 16); stub.rotation.z = Math.PI / 2; g.add(stub);
      g.add(flangeX(0.35, 0.3, mats.gunmetal));
      g.position.y = 1.4;
      g.userData.props = { Type: 'Nozzle', 'Size (NPS)': 1.5, Rating: 'CL150', Material: 'A105' };
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
  // Shared "smart transmitter" head — the blue rounded electronics housing
  // with an LCD window used across the reference photos for Pressure/Temp/
  // Level/DP transmitters, Vortex & Coriolis meters, etc.
  function transmitterHead(mat) {
    var h = new THREE.Group();
    var body = mesh(new THREE.SphereGeometry(0.24, 16, 12), mat); body.scale.set(1, 1.3, 0.9); h.add(body);
    var lcd = box(0.16, 0.12, 0.02, mats.dark); lcd.position.set(0, 0.05, 0.19); h.add(lcd);
    var lcdMat = new THREE.MeshStandardMaterial({ color: 0x0a3d1e, emissive: 0x0a3d1e, emissiveIntensity: 0.4 });
    var lcdScreen = box(0.12, 0.08, 0.01, lcdMat); lcdScreen.position.set(0, 0.05, 0.2); h.add(lcdScreen);
    var gland = cyl(0.05, 0.05, 0.12, mats.dark, 10); gland.position.set(-0.12, -0.3, 0); h.add(gland);
    return h;
  }

  /* Generic parametric factory for any workbench equipment type that has no
     dedicated model — chooses a realistic base shape from the type keyword. */
  /* ── Which casting does a palette type actually resolve to? ───────────
     The correspondence between a 2D palette key and a 3D factory key lives
     in the dispatch chain below — a hundred-odd arms, several of them
     matching more than one type. Copying it into a table for the common
     component layer to read would create a second thing to keep right, and
     the copy would be wrong the first time an arm moved.

     So the answer is taken from the chain itself: run the real dispatch with
     every factory replaced by a stub that records which one was asked for,
     then put the factories back. No geometry is kept and nothing is drawn.
     What comes out is what the engine would genuinely have built. */
  A3.modelKeyFor = function (t) {
    if (typeof THREE === 'undefined') return null;
    var picked = null, saved = {};
    try {
      Object.keys(FAC).forEach(function (k) {
        saved[k] = FAC[k];
        FAC[k] = function () { if (picked === null) picked = k; return new THREE.Group(); };
      });
      try { generic(t, ''); } catch (e) { /* a stubbed build may trip later helpers */ }
    } catch (e) {
    } finally {
      Object.keys(saved).forEach(function (k) { FAC[k] = saved[k]; });
    }
    return picked;
  };

  function generic(type, label) {
    var t = String(type || '').toLowerCase();
    var g;
    // Precise overrides — checked first because they'd otherwise be swallowed
    // by looser keyword patterns further down ("spherical" contains "phe",
    // "floating-head" contains "floating", "demister-col" contains "demister").
    if (/^spherical$|^sphere$/.test(t)) g = FAC['sphere']();
    else if (/floating-head|fixed-ts/.test(t)) g = FAC['sthe']();
    else if (/^demister-col$/.test(t)) g = FAC['column']();
    else if (/^cat-rx$/.test(t)) g = FAC['reactor']();
    else if (/^fixed-roof$/.test(t)) g = FAC['cone-tank']();
    else if (/^packed-col$|^tray-col$/.test(t)) g = FAC['column']();
    else if (/^twophase-sep$|^threephase-sep$/.test(t)) g = FAC['h-vessel']();
    else if (/^elbow90$/.test(t)) g = FAC['elbow90']();
    else if (/^elbow45$/.test(t)) g = FAC['elbow45']();
    else if (/^tee$/.test(t)) g = FAC['tee-fitting']();
    else if (/^cross$/.test(t)) g = FAC['cross-fitting']();
    else if (/^reducer$|^expander$/.test(t)) g = FAC['reducer-fitting']();
    else if (/^ecc-reducer$/.test(t)) g = FAC['ecc-reducer']();
    else if (/^elbowlr$/.test(t)) g = FAC['elbow-lr']();
    else if (/^spool$/.test(t)) g = FAC['pipe-spool']();
    else if (/^union$/.test(t)) g = FAC['pipe-union']();
    else if (/^pcap$/.test(t)) g = FAC['pipe-cap']();
    else if (/^spectacle$/.test(t)) g = FAC['spectacle-blind']();
    else if (/^wnflange$/.test(t)) g = FAC['flange-fitting']();
    else if (/^blind$/.test(t)) g = FAC['blind-flange']();
    else if (/^flange$/.test(t)) g = FAC['flange-pair']();
    // Instrument sub-types — PI/TI/LI/FT/Orifice/Rotameter each get their own
    // recognizable field-instrument shape instead of sharing 2 generic blobs.
    else if (/^pg$/.test(t)) g = FAC['pressure-gauge']();
    else if (/^ti$/.test(t)) g = FAC['temp-indicator']();
    else if (/^li$/.test(t)) g = FAC['level-indicator']();
    else if (/^ft$/.test(t)) g = FAC['flow-meter']();
    else if (/^orifice$/.test(t)) g = FAC['orifice-plate']();
    else if (/^rotameter$/.test(t)) g = FAC['rotameter-tube']();
    else if (/^pressure-transmitter$/.test(t)) g = FAC['pressure-transmitter']();
    else if (/^pressure-indicator$/.test(t)) g = FAC['pressure-indicator']();
    else if (/^temp-transmitter$/.test(t)) g = FAC['temp-transmitter']();
    else if (/^thermowell$/.test(t)) g = FAC['thermowell-bare']();
    else if (/^venturi-meter$/.test(t)) g = FAC['venturi-meter']();
    else if (/^vortex-meter$/.test(t)) g = FAC['vortex-meter']();
    else if (/^coriolis-meter$/.test(t)) g = FAC['coriolis-meter']();
    else if (/^level-transmitter$/.test(t)) g = FAC['level-transmitter']();
    else if (/^radar-level$/.test(t)) g = FAC['radar-level']();
    else if (/^dp-transmitter$/.test(t)) g = FAC['dp-transmitter']();
    else if (/^ph-meter$/.test(t)) g = FAC['ph-meter']();
    else if (/^conductivity-meter$/.test(t)) g = FAC['conductivity-meter']();
    else if (/^o2-analyzer$/.test(t)) g = FAC['o2-analyzer']();
    else if (/^valve-positioner$/.test(t)) g = FAC['valve-positioner']();
    else if (/^pressure-switch$/.test(t)) g = FAC['pressure-switch']();
    else if (/^temp-switch$/.test(t)) g = FAC['temp-switch']();
    else if (/^flow-switch$/.test(t)) g = FAC['flow-switch']();
    else if (/^level-switch$/.test(t)) g = FAC['level-switch']();
    else if (/^steam-trap$/.test(t)) g = FAC['steam-trap']();
    else if (/^sight-glass$/.test(t)) g = FAC['sight-glass']();
    // Precise pump-family sub-types — checked before the loose /pump/ catch-all
    // so Multistage and Gear/PD pumps stop rendering as a Centrifugal Pump.
    else if (/^pump-ms$/.test(t)) g = FAC['multistage-pump']();
    else if (/^pd-pump$|^int-gear$|peristaltic|pneu-diaphragm|mag-drive|^pcp$|lr-vacuum|rv-vacuum/.test(t)) g = FAC['gear-pump']();
    else if (/^vturbine$/.test(t)) g = FAC['vertical-turbine-pump']();
    else if (/^split-case$/.test(t)) g = FAC['split-case-pump']();
    else if (/^screw-pump$|^twin-screw$/.test(t)) g = FAC['screw-twin-pump']();
    else if (/^lobe-pump$/.test(t)) g = FAC['lobe-pump']();
    else if (/^plunger-pump$|^piston-pump$|^recip-pump$|^diaphragm-pump$/.test(t)) g = FAC['recip-pump']();
    else if (/^metering-pump$/.test(t)) g = FAC['metering-skid']();
    else if (/^submersible-pump$/.test(t)) g = FAC['submersible-pump']();
    else if (/^slurry-pump$/.test(t)) g = FAC['slurry-pump']();
    // "vacuum-pump" contains "pump" and would otherwise fall into the
    // centrifugal-pump shape below — it's really a rotary/compressor-class
    // machine, so route it to the compressor shape instead.
    else if (/^vacuum-pump$/.test(t)) g = FAC['compressor']();
    else if (/pump/.test(t)) g = FAC['centrifugal-pump']();
    else if (/self-prime/.test(t)) g = FAC['centrifugal-pump']();
    else if (/blower|fan/.test(t)) g = FAC['fan']();
    // Steam Ejector gets its own small venturi-nozzle shape — checked before
    // the loose "ejector" keyword below, which would otherwise render it as
    // a full Compressor.
    else if (/^ejector$/.test(t)) g = FAC['steam-ejector']();
    // Compressor-family sub-types — Reciprocating and Screw compressors reuse
    // the mechanically-equivalent reciprocating/twin-screw pump shapes; Axial
    // and Steam Turbine get their own distinct long-staged-casing shapes.
    // Checked before the generic /comp|turbo|ejector|turbine/ catch-all below,
    // which previously rendered all of these as the same base Compressor.
    else if (/^recip-comp$/.test(t)) g = FAC['recip-pump']();
    else if (/^screw-comp$/.test(t)) g = FAC['screw-twin-pump']();
    else if (/^axial-comp$/.test(t)) g = FAC['axial-compressor']();
    else if (/^turbine$/.test(t)) g = FAC['turbine-steam']();
    else if (/comp|turbo|ejector|turbine/.test(t)) g = FAC['compressor']();
    // Double-pipe / hairpin HX gets its own small concentric-tube shape —
    // checked before the "phe" plate-HX regex below, since "dphe" contains
    // "phe" as a substring and would otherwise be swallowed by it.
    else if (/^dphe$|hairpin/.test(t)) g = FAC['double-pipe-hx']();
    // Spiral HX gets its own flat-coil shape — "spiral" would otherwise be
    // swallowed by the plate-hx keyword list below.
    else if (/^spiral-hx$/.test(t)) g = FAC['spiral-coil-hx']();
    else if (/plate|phe|gasket|brazed|welded-plate|spiral/.test(t)) g = FAC['plate-hx']();
    else if (/air-?cool|aircooler|fin-?fan|finned|air cooler/.test(t)) g = FAC['aircooler']();
    // Economizer reuses the finned-tube air-cooler shape (a reasonable match —
    // most economizers are finned-tube banks), checked before the sthe
    // fallback so it doesn't render as a full tube-bundle HX.
    else if (/^economizer$/.test(t)) g = FAC['aircooler']();
    // Evaporator gets its own kettle + vapor-dome shape — checked before the
    // reboiler keyword list below, which would otherwise absorb it.
    else if (/^evaporator$/.test(t)) g = FAC['evaporator-hx']();
    else if (/reboiler|kettle|thermosiphon/.test(t)) g = FAC['reboiler']();
    // Fired Boiler / Fired Heater both get the drum + firebox shape —
    // checked before "boiler"/"heater" in the sthe fallback below, which
    // would otherwise render them as a full Shell & Tube HX tube bundle.
    else if (/^boiler$|^heater-pkg$/.test(t)) g = FAC['fired-boiler']();
    // Condenser gets its own shape — checked before the sthe fallback's
    // "condenser" keyword.
    else if (/^condenser$/.test(t)) g = FAC['condenser-hx']();
    // Package Chiller gets its own unit shape — checked before the sthe
    // fallback's "chiller" keyword.
    else if (/^chiller$/.test(t)) g = FAC['chiller-pkg']();
    else if (/sthe|shell|hx|exchanger|cooler|condenser|economizer|chiller|heater/.test(t)) g = FAC['sthe']();
    // Reactor sub-types — CSTR (stirred) and PFR/Tubular (horizontal) each get
    // their own shape; everything else with a fixed/packed bed keeps the
    // original vertical 'reactor' (packed-bed) shape.
    else if (/^cstr$|^batch$|^batch-rx$|^semibatch-rx$/.test(t)) g = FAC['reactor-cstr']();
    else if (/^pfr$|^loop$|^loop-rx$/.test(t)) g = FAC['reactor-pfr']();
    else if (/reactor|pbr|fbr|bubble|slurry|catalytic|converter|hydrotreat|hdt|reform|cracker|coker|hcu|fcc/.test(t)) g = FAC['reactor']();
    // Cooling Tower gets its own lattice+fan shape — checked before the
    // "tower" keyword in the column regex below, which would otherwise
    // render it as a Distillation Column (since "cooltower" contains "tower").
    else if (/^cooltower$/.test(t)) g = FAC['cooling-tower']();
    else if (/column|absorber|stripper|scrubber|tower|fractionat|deaerator|extraction|distill|splitter|debutan|depropan|deethan/.test(t)) g = FAC['column']();
    // Filter & Strainer sub-types — each of the 7 palette items gets its own
    // shape instead of sharing one generic cartridge-housing model.
    else if (/^y-strainer$/.test(t)) g = FAC['y-strainer']();
    else if (/^t-strainer$/.test(t)) g = FAC['t-strainer']();
    else if (/^basket-filter$/.test(t)) g = FAC['basket-filter']();
    else if (/^cartridge-filter$/.test(t)) g = FAC['filter']();
    else if (/^bag-filter$/.test(t)) g = FAC['bag-filter']();
    else if (/^duplex-filter$/.test(t)) g = FAC['duplex-filter']();
    else if (/^self-clean-filter$/.test(t)) g = FAC['self-clean-filter']();
    else if (/^cyclone$|^hydrocyclone$/.test(t)) g = FAC['cyclone-sep']();
    else if (/filter|strainer|cartridge|bag|basket|duplex|coalescer|self-clean|cyclone|hydrocyclone/.test(t)) g = FAC['filter']();
    else if (/bullet|lpg|receiver|accumulator|air-receiver/.test(t)) g = FAC['bullet']();
    // Tank sub-types — Silo/Hopper (conical bottom discharge) and plain
    // Atmospheric Tank each get their own shape, distinct from the pointed
    // cone-ROOF tank (floating/fixed roof / API 650 dome-roof family).
    else if (/^silo$|hopper/.test(t)) g = FAC['silo-hopper']();
    // Mixing Tank is specifically an agitated vessel, not a plain roofed tank
    // — checked before the generic "tank" keyword fallback below.
    else if (/^mixing-tank$/.test(t)) g = FAC['agitated-tank']();
    else if (/cone|floating|api6|dome-roof|storage/.test(t)) g = FAC['cone-tank']();
    else if (/tank/.test(t)) g = FAC['cone-tank']();
    else if (/v-vessel|vertical|surge|knockout|dryer/.test(t)) g = FAC['v-vessel']();
    // Utility Header (steam/water) gets its own manifold-pipe shape —
    // checked before the h-vessel fallback's header keywords below.
    else if (/^steam-header$|^water-header$/.test(t)) g = FAC['header-pipe']();
    else if (/separat|drum|ko|flash|demister|vessel|vacuum-vessel|h-vessel|horizontal/.test(t)) g = FAC['h-vessel']();
    else if (/rupture-disc|flame-arrestor|safety-shower|fire-monitor|gas-detector/.test(t)) g = FAC['safety-post']();
    // Blind Flange, Manway and small Nozzle sub-types get their own distinct
    // shapes — checked before the generic weld-neck/slip-on flange fallback.
    else if (/^blind-flange$/.test(t)) g = FAC['blind-flange']();
    else if (/^manway$/.test(t)) g = FAC['manway']();
    else if (/^inlet-nozzle$|^vent-nozzle$/.test(t)) g = FAC['small-nozzle']();
    else if (/wn-flange|so-flange|blind-flange|manway|inlet-nozzle|vent-nozzle/.test(t)) g = FAC['flange-fitting']();
    else if (/^anchor$|guide-support|spring-hanger|shoe-support|saddle-support|trunnion/.test(t)) g = FAC['support']();
    else if (/^motor$|generator/.test(t)) g = FAC['electrical-machine']();
    else if (/transformer/.test(t)) g = FAC['transformer']();
    else if (/switchgear|^vfd$|^mcc$|junction-box/.test(t)) g = FAC['panel']();
    else if (/package-unit/.test(t)) g = FAC['package']();
    else if (/ball|plug/.test(t)) g = FAC['ball-valve']();
    // Valve sub-types — each of the 9 visible valve types now gets its own
    // recognizable shape; everything else uncommon still falls back to the
    // gate-valve handwheel body.
    else if (/^globe$/.test(t)) g = FAC['globe-valve']();
    else if (/^butterfly$/.test(t)) g = FAC['butterfly-valve']();
    else if (/^check$|^swing-check$|^lift-check$|^wafer-check$|^dual-check$/.test(t)) g = FAC['check-valve']();
    else if (/^control$/.test(t)) g = FAC['control-valve']();
    else if (/^psv$|^prv$|relief/.test(t)) g = FAC['psv-valve']();
    else if (/^3way$/.test(t)) g = FAC['three-way-valve']();
    else if (/^needle$/.test(t)) g = FAC['needle-valve']();
    // Additional valve sub-types from the Valves reference sheet — each gets
    // its own distinct shape or a mechanically-equivalent reuse. Checked
    // before the broad catch-all below, which previously rendered all of
    // these as the same generic Gate Valve handwheel body.
    else if (/^solenoid-valve$/.test(t)) g = FAC['solenoid-valve']();
    else if (/^diaphragm-valve$/.test(t)) g = FAC['diaphragm-valve']();
    else if (/^pinch-valve$/.test(t)) g = FAC['pinch-valve']();
    else if (/^knife-gate$/.test(t)) g = FAC['knife-gate']();
    else if (/^cryo-valve$/.test(t)) g = FAC['cryo-valve']();
    else if (/^angle-valve$/.test(t)) g = FAC['angle-valve']();
    else if (/^foot-valve$/.test(t)) g = FAC['foot-valve']();
    else if (/^breather-valve$/.test(t)) g = FAC['breather-valve']();
    else if (/^deluge-valve$/.test(t)) g = FAC['deluge-valve']();
    else if (/^flush-bottom$/.test(t)) g = FAC['flush-bottom']();
    else if (/^safety-valve$/.test(t)) g = FAC['psv-valve']();
    else if (/^sampling-valve$/.test(t)) g = FAC['needle-valve']();
    else if (/valve|gate|solenoid|knife|foot|pinch|diaphragm|safety|cryo-valve|angle|sampling|flush/.test(t)) g = FAC['gate-valve']();
    // Static Mixer (inline pipe spool) and Agitated Tank (vessel + paddle)
    // used to collapse into the same plain Vertical Vessel shape.
    else if (/^mixer$/.test(t)) g = FAC['static-mixer']();
    else if (/^agitator$/.test(t)) g = FAC['agitated-tank']();
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
    s.position.copy(localPos);
    /* The owning group is held non-enumerably. Object3D.toJSON serialises
       userData, so a THREE object stored in it recursed until the stack gave
       out — Export JSON failed on any scene with equipment in it. Every read
       site still gets .group; only JSON.stringify skips it. */
    s.userData.port = { role: role };
    Object.defineProperty(s.userData.port, 'group',
      { value: g, enumerable: false, writable: true, configurable: true });
    g.add(s); portMeshes.push(s);
    (g.userData.ports = g.userData.ports || []).push(s);
  }
  /* ── Shared component library hook ───────────────────────────────────
     The engineering modules build their equipment from lib/aro-parts3d.js.
     Where the Workbench places the same thing — a pump, a valve, a flange,
     an elbow — it should place the SAME component, not a second drawing of
     it. These let the bridge swap a factory without this file having to
     know anything about the library, and keep the original as the fallback
     if the library is unavailable. */
  A3.registerFactory = function (key, fn) {
    if (typeof key !== 'string' || typeof fn !== 'function') return null;
    var prev = FAC[key] || null;
    FAC[key] = fn;
    return prev;
  };
  A3.factories = function () { return Object.keys(FAC); };
  A3.spin = function (o, axis) { if (o) { o.userData.spin = axis || 'z'; spinTag(o); } return o; };

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
  // pipe visual radius scales with the line's nominal size (NPS, inches)
  function npsRadius(nps) { return Math.max(0.12, Math.min(0.75, 0.09 + (nps || 3) * 0.05)); }
  function tubeDashed(p, q, r, mat, segLen, gapLen) {
    var dir = new THREE.Vector3().subVectors(q, p), len = dir.length(), out = [];
    if (len < 0.001) return out;
    var unit = dir.clone().normalize(), d = 0;
    while (d < len) {
      var e = Math.min(d + segLen, len);
      var m = tube(p.clone().addScaledVector(unit, d), p.clone().addScaledVector(unit, e), r, mat);
      if (m) out.push(m);
      d += segLen + gapLen;
    }
    return out;
  }
  function beadsAlong(p, q, r, mat, spacing) {
    var dir = new THREE.Vector3().subVectors(q, p), len = dir.length(), out = [];
    if (len < 0.001) return out;
    var unit = dir.clone().normalize(), d = spacing / 2;
    while (d < len) { var s = mesh(new THREE.SphereGeometry(r * 2.0, 10, 8), mat); s.position.copy(p.clone().addScaledVector(unit, d)); out.push(s); d += spacing; }
    return out;
  }
  /* ISA line-type legend, the 3D counterpart of LINE_TYPES in aro-workbench.js.
     Drafting-only marks (hatch/L/X ticks) have no physical 3D shape, so those
     read here as a thinner dashed or beaded line in a distinct colour instead
     — the two truly physical cases, a heat-traced line and a jacketed line,
     get a real second tube (a tracer alongside, a sleeve around). */
  var LTYPE3D = {
    major:      { rMul: 1.4 },
    minor:      { rMul: 0.65 },
    new:        { dash: [1.2, 0.6] },
    remove:     { dash: [0.5, 0.35], color: '#ef4444' },
    heattrace:  { tracer: true },
    jacketed:   { jacket: true },
    electrical: { rMul: 0.4, dash: [0.9, 0.3], color: '#eab308' },
    pneumatic:  { rMul: 0.4, dash: [0.5, 0.35], color: '#0891b2' },
    hydraulic:  { rMul: 0.4, dash: [0.5, 0.35], color: '#f97316' },
    mechanical: { rMul: 0.4, beads: true, color: '#64748b' },
    capillary:  { rMul: 0.25, dash: [0.35, 0.35], color: '#a855f7' },
    emsignal:   { rMul: 0.3, dash: [0.4, 0.25], color: '#64748b' },
    digital:    { rMul: 0.35, beads: true, color: '#0d9488' }
  };
  function buildPipe(fromPort, toPort, color, nps, ltype) {
    var pa = new THREE.Vector3(), pb = new THREE.Vector3();
    fromPort.getWorldPosition(pa); toPort.getWorldPosition(pb);
    var lt = LTYPE3D[ltype] || {};
    // each pipe carries its OWN material so it can be recoloured individually
    var col = color || lt.color || '#b8c0cc';
    var mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col), metalness: 0.9, roughness: 0.35 });
    var emat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.6), metalness: 0.85, roughness: 0.45 });
    var r = npsRadius(nps) * (lt.rMul || 1), y = (pa.y + pb.y) / 2;
    var w1 = new THREE.Vector3(pa.x + Math.sign(pb.x - pa.x || 1) * 1.2, pa.y, pa.z);
    var w2 = new THREE.Vector3(w1.x, y, pa.z);
    var w3 = new THREE.Vector3(pb.x - Math.sign(pb.x - pa.x || 1) * 1.2, y, pb.z);
    var pts = [pa, w1, w2, w3, pb];
    var grp = new THREE.Group();
    for (var i = 0; i < pts.length - 1; i++) {
      if (lt.dash) tubeDashed(pts[i], pts[i + 1], r, mat, lt.dash[0], lt.dash[1]).forEach(function (m) { grp.add(m); });
      else if (lt.beads) { beadsAlong(pts[i], pts[i + 1], r, mat, 1.0).forEach(function (m) { grp.add(m); }); var thin = tube(pts[i], pts[i + 1], r * 0.3, mat); if (thin) grp.add(thin); }
      else { var t = tube(pts[i], pts[i + 1], r, mat); if (t) grp.add(t); }
    }
    for (var j = 1; j < pts.length - 1; j++) grp.add(elbow(pts[j], r, emat));
    if (lt.jacket) {
      var jmat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.5, transparent: true, opacity: 0.35 });
      for (var k = 0; k < pts.length - 1; k++) { var jt = tube(pts[k], pts[k + 1], r * 1.9, jmat); if (jt) grp.add(jt); }
    }
    if (lt.tracer) {
      var tmat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.7, roughness: 0.4 });
      var off = new THREE.Vector3(0, -r * 2.4, 0);
      for (var m2 = 0; m2 < pts.length - 1; m2++) { var tt = tube(pts[m2].clone().add(off), pts[m2 + 1].clone().add(off), r * 0.22, tmat); if (tt) grp.add(tt); }
    }
    var fg = fromPort.userData.port.group, tg = toPort.userData.port.group;
    grp.userData.pipe = { from: fromPort, to: toPort, fromNid: fg.userData.nid, toNid: tg.userData.nid, mat: mat, emat: emat, color: col, nps: nps || 3, ltype: ltype };
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
      var g = A3.addByType(n.t, nameOf ? nameOf(n.t, n) : n.t, n.id);
      g.position.x = (idx % cols) * 15 - (cols - 1) * 7.5;
      g.position.z = Math.floor(idx / cols) * 14 - 7;
      if (n.rot) g.rotation.y = -n.rot * Math.PI / 180;
    });
    (pipes || []).forEach(function (p) {
      var a = groupByNid(p.from.id), b = groupByNid(p.to.id);
      var op = portOf(a, 'out') || portOf(a, 'in'), ip = portOf(b, 'in') || portOf(b, 'out');
      if (op && ip) { var g = buildPipe(op, ip, p.color, p.nps, p.ltype); if (g) g.userData.pipe.pid = p.id; }
    });
    rebuilding = false;
    if (objects.length) {
      // frame the whole flowsheet
      var bb = new THREE.Box3(); objects.forEach(function (o) { bb.expandByObject(o); });
      var c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      sph.tx = c.x; sph.ty = c.y; sph.tz = c.z;
      sph.theta = Math.PI / 4; sph.phi = 1.0;
      sph.r = Math.min(340, Math.max(16, Math.max(sz.x, sz.y, sz.z) * 1.7));
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
  // Orbit the 3D camera from the X/Y/Z gizmo — horizontal drag = azimuth,
  // vertical drag = elevation, so the whole drawing turns flexibly.
  A3.orbit = function (dTheta, dPhi) {
    if (!scene) return;
    sph.theta -= dTheta; sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - dPhi));
    updateCamera();
  };
  A3.orbitState = function () { return { theta: sph.theta, phi: sph.phi }; };
  A3.orbitReset = function () { if (!scene) return; sph.theta = Math.PI / 4; sph.phi = 1.0; updateCamera(); };
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
  // rebuild a single pipe group's geometry at a new NPS (thicker/thinner pipe)
  function resizePipe(grp, nps) {
    var pd = grp.userData.pipe; if (!pd) return;
    var r = npsRadius(nps); pd.nps = nps;
    grp.children.forEach(function (m) {
      if (!m.geometry) return;
      var isElbow = m.geometry.type === 'SphereGeometry';
      var old = m.geometry;
      if (isElbow) m.geometry = new THREE.SphereGeometry(r * 1.15, 12, 10);
      else { var len = old.parameters.height; m.geometry = new THREE.CylinderGeometry(r, r, len, 16); }
      old.dispose();
    });
  }
  A3.setSelectedPipeSize = function (nps) {
    if (!pickedPipe) return null;
    resizePipe(pickedPipe, nps);
    if (embStatus) embStatus('Line size set to ' + nps + '″ — pipe diameter updated in 3D.');
    return pickedPipe.userData.pipe.pid || null;
  };
  A3.setAllPipeSize = function (nps) { pipes3d.forEach(function (g) { resizePipe(g, nps); }); if (embStatus) embStatus('All pipes set to ' + nps + '″.'); };
  // rename the selected equipment (updates the 3D properties Type/label)
  A3.renameSelected = function (name) {
    if (!picked) return null;
    picked.userData.props = picked.userData.props || {};
    picked.userData.props.Type = name;
    picked.userData.label = name;
    if (embedded && typeof A3.onSelect === 'function') A3.onSelect(picked.userData.props, countTris(picked));
    if (embStatus) embStatus('Equipment renamed to “' + name + '”.');
    return picked.userData.nid || null;
  };
  A3.selectedNid = function () { return picked ? (picked.userData.nid || null) : null; };
  A3.clearAll = function () { objects.forEach(function (o) { scene.remove(o); }); pipes3d.forEach(function (o) { scene.remove(o); }); objects = []; pipes3d = []; portMeshes = []; spinList = []; picked = null; pickedPipe = null; pendingPort = null; };
  A3.view = function (v) { view(v); };
  A3.setMode = function (m, on) { setMode(m, on); };
  A3.explode = function (f) { explode(f); };
  A3.setBg = function (hex) { if (scene) scene.background = new THREE.Color(hex); };
  A3.selectedProps = function () { return picked ? picked.userData.props : null; };
  A3.exportOBJ = function () { exportOBJ(); };

  /* ─────────── 3D CAD component library ───────────
     The sidebar used to list eleven names as plain text buttons while the
     engine held over a hundred castings — a pump, two valves and a handful of
     vessels, with no way to reach an elbow, a reducer, a strainer or an
     instrument except by drawing it on the 2D sheet first.

     Everything the engine can actually build is listed here, grouped the way
     a piping catalogue is grouped, each with the symbol from the shared set
     (window.AROSYM). The symbol is a picker aid — the 3D casting behind each
     entry is its own mesh, so two pumps sharing a thumbnail are still two
     different models on the canvas.

     Every key below is a real factory key: an entry the engine cannot build
     is dropped when the list is rendered rather than left as a dead button. */
  var CATALOG_GROUPS = [
    ['Piping & Fittings', [
      ['pipe-spool', 'Pipe Spool', 'spool'], ['header-pipe', 'Header Pipe', 'pipe'],
      ['elbow90', '90° Elbow', 'elbow90'], ['elbow-lr', 'Long Radius 90°', 'elbowlr'],
      ['elbow45', '45° Elbow', 'elbow45'], ['tee-fitting', 'Equal Tee', 'tee'],
      ['cross-fitting', 'Cross', 'cross'], ['reducer-fitting', 'Conc. Reducer', 'reducer'],
      ['ecc-reducer', 'Ecc. Reducer', 'eccreducer'], ['flange-pair', 'Flange Pair', 'flange'],
      ['flange-fitting', 'Weld-Neck Flange', 'wnflange'], ['blind-flange', 'Blind Flange', 'blind'],
      ['spectacle-blind', 'Spectacle Blind', 'spectacle'], ['pipe-union', 'Union', 'union'],
      ['pipe-cap', 'Pipe Cap', 'cap'], ['manway', 'Manway', 'flange'],
      ['small-nozzle', 'Nozzle', 'nozzle'], ['static-mixer', 'Static Mixer', 'pipe']
    ]],
    ['Valves', [
      ['gate-valve', 'Gate Valve', 'gate'], ['globe-valve', 'Globe Valve', 'globe'],
      ['ball-valve', 'Ball Valve', 'ball'], ['butterfly-valve', 'Butterfly Valve', 'butterfly'],
      ['check-valve', 'Check Valve', 'checkswing'], ['foot-valve', 'Foot Valve', 'checklift'],
      ['control-valve', 'Control Valve', 'control'], ['psv-valve', 'Relief Valve', 'relief'],
      ['needle-valve', 'Needle Valve', 'needle'], ['angle-valve', 'Angle Valve', 'angle'],
      ['three-way-valve', '3-Way Valve', 'plug3'], ['diaphragm-valve', 'Diaphragm Valve', 'globe'],
      ['knife-gate', 'Knife Gate', 'gate'], ['pinch-valve', 'Pinch Valve', 'globe'],
      ['solenoid-valve', 'Solenoid Valve', 'control'], ['cryo-valve', 'Cryogenic Valve', 'gate'],
      ['breather-valve', 'Breather Valve', 'relief'], ['deluge-valve', 'Deluge Valve', 'gate'],
      ['flush-bottom', 'Flush Bottom Valve', 'angle'], ['steam-trap', 'Steam Trap', 'strainer']
    ]],
    ['Pumps & Compressors', [
      ['centrifugal-pump', 'Centrifugal Pump', 'pump'], ['multistage-pump', 'Multistage Pump', 'pump'],
      ['split-case-pump', 'Split Case Pump', 'pump'], ['vertical-turbine-pump', 'Vertical Turbine', 'pump'],
      ['submersible-pump', 'Submersible Pump', 'pump'], ['slurry-pump', 'Slurry Pump', 'pump'],
      ['gear-pump', 'Gear Pump', 'pump'], ['lobe-pump', 'Lobe Pump', 'pump'],
      ['screw-twin-pump', 'Twin Screw Pump', 'pump'], ['recip-pump', 'Reciprocating Pump', 'pump'],
      ['metering-skid', 'Metering Skid', 'pump'], ['compressor', 'Compressor', 'pump'],
      ['axial-compressor', 'Axial Compressor', 'pump'], ['fan', 'Fan / Blower', 'pump'],
      ['turbine-steam', 'Steam Turbine', 'pump'], ['steam-ejector', 'Steam Ejector', 'pump']
    ]],
    ['Vessels, Tanks & Columns', [
      ['v-vessel', 'Vertical Vessel', 'vessel'], ['h-vessel', 'Horizontal Vessel', 'vessel'],
      ['sphere', 'Spherical Vessel', 'vessel'], ['bullet', 'LPG Bullet Tank', 'vessel'],
      ['cone-tank', 'Cone Roof Tank', 'tank'], ['atm-tank', 'Atmospheric Tank', 'tank'],
      ['silo-hopper', 'Silo / Hopper', 'tank'], ['column', 'Distillation Column', 'column'],
      ['reactor', 'Reactor', 'reactor'], ['reactor-cstr', 'CSTR', 'reactor'],
      ['reactor-pfr', 'Plug Flow Reactor', 'reactor'], ['agitated-tank', 'Agitated Tank', 'reactor']
    ]],
    ['Heat Exchangers', [
      ['sthe', 'Shell & Tube HX', 'exchanger'], ['plate-hx', 'Plate HX', 'exchanger'],
      ['double-pipe-hx', 'Double Pipe HX', 'exchanger'], ['spiral-coil-hx', 'Spiral Coil HX', 'exchanger'],
      ['aircooler', 'Air Cooler', 'exchanger'], ['reboiler', 'Kettle Reboiler', 'exchanger'],
      ['condenser-hx', 'Condenser', 'exchanger'], ['evaporator-hx', 'Evaporator', 'exchanger'],
      ['cooling-tower', 'Cooling Tower', 'exchanger'], ['fired-boiler', 'Fired Boiler', 'exchanger'],
      ['chiller-pkg', 'Chiller Package', 'exchanger']
    ]],
    ['Instruments', [
      ['pressure-gauge', 'Pressure Gauge', 'gauge'], ['pressure-indicator', 'Pressure Indicator', 'gauge'],
      ['pressure-transmitter', 'Pressure Transmitter', 'transmitter'], ['dp-transmitter', 'DP Transmitter', 'transmitter'],
      ['temp-indicator', 'Temperature Indicator', 'gauge'], ['temp-transmitter', 'Temperature Transmitter', 'transmitter'],
      ['thermowell-bare', 'Thermowell', 'gauge'], ['level-indicator', 'Level Indicator', 'gauge'],
      ['level-transmitter', 'Level Transmitter', 'transmitter'], ['radar-level', 'Radar Level', 'transmitter'],
      ['flow-meter', 'Flow Meter', 'orifice'], ['orifice-plate', 'Orifice Plate', 'orifice'],
      ['rotameter-tube', 'Rotameter', 'orifice'], ['venturi-meter', 'Venturi Meter', 'orifice'],
      ['vortex-meter', 'Vortex Meter', 'orifice'], ['coriolis-meter', 'Coriolis Meter', 'orifice'],
      ['ph-meter', 'pH Analyser', 'transmitter'], ['conductivity-meter', 'Conductivity Analyser', 'transmitter'],
      ['o2-analyzer', 'O₂ Analyser', 'transmitter'], ['sight-glass', 'Sight Glass', 'gauge'],
      ['valve-positioner', 'Valve Positioner', 'control'], ['pressure-switch', 'Pressure Switch', 'gauge'],
      ['temp-switch', 'Temperature Switch', 'gauge'], ['flow-switch', 'Flow Switch', 'gauge'],
      ['level-switch', 'Level Switch', 'gauge'], ['inline-instrument', 'In-line Instrument', 'orifice']
    ]],
    ['Filters & Separators', [
      ['y-strainer', 'Y-Strainer', 'strainer'], ['t-strainer', 'T-Strainer', 'strainer'],
      ['basket-filter', 'Basket Filter', 'strainer'], ['bag-filter', 'Bag Filter', 'strainer'],
      ['duplex-filter', 'Duplex Filter', 'strainer'], ['self-clean-filter', 'Self-Cleaning Filter', 'strainer'],
      ['filter', 'Filter Vessel', 'strainer'], ['cyclone-sep', 'Cyclone Separator', 'vessel']
    ]],
    ['Structural & Electrical', [
      ['support', 'Pipe Support', 'support'], ['safety-post', 'Safety Post', 'support'],
      ['panel', 'Control Panel', 'vessel'], ['transformer', 'Transformer', 'vessel'],
      ['electrical-machine', 'Motor', 'pump'], ['package', 'Package Unit', 'tank']
    ]]
  ];

  /* ─────────── Scene / renderer / lighting ─────────── */
  function buildScene(canvas) {
    scene = new THREE.Scene();
    /* Follows the application theme — a black canvas in a light workspace is
       the one panel that never noticed the theme changed. */
    scene.background = new THREE.Color(
      (document.body && document.body.classList.contains('theme-day')) ? 0xe9edf1 : 0x0b1220);
    try {
      var wbMo = new MutationObserver(function () {
        if (!scene) return;
        scene.background = new THREE.Color(
          document.body.classList.contains('theme-day') ? 0xe9edf1 : 0x0b1220);
      });
      wbMo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
    camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;

    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2b3242, 0.7));
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    var dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(12, 20, 10); dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048); dir.shadow.camera.near = 1; dir.shadow.camera.far = 160;
    dir.shadow.camera.left = -70; dir.shadow.camera.right = 70; dir.shadow.camera.top = 70; dir.shadow.camera.bottom = -70;
    scene.add(dir);
    var fill = new THREE.DirectionalLight(0x99bbff, 0.3); fill.position.set(-10, 8, -8); scene.add(fill);

    // sized generously (and kept uniform at 2 units/cell) so even large
    // multi-row refinery flowsheets stay fully on the visible grid instead
    // of floating past its edge into the black void beyond.
    ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x141b2b, metalness: 0, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    grid = new THREE.GridHelper(400, 200, 0x334155, 0x1e293b); scene.add(grid);

    clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 40);
  }

  function updateCamera() {
    var x = sph.r * Math.sin(sph.phi) * Math.sin(sph.theta);
    var y = sph.r * Math.cos(sph.phi);
    var z = sph.r * Math.sin(sph.phi) * Math.cos(sph.theta);
    camera.position.set(sph.tx + x, sph.ty + y, sph.tz + z);
    camera.lookAt(sph.tx, sph.ty, sph.tz);
    notifyZoom();
  }
  // Tell the host page (the 2D/3D scale-bar overlay in aro-workbench.js) how
  // many screen pixels one 3D world unit (~1 m) currently spans, so the
  // engineering scale bar / zoom % stay correct in 3D — previously that
  // overlay only ever read the 2D SVG's zoom, so it froze the moment you
  // switched to 3D and zoomed there.
  function notifyZoom() {
    if (typeof A3.onZoom !== 'function' || !camera || !renderer) return;
    var h = renderer.domElement.clientHeight || 600;
    var fovRad = camera.fov * Math.PI / 180;
    var pxPerUnit = h / (2 * Math.max(0.001, sph.r) * Math.tan(fovRad / 2));
    A3.onZoom(pxPerUnit, sph.r);
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
      '.a3-body{flex:1;display:grid;grid-template-columns:216px 1fr 220px;min-height:0;}',
      '.a3-lib{background:#0f172a;border-right:1px solid #1e293b;overflow-y:auto;padding:8px;}',
      '.a3-lib h4{color:#38bdf8;font-size:10px;letter-spacing:0.08em;margin:6px 4px;text-transform:uppercase;}',
      '.a3-lib button{display:block;width:100%;text-align:left;background:#1e293b;border:1px solid #334155;color:#e2e8f0;font-size:11px;padding:7px 9px;border-radius:5px;margin-bottom:5px;cursor:pointer;}',
      '.a3-lib button:hover{background:#0ea5e9;color:#fff;}',
      /* the library is now a catalogue rather than a short list: grouped,
         two symbols wide, and scrolled inside its own column */
      '.a3-lib h5{color:#f59e0b;font-size:9px;letter-spacing:0.09em;margin:10px 4px 5px;text-transform:uppercase;}',
      '.a3-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;}',
      '.a3-lib .a3-grid button{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;text-align:center;padding:5px 2px;margin:0;font-size:8.5px;line-height:1.15;min-width:0;overflow-wrap:anywhere;}',
      '.a3-sym{line-height:0;display:block;}',
      '.a3-sym svg{background:#e2e8f0;border-radius:3px;padding:1px 2px;}',
      '.a3-nm{display:block;}',
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
    var lib = CATALOG_GROUPS.map(function (grp) {
      var items = grp[1].filter(function (c) { return !!FAC[c[0]]; }).map(function (c) {
        var sym = (window.AROSYM && window.AROSYM.svg) ? window.AROSYM.svg(c[2], { w: 40 }) : '';
        return '<button data-add="' + c[0] + '" title="' + c[1] + '">'
          + '<span class="a3-sym">' + sym + '</span><span class="a3-nm">' + c[1] + '</span></button>';
      }).join('');
      return items ? '<h5>' + grp[0] + '</h5><div class="a3-grid">' + items + '</div>' : '';
    }).join('');
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
    // find a port under the cursor. bodyOk=true also accepts the nearest free
    // port of the equipment body under the cursor (used when RELEASING a wire).
    function portAt(e, preferRole, bodyOk) {
      var r = canvas.getBoundingClientRect(); m2.x = ((e.clientX - r.left) / r.width) * 2 - 1; m2.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(m2, camera);
      var ph = ray.intersectObjects(portMeshes, false);
      if (ph.length) return ph[0].object;
      if (!bodyOk) return null;
      var bh = ray.intersectObjects(objects, true);
      if (bh.length) { var og = bh[0].object; while (og.parent && objects.indexOf(og) < 0) og = og.parent; return portOf(og, preferRole) || portOf(og, preferRole === 'in' ? 'out' : 'in'); }
      return null;
    }
    canvas.addEventListener('mousedown', function (e) {
      // In pipe mode, pressing directly on a PORT sphere starts a drag-to-connect.
      // Pressing anywhere else (equipment body or empty space) still orbits the
      // camera — so mouse-drag rotation always works, even with the pipe tool on.
      if (pipeMode && e.button === 0) {
        var sp = portAt(e, 'out', false);
        if (sp) { dragConn = { start: sp }; sp.material.emissive.setHex(0xffffff); sp.scale.setScalar(1.9); if (embStatus) embStatus('Drag to the second equipment and release to connect…'); return; }
      }
      down = { x: e.clientX, y: e.clientY, b: e.button, th: sph.theta, ph: sph.phi, tx: sph.tx, ty: sph.ty, tz: sph.tz };
    });
    window.addEventListener('mousemove', function (e) {
      if (dragConn) return; // suppress orbit while wiring a pipe
      if (!down) return; var dx = e.clientX - down.x, dy = e.clientY - down.y;
      // The workbench's MOVE/PAN toolbar button sits above both the 2D and
      // 3D views, so a left-drag here has to pan (not orbit) whenever that
      // tool is active — otherwise the button does nothing in 3D and the
      // only way to pan is the undiscoverable right/middle-click drag.
      var wbPan = embedded && window.AROWB && window.AROWB.mode === 'pan';
      if (down.b === 0 && !wbPan) { sph.theta = down.th - dx * 0.01; sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, down.ph - dy * 0.01)); }
      else { var pan = sph.r * 0.0016; sph.tx = down.tx - dx * pan * Math.cos(sph.theta); sph.tz = down.tz + dx * pan * Math.sin(sph.theta); sph.ty = down.ty + dy * pan; }
      updateCamera();
    });
    window.addEventListener('mouseup', function (e) {
      if (dragConn) {
        var tp = portAt(e, 'in', true), sp = dragConn.start;
        if (tp && tp !== sp && tp.userData.port.group !== sp.userData.port.group) buildPipe(sp, tp);
        sp.material.emissive.setHex(sp.userData.port.role === 'in' ? 0x16a34a : 0x2563eb); sp.scale.setScalar(1.4);
        dragConn = null;
      }
      down = null;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); sph.r = Math.max(1.2, Math.min(350, sph.r * (e.deltaY < 0 ? 0.9 : 1.1))); updateCamera(); }, { passive: false });
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
  // A still PNG of the current view, for reports — renders one fresh frame
  // synchronously (the loop's last frame may be stale) then reads the canvas.
  A3.snapshot = function () {
    if (!renderer || !scene || !camera) return null;
    try { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); }
    catch (e) { return null; }
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
