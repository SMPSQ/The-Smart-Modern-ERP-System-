// js/sync.js — Offline → Firestore (robust student sync)
import { auth, db } from './firebase-config.js';
import { doc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { getQueue, removeFromQueue, markSynced, requeueUnsynced, purgeQueueNoise } from './db.js';

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

/** Firestore doc id cannot contain / */
function safeDocId(id) {
  return String(id || '').replace(/\//g, '_').slice(0, 700) || 'unknown';
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

    // Drop activity_logs etc. that block the queue
    try { await purgeQueueNoise(); } catch (_) {}

    let queue = await getQueue();
    if (queue.length === 0) {
      setPill('synced');
      return { ok: true, remaining: 0 };
    }

    if (!auth.currentUser) {
      // Staff local login → try anonymous Firebase auth so rules allow write
      try {
        const { ensureFirebaseAuthForSync } = await import('./staff-auth.js');
        await ensureFirebaseAuthForSync();
      } catch (_) {}
    }
    if (!auth.currentUser) {
      setPill('error', 'Cloud sync needs login. Enable Anonymous Auth in Firebase Console.');
      return { ok: false, remaining: queue.length, reason: 'no-auth' };
    }

    setPill('syncing', queue.length + ' pending');

    let synced = 0;
    let failed = 0;
    let lastError = '';

    // Prefer students / admissions first
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
          // Flatten any residual undefined
          payload = JSON.parse(JSON.stringify(payload));
          await setDoc(ref, payload, { merge: true });
          try { await markSynced(item.storeName, item.recordId); } catch (_) {}
        }
        await removeFromQueue(item.id);
        synced++;
      } catch (err) {
        failed++;
        lastError = err?.code || err?.message || String(err);
        console.warn('Sync fail', item.storeName, item.recordId, err);
        // Continue other items — do NOT break entire queue
        // Remove permanently bad items after many failures
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
    setPill('error', lastError || (remaining.length + ' pending'));
    return { ok: false, remaining: remaining.length, reason: lastError, synced, failed };
  } finally {
    draining = false;
  }
}

/** Force push ALL local students (and core stores) to Firestore */
export async function forceSyncStudents() {
  if (!auth.currentUser) {
    try {
      const { ensureFirebaseAuthForSync } = await import('./staff-auth.js');
      await ensureFirebaseAuthForSync();
    } catch (_) {}
  }
  if (!auth.currentUser) {
    return { ok: false, reason: 'Enable Anonymous Auth in Firebase (Authentication → Sign-in method)' };
  }
  try { await purgeQueueNoise(); } catch (_) {}
  const n = await requeueUnsynced(
    ['students', 'admissions', 'feeChallans', 'attendance', 'teachers', 'staff', 'feeStructure'],
    true
  );
  const result = await drainQueue();
  return { ...result, requeued: n };
}

export const runSync = drainQueue;

window.addEventListener('online', () => { drainQueue(); });
window.addEventListener('offline', () => setPill('offline'));
drainQueue();
window.addEventListener('load', () => drainQueue());
setInterval(() => drainQueue(), 20000);
