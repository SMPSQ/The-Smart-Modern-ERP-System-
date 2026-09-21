// sw.js — installable app shell. Caches every page/module so the whole
// ERP keeps working with no connection at all.
const CACHE_VERSION = 'fkc-erp-v1';

const PRECACHE_URLS = [
  './',
  'index.html',
  'dashboard.html',
  'manifest.json',
  'css/style.css',
  'icons/icon.svg',
  'js/firebase-config.js',
  'js/db.js',
  'js/sync.js',
  'js/auth.js',
  'js/dashboard.js',
  'js/sw-register.js',
  'modules/school/index.html',
  'modules/school/js/school.js',
  'modules/trading-academy/index.html',
  'modules/trading-academy/js/trading.js',
  'modules/educational-academy/index.html',
  'modules/educational-academy/js/academy.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Never cache Firebase/Firestore/Auth network calls — always go live for those.
  if (req.url.includes('googleapis.com') || req.url.includes('gstatic.com') || req.url.includes('firebaseio.com')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
    })
  );
});
