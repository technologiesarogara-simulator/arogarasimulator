'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const server = spawn(process.env.PHE_TEST_PYTHON || 'python3', ['-m', 'http.server', '9306', '--directory', path.join(__dirname, '..')], { stdio: 'ignore' });
  let browser;
  try {
    await new Promise(r => setTimeout(r, 1500));
    browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:9306/index.html');
    await page.click('[data-launch]');
    if (await page.locator('#aro-demo-link').isVisible()) {
      await page.click('#aro-demo-link'); await page.fill('#aro-demo-code', 'ARO-DEV-2026'); await page.click('#aro-demo-btn');
    }
    await page.click('[data-tab="line-tab"]');
    for (const [type, id] of [['liquid','lq-fluid'], ['gas','gs-gas'], ['steam','st-w'], ['slurry','sl-carrier'], ['twophase','tp2-pair']]) {
      await page.click('[data-line-type="' + type + '"]');
      await page.locator('#fluid-guide-' + id).waitFor({state:'visible'});
      console.log('PASS fluid reference ' + type);
    }
    const result = await page.evaluate(() => [window.AROFLUIDPHASE.info('Caustic Soda (50%)'), window.AROFLUIDPHASE.info('Caustic Soda (20%)')]);
    if (!result[0] || result[1]) throw Error('Caustic concentration matching failed');
    console.log('PASS concentration matching');
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
