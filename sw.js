const CACHE_NAME = 'faiths-v20'; /* 버전 업 */

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './playlist.js',
  './icon/0.png',
  './icon/1.png',
  './icon/2.png',
  './icon/3.png',
  './icon/4.png',
  './icon/5.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});