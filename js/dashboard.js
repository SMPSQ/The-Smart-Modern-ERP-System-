// js/dashboard.js — Live Master Dashboard (ERP v4)
import {
  getAllLocal,
  getStudentsByModule,
  getPendingFees,
  getTodayCollection,
  getTotalPendingAmount,
  saveLocal
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

// ---------- Walk-in Visitor Log ----------
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
  general: 'General inquiry'
};

async function renderVisitors() {
  if (!list) return;
  const visitors = await getAllLocal('visitors');
  visitors.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  list.innerHTML = visitors.length
    ? visitors.map((v) => `
        <li>
          <strong>${esc(v.name)}</strong>
          <span class="tag">${esc(FOR_LABELS[v.for] || v.for)}</span>
          ${v.reason ? `<span class="reason">${esc(v.reason)}</span>` : ''}
          <span class="visitor-time">${new Date(v.updatedAt).toLocaleString()}</span>
        </li>
      `).join('')
    : '<li class="muted">No visitors logged yet.</li>';
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('visitor-name').value.trim();
    const forWhom = document.getElementById('visitor-for').value;
    const reason = document.getElementById('visitor-reason').value.trim();
    if (!name) return;

    await saveLocal('visitors', { name, for: forWhom, reason });
    form.reset();
    await renderVisitors();
    drainQueue();
  });
}

// Init
loadKPIs();
renderVisitors();

// Refresh KPIs every 30 seconds
setInterval(loadKPIs, 30000);
