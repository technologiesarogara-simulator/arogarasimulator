/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA ENGINEERING DATA LIBRARY — EDITORS & DIALOGS  (window.ARODATAEDIT)
   ---------------------------------------------------------------------------
   Every path by which a number gets into the library, or moves from it into a
   design, goes through one of the dialogs in this file. There is no other
   path, and that is deliberate.

   WHY A DIALOG AND NOT A TEXT BOX. A text box on a table row accepts "16.2",
   and what has actually been recorded is an unknown quantity, in an unknown
   unit, at an unknown temperature, from an unknown source. Three months later
   nobody can say whether it was measured, quoted, or remembered. Each editor
   here collects the value, the unit it was written in, the condition it
   applies at, and the basis it came from — because those four together are
   the record, and the number on its own is not.

   WHAT THE EDITOR DECIDES, AND WHAT IT REFUSES TO DECIDE. It works out the
   status from what was actually supplied and shows that live, before saving:
   a value with a stated basis and a stated condition is USER INPUT; without a
   basis it is UNVERIFIED; without a condition it is CONDITION INCOMPLETE. It
   will not let an engineer stamp a value VERIFIED AUTHORITATIVE by choosing
   it from a list — that status follows from the source type, not from the
   confidence of the person typing.

   And it never fills a field in. Not a plausible density, not a typical
   modulus, not a value copied from a neighbouring grade. An empty box stays
   empty until an engineer puts something in it.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var D = function () { return window.ARODATA; };
  var S = function () { return window.ARODATASTORE; };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function num(v) {
    if (v == null || v === '') return null;
    var n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }
  function fmt(v, d) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a !== 0 && (a < 1e-4 || a >= 1e7)) return Number(v).toExponential(3);
    var s = Number(v).toFixed(d == null ? 4 : d);
    return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
  }

  /* ══ STYLE ══════════════════════════════════════════════════════════════ */
  var CSSID = 'aro-de-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      /* Same two-theme palette as the workspace these dialogs open over — a
         dialog that stays dark on a light application reads as a different
         piece of software. */
      '.de-back{--de-panel:#0f172a;--de-ink:#e2e8f0;--de-head:#f1f5f9;--de-muted:#64748b;',
      '  --de-sub:#94a3b8;--de-line:#1e293b;--de-hair:#16202f;--de-field:#0b1220;',
      '  --de-accent:#38bdf8;--de-thead:#e8edf3;--de-scrim:rgba(2,6,16,.72);}',
      'body.theme-day .de-back{--de-panel:#f7f8fa;--de-ink:#1e293b;--de-head:#0b1220;',
      '  --de-muted:#64748b;--de-sub:#475569;--de-line:#d5dbe3;--de-hair:#e6eaef;',
      '  --de-field:#ffffff;--de-accent:#0369a1;--de-thead:#e6ebf1;--de-scrim:rgba(15,23,42,.42);}',
      '.de-back{position:fixed;inset:0;z-index:99995;background:var(--de-scrim);',
      '  display:flex;align-items:flex-start;justify-content:center;padding:36px 16px;overflow:auto;}',
      '.de-box{background:var(--de-panel);color:var(--de-ink);border:1px solid var(--de-line);border-radius:9px;',
      '  width:100%;max-width:760px;box-shadow:0 24px 70px var(--de-shadow,rgba(0,0,0,.5));',
      '  font-family:var(--font-sans,system-ui,sans-serif);}',
      '.de-box.wide{max-width:1080px;}',
      '.de-box *{box-sizing:border-box;}',
      '.de-h{padding:13px 17px;border-bottom:1px solid var(--de-line);display:flex;align-items:center;gap:10px;}',
      '.de-h b{font-family:var(--font-mono,ui-monospace,monospace);font-size:12px;letter-spacing:.08em;color:var(--de-accent);}',
      '.de-h small{color:var(--de-muted);font-size:10.5px;margin-left:auto;}',
      '.de-b{padding:15px 17px;max-height:70vh;overflow:auto;}',
      '.de-f{padding:11px 17px;border-top:1px solid var(--de-line);display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap;}',
      '.de-sec{font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:.11em;color:var(--de-muted);',
      '  margin:15px 0 7px;text-transform:uppercase;border-top:1px solid var(--de-hair);padding-top:11px;}',
      '.de-sec:first-child{border-top:none;margin-top:0;padding-top:0;}',
      '.de-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px;}',
      '.de-fld{display:flex;flex-direction:column;gap:3px;}',
      '.de-fld label{font-family:var(--font-mono,monospace);font-size:9px;letter-spacing:.06em;color:var(--de-muted);}',
      '.de-fld input,.de-fld select,.de-fld textarea{background:var(--de-field);border:1px solid var(--de-line);',
      '  border-radius:4px;color:var(--de-ink);padding:7px 8px;font-size:12px;outline:none;width:100%;',
      '  font-family:var(--font-sans,system-ui,sans-serif);}',
      '.de-fld textarea{font-family:var(--font-mono,ui-monospace,monospace);font-size:11px;min-height:96px;resize:vertical;}',
      '.de-fld input:focus,.de-fld select:focus,.de-fld textarea:focus{border-color:var(--de-accent);}',
      '.de-fld.req label:after{content:" ·  required";color:#fbbf24;}',
      '.de-hint{font-size:10.5px;color:var(--de-sub);line-height:1.6;margin-top:5px;}',
      '.de-warn{font-size:10.5px;line-height:1.6;color:#fbbf24;border-left:2px solid #fbbf24;',
      '  padding-left:9px;margin-top:10px;}',
      '.de-note{font-size:10.5px;line-height:1.6;color:#93c5fd;border-left:2px solid var(--de-accent);',
      '  padding-left:9px;margin-top:10px;}',
      '.de-bad{font-size:10.5px;line-height:1.6;color:#fca5a5;border-left:2px solid #f87171;',
      '  padding-left:9px;margin-top:10px;}',
      '.de-btn{font-family:var(--font-mono,monospace);font-size:10px;font-weight:700;letter-spacing:.05em;',
      '  padding:8px 13px;border-radius:4px;cursor:pointer;border:1px solid var(--de-line);',
      '  background:transparent;color:var(--de-ink);}',
      '.de-btn:hover{border-color:var(--de-accent);color:var(--de-accent);}',
      '.de-btn.go{background:var(--de-accent);border-color:var(--de-accent);color:#04121e;}',
      '.de-btn.danger{border-color:#7f1d1d;color:#fca5a5;}',
      '.de-btn:disabled{opacity:.4;cursor:not-allowed;}',
      '.de-live{font-family:var(--font-mono,monospace);font-size:10.5px;color:var(--de-ink);',
      '  background:var(--de-field);border:1px solid var(--de-line);border-radius:5px;padding:9px 11px;margin-top:11px;',
      '  line-height:1.75;}',
      '.de-live b{color:var(--de-head);}',
      '.de-badge{font-family:var(--font-mono,monospace);font-size:8px;letter-spacing:.05em;',
      '  padding:2px 6px;border-radius:3px;}',
      '.de-t{width:100%;border-collapse:collapse;font-size:11px;}',
      '.de-t th{text-align:left;font-family:var(--font-mono,monospace);font-size:8.5px;letter-spacing:.07em;',
      '  color:var(--de-muted);padding:6px 8px;border-bottom:1px solid var(--de-line);position:sticky;top:0;background:var(--de-panel);}',
      '.de-t td{padding:6px 8px;border-bottom:1px solid var(--de-hair);vertical-align:top;}',
      '.de-t td.diff{background:rgba(251,191,36,.10);}',
      '.de-pair{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(0,1.15fr) auto;gap:8px;',
      '  align-items:center;padding:7px 0;border-bottom:1px solid var(--de-hair);font-size:11.5px;}',
      '.de-pair span.ar{color:var(--de-accent);text-align:center;font-family:var(--font-mono,monospace);}',
      '.de-lin{display:grid;grid-template-columns:150px 96px minmax(0,1fr);gap:6px 10px;font-size:10.5px;',
      '  padding:6px 0;border-bottom:1px solid var(--de-hair);align-items:baseline;}',
      '.de-lin b{font-family:var(--font-mono,monospace);font-size:9.5px;letter-spacing:.05em;color:var(--de-muted);}',
      '.de-lin i{font-style:normal;font-family:var(--font-mono,monospace);font-size:9px;}',
      '.de-lin.act{background:rgba(56,189,248,.08);}',
      '.de-lin.act b{color:var(--de-accent);}',
      '.de-chip{display:inline-block;font-family:var(--font-mono,monospace);font-size:9px;padding:3px 7px;',
      '  border-radius:3px;border:1px solid var(--de-line);color:var(--de-sub);margin:0 4px 4px 0;cursor:pointer;}',
      '.de-chip.on{background:var(--de-accent);border-color:var(--de-accent);color:#04121e;font-weight:800;}'
    ].join('');
    document.head.appendChild(s);
  }

  function badgeClass(status) {
    if (/^VERIFIED/.test(status)) return 'dl-b-ver';
    if (status === 'REFERENCE ONLY') return 'dl-b-ref';
    if (status === 'USER INPUT' || status === 'USER SUPPLIED') return 'dl-b-user';
    if (status === 'CONFLICT') return 'dl-b-con';
    if (/OVERRIDE/.test(status)) return 'dl-b-inc';
    if (status === 'CONDITION INCOMPLETE') return 'dl-b-inc';
    return 'dl-b-na';
  }

  /* ══ MODAL SHELL ════════════════════════════════════════════════════════ */
  function modal(title, sub, bodyHtml, footHtml, opts) {
    css();
    opts = opts || {};
    var back = document.createElement('div');
    back.className = 'de-back';
    back.innerHTML = '<div class="de-box' + (opts.wide ? ' wide' : '') + '">'
      + '<div class="de-h"><b>' + esc(title) + '</b><small>' + esc(sub || '') + '</small></div>'
      + '<div class="de-b">' + bodyHtml + '</div>'
      + '<div class="de-f">' + footHtml + '</div></div>';
    document.body.appendChild(back);
    back.addEventListener('click', function (e) {
      if (e.target === back) back.remove();
    });
    back.close = function () { back.remove(); };
    return back;
  }

  /* ══ 1 · THE PROPERTY VALUE EDITOR ══════════════════════════════════════
     One dialog for three layers. Which layer it is writing at changes what it
     asks for and what it warns about, but the shape of a record does not:
     value, unit, condition, basis. A project or module override additionally
     requires a reason, because a divergence from the library with no stated
     reason is indistinguishable from a mistake. */
  function editValue(o) {
    var d = D(), st = S();
    if (!d || !st) return;
    o = o || {};
    var layer = o.layer || 'MASTER';                 /* MASTER | PROJECT | MODULE */
    var propKey = o.property;
    var p = d.PROPS[propKey];
    if (!p) return;
    var qty = p.qty;
    var units = d.unitsFor(qty);
    var existing = o.existing || null;

    var isOverride = layer !== 'MASTER';
    var under = d.resolve(o.subjectId, propKey, { mappingId: o.mappingId });
    var beneath = layer === 'MODULE' ? (under.projectOverride || under.masterPick)
      : (layer === 'PROJECT' ? under.masterPick : null);

    var forms = Object.keys(d.FORM_FIELDS);
    var form0 = (existing && existing.form) || o.form || 'CONSTANT';
    if (qty === 'categorical') form0 = 'CATEGORICAL';
    if (qty === 'text') form0 = 'TEXT';

    var body = ''
      + '<div class="de-sec">What is being recorded</div>'
      + '<div class="de-live">'
      + '<b>' + esc(o.subjectName || o.subjectId) + '</b> · ' + esc(p.label)
      + ' <span style="color:#64748b;">(' + esc(p.domain) + ', canonical ' + esc(d.siUnit(qty)) + ')</span>'
      + '<br>Writing at <b>' + (layer === 'MASTER' ? 'MASTER LIBRARY'
        : layer === 'PROJECT' ? 'PROJECT OVERRIDE' : 'MODULE OVERRIDE'
          + (o.object ? ' — ' + esc(o.object) : '')) + '</b>'
      + (beneath ? '<br>Underneath it, unchanged: <b>' + esc(fmt(beneath.si, 6)) + ' '
        + esc(d.siUnit(qty)) + '</b> <span class="de-badge ' + badgeClass(beneath.status) + '">'
        + esc(beneath.status) + '</span>' : '')
      + '</div>';

    if (isOverride && !beneath) {
      body += '<div class="de-warn">There is no value underneath this one. An override normally '
        + 'replaces something; here it is the only record, so consider adding it to the library '
        + 'instead — a project override on an empty property hides the fact that the library '
        + 'still holds nothing for it.</div>';
    }

    body += '<div class="de-sec">Data form</div>'
      + '<div class="de-fld"><select id="de-form">'
      + forms.map(function (f) {
        return '<option value="' + f + '"' + (f === form0 ? ' selected' : '') + '>' + f
          + ' — ' + esc(d.FORM_FIELDS[f].hint) + '</option>';
      }).join('') + '</select></div>'
      + '<div id="de-formfields"></div>'

      + '<div class="de-sec">Condition it applies at</div>'
      + '<div class="de-grid">'
      + fld('de-c-temp', 'TEMPERATURE', existing && existing.condition ? existing.condition.temperature : '', 'number')
      + sel('de-c-tempu', 'UNIT', ['°C', 'K', '°F'], (existing && existing.condition && existing.condition.temperatureUnit) || '°C')
      + fld('de-c-pres', 'PRESSURE', existing && existing.condition ? existing.condition.pressure : '', 'number')
      + sel('de-c-presu', 'UNIT', ['bar', 'kPa', 'MPa', 'psi', 'atm'], (existing && existing.condition && existing.condition.pressureUnit) || 'bar')
      + sel('de-c-phase', 'PHASE', ['', 'LIQUID', 'GAS', 'VAPOUR', 'SOLID', 'TWO-PHASE', 'SUPERCRITICAL'], (existing && existing.condition && existing.condition.phase) || '')
      + fld('de-c-conc', 'CONCENTRATION', existing && existing.condition ? existing.condition.concentration : '')
      + '</div>'
      + (o.kind === 'material'
        ? '<div class="de-grid" style="margin-top:9px;">'
          + fld('de-c-form2', 'PRODUCT FORM', existing && existing.condition ? existing.condition.productForm : '')
          + fld('de-c-heat', 'HEAT TREATMENT', existing && existing.condition ? existing.condition.heatTreatment : '')
          + fld('de-c-surf', 'SURFACE CONDITION', existing && existing.condition ? existing.condition.surfaceCondition : '')
          + fld('de-c-test', 'TEST METHOD', existing && existing.condition ? existing.condition.testMethod : '')
          + '</div>'
        : '<div class="de-grid" style="margin-top:9px;">'
          + fld('de-c-comp', 'COMPOSITION', existing && existing.condition ? existing.condition.composition : '')
          + fld('de-c-test', 'TEST METHOD', existing && existing.condition ? existing.condition.testMethod : '')
          + '</div>')
      + '<div class="de-hint">A property without its condition is a number without a meaning. '
      + 'Leave a field blank where it genuinely does not apply — blank reads NOT STATED, which is '
      + 'honest; a guessed 20 °C is not.</div>'

      + '<div class="de-sec">Basis — where this number came from</div>'
      + '<div class="de-grid">'
      + fld('de-s-src', 'ENGINEERING SOURCE', existing && existing.source ? existing.source.engineeringSource : '', 'text', true)
      + sel('de-s-type', 'SOURCE TYPE', d.SOURCE_TYPES, (existing && existing.source && existing.source.sourceType) || 'USER SUPPLIED')
      + fld('de-s-title', 'DOCUMENT TITLE', existing && existing.source ? existing.source.sourceTitle : '')
      + fld('de-s-ed', 'EDITION / YEAR', existing && existing.source ? existing.source.edition : '')
      + fld('de-s-sec', 'TABLE / SECTION', existing && existing.source ? existing.source.section : '')
      + fld('de-s-date', 'DATE CHECKED', (existing && existing.source && existing.source.dateChecked !== 'NOT STATED'
        ? existing.source.dateChecked : new Date().toISOString().slice(0, 10)), 'date')
      + '</div>'
      + '<div class="de-hint">Name the document, the datasheet, the test certificate or the '
      + 'calculation this came from. Do not paste extended text from a copyrighted handbook — a '
      + 'citation is what makes the number traceable, and a reproduction is not needed for that.</div>'

      + (isOverride
        ? '<div class="de-sec">Reason for departing from the value underneath</div>'
          + '<div class="de-fld req"><label>REASON</label>'
          + '<textarea id="de-reason" style="min-height:60px;" placeholder="e.g. Client datasheet '
          + 'DS-4471 specifies the ASTM A240 minimum at design temperature, not the room-temperature '
          + 'figure the library holds.">' + esc(o.reason || '') + '</textarea></div>'
        : '')

      + '<div class="de-fld" style="margin-top:12px;"><label>NOTE (OPTIONAL)</label>'
      + '<input id="de-note" type="text" value="' + esc((existing && existing.note) || '') + '"></div>'
      + '<div class="de-live" id="de-live">—</div>';

    var foot = '<button class="de-btn" data-de-cancel="1">CANCEL</button>'
      + (existing && layer === 'MASTER'
        ? '<button class="de-btn danger" data-de-del="1">DELETE THIS RECORD</button>' : '')
      + '<button class="de-btn go" data-de-save="1">SAVE RECORD</button>';

    var back = modal(
      existing ? 'EDIT PROPERTY VALUE' : 'ADD PROPERTY VALUE',
      p.label + ' · ' + (o.subjectName || ''), body, foot);

    function $(id) { return back.querySelector('#' + id); }

    /* ── form-dependent fields ─────────────────────────────────────────── */
    function renderForm() {
      var f = $('de-form').value;
      var spec = d.FORM_FIELDS[f] || d.FORM_FIELDS.CONSTANT;
      var h = '<div class="de-grid" style="margin-top:9px;">';
      if (spec.fields.indexOf('value') >= 0) {
        h += fld('de-v', 'VALUE', existing && existing.original != null ? existing.original : '', 'number', true);
      }
      if (spec.fields.indexOf('min') >= 0) {
        h += fld('de-min', 'MINIMUM', '', 'number', true) + fld('de-max', 'MAXIMUM', '', 'number', true);
      }
      if (spec.fields.indexOf('unit') >= 0) {
        h += sel('de-u', 'UNIT AS WRITTEN', units, (existing && existing.originalUnit) || d.siUnit(qty));
      }
      if (spec.fields.indexOf('xProperty') >= 0) {
        h += sel('de-x', 'AGAINST', ['temperature', 'pressure', 'concentration', 'strain', 'frequency'],
          (existing && existing.xProperty) || 'temperature')
          + sel('de-xu', 'ITS UNIT', ['°C', 'K', 'bar', '%', '—'], (existing && existing.xUnit) || '°C');
      }
      if (spec.fields.indexOf('curveLabel') >= 0) {
        h += fld('de-curve', 'CURVE LABEL', (existing && existing.curveLabel) || '');
      }
      if (spec.fields.indexOf('categorical') >= 0) {
        var scaleName = /workab|machin|weld|form|forge|solder|braz|heatTreat|castab/i.test(propKey)
          ? 'workability' : 'compatibility';
        h += sel('de-cat', 'RATING', d.SCALE[scaleName], (existing && existing.categorical) || d.SCALE[scaleName][1])
          + sel('de-scale', 'SCALE', Object.keys(d.SCALE), scaleName);
      }
      h += '</div>';
      if (spec.fields.indexOf('points') >= 0) {
        h += '<div class="de-fld" style="margin-top:9px;"><label>POINTS — ONE PER LINE, '
          + '“x, y”</label><textarea id="de-pts" placeholder="20, 16.2&#10;100, 17.5&#10;200, 19.0">'
          + esc(existing && existing.table
            ? existing.table.map(function (t) {
              return t[0] + ', ' + d.convert(t[1], qty, (existing.originalUnit || d.siUnit(qty)));
            }).join('\n') : '') + '</textarea></div>'
          + '<div class="de-hint">Values are interpolated between the points given and never '
          + 'extrapolated beyond them. Outside the range the library reports OUT OF RANGE rather '
          + 'than continuing the last slope.</div>';
      }
      if (spec.fields.indexOf('expression') >= 0) {
        h += '<div class="de-fld" style="margin-top:9px;"><label>EXPRESSION</label>'
          + '<input id="de-expr" type="text" placeholder="as published, with its symbols"></div>'
          + '<div class="de-grid" style="margin-top:9px;">'
          + fld('de-vars', 'VARIABLES & UNITS', '')
          + fld('de-valid', 'RANGE OF VALIDITY', '')
          + '</div>'
          + '<div class="de-warn">A correlation must be one that exists in the literature and is '
          + 'cited below. This field is not for an expression fitted here — the library has no way '
          + 'to tell an engineer where an invented correlation stops being true.</div>';
      }
      if (spec.fields.indexOf('text') >= 0) {
        h += '<div class="de-fld" style="margin-top:9px;"><label>ENTRY</label>'
          + '<input id="de-text" type="text" value="' + esc((existing && existing.text) || '') + '"></div>';
      }
      h += '<div class="de-hint">' + esc(spec.hint) + '</div>';
      $('de-formfields').innerHTML = h;
      live();
    }

    /* ── what will actually be stored, shown before it is ──────────────── */
    function gather() {
      var f = $('de-form').value;
      var unitEl = $('de-u');
      var unit = unitEl ? unitEl.value : d.siUnit(qty);
      var out = { form: f, originalUnit: unit };

      if (f === 'CONSTANT') {
        out.original = num($('de-v') && $('de-v').value);
        out.si = out.original == null ? null : d.toSI(out.original, qty, unit);
      } else if (f === 'RANGE') {
        var mn = num($('de-min') && $('de-min').value), mx = num($('de-max') && $('de-max').value);
        out.siMin = mn == null ? null : d.toSI(mn, qty, unit);
        out.siMax = mx == null ? null : d.toSI(mx, qty, unit);
        out.si = (out.siMin != null && out.siMax != null) ? (out.siMin + out.siMax) / 2 : null;
        out.original = mn != null && mx != null ? mn + ' … ' + mx : null;
        out.rangeRaw = [mn, mx];
      } else if (f === 'TABULAR' || f === 'CURVE') {
        var lines = String(($('de-pts') && $('de-pts').value) || '').split(/\n+/);
        var pts = [];
        lines.forEach(function (l) {
          var m = l.split(/[,\t;]+/);
          var x = num(m[0]), y = num(m[1]);
          if (x != null && y != null) pts.push([x, d.toSI(y, qty, unit)]);
        });
        pts.sort(function (a, b) { return a[0] - b[0]; });
        out.table = pts.length ? pts : null;
        out.xProperty = $('de-x') ? $('de-x').value : 'temperature';
        out.xUnit = $('de-xu') ? $('de-xu').value : '°C';
        out.curveLabel = $('de-curve') ? $('de-curve').value : null;
        out.si = pts.length ? pts[0][1] : null;
        out.original = pts.length ? pts.length + ' points' : null;
      } else if (f === 'CATEGORICAL') {
        out.categorical = $('de-cat') ? $('de-cat').value : null;
        out.scale = $('de-scale') ? $('de-scale').value : null;
      } else if (f === 'TEXT') {
        out.text = $('de-text') ? $('de-text').value : null;
      } else if (f === 'CORRELATION') {
        out.correlation = {
          expression: $('de-expr') ? $('de-expr').value : '',
          variables: $('de-vars') ? $('de-vars').value : '',
          validity: $('de-valid') ? $('de-valid').value : ''
        };
      }

      out.condition = {
        temperature: val('de-c-temp'), temperatureUnit: val('de-c-tempu') || '°C',
        pressure: val('de-c-pres'), pressureUnit: val('de-c-presu') || 'bar',
        phase: val('de-c-phase'), concentration: val('de-c-conc'),
        composition: val('de-c-comp'), productForm: val('de-c-form2'),
        heatTreatment: val('de-c-heat'), surfaceCondition: val('de-c-surf'),
        testMethod: val('de-c-test')
      };
      out.source = {
        engineeringSource: val('de-s-src'), sourceType: val('de-s-type'),
        sourceTitle: val('de-s-title'), edition: val('de-s-ed'),
        section: val('de-s-sec'), dateChecked: val('de-s-date'),
        softwareSource: 'Engineering Data Library — entered in application'
      };
      out.note = val('de-note');
      out.reason = val('de-reason');
      return out;
    }
    function val(id) {
      var el = $(id);
      var v = el ? String(el.value || '').trim() : '';
      return v === '' ? null : v;
    }

    /* The status is derived from what was supplied. It is not offered as a
       dropdown, because a status an engineer can choose is a status that
       says how confident they feel rather than what is actually known. */
    function statusOf(g) {
      if (layer === 'PROJECT') return 'PROJECT OVERRIDE';
      if (layer === 'MODULE') return 'MODULE OVERRIDE';
      if (!g.source.engineeringSource) return 'UNVERIFIED';
      if (!g.condition.temperature && needsCondition(propKey)) return 'CONDITION INCOMPLETE';
      return 'USER INPUT';
    }
    function needsCondition(k) {
      /* Properties whose value is meaningless without a temperature. A
         hardness designation or a weldability rating is not one of them. */
      return ['density', 'mu', 'nuKin', 'cp', 'k', 'E', 'yield', 'tensile', 'S', 'cte',
        'sigma', 'pvap', 'pr', 'alphaTh', 'elecRes', 'elecCond', 'G', 'sg',
        'enthalpy', 'entropy', 'z', 'gamma', 'cv'].indexOf(k) >= 0;
    }

    function problems(g) {
      var out = [];
      if (g.form === 'CONSTANT' && g.si == null) out.push('No value has been entered.');
      if (g.form === 'RANGE' && (g.siMin == null || g.siMax == null)) out.push('A range needs both a minimum and a maximum.');
      if (g.form === 'RANGE' && g.siMin != null && g.siMax != null && g.siMin > g.siMax) out.push('The minimum is above the maximum.');
      if ((g.form === 'TABULAR' || g.form === 'CURVE') && (!g.table || g.table.length < 2)) out.push('A table needs at least two points, one per line, as “x, y”.');
      if (g.form === 'TEXT' && !g.text) out.push('Nothing has been entered.');
      if (g.form === 'CORRELATION' && !(g.correlation && g.correlation.expression)) out.push('No expression has been entered.');
      if (isOverride && !g.reason) out.push('An override must state why the value underneath is not being used.');
      return out;
    }

    function live() {
      var g = gather();
      var st2 = statusOf(g);
      var probs = problems(g);
      var el = $('de-live');
      if (!el) return;
      var canCalc = d.canCalculate(st2);
      el.innerHTML = '<b>WILL BE STORED AS</b><br>'
        + 'Canonical SI &nbsp;<b>' + (g.si != null ? esc(fmt(g.si, 6)) + ' ' + esc(d.siUnit(qty))
          : (g.categorical ? esc(g.categorical) : (g.text ? esc(g.text) : '—'))) + '</b><br>'
        + 'As written &nbsp;' + (g.original != null ? esc(g.original) + ' ' + esc(g.originalUnit || '') : '—') + '<br>'
        + 'Condition &nbsp;' + esc(d.conditionSummary(d.condition(g.condition))) + '<br>'
        + 'Status &nbsp;<span class="de-badge ' + badgeClass(st2) + '">' + esc(st2) + '</span>'
        + ' &nbsp;· usable in a calculation: <b>' + (canCalc ? 'YES' : 'NO') + '</b>'
        + (probs.length ? '<div class="de-bad">' + probs.map(esc).join('<br>') + '</div>' : '')
        + (!g.source.engineeringSource && layer === 'MASTER'
          ? '<div class="de-warn">With no basis stated this record will be saved UNVERIFIED and '
            + 'will not be offered to a calculation. Naming where the number came from — even '
            + '“vendor quotation 4471” — is what changes that.</div>' : '');
      var save = back.querySelector('[data-de-save]');
      if (save) save.disabled = probs.length > 0;
    }

    back.addEventListener('input', live, true);
    back.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'de-form') renderForm(); else live();
    }, true);
    renderForm();

    back.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-de-cancel]')) { back.remove(); return; }
      if (t.closest('[data-de-del]')) {
        if (existing && existing.id && st.removeValue(existing.id)) {
          d.rebuild();
          back.remove();
          if (o.onDone) o.onDone({ deleted: true });
        }
        return;
      }
      if (t.closest('[data-de-save]')) {
        var g = gather();
        if (problems(g).length) return;
        var payload = {
          subjectId: o.subjectId, subjectName: o.subjectName,
          property: propKey, propertyLabel: p.label,
          form: g.form, si: g.si, siMin: g.siMin, siMax: g.siMax,
          original: g.original, originalUnit: g.originalUnit,
          table: g.table, xProperty: g.xProperty, xUnit: g.xUnit,
          curveLabel: g.curveLabel, correlation: g.correlation,
          categorical: g.categorical, text: g.text,
          condition: g.condition, source: g.source,
          status: statusOf(g), note: g.note, reason: g.reason
        };
        var res;
        if (layer === 'MASTER') {
          if (existing && existing.id) payload.id = existing.id;
          res = st.addValue(payload);
          d.rebuild();
        } else if (layer === 'PROJECT') {
          payload.was = beneath ? window.ARODATASTORE.describe(beneath) : null;
          res = st.setProjectOverride(payload);
        } else {
          payload.mappingId = o.mappingId;
          payload.object = o.object;
          payload.was = beneath ? window.ARODATASTORE.describe(beneath) : null;
          res = st.setModuleOverride(payload);
        }
        if (res && res.error) { alert(res.error); return; }
        back.remove();
        if (o.onDone) o.onDone(res);
      }
    }, true);

    return back;
  }

  function fld(id, label, value, type, req) {
    return '<div class="de-fld' + (req ? ' req' : '') + '"><label>' + esc(label) + '</label>'
      + '<input id="' + id + '" type="' + (type || 'text') + '" value="'
      + esc(value == null || value === 'NOT STATED' ? '' : value) + '"></div>';
  }
  function sel(id, label, options, chosen) {
    return '<div class="de-fld"><label>' + esc(label) + '</label><select id="' + id + '">'
      + options.map(function (o) {
        return '<option value="' + esc(o) + '"' + (o === chosen ? ' selected' : '') + '>'
          + esc(o === '' ? '— not stated —' : o) + '</option>';
      }).join('') + '</select></div>';
  }

  /* ══ 2 · ADD A PROPERTY TO THE DICTIONARY ═══════════════════════════════ */
  function addProperty(o) {
    var d = D(), st = S();
    o = o || {};
    var qtys = Object.keys({ density: 1, stress: 1, temperature: 1, pressure: 1,
      thermal_cond: 1, specific_heat: 1, dyn_visc: 1, diffusivity: 1, length: 1,
      cte: 1, fraction: 1, dimensionless: 1, velocity: 1, categorical: 1, text: 1,
      molar_mass: 1, enthalpy: 1, entropy: 1, surface_tension: 1, elec_cond: 1,
      resistivity: 1, area_mass: 1, angle: 1, surface_energy: 1 });
    var doms = d.DOMAINS.map(function (x) { return x[0]; });

    var body = '<div class="de-note">A property the dictionary does not carry. It declares a '
      + 'quantity like every other property, so it is stored in canonical SI and converts on '
      + 'display — a custom property is not a licence to keep a loose number in an unstated unit.'
      + '</div>'
      + '<div class="de-grid" style="margin-top:12px;">'
      + fld('de-p-key', 'KEY (NO SPACES)', '', 'text', true)
      + fld('de-p-label', 'LABEL', '', 'text', true)
      + sel('de-p-dom', 'DOMAIN', doms, 'USER')
      + sel('de-p-qty', 'QUANTITY', qtys, 'dimensionless')
      + sel('de-p-app', 'APPLIES TO', ['both', 'material', 'fluid'], o.kind || 'both')
      + '</div>'
      + '<div class="de-fld" style="margin-top:9px;"><label>WHAT IT MEANS</label>'
      + '<input id="de-p-note" type="text" placeholder="one line, so the next engineer knows '
      + 'what belongs in it"></div>'
      + '<div id="de-p-live" class="de-live">—</div>';

    var back = modal('ADD PROPERTY TO DICTIONARY', 'it will appear on every subject it applies to',
      body, '<button class="de-btn" data-de-cancel="1">CANCEL</button>'
      + '<button class="de-btn go" data-de-save="1">ADD PROPERTY</button>');

    function $(i) { return back.querySelector('#' + i); }
    function live() {
      var q = $('de-p-qty').value;
      $('de-p-live').innerHTML = 'Stored in <b>' + esc(d.siUnit(q) || '—') + '</b>'
        + ' · displayable as ' + esc(d.unitsFor(q).join(', '))
        + '<br>It will show <b>NOT AVAILABLE</b> on every subject until a value is entered against it.';
    }
    back.addEventListener('input', live, true);
    back.addEventListener('change', live, true);
    live();

    back.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('[data-de-cancel]')) { back.remove(); return; }
      if (e.target.closest('[data-de-save]')) {
        var key = String($('de-p-key').value || '').trim().replace(/\s+/g, '_');
        var label = String($('de-p-label').value || '').trim();
        if (!key || !label) { alert('A key and a label are both needed.'); return; }
        if (d.PROPS[key] && !d.PROPS[key].userDefined) {
          alert('The dictionary already carries "' + key + '" — ' + d.PROPS[key].label + '.');
          return;
        }
        st.addProp({ key: key, label: label, domain: $('de-p-dom').value,
          qty: $('de-p-qty').value, applies: $('de-p-app').value,
          note: $('de-p-note').value || null });
        d.rebuild();
        back.remove();
        if (o.onDone) o.onDone(key);
      }
    }, true);
  }

  /* ══ 3 · USE IN DESIGN ══════════════════════════════════════════════════
     The step where library data becomes design data. It names the module, the
     object inside it, and one module input per property. Nothing is written
     into a module input by this dialog: the mapping is recorded, and what the
     module does with it stays the module's business and the engineer's
     decision. That restraint is the reason this can ship without touching a
     single calculation. */
  function useInDesign(o) {
    var d = D(), st = S();
    o = o || {};
    var s = d.get(o.subjectId);
    if (!s) return;
    var keys = (o.keys || []).filter(function (k) { return d.PROPS[k]; });
    if (!keys.length) { alert('Tick at least one property first.'); return; }

    var mods = Object.keys(d.MODULES);
    var chosenMod = o.module || null;

    function bodyFor(mod) {
      if (!mod) {
        return '<div class="de-sec">Target module</div>'
          + mods.map(function (m) {
            var rel = d.relevantFor(m, s.kind);
            var usable = rel ? keys.filter(function (k) { return rel.indexOf(k) >= 0; }) : keys;
            var rec = usable.length === keys.length && keys.length > 0;
            return '<div class="dl-mod" data-de-mod="' + esc(m) + '">'
              + '<b>' + esc(d.MODULES[m].label) + '</b>'
              + (rec ? ' <span class="de-badge dl-b-ver">RECOMMENDED FOR THIS SELECTION</span>' : '')
              + '<div>' + usable.length + ' of ' + keys.length + ' selected properties map to an '
              + 'input here' + (usable.length < keys.length ? ' · not offered: '
                + keys.filter(function (k) { return usable.indexOf(k) < 0; }).map(function (k) {
                  return esc(d.PROPS[k].label);
                }).join(', ') : '') + '</div></div>';
          }).join('')
          + '<div class="de-hint">A module is only offered the properties it can legitimately '
          + 'consume. A magnetic permeability is not withheld from pump hydraulics out of caution '
          + '— it is simply not an input to it.</div>';
      }
      var inputs = d.moduleInputs(mod);
      var rel = d.relevantFor(mod, s.kind);
      var usable = rel ? keys.filter(function (k) { return rel.indexOf(k) >= 0; }) : keys;
      return '<div class="de-sec">Design object</div>'
        + '<div class="de-grid">'
        + fld('de-m-obj', 'TAG (E-101, P-201, LINE-14)', o.object || '', 'text', true)
        + fld('de-m-desc', 'DESCRIPTION', '')
        + '</div>'
        + '<div class="de-hint">A mapping belongs to one object. Two exchangers using the same '
        + 'material get two mappings, so an override on one cannot reach the other.</div>'
        + '<div class="de-sec">AROGARA property → module input</div>'
        + usable.map(function (k) {
          var sug = d.suggestedInput(mod, k);
          var r = d.resolve(o.subjectId, k);
          return '<div class="de-pair">'
            + '<span><b>' + esc(d.PROPS[k].label) + '</b><br>'
            + '<span style="color:#64748b;font-size:10px;">'
            + (r.effective && r.effective.si != null
              ? esc(fmt(r.effective.si, 5)) + ' ' + esc(d.siUnit(d.PROPS[k].qty))
              : 'NOT AVAILABLE') + ' · ' + esc(r.status) + '</span></span>'
            + '<span class="ar">→</span>'
            + '<select class="de-inp" data-de-prop="' + esc(k) + '">'
            + '<option value="">— not mapped —</option>'
            + inputs.map(function (i) {
              return '<option value="' + esc(i.key) + '"' + (sug && sug.key === i.key ? ' selected' : '')
                + '>' + esc(i.label) + ' (' + esc(i.unit) + ')</option>';
            }).join('')
            + '</select>'
            + '<span class="de-badge ' + badgeClass(r.status) + '">'
            + (r.usableInCalc ? 'USABLE' : 'SCREENING ONLY') + '</span>'
            + '</div>';
        }).join('')
        + (usable.some(function (k) { return !d.resolve(o.subjectId, k).usableInCalc; })
          ? '<div class="de-warn">Some of these are not cleared to feed a calculation — they are '
            + 'REFERENCE ONLY, CONDITION INCOMPLETE or in CONFLICT. The mapping still records what '
            + 'the design intends to use; the property has to be resolved before it is trusted.</div>'
          : '')
        + '<div class="de-note">Recording this mapping does not write anything into '
        + esc(d.MODULES[mod].label) + '. It states which library property this object is meant to '
        + 'be using, so that when the library value moves, the mapping goes OUTDATED and says so.</div>';
    }

    var back = modal('USE IN DESIGN', s.name + ' · ' + keys.length + ' propert'
      + (keys.length === 1 ? 'y' : 'ies'), bodyFor(chosenMod),
      '<button class="de-btn" data-de-cancel="1">CANCEL</button>'
      + (chosenMod ? '<button class="de-btn go" data-de-map="1">RECORD MAPPING</button>' : ''), { wide: true });

    function redraw() {
      back.querySelector('.de-b').innerHTML = bodyFor(chosenMod);
      back.querySelector('.de-f').innerHTML =
        '<button class="de-btn" data-de-cancel="1">CANCEL</button>'
        + (chosenMod ? '<button class="de-btn" data-de-back="1">← MODULE</button>'
          + '<button class="de-btn go" data-de-map="1">RECORD MAPPING</button>' : '');
    }

    back.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-de-cancel]')) { back.remove(); return; }
      if (t.closest('[data-de-back]')) { chosenMod = null; redraw(); return; }
      var m = t.closest('[data-de-mod]');
      if (m) { chosenMod = m.getAttribute('data-de-mod'); redraw(); return; }
      if (t.closest('[data-de-map]')) {
        var objEl = back.querySelector('#de-m-obj');
        var obj = objEl ? String(objEl.value || '').trim() : '';
        if (!obj) { alert('Name the design object this data belongs to — E-101, P-201, LINE-14.'); return; }
        var pairs = [];
        [].forEach.call(back.querySelectorAll('.de-inp'), function (selEl) {
          var pk = selEl.getAttribute('data-de-prop');
          var inp = selEl.value;
          if (!inp) return;
          var i = d.moduleInputs(chosenMod).filter(function (x) { return x.key === inp; })[0];
          pairs.push({ property: pk, propertyLabel: d.PROPS[pk].label,
            input: inp, inputLabel: i ? i.label : inp, inputUnit: i ? i.unit : null });
        });
        if (!pairs.length) { alert('Map at least one property to a module input.'); return; }
        st.addMapping({
          subjectId: s.id, subjectName: s.name, kind: s.kind,
          module: chosenMod, moduleLabel: d.MODULES[chosenMod].label,
          object: obj, objectLabel: (back.querySelector('#de-m-desc') || {}).value || null,
          pairs: pairs
        });
        d.addToProject({ subjectId: s.id, subjectName: s.name, kind: s.kind,
          module: chosenMod, properties: pairs.map(function (p) { return p.property; }) });
        back.remove();
        if (o.onDone) o.onDone();
      }
    }, true);
  }

  /* ══ 4 · IMPACT, BEFORE ANYTHING CHANGES ════════════════════════════════ */
  function impact(o) {
    var d = D();
    var imp = d.impactOf(o.subjectId, o.property);
    var s = d.get(o.subjectId);
    var body = '<div class="de-sec">What is pointing at this value now</div>'
      + (imp.total
        ? '<table class="de-t"><tr><th>OBJECT</th><th>MODULE</th><th>MAPPED AS</th><th>STATUS</th></tr>'
          + imp.mappings.map(function (m) {
            return '<tr><td><b>' + esc(m.object || '—') + '</b></td><td>' + esc(m.module) + '</td>'
              + '<td>' + m.pairs.map(function (p) { return esc(p.inputLabel); }).join(', ') + '</td>'
              + '<td><span class="de-badge ' + (m.status === 'CURRENT' ? 'dl-b-ver' : 'dl-b-inc')
              + '">' + esc(m.status) + '</span></td></tr>';
          }).join('') + '</table>'
          + '<div class="de-warn">Changing this value marks every mapping above OUTDATED. It does '
          + 'not change any module input and it does not re-run any calculation — an engineer '
          + 'decides whether the new number is the one their design should carry.</div>'
        : '<div class="de-note">Nothing is currently mapped to this value, so changing it affects '
          + 'the library only.</div>');
    modal('IMPACT ANALYSIS', (s ? s.name : '') + (o.property ? ' · ' + (d.PROPS[o.property] || {}).label : ''),
      body, '<button class="de-btn" data-de-cancel="1">CLOSE</button>');
    document.querySelectorAll('.de-back').forEach && null;
    var backs = document.querySelectorAll('.de-back');
    var back = backs[backs.length - 1];
    back.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-de-cancel]')) back.remove();
    }, true);
  }

  /* ══ 5 · COMPARE ════════════════════════════════════════════════════════ */
  function compareView(ids) {
    var d = D();
    var c = d.compare(ids);
    if (!c) { alert('Choose between two and five subjects to compare.'); return; }
    var body = '<div class="de-note">One property per row, one subject per column, every cell in '
      + 'canonical SI with its own status. Rows where the subjects differ are marked; they are not '
      + 'reconciled, because two grades are allowed to differ and the library has no business '
      + 'deciding which one a design wants.</div>'
      + '<table class="de-t" style="margin-top:11px;"><tr><th>PROPERTY</th><th>UNIT</th>'
      + c.subjects.map(function (s) { return '<th>' + esc(s.name) + '</th>'; }).join('')
      + '<th>SPREAD</th></tr>'
      + c.rows.map(function (r) {
        return '<tr><td>' + esc(r.prop.label) + '</td>'
          + '<td style="color:#64748b;font-family:ui-monospace,monospace;">'
          + esc(d.siUnit(r.prop.qty)) + '</td>'
          + r.cells.map(function (cell) {
            return '<td' + (r.differs ? ' class="diff"' : '') + '>'
              + (cell.value
                ? '<b style="font-family:ui-monospace,monospace;">'
                  + esc(cell.si != null ? fmt(cell.si, 5) : (cell.value.categorical || cell.value.text || '—'))
                  + '</b><br><span class="de-badge ' + badgeClass(cell.status) + '">'
                  + esc(cell.status) + '</span>'
                : '<span style="color:#64748b;font-style:italic;">NOT AVAILABLE</span>') + '</td>';
          }).join('')
          + '<td style="font-family:ui-monospace,monospace;color:#94a3b8;">'
          + (r.spread != null ? (r.spread * 100).toFixed(1) + '%' : '—') + '</td></tr>';
      }).join('') + '</table>';
    var back = modal('COMPARE', c.subjects.length + ' subjects · ' + c.rows.length + ' properties',
      body, '<button class="de-btn" data-de-cancel="1">CLOSE</button>', { wide: true });
    back.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-de-cancel]')) back.remove();
    }, true);
  }

  /* ══ 6 · COPY / DUPLICATE ═══════════════════════════════════════════════
     Copying values from one material to another is a real engineering act —
     a new grade in a family often starts from its neighbour. It is also
     exactly how unverified data spreads, so every copied record lands with
     its status demoted and its origin recorded as a copy. */
  function duplicateSubject(o) {
    var d = D(), st = S();
    var src = d.get(o.subjectId);
    if (!src) return;
    var rows = d.propertiesOf(src.id).filter(function (r) { return r.available; });
    var body = '<div class="de-grid">'
      + fld('de-d-name', 'NEW NAME', src.name + ' (copy)', 'text', true)
      + fld('de-d-grade', 'GRADE / DESIGNATION', '')
      + '</div>'
      + '<div class="de-sec">Values to copy (' + rows.length + ' held)</div>'
      + '<div style="max-height:230px;overflow:auto;border:1px solid #1e293b;border-radius:5px;padding:8px;">'
      + rows.map(function (r) {
        return '<label style="display:flex;gap:8px;align-items:center;font-size:11.5px;padding:3px 0;">'
          + '<input type="checkbox" class="de-cp" data-de-cp="' + esc(r.prop.key) + '" checked>'
          + esc(r.prop.label) + ' <span style="color:#64748b;">'
          + esc(r.primary && r.primary.si != null ? fmt(r.primary.si, 4) : '—') + ' '
          + esc(d.siUnit(r.prop.qty)) + '</span></label>';
      }).join('')
      + '</div>'
      + '<div class="de-warn">Every copied value is stored against the new subject as its own '
      + 'record, with its status demoted to UNVERIFIED and its origin recorded as a copy of '
      + esc(src.name) + '. A property that was checked for one grade has not been checked for '
      + 'another, and the library will not pretend otherwise.</div>';
    var back = modal('DUPLICATE SUBJECT', src.name, body,
      '<button class="de-btn" data-de-cancel="1">CANCEL</button>'
      + '<button class="de-btn go" data-de-dup="1">CREATE COPY</button>');
    back.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('[data-de-cancel]')) { back.remove(); return; }
      if (e.target.closest('[data-de-dup]')) {
        var name = String(back.querySelector('#de-d-name').value || '').trim();
        if (!name) { alert('Name the new subject.'); return; }
        var made = st.addSubject({ kind: src.kind, name: name, family: src.family,
          identity: { preferredName: name, grade: back.querySelector('#de-d-grade').value || undefined,
            family: src.family },
          copiedFrom: src.name });
        var n = 0;
        [].forEach.call(back.querySelectorAll('.de-cp'), function (cb) {
          if (!cb.checked) return;
          var k = cb.getAttribute('data-de-cp');
          var r = d.propertiesOf(src.id).filter(function (x) { return x.prop.key === k; })[0];
          if (!r || !r.primary) return;
          var v = r.primary;
          st.addValue({ subjectId: made.id, subjectName: name, property: k,
            propertyLabel: r.prop.label, form: v.form, si: v.si, siMin: v.siMin, siMax: v.siMax,
            original: v.original, originalUnit: v.originalUnit, table: v.table,
            xProperty: v.xProperty, xUnit: v.xUnit, categorical: v.categorical, text: v.text,
            condition: v.condition,
            source: { engineeringSource: 'Copied from ' + src.name,
              sourceType: 'USER SUPPLIED',
              softwareSource: 'Engineering Data Library — duplicated subject' },
            status: 'UNVERIFIED',
            note: 'Copied from ' + src.name + '. Not checked for this grade.' });
          n++;
        });
        d.rebuild();
        back.remove();
        if (o.onDone) o.onDone(made.id, n);
      }
    }, true);
  }

  /* ══ 7 · BULK EDIT ══════════════════════════════════════════════════════
     One condition or one basis applied across many properties at once — the
     realistic case being a datasheet that states everything at 20 °C. It
     changes metadata on records that already exist; it never creates a value
     and never changes a number. */
  function bulkEdit(o) {
    var d = D(), st = S();
    var s = d.get(o.subjectId);
    if (!s) return;
    var rows = d.propertiesOf(s.id).filter(function (r) {
      return r.available && r.primary && /USER INPUT|UNVERIFIED|CONDITION INCOMPLETE/.test(r.primary.status);
    });
    if (!rows.length) {
      alert('Bulk edit applies to records entered here. This subject has none yet — the migrated '
        + 'records keep the provenance they came with and are not rewritten in bulk.');
      return;
    }
    var body = '<div class="de-note">Applies a condition and a basis to records entered in this '
      + 'application. Migrated records are not offered: they carry the provenance they came with, '
      + 'and rewriting that in bulk would be inventing a source.</div>'
      + '<div class="de-sec">Apply to</div>'
      + '<div style="max-height:200px;overflow:auto;border:1px solid #1e293b;border-radius:5px;padding:8px;">'
      + rows.map(function (r) {
        return '<label style="display:flex;gap:8px;align-items:center;font-size:11.5px;padding:3px 0;">'
          + '<input type="checkbox" class="de-be" data-de-be="' + esc(r.primary.id) + '" checked>'
          + esc(r.prop.label) + ' <span class="de-badge ' + badgeClass(r.primary.status) + '">'
          + esc(r.primary.status) + '</span></label>';
      }).join('') + '</div>'
      + '<div class="de-sec">Set on all of them</div>'
      + '<div class="de-grid">'
      + fld('de-b-temp', 'TEMPERATURE', '', 'number')
      + sel('de-b-tempu', 'UNIT', ['°C', 'K', '°F'], '°C')
      + fld('de-b-src', 'ENGINEERING SOURCE', '')
      + sel('de-b-type', 'SOURCE TYPE', d.SOURCE_TYPES, 'PROJECT DATASHEET')
      + '</div>'
      + '<div class="de-hint">Leave a field blank to leave it as it is.</div>';
    var back = modal('BULK EDIT', s.name, body,
      '<button class="de-btn" data-de-cancel="1">CANCEL</button>'
      + '<button class="de-btn go" data-de-bulk="1">APPLY</button>');
    back.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('[data-de-cancel]')) { back.remove(); return; }
      if (e.target.closest('[data-de-bulk]')) {
        var temp = back.querySelector('#de-b-temp').value;
        var tempu = back.querySelector('#de-b-tempu').value;
        var src = back.querySelector('#de-b-src').value;
        var type = back.querySelector('#de-b-type').value;
        var ids = {};
        [].forEach.call(back.querySelectorAll('.de-be'), function (cb) {
          if (cb.checked) ids[cb.getAttribute('data-de-be')] = true;
        });
        var n = 0;
        st.userValues().forEach(function (v) {
          if (!ids[v.id]) return;
          var patch = JSON.parse(JSON.stringify(v));
          patch.condition = patch.condition || {};
          if (temp) { patch.condition.temperature = temp; patch.condition.temperatureUnit = tempu; }
          patch.source = patch.source || {};
          if (src) { patch.source.engineeringSource = src; patch.source.sourceType = type; }
          patch.status = patch.source.engineeringSource
            ? (patch.condition.temperature ? 'USER INPUT' : 'CONDITION INCOMPLETE') : 'UNVERIFIED';
          patch.subjectName = s.name;
          patch.reason = 'Bulk edit';
          st.addValue(patch);
          n++;
        });
        d.rebuild();
        back.remove();
        if (o.onDone) o.onDone(n);
      }
    }, true);
  }

  /* ══ 8 · IMPORT WITH A PREVIEW ══════════════════════════════════════════
     Nothing enters the library from a file without being shown first, row by
     row, with what will be created, what is a duplicate, and what will be
     refused. An import that commits before it is read is how a library
     acquires a thousand records nobody can vouch for. */
  function parseCsv(text) {
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  function inspectImport(text) {
    var d = D();
    var rows = parseCsv(text);
    if (rows.length < 2) return { error: 'The file has a header and no data rows.' };
    var head = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    function col(r, name) {
      var i = head.indexOf(name);
      return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim();
    }
    var out = [];
    rows.slice(1).forEach(function (r, n) {
      var subjectName = col(r, 'subject_name');
      var kind = (col(r, 'subject_kind') || 'material').toLowerCase();
      var pk = col(r, 'property_key');
      var form = (col(r, 'data_form') || 'CONSTANT').toUpperCase();
      var unit = col(r, 'unit');
      var raw = col(r, 'value');
      var rec = { line: n + 2, subjectName: subjectName, kind: kind, property: pk,
        form: form, unit: unit, raw: raw, problems: [], verdict: 'NEW' };
      if (!subjectName) rec.problems.push('no subject_name');
      if (!pk) rec.problems.push('no property_key');
      else if (!d.PROPS[pk]) rec.problems.push('property_key "' + pk + '" is not in the dictionary');
      if (/EXAMPLE — delete this row/i.test(subjectName)) { rec.verdict = 'SKIPPED'; rec.problems.push('template example row'); }
      var p = d.PROPS[pk];
      if (p) {
        if (unit && d.unitsFor(p.qty).indexOf(unit) < 0) {
          rec.problems.push('unit "' + unit + '" is not a unit of ' + p.qty
            + ' — expected one of ' + d.unitsFor(p.qty).join(', '));
        }
        if (form === 'CONSTANT') {
          var v = num(raw);
          if (v == null) rec.problems.push('value is not a number');
          else rec.si = d.toSI(v, p.qty, unit || d.siUnit(p.qty));
        } else if (form === 'TABULAR' || form === 'CURVE') {
          var xs = col(r, 'x_values').split(/[;|]/).map(num).filter(function (x) { return x != null; });
          var ys = col(r, 'y_values').split(/[;|]/).map(num).filter(function (x) { return x != null; });
          if (!xs.length || xs.length !== ys.length) rec.problems.push('x_values and y_values must be the same length');
          else rec.table = xs.map(function (x, i2) { return [x, d.toSI(ys[i2], p.qty, unit || d.siUnit(p.qty))]; });
        }
      }
      var sid = kind + ':user:' + subjectName.toLowerCase().replace(/\s+/g, '-');
      var known = d.get(kind + ':' + subjectName.toLowerCase()) || d.get(sid);
      if (known) { rec.subjectId = known.id; rec.verdict = 'ADDS TO EXISTING SUBJECT'; }
      else rec.subjectId = sid;
      if (known && p && d.masterValues(known.id, pk).length) rec.verdict = 'SECOND RECORD — WILL READ CONFLICT';
      rec.source = col(r, 'engineering_source');
      rec.sourceType = col(r, 'source_type') || 'SECONDARY REFERENCE';
      rec.temperature = col(r, 'temperature');
      rec.temperatureUnit = col(r, 'temperature_unit') || '°C';
      rec.status = !rec.source ? 'UNVERIFIED'
        : (!rec.temperature ? 'CONDITION INCOMPLETE' : 'IMPORTED — PENDING REVIEW');
      if (rec.problems.length && rec.verdict !== 'SKIPPED') rec.verdict = 'REFUSED';
      out.push(rec);
    });
    return { rows: out };
  }

  function importDialog(o) {
    var d = D(), st = S();
    o = o || {};
    var parsed = null;
    var body = '<div class="de-note">Paste the completed import template, or choose the file. '
      + 'Every row is shown before anything is committed — what will be created, what is a second '
      + 'record against a property that already has one, and what will be refused and why.</div>'
      + '<div class="de-fld" style="margin-top:11px;"><label>CSV</label>'
      + '<textarea id="de-i-text" style="min-height:130px;" placeholder="subject_kind,subject_name,…">'
      + '</textarea></div>'
      + '<div style="margin-top:8px;"><input type="file" id="de-i-file" accept=".csv,text/csv"></div>'
      + '<div id="de-i-out"></div>';
    var back = modal('IMPORT DATA', 'controlled ingestion — preview first', body,
      '<button class="de-btn" data-de-cancel="1">CANCEL</button>'
      + '<button class="de-btn" data-de-inspect="1">INSPECT</button>'
      + '<button class="de-btn go" data-de-commit="1" disabled>COMMIT ACCEPTED ROWS</button>', { wide: true });

    function show() {
      var res = inspectImport(back.querySelector('#de-i-text').value || '');
      if (res.error) {
        back.querySelector('#de-i-out').innerHTML = '<div class="de-bad">' + esc(res.error) + '</div>';
        return;
      }
      parsed = res.rows;
      var ok = parsed.filter(function (r) { return r.verdict !== 'REFUSED' && r.verdict !== 'SKIPPED'; });
      back.querySelector('#de-i-out').innerHTML =
        '<div class="de-sec">Preview — ' + parsed.length + ' rows, ' + ok.length + ' would be committed</div>'
        + '<table class="de-t"><tr><th>LINE</th><th>SUBJECT</th><th>PROPERTY</th><th>VALUE</th>'
        + '<th>STATUS IT WOULD GET</th><th>VERDICT</th></tr>'
        + parsed.map(function (r) {
          return '<tr><td>' + r.line + '</td><td>' + esc(r.subjectName) + '</td>'
            + '<td>' + esc(r.property) + '</td>'
            + '<td style="font-family:ui-monospace,monospace;">'
            + esc(r.si != null ? fmt(r.si, 5) : (r.table ? r.table.length + ' pts' : r.raw)) + '</td>'
            + '<td><span class="de-badge ' + badgeClass(r.status) + '">' + esc(r.status) + '</span></td>'
            + '<td>' + (r.problems.length
              ? '<span style="color:#fca5a5;">' + esc(r.verdict) + ' — ' + esc(r.problems.join('; ')) + '</span>'
              : esc(r.verdict)) + '</td></tr>';
        }).join('') + '</table>'
        + '<div class="de-warn">Committed rows arrive as IMPORTED — PENDING REVIEW at best. None of '
        + 'them is cleared to feed a calculation until an engineer has checked it against the source '
        + 'it cites.</div>';
      back.querySelector('[data-de-commit]').disabled = ok.length === 0;
    }

    back.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'de-i-file' && e.target.files && e.target.files[0]) {
        var fr = new FileReader();
        fr.onload = function () {
          back.querySelector('#de-i-text').value = String(fr.result || '');
          show();
        };
        fr.readAsText(e.target.files[0]);
      }
    }, true);

    back.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('[data-de-cancel]')) { back.remove(); return; }
      if (e.target.closest('[data-de-inspect]')) { show(); return; }
      if (e.target.closest('[data-de-commit]')) {
        if (!parsed) return;
        var n = 0;
        parsed.forEach(function (r) {
          if (r.verdict === 'REFUSED' || r.verdict === 'SKIPPED') return;
          if (!d.get(r.subjectId)) {
            st.addSubject({ id: r.subjectId, kind: r.kind, name: r.subjectName });
          }
          st.addValue({
            subjectId: r.subjectId, subjectName: r.subjectName, property: r.property,
            propertyLabel: (d.PROPS[r.property] || {}).label, form: r.form,
            si: r.si, original: num(r.raw), originalUnit: r.unit || null,
            table: r.table || null,
            condition: { temperature: r.temperature || null, temperatureUnit: r.temperatureUnit },
            source: { engineeringSource: r.source, sourceType: r.sourceType,
              softwareSource: 'Engineering Data Library — CSV import' },
            status: r.status, reason: 'Imported'
          });
          n++;
        });
        d.rebuild();
        back.remove();
        if (o.onDone) o.onDone(n);
      }
    }, true);
  }

  /* ══ 9 · COMPOSITION ════════════════════════════════════════════════════ */
  function compositionDialog(o) {
    var d = D(), st = S();
    var s = d.get(o.subjectId);
    if (!s) return;
    var rows = st.composition(s.id);
    var body = '<div class="de-note">Composition as the specification states it — minimum, maximum '
      + 'and typical, per element. A single number is recorded as typical only if the source gives '
      + 'it as typical; a specification limit is not a typical value and the two are not merged.</div>'
      + '<div class="de-fld" style="margin-top:11px;"><label>ONE PER LINE — “ELEMENT, MIN, MAX, TYPICAL” (%)</label>'
      + '<textarea id="de-comp" placeholder="Cr, 16.0, 18.0,&#10;Ni, 10.0, 14.0,&#10;C, , 0.030,">'
      + esc(rows.map(function (r) {
        return [r.element, r.min == null ? '' : r.min, r.max == null ? '' : r.max,
          r.typical == null ? '' : r.typical].join(', ');
      }).join('\n')) + '</textarea></div>'
      + '<div class="de-hint">Leave a column blank where the specification does not state it.</div>';
    var back = modal('COMPOSITION', s.name, body,
      '<button class="de-btn" data-de-cancel="1">CANCEL</button>'
      + '<button class="de-btn go" data-de-comp="1">SAVE COMPOSITION</button>');
    back.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('[data-de-cancel]')) { back.remove(); return; }
      if (e.target.closest('[data-de-comp]')) {
        var out = [];
        String(back.querySelector('#de-comp').value || '').split(/\n+/).forEach(function (l) {
          var m = l.split(/[,\t;]/);
          var el = String(m[0] || '').trim();
          if (!el) return;
          out.push({ element: el, min: num(m[1]), max: num(m[2]), typical: num(m[3]) });
        });
        st.setComposition(s.id, out);
        back.remove();
        if (o.onDone) o.onDone(out.length);
      }
    }, true);
  }

  window.ARODATAEDIT = {
    editValue: editValue, addProperty: addProperty, useInDesign: useInDesign,
    impact: impact, compareView: compareView, duplicateSubject: duplicateSubject,
    bulkEdit: bulkEdit, importDialog: importDialog, inspectImport: inspectImport,
    compositionDialog: compositionDialog, modal: modal, parseCsv: parseCsv
  };
})();
