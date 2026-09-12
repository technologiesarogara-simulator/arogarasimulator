/* ══════════════════════════════════════════════════════════════════════
   PUMP 3D ENGINE — internal developer test suite (spec Phase 9)

   Live DOM/WebGL integration test for the "SELECTED PUMP — LIVE 3D,
   FABRICATION & DUTY" viewer (pumpLiveArchetypeMesh / updatePumpLiveViewer3D
   in app.js). For every one of the 23 real PUMP_SELECTION_STANDARD
   families this drives the actual running app through a local static
   server — the same way pump-hydraulics-regression.spec.js already does
   for the hydraulics engine — and checks:

     - the family loads and its 3D group actually has geometry (no empty
       group, no missing mesh)
     - the model's own bounding box has finite, positive, non-degenerate
       dimensions (catches NaN/undefined creeping into any archetype
       branch's coordinates)
     - the viewer's cached familyId matches what was actually selected
       (no stale geometry left over from the previous family)
     - no browser console errors or exceptions were thrown while building
       that family's mesh
     - the panel title updates to name the newly selected family

   Then, separately (not per-family — these are viewer-wide behaviors):
     - switching flow rate on the SAME family invalidates the mesh cache
       (the real fix for "duty changes should update the 3D model, not
       leave stale geometry" — see the dimsKey addition in app.js)
     - the CUTAWAY VIEW checkbox actually flips the casing material's
       transparency
     - the camera-preset buttons (front/left/top/bottom/iso/reset) change
       the camera's spherical radius/angle
     - click-to-inspect resolves a real part name when clicking the model,
       and does NOT fire after a drag

   This does NOT re-check hydraulics correctness (that is
   pump-hydraulics-regression.spec.js's job) and does NOT assert exact
   pixel appearance — "passed" here means "real geometry with no errors",
   consistent with the rest of this app's console-quiet-app convention,
   not "looks right", which stays a manual/screenshot check.

   Run:  node tests/pump-3d-render.spec.js
   Requires: a free TCP port for a throwaway http.server instance, and the
   Playwright Chromium build already present in this environment.
   Not wired into `npm test` (same reason pump-hydraulics-regression.spec.js
   isn't — it needs a real browser/WebGL context, not just Node).
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const ALL_FAMILY_IDS = [
  'esc-oh2', 'split-case', 'self-priming-centrifugal', 'canned-motor-centrifugal', 'mag-drive',
  'vs-turbine-deepwell', 'axial-mixed-flow',
  'submersible-dewatering', 'submersible-sewage', 'submersible-borehole', 'submersible-slurry',
  'screw-pump', 'gear-external', 'gear-internal', 'lobe-rotary', 'vane-pump',
  'pc-pump', 'peristaltic-hose',
  'plunger-pump', 'piston-pump',
  'diaphragm-mechanical', 'diaphragm-metering', 'aodd'
];

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

const results = []; // { name, expected, actual, pass, errors, limitations }
function report(name, expected, actual, pass, errors, limitations) {
  results.push({ name, expected, actual, pass, errors: errors || [], limitations: limitations || '' });
  console.log((pass ? '  PASS ' : '  FAIL ') + name
    + (pass ? '' : `\n       expected: ${expected}\n       actual:   ${actual}`));
}

(async () => {
  const port = 9302;
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
    await page.click('#aro-demo-link');
    await page.waitForTimeout(400);
    await page.fill('#aro-demo-code', 'ARO-DEV-2026');
    await page.click('#aro-demo-btn');
    await page.waitForTimeout(2500);

    await page.evaluate(() => { document.querySelectorAll('details.pump-accordion').forEach((d) => { d.open = true; }); });

    const baseInputs = {
      'pump-fluid': 'water', 'pump-vol-flow-lhr': '50000', 'pump-temp-op': '25',
      'pump-vessel-press-g': '0', 'pump-vessel-el': '2', 'pump-lll': '20',
      'pump-centreline-el': '0', 'pump-npshr': '3', 'pump-dest-a': '3', 'pump-discharge-el': '15'
    };
    for (const [id, val] of Object.entries(baseInputs)) await setVal(page, id, val);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const form = document.getElementById('pump-form');
      if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const r = document.getElementById('pump-results'); if (r) r.style.setProperty('display', 'flex', 'important'); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { document.getElementById('pump-livepanel-3d').scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(300);

    const availableIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-flow-pick][data-decision="family"]')).map((b) => b.getAttribute('data-pick-id'))
    );
    report(
      'Family chip list covers exactly the 23 real families',
      '23 ids, no extras, no missing',
      availableIds.length + ' ids found',
      ALL_FAMILY_IDS.every((id) => availableIds.includes(id)) && availableIds.length === ALL_FAMILY_IDS.length,
      [], availableIds.length !== ALL_FAMILY_IDS.length ? 'ALL_FAMILY_IDS in this test may be stale vs FAMILY_TO_ARCHETYPE — check both if this fails.' : ''
    );

    // ── Per-family: load, verify real geometry, no stale cache, no errors ──
    for (const familyId of ALL_FAMILY_IDS) {
      consoleErrors = [];
      const clicked = await page.evaluate((fid) => {
        const btn = document.querySelector('[data-flow-pick][data-decision="family"][data-pick-id="' + fid + '"]');
        if (btn) { btn.click(); return true; }
        return false;
      }, familyId);
      await page.waitForTimeout(650);

      const state = await page.evaluate(() => {
        var v = window.pumpLiveViewer3D;
        if (!v || !v.currentGroup) return { ok: false, reason: 'no currentGroup' };
        var box = new THREE.Box3().setFromObject(v.currentGroup);
        var size = box.getSize(new THREE.Vector3());
        var finite = isFinite(size.x) && isFinite(size.y) && isFinite(size.z);
        return {
          ok: true,
          familyId: v.familyId,
          childCount: v.currentGroup.children.length,
          sizeFinite: finite,
          sizeNonDegenerate: finite && size.x > 0.01 && size.y > 0.01 && size.z > 0.01,
          titleText: (document.getElementById('pump-livepanel-title') || {}).textContent || ''
        };
      });

      const pass = clicked && state.ok && state.familyId === familyId
        && state.childCount > 0 && state.sizeFinite && state.sizeNonDegenerate
        && consoleErrors.length === 0 && state.titleText.trim().length > 0;
      report(
        `3D mesh for family "${familyId}"`,
        'clicked=true, currentGroup non-empty, familyId matches, finite non-degenerate bbox, title set, 0 console errors',
        JSON.stringify({ clicked, ...state, consoleErrors }),
        pass, consoleErrors
      );
    }

    // ── Duty change on the SAME family must not leave stale geometry ──
    await page.evaluate(() => { const btn = document.querySelector('[data-flow-pick][data-decision="family"][data-pick-id="esc-oh2"]'); if (btn) btn.click(); });
    await page.waitForTimeout(600);
    const dimsKeyBefore = await page.evaluate(() => window.pumpLiveViewer3D.dimsKey);
    await setVal(page, 'pump-vol-flow-lhr', '400000');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const form = document.getElementById('pump-form');
      if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    await page.waitForTimeout(1200);
    // Re-select the SAME family explicitly (Section 10 may have re-ranked to a different top pick at this new flow)
    await page.evaluate(() => { const btn = document.querySelector('[data-flow-pick][data-decision="family"][data-pick-id="esc-oh2"]'); if (btn) btn.click(); });
    await page.waitForTimeout(600);
    const dimsKeyAfter = await page.evaluate(() => window.pumpLiveViewer3D.dimsKey);
    report(
      'Recalculating with a much larger flow on the same family updates the cached dims key (no stale 3D geometry)',
      'dimsKeyAfter !== dimsKeyBefore',
      `before="${dimsKeyBefore}" after="${dimsKeyAfter}"`,
      dimsKeyAfter !== dimsKeyBefore, []
    );

    // ── Cutaway toggle actually flips material transparency ──
    const cutawayBefore = await page.evaluate(() => window.pumpLiveViewer3D.caseMat.transparent);
    await page.evaluate(() => {
      const cb = document.getElementById('pump-3d-cutaway');
      cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const cutawayAfter = await page.evaluate(() => window.pumpLiveViewer3D.caseMat.transparent);
    report(
      'CUTAWAY VIEW checkbox flips casing material transparency',
      'false -> true',
      `${cutawayBefore} -> ${cutawayAfter}`,
      cutawayBefore === false && cutawayAfter === true, []
    );
    // uncheck for the rest of the run
    await page.evaluate(() => {
      const cb = document.getElementById('pump-3d-cutaway');
      cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // ── Camera preset buttons actually move the camera ──
    const camBefore = await page.evaluate(() => ({
      theta: window.pumpLiveViewer3D.controls.targetSpherical.theta,
      phi: window.pumpLiveViewer3D.controls.targetSpherical.phi
    }));
    await page.evaluate(() => { document.querySelector('[data-pump3d-target="livepanel"][data-pump3d-view="top"]').click(); });
    await page.waitForTimeout(200);
    const camAfter = await page.evaluate(() => ({
      theta: window.pumpLiveViewer3D.controls.targetSpherical.theta,
      phi: window.pumpLiveViewer3D.controls.targetSpherical.phi
    }));
    report(
      'TOP camera-preset button changes the orbit angle',
      'phi moves toward ~0 (looking straight down)',
      JSON.stringify({ camBefore, camAfter }),
      Math.abs(camAfter.phi) < 0.1 && camAfter.phi !== camBefore.phi, []
    );

    // ── RESET re-fits without crashing ──
    await page.evaluate(() => { document.querySelector('[data-pump3d-target="livepanel"][data-pump3d-reset]').click(); });
    await page.waitForTimeout(200);
    const afterReset = await page.evaluate(() => isFinite(window.pumpLiveViewer3D.camera.position.length()));
    report('RESET button re-fits the camera without producing NaN/invalid position', 'finite camera position', String(afterReset), afterReset, []);

    // ── Click-to-inspect resolves a real part name ──
    const canvasBox = await page.locator('#pump-livepanel-3d canvas').boundingBox();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);
    await page.waitForTimeout(300);
    let inspectInfo = await page.evaluate(() => { const el = document.getElementById('pump-livepanel-3d-info'); return { text: el.textContent, visible: el.style.display }; });
    if (inspectInfo.visible !== 'block') {
      // default camera center may miss the model on some archetypes; try the ISO/typical body position
      await page.evaluate(() => { document.querySelector('[data-pump3d-target="livepanel"][data-pump3d-view="iso"]').click(); });
      await page.waitForTimeout(300);
      await page.mouse.click(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.55);
      await page.waitForTimeout(300);
      inspectInfo = await page.evaluate(() => { const el = document.getElementById('pump-livepanel-3d-info'); return { text: el.textContent, visible: el.style.display }; });
    }
    report(
      'Click-to-inspect names a real part when clicking the model',
      'info box visible with non-empty text',
      JSON.stringify(inspectInfo),
      inspectInfo.visible === 'block' && inspectInfo.text.trim().length > 0, []
    );

    // ── Click-to-inspect does NOT fire after a drag ──
    await page.evaluate(() => { const el = document.getElementById('pump-livepanel-3d-info'); el.textContent = ''; el.style.display = 'none'; });
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width / 2 + 90, canvasBox.y + canvasBox.height / 2 - 40, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const afterDragInfo = await page.evaluate(() => document.getElementById('pump-livepanel-3d-info').style.display);
    report('Dragging to rotate does NOT trigger a spurious click-to-inspect popup', 'info box stays hidden', afterDragInfo, afterDragInfo === 'none', []);

  } finally {
    await browser.close();
    server.kill();
  }

  const pass = results.filter((r) => r.pass).length, fail = results.length - pass;
  console.log(`\n${pass} passed, ${fail} failed (of ${results.length})\n`);
  if (fail > 0) {
    console.log('FAILURES:');
    results.filter((r) => !r.pass).forEach((r) => console.log(`  - ${r.name}\n    expected: ${r.expected}\n    actual:   ${r.actual}\n    errors: ${JSON.stringify(r.errors)}`));
  }
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1); });
