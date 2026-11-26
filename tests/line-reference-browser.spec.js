/* Smoke-test the shared reference from each line-sizing panel. */
'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async function () {
  const server = spawn(process.env.PHE_TEST_PYTHON || 'python3', ['-m', 'http.server', '9304', '--directory', path.join(__dirname, '..')], { stdio: 'ignore' });
  let browser;
  try {
    await new Promise(resolve => setTimeout(resolve, 1500));
    browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto('http://localhost:9304/index.html', { waitUntil: 'domcontentloaded' });
    await page.click('[data-launch]');
    if (await page.locator('#aro-demo-link').count()) {
      await page.click('#aro-demo-link');
      await page.fill('#aro-demo-code', 'ARO-DEV-2026');
      await page.click('#aro-demo-btn');
    }
    await page.click('[data-tab="line-tab"]');
    for (const type of ['liquid', 'gas', 'steam', 'slurry', 'twophase']) {
      await page.click('[data-line-type="' + type + '"]');
      await page.waitForTimeout(500);
      await page.click('#aro-eb-lineref');
      await page.getByText('TWO-PHASE PATTERNS', { exact: false }).waitFor({ state: 'visible' });
      console.log('PASS reference opens for ' + type);
      await page.keyboard.press('Escape');
    }
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
