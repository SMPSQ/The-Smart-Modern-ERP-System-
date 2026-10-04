// js/dashboard.js — Live Master Dashboard (ERP v4)
import {
  getAllLocal,
  getLocal,
  saveLocal,
  deleteLocal,
  getTodayCollection as _getTodayCollection,
  getTotalPendingAmount as _getTotalPendingAmount
} from './db.js';
async function getTodayCollection() {
  try { return await _getTodayCollection(); } catch (_) { return 0; }
}
async function getTotalPendingAmount() {
  try { return await _getTotalPendingAmount(); } catch (_) { return 0; }
}
import {
  getStaffSession,
  canManageUsers,
  ensureStaffCredentials,
  suggestUsername
} from './staff-auth.js';
import { drainQueue, fullSync, pullFromCloud } from './sync.js';

function formatMoney(n) {
  return 'Rs ' + Number(n || 0).toLocaleString('en-PK');
}

async function loadKPIs() {
  // exposed for sync pull refresh
  const setTxt = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  try {
    let students = [];
    let batches = [];
    let classes = [];
    let adms = [];
    try { students = await getAllLocal('students') || []; } catch (e) { console.warn(e); }
    try { batches = await getAllLocal('batches') || []; } catch (_) {}
    try { classes = await getAllLocal('classes') || []; } catch (_) {}
    try { adms = await getAllLocal('admissions') || []; } catch (_) {}

    // Also count approved admissions as students if student record missing (tracking fix)
    const schoolCount = students.filter(s => !s.module || s.module === 'school').length;
    const tradingCount = students.filter(s => s.module === 'trading' || s.module === 'trading-academy').length;
    const academyCount = students.filter(s => s.module === 'academy' || s.module === 'educational-academy').length;
    const admSchool = adms.filter(a => !a.module || a.module === 'school').length;
    const admTrade = adms.filter(a => a.module === 'trading' || a.module === 'trading-academy').length;
    const admAcad = adms.filter(a => a.module === 'academy' || a.module === 'educational-academy').length;

    // Effective totals: max(students, approved admissions) per module for visibility
    const schoolEff = Math.max(
      schoolCount,
      adms.filter(a => (!a.module || a.module === 'school') && (a.status === 'approved' || a.status === 'Approved')).length
    );
    const tradingEff = Math.max(
      tradingCount,
      adms.filter(a => (a.module === 'trading' || a.module === 'trading-academy') && (a.status === 'approved' || a.status === 'Approved')).length
    );
    const academyEff = Math.max(
      academyCount,
      adms.filter(a => (a.module === 'academy' || a.module === 'educational-academy') && (a.status === 'approved' || a.status === 'Approved')).length
    );
    const totalEff = schoolEff + tradingEff + academyEff || students.length;

    setTxt('kpi-students', totalEff);
    setTxt('kpi-school-students', schoolEff);
    setTxt('kpi-trading-students', tradingEff);
    setTxt('kpi-academy-students', academyEff);
    setTxt('kpi-school-adm', admSchool);
    setTxt('kpi-trading-adm', admTrade);
    setTxt('kpi-academy-adm', admAcad);
    setTxt('kpi-batches', (batches.length + classes.length) || 0);

    const elStudents = document.getElementById('kpi-students');
    const sub = elStudents?.parentElement?.querySelector('.sub');
    if (sub) {
      sub.innerHTML =
        'School <b>' + schoolEff + '</b> · Trading <b>' + tradingEff +
        '</b> · Academy <b>' + academyEff + '</b>';
    }

    let pendingAmount = 0;
    let todayCollection = 0;
    try { pendingAmount = await getTotalPendingAmount(); } catch (_) {}
    try { todayCollection = await getTodayCollection(); } catch (_) {}
    setTxt('kpi-collection', formatMoney(todayCollection));
    setTxt('kpi-pending', formatMoney(pendingAmount));
  } catch (err) {
    console.warn('KPI load failed:', err);
    // still show zeros not dashes
    ['kpi-students','kpi-school-students','kpi-trading-students','kpi-academy-students',
     'kpi-school-adm','kpi-trading-adm','kpi-academy-adm','kpi-batches'].forEach(id => setTxt(id, 0));
    setTxt('kpi-collection', formatMoney(0));
    setTxt('kpi-pending', formatMoney(0));
  }
}

// ---------- Walk-in / Inquiry Log (full contact) ----------
const form = document.getElementById('visitor-form');
const list = document.getElementById('visitor-list');

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const FOR_LABELS = {
  school: 'School',
  trading: 'Trading Academy',
  academy: 'Educational Academy',
  general: 'General'
};

async function renderVisitors() {
  if (!list) return;
  let visitors = await getAllLocal('visitors');
  const q = (document.getElementById('visitor-search')?.value || '').toLowerCase().trim();
  const st = document.getElementById('visitor-filter-status')?.value || '';
  if (q) {
    visitors = visitors.filter(v =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.phone || '').includes(q) ||
      (v.whatsapp || '').includes(q)
    );
  }
  if (st) visitors = visitors.filter(v => (v.status || 'New') === st);
  visitors.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  list.innerHTML = visitors.length
    ? visitors.map((v) => {
        const tel = (v.phone || '').replace(/\D/g, '');
        const wa = (v.whatsapp || v.phone || '').replace(/\D/g, '');
        return `
        <li>
          <strong>${esc(v.name)}</strong>
          <span class="tag">${esc(FOR_LABELS[v.for] || v.for)}</span>
          <span class="tag">${esc(v.status || 'New')}</span>
          ${v.course ? `<span class="muted">${esc(v.course)}</span>` : ''}
          <span class="muted">${esc(v.phone || '')}</span>
          ${v.followUp ? `<span class="muted">Follow-up: ${esc(v.followUp)}</span>` : ''}
          ${v.counselor ? `<span class="muted">${esc(v.counselor)}</span>` : ''}
          ${v.reason ? `<span class="reason">${esc(v.reason)}</span>` : ''}
          <span class="visitor-time">${v.updatedAt ? new Date(v.updatedAt).toLocaleString() : ''}</span>
          <span class="actions">
            ${tel ? `<a class="mini-btn ghost" href="tel:${tel}">Call</a>` : ''}
            ${wa ? `<a class="mini-btn edit" href="https://wa.me/${wa.startsWith('92') ? wa : '92' + wa.replace(/^0/, '')}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
            <button type="button" class="mini-btn danger" data-del-vis="${v.id}">Delete</button>
          </span>
        </li>`;
      }).join('')
    : '<li class="muted">No inquiries yet.</li>';

  list.querySelectorAll('[data-del-vis]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this inquiry?')) return;
      await deleteLocal('visitors', btn.dataset.delVis);
      await renderVisitors();
      drainQueue();
    });
  });
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('visitor-name').value.trim();
    const phone = document.getElementById('visitor-phone').value.trim();
    if (!name || !phone) return;
    await saveLocal('visitors', {
      name,
      phone,
      whatsapp: document.getElementById('visitor-whatsapp')?.value.trim() || phone,
      for: document.getElementById('visitor-for').value,
      course: document.getElementById('visitor-course')?.value.trim() || '',
      status: document.getElementById('visitor-status')?.value || 'New',
      followUp: document.getElementById('visitor-followup')?.value || '',
      counselor: document.getElementById('visitor-counselor')?.value.trim() || '',
      reason: document.getElementById('visitor-reason')?.value.trim() || ''
    });
    form.reset();
    await renderVisitors();
    drainQueue();
  });
}
document.getElementById('visitor-search')?.addEventListener('input', renderVisitors);
document.getElementById('visitor-filter-status')?.addEventListener('change', renderVisitors);

// Init
loadKPIs();
setTimeout(() => loadKPIs(), 400);
setTimeout(() => loadKPIs(), 1500);
setTimeout(() => loadKPIs(), 4000);
renderVisitors();
const dd = document.getElementById('dash-date');
if (dd) dd.textContent = new Date().toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// Refresh KPIs every 30 seconds
setInterval(loadKPIs, 30000);


// --- Announcements ---
const annForm = document.getElementById('announcement-form');
const annList = document.getElementById('announcement-list');
function escAnn(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function renderAnnouncements() {
  if (!annList) return;
  let list = await getAllLocal('announcements');
  list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  annList.innerHTML = list.length ? list.map(a => `
    <li>
      <strong>${escAnn(a.title)}</strong>
      <span class="tag">${escAnn(a.forModule||'all')}</span>
      <span class="muted">${escAnn(a.body)}</span>
      <span class="actions"><button class="mini-btn danger" data-del-ann="${a.id}">Delete</button></span>
    </li>`).join('') : '<li class="muted">No announcements yet.</li>';
  annList.querySelectorAll('[data-del-ann]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete announcement?')) return;
      await deleteLocal('announcements', btn.dataset.delAnn);
      await renderAnnouncements();
    });
  });
}
if (annForm) {
  annForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('announcements', {
      title: document.getElementById('ann-title').value.trim(),
      body: document.getElementById('ann-body').value.trim(),
      forModule: document.getElementById('ann-for').value,
      createdAt: Date.now()
    });
    annForm.reset();
    await renderAnnouncements();
  });
  renderAnnouncements();
}


// Force push ALL students + core data to cloud
document.getElementById('force-sync-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('force-sync-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }
  try {
    const { forceSyncStudents } = await import('./sync.js');
    const result = await forceSyncStudents();
    if (result?.ok) {
      alert('All local students/records pushed to cloud.
Re-queued: ' + (result.requeued || 0));
    } else {
      alert(
        'Sync incomplete.
' +
        (result?.reason || '') + '
' +
        'Remaining: ' + (result?.remaining ?? '?') + '

' +
        'Tip: Login with Admin EMAIL (not staff username) for Firebase sync.'
      );
    }
  } catch (e) {
    alert('Sync error: ' + (e.message || e));
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Sync now'; }
});



// ---------- User Management (Super Admin / Admin on main dashboard) ----------
function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}


async function initUserManagement() {
  const panel = document.getElementById('user-mgmt-panel');
  if (!panel) {
    console.warn('[FT] user-mgmt-panel not in DOM');
    return;
  }

  let allowed = false;
  try {
    const staff = typeof getStaffSession === 'function' ? getStaffSession() : null;
    if (!staff) {
      // Firebase Super Admin (email login) — no staff session
      allowed = true;
    } else if (typeof canManageUsers === 'function') {
      allowed = canManageUsers();
    } else {
      const role = (staff.role || '').toLowerCase();
      allowed = ['super admin', 'principal', 'admin'].includes(role);
    }
  } catch (err) {
    console.warn('[FT] user mgmt auth check', err);
    allowed = true;
  }

  if (!allowed) {
    panel.style.display = 'none';
    const nav = document.getElementById('nav-users-link');
    if (nav) nav.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  const nav = document.getElementById('nav-users-link');
  if (nav) nav.style.display = '';

  const form = document.getElementById('dash-user-form');
  const listEl = document.getElementById('dash-user-list');

  async function renderUsers() {
    if (!listEl) return;
    let all = [];
    try {
      all = await getAllLocal('staff');
    } catch (e) {
      console.warn(e);
    }
    all.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    listEl.innerHTML = all.length
      ? all.map((s) => `
        <li>
          <strong>${escHtml(s.name)}</strong>
          <span class="tag">${escHtml(s.role || 'Staff')}</span>
          <span class="muted">@${escHtml(s.username || '—')}</span>
          <span class="muted">${escHtml(s.phone || '')}</span>
          <span class="actions">
            <button type="button" class="mini-btn edit" data-edit="${s.id}">Edit</button>
            <button type="button" class="mini-btn ghost" data-reset="${s.id}">Reset PW</button>
            <button type="button" class="mini-btn danger" data-del="${s.id}">Delete</button>
          </span>
        </li>`).join('')
      : '<li class="muted">Abhi koi staff user nahi — form se Create User karein.</li>';

    listEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this user?')) return;
        await deleteLocal('staff', btn.dataset.del);
        await renderUsers();
      });
    });
    listEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const s = await getLocal('staff', btn.dataset.edit);
        if (!s) return;
        document.getElementById('dash-user-edit-id').value = s.id;
        document.getElementById('dash-user-name').value = s.name || '';
        document.getElementById('dash-user-role').value = s.role || 'Staff';
        document.getElementById('dash-user-phone').value = s.phone || '';
        document.getElementById('dash-user-username').value = s.username || '';
        document.getElementById('dash-user-password').value = '';
        document.getElementById('dash-user-password').placeholder = 'Leave blank to keep password';
        document.getElementById('dash-user-submit').textContent = 'Update User';
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    listEl.querySelectorAll('[data-reset]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Reset password to a new auto password?')) return;
        const s = await getLocal('staff', btn.dataset.reset);
        if (!s) return;
        const { username: u, password: pw } = await ensureStaffCredentials(s, null);
        const box = document.getElementById('dash-cred-box');
        if (box) {
          box.style.display = 'block';
          document.getElementById('dash-cred-user').textContent = u;
          document.getElementById('dash-cred-pass').textContent = pw;
        }
        alert('New password: ' + pw);
        await renderUsers();
      });
    });
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('dash-user-edit-id').value.trim();
      const name = document.getElementById('dash-user-name').value.trim();
      const role = document.getElementById('dash-user-role').value;
      const phone = document.getElementById('dash-user-phone').value.trim();
      const username = document.getElementById('dash-user-username').value.trim();
      const plainPw = document.getElementById('dash-user-password').value.trim();
      if (!name || !role) {
        alert('Name aur Role zaroori hain');
        return;
      }

      try {
        let base;
        if (editId) {
          base = (await getLocal('staff', editId)) || { id: editId };
          base.name = name;
          base.role = role;
          base.phone = phone;
          base.username = username || base.username || suggestUsername(name);
          base.active = true;
          base.module = base.module || 'school';
          if (plainPw) {
            const { username: u, password: pw } = await ensureStaffCredentials(base, plainPw);
            const box = document.getElementById('dash-cred-box');
            if (box) {
              box.style.display = 'block';
              document.getElementById('dash-cred-user').textContent = u;
              document.getElementById('dash-cred-pass').textContent = pw;
            }
          } else {
            await saveLocal('staff', base);
          }
        } else {
          base = {
            name,
            role,
            phone,
            username: username || suggestUsername(name),
            active: true,
            module: 'school'
          };
          const { username: u, password: pw } = await ensureStaffCredentials(base, plainPw || null);
          const box = document.getElementById('dash-cred-box');
          if (box) {
            box.style.display = 'block';
            document.getElementById('dash-cred-user').textContent = u;
            document.getElementById('dash-cred-pass').textContent = pw;
          }
          alert('User ban gaya!\nUsername: ' + u + '\nPassword: ' + pw);
        }
        form.reset();
        document.getElementById('dash-user-edit-id').value = '';
        document.getElementById('dash-user-password').placeholder = 'Password (auto if empty)';
        document.getElementById('dash-user-submit').textContent = 'Create User';
        await renderUsers();
      } catch (err) {
        console.error(err);
        alert('User save error: ' + (err.message || err));
      }
    });
  }

  await renderUsers();
  console.info('[FT] User Management panel active');
}

// Run after short delay so auth/session is ready
initUserManagement();
setTimeout(() => initUserManagement(), 500);
setTimeout(() => initUserManagement(), 1500);


window.__ft_reloadKPIs = loadKPIs;

document.getElementById('sync-now-btn')?.addEventListener('click', async () => {
  try {
    await fullSync();
    await loadKPIs();
  } catch (e) {
    console.warn(e);
  }
});
// Also any button with text Sync now
document.querySelectorAll('button').forEach((btn) => {
  if ((btn.textContent || '').trim().toLowerCase().includes('sync now') && !btn.dataset.ftSync) {
    btn.dataset.ftSync = '1';
    btn.addEventListener('click', async () => {
      try {
        await fullSync();
        await loadKPIs();
        alert('Cloud se data sync ho gaya');
      } catch (e) {
        alert('Sync: ' + (e.message || e));
      }
    });
  }
});
