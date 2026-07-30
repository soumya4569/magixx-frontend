const CACHE_NAME = 'magixx-pos-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png'
];

// Install Event — Pre-cache static shell & core UI assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

// Activate Event — Clean up stale old caches and take immediate control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Intercept requests with smart strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass API calls (keep backend data network-first)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline', message: 'You are currently working offline' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // Navigation requests (HTML SPA routing fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Update cached index.html with fresh response
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match('/');
          return cachedIndex || cache.match('/index.html');
        })
    );
    return;
  }

  // Stale-While-Revalidate for static assets (JS, CSS, images, icons)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[ServiceWorker] Asset fetch failed, using cache:', request.url, err);
        });

      return cachedResponse || fetchPromise;
    })
  );
});
