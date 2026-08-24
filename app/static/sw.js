const CACHE_NAME = "ari-cad-static-v1";
const STATIC_ASSETS = [
  "/static/styles.css",
  "/static/theme.js",
  "/static/race-timer.js",
  "/static/announcer.js",
  "/static/race-log.js",
  "/static/notice-compose.js",
  "/static/review-alert.js",
  "/static/notices-live.js",
  "/static/setup.js",
  "/static/map.js",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// Only static assets are cached. Race logs, notices, and the map are live data —
// they must always hit the network, never be served stale from a cache.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/static/")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
