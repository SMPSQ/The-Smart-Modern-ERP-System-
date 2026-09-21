// js/db.js — offline-first IndexedDB engine + sync outbox queue
// Every module reads/writes through saveLocal()/getAllLocal()/deleteLocal().

const DB_NAME = 'fkc-erp';
const DB_VERSION = 1;
const STORES = [
  'visitors', 'students', 'feeChallans',
  'batches', 'tradingEnrollments',
  'tutors', 'classes', 'academyEnrollments',
  'sync_queue'
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

async function queueSync(storeName, recordId, action, data) {
  const store = await storeOf('sync_queue', 'readwrite');
  const item = { id: uid(), storeName, recordId, action, data, createdAt: Date.now() };
  return new Promise((res, rej) => {
    const r = store.put(item);
    r.onsuccess = () => res(item);
    r.onerror = () => rej(r.error);
  });
}

// Create or update a record. Assigns an id if missing.
export async function saveLocal(storeName, record) {
  const store = await storeOf(storeName, 'readwrite');
  const id = record.id || uid();
  const full = { ...record, id, updatedAt: Date.now(), synced: false };
  await new Promise((res, rej) => {
    const r = store.put(full);
    r.onsuccess = res;
    r.onerror = () => rej(r.error);
  });
  await queueSync(storeName, id, 'upsert', full);
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
  const store = await storeOf(storeName, 'readwrite');
  await new Promise((res, rej) => {
    const r = store.delete(id);
    r.onsuccess = res;
    r.onerror = () => rej(r.error);
  });
  await queueSync(storeName, id, 'delete', { id });
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
