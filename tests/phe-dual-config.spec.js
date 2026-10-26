/* Test PHE dual configuration (analytical + industrial standard) */
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

function startServer(port) {
  return new Promise((resolve, reject) => {
    const srv = spawn('python3', ['-m', 'http.server', String(port), '--directory', ROOT], { stdio: 'pipe' });
    let started = false;
    const onData = (d) => { if (!started && /Serving HTTP/i.test(d.toString())) { started = true; resolve(srv); } };
    srv.stdout.on('data', onData);
    srv.stderr.on('data', onData);
    srv.on('error', reject);
    setTimeout(() => { if (!started) { started = true; resolve(srv); } }, 1500);
  });
}

async function setVal(page, id, val) {
  await page.evaluate(({ id, val }) => {
    const el = document.getElementById(id);
    if (!el) throw new Error('MISSING FIELD: ' + id);
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { id, val });
}

const results = [];
function report(name, expected, actual, pass, errors) {
  results.push({ name, expected, actual, pass, errors: errors || [] });
  console.log((pass ? '  PASS ' : '  FAIL ') + name
    + (pass ? '' : `\n       expected: ${expected}\n       actual:   ${actual}`));
}

(async () => {
  const port = 9303;
  console.log('Starting static server on port ' + port + ' ...');
  const server = await startServer(port);
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });

  try {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
    let consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push('EXCEPTION: ' + err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text();
        if (!/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED/.test(t)) consoleErrors.push('CONSOLE: ' + t);
      }
    });

    await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.click('[data-launch]');
    await page.waitForTimeout(1000);
    
    // Navigate to PHE tab
    const pheTab = await page.$('[data-panel="phe"]');
    if (pheTab) {
      await pheTab.click();
      await page.waitForTimeout(800);
    } else {
      console.log('Warning: PHE tab not found');
    }

    // Enter test values
    const inputs = {
      'phe-hf-m': '10',
      'phe-cf-m': '15',
      'phe-hf-tin': '90',
      'phe-cf-tin': '30',
      'phe-hf-tout': '50',
      'phe-cf-tout': '60'
    };
    for (const [id, val] of Object.entries(inputs)) {
      const el = await page.$(`#${id}`);
      if (el) await setVal(page, id, val);
    }
    await page.waitForTimeout(300);

    // Click RUN button
    const runBtn = await page.$('#phe-calc');
    if (runBtn) {
      await runBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check if DUAL CONFIG button exists
    const dualConfigBtn = await page.$('[data-phe-dual-config]');
    report(
      'DUAL CONFIG button exists',
      'button with data-phe-dual-config attribute',
      dualConfigBtn ? 'found' : 'not found',
      !!dualConfigBtn, consoleErrors
    );

    // Click DUAL CONFIG button
    if (dualConfigBtn) {
      await dualConfigBtn.click();
      await page.waitForTimeout(1500);

      // Check if industrial results section appears
      const indResults = await page.evaluate(() => {
        const el = document.querySelector('#phe-results');
        if (!el) return null;
        return el.innerHTML.includes('INDUSTRIAL STANDARD DESIGN') ? 'found' : 'not found';
      });

      report(
        'Industrial results section displayed after dual config toggle',
        'INDUSTRIAL STANDARD DESIGN text visible',
        indResults,
        indResults === 'found', []
      );

      // Check that analytical results still visible
      const analyticalStill = await page.evaluate(() => {
        const el = document.querySelector('#phe-results');
        if (!el) return null;
        return el.innerHTML.includes('AUTO-CALCULATED THERMAL') ? 'found' : 'not found';
      });

      report(
        'Analytical results still visible when dual config active',
        'AUTO-CALCULATED THERMAL text visible',
        analyticalStill,
        analyticalStill === 'found', []
      );
    }

  } finally {
    await browser.close();
    server.kill();
  }

  const pass = results.filter((r) => r.pass).length, fail = results.length - pass;
  console.log(`\n${pass} passed, ${fail} failed (of ${results.length})\n`);
  if (fail > 0) {
    console.log('FAILURES:');
    results.filter((r) => !r.pass).forEach((r) => console.log(`  - ${r.name}`));
  }
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1); });
