/**
 * PWA registration + automatic update detection
 * When a new SW is found, activates it and reloads open tabs.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  const root = (document.body && document.body.dataset && document.body.dataset.root) || './';
  const swUrl = new URL(
    (root.endsWith('/') ? root : root + '/') + 'sw.js',
    window.location.href
  ).href;
  const scopeUrl = new URL(root.endsWith('/') ? root : root + '/', window.location.href).pathname;

  function showUpdateBanner() {
    if (document.getElementById('pwa-update-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'pwa-update-banner';
    bar.setAttribute('role', 'status');
    bar.style.cssText = [
      'position:fixed', 'bottom:16px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:99999', 'background:#0A1628', 'color:#E8D48B',
      'padding:12px 18px', 'border-radius:12px', 'border:2px solid #C9A227',
      'box-shadow:0 8px 28px rgba(0,0,0,0.35)', 'font:600 14px Inter,system-ui,sans-serif',
      'display:flex', 'gap:12px', 'align-items:center', 'max-width:92vw'
    ].join(';');
    bar.innerHTML = '<span>New version available</span>';
    const btn = document.createElement('button');
    btn.textContent = 'Update now';
    btn.style.cssText = 'background:#C9A227;color:#0A1628;border:none;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;';
    btn.onclick = () => {
      if (window.__swWaiting) {
        window.__swWaiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        location.reload();
      }
    };
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  function trackWaiting(reg) {
    const sw = reg.installing || reg.waiting;
    if (!sw) return;
    sw.addEventListener('statechange', () => {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) {
        window.__swWaiting = reg.waiting || sw;
        showUpdateBanner();
      }
    });
    if (sw.state === 'installed' && navigator.serviceWorker.controller) {
      window.__swWaiting = reg.waiting || sw;
      showUpdateBanner();
    }
  }

  // Reload when new SW takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swUrl, { scope: scopeUrl })
      .then((reg) => {
        // Already waiting?
        if (reg.waiting && navigator.serviceWorker.controller) {
          window.__swWaiting = reg.waiting;
          showUpdateBanner();
        }
        reg.addEventListener('updatefound', () => trackWaiting(reg));

        // Check for updates periodically (every 30 min) + on focus
        const check = () => reg.update().catch(() => {});
        setInterval(check, 30 * 60 * 1000);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      })
      .catch(() => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
  });

  // Install app prompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.__pwaInstall = async () => {
      if (!deferredPrompt) return false;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      return outcome === 'accepted';
    };
    const btn = document.getElementById('pwa-install-btn');
    if (btn) {
      btn.hidden = false;
      btn.onclick = async () => {
        const ok = await window.__pwaInstall();
        if (ok) btn.hidden = true;
      };
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.hidden = true;
  });
})();
