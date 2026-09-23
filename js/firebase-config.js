// js/firebase-config.js
// IMPORTANT: Keep your real Firebase project keys here
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB-bpoh6--vMuwcYoLMRdiew5f3tYaZC3c",
  authDomain: "erp-full-system.firebaseapp.com",
  projectId: "erp-full-system",
  storageBucket: "erp-full-system.firebasestorage.app",
  messagingSenderId: "87383209313",
  appId: "1:87383209313:web:431b78a57a73e477968120"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
