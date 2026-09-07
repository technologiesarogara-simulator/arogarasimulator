/* ══════════════════════════════════════════════════════════════════════
   AROGARA — live chart customization, shared across every module
   window.AROCHARTCTRL

   Every graph in the suite — pump, line sizing, DPHE, STHE — was fixed at
   whatever axis range and color scheme its drawing code picked. An
   engineer preparing a duty-specific submittal wants to zoom an axis to
   the range that matters for THIS duty, or match a client's color
   convention, without waiting on a code change. This gives every chart a
   small gear icon that opens exactly that: axis min/max (per axis),
   a color swatch per data series, and a background color — applied live,
   and persisted (per browser, per chart) so it survives a recalculation.

   NO NEW CAPTURE PATH FOR THE REPORT. The report already builds every
   chart image with canvasImgs()'s plain `canvas.toDataURL()` on the same
   canvas element these charts render into (lib/aro-engineering.js). A
   customization is real pixels drawn to that canvas, not a CSS style
   layered over it — background color included, via a Chart.js plugin
   that paints it into the canvas itself rather than the element's CSS
   background (a CSS background never appears in toDataURL() output) — so
   whatever the engineer sees on screen is exactly what the report
   captures, with nothing extra to wire up per chart.

   Two entry points:
     enhance(chart, canvas, key)         — a live Chart.js instance
     enhanceCustom(canvas, key, hooks)   — a hand-drawn canvas (AROPUMPCHART
                                            grid()/legend() style), where
                                            hooks.getDefaults()/apply(prefs)
                                            let the caller own its own
                                            re-draw.
   Both read/write the same localStorage-backed preference store, keyed by
   a caller-chosen string (typically the canvas id) so it's already unique.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var STORE_KEY = 'aro_chart_prefs_v1';

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveAll(all) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch (e) {}
  }
  function getPrefs(key) { return loadAll()[key] || {}; }
  function setPrefs(key, prefs) { var all = loadAll(); all[key] = prefs; saveAll(all); }

  /* ── scientific-notation tick formatting, shared by both chart families ──
     Canvas text has no native superscript, so the exponent is written with
     real Unicode superscript digits rather than a caret — reads as "1.2×10³"
     directly in the tick label, no special font needed. */
  var SUP_DIGITS = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function superscript(n) {
    return String(n).split('').map(function (c) { return SUP_DIGITS[c] || c; }).join('');
  }
  function sciLabel(value) {
    if (value === 0) return '0';
    var exp = Math.floor(Math.log10(Math.abs(value)));
    var mantissa = value / Math.pow(10, exp);
    /* An exponent of 0/1 (a plain 1-99 range) reads worse in scientific
       form than as the ordinary number it already is. */
    if (exp > -2 && exp < 2) return (Math.round(value * 100) / 100).toString();
    return (Math.round(mantissa * 100) / 100).toString() + '×10' + superscript(exp);
  }
  window.AROCHARTCTRL_SCI = sciLabel;   // shared with hand-drawn charts (lib/aro-pumpchart.js)

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* Chart.js accepts any CSS color string (named, rgba(), hex) as a
     dataset/border color; <input type=color> only accepts #rrggbb. A
     swatch seeded from an rgba()/named default is shown as a neutral
     mid-tone rather than left blank — picking a new color always works,
     it just doesn't roundtrip the exact original shade into the swatch. */
  function toHex(c) {
    if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
    var m = typeof c === 'string' && c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (m) {
      return '#' + [m[1], m[2], m[3]].map(function (v) {
        return Math.max(0, Math.min(255, Math.round(+v))).toString(16).padStart(2, '0');
      }).join('');
    }
    return '#38bdf8';
  }

  /* ── shared chrome (gear + popover), CSS injected once ─────────────── */
  function injectCss() {
    if (document.getElementById('aro-cc-css')) return;
    var s = document.createElement('style');
    s.id = 'aro-cc-css';
    s.textContent = [
      '.aro-cc-wrap{position:relative;}',
      '.aro-cc-gear{position:absolute;top:4px;right:4px;z-index:15;width:23px;height:23px;border-radius:5px;',
      '  border:1px solid rgba(148,163,184,0.35);background:rgba(15,23,42,0.55);color:#94a3b8;cursor:pointer;',
      '  font-size:13px;line-height:21px;text-align:center;padding:0;transition:border-color .15s,color .15s;}',
      '.aro-cc-gear:hover{border-color:#38bdf8;color:#38bdf8;}',
      'html.theme-day .aro-cc-gear{background:rgba(255,255,255,0.88);border-color:#c8d0d8;color:#475569;}',
      '.aro-cc-panel{position:absolute;top:31px;right:4px;z-index:16;width:236px;max-height:min(70vh,420px);',
      '  overflow-y:auto;background:#0b1220;border:1px solid rgba(148,163,184,0.35);border-radius:8px;',
      '  padding:10px 11px;box-shadow:0 12px 32px rgba(0,0,0,0.5);font-family:var(--font-mono,monospace);',
      '  font-size:10px;color:#cbd5e1;}',
      'html.theme-day .aro-cc-panel{background:#ffffff;border-color:#c8d0d8;color:#334155;box-shadow:0 12px 32px rgba(15,23,42,0.18);}',
      '.aro-cc-h{font-weight:800;letter-spacing:0.06em;color:#38bdf8;font-size:9.5px;margin:0 0 6px;}',
      '.aro-cc-h2{font-weight:700;letter-spacing:0.05em;color:#94a3b8;font-size:8.5px;margin:8px 0 5px;',
      '  border-top:1px dashed rgba(148,163,184,0.28);padding-top:7px;}',
      'html.theme-day .aro-cc-h2{color:#64748b;}',
      '.aro-cc-row{display:flex;align-items:center;gap:5px;margin-bottom:5px;}',
      '.aro-cc-row label{flex:0 0 auto;color:#94a3b8;font-size:8.5px;}',
      'html.theme-day .aro-cc-row label{color:#64748b;}',
      '.aro-cc-row input[type=number]{width:0;flex:1 1 auto;min-width:0;background:rgba(148,163,184,0.08);',
      '  border:1px solid rgba(148,163,184,0.3);color:inherit;border-radius:4px;padding:3px 5px;',
      '  font-size:9.5px;font-family:inherit;}',
      '.aro-cc-row input[type=color]{width:26px;height:22px;flex:0 0 auto;padding:0;',
      '  border:1px solid rgba(148,163,184,0.3);border-radius:4px;background:none;cursor:pointer;}',
      '.aro-cc-ds span{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8.8px;}',
      '.aro-cc-btn{width:100%;margin-top:9px;padding:6px;border-radius:5px;border:1px solid rgba(148,163,184,0.3);',
      '  background:transparent;color:#94a3b8;font-family:inherit;font-size:9px;font-weight:700;cursor:pointer;',
      '  letter-spacing:0.06em;}',
      '.aro-cc-btn:hover{border-color:#ef4444;color:#ef4444;}'
    ].join('');
    document.head.appendChild(s);
  }

  function ensureWrap(canvas) {
    var parent = canvas.parentElement;
    if (!parent) return canvas;
    parent.classList.add('aro-cc-wrap');
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    return parent;
  }

  function closeAllPanels() {
    document.querySelectorAll('.aro-cc-panel').forEach(function (p) { p.remove(); });
  }
  document.addEventListener('click', function (ev) {
    if (ev.target.closest && (ev.target.closest('.aro-cc-panel') || ev.target.closest('.aro-cc-gear'))) return;
    closeAllPanels();
  });

  function gearBtn(host, key, onOpen) {
    var btn = host.querySelector('.aro-cc-gear');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aro-cc-gear';
      btn.title = 'Customize this chart — axis scale, colors, background';
      btn.textContent = '⚙';
      host.appendChild(btn);
    }
    btn.setAttribute('data-cc-key', key);
    btn.onclick = function (e) {
      e.stopPropagation();
      var existing = host.querySelector('.aro-cc-panel');
      if (existing) { existing.remove(); return; }
      closeAllPanels();
      host.appendChild(onOpen());
    };
    return btn;
  }

  function colorField(labelHtml, value, onInput) {
    var row = document.createElement('div');
    row.className = 'aro-cc-row aro-cc-ds';
    var inp = document.createElement('input');
    inp.type = 'color'; inp.value = toHex(value);
    var span = document.createElement('span');
    span.innerHTML = labelHtml;
    row.appendChild(inp); row.appendChild(span);
    inp.addEventListener('input', function () { onInput(inp.value); });
    return row;
  }

  function minMaxFields(title, curMin, curMax, prefMin, prefMax, onChange) {
    var wrap = document.createElement('div');
    var h = document.createElement('div');
    h.className = 'aro-cc-h2'; h.textContent = title;
    wrap.appendChild(h);
    var row = document.createElement('div');
    row.className = 'aro-cc-row';
    row.innerHTML = '<label>MIN</label>';
    var minInp = document.createElement('input');
    minInp.type = 'number'; minInp.step = 'any'; minInp.setAttribute('data-bound', 'min');
    minInp.value = prefMin != null ? prefMin : '';
    minInp.placeholder = isFinite(curMin) ? (Math.round(curMin * 100) / 100).toString() : '';
    row.appendChild(minInp);
    row.insertAdjacentHTML('beforeend', '<label>MAX</label>');
    var maxInp = document.createElement('input');
    maxInp.type = 'number'; maxInp.step = 'any'; maxInp.setAttribute('data-bound', 'max');
    maxInp.value = prefMax != null ? prefMax : '';
    maxInp.placeholder = isFinite(curMax) ? (Math.round(curMax * 100) / 100).toString() : '';
    row.appendChild(maxInp);
    wrap.appendChild(row);
    minInp.addEventListener('input', function () { onChange(minInp.value === '' ? null : parseFloat(minInp.value), undefined); });
    maxInp.addEventListener('input', function () { onChange(undefined, maxInp.value === '' ? null : parseFloat(maxInp.value)); });
    return wrap;
  }

  function sciCheckbox(checked, onChange) {
    var row = document.createElement('label');
    row.className = 'aro-cc-row';
    row.style.cursor = 'pointer';
    var inp = document.createElement('input');
    inp.type = 'checkbox'; inp.checked = !!checked;
    inp.style.cssText = 'flex:0 0 auto;width:13px;height:13px;cursor:pointer;';
    var span = document.createElement('span');
    span.textContent = 'SCIENTIFIC NOTATION (×10ⁿ)';
    span.style.cssText = 'flex:1 1 auto;font-size:8.5px;';
    row.appendChild(inp); row.appendChild(span);
    inp.addEventListener('change', function () { onChange(inp.checked); });
    return row;
  }

  /* ── Chart.js background-as-pixels plugin, registered once ──────────── */
  var bgPluginRegistered = false;
  function registerBgPlugin() {
    if (bgPluginRegistered || typeof Chart === 'undefined') return;
    Chart.register({
      id: 'aroCcBg',
      beforeDraw: function (chart) {
        var bg = chart.options && chart.options.aroBg;
        if (!bg) return;
        var ctx = chart.ctx;
        ctx.save();
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    });
    bgPluginRegistered = true;
  }

  /* ── enhance(): a live Chart.js instance ─────────────────────────────
     Call this every time the chart is (re)built (right after `new
     Chart(...)`) — it captures THIS instance's true defaults before
     applying any stored override, so RESET has something real to return
     to, and re-attaches to the same gear icon (the canvas's parent
     persists across a destroy()/recreate cycle even though the Chart.js
     instance itself doesn't). */
  /* Below this size a tick/title/legend label reads as "unclear" on an
     ordinary monitor, let alone projected or printed into a report — most
     of the app's Chart.js configs were set at 8-9px. Raising anything
     smaller than this floor (never shrinking anything already bigger) is
     safe to apply blanket, across every chart, without hand-editing each
     of the dozen or so chart-building functions individually. */
  var MIN_FONT_PX = 11;
  function bumpFont(f) {
    if (!f) return { size: MIN_FONT_PX };
    var out = (typeof f === 'object') ? Object.assign({}, f) : {};
    out.size = Math.max(MIN_FONT_PX, out.size || 10);
    return out;
  }
  function bumpChartFonts(chart) {
    var scales = chart.options.scales || {};
    Object.keys(scales).forEach(function (sid) {
      var sc = scales[sid];
      if (sc.ticks) sc.ticks.font = bumpFont(sc.ticks.font);
      if (sc.title) sc.title.font = bumpFont(sc.title.font);
    });
    var plugins = chart.options.plugins || (chart.options.plugins = {});
    if (plugins.legend && plugins.legend.labels) plugins.legend.labels.font = bumpFont(plugins.legend.labels.font);
    if (plugins.tooltip) {
      plugins.tooltip.titleFont = bumpFont(plugins.tooltip.titleFont);
      plugins.tooltip.bodyFont = bumpFont(plugins.tooltip.bodyFont);
    }
  }

  function enhance(chart, canvas, key) {
    if (!chart || !canvas || !key) return;
    injectCss();
    registerBgPlugin();
    var host = ensureWrap(canvas);

    chart._aroOriginalColors = chart.data.datasets.map(function (ds) { return ds.borderColor; });
    chart._aroOriginalBgColors = chart.data.datasets.map(function (ds) { return ds.backgroundColor; });
    /* The chart's OWN config sometimes hard-sets a scale's min/max on
       purpose (the efficiency axis is always 0-100, say) — that is a
       design default, not a leftover user override, so it has to survive
       both "no pref set yet" (never touched below) and RESET (restored
       here, not blanket-deleted). Same reasoning for a scale's own tick
       formatter (a %, an engineering unit already baked into the label). */
    chart._aroOriginalScales = {};
    Object.keys(chart.options.scales || {}).forEach(function (sid) {
      var sc = chart.options.scales[sid];
      chart._aroOriginalScales[sid] = { min: sc.min, max: sc.max, tickCallback: sc.ticks && sc.ticks.callback };
    });

    bumpChartFonts(chart);
    /* 'nearest'+intersect:false — the cursor only has to be near the plot
       area at that x, not exactly on top of a point/line pixel, to raise
       the tooltip. Chart.js's own default (intersect:true) is what read as
       "hovering doesn't show the value" on anything but a dead-on hit. */
    chart.options.interaction = { mode: 'nearest', intersect: false, axis: 'x' };
    chart.options.hover = { mode: 'nearest', intersect: false };

    applyPrefs(chart, getPrefs(key));

    gearBtn(host, key, function () { return buildPanel(chart, key); });
  }

  function applyPrefs(chart, prefs) {
    var scales = chart.options.scales || {};
    Object.keys(scales).forEach(function (sid) {
      var p = prefs['scale_' + sid];
      if (p && p.min != null) scales[sid].min = p.min;
      if (p && p.max != null) scales[sid].max = p.max;
      var orig = chart._aroOriginalScales && chart._aroOriginalScales[sid];
      if (p && p.sci) {
        if (!scales[sid].ticks) scales[sid].ticks = {};
        scales[sid].ticks.callback = function (value) { return sciLabel(value); };
      } else if (orig) {
        if (!scales[sid].ticks) scales[sid].ticks = {};
        if (orig.tickCallback) scales[sid].ticks.callback = orig.tickCallback;
        else delete scales[sid].ticks.callback;
      }
    });
    if (prefs.colors) {
      Object.keys(prefs.colors).forEach(function (i) {
        var ds = chart.data.datasets[i];
        if (!ds) return;
        ds.borderColor = prefs.colors[i];
        if (ds.backgroundColor != null) ds.backgroundColor = prefs.colors[i];
      });
    }
    chart.options.aroBg = prefs.bg || null;
    chart.update('none');
  }

  function buildPanel(chart, key) {
    var prefs = getPrefs(key);
    var panel = document.createElement('div');
    panel.className = 'aro-cc-panel';
    var h = document.createElement('div');
    h.className = 'aro-cc-h'; h.textContent = 'CUSTOMIZE CHART';
    panel.appendChild(h);

    var scaleIds = Object.keys(chart.options.scales || {});
    scaleIds.forEach(function (sid) {
      var scOpt = chart.options.scales[sid];
      var scLive = chart.scales[sid] || {};
      var label = (scOpt.title && scOpt.title.text) ? scOpt.title.text : (sid.toUpperCase() + ' AXIS');
      var p = prefs['scale_' + sid] || {};
      panel.appendChild(minMaxFields(esc(label), scLive.min, scLive.max, p.min, p.max, function (min, max) {
        var cur = getPrefs(key);
        cur['scale_' + sid] = cur['scale_' + sid] || {};
        if (min !== undefined) cur['scale_' + sid].min = min;
        if (max !== undefined) cur['scale_' + sid].max = max;
        setPrefs(key, cur);
        applyPrefs(chart, cur);
      }));
      panel.appendChild(sciCheckbox(p.sci, function (on) {
        var cur = getPrefs(key);
        cur['scale_' + sid] = cur['scale_' + sid] || {};
        cur['scale_' + sid].sci = on;
        setPrefs(key, cur);
        applyPrefs(chart, cur);
      }));
    });

    var dsHead = document.createElement('div');
    dsHead.className = 'aro-cc-h2'; dsHead.textContent = 'SERIES COLOR';
    panel.appendChild(dsHead);
    chart.data.datasets.forEach(function (ds, i) {
      var cur0 = getPrefs(key);
      var val = (cur0.colors && cur0.colors[i]) || chart._aroOriginalColors[i] || '#38bdf8';
      panel.appendChild(colorField(esc(ds.label || ('Series ' + (i + 1))), val, function (v) {
        var cur = getPrefs(key);
        cur.colors = cur.colors || {};
        cur.colors[i] = v;
        setPrefs(key, cur);
        applyPrefs(chart, cur);
      }));
    });

    var bgHead = document.createElement('div');
    bgHead.className = 'aro-cc-h2'; bgHead.textContent = 'BACKGROUND';
    panel.appendChild(bgHead);
    var bgDefault = prefs.bg || (document.documentElement.classList.contains('theme-day') ? '#ffffff' : '#0b1220');
    panel.appendChild(colorField('Chart background', bgDefault, function (v) {
      var cur = getPrefs(key);
      cur.bg = v;
      setPrefs(key, cur);
      applyPrefs(chart, cur);
    }));

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button'; resetBtn.className = 'aro-cc-btn'; resetBtn.textContent = 'RESET TO DEFAULT';
    resetBtn.addEventListener('click', function () {
      setPrefs(key, {});
      scaleIds.forEach(function (sid) {
        var orig = chart._aroOriginalScales[sid] || {};
        if (orig.min !== undefined) chart.options.scales[sid].min = orig.min; else delete chart.options.scales[sid].min;
        if (orig.max !== undefined) chart.options.scales[sid].max = orig.max; else delete chart.options.scales[sid].max;
        if (chart.options.scales[sid].ticks) {
          if (orig.tickCallback) chart.options.scales[sid].ticks.callback = orig.tickCallback;
          else delete chart.options.scales[sid].ticks.callback;
        }
      });
      chart.data.datasets.forEach(function (ds, i) {
        ds.borderColor = chart._aroOriginalColors[i];
        ds.backgroundColor = chart._aroOriginalBgColors[i];
      });
      chart.options.aroBg = null;
      chart.update();
      panel.remove();
    });
    panel.appendChild(resetBtn);

    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    return panel;
  }

  /* ── enhanceCustom(): a hand-drawn (AROPUMPCHART-style) canvas ───────
     hooks = { getDefaults(): {xMax,yMax,seriesLabels?:[..]}, apply(prefs) }
     apply(prefs) is the caller's own re-draw — it reads prefs.xMax/yMax/
     bg/colors itself and redraws, exactly like a recalculation redraw
     already does. This keeps the axis-scale/color meaning (verdict
     colors, duty bands) owned by the module that understands it, while
     this file only owns the generic min/max + background chrome. */
  function customPrefs(key) { return getPrefs(key); }
  function setCustomPrefs(key, prefs) { setPrefs(key, prefs); }

  function enhanceCustom(canvas, key, hooks) {
    if (!canvas || !key || !hooks) return;
    injectCss();
    var host = ensureWrap(canvas);
    gearBtn(host, key, function () { return buildCustomPanel(canvas, key, hooks); });
  }

  function buildCustomPanel(canvas, key, hooks) {
    var prefs = getPrefs(key);
    var defaults = hooks.getDefaults() || {};
    var panel = document.createElement('div');
    panel.className = 'aro-cc-panel';
    var h = document.createElement('div');
    h.className = 'aro-cc-h'; h.textContent = 'CUSTOMIZE CHART';
    panel.appendChild(h);

    panel.appendChild(minMaxFields('X AXIS', 0, defaults.xMax, prefs.xMax, null, function (min, max) {
      var cur = getPrefs(key);
      if (max !== undefined) cur.xMax = max;
      setPrefs(key, cur);
      hooks.apply(cur);
    }));
    panel.appendChild(minMaxFields('Y AXIS', 0, defaults.yMax, prefs.yMax, null, function (min, max) {
      var cur = getPrefs(key);
      if (max !== undefined) cur.yMax = max;
      setPrefs(key, cur);
      hooks.apply(cur);
    }));
    panel.appendChild(sciCheckbox(prefs.sci, function (on) {
      var cur = getPrefs(key);
      cur.sci = on;
      setPrefs(key, cur);
      hooks.apply(cur);
    }));

    if (defaults.series && defaults.series.length) {
      var dsHead = document.createElement('div');
      dsHead.className = 'aro-cc-h2'; dsHead.textContent = 'SERIES COLOR';
      panel.appendChild(dsHead);
      defaults.series.forEach(function (sName) {
        var cur0 = getPrefs(key);
        var val = (cur0.colors && cur0.colors[sName]) || (defaults.colors && defaults.colors[sName]) || '#38bdf8';
        panel.appendChild(colorField(esc(sName), val, function (v) {
          var cur = getPrefs(key);
          cur.colors = cur.colors || {};
          cur.colors[sName] = v;
          setPrefs(key, cur);
          hooks.apply(cur);
        }));
      });
    }

    var bgHead = document.createElement('div');
    bgHead.className = 'aro-cc-h2'; bgHead.textContent = 'BACKGROUND';
    panel.appendChild(bgHead);
    var bgDefault = prefs.bg || defaults.bg || '#050810';
    panel.appendChild(colorField('Chart background', bgDefault, function (v) {
      var cur = getPrefs(key);
      cur.bg = v;
      setPrefs(key, cur);
      hooks.apply(cur);
    }));

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button'; resetBtn.className = 'aro-cc-btn'; resetBtn.textContent = 'RESET TO DEFAULT';
    resetBtn.addEventListener('click', function () {
      setPrefs(key, {});
      hooks.apply({});
      panel.remove();
    });
    panel.appendChild(resetBtn);

    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    return panel;
  }

  window.AROCHARTCTRL = {
    enhance: enhance,
    enhanceCustom: enhanceCustom,
    customPrefs: customPrefs,
    setCustomPrefs: setCustomPrefs
  };
})();
