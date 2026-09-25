/**
 * Local staff accounts (created when staff is added).
 * Offline-capable role-based access — separate from Firebase Super Admin.
 */
import { getAllLocal, saveLocal, getLocal, deleteLocal } from './db.js';

const SESSION_KEY = 'ft_staff_session';

/** Role → allowed school tabs (empty = full access) */
export const ROLE_TABS = {
  'Super Admin': null,
  'Principal': null,
  'Admin': null,
  'Accountant': ['fees', 'challans', 'finance', 'reports', 'students'],
  'Teacher': ['attendance', 'exams', 'homework', 'timetable', 'students', 'certificates'],
  'Receptionist': ['admission', 'students', 'challans', 'reports'],
  'Counselor': ['admission', 'students', 'reports'],
  'Clerk': ['admission', 'students', 'fees', 'challans', 'reports'],
  'Librarian': ['library', 'students'],
  'Staff': ['attendance'],
  'Peon': [],
  'Guard': [],
  'Sweeper / Cleaner': [],
  'Other': ['attendance']
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

export function allowedTabsForRole(role) {
  if (!role) return null;
  const tabs = ROLE_TABS[role];
  if (tabs === null || tabs === undefined) return null; // full
  return tabs;
}

/** Simple non-crypto hash for offline password check (not bank-grade) */
export async function hashPassword(pw) {
  const data = new TextEncoder().encode('ft:' + pw);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // fallback
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
  return String(name || 'staff')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20) || 'staff';
}

export async function loginStaff(username, password) {
  const all = await getAllLocal('staff');
  const user = all.find(s => (s.username || '').toLowerCase() === username.toLowerCase());
  if (!user || !user.passwordHash) return { ok: false, error: 'Invalid username or password' };
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) return { ok: false, error: 'Invalid username or password' };
  if (user.active === false) return { ok: false, error: 'Account disabled' };
  setStaffSession(user);
  return { ok: true, staff: user };
}

export async function ensureStaffCredentials(staffRecord, plainPassword) {
  const username = staffRecord.username || suggestUsername(staffRecord.name);
  const password = (plainPassword && String(plainPassword).length) ? plainPassword : generatePassword(8);
  const passwordHash = await hashPassword(password);
  staffRecord.username = username;
  staffRecord.passwordHash = passwordHash;
  staffRecord.mustChangePassword = !(plainPassword && String(plainPassword).length);
  await saveLocal('staff', staffRecord);
  return { username, password, staff: staffRecord };
}

export function applyTabAccess(role) {
  const allowed = allowedTabsForRole(role);
  if (allowed === null) return; // full access
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
    if (allowed.includes(id)) {
      // leave visibility to tab system
    } else {
      p.classList.remove('active');
    }
  });
  if (firstAllowed) {
    const btn = document.querySelector(`.tab-btn[data-tab="${firstAllowed}"]`);
    if (btn) btn.click();
  } else if (allowed.length === 0) {
    const main = document.querySelector('main') || document.body;
    const note = document.createElement('div');
    note.className = 'form-card';
    note.style.margin = '1rem';
    note.innerHTML = '<h3>Limited access</h3><p class="hint">Aapke role ke liye koi ERP module assign nahi. Admin se contact karein.</p>';
    main.prepend(note);
  }
}
