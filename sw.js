// App-shell cache so the ERP itself (not just its data) opens
// with no connection. Data offline-support is handled
// separately by js/db.js (IndexedDB) + Firestore's own
// offline cache — this file is only about the UI files.

const CACHE_NAME = "fkc-erp-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./css/style.css",
  "./js/firebase-config.js",
  "./js/db.js",
  "./js/sync.js",
  "./js/auth.js",
  "./js/dashboard.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for navigations (so staff get fresh module
// pages when online), falling back to cache when offline.
// Cache-first for static assets.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
