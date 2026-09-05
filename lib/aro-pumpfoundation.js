/* ══════════════════════════════════════════════════════════════════════
   AROGARA — Foundation / Baseplate Design
   window.AROPUMPFOUNDATION

   Phase 22 of the Pump Hydraulics Advanced Upgrade. Phases 16, 18 and 20
   each left an honest placeholder ("Foundation/baseplate sizing is a
   later item in this upgrade") rather than inventing a number — this
   phase is that later item, and stays just as honest about what still
   cannot be calculated.

   The industry-standard foundation sizing rule (concrete foundation
   mass >= roughly 3-5x the combined pump+motor+baseplate weight, so the
   large inertial mass damps running vibration) needs a weight this
   suite has never modeled — no phase computes pump casing weight, motor
   frame weight, or baseplate weight, only performance figures (kW,
   torque, bore, bearing loads). Rather than invent a weight-from-power
   correlation with no citation, this engine states the REAL rule and
   flags DATA REQUIRED for the number it cannot produce, exactly the
   safety behaviour this whole upgrade is built around. What it CAN
   compute honestly: the baseplate style Phase 3's configuration pick
   already implies, and standard grout/anchor-bolt reference practice.

   buildFoundationDesign(...) is pure — no DOM. Loadable/unit-testable
   in Node like every other engine here.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function hasBaseplate(style) {
    return !!style && style.indexOf('baseplate') !== -1;
  }

  function styleItem(configResult) {
    if (!configResult || !configResult.applicable) {
      return { id: 'baseplate-style', label: 'Baseplate Style', status: 'DATA REQUIRED',
        detail: (configResult && configResult.reason) || 'Run the pump hydraulic calculation and let configuration selection (section 04) finish first.' };
    }
    var style = configResult.top.baseplateStyle;
    if (!hasBaseplate(style)) {
      return { id: 'baseplate-style', label: 'Baseplate Style', status: 'NOT APPLICABLE',
        detail: 'Selected configuration (' + configResult.top.id + ') uses "' + style + '" — a conventional foundation/baseplate does not apply to this mounting arrangement.' };
    }
    return { id: 'baseplate-style', label: 'Baseplate Style', status: 'PRELIMINARY ASSUMPTION',
      detail: 'This configuration (' + configResult.top.id + ') typically uses a "' + style + '" — the category Phase 3\'s API 610 configuration pick implies, not a vendor baseplate drawing.' };
  }

  function groutItem(configResult) {
    if (!configResult || !configResult.applicable) {
      return { id: 'grout-thickness', label: 'Grout Thickness', status: 'DATA REQUIRED', detail: 'Run the pump hydraulic calculation first.' };
    }
    if (!hasBaseplate(configResult.top.baseplateStyle)) {
      return { id: 'grout-thickness', label: 'Grout Thickness', status: 'NOT APPLICABLE', detail: 'No baseplate/foundation for this mounting arrangement.' };
    }
    return { id: 'grout-thickness', label: 'Grout Thickness', status: 'RECOMMENDED',
      detail: 'Typical epoxy grout thickness between baseplate and foundation is 25-50 mm (API 686 practice) — confirm against the actual baseplate design once available.' };
  }

  function foundationMassItem(configResult, topFamilyCategory) {
    if (!configResult || !configResult.applicable) {
      return { id: 'foundation-mass', label: 'Foundation Mass', status: 'DATA REQUIRED', detail: 'Run the pump hydraulic calculation first.' };
    }
    if (!hasBaseplate(configResult.top.baseplateStyle)) {
      return { id: 'foundation-mass', label: 'Foundation Mass', status: 'NOT APPLICABLE', detail: 'No baseplate/foundation for this mounting arrangement.' };
    }
    var isPD = (topFamilyCategory === 'pd-rotary' || topFamilyCategory === 'pd-reciprocating');
    var ratio = isPD ? '5x' : '3x';
    return {
      id: 'foundation-mass', label: 'Foundation Mass', status: 'DATA REQUIRED',
      detail: 'This suite does not yet model total pump+motor+baseplate weight, so an absolute foundation mass cannot be calculated. '
        + 'Once a vendor equipment weight is available: size the concrete foundation mass to at least ' + ratio + ' that combined weight'
        + (isPD ? ' — the higher end of typical practice, because a reciprocating positive-displacement machine imposes larger cyclic unbalanced forces than a centrifugal one.' : ', per typical centrifugal-pump foundation practice.'),
    };
  }

  function anchorBoltItem(configResult) {
    if (!configResult || !configResult.applicable) {
      return { id: 'anchor-bolts', label: 'Anchor Bolts', status: 'DATA REQUIRED', detail: 'Run the pump hydraulic calculation first.' };
    }
    if (!hasBaseplate(configResult.top.baseplateStyle)) {
      return { id: 'anchor-bolts', label: 'Anchor Bolts', status: 'NOT APPLICABLE', detail: 'No baseplate/foundation for this mounting arrangement.' };
    }
    return {
      id: 'anchor-bolts', label: 'Anchor Bolts', status: 'DATA REQUIRED',
      detail: 'Anchor bolt size and count depend on the actual dynamic loads and the vendor baseplate\'s bolt pattern, neither of which is modelled here. '
        + 'Standard practice (API 686) embeds anchor bolts to at least 20-25x their own diameter into the foundation — a reference for the detailed design stage, not a calculated size.',
    };
  }

  /* input = { configResult (Phase 3's AROPUMPCONFIG selection, .top has
     id/baseplateStyle), topFamilyCategory (Phase 2's top family
     category id, used only to pick the higher PD foundation-mass
     ratio) } */
  function buildFoundationDesign(input) {
    input = input || {};
    var items = [
      styleItem(input.configResult),
      groutItem(input.configResult),
      foundationMassItem(input.configResult, input.topFamilyCategory),
      anchorBoltItem(input.configResult),
    ];
    return { items: items, status: 'CALCULATED' };
  }

  window.AROPUMPFOUNDATION = { buildFoundationDesign: buildFoundationDesign };
})();
