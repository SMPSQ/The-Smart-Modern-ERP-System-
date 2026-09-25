// js/db.js — Professional Offline-First Engine (ERP v4)
// IndexedDB + Sync Queue + Automatic Activity Logging

const DB_NAME = 'fkc-erp-v4';
const DB_VERSION = 9;

const STORES = [
  // Core
  'students',
  'admissions',
  'feeStructure',
  'feeChallans',
  'attendance',
  'teachers',
  'exams',
  'expenses',
  'income',
  'leaves',
  'timetable',
  'announcements',
  'schoolClasses',
  'subjects',
  'homework',
  'staff',
  'library',
  'transport',
  'inventory',
  'payroll',
  'settings',
  'courses',
  'batches',

  // Trading Academy
  'batches',
  'tradingEnrollments',
  'tradingJournal',

  // Educational Academy
  'tutors',
  'classes',
  'academyEnrollments',

  // System
  'visitors',
  'activity_logs',
  'sync_queue'
];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const dbx = req.result;
      STORES.forEach((store) => {
        if (!dbx.objectStoreNames.contains(store)) {
          dbx.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const dbPromise = openDatabase();

export function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

async function storeOf(storeName, mode = 'readonly') {
  const dbx = await dbPromise;
  return dbx.transaction(storeName, mode).objectStore(storeName);
}

function currentUser() {
  try {
    const chip = document.getElementById('user-chip');
    if (chip && chip.textContent && chip.textContent !== '—') {
      return chip.textContent.trim();
    }
  } catch (_) {}
  return 'system';
}

async function queueSync(storeName, recordId, action, data) {
  const store = await storeOf('sync_queue', 'readwrite');
  const item = {
    id: uid(),
    storeName,
    recordId,
    action,
    data,
    createdAt: Date.now()
  };
  return new Promise((res, rej) => {
    const r = store.put(item);
    r.onsuccess = () => res(item);
    r.onerror = () => rej(r.error);
  });
}

async function logActivity(action, storeName, recordId, summary, before = null, after = null) {
  if (storeName === 'activity_logs' || storeName === 'sync_queue') return;
  try {
    const store = await storeOf('activity_logs', 'readwrite');
    const entry = {
      id: uid(),
      action,
      storeName,
      recordId,
      summary: summary || '',
      before,
      after,
      user: currentUser(),
      createdAt: Date.now()
    };
    await new Promise((res, rej) => {
      const r = store.put(entry);
      r.onsuccess = res;
      r.onerror = () => rej(r.error);
    });
    // activity_logs stay local only — avoid blocking student sync queue
  } catch (err) {
    console.warn('Activity log failed:', err);
  }
}

function summarize(record) {
  if (!record) return '';
  return record.name || record.studentName || record.title ||
         record.className || record.batchName || record.id || '';
}

// ========== PUBLIC API ==========

export async function saveLocal(storeName, record) {
  const store = await storeOf(storeName, 'readwrite');
  const id = record.id || uid();
  const isUpdate = !!record.id;

  let before = null;
  if (isUpdate) {
    before = await new Promise((resolve) => {
      const g = store.get(id);
      g.onsuccess = () => resolve(g.result || null);
      g.onerror = () => resolve(null);
    });
  }

  const full = {
    ...record,
    id,
    updatedAt: Date.now(),
    synced: false
  };

  await new Promise((res, rej) => {
    const r = store.put(full);
    r.onsuccess = res;
    r.onerror = () => rej(r.error);
  });

  await queueSync(storeName, id, 'upsert', full);
  await logActivity(
    isUpdate && before ? 'update' : 'create',
    storeName,
    id,
    summarize(full),
    before,
    full
  );

  return full;
}

export async function getAllLocal(storeName) {
  const store = await storeOf(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

export async function getLocal(storeName, id) {
  const store = await storeOf(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const r = store.get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

export async function deleteLocal(storeName, id) {
  let before = null;
  try {
    before = await getLocal(storeName, id);
  } catch (_) {}

  const store = await storeOf(storeName, 'readwrite');
  await new Promise((res, rej) => {
    const r = store.delete(id);
    r.onsuccess = res;
    r.onerror = () => rej(r.error);
  });

  await queueSync(storeName, id, 'delete', { id });
  await logActivity('delete', storeName, id, summarize(before), before, null);
}

export async function getQueue() {
  const store = await storeOf('sync_queue', 'readonly');
  return new Promise((resolve, reject) => {
    const r = store.getAll();
    r.onsuccess = () => {
      const items = r.result || [];
      items.sort((a, b) => a.createdAt - b.createdAt);
      resolve(items);
    };
    r.onerror = () => reject(r.error);
  });
}

export async function removeFromQueue(id) {
  const store = await storeOf('sync_queue', 'readwrite');
  return new Promise((res, rej) => {
    const r = store.delete(id);
    r.onsuccess = res;
    r.onerror = () => rej(r.error);
  });
}

export async function markSynced(storeName, id) {
  const store = await storeOf(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const rec = getReq.result;
      if (!rec) return resolve();
      rec.synced = true;
      const putReq = store.put(rec);
      putReq.onsuccess = resolve;
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getActivityLogs(limit = 50) {
  const all = await getAllLocal('activity_logs');
  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return limit ? all.slice(0, limit) : all;
}

// ========== HELPER QUERIES (for Dashboard & Modules) ==========

export async function getStudentsByModule(module = null) {
  const all = await getAllLocal('students');
  if (!module) return all;
  return all.filter(s => s.module === module);
}

export async function getPendingFees() {
  const challans = await getAllLocal('feeChallans');
  return challans.filter(c => c.status === 'Unpaid' || c.status === 'unpaid');
}

export async function getTodayCollection() {
  const challans = await getAllLocal('feeChallans');
  const today = new Date().toISOString().slice(0, 10);
  return challans
    .filter(c => (c.status === 'Paid' || c.status === 'paid') && c.paidOn && new Date(c.paidOn).toISOString().slice(0, 10) === today)
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

export async function getTotalPendingAmount() {
  const pending = await getPendingFees();
  return pending.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}


/** Re-queue local records. force=true pushes ALL records in those stores. */
export async function requeueUnsynced(storeNames = null, force = false) {
  const names = storeNames || STORES.filter(s => s !== 'sync_queue' && s !== 'activity_logs');
  let count = 0;
  for (const storeName of names) {
    try {
      const all = await getAllLocal(storeName);
      for (const rec of all) {
        if (!rec || !rec.id) continue;
        if (force || rec.synced === false) {
          await queueSync(storeName, rec.id, 'upsert', rec);
          count++;
        }
      }
    } catch (_) {}
  }
  return count;
}

/** Clear stuck queue items that will never sync (e.g. activity_logs) */
export async function purgeQueueNoise() {
  const q = await getQueue();
  let n = 0;
  for (const item of q) {
    if (item.storeName === 'activity_logs' || !item.recordId || !item.storeName) {
      await removeFromQueue(item.id);
      n++;
    }
  }
  return n;
}

export async function removeFromQueuePublic(id) {
  return removeFromQueue(id);
}

