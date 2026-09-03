// ---------------------------------------------------------
// LOCAL DATABASE (IndexedDB)
// Every module (school / trading academy / educational
// academy) reads and writes through this file first. Writes
// land here instantly, then get pushed to Firestore by
// sync.js the moment we're online. Nothing in the UI ever
// has to wait on a network round trip.
// ---------------------------------------------------------

const DB_NAME = "fkc_erp_local";
const DB_VERSION = 2;

// One store per collection we sync, plus a queue of pending
// outbound writes. Add new stores here as modules grow.
const STORES = [
  "visitors",
  // School
  "students",
  "fee_challans",
  // FKC Trading Academy
  "batches",
  "trading_enrollments",
  // Educational Academy
  "tuition_classes",
  "tutors",
  "academy_enrollments",
  "sync_queue",
];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function tx(store, mode) {
  const db = await openDb();
  return db.transaction(store, mode).objectStore(store);
}

/**
 * Save a record locally and enqueue it for sync.
 * @param {string} collection - e.g. "visitors"
 * @param {object} record - must include an id, or one is generated
 * @param {"create"|"update"|"delete"} op
 */
export async function saveLocal(collection, record, op = "create") {
  if (!record.id) record.id = uid();
  record._updatedAt = Date.now();
  record._synced = false;

  const store = await tx(collection, "readwrite");
  if (op === "delete") {
    store.delete(record.id);
  } else {
    store.put(record);
  }

  const queue = await tx("sync_queue", "readwrite");
  queue.put({
    id: uid(),
    collection,
    op,
    recordId: record.id,
    payload: op === "delete" ? null : record,
    createdAt: Date.now(),
  });

  return record;
}

export async function getAllLocal(collection) {
  const store = await tx(collection, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingSyncItems() {
  const store = await tx("sync_queue", "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearSyncItem(queueId) {
  const store = await tx("sync_queue", "readwrite");
  store.delete(queueId);
}

export async function deleteLocal(collection, id) {
  return saveLocal(collection, { id }, "delete");
}

export async function markRecordSynced(collection, recordId) {
  const store = await tx(collection, "readwrite");
  const getReq = store.get(recordId);
  getReq.onsuccess = () => {
    const record = getReq.result;
    if (record) {
      record._synced = true;
      store.put(record);
    }
  };
}
