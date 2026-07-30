const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--use-gl=swiftshader'] });
  const pg = await (await b.newContext({viewport:{width:1600,height:1100}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('http://localhost:8765/index.html');
  await pg.evaluate(()=>localStorage.setItem('aro_session_v1',JSON.stringify({name:'D',email:'d@e.com',ts:Date.now()})));
  await pg.reload(); await pg.waitForTimeout(4000);
  // run every module once so each has state
  await pg.evaluate(async ()=>{
    const clickTab=async re=>{const n=[...document.querySelectorAll('.nav-tab')].find(e=>new RegExp(re,'i').test(e.textContent)); if(n){n.click(); await new Promise(r=>setTimeout(r,700));}};
    const set=(id,v)=>{const e=document.getElementById(id); if(e){e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));}};
    await clickTab('PUMP SIZING');
    set('pump-vol-flow-lhr',60000); set('pump-vessel-el',3); set('pump-lll',50); set('pump-centreline-el',0.5);
    set('pump-discharge-el',25); set('pump-dest-a',4); set('pump-temp-op',25); set('pump-npshr',20);
    let bt=[...document.querySelectorAll('button')].find(x=>/RUN|CALCULAT/i.test(x.textContent)&&x.offsetParent); if(bt) bt.click();
    await new Promise(r=>setTimeout(r,2200));
    for (const t of ['LINE SIZING','HEAT EXCHANGER','TANK DESIGN']) {
      await clickTab(t);
      const bs=[...document.querySelectorAll('button')].filter(x=>/RUN|CALCULAT/i.test(x.textContent)&&x.offsetParent);
      for (const x of bs.slice(0,2)) { x.click(); await new Promise(r=>setTimeout(r,1600)); }
    }
    await clickTab('PUMP SIZING');
  });
  const snap = ()=> pg.evaluate(()=>{
    const flat={}; const walk=(o,pre,d)=>{ if(!o||d>2) return;
      Object.keys(o).forEach(k=>{ const v=o[k];
        if (typeof v==='number' && isFinite(v)) flat[pre+k]=v;
        else if (v && typeof v==='object' && !Array.isArray(v)) walk(v,pre+k+'.',d+1); }); };
    const s=window.state||{};
    Object.keys(s).forEach(m=>walk(s[m], m+'.', 0));
    ['AROTP','AROTANK','AROPHE','AROLINE'].forEach(g=>{ try{ const o=window[g]&&window[g].last&&window[g].last(); if(o) walk(o,g+'.',0);}catch(e){} });
    return {sys:window.activeUnitSystem, flat};
  });
  const base = await snap();
  console.log('internal SI values captured:', Object.keys(base.flat).length);
  for (const sys of ['US','CGS']) {
    await pg.evaluate(async (sys)=>{const s=document.getElementById('global-unit-system'); s.value=sys; s.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,3200));}, sys);
    const now = await snap();
    const drift=[];
    Object.keys(base.flat).forEach(k=>{ const a=base.flat[k], c=now.flat[k];
      if (typeof c==='number' && Math.abs(a-c) > Math.max(1e-9, Math.abs(a)*0.002)) drift.push(k+': '+a.toPrecision(6)+' -> '+c.toPrecision(6)); });
    console.log(sys.padEnd(4), drift.length? ('DRIFT '+drift.length+' of '+Object.keys(base.flat).length+': '+JSON.stringify(drift.slice(0,10))) : ('all '+Object.keys(base.flat).length+' internal values unchanged'));
    await pg.evaluate(async ()=>{const s=document.getElementById('global-unit-system'); s.value='SI'; s.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,2500));});
  }
  console.log('ERRS', errs.slice(0,4));
  await b.close();
})();
