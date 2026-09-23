// js/sync.js — Robust Offline → Firestore Sync (ERP v4)
import { db } from './firebase-config.js';
import { doc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { getQueue, removeFromQueue, markSynced } from './db.js';

function setPill(state) {
  const pill = document.getElementById('sync-pill');
  if (!pill) return;

  if (state === 'synced') {
    pill.textContent = '● synced';
    pill.className = 'sync-pill sync-pill--ok';
  } else if (state === 'syncing') {
    pill.textContent = '● syncing…';
    pill.className = 'sync-pill sync-pill--busy';
  } else {
    pill.textContent = '● offline — saved on device';
    pill.className = 'sync-pill sync-pill--offline';
  }
}

let draining = false;

export async function drainQueue() {
  if (draining) return;
  draining = true;

  try {
    if (!navigator.onLine) {
      setPill('offline');
      return;
    }

    const queue = await getQueue();
    if (queue.length === 0) {
      setPill('synced');
      return;
    }

    setPill('syncing');

    for (const item of queue) {
      try {
        const ref = doc(db, item.storeName, item.recordId);
        if (item.action === 'delete') {
          await deleteDoc(ref);
        } else {
          await setDoc(ref, item.data, { merge: true });
          await markSynced(item.storeName, item.recordId);
        }
        await removeFromQueue(item.id);
      } catch (err) {
        console.warn('Sync paused, will retry later:', err.message || err);
        break; // Keep order, retry on next cycle
      }
    }

    const remaining = await getQueue();
    setPill(remaining.length === 0 ? 'synced' : (navigator.onLine ? 'syncing' : 'offline'));
  } finally {
    draining = false;
  }
}

// Public alias used by modules
export const runSync = drainQueue;

window.addEventListener('online', drainQueue);
window.addEventListener('offline', () => setPill('offline'));

// Auto start
drainQueue();
window.addEventListener('load', drainQueue);
setInterval(drainQueue, 25000); // every 25s safety net
