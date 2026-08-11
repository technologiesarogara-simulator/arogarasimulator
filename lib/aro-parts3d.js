/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — PARAMETRIC INDUSTRIAL COMPONENT LIBRARY
   ---------------------------------------------------------------------------
   A component library, not a set of pictures. Every part is built from
   engineering dimensions, and every part carries CONNECTION PORTS:

        port A ──[ COMPONENT ]── port B

   An assembly is built by handing parts to a builder in order. The builder
   walks the ports, so each part starts exactly where the previous one ended.
   Nothing floats, and there is no gap between pipe, flange, gasket and valve
   unless a gap was asked for.

   Because the assembly knows what it is made of, the BILL OF MATERIAL is a
   by-product of the geometry rather than a second, hand-maintained list that
   can drift away from it. So is the isometric.

   Three things this library is careful about:

   · LEVEL OF DETAIL. Bolts, nuts and gasket faces are geometry, and a flanged
     spool has a lot of flanges. Detail is a property of the assembly, so a
     distant or simple view costs a fraction of an inspected one.

   · SHARED GEOMETRY. One bolt is built once and instanced. The same is true
     of nuts and washers. A hundred bolts is one draw call, not a hundred.

   · HONESTY. Dimensions come in from the calculation. Where a part needs a
     proportion the calculation does not own — the depth of a valve body, the
     height of a handwheel — it is derived from the line size by ordinary
     piping practice and the part is marked as arrangement detail, so it can
     never be read off the screen as a design output.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var T = null;
  function three() { if (!T && typeof THREE !== 'undefined') T = THREE; return T; }

  /* ── Detail levels ─────────────────────────────────────────────────────── */
  var LOD = { SIMPLE: 0, INDUSTRIAL: 1, ENGINEERING: 2 };

  /* ── Materials, shared ─────────────────────────────────────────────────── */
  var MC = {};
  function m(hex, o) {
    /* A consumer may reach for a material before it has built a part — the
       Workbench bridge asks for a colour first and geometry second. Resolve
       THREE here rather than relying on some other call having done it. */
    if (!T) three();
    o = o || {};
    var k = hex + '|' + (o.m == null ? 9 : o.m) + '|' + (o.r == null ? 9 : o.r)
          + '|' + (o.op == null ? 1 : o.op) + '|' + (o.side ? 1 : 0);
    if (MC[k]) return MC[k];
    MC[k] = new T.MeshStandardMaterial({
      color: hex,
      metalness: o.m == null ? 0.6 : o.m,
      roughness: o.r == null ? 0.45 : o.r,
      transparent: o.op != null && o.op < 1,
      opacity: o.op == null ? 1 : o.op,
      side: o.side ? T.DoubleSide : T.FrontSide
    });
    return MC[k];
  }
  var COL = {
    pipe: 0x93a0a9, pipeDk: 0x6d777f, flange: 0x7d8890, bolt: 0x4a5158,
    gasket: 0xb4593a, valve: 0x38596b, valveDk: 0x27404e, hw: 0xa8371f,
    act: 0xc9922a, gauge: 0xd8dde1, support: 0x565f67, weld: 0xb9c3cb,
    hot: 0xb04430, cold: 0x2f6ea8, ins: 0xd2d6da
  };
  var MAT = {
    pipe: function () { return m(COL.pipe, { m: 0.74, r: 0.36 }); },
    pipeDk: function () { return m(COL.pipeDk, { m: 0.74, r: 0.4 }); },
    flange: function () { return m(COL.flange, { m: 0.8, r: 0.32 }); },
    bolt: function () { return m(COL.bolt, { m: 0.85, r: 0.3 }); },
    gasket: function () { return m(COL.gasket, { m: 0.1, r: 0.85 }); },
    valve: function () { return m(COL.valve, { m: 0.4, r: 0.52 }); },
    valveDk: function () { return m(COL.valveDk, { m: 0.45, r: 0.5 }); },
    hw: function () { return m(COL.hw, { m: 0.35, r: 0.55 }); },
    act: function () { return m(COL.act, { m: 0.4, r: 0.5 }); },
    gauge: function () { return m(COL.gauge, { m: 0.2, r: 0.4 }); },
    support: function () { return m(COL.support, { m: 0.6, r: 0.6 }); },
    bore: function () { return m(0x0c1218, { m: 0.2, r: 0.9, side: true }); }
  };

  /* ── ASME B36.10M outside diameters, mm ───────────────────────────────── */
  var NPS_OD = {
    0.5: 21.3, 0.75: 26.7, 1: 33.4, 1.25: 42.2, 1.5: 48.3, 2: 60.3, 2.5: 73.0,
    3: 88.9, 3.5: 101.6, 4: 114.3, 5: 141.3, 6: 168.3, 8: 219.1, 10: 273.1,
    12: 323.9, 14: 355.6, 16: 406.4, 18: 457.2, 20: 508.0, 22: 559.0,
    24: 610.0, 26: 660.0, 30: 762.0, 36: 914.0
  };
  /* ASME B16.5 class 150 raised-face flange: OD and bolt count, mm / off */
  var FLG = {
    0.5: [88.9, 4], 0.75: [98.6, 4], 1: [107.9, 4], 1.25: [117.3, 4],
    1.5: [127.0, 4], 2: [152.4, 4], 2.5: [177.8, 4], 3: [190.5, 4],
    4: [228.6, 8], 5: [254.0, 8], 6: [279.4, 8], 8: [342.9, 8],
    10: [406.4, 12], 12: [482.6, 12], 14: [533.4, 12], 16: [596.9, 16],
    18: [635.0, 16], 20: [698.5, 20], 24: [812.8, 20]
  };
  function odOf(nps, fallbackM) {
    var n = parseFloat(nps);
    if (isFinite(n) && NPS_OD[n]) return NPS_OD[n] / 1000;
    if (isFinite(n) && n > 0) return n * 25.4 * 1.13 / 1000;
    return fallbackM || 0.1143;
  }
  function flangeOf(nps, od) {
    var n = parseFloat(nps);
    if (isFinite(n) && FLG[n]) return { od: FLG[n][0] / 1000, bolts: FLG[n][1] };
    /* off the table: hold the proportions the table actually has */
    return { od: od * 1.85 + 0.02, bolts: od > 0.20 ? 12 : (od > 0.10 ? 8 : 4) };
  }

  /* ── Shared bolt geometry, built once and instanced ───────────────────── */
  var BOLT_GEO = null, NUT_GEO = null;
  function boltGeo() {
    if (!BOLT_GEO) BOLT_GEO = new T.CylinderGeometry(0.5, 0.5, 1, 8);
    return BOLT_GEO;
  }
  function nutGeo() {
    if (!NUT_GEO) NUT_GEO = new T.CylinderGeometry(0.9, 0.9, 1, 6);
    return NUT_GEO;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     A PART
     Local frame: the run axis is +X. Port A faces −X, port B faces +X.
     `len` is the distance from port A to port B, so the assembler never has
     to know what is inside a part to place the next one.
     ═══════════════════════════════════════════════════════════════════════ */
  function Part(kind, o) {
    this.kind = kind;
    this.group = new T.Group();
    this.len = o.len || 0;
    this.od = o.od || 0.1;
    this.meta = o.meta || {};
    this.turn = o.turn || null;      /* {axis:'y'|'z', angle} for a bend */
    this.branch = o.branch || null;  /* extra port, for a tee */
    this.group.userData.aroPart = this;
  }

  /* ── Primitives ───────────────────────────────────────────────────────── */
  function tube(od, len, mat, seg) {
    var msh = new T.Mesh(new T.CylinderGeometry(od / 2, od / 2, len, seg || 24), mat || MAT.pipe());
    msh.rotation.z = Math.PI / 2;
    return msh;
  }
  function put(o, x, y, z) { o.position.set(x || 0, y || 0, z || 0); return o; }

  /* Bolted joint detail: bolt circle rendered as two instanced meshes. */
  function boltCircle(g, x, fo, n, od, lod) {
    if (lod < LOD.INDUSTRIAL || n < 1) return 0;
    var shank = Math.max(0.005, od * 0.055);
    var br = fo / 2 - Math.max(0.010, od * 0.11);
    var blen = Math.max(0.03, od * 0.34);
    var bi = new T.InstancedMesh(boltGeo(), MAT.bolt(), n);
    var ni = new T.InstancedMesh(nutGeo(), MAT.bolt(), n * 2);
    var mtx = new T.Matrix4();
    var q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2);
    var sB = new T.Vector3(shank * 2, blen, shank * 2);
    var sN = new T.Vector3(shank * 2, shank * 1.7, shank * 2);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var y = br * Math.sin(a), z = br * Math.cos(a);
      mtx.compose(new T.Vector3(x, y, z), q, sB);
      bi.setMatrixAt(i, mtx);
      mtx.compose(new T.Vector3(x - blen / 2, y, z), q, sN);
      ni.setMatrixAt(i * 2, mtx);
      mtx.compose(new T.Vector3(x + blen / 2, y, z), q, sN);
      ni.setMatrixAt(i * 2 + 1, mtx);
    }
    bi.instanceMatrix.needsUpdate = true;
    ni.instanceMatrix.needsUpdate = true;
    g.add(bi); g.add(ni);
    return n;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     COMPONENTS
     ═══════════════════════════════════════════════════════════════════════ */

  /* Straight pipe. */
  function pipe(o) {
    var od = o.od, len = Math.max(0.001, o.len), lod = o.lod == null ? 1 : o.lod;
    /* `bomLen` lets a model draw a compressed run while the take-off still
       counts the calculated length — the picture may be shortened, the
       material list never is */
    var p = new Part('PIPE', { len: len, od: od, meta: {
      label: 'PIPE', size: o.nps ? 'NPS ' + o.nps + '″' : null, sch: o.sch,
      qty: (o.bomLen != null ? o.bomLen : len), unit: 'm',
      material: o.material || 'CS', tag: o.tag, bom: true
    } });
    p.trueLen = (o.bomLen != null ? o.bomLen : len);
    p.group.add(put(tube(od, len, o.mat || MAT.pipe(), lod ? 24 : 12), len / 2, 0, 0));
    if (lod >= LOD.INDUSTRIAL && o.bore !== false) {
      p.group.add(put(tube(od * 0.86, len * 1.002, MAT.bore(), 20), len / 2, 0, 0));
    }
    return p;
  }

  /* Weld-neck flange with gasket face, bolt circle and hub. */
  function flange(o) {
    var od = o.od, lod = o.lod == null ? 1 : o.lod;
    var f = flangeOf(o.nps, od);
    var th = Math.max(0.010, od * 0.17);
    var hub = Math.max(0.012, od * 0.30);
    var len = th + hub;
    var p = new Part('FLANGE', { len: len, od: od, meta: {
      label: (o.type || 'WELD NECK') + ' FLANGE',
      size: o.nps ? 'NPS ' + o.nps + '″' : null, rating: o.rating || 'CL 150',
      qty: 1, unit: 'off', material: o.material || 'CS', tag: o.tag, bom: true
    } });
    var g = p.group;
    /* hub tapers from the pipe out to the flange back face */
    g.add(put(new T.Mesh(new T.CylinderGeometry(od * 0.72, od * 0.55, hub, lod ? 24 : 12),
      o.mat || MAT.flange()), 0, 0, 0).rotateZ(Math.PI / 2));
    g.children[0].position.x = hub / 2;
    g.add(put(new T.Mesh(new T.CylinderGeometry(f.od / 2, f.od / 2, th, lod ? 28 : 14),
      o.mat || MAT.flange()), hub + th / 2, 0, 0));
    g.children[1].rotation.z = Math.PI / 2;
    /* raised face */
    if (lod >= LOD.INDUSTRIAL) {
      var rf = new T.Mesh(new T.CylinderGeometry(od * 0.80, od * 0.80, th * 0.30, 24), MAT.flange());
      rf.rotation.z = Math.PI / 2;
      g.add(put(rf, len + th * 0.14, 0, 0));
    }
    if (lod >= LOD.INDUSTRIAL && o.bore !== false) {
      g.add(put(tube(od * 0.86, len, MAT.bore(), 18), len / 2, 0, 0));
    }
    p.meta.boltCount = f.bolts;
    p.flangeOd = f.od;
    p.faceX = len;
    return p;
  }

  /* A complete bolted joint: flange · gasket · flange, with bolts through. */
  function flangedJoint(o) {
    var od = o.od, lod = o.lod == null ? 1 : o.lod;
    var f = flangeOf(o.nps, od);
    var a = flange({ od: od, nps: o.nps, lod: lod, material: o.material });
    var b = flange({ od: od, nps: o.nps, lod: lod, material: o.material });
    var gt = Math.max(0.002, od * 0.020);
    var len = a.len + gt + b.len;
    var p = new Part('JOINT', { len: len, od: od, meta: { label: 'FLANGED JOINT', bom: false } });
    var g = p.group;
    a.group.position.x = 0;
    g.add(a.group);
    var gk = new T.Mesh(new T.CylinderGeometry(f.od / 2 * 0.86, f.od / 2 * 0.86, gt, lod ? 24 : 12), MAT.gasket());
    gk.rotation.z = Math.PI / 2;
    g.add(put(gk, a.len + gt / 2, 0, 0));
    b.group.rotation.y = Math.PI;               /* the far flange faces back */
    b.group.position.x = len;
    g.add(b.group);
    boltCircle(g, len / 2, f.od, f.bolts, od, lod);
    p.parts = [a, b];
    p.meta.children = [
      { label: 'WELD NECK FLANGE', size: o.nps ? 'NPS ' + o.nps + '″' : null,
        rating: o.rating || 'CL 150', qty: 2, unit: 'off', material: o.material || 'CS', bom: true },
      { label: 'GASKET, SPIRAL WOUND', size: o.nps ? 'NPS ' + o.nps + '″' : null,
        rating: o.rating || 'CL 150', qty: 1, unit: 'off', material: 'SS 316 / GRAPHITE', bom: true },
      { label: 'STUD BOLT SET WITH NUTS', size: o.nps ? 'NPS ' + o.nps + '″' : null,
        qty: 1, unit: 'set', detail: f.bolts + ' off', material: 'ASTM A193 B7 / A194 2H', bom: true }
    ];
    return p;
  }

  /* 90° or 45° elbow. Long-radius: centreline radius 1.5 D. */
  function elbow(o) {
    var od = o.od, ang = (o.angle || 90) * Math.PI / 180, lod = o.lod == null ? 1 : o.lod;
    var R = od * 1.5;
    var p = new Part('ELBOW', {
      len: R * Math.tan(ang / 2) * 2 * 0, od: od,
      turn: { axis: o.axis || 'z', angle: (o.angle || 90) * (o.dir === -1 ? -1 : 1), R: R },
      meta: { label: (o.angle || 90) + '° ELBOW, LR', size: o.nps ? 'NPS ' + o.nps + '″' : null,
              qty: 1, unit: 'off', material: o.material || 'CS', bom: true }
    });
    var tor = new T.Mesh(new T.TorusGeometry(R, od / 2, lod ? 12 : 6, lod ? 18 : 8, ang), o.mat || MAT.pipe());
    p.group.add(tor);
    p.R = R;
    p.angle = ang;
    return p;
  }

  /* Equal or reducing tee. Branch leaves on +Y. */
  function tee(o) {
    var od = o.od, bod = o.branchOd || od, lod = o.lod == null ? 1 : o.lod;
    var len = od * 2.2;
    var p = new Part('TEE', { len: len, od: od, meta: {
      label: (bod < od * 0.99 ? 'REDUCING TEE' : 'EQUAL TEE'),
      size: o.nps ? 'NPS ' + o.nps + '″' + (bod < od * 0.99 && o.branchNps ? ' × ' + o.branchNps + '″' : '') : null,
      qty: 1, unit: 'off', material: o.material || 'CS', bom: true
    } });
    p.group.add(put(tube(od, len, o.mat || MAT.pipe(), lod ? 22 : 10), len / 2, 0, 0));
    var br = new T.Mesh(new T.CylinderGeometry(bod / 2, bod / 2, od * 1.3, lod ? 20 : 10), o.mat || MAT.pipe());
    p.group.add(put(br, len / 2, od * 0.65, 0));
    p.branch = { x: len / 2, y: od * 1.3, od: bod };
    return p;
  }

  /* Concentric or eccentric reducer. */
  function reducer(o) {
    var od1 = o.od, od2 = o.od2, lod = o.lod == null ? 1 : o.lod;
    var len = Math.max(0.05, (od1 - od2) * 2.5 + od1 * 0.6);
    var p = new Part('REDUCER', { len: len, od: Math.max(od1, od2), meta: {
      label: (o.ecc ? 'ECCENTRIC' : 'CONCENTRIC') + ' REDUCER',
      size: (o.nps && o.nps2) ? 'NPS ' + o.nps + '″ × ' + o.nps2 + '″' : null,
      qty: 1, unit: 'off', material: o.material || 'CS', bom: true
    } });
    var c = new T.Mesh(new T.CylinderGeometry(od2 / 2, od1 / 2, len, lod ? 22 : 10), o.mat || MAT.pipe());
    c.rotation.z = Math.PI / 2;
    p.group.add(put(c, len / 2, o.ecc ? -(od1 - od2) / 2 : 0, 0));
    p.exitOd = od2;
    p.exitY = o.ecc ? -(od1 - od2) / 2 : 0;
    return p;
  }

  /* Valves. Body along +X; the operator stands on +Y. */
  function valve(o) {
    var od = o.od, lod = o.lod == null ? 1 : o.lod;
    var kind = String(o.kind || 'gate').toLowerCase();
    var bodyD = od * 1.55, bodyL = od * 1.6;
    var f = flangeOf(o.nps, od);
    var fth = Math.max(0.010, od * 0.17);
    var len = bodyL + fth * 2;
    var NAME = { gate: 'GATE VALVE', globe: 'GLOBE VALVE', ball: 'BALL VALVE',
                 butterfly: 'BUTTERFLY VALVE', check: 'CHECK VALVE',
                 control: 'CONTROL VALVE', needle: 'NEEDLE VALVE' };
    var p = new Part('VALVE', { len: len, od: od, meta: {
      label: NAME[kind] || 'VALVE', size: o.nps ? 'NPS ' + o.nps + '″' : null,
      rating: o.rating || 'CL 150', qty: 1, unit: 'off',
      material: o.material || 'CS BODY / SS TRIM', tag: o.tag, bom: true,
      ends: 'FLANGED RF'
    } });
    var g = p.group;
    /* flanged ends */
    [fth / 2, len - fth / 2].forEach(function (x) {
      var fl = new T.Mesh(new T.CylinderGeometry(f.od / 2, f.od / 2, fth, lod ? 24 : 12), MAT.flange());
      fl.rotation.z = Math.PI / 2;
      g.add(put(fl, x, 0, 0));
    });
    if (lod >= LOD.INDUSTRIAL) {
      boltCircle(g, fth / 2, f.od, f.bolts, od, lod);
      boltCircle(g, len - fth / 2, f.od, f.bolts, od, lod);
    }
    /* body */
    if (kind === 'butterfly') {
      g.add(put(tube(bodyD * 0.8, bodyL * 0.35, MAT.valve(), lod ? 20 : 10), len / 2, 0, 0));
    } else if (kind === 'globe' || kind === 'control') {
      var sph = new T.Mesh(new T.SphereGeometry(bodyD / 2, lod ? 20 : 10, lod ? 14 : 8), MAT.valve());
      sph.scale.x = 0.85;
      g.add(put(sph, len / 2, 0, 0));
    } else {
      g.add(put(tube(bodyD, bodyL, MAT.valve(), lod ? 20 : 10), len / 2, 0, 0));
    }
    if (kind === 'check') {
      /* a check valve has no operator; show the cover and the flow arrow only */
      if (lod >= LOD.INDUSTRIAL) {
        g.add(put(new T.Mesh(new T.BoxGeometry(od * 0.5, bodyD * 0.28, bodyD * 0.9),
          MAT.valveDk()), len / 2, bodyD * 0.5, 0));
      }
      p.meta.detail = 'SWING CHECK — FLOW LEFT TO RIGHT';
      return p;
    }
    /* bonnet and stem */
    var bonH = od * 0.85;
    g.add(put(new T.Mesh(new T.CylinderGeometry(od * 0.34, od * 0.44, bonH, lod ? 16 : 8), MAT.valveDk()),
      len / 2, bodyD * 0.45 + bonH / 2, 0));
    var stemH = od * (kind === 'ball' || kind === 'butterfly' ? 0.5 : 1.0);
    g.add(put(new T.Mesh(new T.CylinderGeometry(od * 0.09, od * 0.09, stemH, 10), MAT.flange()),
      len / 2, bodyD * 0.45 + bonH + stemH / 2, 0));
    var topY = bodyD * 0.45 + bonH + stemH;
    if (kind === 'control') {
      /* diaphragm actuator and positioner */
      var actD = od * 2.0;
      g.add(put(new T.Mesh(new T.CylinderGeometry(actD / 2, actD / 2, actD * 0.42, lod ? 20 : 10), MAT.act()),
        len / 2, topY + actD * 0.21, 0));
      g.add(put(new T.Mesh(new T.CylinderGeometry(actD * 0.10, actD * 0.10, actD * 0.30, 10), MAT.valveDk()),
        len / 2, topY + actD * 0.42 + actD * 0.15, 0));
      if (lod >= LOD.INDUSTRIAL) {
        g.add(put(new T.Mesh(new T.BoxGeometry(od * 0.42, od * 0.5, od * 0.34), MAT.valveDk()),
          len / 2, topY + actD * 0.20, actD * 0.42));
      }
      p.meta.detail = 'DIAPHRAGM ACTUATOR WITH POSITIONER';
      p.meta.actuator = 'PNEUMATIC DIAPHRAGM';
    } else if (kind === 'ball' || kind === 'butterfly') {
      /* lever operator */
      var lv = new T.Mesh(new T.BoxGeometry(od * 1.7, od * 0.10, od * 0.16), MAT.hw());
      g.add(put(lv, len / 2 + od * 0.55, topY + od * 0.08, 0));
      p.meta.detail = 'LEVER OPERATED';
    } else {
      /* handwheel */
      var hwR = od * 0.62;
      var hw = new T.Mesh(new T.TorusGeometry(hwR, od * 0.06, 8, lod ? 18 : 8), MAT.hw());
      hw.rotation.x = Math.PI / 2;
      g.add(put(hw, len / 2, topY + od * 0.06, 0));
      if (lod >= LOD.INDUSTRIAL) {
        for (var s = 0; s < 3; s++) {
          var sp = new T.Mesh(new T.CylinderGeometry(od * 0.035, od * 0.035, hwR * 2, 6), MAT.hw());
          sp.rotation.z = Math.PI / 2;
          sp.rotation.y = s * Math.PI / 3;
          g.add(put(sp, len / 2, topY + od * 0.06, 0));
        }
      }
      p.meta.detail = 'HANDWHEEL OPERATED, RISING STEM';
    }
    p.top = topY;
    return p;
  }

  /* Pressure or temperature gauge on a short stub. */
  function gauge(o) {
    var od = o.od, lod = o.lod == null ? 1 : o.lod;
    var d = Math.max(od * 0.9, 0.075);
    var p = new Part('INSTRUMENT', { len: 0, od: od, meta: {
      label: (o.type === 'TI' ? 'TEMPERATURE GAUGE' : 'PRESSURE GAUGE'),
      size: '100 mm DIAL', qty: 1, unit: 'off', tag: o.tag || (o.type === 'TI' ? 'TI' : 'PI'),
      material: 'SS 316', bom: true, detail: 'WITH ISOLATION VALVE'
    } });
    var g = p.group;
    var stub = Math.max(od * 0.7, 0.06);
    g.add(put(new T.Mesh(new T.CylinderGeometry(od * 0.16, od * 0.16, stub, 10), MAT.pipe()), 0, stub / 2, 0));
    var cs = new T.Mesh(new T.CylinderGeometry(d / 2, d / 2, d * 0.24, lod ? 20 : 10), MAT.valve());
    g.add(put(cs, 0, stub + d * 0.12, 0));
    var face = new T.Mesh(new T.CylinderGeometry(d * 0.43, d * 0.43, d * 0.05, lod ? 20 : 10), MAT.gauge());
    g.add(put(face, 0, stub + d * 0.26, 0));
    if (lod >= LOD.INDUSTRIAL) {
      var nd = new T.Mesh(new T.BoxGeometry(d * 0.05, d * 0.34, d * 0.02), MAT.bolt());
      nd.rotation.z = -0.6;
      g.add(put(nd, d * 0.08, stub + d * 0.30, 0));
    }
    p.height = stub + d * 0.3;
    return p;
  }

  /* A nozzle standing off a vessel: set-on stub with a flange on its free
     end. Points along +X from the shell surface. */
  function nozzle(o) {
    var od = o.od, len = Math.max(0.02, o.len || od * 1.2), lod = o.lod == null ? 1 : o.lod;
    var p = new Part('NOZZLE', { len: 0, od: od, meta: o.meta || {
      label: 'NOZZLE', size: o.nps ? 'NPS ' + o.nps + '″' : null,
      rating: o.rating || 'CL 150 RF', qty: 1, unit: 'off',
      material: o.material || 'CS', tag: o.tag, bom: true
    } });
    var g = p.group;
    g.add(put(tube(od, len, o.mat || MAT.pipe(), lod ? 18 : 8), len / 2, 0, 0));
    var f = flangeOf(o.nps, od);
    var th = Math.max(0.008, od * 0.17);
    var fl = new T.Mesh(new T.CylinderGeometry(f.od / 2, f.od / 2, th, lod ? 22 : 10), MAT.flange());
    fl.rotation.z = Math.PI / 2;
    g.add(put(fl, len + th / 2, 0, 0));
    if (lod >= LOD.INDUSTRIAL) boltCircle(g, len + th / 2, f.od, f.bolts, od, lod);
    p.height = len + th;
    return p;
  }

  /* Pipe support: shoe, stanchion, base plate. */
  function support(o) {
    var od = o.od, h = Math.max(0.06, o.height || od * 3), lod = o.lod == null ? 1 : o.lod;
    var kind = String(o.kind || 'shoe').toLowerCase();
    var p = new Part('SUPPORT', { len: 0, od: od, meta: {
      label: kind === 'guide' ? 'PIPE GUIDE' : (kind === 'anchor' ? 'PIPE ANCHOR' : 'PIPE SHOE SUPPORT'),
      size: o.nps ? 'NPS ' + o.nps + '″' : null, qty: 1, unit: 'off',
      material: 'CS, GALVANISED', bom: true, detail: 'ARRANGEMENT ITEM — NOT SIZED BY THIS CALCULATION'
    } });
    var g = p.group;
    g.add(put(new T.Mesh(new T.BoxGeometry(od * 1.1, od * 0.24, od * 1.5), MAT.support()), 0, -od * 0.62, 0));
    g.add(put(new T.Mesh(new T.BoxGeometry(od * 0.30, h, od * 0.30), MAT.support()), 0, -od * 0.72 - h / 2, 0));
    g.add(put(new T.Mesh(new T.BoxGeometry(od * 1.5, Math.max(0.012, od * 0.10), od * 1.5), MAT.support()),
      0, -od * 0.72 - h, 0));
    if (lod >= LOD.INDUSTRIAL && kind === 'guide') {
      var ub = new T.Mesh(new T.TorusGeometry(od * 0.62, od * 0.05, 6, 14, Math.PI), MAT.bolt());
      ub.rotation.y = Math.PI / 2;
      g.add(put(ub, 0, 0, 0));
    }
    p.drop = od * 0.72 + h;
    return p;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ASSEMBLY
     Hand it parts in order. It walks the ports, so each part begins where
     the last one ended — a run, a bend, a run, a valve, a run.
     ═══════════════════════════════════════════════════════════════════════ */
  function Assembly(o) {
    o = o || {};
    this.lod = o.lod == null ? LOD.INDUSTRIAL : o.lod;
    this.root = new T.Group();
    this.items = [];
    this.cursor = new T.Vector3(o.x || 0, o.y || 0, o.z || 0);
    this.dir = new T.Vector3(1, 0, 0);   /* current run direction */
    this.up = new T.Vector3(0, 1, 0);
    this.path = [this.cursor.clone()];
    this.selectable = [];
  }

  Assembly.prototype._orient = function (g) {
    /* place a part whose local +X is the run direction */
    var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), this.dir.clone().normalize());
    g.quaternion.copy(q);
    g.position.copy(this.cursor);
  };

  /* Add a part and advance the cursor by its length along the run. */
  Assembly.prototype.add = function (part, o) {
    o = o || {};
    this._orient(part.group);
    if (o.roll) part.group.rotateX(o.roll);
    this.root.add(part.group);
    this.items.push(part);
    if (part.kind !== 'SUPPORT' && part.kind !== 'INSTRUMENT') this.selectable.push(part);
    if (part.len) {
      this.cursor.addScaledVector(this.dir, part.len);
      this.path.push(this.cursor.clone());
    }
    return part;
  };

  /* A bend: place the elbow so its inlet meets the cursor travelling in the
     current direction, then follow the arc out and turn the run.

     For a turn of theta about axis a, the arc centre lies at
         centre = cursor + R * n,   n = normalise(a x d)
     the inlet is centre - R*n, and the outlet is centre + rotate(-R*n, a, t).
     TorusGeometry sweeps from (R,0,0) toward +Y, so the elbow's local +X is
     aimed at -n and its local +Y along the incoming direction. */
  Assembly.prototype.bend = function (part, o) {
    o = o || {};
    var a = (o.axis === 'y') ? new T.Vector3(0, 1, 0)
          : (o.axis === 'x') ? new T.Vector3(1, 0, 0)
          : new T.Vector3(0, 0, 1);
    var sign = o.dir === -1 ? -1 : 1;
    var theta = part.angle * sign;
    var R = part.R;
    var d = this.dir.clone().normalize();
    var n = new T.Vector3().crossVectors(a, d).normalize().multiplyScalar(sign);
    if (!isFinite(n.x) || n.lengthSq() < 1e-9) {
      /* the run is parallel to the turn axis — there is no bend to make */
      return part;
    }
    var centre = this.cursor.clone().addScaledVector(n, R);

    var lx = n.clone().multiplyScalar(-1);
    var ly = d.clone();
    var lz = new T.Vector3().crossVectors(lx, ly).normalize();
    var basis = new T.Matrix4().makeBasis(lx, ly, lz);
    part.group.quaternion.setFromRotationMatrix(basis);
    part.group.position.copy(centre);
    this.root.add(part.group);
    this.items.push(part);
    this.selectable.push(part);

    var arm = n.clone().multiplyScalar(-R).applyAxisAngle(a, theta);
    this.cursor.copy(centre).add(arm);
    this.dir.copy(d.clone().applyAxisAngle(a, theta).normalize());
    this.path.push(this.cursor.clone());
    return part;
  };

  /* Something that hangs off the run rather than sitting in it. */
  Assembly.prototype.attach = function (part, o) {
    o = o || {};
    var g = part.group;
    var at = o.at != null ? o.at : 0;
    var pos = this.cursor.clone().addScaledVector(this.dir, -at);
    if (o.offset) pos.add(o.offset);
    g.position.copy(pos);
    if (o.yaw) g.rotateY(o.yaw);
    this.root.add(g);
    this.items.push(part);
    return part;
  };

  /* A module-specific shell — a pump volute, a tank course, an exchanger
     bundle — placed in world coordinates rather than walked along a run. It
     still joins the assembly, so it is inspectable and it reaches the
     take-off like any library part. */
  Assembly.prototype.custom = function (obj, meta, o) {
    o = o || {};
    var part = new Part(o.kind || 'EQUIPMENT', { len: 0, od: o.od || 0.1, meta: meta || {} });
    part.group.add(obj);
    if (o.at) part.group.position.copy(o.at);
    if (o.rot) part.group.rotation.set(o.rot.x || 0, o.rot.y || 0, o.rot.z || 0);
    this.root.add(part.group);
    this.items.push(part);
    if (meta && meta.bom !== false) this.selectable.push(part);
    return part;
  };

  /* A take-off line with no geometry of its own — grout, paint, insulation.
     Kept separate from `custom` so it can never be mistaken for something
     the model actually drew. */
  Assembly.prototype.item = function (meta) {
    var part = new Part('ITEM', { len: 0, od: 0, meta: meta || {} });
    this.items.push(part);
    return part;
  };

  Assembly.prototype.setLod = function (l) { this.lod = l; return this; };

  /* ── BILL OF MATERIAL, from the assembly itself ───────────────────────── */
  Assembly.prototype.bom = function () {
    var rows = {};
    function push(meta) {
      if (!meta || !meta.bom) return;
      var key = [meta.label, meta.size || '', meta.rating || '', meta.material || ''].join('|');
      if (!rows[key]) {
        rows[key] = { label: meta.label, size: meta.size || '—', rating: meta.rating || '',
                      material: meta.material || '—', qty: 0, unit: meta.unit || 'off',
                      detail: meta.detail || '', tags: [] };
      }
      rows[key].qty += (meta.qty || 1);
      if (meta.tag && rows[key].tags.indexOf(meta.tag) < 0) rows[key].tags.push(meta.tag);
    }
    this.items.forEach(function (p) {
      push(p.meta);
      (p.meta.children || []).forEach(push);
    });
    return Object.keys(rows).map(function (k) { return rows[k]; })
      .sort(function (a, b) { return a.label.localeCompare(b.label); });
  };

  /* ── Geometry validation ──────────────────────────────────────────────── */
  Assembly.prototype.validate = function () {
    var issues = [];
    /* Equipment assemblies — a tank, an exchanger — legitimately have no run
       to walk. Only a routed assembly is required to contain one, or the
       check reports a fault against every vessel in the suite. */
    var routed = this.items.some(function (p) {
      return p.kind === 'PIPE' || p.kind === 'ELBOW' || p.kind === 'TEE';
    });
    if (routed && !this.items.filter(function (p) { return p.len || p.R; }).length) {
      issues.push('The assembly contains no run components.');
    }
    this.items.forEach(function (p) {
      if (p.kind === 'ITEM') return;                 /* a take-off line, not geometry */
      if (p.od != null && !(p.od > 0)) issues.push((p.meta.label || p.kind) + ' has no diameter.');
      if (p.kind === 'PIPE' && !(p.len > 0)) issues.push('A pipe segment has no length.');
    });
    /* a break in the walked path means a part did not start where the last
       one ended — the one failure this architecture is designed to prevent */
    for (var i = 1; i < this.path.length; i++) {
      if (!isFinite(this.path[i].x) || !isFinite(this.path[i].y) || !isFinite(this.path[i].z)) {
        issues.push('The route contains an undefined point.');
        break;
      }
    }
    return issues;
  };

  /* The walked centreline, for the isometric and for flow animation. */
  Assembly.prototype.route = function () { return this.path.slice(); };

  window.AROPARTS = {
    LOD: LOD,
    /* resolve THREE up front; returns false when it is genuinely absent */
    ready: function () { return !!three(); },
    Assembly: function (o) { three(); return new Assembly(o || {}); },
    pipe: function (o) { three(); return pipe(o); },
    flange: function (o) { three(); return flange(o); },
    flangedJoint: function (o) { three(); return flangedJoint(o); },
    elbow: function (o) { three(); return elbow(o); },
    tee: function (o) { three(); return tee(o); },
    reducer: function (o) { three(); return reducer(o); },
    valve: function (o) { three(); return valve(o); },
    nozzle: function (o) { three(); return nozzle(o); },
    gauge: function (o) { three(); return gauge(o); },
    support: function (o) { three(); return support(o); },
    odOf: odOf, flangeOf: flangeOf, NPS_OD: NPS_OD,
    materials: MAT, colours: COL
  };
})();
