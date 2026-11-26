/* Shared fluid reference guidance. Values are informational, never solver inputs. */
(function () {
  'use strict';
  var ids = ['pump-fluid', 'lq-fluid', 'gs-gas', 'sl-carrier', 'tp2-pair',
    'sthe-fluid-tube-select', 'sthe-fluid-shell-select',
    'dphe-fluid-hot-select', 'dphe-fluid-cold-select', 'phe-hf-name', 'phe-cf-name', 'st-w'];

  function fluidText(name) {
    var api = window.AROFLUIDPHASE;
    var info = api && api.info(name);
    if (!info) return name + ': freezing/melting and boiling data unavailable for this selection; obtain a fluid-specific supplier or property-database reference.';
    if (info.label === 'caustic soda 50') {
      return '50% NaOH solution: crystallization begins approximately 12–15 °C; it depends on concentration. Confirm the supplier curve and heat-tracing margin. Source: CDC/NIOSH sodium hydroxide profile.';
    }
    var parts = [];
    if (info.boil != null) parts.push('normal boiling reference ' + info.boil + ' °C');
    if (info.freeze != null) parts.push((info.note && /pour point/i.test(info.note) ? 'indicative pour point ' : 'freezing/melting reference ') + info.freeze + ' °C');
    return name + ': ' + (parts.join('; ') || 'phase limits unavailable') + ' at approximately 1.013 bar absolute' + (info.note ? '. ' + info.note : '.') + ' Screening values; confirm composition and supplier data.';
  }
  function describe(el) {
    var name = el.id === 'st-w' ? 'Steam' : (el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : el.value);
    var text;
    if (el.id === 'tp2-pair') {
      var pair = name.replace(/\s*\([^)]*\)\s*$/, '').split(/\s+-\s+/);
      text = pair.length === 2 ? fluidText(pair[0]) + ' ' + fluidText(pair[1]) : fluidText(name);
      text += ' For a mixture, establish phase equilibrium and composition at the operating pressure.';
    } else {
      text = fluidText(name);
      if (el.id === 'sl-carrier') text += ' This is the carrier only; solids and concentration can change slurry behaviour.';
    }
    return 'FLUID REFERENCE · ' + text + ' These are reference conditions, not the operating limits. Boiling/saturation temperature changes with absolute pressure. Verify phase, density and viscosity at the entered operating temperature and pressure; preset property conditions may be unspecified. Enter or confirm supplier values.';
  }
  function update(el) {
    if (!el || !el.parentNode) return;
    var anchor = el.parentElement && el.parentElement.classList.contains('select-wrapper') ? el.parentElement : el;
    var panel = document.getElementById('fluid-guide-' + el.id);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'fluid-guide-' + el.id;
      panel.setAttribute('role', 'note');
      panel.style.cssText = 'font-size:11px;line-height:1.45;color:var(--text-secondary,#52627a);padding:6px 8px;margin:5px 0;border-left:3px solid #3976b9;background:rgba(76,139,205,.08);white-space:normal;overflow-wrap:anywhere;';
      anchor.insertAdjacentElement('afterend', panel);
    }
    var next = describe(el);
    if (panel.textContent !== next) panel.textContent = next;
  }
  function refresh() { ids.forEach(function (id) { update(document.getElementById(id)); }); }
  document.addEventListener('change', function (e) { if (ids.indexOf(e.target.id) !== -1) update(e.target); });
  function start() {
    refresh();
    var pending = false;
    new MutationObserver(function (records) {
      var added = records.some(function (r) { return Array.prototype.some.call(r.addedNodes, function (n) { return n.nodeType === 1 && (ids.indexOf(n.id) !== -1 || (n.querySelector && ids.some(function (id) { return !!n.querySelector('#' + id); }))); }); });
      if (added && !pending) { pending = true; setTimeout(function () { pending = false; refresh(); }, 0); }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.AROFLUIDGUIDANCE = { describe: describe, refresh: refresh };
})();
