/* Future Tech ERP — Service Worker
   Bump CACHE_VERSION on every deploy → clients auto-detect + update banner */
const CACHE_VERSION = 'v6.6.1';
const CACHE = 'future-tech-erp-' + CACHE_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './dashboard.html',
  './parent.html',
  './manifest.json',
  './VERSION.txt',
  './css/style.css',
  './js/db.js',
  './js/sync.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/print.js',
  './js/staff-auth.js',
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
  './modules/educational-academy/academy.js',
  './modules/shop/index.html',
  './modules/shop/shop.js',
  './modules/library/index.html',
  './modules/library/library.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(PRECACHE).catch(() => cache.addAll(PRECACHE.slice(0, 10)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                (k.startsWith('future-tech-erp-') || k.startsWith('fkc-erp-')) &&
                k !== CACHE
            )
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((c) =>
            c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
          );
        })
      )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source &&
      event.source.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
  }
});

function isHTML(request) {
  const accept = request.headers.get('accept') || '';
  return request.mode === 'navigate' || accept.includes('text/html');
}

function isCode(url) {
  return (
    /\.(js|css|json|html|txt)$/i.test(url.pathname) ||
    url.pathname.endsWith('/')
  );
}

// Network-first for HTML/JS/CSS/VERSION (fresh after deploy)
// Cache-first for images/icons
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Always network for version + SW itself
  if (
    url.pathname.endsWith('/VERSION.txt') ||
    url.pathname.endsWith('/sw.js') ||
    url.pathname.endsWith('/sw-register.js')
  ) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match(req))
    );
    return;
  }

  if (isHTML(req) || isCode(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((c) => c || caches.match('./dashboard.html'))
        )
    );
    return;
  }

  // Images etc — cache first
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});
