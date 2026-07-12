/*
 * A small offline cache for Cherishing. Because built asset names are hashed,
 * we cache at runtime (stale-while-revalidate) rather than precaching a fixed
 * list — after the first visit the app opens offline. No user data is cached
 * here; memories live in IndexedDB.
 */
const CACHE = 'cherishing-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => undefined);

      if (cached) {
        network; // revalidate in the background
        return cached;
      }
      const res = await network;
      if (res) return res;

      // Offline navigation with nothing cached yet → fall back to the app shell.
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html') || await cache.match('./');
        if (shell) return shell;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })(),
  );
});
