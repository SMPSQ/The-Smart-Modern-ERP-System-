/* Future Tech ERP — Service Worker with auto-update cache */
const CACHE_VERSION = 'v5.1.0';
const CACHE = 'future-tech-erp-' + CACHE_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './dashboard.html',
  './parent.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/sync.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/print.js',
  './js/firebase-config.js',
  './js/sw-register.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/logo-future-tech.png',
  './icons/logo-trading-academy.png',
  './icons/logo-edu-academy.png',
  './modules/school/index.html',
  './modules/school/school.js',
  './modules/trading-academy/index.html',
  './modules/trading-academy/trading.js',
  './modules/educational-academy/index.html',
  './modules/educational-academy/academy.js'
];

// Install: precache + activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('Precache partial', err))
  );
});

// Activate: drop old caches, take control of all tabs
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('future-tech-erp-') || k.startsWith('fkc-erp-'))
          .filter((k) => k !== CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Allow page to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isHTML(request) {
  const accept = request.headers.get('accept') || '';
  return request.mode === 'navigate' || accept.includes('text/html');
}

function isCode(url) {
  return /\.(js|css|json|html)$/i.test(url.pathname) || url.pathname.endsWith('/');
}

// Network-first for HTML/JS/CSS (always try fresh), cache fallback offline
// Cache-first for images/fonts
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for app shell & code — auto picks up updates
  if (isHTML(event.request) || isCode(url)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
