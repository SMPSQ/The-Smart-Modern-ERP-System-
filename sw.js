// sw.js — auto-updating cache. Bump CACHE_VERSION on every release.
// Network-first for HTML/JS so users always get the latest after deploy.
const CACHE_VERSION = 'fkc-erp-v3';

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
  // Activate new SW immediately — no waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Tell all open tabs that a new version is live
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Never cache Firebase / Google APIs
  if (
    req.url.includes('googleapis.com') ||
    req.url.includes('gstatic.com') ||
    req.url.includes('firebaseio.com') ||
    req.url.includes('firestore.googleapis.com')
  ) {
    return;
  }

  const url = new URL(req.url);
  const isDoc =
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('sw.js');

  if (isDoc) {
    // Network-first: always try live file, fall back to cache offline
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    // Cache-first for CSS, icons, images
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          return res;
        });
      })
    );
  }
});
