/* Run with the site served locally: node tests/unit-converter.spec.js
   Optional ARO_UNIT_TEST_URL and ARO_BROWSER_PATH override the defaults. */
'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async()=>{
  const browser = await chromium.launch({headless:true,
    ...(process.env.ARO_BROWSER_PATH?{executablePath:process.env.ARO_BROWSER_PATH}:{})});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const page = await context.newPage();
    const base = process.env.ARO_UNIT_TEST_URL || 'http://127.0.0.1:8765/dist/';
    await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const floating=page.locator('#aro-unit-floating');
    await floating.waitFor({state:'visible'});
    await floating.click();
    const dialog=page.locator('#aro-unit-dialog');
    assert.equal(await dialog.evaluate(el=>el.open),true);
    assert.equal(await page.locator('#auc-property option').count(),66);
    // Exercise the delayed application enhancer before interacting. The old
    // selectOption-only checks missed body portals hidden by the modal layer.
    await page.evaluate(()=>window.AROPICK.scan());
    for(const id of ['auc-property','auc-from-unit','auc-to-unit']){
      assert.equal(await page.locator('#'+id).evaluate(el=>!!el.__aroPick),false,'converter must retain native selectors');
    }
    async function nativeChoice(id,symbol){
      const control=page.locator('#'+id);
      const index=await control.evaluate((el,s)=>Array.from(el.options).findIndex(o=>o.value===s),symbol);
      assert.ok(index>=0);
      await control.click(); // trusted mouse press; used to open an inert portal
      assert.equal(await page.locator('.aro-pick-pop').count(),0);
      await page.keyboard.press('Home');
      for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      assert.equal(await control.inputValue(),symbol);
    }
    await page.locator('#auc-from-value').fill('10');
    await nativeChoice('auc-to-unit','cm');
    assert.equal(await page.locator('#auc-to-value').inputValue(),'1000');
    await nativeChoice('auc-to-unit','ft');
    assert.ok(Math.abs(Number(await page.locator('#auc-to-value').inputValue())-32.80839895)<1e-8);
    await nativeChoice('auc-from-unit','cm');
    assert.ok(Math.abs(Number(await page.locator('#auc-to-value').inputValue())-.3280839895)<1e-9);
    await page.locator('#auc-to-value').fill('10');
    await nativeChoice('auc-from-unit','m');
    assert.equal(await page.locator('#auc-to-value').inputValue(),'10');
    assert.equal(await page.locator('#auc-from-value').inputValue(),'3.048');
    await nativeChoice('auc-to-unit','cm');
    assert.equal(await page.locator('#auc-to-value').inputValue(),'10');
    assert.equal(await page.locator('#auc-from-value').inputValue(),'0.1');
    // A genuine click must reset this utility without a design-reset prompt.
    await page.locator('#auc-search').fill('pressure');
    await page.locator('#auc-from-value').fill('10');
    await page.locator('#auc-precision').selectOption('15');
    await page.locator('#auc-reset').click();
    assert.equal(await page.locator('#aro-rg').count(),0);
    assert.equal(await page.locator('#auc-search').inputValue(),'');
    assert.equal(await page.locator('#auc-property').inputValue(),'length');
    assert.equal(await page.locator('#auc-from-unit').inputValue(),'m');
    assert.equal(await page.locator('#auc-to-unit').inputValue(),'mm');
    assert.equal(await page.locator('#auc-from-value').inputValue(),'0');
    assert.equal(await page.locator('#auc-to-value').inputValue(),'0');
    assert.equal(await page.locator('#auc-precision').inputValue(),'10');
    assert.equal(await page.locator('#auc-property option').count(),66);
    assert.equal(await page.evaluate(()=>window.ARORESETGUARD.isModuleReset(document.getElementById('pump-reset-btn'))),true,'design reset protection must remain active');
    await page.locator('#auc-property').selectOption('temperature');
    await page.locator('#auc-from-unit').selectOption('°C');
    await page.locator('#auc-to-unit').selectOption('°F');
    await page.locator('#auc-from-value').fill('100');
    assert.equal(await page.locator('#auc-to-value').inputValue(),'212');
    await page.locator('#auc-to-value').fill('32');
    assert.equal(await page.locator('#auc-from-value').inputValue(),'0');
    await page.locator('#auc-swap').click();
    assert.equal(await page.locator('#auc-from-unit').inputValue(),'°F');
    assert.equal(await page.locator('#auc-from-value').inputValue(),'32');
    await page.locator('#auc-from-value').fill('-500');
    assert.match(await page.locator('#auc-result').textContent(),/absolute zero/);
    assert.equal(await page.locator('#auc-copy').isDisabled(),true);
    await page.locator('#auc-search').fill('no-such-quantity');
    assert.equal(await page.locator('#auc-property option').count(),0);
    assert.match(await page.locator('#auc-result').textContent(),/No matching/);
    await page.locator('#auc-search').fill('viscosity');
    assert.equal(await page.locator('#auc-property option').count(),2);
    await page.locator('#auc-from-value').fill('1e3');
    await page.locator('#auc-from-unit').selectOption('cP');
    await page.locator('#auc-to-unit').selectOption('Pa·s');
    assert.equal(await page.locator('#auc-to-value').inputValue(),'1');
    await page.locator('#auc-from-value').fill('1,000');
    assert.match(await page.locator('#auc-result').textContent(),/no commas/);
    await page.locator('#auc-from-value').fill('0');
    assert.equal(await page.locator('#auc-to-value').inputValue(),'0');
    await page.keyboard.press('Escape');
    assert.equal(await dialog.evaluate(el=>el.open),false);
    assert.equal(await floating.evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Alt+u');
    assert.equal(await dialog.evaluate(el=>el.open),true);
    await page.locator('#auc-search').fill('');
    await page.locator('#auc-property').selectOption('pressure');
    await page.locator('#auc-from-unit').selectOption('bar');
    await page.locator('#auc-to-unit').selectOption('psi');
    await page.locator('#auc-from-value').fill('1');
    await page.screenshot({path:'/tmp/arogara-unit-converter-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    const bounds=await dialog.boundingBox();
    assert.ok(bounds.x>=0 && bounds.x+bounds.width<=390);
    assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false,'dialog horizontal overflow');
    await page.screenshot({path:'/tmp/arogara-unit-converter-mobile.png'});
    await page.locator('#auc-close').click();
    // Local-only demo session to test integration with each module toolbar.
    await page.addInitScript(()=>localStorage.setItem('aro_session_v1',JSON.stringify({name:'Local UI test',demo:true,verifiedAt:new Date().toISOString()})));
    await page.setViewportSize({width:1440,height:1000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#aro-unit-open').waitFor({state:'visible'});
    const before=await page.locator('#global-unit-system').inputValue();
    for(const id of ['project-tab','pump-tab','line-tab','sthe-tab','tank-tab','workbench-tab']){
      await page.locator(`.nav-tab[data-tab="${id}"]`).click();
      await page.locator('#aro-unit-open').click();
      assert.equal(await dialog.evaluate(el=>el.open),true);
      await page.locator('#auc-close').click();
    }
    assert.equal(await page.locator('#global-unit-system').inputValue(),before);
    await page.locator('#theme-mode').selectOption('dark');
    await page.locator('#aro-unit-open').click();
    assert.equal(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(17, 28, 48)');
    await page.screenshot({path:'/tmp/arogara-unit-converter-dark.png'});
    await page.locator('#auc-close').click();
    await page.locator('#theme-mode').selectOption('light');
    await page.setViewportSize({width:390,height:844});
    const headerOverflow=await page.locator('.terminal-header').evaluate(el=>el.scrollWidth>el.clientWidth);
    assert.equal(headerOverflow,false,'toolbar horizontal overflow');
    console.log('Unit converter UI passed: launcher, all six modules, reverse editing, swap, invalid inputs, search, Escape/focus, Alt+U, light/dark, mobile layout and global-unit isolation.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
