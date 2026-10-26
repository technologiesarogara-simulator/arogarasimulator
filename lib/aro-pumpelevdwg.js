/* AROGARA — Pump elevation and NPSH schematic drawing
   The Pump 2D Drawing is intentionally the same live calculation schematic
   used in the pump report. It replaces the former generic pump GA sheet. */
(function () {
  'use strict';
  if (!window.ARODWG || typeof window.ARODWG.register !== 'function') return;

  window.ARODWG.register('pump', {
    title: 'PUMP HYDRAULICS — ELEVATION & NPSH SCHEMATIC',
    stateId: 'pump',
    data: function () {
      var s = window.state && window.state.pump;
      if (!s || !s.calculated || !s.inputs || !s.results) return null;
      return { inputs: s.inputs, results: s.results };
    },
    raw: function (d) {
      if (typeof window.buildPumpSVGDiagram !== 'function') return null;
      return window.buildPumpSVGDiagram(d.inputs, d.results);
    }
  });
})();
