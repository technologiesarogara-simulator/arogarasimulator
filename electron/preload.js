/* ══════════════════════════════════════════════════════════════════════
   AROGARA DESKTOP — preload script

   Runs in an isolated context with Node access, before the renderer's own
   scripts (index.html's <script> tags / app.js / lib/*.js) execute — its
   only job is to hand the renderer a small, explicit, read-only API via
   contextBridge. Nothing here gives app.js/lib/*.js direct access to
   Node or Electron internals (Phase 11: no insecure preload exposure).

   window.AROGARA_DESKTOP is read once, synchronously, by the one guard
   added to index.html around the existing service-worker registration —
   see index.html's `if (!window.AROGARA_DESKTOP) navigator.serviceWorker
   .register(...)` — so the web build (where this global never exists)
   keeps registering its service worker exactly as before.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('AROGARA_DESKTOP', true);

// Small, explicit, non-sensitive readout — a starting point for future
// desktop-only UI (e.g. an "About AROGARA" panel) and for the eventual
// native project save/open + license-check IPC bridges (Phase 7 / Phase
// 10 of the desktop plan), neither of which exists yet in v0.1.0. `process`
// is the global Node process object Electron still provides inside a
// sandboxed preload script (restricted to these read-only fields, not the
// full Node API) — not a property of the `electron` module itself.
contextBridge.exposeInMainWorld('AROGARA_DESKTOP_INFO', {
  platform: process.platform,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome
});
