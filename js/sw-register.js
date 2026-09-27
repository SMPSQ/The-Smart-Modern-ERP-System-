/**
 * Service Worker register + automatic app version updates
 * - Registers SW
 * - Checks for updates every 30s + on focus/visibility
 * - Fetches VERSION.txt (network) and compares with local APP_VERSION
 * - Shows "Update now" banner when new version is available
 * - Auto-reloads once after SW activates (optional soft)
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  // Keep in sync with sw.js CACHE_VERSION (without leading "v")
  const APP_VERSION = '6.3.2';
  const VERSION_KEY = 'ft_app_version_seen';

  function showUpdateBanner(ver) {
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
        'background:linear-gradient(135deg,#020B1A,#0B3D6E)',
        'color:#F0D78C',
        'padding:14px 20px',
        'border-radius:14px',
        'border:2px solid #D4AF37',
        'box-shadow:0 16px 48px rgba(0,0,0,0.4)',
        'display:flex',
        'align-items:center',
        'gap:14px',
        'font-family:Inter,system-ui,sans-serif',
        'font-size:14px',
        'font-weight:600',
        'max-width:94vw'
      ].join(';')
    );
    const label = ver || APP_VERSION;
    bar.innerHTML =
      '<span>🔄 New version available (v' +
      label +
      ')</span>' +
      '<button type="button" id="ft-update-reload" style="background:#D4AF37;color:#020B1A;border:none;padding:9px 16px;border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit;font-size:13px;">Update now</button>' +
      '<button type="button" id="ft-update-dismiss" style="background:transparent;color:#94A3B8;border:none;padding:6px 8px;cursor:pointer;font-size:18px;line-height:1;">×</button>';
    document.body.appendChild(bar);
    document.getElementById('ft-update-reload').onclick = () => {
      try {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (_) {}
      // Bust cache on reload
      const u = new URL(window.location.href);
      u.searchParams.set('_v', String(Date.now()));
      window.location.replace(u.toString());
    };
    document.getElementById('ft-update-dismiss').onclick = () => bar.remove();
  }

  /** Parse version number from VERSION.txt first line or "v6.3.2" style */
  function parseVersion(text) {
    if (!text) return null;
    const m = String(text).match(/v?(\d+\.\d+\.\d+)/i);
    return m ? m[1] : null;
  }

  function isNewer(remote, local) {
    if (!remote || !local) return false;
    const r = remote.split('.').map(Number);
    const l = local.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const a = r[i] || 0;
      const b = l[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }
    return false;
  }

  async function checkVersionFile() {
    try {
      const base = document.querySelector('script[src*="sw-register"]')?.src || window.location.href;
      const versionUrl = new URL('VERSION.txt', new URL('./', base).href);
      // Also try root VERSION.txt
      const urls = [
        new URL('VERSION.txt', window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/')).href,
        versionUrl.href,
        new URL('VERSION.txt', window.location.href).href
      ];
      let remote = null;
      for (const u of urls) {
        try {
          const res = await fetch(u + '?t=' + Date.now(), { cache: 'no-store' });
          if (res.ok) {
            const text = await res.text();
            remote = parseVersion(text);
            if (remote) break;
          }
        } catch (_) {}
      }
      if (remote && isNewer(remote, APP_VERSION)) {
        showUpdateBanner(remote);
        return true;
      }
      // Same or unknown — still ask SW to update
      return false;
    } catch (_) {
      return false;
    }
  }

  function checkSWUpdate(reg) {
    if (!reg) return;
    try {
      reg.update();
    } catch (_) {}
  }

  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI || window.location.href).href;

    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        // Immediate + periodic update checks
        checkSWUpdate(reg);
        setInterval(() => checkSWUpdate(reg), 30 * 1000);

        // VERSION.txt check every 45s
        checkVersionFile();
        setInterval(() => checkVersionFile(), 45 * 1000);

        // When tab becomes visible again
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            checkSWUpdate(reg);
            checkVersionFile();
          }
        });
        window.addEventListener('focus', () => {
          checkSWUpdate(reg);
          checkVersionFile();
        });

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner(APP_VERSION);
            }
            // First install: no banner
          });
        });

        // If waiting worker already exists
        if (reg.waiting && navigator.serviceWorker.controller) {
          showUpdateBanner(APP_VERSION);
        }
      })
      .catch((err) => console.warn('SW register failed', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New SW active — one-time reload if user already clicked update
      if (sessionStorage.getItem('ft_pending_reload') === '1') {
        sessionStorage.removeItem('ft_pending_reload');
        window.location.reload();
      }
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        showUpdateBanner(event.data.version || APP_VERSION);
      }
    });

    // Show current version in console for debug
    console.info('[Future Tech ERP] App version', APP_VERSION);
  });

  window.__FT_APP_VERSION = APP_VERSION;
})();
