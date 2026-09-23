// modules/trading-academy/trading.js — Trading Academy Module (ERP v4)
import { saveLocal, getAllLocal, deleteLocal } from '../../js/db.js';
import { runSync } from '../../js/sync.js';

function esc(str = '') {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function formatMoney(n) {
  const num = Number(n || 0);
  const color = num >= 0 ? '#2D6A4F' : '#9B2226';
  return `<span style="color:${color};font-weight:600">${num >= 0 ? '+' : ''}${num.toFixed(2)}</span>`;
}

// ========== BATCHES ==========
const batchForm = document.getElementById('batch-form');
const batchList = document.getElementById('batch-list');
const enrollBatch = document.getElementById('enroll-batch');

async function renderBatches() {
  const batches = await getAllLocal('batches');
  batches.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (batchList) {
    batchList.innerHTML = batches.length
      ? batches.map(b => `
        <li>
          <strong>${esc(b.name)}</strong>
          <span class="tag">${esc(b.gender)}</span>
          <span class="muted">${esc(b.timing || '')}</span>
          <span class="muted">${esc(b.instructor || '')}</span>
          <button class="mini-btn danger" data-del-batch="${b.id}" style="margin-left:auto">Delete</button>
        </li>
      `).join('')
      : '<li class="muted">No batches yet.</li>';

    batchList.querySelectorAll('[data-del-batch]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this batch?')) return;
        await deleteLocal('batches', btn.dataset.delBatch);
        await renderBatches();
        await populateBatchSelect();
        runSync();
      });
    });
  }

  await populateBatchSelect();
}

async function populateBatchSelect() {
  if (!enrollBatch) return;
  const batches = await getAllLocal('batches');
  const current = enrollBatch.value;
  enrollBatch.innerHTML = '<option value="">Select batch</option>' +
    batches.map(b => `<option value="${b.id}">${esc(b.name)} (${esc(b.gender)})</option>`).join('');
  if (current) enrollBatch.value = current;
}

if (batchForm) {
  batchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('batches', {
      name: document.getElementById('batch-name').value.trim(),
      gender: document.getElementById('batch-gender').value,
      timing: document.getElementById('batch-timing').value.trim(),
      instructor: document.getElementById('batch-instructor').value.trim(),
      module: 'trading'
    });
    batchForm.reset();
    await renderBatches();
    runSync();
  });
}

// ========== ENROLLMENTS ==========
const enrollForm = document.getElementById('enroll-form');
const enrollList = document.getElementById('enroll-list');
const journalStudent = document.getElementById('journal-student');

async function renderEnrollments() {
  const enrolls = await getAllLocal('tradingEnrollments');
  const batches = await getAllLocal('batches');
  const batchMap = Object.fromEntries(batches.map(b => [b.id, b.name]));

  enrolls.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (enrollList) {
    enrollList.innerHTML = enrolls.length
      ? enrolls.map(e => `
        <li>
          <strong>${esc(e.name)}</strong>
          <span class="tag">${esc(batchMap[e.batchId] || '—')}</span>
          <span class="muted">${esc(e.phone || '')}</span>
          <button class="mini-btn danger" data-del-enroll="${e.id}" style="margin-left:auto">Remove</button>
        </li>
      `).join('')
      : '<li class="muted">No enrollments yet.</li>';

    enrollList.querySelectorAll('[data-del-enroll]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this enrollment?')) return;
        await deleteLocal('tradingEnrollments', btn.dataset.delEnroll);
        await renderEnrollments();
        await populateStudentSelect();
        runSync();
      });
    });
  }

  await populateStudentSelect();
}

async function populateStudentSelect() {
  if (!journalStudent) return;
  const enrolls = await getAllLocal('tradingEnrollments');
  const current = journalStudent.value;
  journalStudent.innerHTML = '<option value="">Select student</option>' +
    enrolls.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  if (current) journalStudent.value = current;
}

if (enrollForm) {
  enrollForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const batchId = document.getElementById('enroll-batch').value;
    if (!batchId) return;

    await saveLocal('tradingEnrollments', {
      name: document.getElementById('enroll-name').value.trim(),
      batchId,
      phone: document.getElementById('enroll-phone').value.trim(),
      module: 'trading'
    });

    // Also add to global students list
    await saveLocal('students', {
      name: document.getElementById('enroll-name').value.trim(),
      className: 'Trading',
      phone: document.getElementById('enroll-phone').value.trim(),
      module: 'trading'
    });

    enrollForm.reset();
    await renderEnrollments();
    runSync();
  });
}

// ========== TRADING JOURNAL ==========
const journalForm = document.getElementById('journal-form');
const journalList = document.getElementById('journal-list');

async function renderJournal() {
  if (!journalList) return;
  const trades = await getAllLocal('tradingJournal');
  const enrolls = await getAllLocal('tradingEnrollments');
  const nameMap = Object.fromEntries(enrolls.map(e => [e.id, e.name]));

  trades.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  journalList.innerHTML = trades.length
    ? trades.map(t => {
        let pnl = null;
        if (t.exitPrice && t.entryPrice) {
          const diff = t.side === 'Buy'
            ? (t.exitPrice - t.entryPrice)
            : (t.entryPrice - t.exitPrice);
          pnl = diff * (t.lots || 0.1) * 100000; // simplified pip value for display
        }
        return `
          <li>
            <strong>${esc(nameMap[t.studentId] || '—')}</strong>
            <span class="tag">${esc(t.symbol)}</span>
            <span class="tag">${esc(t.side)}</span>
            <span class="muted">Entry: ${t.entryPrice}</span>
            ${t.exitPrice ? `<span class="muted">Exit: ${t.exitPrice}</span>` : ''}
            ${pnl !== null ? formatMoney(pnl) : '<span class="muted">Open</span>'}
            <button class="mini-btn danger" data-del-trade="${t.id}" style="margin-left:auto">×</button>
          </li>
        `;
      }).join('')
    : '<li class="muted">No trades logged yet.</li>';

  journalList.querySelectorAll('[data-del-trade]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this trade?')) return;
      await deleteLocal('tradingJournal', btn.dataset.delTrade);
      await renderJournal();
      runSync();
    });
  });
}

if (journalForm) {
  journalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('journal-student').value;
    if (!studentId) return;

    await saveLocal('tradingJournal', {
      studentId,
      symbol: document.getElementById('journal-symbol').value.trim().toUpperCase(),
      side: document.getElementById('journal-side').value,
      entryPrice: Number(document.getElementById('journal-entry').value),
      exitPrice: document.getElementById('journal-exit').value
        ? Number(document.getElementById('journal-exit').value)
        : null,
      lots: Number(document.getElementById('journal-lots').value) || 0.1,
      module: 'trading'
    });

    journalForm.reset();
    document.getElementById('journal-lots').value = '0.1';
    await renderJournal();
    runSync();
  });
}

// Init
(async function init() {
  await renderBatches();
  await renderEnrollments();
  await renderJournal();
})();
