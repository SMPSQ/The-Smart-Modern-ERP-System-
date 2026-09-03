// ---------------------------------------------------------
// SYNC ENGINE
// Drains the local sync_queue into Firestore whenever we
// have a connection: on load, whenever the browser fires
// "online", and on a 30s heartbeat in case "online" fires
// falsely (captive portals, flaky wifi).
// ---------------------------------------------------------

import { dbFirestore } from "./firebase-config.js";
import {
  doc,
  setDoc,
  deleteDoc,
  collection as fsCollection,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getPendingSyncItems, clearSyncItem, markRecordSynced } from "./db.js";

let syncing = false;

function setPillState(state) {
  const pill = document.getElementById("sync-pill");
  if (!pill) return;
  pill.classList.remove("is-online", "is-offline");
  if (state === "online") {
    pill.textContent = "● synced";
    pill.classList.add("is-online");
  } else if (state === "syncing") {
    pill.textContent = "● syncing…";
  } else {
    pill.textContent = "● offline — saved on device";
    pill.classList.add("is-offline");
  }
}

export async function runSync() {
  if (syncing) return;
  if (!navigator.onLine) {
    setPillState("offline");
    return;
  }

  syncing = true;
  setPillState("syncing");

  try {
    const pending = await getPendingSyncItems();
    for (const item of pending) {
      const ref = doc(fsCollection(dbFirestore, item.collection), item.recordId);
      if (item.op === "delete") {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, item.payload, { merge: true });
        await markRecordSynced(item.collection, item.recordId);
      }
      await clearSyncItem(item.id);
    }
    setPillState("online");
  } catch (err) {
    // Network blip mid-sync — leave the queue intact, we'll
    // retry on the next trigger.
    console.warn("Sync paused, will retry:", err.message);
    setPillState("offline");
  } finally {
    syncing = false;
  }
}

window.addEventListener("online", runSync);
window.addEventListener("offline", () => setPillState("offline"));
document.addEventListener("DOMContentLoaded", runSync);
setInterval(runSync, 30_000);
