'use strict';
const assert = require('node:assert/strict');
const U = require('../lib/aro-unit-catalog');
function near(id,v,a,b,w,tol=1e-9){const got=U.convert(id,v,a,b);assert.ok(Math.abs(got-w)<=tol*Math.max(1,Math.abs(w)),`${id}: ${got} != ${w}`);}
// Independent reference examples and engineering basis distinctions.
near('length',1,'in','mm',25.4);
near('area',1,'ft²','m²',0.09290304);
near('volume',1,'US gal','L',3.785411784);
near('volume',1,'Imperial gal','L',4.54609);
near('mass',1,'lb','kg',0.45359237);
near('pressure',1,'psi','Pa',6894.757293168);
near('pressure',1,'atm','Torr',760);
near('force',1,'kgf','N',9.80665);
near('acceleration',1,'g₀','m/s²',9.80665);
near('temperature',32,'°F','°C',0);
near('temperature',100,'°C','°F',212);
near('temperature',-273.15,'°C','K',0);
near('temperature',491.67,'°R','K',273.15);
near('temperature-difference',18,'Δ°F','K',10);
near('dynamic-viscosity',1,'cP','Pa·s',.001);
near('kinematic-viscosity',1,'cSt','m²/s',1e-6,1e-14);
near('vol-flow',1,'US gpm','L/min',3.785411784);
near('mass-flow',3600,'kg/h','kg/s',1);
near('conductivity',1,'Btu (IT)/(h·ft·°F)','W/(m·K)',1.730735,1e-6);
near('heat-transfer',1,'Btu (IT)/(h·ft²·°F)','W/(m²·K)',5.678263,1e-6);
near('specific-heat',1,'Btu (IT)/(lb·°F)','J/(kg·K)',4186.8,1e-8);
near('fouling',1,'h·ft²·°F/Btu (IT)','m²·K/W',.176110183682,1e-10);
near('power',1,'hp (mechanical)','W',745.699871582);
near('power',1,'TR (12,000 Btu IT/h)','kW',3.516852842067);
near('energy',1,'kWh','MJ',3.6);
near('areal-mass',500,'g/m² (GSM)','kg/m²',.5);
near('molar-mass',18,'g/mol','lb/lbmol',18);
near('molar-flow',1,'lbmol/h','kmol/h',.45359237);
near('fraction',.001,'fraction','ppm',1000);
near('expansion',1,'1/°F','1/K',1.8);
near('charge',1000,'mAh','Ah',1);
assert.throws(()=>U.convert('temperature',-1,'K','°C'),/absolute zero/);
assert.throws(()=>U.convert('length',Infinity,'m','mm'),/finite/);
assert.throws(()=>U.convert('length',NaN,'m','mm'),/finite/);
assert.throws(()=>U.convert('length',1,'Pa','m'),/Unknown unit/);
assert.throws(()=>U.convert('vol-flow',1,'Nm³/h','m³/h'),/Unknown unit/);
assert.throws(()=>U.convert('pressure',1,'bar(g)','bar'),/Unknown unit/);
assert.throws(()=>U.convert('length',Number.MAX_VALUE,'km','m'),/numeric range/);
const ids = new Set();
let pairs=0;
for(const q of U.catalog){
  assert.ok(!ids.has(q.id));ids.add(q.id);
  assert.ok(q.units.some(u=>u.symbol===q.base && u.factor===1 && u.offset===0),q.id+' SI base');
  const symbols=new Set();
  for(const a of q.units){assert.ok(a.factor>0 && Number.isFinite(a.factor));assert.ok(!symbols.has(a.symbol));symbols.add(a.symbol);
    for(const b of q.units){const original=q.id==='temperature'?350:123.456;
      const value=U.convert(q.id,original,q.base,a.symbol);
      const target=U.convert(q.id,value,a.symbol,b.symbol);
      const back=U.convert(q.id,target,b.symbol,q.base);
      assert.ok(Math.abs(back-original)<1e-9*Math.max(1,original),q.id+' '+a.symbol+' → '+b.symbol);pairs++;
    }
  }
}
console.log(`Unit converter: reference cases, invalid inputs, ${U.catalog.length} properties and ${pairs} unit-pair round trips passed.`);
