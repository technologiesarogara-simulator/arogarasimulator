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
  var picked = null, objects = [], spinList = [];
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
    else if (/comp|blower|fan|turbo/.test(t)) g = FAC['compressor']();
    else if (/sthe|hx|exchanger|cooler|condenser|dphe|phe|hairpin|economizer|finned/.test(t)) g = FAC['sthe']();
    else if (/reboiler|kettle|evaporator/.test(t)) g = FAC['reboiler']();
    else if (/column|absorber|stripper|scrubber|tower|fractionat|deaerator|extraction/.test(t)) g = FAC['column']();
    else if (/reactor|cstr|pfr|pbr|fbr|bubble|loop|slurry|batch|cat/.test(t)) g = FAC['column']();
    else if (/tank|silo|floating|api6|spherical|cryo|mixing|cone/.test(t)) g = FAC['cone-tank']();
    else if (/bullet|receiver|accumulator|air-receiver/.test(t)) g = FAC['bullet']();
    else if (/separat|drum|ko|flash|surge|demister|coalescer|cyclone|vessel|vacuum-vessel/.test(t)) g = FAC['h-vessel']();
    else if (/ball|plug/.test(t)) g = FAC['ball-valve']();
    else if (/valve|gate|globe|butterfly|check|psv|prv|solenoid|needle|control|knife|foot|pinch|diaphragm|safety|relief|cryo-valve|angle|sampling|flush|3way/.test(t)) g = FAC['gate-valve']();
    else {
      // fallback: a labelled equipment block
      g = new THREE.Group();
      var b = box(2.4, 2.4, 2.4, mats.steel); b.position.y = 1.4; g.add(b);
      var n = cyl(0.35, 0.35, 1, mats.blue); n.rotation.z = Math.PI / 2; n.position.set(-1.5, 1.4, 0); g.add(n);
      g.userData.props = { Type: label || type, Note: 'Generic 3D placeholder' };
    }
    if (g.userData.props && label) g.userData.props.Type = label;
    return g;
  }
  A3.addByType = function (type, label) {
    if (!mats) mats = M();
    var g = FAC[type] ? FAC[type]() : generic(type, label);
    g.position.x = (objects.length % 5) * 7 - 14;
    g.position.z = Math.floor(objects.length / 5) * 7 - 7;
    g.userData.key = type;
    scene.add(g); objects.push(g); select(g);
    if (embStatus) embStatus((g.userData.props ? g.userData.props.Type : type) + ' added as real 3D mesh (' + countTris(g) + ' triangles) · left-drag to orbit');
    return g;
  };
  A3.clearAll = function () { objects.forEach(function (o) { scene.remove(o); }); objects = []; spinList = []; picked = null; renderProps && (document.getElementById('a3-props-body') || 0); };
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
    var down = null;
    canvas.addEventListener('mousedown', function (e) { down = { x: e.clientX, y: e.clientY, b: e.button, th: sph.theta, ph: sph.phi, tx: sph.tx, ty: sph.ty, tz: sph.tz }; });
    window.addEventListener('mousemove', function (e) {
      if (!down) return; var dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (down.b === 0) { sph.theta = down.th - dx * 0.01; sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, down.ph - dy * 0.01)); }
      else { var pan = sph.r * 0.0016; sph.tx = down.tx - dx * pan * Math.cos(sph.theta); sph.tz = down.tz + dx * pan * Math.sin(sph.theta); sph.ty = down.ty + dy * pan; }
      updateCamera();
    });
    window.addEventListener('mouseup', function () { down = null; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); sph.r = Math.max(3, Math.min(80, sph.r * (e.deltaY < 0 ? 0.9 : 1.1))); updateCamera(); }, { passive: false });
    var ray = new THREE.Raycaster(), m2 = new THREE.Vector2();
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect(); m2.x = ((e.clientX - r.left) / r.width) * 2 - 1; m2.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(m2, camera); var hit = ray.intersectObjects(objects, true);
      if (hit.length) { var o = hit[0].object; while (o.parent && objects.indexOf(o) < 0) o = o.parent; select(o); } else select(null);
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
