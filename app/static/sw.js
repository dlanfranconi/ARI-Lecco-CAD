const CACHE_NAME = "ari-cad-static-v2";
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

// Only static assets are cached, and only as an offline fallback — network-first,
// not cache-first. A deploy updates these files in place at the same URLs (no
// cache-busting query params/hashes), so cache-first meant anyone who'd loaded
// the app before a deploy kept silently running old JS/CSS indefinitely, with no
// way to tell short of comparing served bytes by hand. Race logs, notices, and
// the map were already excluded from caching entirely — this closes the same gap
// for static assets: always prefer the network, fall back to cache only when a
// fetch genuinely fails (offline).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/static/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
