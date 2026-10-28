// Service worker: cachar appens skal så att den startar och fungerar offline.
// All data ligger i IndexedDB; här cachas bara sidor och statiska filer.
const VERSION = "v1";
const PAGES = ["/", "/login", "/projekt", "/projekt/ny", "/projekt/redigera", "/besok", "/rapport", "/team", "/mallar", "/mallar/redigera", "/installningar"];
const PAGE_CACHE = `pages-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => Promise.all(PAGES.map((p) => cache.add(new Request(p, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGE_CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase m.fl. går direkt till nätet.
  if (url.pathname.startsWith("/api/")) return;

  // Byggfiler har unika namn – cache först.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Sidor: nätet först, cachad version (utan ?id=…) som reserv.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(url.pathname, res.clone());
          return res;
        } catch {
          return (await cache.match(url.pathname)) || (await cache.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  // Övrigt (RSC-förfrågningar m.m.): nätet först, cache som reserv.
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        const res = await fetch(req);
        if (res.ok && url.pathname !== "/sw.js") cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req, { ignoreSearch: false });
        return hit || Response.error();
      }
    })(),
  );
});
