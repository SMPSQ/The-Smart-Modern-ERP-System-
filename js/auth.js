// js/auth.js — shared login + route-guard logic for every page.
// Pages set <body data-root="..."> so this file knows how deep it is
// (root pages: data-root=""; module pages: data-root="../../").
import { auth } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';

const root = document.body.dataset.root || '';
const isLoginPage = document.body.classList.contains('login-body');

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (isLoginPage) {
      window.location.href = root + 'dashboard.html';
    } else {
      const chip = document.getElementById('user-chip');
      if (chip) chip.textContent = user.email;
    }
  } else if (!isLoginPage) {
    window.location.href = root + 'index.html';
  }
});

const loginForm = document.getElementById('login-form');
if (loginForm) {
  const statusEl = document.getElementById('login-status');
  const submitBtn = loginForm.querySelector('button[type="submit"]');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) return;

    submitBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Signing in…';

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged above handles the redirect.
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Invalid email or password.';
      submitBtn.disabled = false;
    }
  });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
  });
}
