// js/sync.js — Offline → Firestore sync (sanitized + auth-aware)
import { auth, db } from './firebase-config.js';
import { doc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { getQueue, removeFromQueue, markSynced } from './db.js';

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
    pill.textContent = '● sync error';
    pill.className = 'sync-pill sync-pill--offline';
    pill.title = detail || 'Check Firebase rules / login';
  } else {
    pill.textContent = '● offline — saved on device';
    pill.className = 'sync-pill sync-pill--offline';
    pill.title = detail || '';
  }
}

/** Firestore rejects undefined — strip it recursively */
function sanitize(value) {
  if (value === undefined) return undefined; // signal skip
  if (value === null) return null;
  if (typeof value === 'number' && Number.isNaN(value)) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map(sanitize).filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      if (typeof v === 'function') continue;
      const sv = sanitize(v);
      if (sv !== undefined) out[k] = sv;
    }
    return out;
  }
  return value;
}

let draining = false;

export async function drainQueue() {
  if (draining) return { ok: true, remaining: 0 };
  draining = true;

  try {
    if (!navigator.onLine) {
      setPill('offline');
      return { ok: false, remaining: -1, reason: 'offline' };
    }

    const queue = await getQueue();
    if (queue.length === 0) {
      setPill('synced');
      return { ok: true, remaining: 0 };
    }

    // Firestore rules usually need request.auth != null
    if (!auth.currentUser) {
      setPill('error', 'Login with Admin (email) required for cloud sync. Data is safe on this device.');
      return { ok: false, remaining: queue.length, reason: 'no-auth' };
    }

    setPill('syncing', queue.length + ' pending');

    let lastError = null;
    for (const item of queue) {
      try {
        const recordId = String(item.recordId || item.id || '').trim();
        if (!recordId || !item.storeName) {
          await removeFromQueue(item.id);
          continue;
        }
        const ref = doc(db, item.storeName, recordId);
        if (item.action === 'delete') {
          await deleteDoc(ref);
        } else {
          const payload = sanitize(item.data || {});
          // Ensure id field present
          if (payload && typeof payload === 'object') payload.id = recordId;
          await setDoc(ref, payload, { merge: true });
          try {
            await markSynced(item.storeName, recordId);
          } catch (_) {}
        }
        await removeFromQueue(item.id);
      } catch (err) {
        lastError = err;
        console.warn('Sync item failed:', item.storeName, item.recordId, err);
        // permission / invalid data — stop ordered drain
        break;
      }
    }

    const remaining = await getQueue();
    if (remaining.length === 0) {
      setPill('synced');
      return { ok: true, remaining: 0 };
    }
    const msg = lastError?.code || lastError?.message || 'pending';
    setPill('error', String(msg));
    return { ok: false, remaining: remaining.length, reason: msg };
  } finally {
    draining = false;
  }
}

export const runSync = drainQueue;

window.addEventListener('online', () => { drainQueue(); });
window.addEventListener('offline', () => setPill('offline'));
drainQueue();
window.addEventListener('load', () => drainQueue());
setInterval(() => drainQueue(), 20000);
