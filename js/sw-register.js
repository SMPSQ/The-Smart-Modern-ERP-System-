/**
 * Service Worker register + auto-update banner
 * Replace js/sw-register.js — shows "New version available" when CACHE_VERSION changes
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  const APP_VERSION = '6.0.0'; // keep in sync with sw.js CACHE_VERSION (without "v")

  function showUpdateBanner() {
    if (document.getElementById('ft-update-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'ft-update-banner';
    bar.setAttribute(
      'style',
      [
        'position:fixed',
        'bottom:16px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:99999',
        'background:linear-gradient(135deg,#0A1628,#0F2A4A)',
        'color:#E8D48B',
        'padding:12px 18px',
        'border-radius:12px',
        'border:2px solid #C9A227',
        'box-shadow:0 12px 40px rgba(0,0,0,0.35)',
        'display:flex',
        'align-items:center',
        'gap:12px',
        'font-family:Inter,system-ui,sans-serif',
        'font-size:14px',
        'font-weight:600',
        'max-width:92vw'
      ].join(';')
    );
    bar.innerHTML =
      '<span>New app version ready (v' +
      APP_VERSION +
      ')</span>' +
      '<button type="button" id="ft-update-reload" style="background:#C9A227;color:#0A1628;border:none;padding:8px 14px;border-radius:8px;font-weight:800;cursor:pointer;font-family:inherit;">Update now</button>';
    document.body.appendChild(bar);
    document.getElementById('ft-update-reload').onclick = () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    };
  }

  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI || window.location.href).href;
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        // Check for updates periodically
        setInterval(() => {
          try {
            reg.update();
          } catch (_) {}
        }, 60 * 1000);

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });
      })
      .catch((err) => console.warn('SW register failed', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New SW took control — optional soft reload once
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        showUpdateBanner();
      }
    });
  });

  // Expose version for UI
  window.__FT_APP_VERSION = APP_VERSION;
})();
