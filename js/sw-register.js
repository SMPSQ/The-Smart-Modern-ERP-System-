// js/sw-register.js — registers the service worker at the correct scope,
// whether the page is at the repo root or nested under modules/<name>/.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const root = document.body.dataset.root || '';
    navigator.serviceWorker.register(root + 'sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
