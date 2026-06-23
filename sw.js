const CACHE_NAME = 'levelup-life-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Just cache the root files
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

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
