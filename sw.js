/* AROGARA service worker — makes the app installable (PWA / APK-ready).
   Strategy:
   - Navigations (HTML) and code (js/css): network-first, so a new deploy's
     fixes are visible on the very next load, not one load later — falls
     back to the cached copy only when offline.
   - Other static assets (png/etc.): stale-while-revalidate for fast loads
     that still refresh in the background.
   Bump CACHE on each release so old assets are cleared. */
var CACHE = 'arogara-v64';
var SHELL = ['/', '/index.html', '/manifest.json',
  '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return c.add(u).catch(function () {});   // don't fail install if one asset is missing
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // don't touch cross-origin (fonts, APIs)

  // HTML navigations and app code (js/css) → network-first, so a deploy's
  // fixes show up immediately instead of needing a second reload.
  /* The OCR engine and its language data are large (~9.5 MB) and immutable —
     they change only when the vendored version does. Treating them as app
     code would put them on the network-first path and re-download the lot
     every time someone reads a drawing. They take the stale-while-revalidate
     route below instead, so the second use is instant. */
  var isVendorBlob = url.pathname.indexOf('/lib/ocr/') !== -1;
  var isCode = !isVendorBlob && /\.(js|css)$/.test(url.pathname);
  if (isCode || req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        // Only ever cache a GOOD response. Storing a 404/500 here would
        // poison the cache: the bad body then becomes what the offline
        // fallback below serves, so a single transient error during a
        // deploy could leave the app permanently broken for that visitor.
        if (res && res.ok) {
          var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('/index.html'); });
      })
    );
    return;
  }

  // Other same-origin assets (images, icons) → stale-while-revalidate
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) {   // same rule as above — never store a bad response
          var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
