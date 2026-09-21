// js/sw-register.js — registers SW and auto-reloads when a new version is available
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const root = document.body.dataset.root || '';
    navigator.serviceWorker
      .register(root + 'sw.js')
      .then((reg) => {
        // Check for updates every time the page loads + every 5 minutes
        reg.update();
        setInterval(() => reg.update(), 5 * 60 * 1000);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version ready — tell it to take over, then reload
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });

    // When the controlling SW changes (after skipWaiting), reload once
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
