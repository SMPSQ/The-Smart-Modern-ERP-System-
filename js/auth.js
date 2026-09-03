// ---------------------------------------------------------
// AUTH
// Handles the login form (index.html) and guards
// dashboard.html / module pages so only signed-in staff get
// through. Firebase Auth's local persistence means a device
// that has signed in before can still open the dashboard
// while offline (Firebase queues the token check).
// ---------------------------------------------------------

import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const path = window.location.pathname;
const isLoginPage = path.endsWith("index.html") || path === "/" || path.endsWith("/fkc-erp/");

function updateConnStatus() {
  const el = document.getElementById("conn-status");
  const note = document.getElementById("offline-note");
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = "● online";
  } else {
    el.textContent = "● offline";
    if (note) note.hidden = false;
  }
}

if (isLoginPage) {
  updateConnStatus();
  window.addEventListener("online", updateConnStatus);
  window.addEventListener("offline", updateConnStatus);

  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("auth-error");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    btn.textContent = "Signing in…";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorEl.textContent = friendlyAuthError(err.code);
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });

  // Already signed in on this device — skip straight through.
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "dashboard.html";
  });
} else {
  // Every other page: guard the route.
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = resolveLoginPath();
      return;
    }
    const chip = document.getElementById("user-chip");
    if (chip) chip.textContent = user.email;
  });

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = resolveLoginPath();
  });
}

function resolveLoginPath() {
  // Module pages live one or two levels deep (modules/school/index.html),
  // so walk back up to the repo root's index.html.
  const depth = path.split("/").filter(Boolean).length;
  return depth > 1 ? "../".repeat(depth - 1) + "index.html" : "index.html";
}

function friendlyAuthError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/network-request-failed":
      return "No connection — sign-in needs internet the first time on a device.";
    default:
      return "Couldn't sign in. Please try again.";
  }
}
