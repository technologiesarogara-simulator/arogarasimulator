'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.window=global;global.THREE=require('../lib/three.min.js');
const ctx=new Proxy({measureText:t=>({width:t.length*18}),createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:()=>{}});
global.document={readyState:'loading',addEventListener(){},createElement:()=>({getContext:()=>ctx})};
global.addEventListener=()=>{};
require('../lib/aro-parts3d.js');
let src=fs.readFileSync(require.resolve('../lib/aro-industrial3d.js'),'utf8');
src=src.replace('window.ARO3DI = {','window.testPumpAssembly=function(d){three();return REG.pump.assembly(d,2);}; window.ARO3DI = {');
vm.runInThisContext(src);
for(const bore of [0.025,0.1143,0.1683])for(const dz of [0,10,100]) {
  const asm=testPumpAssembly({kw:18.5,Q:100,H:40,sucOd:bore,disOd:bore,sucNps:'4',disNps:'4',dz,tag:'P-101',rpm:2900});
  assert.equal(asm.multiRoute.length,2);
  const s=asm.multiRoute[0].pts,d=asm.multiRoute[1].pts;
  assert(s.at(-1).distanceTo(d[0])<1e-10,'flow must meet at impeller eye');
  for(let i=1;i<s.length;i++){
    assert(s[i].x>=s[i-1].x,'suction must flow toward pump');
    assert(Math.abs(s[i].y-s[0].y)<1e-10,'suction must remain on pipe axis');
  }
  // The discharge may rise and turn, but must never jump back to suction.
  for(let i=1;i<d.length;i++)assert(d[i].x>=d[i-1].x-1e-9 && d[i].y>=d[i-1].y-1e-9);
  const elbow=asm.items.find(p=>p.kind==='ELBOW');
  const arc=d.filter(p=>p.x>elbow.group.position.x-elbow.R+1e-8 && p.x<elbow.group.position.x-1e-8);
  assert(arc.length>=22);
  arc.forEach(p=>assert(Math.abs(p.distanceTo(elbow.group.position)-elbow.R)<1e-7,'flow follows elbow centreline'));
}
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const start=app.indexOf('function updatePumpParticlePosition('),end=app.indexOf('function resetLineParticle',start);
vm.runInThisContext(app.slice(start,end));
global.pump3D={flowPath:new THREE.LineCurve3(new THREE.Vector3(-1,2,0),new THREE.Vector3(2,5,0))};
for(const t of [0,.2,.5,.8,1]){let p={position:new THREE.Vector3(),pathProgress:t};updatePumpParticlePosition(p);assert(p.position.distanceTo(pump3D.flowPath.getPointAt(t))<1e-10);}
console.log('PASS pump assembly: suction direction, joined impeller route, elbow containment, bore/elevation changes, analytical path tracking');
