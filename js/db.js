// js/db.js — Professional Offline-First Engine (ERP v6)
// IndexedDB + Sync Queue + Automatic Activity Logging

const DB_NAME = 'fkc-erp-v4';
const DB_VERSION = 13;

const STORES = [
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
  'libraryIssues',
  'transport',
  'inventory',
  'payroll',
  'settings',
  'courses',
  'batches',
  'tradingEnrollments',
  'tradingJournal',
  'tutors',
  'classes',
  'academyEnrollments',
  'shopProducts',
  'shopSales',
  'shopPurchases',
  'visitors',
  'activity_logs',
  'sync_queue'
];

function ensureStores(dbx) {
  STORES.forEach((store) => {
    if (!dbx.objectStoreNames.contains(store)) {
      dbx.createObjectStore(store, { keyPath: 'id' });
    }
  });
}

function missingStores(dbx) {
  return STORES.filter((s) => !dbx.objectStoreNames.contains(s));
}

function openAtVersion(version) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => {
      ensureStores(req.result);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onblocked = () => {
      console.warn('[DB] open blocked — close other tabs of this app');
    };
  });
}

let _db = null;
let _dbPromise = null;

async function openDatabase() {
  if (_db) return _db;
  if (_dbPromise) return _dbPromise;
  _dbPromise = (async () => {
    let dbx = await openAtVersion(DB_VERSION);
    let missing = missingStores(dbx);
    if (missing.length) {
      const next = (dbx.version || DB_VERSION) + 1;
      console.warn('[DB] Missing stores', missing, '→ upgrade to', next);
      dbx.close();
      dbx = await openAtVersion(next);
      missing = missingStores(dbx);
      if (missing.length) {
        console.error('[DB] Still missing stores after upgrade:', missing);
      }
    }
    _db = dbx;
    dbx.onversionchange = () => {
      try { dbx.close(); } catch (_) {}
      _db = null;
      _dbPromise = null;
    };
    return dbx;
  })();
  try {
    return await _dbPromise;
  } catch (err) {
    _dbPromise = null;
    throw err;
  }
}


const LS_MIRROR_STORES = new Set(['admissions', 'students', 'shopProducts', 'library', 'libraryIssues', 'courses']);

function mirrorToLocalStorage(storeName, record) {
  if (!LS_MIRROR_STORES.has(storeName) || !record || !record.id) return;
  try {
    const key = 'ft_mirror_' + storeName;
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    const i = arr.findIndex((x) => x && x.id === record.id);
    if (i >= 0) arr[i] = record;
    else arr.push(record);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.warn('[DB] localStorage mirror failed', e);
  }
}

function readMirror(storeName) {
  try {
    const raw = localStorage.getItem('ft_mirror_' + storeName);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}


export function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

async function storeOf(storeName, mode = 'readonly') {
  let dbx = await openDatabase();
  if (!dbx.objectStoreNames.contains(storeName)) {
    // force upgrade path once
    const next = (dbx.version || DB_VERSION) + 1;
    try { dbx.close(); } catch (_) {}
    _db = null;
    _dbPromise = null;
    dbx = await openAtVersion(next);
    _db = dbx;
    if (!dbx.objectStoreNames.contains(storeName)) {
      throw new Error(
        'Database store missing: "' + storeName + '". Hard refresh (Ctrl+Shift+R) karein ya browser data clear karke dubara login.'
      );
    }
  }
  return dbx.transaction(storeName, mode).objectStore(storeName);
}

/** Warm up DB on load so first save is fast */
openDatabase().catch((err) => {
  console.error('[DB] init failed', err);
});


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

export async function saveLocal(storeName, record, options = {}) {
  const skipQueue = options.skipQueue === true || record._skipQueue === true || record.synced === true;
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

  const { _skipQueue, ...rest } = record;
  const full = {
    ...rest,
    id,
    updatedAt: record.updatedAt || Date.now(),
    synced: skipQueue ? true : false
  };

  await new Promise((res, rej) => {
    const r = store.put(full);
    r.onsuccess = res;
    r.onerror = () => rej(r.error || new Error('IndexedDB put failed'));
  });

  mirrorToLocalStorage(storeName, full);

  if (!skipQueue) {
    try {
      await queueSync(storeName, id, 'upsert', full);
    } catch (qErr) {
      console.warn('[DB] queueSync failed (data still saved locally)', qErr);
    }
  }
  try {
    await logActivity(
      isUpdate && before ? 'update' : 'create',
      storeName,
      id,
      summarize(full),
      before,
      full
    );
  } catch (_) {}

  return full;
}

export async function saveLocalSafe(storeName, record) {
  try {
    return await saveLocal(storeName, record);
  } catch (err) {
    console.error('[DB] saveLocal failed', storeName, err);
    throw err;
  }
}

export async function getAllLocal(storeName) {
  let fromIdb = [];
  try {
    const store = await storeOf(storeName, 'readonly');
    fromIdb = await new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  } catch (err) {
    console.warn('[DB] getAllLocal', storeName, err);
  }
  if (!LS_MIRROR_STORES.has(storeName)) return fromIdb;
  const mirrored = readMirror(storeName);
  if (!mirrored.length) return fromIdb;
  const map = new Map();
  fromIdb.forEach((r) => { if (r && r.id) map.set(r.id, r); });
  mirrored.forEach((r) => {
    if (!r || !r.id) return;
    const existing = map.get(r.id);
    if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) map.set(r.id, r);
  });
  return [...map.values()];
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

