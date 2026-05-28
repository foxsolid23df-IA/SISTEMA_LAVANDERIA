const DRIVER_CACHE = "driver-portal-shell-v1";
const DRIVER_SHELL = ["/chofer", "/logo_nexum.png", "/driver-manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(DRIVER_CACHE).then((cache) => cache.addAll(DRIVER_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("driver-portal-") && key !== DRIVER_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    if (url.pathname === "/chofer") {
      event.respondWith(
        fetch(request).catch(() => caches.match("/chofer").then((cached) => cached || caches.match("/index.html")))
      );
    }
    return;
  }

  const isDriverAsset =
    url.pathname === "/logo_nexum.png" ||
    url.pathname === "/driver-manifest.webmanifest" ||
    url.pathname.startsWith("/assets/");

  if (!isDriverAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(DRIVER_CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
