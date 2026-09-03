// ---------------------------------------------------------
// FIREBASE CONFIG
// Replace with your own project's config (Firebase Console →
// Project settings → General → Your apps → SDK setup and
// config). Do NOT commit real production keys to a public
// repo — Firebase web config is not secret by itself, but
// pair it with Firestore Security Rules (see /README.md).
// ---------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

// Firestore's own offline cache (separate from our IndexedDB
// queue in db.js). This lets reads work offline too; db.js
// handles offline WRITES with a sync queue so we control
// exactly what/when gets pushed.
export const dbFirestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
