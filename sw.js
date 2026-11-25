const CACHE_NAME = 'rtku-digital-cache-v3';
const assetsToCache = [
    './index.html',
    './manifest.json',
    './assets/css/style.css',
    './assets/icons/logo.png',
    './assets/icons/icon-192.png',
    './assets/js/app.js',
    './assets/js/firebase-init.js',
    './assets/js/router.js',
    './assets/js/views/home.js',
    './assets/js/views/tamu.js',
    './assets/js/views/staf.js',
    './assets/js/views/login.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(assetsToCache);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Hanya tangani request lokal untuk menghindari error CORS CDN
    if (event.request.url.startsWith(self.location.origin)) {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    }
});