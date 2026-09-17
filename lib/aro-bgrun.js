/* ═══════════════════════════════════════════════════════════════════════════
   AROGARA — BACKGROUND-RUN DEPTH  (window.AROBG)
   ---------------------------------------------------------------------------
   "user did not enter inputs, user try to run the system — why pop up window
    not showing? important started inputs data not entered, we have give signal
    inputs are not entered what are inputs. this is we already implemented all
    the system, where is gone."

   It was implemented, and it was alive — every module raises a REQUIRED INPUTS
   MISSING dialog, and every one of those dialogs opens with the same line:

       if (window.__aroBackgroundRun) return;   // a re-run is not a request

   That flag exists for a good reason. Changing the unit system, or drawing a
   leg on the workbench, re-runs modules the engineer is not looking at, and
   without the flag a heat-exchanger validator throws a full-screen complaint
   over whatever tab they were actually on.

   The flag was a boolean saved and restored around each background run:

       var was = window.__aroBackgroundRun;
       window.__aroBackgroundRun = true;
       try { fn(); } finally { setTimeout(function () {
         window.__aroBackgroundRun = was || false; }, 300); }

   That is safe for one run at a time and wrong the moment two overlap — which
   they always do, because the line-sizing services build together at startup.
   The second call captures was = true from the first, both restores run, and
   the LAST one puts true back. Nothing ever clears it again.

   Traced on a cold load: four writes, and the final state is true before the
   engineer has touched anything. From that point the guard above is always
   true, so
   pressing RUN on an empty sheet ran the validator, collected the list of
   missing inputs, called the dialog — and the dialog returned immediately
   without drawing. Silently, in every module: DPHE, STHE, PHE, tank,
   two-phase and all five line-sizing services.

   A depth counter cannot get stuck this way: overlapping runs nest instead of
   overwriting each other, and the flag is simply "is any background run still
   open". __aroBackgroundRun stays a plain boolean so every existing reader
   goes on working unchanged.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.AROBG) return;

  var depth = 0;

  function sync() { window.__aroBackgroundRun = depth > 0; }

  window.AROBG = {
    /* Mark the start of a machine-initiated run. */
    enter: function () { depth++; sync(); return depth; },
    /* Mark the end of one. Never goes below zero, so a stray exit() cannot
       leave the count negative and wedge the flag off for later runs. */
    exit: function () { depth = depth > 0 ? depth - 1 : 0; sync(); return depth; },
    /* Run fn as a background run. The exit is deferred by `ms` for callers
       that publish results on a later tick and need the flag to outlive the
       call itself. */
    run: function (fn, ms) {
      window.AROBG.enter();
      try { return fn(); }
      finally {
        if (ms > 0) setTimeout(window.AROBG.exit, ms);
        else window.AROBG.exit();
      }
    },
    depth: function () { return depth; },
    active: function () { return depth > 0; }
  };

  sync();
}());
