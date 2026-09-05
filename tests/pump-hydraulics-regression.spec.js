/* ══════════════════════════════════════════════════════════════════════
   PHASE 1 REGRESSION — live DOM integration test for the Pump Hydraulics
   calculation engine (runActualPumpCalculations in app.js).

   Drives the real Pump tab through a local static server exactly like a
   user would, using the reference cases locked into
   tests/fixtures/pump-reference-cases.json, and asserts the live
   window.state.pump.results match the captured baseline within tolerance.

   This guards the large inline DOM-embedded calculation path that the
   pure-calc unit tests (pump-pure-calc.test.js) cannot reach, since that
   path reads dozens of form fields directly rather than going through
   AROPUMPSTD/AROPUMPCURVE/AROVP alone.

   Run:  node tests/pump-hydraulics-regression.spec.js
   Requires: a free TCP port for a throwaway http.server instance (picked
   automatically), and the Playwright Chromium build already present in
   this environment (PLAYWRIGHT_BROWSERS_PATH).
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const FIXTURE = require(path.join(__dirname, 'fixtures', 'pump-reference-cases.json'));
const CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function startServer(port) {
  return new Promise((resolve, reject) => {
    const srv = spawn('python3', ['-m', 'http.server', String(port), '--directory', ROOT], { stdio: 'pipe' });
    let started = false;
    const onData = (d) => {
      if (!started && /Serving HTTP/i.test(d.toString())) { started = true; resolve(srv); }
    };
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
    el.dispatchEvent(new Event('input'));
    el.dispatchEvent(new Event('change'));
  }, { id, val });
}

function checkField(name, actual, expected, failures) {
  if (expected && typeof expected === 'object' && 'value' in expected) {
    const tol = expected.tol || 0;
    if (typeof actual !== 'number' || Math.abs(actual - expected.value) > tol) {
      failures.push(`${name}: expected ${expected.value} (tol ${tol}), got ${actual}`);
    }
  } else if (actual !== expected) {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

(async () => {
  const port = 9301;
  console.log('Starting static server on port ' + port + ' ...');
  const server = await startServer(port);

  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  let totalPass = 0, totalFail = 0;
  const shotDir = path.join(__dirname, '..', '.regression-screens');
  fs.mkdirSync(shotDir, { recursive: true });

  try {
    for (const testCase of FIXTURE.cases) {
      const page = await browser.newPage({ viewport: { width: 1700, height: 1050 } });
      const consoleErrors = [];
      page.on('pageerror', (err) => consoleErrors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const t = msg.text();
          if (!/ERR_CONNECTION_RESET|ERR_TUNNEL_CONNECTION_FAILED/.test(t)) consoleErrors.push(t);
        }
      });

      await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);
      await page.click('text=Launch Engineering Platform');
      await page.waitForTimeout(1200);
      await page.click('#aro-demo-link');
      await page.waitForTimeout(400);
      await page.fill('#aro-demo-code', 'ARO-DEV-2026');
      await page.click('#aro-demo-btn');
      await page.waitForTimeout(3500);

      for (const [id, val] of Object.entries(testCase.inputs)) {
        await setVal(page, id, val);
      }
      await page.waitForTimeout(500);

      await page.evaluate(() => {
        const form = document.getElementById('pump-form');
        if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
      });
      await page.waitForTimeout(1500);

      const shotPath = path.join(shotDir, `${testCase.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      const live = await page.evaluate(() => {
        const s = window.state && window.state.pump;
        if (!s || !s.results) return null;
        const r = s.results;
        const npshCheck = r.stdChecks ? r.stdChecks.find((c) => c.key === 'npsh') : null;
        return {
          npsha: r.npsha, npshMargin: r.npshMargin, diffHeadCal: r.diffHeadCal,
          pumpDp: r.pumpDp, hydPower: r.hydPower, bhp: r.bhp, mhp: r.mhp,
          stdMotorKw: r.stdMotorKw, motorLoading: r.motorLoading,
          cavText: r.cavText, cavType: r.cavType, headInvalid: r.headInvalid,
          Ns: r.Ns, Nss: r.Nss,
          sucNozzleNps: r.sucNozzle ? r.sucNozzle.nps : undefined,
          disNozzleNps: r.disNozzle ? r.disNozzle.nps : undefined,
          opQ: r.opQ, opPctBep: r.opPctBep,
          pVapBarA: r.pVapBarA,
          allStdChecksOk: r.stdChecks ? r.stdChecks.every((c) => c.ok) : null,
          npshCheckOk: npshCheck ? npshCheck.ok : null,
        };
      });

      console.log(`\n── ${testCase.name} ──`);
      if (!live) {
        console.log('  FAIL  window.state.pump.results is missing entirely');
        totalFail++;
        await page.close();
        continue;
      }
      if (consoleErrors.length) {
        console.log('  Console/page errors during run:', consoleErrors);
      }

      const failures = [];
      for (const [key, expected] of Object.entries(testCase.expect)) {
        checkField(key, live[key], expected, failures);
      }

      if (failures.length === 0) {
        console.log(`  OK    all ${Object.keys(testCase.expect).length} fields match baseline (screenshot: ${shotPath})`);
        totalPass++;
      } else {
        console.log(`  FAIL  ${failures.length} field(s) mismatched:`);
        failures.forEach((f) => console.log('        - ' + f));
        totalFail++;
      }

      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(`\n${totalPass} case(s) passed, ${totalFail} case(s) failed`);
  process.exit(totalFail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
