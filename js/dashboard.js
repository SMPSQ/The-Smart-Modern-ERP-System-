// js/dashboard.js — Live Master Dashboard (ERP v4)
import {
  getAllLocal,
  getStudentsByModule,
  getPendingFees,
  getTodayCollection,
  getTotalPendingAmount,
  saveLocal,
  deleteLocal
} from './db.js';
import { drainQueue } from './sync.js';

function formatMoney(n) {
  return 'Rs ' + Number(n || 0).toLocaleString('en-PK');
}

async function loadKPIs() {
  try {
    const students = await getAllLocal('students');
    const batches = await getAllLocal('batches');
    const classes = await getAllLocal('classes');
    const pendingAmount = await getTotalPendingAmount();
    const todayCollection = await getTodayCollection();

    // Module-wise counts — data never mixes across modules
    const schoolCount = students.filter(s => s.module === 'school').length;
    const tradingCount = students.filter(s => s.module === 'trading').length;
    const academyCount = students.filter(s => s.module === 'academy').length;

    const elStudents = document.getElementById('kpi-students');
    const elBatches = document.getElementById('kpi-batches');
    const elCollection = document.getElementById('kpi-collection');
    const elPending = document.getElementById('kpi-pending');

    if (elStudents) {
      elStudents.textContent = students.length;
      const sub = elStudents.parentElement?.querySelector('.sub');
      if (sub) sub.textContent = `School ${schoolCount} · Trading ${tradingCount} · Academy ${academyCount}`;
    }
    if (elBatches) elBatches.textContent = (batches.length + classes.length) || 0;
    if (elCollection) elCollection.textContent = formatMoney(todayCollection);
    if (elPending) elPending.textContent = formatMoney(pendingAmount);
  } catch (err) {
    console.warn('KPI load failed:', err);
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
renderVisitors();

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
