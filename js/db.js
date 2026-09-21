// js/db.js — offline-first IndexedDB + sync queue + automatic activity tracking
// Every create / update / delete is logged automatically.

const DB_NAME = 'fkc-erp';
const DB_VERSION = 3; // bumped for activity_logs store
const STORES = [
  'visitors', 'students', 'feeChallans',
  'admissions', 'subjects', 'feeStructure',
  'batches', 'tradingEnrollments',
  'tutors', 'classes', 'academyEnrollments',
  'sync_queue',
  'activity_logs' // automatic edit / delete / create tracking
];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
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

async function storeOf(storeName, mode) {
  const dbx = await dbPromise;
  return dbx.transaction(storeName, mode).objectStore(storeName);
}

function currentUser() {
  try {
    // Firebase auth email if available, else anonymous session tag
    const chip = document.getElementById('user-chip');
    if (chip && chip.textContent && chip.textContent !== '—') return chip.textContent.trim();
  } catch (_) {}
  return 'system';
}

async function queueSync(storeName, recordId, action, data) {
  const store = await storeOf('sync_queue', 'readwrite');
  const item = { id: uid(), storeName, recordId, action, data, createdAt: Date.now() };
  return new Promise((res, rej) => {
    const r = store.put(item);
    r.onsuccess = () => res(item);
    r.onerror = () => rej(r.error);
  });
}

/** Automatic activity log — create / update / delete */
async function logActivity(action, storeName, recordId, summary, before, after) {
  // Don't log the logs themselves
  if (storeName === 'activity_logs' || storeName === 'sync_queue') return;
  try {
    const store = await storeOf('activity_logs', 'readwrite');
    const entry = {
      id: uid(),
      action,          // 'create' | 'update' | 'delete'
      storeName,
      recordId,
      summary: summary || '',
      before: before || null,
      after: after || null,
      user: currentUser(),
      createdAt: Date.now()
    };
    await new Promise((res, rej) => {
      const r = store.put(entry);
      r.onsuccess = res;
      r.onerror = () => rej(r.error);
    });
    // Also queue for cloud sync
    await queueSync('activity_logs', entry.id, 'upsert', entry);
  } catch (err) {
    console.warn('activity log failed', err);
  }
}

function summarize(record) {
  if (!record) return '';
  return record.name || record.studentName || record.title || record.className || record.id || '';
}

// Create or update a record. Assigns an id if missing. Auto-logs.
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

  const full = { ...record, id, updatedAt: Date.now(), synced: false };
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
    r.onsuccess = () => resolve(r.result);
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
  // Capture record before delete for the log
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
    r.onsuccess = () => resolve(r.result.sort((a, b) => a.createdAt - b.createdAt));
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

/** Recent activity logs (newest first). Limit optional. */
export async function getActivityLogs(limit = 100) {
  const all = await getAllLocal('activity_logs');
  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return limit ? all.slice(0, limit) : all;
}
