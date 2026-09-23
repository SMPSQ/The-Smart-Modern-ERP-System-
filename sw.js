const CACHE = 'fkc-erp-v4-1';
const ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './css/style.css',
  './js/db.js',
  './js/sync.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/print.js',
  './js/firebase-config.js',
  './js/sw-register.js',
  './manifest.json',
  './icons/icon.svg',
  './modules/school/index.html',
  './modules/school/school.js',
  './modules/trading-academy/index.html',
  './modules/trading-academy/trading.js',
  './modules/educational-academy/index.html',
  './modules/educational-academy/academy.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => cached))
  );
});
