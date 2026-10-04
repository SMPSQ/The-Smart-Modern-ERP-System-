// js/sync.js — Offline ↔ Firestore (push queue + PULL from cloud)
import { auth, db } from './firebase-config.js';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  limit
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {
  getQueue,
  removeFromQueue,
  markSynced,
  requeueUnsynced,
  purgeQueueNoise,
  saveLocal,
  getLocal,
  getAllLocal
} from './db.js';

function setPill(state, detail) {
  const pill = document.getElementById('sync-pill');
  if (!pill) return;
  if (state === 'synced') {
    pill.textContent = '● synced';
    pill.className = 'sync-pill sync-pill--ok';
    pill.title = detail || 'All changes synced';
  } else if (state === 'syncing') {
    pill.textContent = '● syncing…';
    pill.className = 'sync-pill sync-pill--busy';
    pill.title = detail || '';
  } else if (state === 'error') {
    pill.textContent = '● sync issue';
    pill.className = 'sync-pill sync-pill--offline';
    pill.title = detail || '';
  } else {
    pill.textContent = '● offline — saved on device';
    pill.className = 'sync-pill sync-pill--offline';
    pill.title = detail || '';
  }
}

function sanitize(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number' && Number.isNaN(value)) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map(sanitize).filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined || typeof v === 'function') continue;
      const sv = sanitize(v);
      if (sv !== undefined) out[k] = sv;
    }
    return out;
  }
  return value;
}

function safeDocId(id) {
  return String(id || '').replace(/\//g, '_').slice(0, 700) || 'unknown';
}

/** Collections to pull from Firebase → local IndexedDB */
const PULL_STORES = [
  'admissions',
  'students',
  'feeChallans',
  'feeStructure',
  'attendance',
  'teachers',
  'staff',
  'shopProducts',
  'shopSales',
  'shopPurchases',
  'library',
  'libraryIssues',
  'courses',
  'batches',
  'classes',
  'expenses',
  'income'
];

let draining = false;
let pulling = false;

/**
 * PULL: Firestore → local DB (merge by updatedAt)
 * Is se dusre device / Firebase Console ka data app mein dikhega
 */
export async function pullFromCloud() {
  if (pulling) return { ok: false, reason: 'busy' };
  if (!navigator.onLine) {
    setPill('offline');
    return { ok: false, reason: 'offline' };
  }

  if (!auth.currentUser) {
    try {
      const { ensureFirebaseAuthForSync } = await import('./staff-auth.js');
      await ensureFirebaseAuthForSync();
    } catch (_) {}
  }
  if (!auth.currentUser) {
    setPill('error', 'Login required for cloud pull');
    return { ok: false, reason: 'no-auth' };
  }

  pulling = true;
  setPill('syncing', 'Downloading from cloud…');
  let imported = 0;
  let errors = 0;

  try {
    for (const storeName of PULL_STORES) {
      try {
        const snap = await getDocs(query(collection(db, storeName), limit(2000)));
        for (const d of snap.docs) {
          try {
            let data = d.data() || {};
            data = sanitize(data) || {};
            if (!data.id) data.id = d.id;
            // Prefer newer updatedAt
            let local = null;
            try {
              local = await getLocal(storeName, data.id);
            } catch (_) {}
            const remoteTs = Number(data.updatedAt || data.createdAt || 0);
            const localTs = Number(local?.updatedAt || local?.createdAt || 0);
            if (local && localTs > remoteTs) continue; // local newer — keep local
            // saveLocal will re-queue for push — mark synced after to avoid loop
            data.synced = true;
            await saveLocal(storeName, data, { skipQueue: true });
            try {
              await markSynced(storeName, data.id);
            } catch (_) {}
            imported++;
          } catch (docErr) {
            errors++;
            console.warn('[Pull] doc', storeName, d.id, docErr);
          }
        }
      } catch (colErr) {
        // Collection may not exist yet
        console.warn('[Pull] collection', storeName, colErr?.code || colErr?.message || colErr);
      }
    }
    setPill('synced', imported ? imported + ' from cloud' : 'synced');
    return { ok: true, imported, errors };
  } catch (err) {
    console.error('[Pull] failed', err);
    setPill('error', err?.message || 'pull failed');
    return { ok: false, reason: err?.message || String(err) };
  } finally {
    pulling = false;
  }
}

export async function drainQueue() {
  if (draining) return { ok: true, remaining: 0 };
  draining = true;
  try {
    if (!navigator.onLine) {
      setPill('offline');
      return { ok: false, remaining: -1, reason: 'offline' };
    }

    try {
      await purgeQueueNoise();
    } catch (_) {}

    let queue = await getQueue();
    if (queue.length === 0) {
      setPill('synced');
      return { ok: true, remaining: 0 };
    }

    if (!auth.currentUser) {
      try {
        const { ensureFirebaseAuthForSync } = await import('./staff-auth.js');
        await ensureFirebaseAuthForSync();
      } catch (_) {}
    }
    if (!auth.currentUser) {
      setPill('error', 'Cloud sync needs login');
      return { ok: false, remaining: queue.length, reason: 'no-auth' };
    }

    setPill('syncing', queue.length + ' pending');

    let synced = 0;
    let failed = 0;
    let lastError = '';

    const priority = ['students', 'admissions', 'feeChallans', 'attendance'];
    queue = [...queue].sort((a, b) => {
      const pa = priority.indexOf(a.storeName);
      const pb = priority.indexOf(b.storeName);
      return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    });

    for (const item of queue) {
      try {
        if (!item.storeName || item.storeName === 'activity_logs' || item.storeName === 'sync_queue') {
          await removeFromQueue(item.id);
          continue;
        }
        const recordId = safeDocId(item.recordId);
        if (!recordId || recordId === 'unknown') {
          await removeFromQueue(item.id);
          continue;
        }
        const ref = doc(db, item.storeName, recordId);
        if (item.action === 'delete') {
          await deleteDoc(ref);
        } else {
          let payload = sanitize(item.data || {});
          if (!payload || typeof payload !== 'object') payload = { id: recordId };
          payload.id = recordId;
          payload = JSON.parse(JSON.stringify(payload));
          await setDoc(ref, payload, { merge: true });
          try {
            await markSynced(item.storeName, item.recordId);
          } catch (_) {}
        }
        await removeFromQueue(item.id);
        synced++;
      } catch (err) {
        failed++;
        lastError = err?.code || err?.message || String(err);
        console.warn('Sync fail', item.storeName, item.recordId, err);
        if (String(lastError).includes('invalid') || String(lastError).includes('Invalid')) {
          await removeFromQueue(item.id);
        }
      }
    }

    const remaining = await getQueue();
    if (remaining.length === 0) {
      setPill('synced', synced + ' uploaded');
      return { ok: true, remaining: 0, synced };
    }
    setPill('error', lastError || remaining.length + ' pending');
    return { ok: false, remaining: remaining.length, reason: lastError, synced, failed };
  } finally {
    draining = false;
  }
}

/** Full sync: pull cloud → local, then push local queue → cloud */
export async function fullSync() {
  setPill('syncing', 'Full sync…');
  const pull = await pullFromCloud();
  const push = await drainQueue();
  setPill(
    pull.ok || push.ok ? 'synced' : 'error',
    '↓' + (pull.imported || 0) + ' ↑' + (push.synced || 0)
  );
  // Refresh KPIs if dashboard
  try {
    if (typeof window.__ft_reloadKPIs === 'function') window.__ft_reloadKPIs();
  } catch (_) {}
  return { pull, push };
}

export async function forceSyncStudents() {
  if (!auth.currentUser) {
    try {
      const { ensureFirebaseAuthForSync } = await import('./staff-auth.js');
      await ensureFirebaseAuthForSync();
    } catch (_) {}
  }
  if (!auth.currentUser) {
    return { ok: false, reason: 'Enable Anonymous Auth or login with admin email' };
  }
  try {
    await purgeQueueNoise();
  } catch (_) {}
  const n = await requeueUnsynced(
    ['students', 'admissions', 'feeChallans', 'attendance', 'teachers', 'staff', 'feeStructure'],
    true
  );
  const pull = await pullFromCloud();
  const result = await drainQueue();
  return { ...result, requeued: n, pull };
}

export const runSync = drainQueue;

// Wire Sync now button if present
function bindSyncButton() {
  const btn = document.getElementById('sync-now-btn') || document.querySelector('[data-sync-now]');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await fullSync();
        alert('Sync complete — cloud data local mein aa gaya');
        window.location.reload();
      } catch (e) {
        alert('Sync error: ' + (e.message || e));
      } finally {
        btn.disabled = false;
      }
    });
  }
}

window.addEventListener('online', () => {
  fullSync();
});
window.addEventListener('offline', () => setPill('offline'));
window.addEventListener('load', () => {
  bindSyncButton();
  // Pull first (show cloud data fast), then push local queue
  pullFromCloud()
    .then(() => {
      try { if (typeof window.__ft_reloadKPIs === 'function') window.__ft_reloadKPIs(); } catch (_) {}
      return drainQueue();
    })
    .then(() => {
      try { if (typeof window.__ft_reloadKPIs === 'function') window.__ft_reloadKPIs(); } catch (_) {}
    })
    .catch((e) => console.warn('[Sync] startup', e));
});
setInterval(() => { drainQueue(); }, 12000);
// Pull every 2 min
setInterval(() => {
  pullFromCloud().then(() => {
    try {
      if (typeof window.__ft_reloadKPIs === 'function') window.__ft_reloadKPIs();
    } catch (_) {}
  });
}, 45000);

bindSyncButton();
