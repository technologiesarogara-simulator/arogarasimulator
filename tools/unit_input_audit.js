const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--use-gl=swiftshader'] });
  const pg = await (await b.newContext({viewport:{width:1600,height:1100}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('http://localhost:8765/index.html');
  await pg.evaluate(()=>localStorage.setItem('aro_session_v1',JSON.stringify({name:'D',email:'d@e.com',ts:Date.now()})));
  await pg.reload(); await pg.waitForTimeout(3800);
  await pg.evaluate(async ()=>{
    const nav=[...document.querySelectorAll('.nav-tab')].find(e=>/PUMP SIZING/.test(e.textContent)); nav.click();
    await new Promise(r=>setTimeout(r,300));
    const set=(id,v)=>{const e=document.getElementById(id); if(e){e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));}};
    set('pump-vol-flow-lhr',60000); set('pump-vessel-el',3); set('pump-lll',50); set('pump-centreline-el',0.5);
    set('pump-discharge-el',25); set('pump-dest-a',4); set('pump-temp-op',25); set('pump-vessel-press-g',0);
    set('pump-npshr',20); set('pump-npshr-process',20);
    const btn=[...document.querySelectorAll('button')].find(x=>/RUN|CALCULAT/i.test(x.textContent)); btn.click();
    await new Promise(r=>setTimeout(r,2400));
  });
  // capture every unit-tagged INPUT in SI, then check each conversion explicitly
  const base = await pg.evaluate(()=>{
    const o={}; document.querySelectorAll('input[data-unit-type]').forEach(e=>{
      if(!e.id) return; const v=parseFloat(e.value); if(isFinite(v)) o[e.id]={v, t:e.getAttribute('data-unit-type')};
    });
    const s=window.state.pump; return {inp:o, si:{npshr:s.inputs.npshr, npsha:s.results.npsha, rho:s.inputs.rho, H:s.results.diffHeadCal, bhp:s.results.bhp, sucDp:s.inputs.sucDp, disDp:s.inputs.dischDp, vp:s.inputs.pVapBarA}};
  });
  console.log('tagged inputs with values:', Object.keys(base.inp).length);
  const F = { 'length-m':{US:3.28084,CGS:100}, 'length-mm':{US:0.0393701,CGS:1}, 'pressure':{US:14.50377,CGS:1.019716},
    'press-drop':{US:14.50377,CGS:1.019716}, 'density':{US:0.0624280,CGS:0.001}, 'velocity':{US:3.28084,CGS:100},
    'temperature':{US:'F',CGS:'K'}, 'viscosity':{US:1,CGS:1}, 'mass-flow':{US:2.20462,CGS:1000}, 'vol-flow':{US:4.40287,CGS:1} };
  for (const sys of ['US','CGS']) {
    await pg.evaluate(async (sys)=>{const s=document.getElementById('global-unit-system'); s.value=sys; s.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,2800));}, sys);
    const now = await pg.evaluate(()=>{
      const o={}; document.querySelectorAll('input[data-unit-type]').forEach(e=>{ if(!e.id) return; const v=parseFloat(e.value); if(isFinite(v)) o[e.id]=v; });
      const s=window.state.pump; return {inp:o, si:{npshr:s.inputs.npshr, npsha:s.results.npsha, rho:s.inputs.rho, H:s.results.diffHeadCal, bhp:s.results.bhp, sucDp:s.inputs.sucDp, disDp:s.inputs.dischDp, vp:s.inputs.pVapBarA}};
    });
    const badField=[], badSI=[];
    Object.keys(base.inp).forEach(id=>{
      const {v,t}=base.inp[id]; const got=now.inp[id]; if(got==null) return;
      if (Math.abs(v) < 1e-9) return;   // blank/zero baseline: nothing to convert
      const f=F[t]&&F[t][sys];
      let exp;
      if (f==='F') exp=v*9/5+32; else if (f==='K') exp=v+273.15; else if (typeof f==='number') exp=v*f; else return;
      if (Math.abs(exp-got) > Math.max(1e-6, Math.abs(exp)*0.005)) badField.push(id+'('+t+'): '+v+' -> '+got+' expected '+exp.toFixed(4));
    });
    Object.keys(base.si).forEach(k=>{ const a=base.si[k], c=now.si[k];
      if(typeof a==='number'&&typeof c==='number'&&Math.abs(a-c)>Math.max(1e-9,Math.abs(a)*0.002)) badSI.push(k+': '+a+' -> '+c); });
    console.log(sys.padEnd(4), 'field conversions:', badField.length?('WRONG '+JSON.stringify(badField)):'all correct',
                '| internals:', badSI.length?('DRIFT '+JSON.stringify(badSI)):'unchanged');
    await pg.evaluate(async ()=>{const s=document.getElementById('global-unit-system'); s.value='SI'; s.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,2200));});
  }
  console.log('ERRS', errs.slice(0,3));
  await b.close();
})();
