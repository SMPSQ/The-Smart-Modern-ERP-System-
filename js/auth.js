// js/auth.js — Firebase Super Admin + Local Staff login + route guard
import { auth } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import {
  loginStaff,
  getStaffSession,
  clearStaffSession,
  isStaffLoggedIn
} from './staff-auth.js';

const root = document.body.dataset.root || '';
const isLoginPage =
  document.body.classList.contains('login-body') ||
  (window.location.pathname.endsWith('index.html') ||
    window.location.pathname.endsWith('/'));

function goDashboard() {
  window.location.href = (root || './') + 'dashboard.html';
}

function goLogin() {
  window.location.href = (root || './') + 'index.html';
}

function setChip(text) {
  const chip = document.getElementById('user-chip');
  if (chip) chip.textContent = text;
}

// Route guard: Firebase user OR staff session
onAuthStateChanged(auth, (user) => {
  const staff = getStaffSession();
  if (user) {
    if (isLoginPage) goDashboard();
    else setChip(user.email || 'Admin');
  } else if (staff) {
    if (isLoginPage) goDashboard();
    else setChip(`${staff.name} (${staff.role})`);
  } else if (!isLoginPage) {
    goLogin();
  }
});

// Login form: try staff username first, then Firebase email
const loginForm = document.getElementById('login-form');
if (loginForm) {
  const statusEl =
    document.getElementById('login-error') ||
    document.getElementById('login-status');
  const submitBtn =
    document.getElementById('login-btn') ||
    loginForm.querySelector('button[type="submit"]');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailOrUser = (
      document.getElementById('login-email')?.value || ''
    ).trim();
    const password = document.getElementById('login-password')?.value || '';
    if (!emailOrUser || !password) return;

    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Signing in…';

    // 1) Staff local login (username, not email)
    if (!emailOrUser.includes('@')) {
      const result = await loginStaff(emailOrUser, password);
      if (result.ok) {
        goDashboard();
        return;
      }
      // if looks like username failed, show error (don't try Firebase without @)
      if (statusEl) statusEl.textContent = result.error || 'Login failed';
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitBtn.id === 'login-btn') submitBtn.textContent = 'Login to Dashboard';
      }
      return;
    }

    // 2) Firebase Super Admin
    try {
      clearStaffSession();
      await signInWithEmailAndPassword(auth, emailOrUser, password);
    } catch (err) {
      if (statusEl) {
        statusEl.textContent =
          err.code === 'auth/invalid-credential' ||
          err.code === 'auth/wrong-password' ||
          err.code === 'auth/user-not-found'
            ? 'Invalid email or password.'
            : err.message || 'Login failed';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitBtn.id === 'login-btn') submitBtn.textContent = 'Login to Dashboard';
      }
    }
  });
}

// Logout clears both
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    clearStaffSession();
    try {
      await signOut(auth);
    } catch (_) {}
    goLogin();
  });
}

export { getStaffSession, isStaffLoggedIn };
