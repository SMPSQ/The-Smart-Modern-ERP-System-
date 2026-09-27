/**
 * Local staff accounts (created when staff is added).
 * Offline-capable role-based access — separate from Firebase Super Admin.
 * v6: Shop Salesman role + personal-data privacy for non-admins
 */
import { getAllLocal, saveLocal, getLocal, deleteLocal } from './db.js';

const SESSION_KEY = 'ft_staff_session';

/** Roles that can see personal details (CNIC, phone, salary, full forms) */
export const PRIVILEGED_ROLES = [
  'Super Admin',
  'Principal',
  'Admin'
];

/** Role → allowed school tabs (null = full access) */
export const ROLE_TABS = {
  'Super Admin': null,
  'Principal': null,
  'Admin': null,
  'Accountant': ['fees', 'challans', 'finance', 'reports', 'students', 'accounting'],
  'Teacher': ['attendance', 'exams', 'homework', 'timetable', 'students', 'certificates'],
  'Receptionist': ['admission', 'students', 'challans', 'reports'],
  'Counselor': ['admission', 'students', 'reports'],
  'Clerk': ['admission', 'students', 'fees', 'challans', 'reports'],
  'Librarian': ['library', 'students'],
  'Staff': ['attendance'],
  'Shop Salesman': [], // shop only — redirected to shop module
  'Peon': [],
  'Guard': [],
  'Sweeper / Cleaner': [],
  'Other': ['attendance']
};

/** Modules a role may open (dashboard cards / direct URLs) */
export const ROLE_MODULES = {
  'Super Admin': ['school', 'trading-academy', 'educational-academy', 'shop'],
  'Principal': ['school', 'trading-academy', 'educational-academy', 'shop'],
  'Admin': ['school', 'trading-academy', 'educational-academy', 'shop'],
  'Accountant': ['school'],
  'Teacher': ['school'],
  'Receptionist': ['school'],
  'Counselor': ['school'],
  'Clerk': ['school'],
  'Librarian': ['school'],
  'Staff': ['school'],
  'Shop Salesman': ['shop'],
  'Peon': [],
  'Guard': [],
  'Sweeper / Cleaner': [],
  'Other': ['school']
};

export function getStaffSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStaffSession(staff) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    id: staff.id,
    name: staff.name,
    username: staff.username,
    role: staff.role || 'Staff',
    module: staff.module || 'school'
  }));
}

export function clearStaffSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isStaffLoggedIn() {
  return !!getStaffSession();
}

/** Firebase Admin OR privileged staff role */
export function canSeePersonalDetails() {
  // Firebase user = Super Admin path
  try {
    if (window.__ft_firebase_user) return true;
  } catch (_) {}
  const staff = getStaffSession();
  if (!staff) {
    // No staff session but passed route guard → Firebase admin
    return true;
  }
  return PRIVILEGED_ROLES.includes(staff.role);
}

export function isShopOnlyRole(role) {
  return role === 'Shop Salesman';
}

export function allowedTabsForRole(role) {
  if (!role) return null;
  const tabs = ROLE_TABS[role];
  if (tabs === null || tabs === undefined) return null;
  return tabs;
}

export function allowedModulesForRole(role) {
  if (!role) return ['school', 'trading-academy', 'educational-academy', 'shop'];
  return ROLE_MODULES[role] || ['school'];
}

/** Mask sensitive value for non-privileged users */
export function maskSensitive(value, visibleChars = 0) {
  if (canSeePersonalDetails()) return value == null ? '' : String(value);
  const s = value == null ? '' : String(value).trim();
  if (!s) return '—';
  if (s.length <= 4) return '••••';
  if (visibleChars > 0) return s.slice(0, visibleChars) + '••••';
  return '••••••••';
}

/** Simple non-crypto hash for offline password check */
export async function hashPassword(pw) {
  const data = new TextEncoder().encode('ft:' + pw);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  const s = 'ft:' + pw;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return 'x' + (h >>> 0).toString(16);
}

export function generatePassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function suggestUsername(name) {
  const base = String(name || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 16) || 'user';
  return base + Math.floor(10 + Math.random() * 89);
}

export async function loginStaff(username, password) {
  const all = await getAllLocal('staff');
  const user = all.find(
    (s) =>
      s.username &&
      s.username.toLowerCase() === String(username).toLowerCase().trim()
  );
  if (!user || !user.passwordHash) {
    return { ok: false, error: 'Invalid username or password' };
  }
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) {
    return { ok: false, error: 'Invalid username or password' };
  }
  setStaffSession(user);
  try {
    await ensureFirebaseAuthForSync();
  } catch (_) {}
  return { ok: true, staff: user };
}

export async function ensureStaffCredentials(staffRecord, plainPassword) {
  const username = staffRecord.username || suggestUsername(staffRecord.name);
  const password =
    plainPassword && String(plainPassword).length
      ? plainPassword
      : generatePassword(8);
  const passwordHash = await hashPassword(password);
  staffRecord.username = username;
  staffRecord.passwordHash = passwordHash;
  staffRecord.mustChangePassword = !(
    plainPassword && String(plainPassword).length
  );
  await saveLocal('staff', staffRecord);
  return { username, password, staff: staffRecord };
}

export function applyTabAccess(role) {
  // Shop Salesman never stays on school module
  if (isShopOnlyRole(role)) {
    const root = (document.body.dataset.root || '../../').replace(/\/?$/, '/');
    window.location.href = root + 'modules/shop/index.html';
    return;
  }

  const allowed = allowedTabsForRole(role);
  if (allowed === null) return;

  const buttons = document.querySelectorAll('.tab-btn[data-tab]');
  const panels = document.querySelectorAll('.tab-panel');
  let firstAllowed = null;
  buttons.forEach((btn) => {
    const tab = btn.dataset.tab;
    if (allowed.includes(tab)) {
      btn.style.display = '';
      if (!firstAllowed) firstAllowed = tab;
    } else {
      btn.style.display = 'none';
    }
  });
  panels.forEach((p) => {
    const id = (p.id || '').replace('tab-', '');
    if (!allowed.includes(id)) p.classList.remove('active');
  });
  if (firstAllowed) {
    const btn = document.querySelector(`.tab-btn[data-tab="${firstAllowed}"]`);
    if (btn) btn.click();
  } else if (allowed.length === 0) {
    const main = document.querySelector('main') || document.body;
    const note = document.createElement('div');
    note.className = 'form-card';
    note.style.margin = '1rem';
    note.innerHTML =
      '<h3>Limited access</h3><p class="hint">Aapke role ke liye koi ERP module assign nahi. Admin se contact karein.</p>';
    main.prepend(note);
  }
}

/** Hide personal-detail fields/columns for non-admin roles */
export function applyPersonalDataPrivacy() {
  if (canSeePersonalDetails()) return;

  // Mark sensitive form fields
  const sensitiveIds = [
    'adm-bform',
    'adm-father-cnic',
    'adm-father-phone',
    'adm-phone',
    'student-phone',
    'student-cnic',
    'teacher-phone',
    'teacher-cnic',
    'staff-phone',
    'staff-salary',
    'staff-cnic',
    'payroll-basic',
    'payroll-allowances',
    'payroll-deductions'
  ];
  sensitiveIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const wrap = el.closest('.field') || el.parentElement;
    if (wrap) {
      wrap.classList.add('privacy-restricted');
      wrap.style.display = 'none';
    }
  });

  // Hide salary column labels in lists via CSS class
  document.body.classList.add('privacy-mode');
}

/** Ensure Firebase Auth session exists so Firestore rules allow write */
export async function ensureFirebaseAuthForSync() {
  try {
    const { auth } = await import('./firebase-config.js');
    const { signInAnonymously } = await import(
      'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js'
    );
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.warn('Anonymous auth for sync failed:', err?.message || err);
    return null;
  }
}
