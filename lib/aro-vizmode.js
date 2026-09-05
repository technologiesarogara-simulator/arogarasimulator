/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Shared visualization theme palette
   window.AROVIZTHEME

   Every pump-module canvas built across this session's phases (2D charts
   in aro-pumpfamily.js/aro-pumpmoc.js/aro-pumpaffinity.js/
   aro-pumpflowviz.js, and the THREE.js scenes in
   aro-pumpimpeller3d.js/aro-pumptwin.js) was written once, for a single
   fixed dark background — the same gap lib/aro-industrial3d.js's own
   comments describe already having to fix for its own viewport ("a light
   desktop ended up with a night-black window"). Rather than duplicate a
   theme-detection helper and a redraw-on-change listener in every one of
   those files, this one small file provides both, matching the same
   `document.body.classList.contains('theme-day')` signal
   lib/aro-industrial3d.js already uses as the source of truth.

   This changes no calculation, no formula, and no existing file's
   colors on its own — it only gives the pump visualizations a single,
   shared place to ask "which theme, and tell me when it changes."
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function isDay() {
    try { return !!(document.body && document.body.classList.contains('theme-day')); }
    catch (e) { return false; }
  }

  /* Named roles rather than raw hex in every caller, so a future palette
     tweak happens once, here. Chosen to read clearly against BOTH the
     matching background (day text on the day bg, night text on the
     night bg) and to keep saturated accent colors (verdict badges, plot
     lines) legible on either — those are supplied by each caller's own
     established status-color tables and are untouched here. */
  var PALETTE = {
    day: {
      bg: '#e9edf1', bgHex: 0xe9edf1,
      grid: '#c8d0d8', axis: '#64748b',
      text: '#0f172a', textMuted: '#475569',
      /* Chart legends draw an opaque chip behind their swatches/labels so
         overlapping plot lines don't bleed through the text. That chip was
         a single hardcoded near-black fill (fine on the night background,
         a dark halo on the day one) — legendBg/legendText give each theme
         its own, so light mode gets a light chip with dark text instead of
         reusing night's. */
      legendBg: 'rgba(255,255,255,0.85)', legendText: '#0f172a',
      ambientLight: 0xffffff, ambientIntensity: 0.75
    },
    night: {
      bg: '#050810', bgHex: 0x050810,
      grid: '#334155', axis: '#64748b',
      text: '#e2e8f0', textMuted: '#94a3b8',
      legendBg: 'rgba(2,6,18,0.55)', legendText: '#e2e8f0',
      ambientLight: 0x8899aa, ambientIntensity: 0.6
    }
  };
  function palette() { return isDay() ? PALETTE.day : PALETTE.night; }

  var listeners = [];
  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  var mo = null;
  function startWatching() {
    if (mo || typeof MutationObserver === 'undefined' || !document.body) return;
    mo = new MutationObserver(function () {
      var p = palette();
      listeners.slice().forEach(function (fn) { try { fn(p); } catch (e) {} });
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.body) startWatching();
  else document.addEventListener('DOMContentLoaded', startWatching);

  window.AROVIZTHEME = { isDay: isDay, palette: palette, onChange: onChange };
})();
