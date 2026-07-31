/* ══════════════════════════════════════════════════════════════════════
   AROGARA — ICON SET  (window.AROICON)

   The front page and the access gate used emoji for module and sector
   marks. Emoji render differently on every platform, carry colour and
   personality the design does not choose, and some read as plainly wrong in
   an engineering context — a flame for heat exchangers, and another flame
   for refineries.

   These are line icons on a 24×24 grid: one stroke weight, round caps and
   joins, and `currentColor` throughout, so a mark takes the colour of
   whatever it sits in and stays consistent everywhere it appears.

   Usage:  AROICON('pump')          → <svg …>…</svg>
           AROICON('pump', 28)      → at 28 px
   An unknown name returns a neutral dot rather than nothing, so a typo can
   never leave a hole in the layout.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var P = {
    /* ── modules ──────────────────────────────────────────────────── */
    pump:      '<circle cx="10" cy="13" r="5.2"/><path d="M10 13 13.6 9.4"/><path d="M10 7.8V4.6h4.6"/><path d="M15.2 13H21"/><path d="M4.4 18.6h11.2"/>',
    line:      '<path d="M2.5 8.5h6l2.5-3 2.5 6 2.5-3h5.5"/><path d="M2.5 16.5h19"/><path d="M6.5 14.6v3.8M17.5 14.6v3.8"/>',
    exchanger: '<rect x="2.6" y="6.4" width="18.8" height="11.2" rx="2.2"/><path d="M2.6 9.6h18.8M2.6 14.4h18.8"/><path d="M7 6.4v11.2M17 6.4v11.2"/>',
    plate:     '<path d="M4 5.5v13M8 5.5v13M12 5.5v13M16 5.5v13M20 5.5v13"/><path d="M2.4 5.5h19.2M2.4 18.5h19.2"/>',
    hairpin:   '<path d="M4 7.5h10a3.5 3.5 0 0 1 0 7H6"/><path d="M4 17.5h10"/><path d="M8.6 5.2 6 7.5l2.6 2.3"/>',
    tank:      '<path d="M5 8.5v9.2a1.4 1.4 0 0 0 1.4 1.4h11.2a1.4 1.4 0 0 0 1.4-1.4V8.5"/><ellipse cx="12" cy="7.2" rx="7" ry="2.4"/><path d="M5 13.4c2.6 1.2 11.4 1.2 14 0"/>',
    cube:      '<path d="M12 2.9 20.4 7v10L12 21.1 3.6 17V7z"/><path d="m3.6 7 8.4 4.4L20.4 7"/><path d="M12 11.4v9.7"/>',
    ai:        '<rect x="4.2" y="7.4" width="15.6" height="12" rx="3"/><path d="M12 7.4V4.2"/><circle cx="12" cy="3.3" r="1.1"/><path d="M9.2 12.2v1.8M14.8 12.2v1.8"/><path d="M9.6 16.4h4.8"/>',

    /* ── workflow ─────────────────────────────────────────────────── */
    data:      '<path d="M12 3v11"/><path d="m7.8 10 4.2 4.2 4.2-4.2"/><path d="M4.2 17.2v2.4a1.4 1.4 0 0 0 1.4 1.4h12.8a1.4 1.4 0 0 0 1.4-1.4v-2.4"/>',
    engine:    '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9"/>',
    caliper:   '<path d="M4.4 3.4v17.2"/><path d="M4.4 7.6h6.2M4.4 12h4M4.4 16.4h6.2"/><path d="M14.6 5.2v13.6a1.6 1.6 0 0 0 1.6 1.6h1.6a1.6 1.6 0 0 0 1.6-1.6V5.2z"/>',
    target:    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 1.8v3.2M12 19v3.2M1.8 12H5M19 12h3.2"/>',
    drawing:   '<path d="M5.2 3.4h9L19 8v12.6H5.2z"/><path d="M14 3.4V8h5"/><path d="M8 12.4h7M8 16h4.6"/>',
    datasheet: '<rect x="4.4" y="3.4" width="15.2" height="17.2" rx="1.8"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    report:    '<path d="M6 3.4h9.4L19 7v13.6H6z"/><path d="M9.4 17.4V13M12.4 17.4V9.6M15.4 17.4v-2.6"/>',

    /* ── industries ───────────────────────────────────────────────── */
    derrick:   '<path d="M12 3.2 6.4 20.4M12 3.2l5.6 17.2"/><path d="M8.6 12.2h6.8M7.5 16.4h9"/><path d="M3.4 20.6h17.2"/>',
    flask:     '<path d="M9.6 3.2v6.1L4.6 18a1.7 1.7 0 0 0 1.5 2.6h11.8a1.7 1.7 0 0 0 1.5-2.6l-5-8.7V3.2"/><path d="M8.4 3.2h7.2"/><path d="M7.2 14.2h9.6"/>',
    plant:     '<path d="M3 20.6V9.4l5.2 3.2V9.4l5.2 3.2V6.2l5.2 3.4v11z"/><path d="M3 20.6h18"/>',
    tower:     '<path d="M8 20.6V5.6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15"/><path d="M8 8.4h8M8 12.4h8M8 16.4h8"/><path d="M4.6 20.6h14.8"/>',
    bolt:      '<path d="M13.4 2.6 5.6 13.4h5.4l-1 8 8-10.8h-5.4z"/>',
    grain:     '<path d="M12 21V9.4"/><path d="M12 9.4c0-3.2 2-6 5-6.6.5 3.2-1.4 6.2-5 6.6z"/><path d="M12 13.6c0-3-1.9-5.6-4.7-6.2-.5 3 1.3 5.8 4.7 6.2z"/><path d="M6.6 21h10.8"/>',
    pill:      '<rect x="2.9" y="8.6" width="18.2" height="6.8" rx="3.4" transform="rotate(-38 12 12)"/><path d="m9 15 6-6"/>',
    droplet:   '<path d="M12 3.2c3.2 3.6 5.6 6.6 5.6 9.4a5.6 5.6 0 0 1-11.2 0c0-2.8 2.4-5.8 5.6-9.4z"/>',
    molecule:  '<circle cx="6.4" cy="7.4" r="2.4"/><circle cx="17.6" cy="7.4" r="2.4"/><circle cx="12" cy="16.6" r="2.4"/><path d="M8.6 8.7 10.4 14.7M15.4 8.7 13.6 14.7M8.8 7.4h6.4"/>',
    sprout:    '<path d="M12 20.6v-8"/><path d="M12 12.6C12 9.4 9.6 6.8 6.2 6.4c-.4 3.2 2 5.9 5.8 6.2z"/><path d="M12 12.6c0-3.2 2.4-5.8 5.8-6.2.4 3.2-2 5.9-5.8 6.2z"/><path d="M8.4 20.6h7.2"/>',

    /* ── library ──────────────────────────────────────────────────── */
    steam:     '<path d="M6.4 20.4h11.2"/><path d="M8.6 16.4c-1.6-1.8-.4-3.2.6-4.4 1-1.2 1.4-2.4.4-3.8"/><path d="M12.6 16.4c-1.6-1.8-.4-3.2.6-4.4 1-1.2 1.4-2.4.4-3.8"/><path d="M16.6 16.4c-1.2-1.4-.4-2.6.4-3.4"/>',
    book:      '<path d="M4.4 4.6A1.6 1.6 0 0 1 6 3h13v18H6a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M4.4 17.4H19"/><path d="M8 7.4h7M8 11h5"/>',
    swap:      '<path d="M4 8.6h13.4"/><path d="m14.4 5.4 3.2 3.2-3.2 3.2"/><path d="M20 15.4H6.6"/><path d="m9.6 12.2-3.2 3.2 3.2 3.2"/>',
    layers:    '<path d="m12 3.2 8.6 4.4L12 12 3.4 7.6z"/><path d="m3.4 12 8.6 4.4L20.6 12"/><path d="m3.4 16.4 8.6 4.4 8.6-4.4"/>',
    ring:      '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="4.8" r=".9"/><circle cx="19.2" cy="12" r=".9"/><circle cx="12" cy="19.2" r=".9"/><circle cx="4.8" cy="12" r=".9"/>',

    /* ── assurance & purpose ──────────────────────────────────────── */
    lock:      '<rect x="4.6" y="10.4" width="14.8" height="10.2" rx="2.2"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/><path d="M12 14.2v2.6"/>',
    globe:     '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/><path d="M12 3.4c2.3 2.4 3.5 5.4 3.5 8.6s-1.2 6.2-3.5 8.6c-2.3-2.4-3.5-5.4-3.5-8.6S9.7 5.8 12 3.4z"/>',
    compass:   '<circle cx="12" cy="12" r="8.6"/><path d="m15.4 8.6-2 5.4-5.4 2 2-5.4z"/>',

    /* ── audience ─────────────────────────────────────────────────── */
    wrench:    '<path d="M15.6 3.4a5.6 5.6 0 0 0-5 8.1L3.4 18.7l2 2 7.2-7.2a5.6 5.6 0 0 0 7.5-6.8l-3 3-2.5-2.5 3-3a5.6 5.6 0 0 0-2-.8z"/>',
    chart:     '<path d="M4 20.4V3.6"/><path d="M4 20.4h16.4"/><path d="M7.6 17V11M11.6 17V6.8M15.6 17v-4M19.6 17V8.6"/>',
    scope:     '<path d="M9.4 3.4h5.2"/><path d="M10.8 3.4v6.2L6.4 18a2 2 0 0 0 1.8 3h7.6a2 2 0 0 0 1.8-3l-4.4-8.4V3.4"/><circle cx="12" cy="16.4" r="1.2"/>',
    cap:       '<path d="m12 4 9.2 4.2L12 12.4 2.8 8.2z"/><path d="M6.6 10.4v4.4c0 1.6 2.4 3 5.4 3s5.4-1.4 5.4-3v-4.4"/><path d="M20 9.2v5.2"/>',
    crane:     '<path d="M4.4 20.6V4.4h11.2"/><path d="M4.4 8.4h9.6"/><path d="M15.6 4.4 4.4 12.4"/><path d="M19.6 4.4v6.2a2 2 0 0 1-2 2h-1.6"/><path d="M2.6 20.6h18.8"/>'
  };

  function icon(name, size) {
    var d = P[name] || '<circle cx="12" cy="12" r="3.4"/>';
    var s = size || 22;
    return '<svg class="aro-ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" '
      + 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" '
      + 'aria-hidden="true" focusable="false">' + d + '</svg>';
  }
  icon.has = function (n) { return Object.prototype.hasOwnProperty.call(P, n); };
  icon.names = function () { return Object.keys(P); };

  window.AROICON = icon;
})();
