const CACHE_NAME = 'levelup-life-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force the waiting service worker to become active immediately
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './app.js',
        './sprites.js',
        './berries.js'
      ]);
    })
  );
});

// Clear old caches on activation
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First Strategy: Fetch from network first, fall back to cache if offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Do not cache API endpoints, Netlify functions, or identity calls
  if (e.request.url.includes('/.netlify/') || e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
