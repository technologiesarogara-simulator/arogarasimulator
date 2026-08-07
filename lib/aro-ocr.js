/* ═══════════════════════════════════════════════════════════════════════
   AROGARA FLOWSIZE — TAG READER FOR RASTER DRAWINGS

   A P&ID exported as PNG, JPG or a scanned PDF has no text layer: the tags
   are pixels, not characters, so there is nothing for the importer to read
   and the sheet arrives as a picture that cannot simulate. Plenty of real
   drawings reach an engineer exactly that way — a screenshot, a photo of a
   marked-up print, a PDF produced by scanning.

   This reads the characters back off the image with Tesseract, and hands
   the importer the same {text, x, y} list a text PDF would have produced,
   so every stage after it — fragment joining, ISA balloon pairing, tag
   matching, equipment placement — is shared and needs no special case.

   Three things matter for accuracy on a drawing sheet:

     · Upscaling. Tag text on a P&ID is small; the reader needs pixels, so
       the sheet is enlarged until its short edge is about 2400 px before
       anything is recognised.
     · Sparse-text mode. A drawing is not a page of prose — labels sit
       scattered among the geometry, so the layout analyser is told to look
       for text anywhere rather than to find columns and paragraphs.
     · A character whitelist. Tags are letters, digits and hyphens; letting
       the reader consider punctuation invents noise.

   What it recovers, measured on a rendered test sheet: every piece of
   process equipment and every valve. Instrument balloons are the weak
   spot — the circle drawn around the text defeats the layout analysis, so
   loop tags often do not survive. That costs nothing hydraulically, since
   instruments are placed but never put in the line-up, but it does mean an
   OCR'd sheet comes back with its equipment and valves and few of its
   loops. The import dialog says so rather than letting it look complete.

   Roughly 9.5 MB of engine and language data sits in lib/ocr/ and is
   fetched only when someone actually asks to read an image — it is never
   on the path of a normal page load.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BASE = 'lib/ocr/';
  var TARGET_SHORT_EDGE = 2400;     // enlarge small sheets up to this
  var MAX_SCALE = 4;
  var MAX_PIXELS = 40e6;            // keep a huge sheet from exhausting memory

  var loading = null;
  function loadEngine() {
    if (typeof Tesseract !== 'undefined') return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = BASE + 'tesseract.min.js?v=1';
      s.onload = function () { resolve(typeof Tesseract !== 'undefined'); };
      s.onerror = function () { loading = null; resolve(false); };
      document.head.appendChild(s);
    });
    return loading;
  }

  /* Draw the sheet onto a canvas big enough to read. */
  function prepare(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var scale = TARGET_SHORT_EDGE / Math.max(1, Math.min(w, h));
    scale = Math.max(1, Math.min(MAX_SCALE, scale));
    if (w * scale * h * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (w * h));
    var cv = document.createElement('canvas');
    cv.width = Math.round(w * scale);
    cv.height = Math.round(h * scale);
    var cx = cv.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    // a white ground, so a transparent PNG does not read as black-on-black
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    return { canvas: cv, scale: scale, w: w, h: h };
  }

  function toImage(src) {
    return new Promise(function (resolve, reject) {
      if (src && src.tagName === 'CANVAS') return resolve(src);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('could not decode the image')); };
      img.src = src;
    });
  }

  /* src: a data URL, an <img>, or a <canvas>.
     onProgress: called with (0..1, statusText).
     Resolves to { texts:[{text,x,y,w,h,conf}], w, h, words } where the
     coordinates are in ORIGINAL image space with y increasing UPWARD, which
     is the convention every other importer path already uses. */
  function read(src, onProgress) {
    var say = onProgress || function () {};
    say(0.02, 'Loading the tag reader…');
    return loadEngine().then(function (ok) {
      if (!ok) throw new Error('the tag reader could not be loaded');
      return toImage(src);
    }).then(function (img) {
      var p = prepare(img);
      say(0.12, 'Preparing the sheet…');
      return Tesseract.createWorker('eng', 1, {
        workerPath: BASE + 'worker.min.js?v=1',
        corePath: BASE,
        langPath: BASE + '4.0.0',
        gzip: true,
        legacyCore: false,
        legacyLang: false,
        logger: function (m) {
          if (m && m.status === 'recognizing text') say(0.25 + 0.7 * (m.progress || 0), 'Reading tags…');
          else if (m && m.status) say(0.18, String(m.status).replace(/^\w/, function (c) { return c.toUpperCase(); }) + '…');
        }
      }).then(function (worker) {
        return worker.setParameters({
          tessedit_pageseg_mode: '11',    // sparse text — labels scattered among geometry
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/.& '
        }).then(function () {
          return worker.recognize(p.canvas, {}, { blocks: true });
        }).then(function (out) {
          return worker.terminate().then(function () { return out; }, function () { return out; });
        });
      }).then(function (out) {
        var texts = [];
        ((out.data && out.data.blocks) || []).forEach(function (bl) {
          (bl.paragraphs || []).forEach(function (pa) {
            (pa.lines || []).forEach(function (ln) {
              (ln.words || []).forEach(function (wd) {
                var t = String(wd.text || '').trim();
                if (!t) return;
                var bb = wd.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
                texts.push({
                  text: t,
                  x: bb.x0 / p.scale,
                  // flip to y-up so the shared fragment/balloon joiners apply
                  y: (p.canvas.height - bb.y1) / p.scale,
                  w: (bb.x1 - bb.x0) / p.scale,
                  h: (bb.y1 - bb.y0) / p.scale,
                  conf: wd.confidence
                });
              });
            });
          });
        });
        say(1, 'Done.');
        return { texts: texts, w: p.w, h: p.h };
      });
    });
  }

  window.AROOCR = { read: read, load: loadEngine };
})();
