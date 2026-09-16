/* Pure geometry and duty regressions: no browser or external dependencies. */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.window=global;
global.THREE=require('../lib/three.min.js');
global.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
require('../lib/aro-pumpstandard.js');
require('../lib/aro-pumplivepanel.js');
require('../lib/aro-pumpoperating.js');
const source=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8');
vm.runInThisContext(source.slice(source.indexOf('  var PUMP_CASE_COLOR ='),source.indexOf('  function initPumpLiveViewer3D(container)')));
const duty={Q_m3h:110,H_m:48,motorKw:22,suctionPressureBarA:1.2,dischargePressureBarG:5,pumpElevationM:1,dischargeElevationM:25,temperatureC:40,densityKgM3:992,viscosityCp:0.7,hydraulicKw:14.2,shaftKw:19,speedRpm:2900,npshaM:8,npshrM:3,fluidLabel:'Water'};
const nozzles={suction:'DN150',discharge:'DN100',suctionIdMm:154.1,dischargeIdMm:102.3};
for(const family of AROPUMPSTANDARD.ROWS){
  const panel=AROPUMPLIVEPANEL.buildLivePumpPanelData({familyId:family.id,duty,nozzles});
  const built=pumpLiveArchetypeMesh(panel.archetype.key,family.id,{motorKw:22,sucIdMm:154.1,disIdMm:102.3});
  assert(built.ports.suction && built.ports.discharge,family.id+' missing ports');
  AROPUMPOPERATING.decorate(panel,built);
  let meshes=0;
  built.group.traverse(o=>{if(o.geometry){meshes++;const a=o.geometry.attributes.position.array;assert([...a].every(Number.isFinite),family.id+' invalid vertices');}});
  assert(meshes>10); assert(built.flowPath && built.flowPath.getLength()>0);
  for(let i=0;i<=30;i++) assert(built.flowPath.getPointAt(i/30).toArray().every(Number.isFinite));
  const v={rotorGroup:built.rotor,operatingPanel:panel,flowSimOn:true};
  AROPUMPOPERATING.animate(v,1);
  built.rotor.children.forEach(c=>assert(c.position.toArray().every(Number.isFinite)));
  v.flowSimOn=false;const before=built.rotor.children.map(c=>c.position.clone());AROPUMPOPERATING.animate(v,3);
  before.forEach((p,i)=>assert(p.equals(built.rotor.children[i].position)));
  AROPUMPOPERATING.dispose(built.group);
  console.log('PASS geometry, flow, motion: '+family.id);
}
const panel=AROPUMPLIVEPANEL.buildLivePumpPanelData({familyId:'esc-oh2',duty,nozzles});
assert.equal(panel.dutyReadout.suctionPressureBarA,1.2);
assert.equal(panel.dutyReadout.shaftKw,19);
assert.equal(AROPUMPOPERATING.operatingData(panel).elevationDelta,24);
const velocity=110/3600/(Math.PI*(0.1023**2)/4);
assert(Math.abs(AROPUMPOPERATING.operatingData(panel).dischargeVelocity-velocity)<1e-10);
assert(!AROPUMPOPERATING.operatingData({dutyReadout:{Q_m3h:0}}).running);
assert.equal(AROPUMPOPERATING.operatingData({dutyReadout:{Q_m3h:10},nozzles:{dischargeIdMm:null}}).dischargeVelocity,null);
assert.equal(AROPUMPLIVEPANEL.buildLivePumpPanelData({familyId:'esc-oh2',duty:{motorKw:null}}).dutyReadout.motorKw,null);
assert(AROPUMPOPERATING.operatingData({dutyReadout:{fluidLabel:'Water'}}).color!==AROPUMPOPERATING.operatingData({dutyReadout:{fluidLabel:'Crude Oil'}}).color);
console.log('PASS operating data: velocities, power, elevation, zero flow, missing values and fluid tint');

