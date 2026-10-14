const CACHE_VERSION = "meridian-pwa-v2";
const CORE_INSTALL_ASSETS = ["/icon.svg"];
const STATIC_ASSETS = [
  "/icon.svg",
  "/countries-110m.json",
  "/countries-50m.json",
  "/country-meta.json",
];

self.addEventListener("install", (event) => {
  // Activate immediately without blocking on large map topology JSON files
  // so mobile browsers fire beforeinstallprompt on the homepage right away.
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => {
        // Warm heavy topology assets in background without delaying install completion
        cache.addAll(STATIC_ASSETS).catch(() => {});
        return cache.addAll(CORE_INSTALL_ASSETS);
      })
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  // Clean up any older caches and claim all open clients right away
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("meridian-pwa-") && key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API routes or NextAuth endpoints
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for static country topology & icons, with background revalidation
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              cache.put(request, res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }

  // Network-first for pages and bundles so new deployments always serve fresh code immediately
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (
          res &&
          res.ok &&
          (url.pathname.startsWith("/_next/static/") || request.mode === "navigate")
        ) {
          const clone = res.clone();
          caches
            .open(CACHE_VERSION)
            .then((cache) => cache.put(request, clone))
            .catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const homeCached = await caches.match("/");
          if (homeCached) return homeCached;
        }
        throw new Error("Offline and not in cache");
      })
  );
});
