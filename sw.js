/* AROGARA service worker — makes the app installable (PWA / APK-ready).
   Strategy:
   - Navigations (HTML): network-first, so a new deploy is always picked up;
     falls back to a cached shell only when offline.
   - Static assets (js/css/png/etc.): stale-while-revalidate for fast loads
     that still refresh in the background.
   Bump CACHE on each release so old assets are cleared. */
var CACHE = 'arogara-v1';
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

  // HTML navigations → network-first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('/index.html'); });
      })
    );
    return;
  }

  // Other same-origin assets → stale-while-revalidate
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
