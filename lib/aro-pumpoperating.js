/* Selected-pump operating scene. Values come from the last hydraulic run.
   Geometry, fluid tint and slowed mechanism motion illustrate the duty;
   they are not vendor dimensions, a material specification or CFD. */
(function () {
  'use strict';
  function number(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function fmt(v, unit, digits) {
    return number(v) === null ? 'Not calculated' : v.toFixed(digits == null ? 2 : digits) + (unit ? ' ' + unit : '');
  }
  function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function fluidColor(label) {
    if (/crude|heavy|oil/i.test(label || '')) return 0x896635;
    if (/diesel/i.test(label || '')) return 0xc49c49;
    if (/acid|caustic/i.test(label || '')) return 0x70b59a;
    if (/glycol/i.test(label || '')) return 0x799bcb;
    return 0x38aacc;
  }
  function operatingData(panel) {
    var d = panel.dutyReadout || {}, n = panel.nozzles || {};
    function velocity(mm) {
      return number(d.Q_m3h) !== null && number(mm) !== null && mm > 0
        ? d.Q_m3h / 3600 / (Math.PI * Math.pow(mm / 1000, 2) / 4) : null;
    }
    return { suctionVelocity: velocity(n.suctionIdMm), dischargeVelocity: velocity(n.dischargeIdMm),
      color: fluidColor(d.fluidLabel), running: number(d.Q_m3h) !== null && d.Q_m3h > 0,
      elevationDelta: number(d.dischargeElevationM) !== null && number(d.pumpElevationM) !== null
        ? d.dischargeElevationM - d.pumpElevationM : null };
  }
  function readout(panel, host) {
    if (!host || typeof document === 'undefined') return;
    var box = document.getElementById('pump-operating-readout');
    if (!box) {
      box = document.createElement('section'); box.id = 'pump-operating-readout';
      box.setAttribute('aria-label', 'Selected pump operating duty');
      host.parentNode.insertBefore(box, host.nextSibling);
    }
    if (!panel || !panel.applicable) { box.innerHTML = ''; return; }
    var d = panel.dutyReadout, n = panel.nozzles || {}, op = operatingData(panel);
    var moc = panel.moc || {};
    function material(role) {
      var r = moc[role];
      return r && r.applicable && r.top && r.top.name ? r.top.name : 'Material review required';
    }
    var parts = (panel.fabricationParts || []).map(function (p) { return p.label; }).slice(0, 7);
    var rows = [
      ['SELECTED PUMP', (panel.familyName || 'Not selected') + ' · ' + (panel.archetype && panel.archetype.label || '3D model')],
      ['PUMP PARTS', parts.length ? parts.join(' · ') : 'Parts list not available'],
      ['MOC — CASING / IMPELLER / SHAFT', material('casing') + ' / ' + material('impeller') + ' / ' + material('shaft')],
      ['DESIGN CAPACITY', fmt(d.Q_m3h, 'm³/h')], ['TOTAL DIFFERENTIAL HEAD', fmt(d.H_m, 'm')],
      ['SUCTION PORT', (n.suction || 'Not sized') + ' · ' + fmt(d.suctionPressureBarA, 'bar(a)')],
      ['DISCHARGE PORT', (n.discharge || 'Not sized') + ' · ' + fmt(d.dischargePressureBarG, 'bar(g)')],
      ['DISCHARGE ELEVATION', fmt(d.dischargeElevationM, 'm')],
      ['HYDRAULIC / SHAFT POWER', fmt(d.hydraulicKw, 'kW') + ' / ' + fmt(d.shaftKw, 'kW')],
      [panel.familyId === 'aodd' ? 'AIR DRIVE' : 'SCREENED MOTOR', panel.familyId === 'aodd' ? 'Air pressure / consumption: vendor data required' : fmt(d.motorKw, 'kW') + ' · duty estimate'],
      ['SUCTION / DISCHARGE VELOCITY', fmt(op.suctionVelocity, 'm/s') + ' / ' + fmt(op.dischargeVelocity, 'm/s')],
      ['SUCTION / DISCHARGE LINE LOSS', fmt(d.suctionLineLossBar, 'bar') + ' / ' + fmt(d.dischargeLineLossBar, 'bar')],
      ['FITTINGS USED IN LOSS', 'Suction ΣK ' + fmt(d.suctionFittingsK, '', 2) + ' · Discharge ΣK ' + fmt(d.dischargeFittingsK, '', 2)],
      ['PUMP CENTRELINE ELEVATION', fmt(d.pumpElevationM, 'm')],
      ['FLUID / TEMPERATURE', (d.fluidLabel || 'Not entered') + ' · ' + fmt(d.temperatureC, '°C', 1)],
      ['DENSITY / VISCOSITY', fmt(d.densityKgM3, 'kg/m³', 1) + ' / ' + fmt(d.viscosityCp, 'cP')],
      ['NPSHa / NPSHr', fmt(d.npshaM, 'm') + ' / ' + fmt(d.npshrM, 'm')],
      [panel.familyId === 'aodd' ? 'ACTUATION' : 'CALCULATION SPEED', panel.familyId === 'aodd' ? 'Alternating air-driven diaphragms' : fmt(d.speedRpm, 'rpm', 0)]
    ];
    var caution = number(d.npshaM) !== null && number(d.npshrM) !== null && d.npshaM < d.npshrM;
    box.innerHTML = '<div class="pump-duty-heading"><b>OPERATING DUTY · ' + escape(panel.familyName) + '</b><span>' + (caution ? 'NPSH DEFICIT' : 'LAST CALCULATED DUTY') + '</span></div><div class="pump-duty-grid">' +
      rows.map(function(r) { return '<div><small>' + escape(r[0]) + '</small><strong>' + escape(r[1]) + '</strong></div>'; }).join('') +
      '</div><p class="pump-duty-mechanism">' + escape(panel.archetype.flowPath) + '</p>' +
      '<p class="pump-duty-note"><b>Equipment legend:</b> motor / drive, pump casing, wetted rotor or impeller, bolted suction port and bolted discharge port. Flow mode follows the model’s internal suction-to-discharge route. No process piping or tank layout is included.</p>'+ '<p class="pump-duty-note">Nozzles, materials, elevation and power are drawn from this calculated duty. Confirm the selected family’s efficiency, speed, NPSHr and exact model against a vendor curve. Layout is compressed for display; fluid motion is illustrative, not CFD.</p>';
    if (!document.getElementById('pump-duty-style')) {
      var style = document.createElement('style'); style.id = 'pump-duty-style';
      style.textContent = '.pump-duty-heading{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;padding:12px;background:var(--bg-panel,#edf3f6);border-bottom:1px solid var(--border-muted,#cbd5e1);font-size:11px}.pump-duty-heading span{color:#0284c7;font-size:10px}.pump-duty-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:1px;background:var(--border-muted,#cbd5e1)}.pump-duty-grid>div{padding:11px;background:var(--bg-panel,#fff);min-width:0}.pump-duty-grid small{display:block;font-size:9px;color:var(--text-muted,#64748b);margin-bottom:6px}.pump-duty-grid strong{font-size:11px;color:var(--text-main,#1e293b);overflow-wrap:anywhere}.pump-duty-mechanism,.pump-duty-note{margin:0;padding:10px 12px;font-size:10px;line-height:1.6}.pump-duty-note{color:var(--text-muted,#64748b)}#pump-operating-readout{border:1px solid var(--border-muted,#cbd5e1);border-radius:8px;margin-top:8px;overflow:hidden}';
      document.head.appendChild(style);
    }
  }
  function label(T, text, pos, color) {
    var canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#102435'; ctx.fillRect(0, 0, 768, 160);
    ctx.fillStyle = color || '#60b6de'; ctx.fillRect(0, 0, 8, 160);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 27px Arial';
    String(text).split('\n').slice(0, 3).forEach(function(line, i) { ctx.fillText(line, 24, 39 + i * 47, 720); });
    var texture = new T.CanvasTexture(canvas);
    var sprite = new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false}));
    sprite.scale.set(0.88, 0.18, 1); sprite.position.copy(pos); sprite.renderOrder = 1000;
    /* Labels are screen overlays. Camera fitting must use the physical pump
       geometry only, otherwise a long MOC tag makes the equipment tiny. */
    sprite.userData.partName = text; sprite.userData.excludeFromFit = true; return sprite;
  }
  function decorate(panel, built) {
    var T = window.THREE, d = panel.dutyReadout || {}, op = operatingData(panel);
    if (!T || !built.ports || !built.ports.suction || !built.ports.discharge) return;
    /* Compact calculated process connections. They show the actual ports,
       calculated bores and loss-bearing fittings without inventing a full
       plant layout or a tank location. */
    var nz = panel.nozzles || {}, d = panel.dutyReadout || {};
    var route = new T.Group(); route.userData.partName = 'Calculated suction and discharge connection route';
    function radius(mm) { return number(mm) !== null ? Math.max(0.045, Math.min(0.14, mm / 700)) : 0.07; }
    function normal(v, fallback) { return v && v.lengthSq && v.lengthSq() > 0 ? v.clone().normalize() : fallback.clone(); }
    var sn = normal(built.ports.suctionNormal, new T.Vector3(-1,0,0));
    var dn = normal(built.ports.dischargeNormal, new T.Vector3(1,0,0));
    var sp = built.ports.suction.clone(), dp = built.ports.discharge.clone();
    var source = sp.clone().addScaledVector(sn, 0.95), target = dp.clone().addScaledVector(dn, 1.05);
    var pipeMat = new T.MeshStandardMaterial({ color:0x7c8b96, metalness:0.72, roughness:0.3 });
    function line(a,b,r,name) { var cv=new T.CurvePath(); cv.add(new T.LineCurve3(a,b)); var m=new T.Mesh(new T.TubeGeometry(cv,20,r,12,false),pipeMat); m.userData.partName=name; route.add(m); return cv; }
    var sr=radius(nz.suctionIdMm), dr=radius(nz.dischargeIdMm);
    var suction=line(source,sp,sr,'Suction pipe · '+(nz.suction||'not sized')+' · ΔP '+fmt(d.suctionLineLossBar,'bar'));
    var discharge=line(dp,target,dr,'Discharge pipe · '+(nz.discharge||'not sized')+' · ΔP '+fmt(d.dischargeLineLossBar,'bar'));
    function fitting(at,r,name,color) { var g=new T.Group(); g.position.copy(at); g.userData.partName=name; var body=new T.Mesh(new T.SphereGeometry(r*1.45,16,12),new T.MeshStandardMaterial({color:color,metalness:.65,roughness:.28})); g.add(body); route.add(g); }
    if (number(d.suctionFittingsK) !== null && d.suctionFittingsK > 0) fitting(source.clone().lerp(sp,.48),sr,'Suction fitting set · ΣK '+d.suctionFittingsK.toFixed(2)+' included in loss',0x0e7490);
    if (number(d.dischargeFittingsK) !== null && d.dischargeFittingsK > 0) fitting(dp.clone().lerp(target,.52),dr,'Discharge fitting set · ΣK '+d.dischargeFittingsK.toFixed(2)+' included in loss',0xb45309);
    var suctionPortMarker = new T.Mesh(new T.SphereGeometry(sr*1.18,12,10),new T.MeshStandardMaterial({color:0x38bdf8,emissive:0x0b5c88,emissiveIntensity:.25})); suctionPortMarker.position.copy(sp); suctionPortMarker.userData.partName='Suction port · '+(nz.suction||'not sized'); route.add(suctionPortMarker);
    var dischargePortMarker = new T.Mesh(new T.SphereGeometry(dr*1.18,12,10),new T.MeshStandardMaterial({color:0xfb7185,emissive:0x7f1d1d,emissiveIntensity:.2})); dischargePortMarker.position.copy(dp); dischargePortMarker.userData.partName='Discharge port · '+(nz.discharge||'not sized'); route.add(dischargePortMarker);
    built.group.add(route);
    var full = new T.CurvePath(); full.add(suction); if (built.flowPath) full.add(built.flowPath); full.add(discharge); built.flowPath = full;
    built.operating = op;
    return;

    var sn = built.ports.suctionNormal || new T.Vector3(-1, 0, 0);
    var dn = built.ports.dischargeNormal || new T.Vector3(0, 1, 0);
    var floor = Math.min(bounds.min.y - 0.16, -0.16);
    var delta = op.elevationDelta;
    // Sign is preserved; long plant elevations use a compact layout.
    var targetY = e.y + (delta === null ? 0.7 : Math.sign(delta) * Math.min(2.4, Math.log1p(Math.abs(delta)) * 0.45));
    var leftX = bounds.min.x - 1.5, rightX = bounds.max.x + 1.3;
    var nearS = s.clone().addScaledVector(sn, 0.5), nearD = e.clone().addScaledVector(dn, 0.5);
    var source = new T.Vector3(leftX, Math.max(floor + 0.5, s.y), 0.7);
    var target = new T.Vector3(rightX, targetY, 0.7);
    function path(points) {
      var result = new T.CurvePath();
      for (var i = 1; i < points.length; i++) if (points[i].distanceTo(points[i-1]) > 0.001)
        result.add(new T.LineCurve3(points[i-1], points[i]));
      return result;
    }
    function material(color, opacity) { return new T.MeshStandardMaterial({color:color,metalness:0.65,roughness:0.3,transparent:opacity<1,opacity:opacity,depthWrite:opacity===1}); }
    var steel = material(0xa2adb6, 0.28), dark = material(0x475765, 1);
    function tube(curve, radius) {
      var mesh = new T.Mesh(new T.TubeGeometry(curve, 72, radius, 12, false), steel);
      mesh.castShadow = true; mesh.userData.partName = 'Illustrative process pipework'; plant.add(mesh);
    }
    function pipeRadius(mm) { return number(mm) !== null && mm > 0 ? Math.max(0.045, Math.min(0.19, mm / 650)) : 0.09; }
    var nz = panel.nozzles || {};
    var suction = path([source, new T.Vector3(nearS.x, source.y, source.z), new T.Vector3(nearS.x, nearS.y, source.z), nearS, s]);
    var discharge = path([e, nearD, new T.Vector3(nearD.x, nearD.y, -0.85), new T.Vector3(rightX, nearD.y, -0.85), new T.Vector3(rightX, targetY, -0.85), target]);
    var submerged = panel.archetype.key === 'submersible' || panel.archetype.key === 'centrifugal-vertical';
    if (!submerged) tube(suction, pipeRadius(nz.suctionIdMm));
    tube(discharge, pipeRadius(nz.dischargeIdMm));
    // Cast valve bodies, bolted flanges and handwheel on the actual run.
    var valveAt=new T.Vector3((nearD.x+rightX)/2,nearD.y,-0.85);
    var vr=pipeRadius(nz.dischargeIdMm);
    var valve=new T.Group();valve.position.copy(valveAt);valve.userData.partName='XV-101 · discharge isolation valve';
    var body=new T.Mesh(new T.CylinderGeometry(vr*1.45,vr*1.45,0.38,24),material(0x176f69,1));body.rotation.z=Math.PI/2;valve.add(body);
    [-0.23,0.23].forEach(function(x){
      var flange=new T.Mesh(new T.CylinderGeometry(vr*1.9,vr*1.9,0.055,24),dark);flange.rotation.z=Math.PI/2;flange.position.x=x;valve.add(flange);
      for(var b=0;b<8;b++){var a=b*Math.PI/4;var bolt=new T.Mesh(new T.CylinderGeometry(0.022,0.022,0.08,6),dark);bolt.rotation.z=Math.PI/2;bolt.position.set(x,vr*1.6*Math.cos(a),vr*1.6*Math.sin(a));valve.add(bolt);}
    });
    var valveStem=new T.Mesh(new T.CylinderGeometry(0.025,0.025,0.4,12),dark);valveStem.position.y=0.25;valve.add(valveStem);
    var wheel=new T.Mesh(new T.TorusGeometry(0.17,0.02,10,32),material(0x253a44,1));wheel.rotation.x=Math.PI/2;wheel.position.y=0.46;valve.add(wheel);
    plant.add(valve);
    plant.add(label(T,'XV-101 · ISOLATION',valveAt.clone().add(new T.Vector3(0,0.88,0)),'#b6e4d6'));
    if (submerged) {
      // Open wet well, not a fictitious flanged suction line.
      source.copy(s).add(new T.Vector3(-0.7, 0, 0));
      suction = path([source, s]);
      var waterTop = Math.max(0.7, s.y + 0.35);
      var well = new T.Mesh(new T.CylinderGeometry(1.1,1.1,Math.max(0.3,waterTop-floor),40,1,true), material(0x8d9ca7,0.16));
      well.position.set(s.x,(waterTop+floor)/2,s.z); plant.add(well);
      var liquid = new T.Mesh(new T.CircleGeometry(1.05,40),new T.MeshStandardMaterial({color:op.color,transparent:true,opacity:0.23,side:T.DoubleSide,depthWrite:false}));
      liquid.rotation.x=-Math.PI/2; liquid.position.set(s.x,waterTop,s.z); plant.add(liquid);
    } else {
      var vessel = new T.Mesh(new T.CylinderGeometry(0.38,0.38,0.85,32,1,true),material(0x9cacb5,0.32));
      vessel.position.copy(source).add(new T.Vector3(-0.36,0.3,0)); plant.add(vessel);
      var closedTank = d.sourceType === 'closed_tank' || d.sourceType === 'pressurized';
      var liftTank = d.sourceType === 'open_lift';
      if(closedTank) {
        var head=new T.Mesh(new T.SphereGeometry(0.38,32,16,0,Math.PI*2,0,Math.PI/2),material(0x9cacb5,0.55));
        head.scale.y=0.5;head.position.copy(vessel.position).add(new T.Vector3(0,0.425,0));plant.add(head);
      }
      plant.add(label(T,closedTank ? 'V-101 · CLOSED TANK' : (liftTank ? 'TK-101 · OPEN TANK / SUCTION LIFT' : 'TK-101 · OPEN TANK / FLOODED SUCTION'),vessel.position.clone().add(new T.Vector3(0,1.2,0)),'#c8d5df'));
      var liquid2 = new T.Mesh(new T.CylinderGeometry(0.35,0.35,0.5,32),material(op.color,0.3));
      liquid2.position.copy(vessel.position).add(new T.Vector3(0,-0.16,0)); plant.add(liquid2);
    }
    [source, target].forEach(function(pt) {
      var h = pt.y-floor;
      if (h>0.2) {
        var support = new T.Mesh(new T.BoxGeometry(0.1,h,0.12),dark); support.position.set(pt.x,floor+h/2,pt.z); plant.add(support);
        var foot = new T.Mesh(new T.BoxGeometry(0.5,0.07,0.45),dark); foot.position.set(pt.x,floor,pt.z); plant.add(foot);
      }
    });
    // Inline pressure instruments and pipe flange collars.
    [nearS,nearD].forEach(function(pt, index) {
      var gauge = new T.Mesh(new T.CylinderGeometry(0.16,0.16,0.07,32),material(0xf3f5f6,1));
      gauge.rotation.x=Math.PI/2; gauge.position.copy(pt).add(new T.Vector3(0,0.34,0.16)); plant.add(gauge);
      var needle = new T.Mesh(new T.BoxGeometry(0.065,0.009,0.009),dark);
      var pressure = index ? d.dischargePressureBarG : d.suctionPressureBarA;
      var gaugeMax = Math.max(2, Math.ceil(Math.max(0, pressure || 0) * 1.5));
      var angle = Math.PI * 1.25 - Math.max(0, Math.min(1, (pressure || 0) / gaugeMax)) * Math.PI * 1.5;
      needle.position.copy(gauge.position).add(new T.Vector3(Math.cos(angle)*0.03,Math.sin(angle)*0.03,0.04)); needle.rotation.z=angle;
      needle.userData.partName = 'Pressure needle · ' + fmt(pressure,index?'bar(g)':'bar(a)') + ' · scale 0–' + gaugeMax;
      plant.add(needle);
      for(var tick=0;tick<=10;tick++) {
        var a=Math.PI*1.25-tick/10*Math.PI*1.5;
        var mark=new T.Mesh(new T.BoxGeometry(0.014,0.003,0.004),dark);
        mark.position.copy(gauge.position).add(new T.Vector3(Math.cos(a)*0.13,Math.sin(a)*0.13,0.04)); mark.rotation.z=a;plant.add(mark);
      }
      var stem=new T.Mesh(new T.CylinderGeometry(0.02,0.02,0.23,12),dark);
      stem.position.copy(pt).add(new T.Vector3(0,0.14,0.16));plant.add(stem);
    });
    var meter=new T.Mesh(new T.BoxGeometry(0.32,0.22,0.18),material(0x164e63,1));
    meter.position.copy(nearD).add(new T.Vector3(0.4,0.36,-0.1)); meter.userData.partName='Flow transmitter · '+fmt(d.Q_m3h,'m³/h'); plant.add(meter);
    plant.add(label(T,'FT-101 · '+fmt(d.Q_m3h,'m³/h'),meter.position.clone().add(new T.Vector3(0,0.35,0)),'#5eead4'));
    plant.add(label(T, (submerged?'WET WELL / INTAKE':'SUCTION') + '\n' + (submerged?'Open intake · calculated equivalent bore':(nz.suction||'Not sized')) + '\n' + fmt(d.suctionPressureBarA,'bar(a)')+' · '+fmt(op.suctionVelocity,'m/s'),source.clone().add(new T.Vector3(0,1.18,0)),'#38bdf8'));
    plant.add(label(T, 'DISCHARGE · '+(nz.discharge||'Not sized')+'\n'+fmt(d.dischargePressureBarG,'bar(g)')+' · '+fmt(op.dischargeVelocity,'m/s')+'\nDestination EL '+fmt(d.dischargeElevationM,'m'),target.clone().add(new T.Vector3(0,0.8,0)),'#fb9277'));
    var center = bounds.getCenter(new T.Vector3());
    plant.add(label(T, (d.fluidLabel || 'Process fluid') + ' · ' + fmt(d.Q_m3h, 'm³/h') + '\nHead ' + fmt(d.H_m, 'm') + ' · shaft ' + fmt(d.shaftKw, 'kW') + '\n' + (panel.familyId === 'aodd' ? 'Air driven · confirm supply with vendor' : 'Motor ' + fmt(d.motorKw, 'kW') + ' · ' + fmt(d.speedRpm, 'rpm', 0)), new T.Vector3(center.x, floor + 0.3, bounds.max.z + 0.65), '#e8bd61'));
    group.add(plant);
    var full = new T.CurvePath(); full.add(suction); if (built.flowPath) full.add(built.flowPath); full.add(discharge);
    built.flowPath = full; built.operating = op; built.pipeMaterial=steel;
    built.processPaths={suction:suction,discharge:discharge};
  }
  function animate(viewer, dt) {
    var rotor = viewer.rotorGroup, panel = viewer.operatingPanel;
    if (!rotor || !panel || !viewer.flowSimOn || !operatingData(panel).running) return;
    var speed = panel.familyId === 'aodd' ? 1 : Math.max(0.1, Math.min(2, (panel.dutyReadout.speedRpm || 2900) / 2900));
    viewer.mechanismPhase = (viewer.mechanismPhase || 0) + dt * 0.035 * speed;
    var phase = viewer.mechanismPhase, key = panel.archetype.key;
    rotor.children.forEach(function(child,index) {
      if (!child.userData.restPosition) { child.userData.restPosition=child.position.clone(); child.userData.restQuaternion=child.quaternion.clone(); }
      var rest = child.userData.restPosition;
      if (key === 'diaphragm' || key === 'reciprocating-piston') {
        child.position.x = rest.x + Math.sin(phase + (index%2)*Math.PI)*0.06;
      } else if (key === 'peristaltic') {
        var x=rest.x, y=rest.y-0.9;
        child.position.set(x*Math.cos(phase)-y*Math.sin(phase),0.9+x*Math.sin(phase)+y*Math.cos(phase),rest.z);
      } else {
        child.quaternion.copy(child.userData.restQuaternion);
        child.rotateY(phase * (index%2 && (key==='screw'||key==='gear-lobe-vane') ? -1:1));
      }
    });
  }
  function dispose(group) {
    if (!group) return;
    var geos = new Set(), mats = new Set(), textures = new Set();
    group.traverse(function(o) { if(o.geometry) geos.add(o.geometry); if(o.material) [].concat(o.material).forEach(function(m){mats.add(m); if(m.map) textures.add(m.map);}); });
    textures.forEach(function(t){t.dispose();}); mats.forEach(function(m){m.dispose();}); geos.forEach(function(g){g.dispose();});
  }
  window.AROPUMPOPERATING = {operatingData:operatingData,readout:readout,decorate:decorate,animate:animate,dispose:dispose};
})();
