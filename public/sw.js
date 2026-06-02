const CACHE_NAME = "paper-pallet-pro-shell-v1";
const SHELL_URLS = [
  "/",
  "/mobile",
  "/manifest.webmanifest",
  "/pwa/icon-192.svg",
  "/pwa/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL_URLS);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put("/mobile", response.clone()).catch(() => {});
          return response;
        } catch {
          return caches.match(request) || caches.match("/mobile") || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});
