/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — DATE FIELDS  (window.ARODATE)
   ---------------------------------------------------------------------------
   Every date box in the suite is a real <input type="date">, so the browser
   has always had a calendar to offer. Two things stopped an engineer ever
   seeing it.

   THE PICKER BUTTON WAS INVISIBLE. Each of these fields was written with
   `color-scheme: dark` hard-coded in its style attribute — in the pump data
   sheet, in all five line-sizing sheets, in two-phase, in the shared data
   sheet used by the exchangers and the tank, in the plate exchanger, in the
   project card and in the library's source form. That tells the browser to
   draw the control's own furniture for a dark background, so it renders the
   calendar glyph in a pale colour. On a dark theme that is right. In LIGHT
   mode the field is white and a pale glyph on white is nothing at all — the
   box reads as a plain mm/dd/yyyy you can only type into, which is exactly
   what was reported.

   Because the declaration is inline on every one of those fields, no ordinary
   stylesheet rule can reach it. These two do, and they follow the theme
   instead of assuming one.

   CLICKING THE FIELD DID NOTHING. Even with the glyph visible, the calendar
   only opened if you hit that one small target. Clicking the field itself —
   what everyone actually does — just put a cursor in the month segment. The
   click that focuses a date field now opens the calendar.

   Typing still works exactly as before. A later click inside an already
   focused field is left alone, so an engineer correcting just the year is not
   fighting a calendar that reopens every time they click.

   This is global and delegated, so it covers every date field in the suite,
   including the ones modules build after this file has run.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var CSSID = 'aro-datefield-css';
  function css() {
    if (document.getElementById(CSSID)) return;
    var s = document.createElement('style');
    s.id = CSSID;
    s.textContent = [
      /* !important because every one of these fields carries the opposite
         declaration in its own style attribute — see the note above. */
      'input[type="date"],input[type="datetime-local"],input[type="month"],input[type="time"]{',
      '  color-scheme:dark !important;}',
      'body.theme-day input[type="date"],body.theme-day input[type="datetime-local"],',
      'body.theme-day input[type="month"],body.theme-day input[type="time"]{',
      '  color-scheme:light !important;}',
      /* the calendar button: always shown, always obviously a button */
      'input[type="date"]::-webkit-calendar-picker-indicator,',
      'input[type="datetime-local"]::-webkit-calendar-picker-indicator,',
      'input[type="month"]::-webkit-calendar-picker-indicator{',
      '  opacity:1;cursor:pointer;padding:0 1px;margin-left:4px;border-radius:3px;}',
      'input[type="date"]::-webkit-calendar-picker-indicator:hover,',
      'input[type="datetime-local"]::-webkit-calendar-picker-indicator:hover,',
      'input[type="month"]::-webkit-calendar-picker-indicator:hover{',
      '  background:rgba(255,117,56,0.22);}',
      /* the whole field reads as something you press */
      'input[type="date"],input[type="datetime-local"],input[type="month"]{cursor:pointer;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  var TYPES = { date: 1, 'datetime-local': 1, month: 1, week: 1, time: 1 };
  function dateField(n) {
    while (n && n !== document) {
      if (n.tagName === 'INPUT' && TYPES[n.type]) return n;
      n = n.parentNode;
    }
    return null;
  }

  /* showPicker() must be called from a user gesture, and throws if the
     browser already has the calendar open — which is the case when the click
     landed on the native button. Both are expected; neither is an error
     worth surfacing. */
  function open(el) {
    if (!el || el.disabled || el.readOnly) return;
    if (typeof el.showPicker !== 'function') return;
    try { el.showPicker(); } catch (e) {}
  }

  /* Was this click the one that focuses the field? If the engineer is already
     in the box, they are editing a segment and the calendar stays out of it. */
  var WASFOCUSED = true;

  document.addEventListener('mousedown', function (e) {
    var el = dateField(e.target);
    if (!el) return;
    WASFOCUSED = (document.activeElement === el);
  }, true);

  document.addEventListener('click', function (e) {
    var el = dateField(e.target);
    if (!el || WASFOCUSED) return;
    WASFOCUSED = true;
    /* after the browser has finished focusing it */
    setTimeout(function () { open(el); }, 0);
  }, true);

  /* Keyboard parity: a field reached by Tab opens on Enter or Space, so the
     calendar is not mouse-only. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var el = dateField(e.target);
    if (!el) return;
    e.preventDefault();
    open(el);
  }, true);

  window.ARODATE = { open: open, fields: function () {
    return [].slice.call(document.querySelectorAll(
      'input[type="date"],input[type="datetime-local"],input[type="month"],input[type="time"]'));
  } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', css);
  else css();
  /* Panels build later; the stylesheet is global so it needs no rescan, but
     re-assert it if something replaced the head wholesale. */
  setTimeout(css, 1500);
})();
