/**
 * Future Tech ERP — Service Worker + AUTOMATIC cache/version updates
 * Every deploy: bump sw.js CACHE_VERSION + VERSION.txt + APP_VERSION below (same number)
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  // === MUST match sw.js CACHE_VERSION without leading "v" ===
  const APP_VERSION = '6.5.3';
  const CHECK_MS = 20000; // 20 seconds
  let _reloading = false;
  let _bannerShown = false;

  window.__FT_APP_VERSION = APP_VERSION;

  function versionUrls() {
    const path = window.location.pathname || '/';
    // Strip file name to folder
    const base = path.replace(/\/[^/]*$/, '/');
    const origin = window.location.origin;
    return [
      origin + base + 'VERSION.txt',
      origin + '/The-Smart-Modern-ERP-System-/VERSION.txt',
      origin + path.split('/').slice(0, -1).join('/') + '/VERSION.txt',
      new URL('VERSION.txt', window.location.href).href,
      new URL('../VERSION.txt', window.location.href).href,
      new URL('../../VERSION.txt', window.location.href).href
    ];
  }

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

  function doReload() {
    if (_reloading) return;
    _reloading = true;
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (_) {}
    const u = new URL(window.location.href);
    u.searchParams.set('_v', String(Date.now()));
    setTimeout(() => {
      window.location.replace(u.toString());
    }, 200);
  }

  function showUpdateBanner(ver, auto) {
    if (_bannerShown && document.getElementById('ft-update-banner')) return;
    _bannerShown = true;
    let bar = document.getElementById('ft-update-banner');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'ft-update-banner';
      bar.setAttribute(
        'style',
        'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;' +
          'background:linear-gradient(135deg,#020B1A,#0B3D6E);color:#F0D78C;padding:14px 20px;' +
          'border-radius:14px;border:2px solid #D4AF37;box-shadow:0 16px 48px rgba(0,0,0,0.4);' +
          'display:flex;align-items:center;gap:14px;font-family:Inter,system-ui,sans-serif;' +
          'font-size:14px;font-weight:600;max-width:94vw'
      );
      document.body.appendChild(bar);
    }
    const label = ver || APP_VERSION;
    bar.innerHTML =
      '<span>🔄 New version v' +
      label +
      (auto ? ' — auto updating…' : '') +
      '</span>' +
      '<button type="button" id="ft-update-reload" style="background:#D4AF37;color:#020B1A;border:none;padding:9px 16px;border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit;font-size:13px;">Update now</button>';
    const btn = document.getElementById('ft-update-reload');
    if (btn) btn.onclick = doReload;

    // Automatic reload after 2.5s when new version detected
    if (auto) {
      setTimeout(doReload, 2500);
    }
  }

  async function checkVersionFile() {
    const urls = versionUrls();
    for (const u of urls) {
      try {
        const res = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), {
          cache: 'no-store',
          credentials: 'same-origin'
        });
        if (!res.ok) continue;
        const text = await res.text();
        const remote = parseVersion(text);
        if (remote && isNewer(remote, APP_VERSION)) {
          console.info('[FT] New version on server:', remote, 'local:', APP_VERSION);
          showUpdateBanner(remote, true); // auto update
          return true;
        }
        if (remote) {
          console.info('[FT] Version OK', remote);
          return false;
        }
      } catch (_) {}
    }
    return false;
  }

  function checkSWUpdate(reg) {
    if (!reg) return;
    try {
      reg.update().catch(() => {});
    } catch (_) {}
  }

  async function fullCheck(reg) {
    checkSWUpdate(reg);
    await checkVersionFile();
  }

  // Register SW (root scope)
  const swUrl = new URL('../../sw.js', window.location.href);
  // Try multiple paths: page in modules/school/ → ../../sw.js; dashboard → ./sw.js
  const candidates = [
    new URL('sw.js', window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/')).href,
    new URL('../sw.js', window.location.href).href,
    new URL('../../sw.js', window.location.href).href,
    window.location.origin + '/The-Smart-Modern-ERP-System-/sw.js',
    window.location.origin + '/sw.js'
  ];

  async function registerSW() {
    let reg = null;
    for (const url of candidates) {
      try {
        reg = await navigator.serviceWorker.register(url, { updateViaCache: 'none' });
        console.info('[FT] SW registered', url, 'app', APP_VERSION);
        break;
      } catch (e) {
        console.warn('[FT] SW register fail', url, e.message || e);
      }
    }
    if (!reg) return null;

    // New worker waiting → activate + reload
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(APP_VERSION, true);
        }
      });
    });

    // Controller changed → reload once
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      doReload();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        showUpdateBanner(event.data.version || APP_VERSION, true);
      }
    });

    // Periodic + focus checks
    setInterval(() => fullCheck(reg), CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fullCheck(reg);
    });
    window.addEventListener('focus', () => fullCheck(reg));

    // First check soon
    setTimeout(() => fullCheck(reg), 1500);
    setTimeout(() => fullCheck(reg), 8000);

    return reg;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => registerSW());
  } else {
    registerSW();
  }

  console.info('[Future Tech ERP] App version', APP_VERSION, '— auto cache updates ON');
})();
