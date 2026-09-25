// modules/trading-academy/trading.js — Separate data + Print support
import { saveLocal, getAllLocal, deleteLocal, getLocal } from '../../js/db.js';
import { runSync } from '../../js/sync.js';
import { printDocument, buildAdmissionPrint, buildChallanPrint, buildCertificatePrint } from '../../js/print.js';

const MODULE = 'trading';
const INST_NAME = 'Future Tech Trading Academy';

function esc(str = '') {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function formatMoney(n) {
  return 'Rs ' + Number(n || 0).toLocaleString('en-PK');
}
function monthLabel(ym) {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
async function getModuleRecords(store) {
  const all = await getAllLocal(store);
  return all.filter(r => r.module === MODULE);
}

// ========== ADMISSIONS ==========
const admissionForm = document.getElementById('admission-form');
const admissionList = document.getElementById('admission-list');

async function renderAdmissions() {
  if (!admissionList) return;
  const list = await getModuleRecords('admissions');
  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  admissionList.innerHTML = list.length
    ? list.map(a => `
      <li>
        <strong>${esc(a.name)}</strong>
        <span class="tag">${esc(a.course || '')}</span>
        <span class="muted">${esc(a.phone || '')}</span>
        ${a.status === 'approved'
          ? '<span class="tag" style="background:#d1fae5;color:#065f46">Approved</span>'
          : `<button class="mini-btn" data-approve="${a.id}">Approve</button>`
        }
        <span class="actions">
          <button class="mini-btn edit" data-edit-adm="${a.id}">Edit</button>
          <button class="mini-btn ghost" data-print-adm="${a.id}">Print</button>
          <button class="mini-btn danger" data-del-adm="${a.id}">Delete</button>
        </span>
      </li>
    `).join('')
    : '<li class="muted">No admissions yet.</li>';

  admissionList.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const adm = await getLocal('admissions', btn.dataset.approve);
      if (!adm || adm.module !== MODULE) return;
      await saveLocal('students', {
        name: adm.name, className: adm.course || 'Trading',
        phone: adm.phone, guardianName: adm.guardianName,
        module: MODULE, admissionId: adm.id
      });
      await saveLocal('tradingEnrollments', {
        name: adm.name, phone: adm.phone, course: adm.course, module: MODULE
      });
      adm.status = 'approved';
      await saveLocal('admissions', adm);
      await renderAdmissions();
      await renderEnrollments();
      await populateStudentSelects();
      runSync();
    });
  });

  
  admissionList.querySelectorAll('[data-edit-adm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const adm = await getLocal('admissions', btn.dataset.editAdm);
      if (!adm) return;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      set('adm-name', adm.name);
      set('adm-phone', adm.phone);
      set('adm-cnic', adm.bform);
      set('adm-gender', adm.gender);
      set('adm-course', adm.course);
      set('adm-timing', adm.timing);
      set('adm-guardian', adm.guardianName);
      set('adm-date', adm.admissionDate);
      set('adm-address', adm.address);
      window._editAdmissionId = adm.id;
      const submitBtn = document.querySelector('#admission-form button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Admission';
      document.querySelector('.tab-btn[data-tab="admission"]')?.click();
    });
  });

  admissionList.querySelectorAll('[data-print-adm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const adm = await getLocal('admissions', btn.dataset.printAdm);
      if (!adm) return;
      adm.className = adm.course;
      adm.fatherName = adm.guardianName;
      printDocument('Trading Academy Admission Form', buildAdmissionPrint(adm, INST_NAME), { subtitle: INST_NAME });
    });
  });

  admissionList.querySelectorAll('[data-del-adm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this admission?')) return;
      await deleteLocal('admissions', btn.dataset.delAdm);
      await renderAdmissions();
      runSync();
    });
  });
}

if (admissionForm) {
  const dateInput = document.getElementById('adm-date');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  admissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('admissions', {
      name: document.getElementById('adm-name').value.trim(),
      phone: document.getElementById('adm-phone').value.trim(),
      bform: document.getElementById('adm-cnic').value.trim(),
      gender: document.getElementById('adm-gender').value,
      course: document.getElementById('adm-course').value.trim(),
      className: document.getElementById('adm-course').value.trim(),
      timing: document.getElementById('adm-timing').value.trim(),
      guardianName: document.getElementById('adm-guardian').value.trim(),
      admissionDate: document.getElementById('adm-date').value,
      address: document.getElementById('adm-address').value.trim(),
      status: 'pending',
      module: MODULE
    });
    admissionForm.reset();
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    await renderAdmissions();
    runSync();
  });
}

// ========== BATCHES ==========
const batchForm = document.getElementById('batch-form');
const batchList = document.getElementById('batch-list');
const enrollBatch = document.getElementById('enroll-batch');

async function renderBatches() {
  const batches = await getModuleRecords('batches');
  batches.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (batchList) {
    batchList.innerHTML = batches.length
      ? batches.map(b => `
        <li>
          <strong>${esc(b.name)}</strong>
          <span class="tag">${esc(b.gender)}</span>
          <span class="muted">${esc(b.timing || '')}</span>
          <span class="muted">${esc(b.instructor || '')}</span>
          ${b.fee ? `<span class="amount">${formatMoney(b.fee)}</span>` : ''}
          <button class="mini-btn danger" data-del-batch="${b.id}" style="margin-left:auto">Delete</button>
        </li>
      `).join('')
      : '<li class="muted">No batches yet.</li>';
    batchList.querySelectorAll('[data-del-batch]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this batch?')) return;
        await deleteLocal('batches', btn.dataset.delBatch);
        await renderBatches();
        runSync();
      });
    });
  }
  if (enrollBatch) {
    const current = enrollBatch.value;
    enrollBatch.innerHTML = '<option value="">Select batch</option>' +
      batches.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
    if (current) enrollBatch.value = current;
  }
}

if (batchForm) {
  batchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('batches', {
      name: document.getElementById('batch-name').value.trim(),
      gender: document.getElementById('batch-gender').value,
      timing: document.getElementById('batch-timing').value.trim(),
      instructor: document.getElementById('batch-instructor').value.trim(),
      fee: Number(document.getElementById('batch-fee').value) || 0,
      module: MODULE
    });
    batchForm.reset();
    await renderBatches();
    runSync();
  });
}

// ========== ENROLLMENTS ==========
const enrollForm = document.getElementById('enroll-form');
const enrollList = document.getElementById('enroll-list');

async function renderEnrollments() {
  const enrolls = await getModuleRecords('tradingEnrollments');
  const batches = await getModuleRecords('batches');
  const batchMap = Object.fromEntries(batches.map(b => [b.id, b.name]));
  enrolls.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (enrollList) {
    enrollList.innerHTML = enrolls.length
      ? enrolls.map(e => `
        <li>
          <strong>${esc(e.name)}</strong>
          <span class="tag">${esc(batchMap[e.batchId] || e.course || '—')}</span>
          <span class="muted">${esc(e.phone || '')}</span>
          <span class="actions">
            <button class="mini-btn ghost" data-cert="${e.id}">Certificate</button>
            <button class="mini-btn danger" data-del-enroll="${e.id}">Delete</button>
          </span>
        </li>
      `).join('')
      : '<li class="muted">No enrollments yet.</li>';

    enrollList.querySelectorAll('[data-cert]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const e = await getLocal('tradingEnrollments', btn.dataset.cert);
        if (!e) return;
        printDocument('Certificate of Completion', buildCertificatePrint({
          studentName: e.name,
          type: 'Completion',
          course: batchMap[e.batchId] || e.course || 'Trading Program',
          body: `has successfully completed the trading program at ${INST_NAME}.`
        }, INST_NAME), { subtitle: INST_NAME });
      });
    });

    enrollList.querySelectorAll('[data-del-enroll]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this enrollment?')) return;
        await deleteLocal('tradingEnrollments', btn.dataset.delEnroll);
        await renderEnrollments();
        await populateStudentSelects();
        runSync();
      });
    });
  }
  await populateStudentSelects();
}

if (enrollForm) {
  enrollForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const batchId = document.getElementById('enroll-batch').value;
    const name = document.getElementById('enroll-name').value.trim();
    const phone = document.getElementById('enroll-phone').value.trim();
    if (!batchId || !name) return;
    await saveLocal('tradingEnrollments', { name, batchId, phone, module: MODULE });
    await saveLocal('students', { name, className: 'Trading', phone, module: MODULE });
    enrollForm.reset();
    await renderEnrollments();
    runSync();
  });
}

// ========== FEE CHALLANS ==========
const challanForm = document.getElementById('challan-form');
const challanList = document.getElementById('challan-list');
const challanStudent = document.getElementById('challan-student');
const statusFilter = document.getElementById('status-filter');

async function populateStudentSelects() {
  const enrolls = await getModuleRecords('tradingEnrollments');
  enrolls.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (challanStudent) {
    const current = challanStudent.value;
    challanStudent.innerHTML = '<option value="">Select student</option>' +
      enrolls.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    if (current) challanStudent.value = current;
  }
  const journalStudent = document.getElementById('journal-student');
  if (journalStudent) {
    const current = journalStudent.value;
    journalStudent.innerHTML = '<option value="">Select student</option>' +
      enrolls.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    if (current) journalStudent.value = current;
  }
}

async function renderChallans() {
  if (!challanList) return;
  let challans = await getModuleRecords('feeChallans');
  const sFilter = statusFilter?.value || 'all';
  if (sFilter !== 'all') {
    challans = challans.filter(c => (c.status || '').toLowerCase() === sFilter.toLowerCase());
  }
  challans.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  challanList.innerHTML = challans.length
    ? challans.map(c => {
        const isPaid = (c.status || '').toLowerCase() === 'paid';
        return `
          <li>
            <strong>${esc(c.studentName)}</strong>
            <span class="muted">${monthLabel(c.month)}</span>
            <span class="amount">${formatMoney(c.amount)}</span>
            <button class="status-btn ${isPaid ? 'status-btn--paid' : 'status-btn--unpaid'}" data-toggle="${c.id}">
              ${isPaid ? 'Paid' : 'Unpaid'}
            </button>
            <span class="actions">
              <button class="mini-btn ghost" data-print-challan="${c.id}">Print</button>
              <button class="mini-btn danger" data-del-challan="${c.id}">Delete</button>
            </span>
          </li>
        `;
      }).join('')
    : '<li class="muted">No challans yet.</li>';

  challanList.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const all = await getAllLocal('feeChallans');
      const rec = all.find(c => c.id === btn.dataset.toggle && c.module === MODULE);
      if (!rec) return;
      const isPaid = (rec.status || '').toLowerCase() === 'paid';
      rec.status = isPaid ? 'Unpaid' : 'Paid';
      rec.paidOn = isPaid ? null : Date.now();
      await saveLocal('feeChallans', rec);
      await renderChallans();
      runSync();
    });
  });

  challanList.querySelectorAll('[data-print-challan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const c = await getLocal('feeChallans', btn.dataset.printChallan);
      if (!c) return;
      c.monthLabel = monthLabel(c.month);
      printDocument('Fee Challan — Trading Academy', buildChallanPrint(c, INST_NAME), { subtitle: INST_NAME });
    });
  });

  challanList.querySelectorAll('[data-del-challan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this challan?')) return;
      await deleteLocal('feeChallans', btn.dataset.delChallan);
      await renderChallans();
      runSync();
    });
  });
}

if (challanForm) {
  const monthInput = document.getElementById('challan-month');
  if (monthInput) {
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  challanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const select = document.getElementById('challan-student');
    const opt = select.selectedOptions[0];
    if (!opt || !opt.value) return;
    const month = document.getElementById('challan-month').value;
    const amount = Number(document.getElementById('challan-amount').value);
    if (!month || !amount) return;
    await saveLocal('feeChallans', {
      studentId: opt.value,
      studentName: opt.textContent,
      month, amount,
      status: 'Unpaid',
      module: MODULE
    });
    challanForm.reset();
    if (monthInput) {
      const now = new Date();
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    await populateStudentSelects();
    await renderChallans();
    runSync();
  });
}
if (statusFilter) statusFilter.addEventListener('change', renderChallans);

// ========== TRADING JOURNAL ==========
const journalForm = document.getElementById('journal-form');
const journalList = document.getElementById('journal-list');

async function renderJournal() {
  if (!journalList) return;
  const trades = await getModuleRecords('tradingJournal');
  const enrolls = await getModuleRecords('tradingEnrollments');
  const nameMap = Object.fromEntries(enrolls.map(e => [e.id, e.name]));
  trades.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  journalList.innerHTML = trades.length
    ? trades.map(t => {
        let pnl = null;
        if (t.exitPrice && t.entryPrice) {
          const diff = t.side === 'Buy' ? (t.exitPrice - t.entryPrice) : (t.entryPrice - t.exitPrice);
          pnl = diff * (t.lots || 0.1) * 100000;
        }
        const pnlHtml = pnl !== null
          ? `<span style="color:${pnl >= 0 ? '#2D6A4F' : '#9B2226'};font-weight:600">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</span>`
          : '<span class="muted">Open</span>';
        return `
          <li>
            <strong>${esc(nameMap[t.studentId] || '—')}</strong>
            <span class="tag">${esc(t.symbol)}</span>
            <span class="tag">${esc(t.side)}</span>
            <span class="muted">In: ${t.entryPrice}</span>
            ${t.exitPrice ? `<span class="muted">Out: ${t.exitPrice}</span>` : ''}
            ${pnlHtml}
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
        ? Number(document.getElementById('journal-exit').value) : null,
      lots: Number(document.getElementById('journal-lots').value) || 0.1,
      module: MODULE
    });
    journalForm.reset();
    document.getElementById('journal-lots').value = '0.1';
    await renderJournal();
    runSync();
  });
}



// ========== ATTENDANCE ==========
const attendanceForm = document.getElementById('attendance-form');
const attendanceList = document.getElementById('attendance-list');
const attStudent = document.getElementById('att-student');
async function populateAttStudents() {
  if (!attStudent) return;
  let list = [];
  try {
    if (MODULE === 'trading') {
      list = (await getAllLocal('tradingEnrollments')).filter(e => e.module === MODULE);
    } else {
      list = (await getAllLocal('academyEnrollments')).filter(e => e.module === MODULE);
    }
  } catch (_) {}
  list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  attStudent.innerHTML = '<option value="">Select student</option>' +
    list.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
}
async function renderAttendance() {
  if (!attendanceList) return;
  const list = (await getAllLocal('attendance')).filter(r => r.module === MODULE);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  attendanceList.innerHTML = list.length ? list.map(r => {
    const color = r.status === 'Present' ? '#1B7A4E' : r.status === 'Leave' ? '#B45309' : '#B91C1C';
    return `<li><strong>${esc(r.studentName)}</strong> <span class="muted">${esc(r.date)}</span>
      <span class="tag" style="background:${color};color:#fff">${esc(r.status)}</span>
      <span class="actions"><button class="mini-btn danger" data-del-att="${r.id}">Delete</button></span></li>`;
  }).join('') : '<li class="muted">No attendance yet.</li>';
  attendanceList.querySelectorAll('[data-del-att]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('attendance', btn.dataset.delAtt);
      await renderAttendance(); runSync();
    });
  });
}
if (attendanceForm) {
  const d = document.getElementById('att-date');
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
  attendanceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const opt = attStudent?.selectedOptions[0];
    if (!opt?.value) return;
    const date = document.getElementById('att-date').value;
    const status = document.getElementById('att-status').value;
    const all = (await getAllLocal('attendance')).filter(r => r.module === MODULE);
    const existing = all.find(r => r.studentId === opt.value && r.date === date);
    await saveLocal('attendance', {
      id: existing?.id,
      studentId: opt.value,
      studentName: opt.textContent,
      date, status, module: MODULE
    });
    await renderAttendance(); runSync();
  });
}

// ========== FINANCE ==========
const incomeForm = document.getElementById('income-form');
const expenseForm = document.getElementById('expense-form');
const incomeList = document.getElementById('income-list');
const expenseList = document.getElementById('expense-list');
function fmt(n) { return 'Rs ' + Number(n || 0).toLocaleString('en-PK'); }
async function renderIncome() {
  if (!incomeList) return;
  const list = (await getAllLocal('income')).filter(r => r.module === MODULE);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  incomeList.innerHTML = list.length ? list.map(r => `
    <li><strong>${esc(r.description)}</strong><span class="muted">${esc(r.date)}</span>
    <span class="amount">${fmt(r.amount)}</span>
    <span class="actions"><button class="mini-btn danger" data-del-inc="${r.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No income records.</li>';
  incomeList.querySelectorAll('[data-del-inc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('income', btn.dataset.delInc);
      await populateAttStudents();
  await renderAttendance();
  await renderIncome(); runSync();
    });
  });
}
async function renderExpenses() {
  if (!expenseList) return;
  const list = (await getAllLocal('expenses')).filter(r => r.module === MODULE);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  expenseList.innerHTML = list.length ? list.map(r => `
    <li><strong>${esc(r.description)}</strong><span class="muted">${esc(r.date)}</span>
    <span class="amount">${fmt(r.amount)}</span>
    <span class="actions"><button class="mini-btn danger" data-del-exp="${r.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No expenses.</li>';
  expenseList.querySelectorAll('[data-del-exp]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('expenses', btn.dataset.delExp);
      await renderExpenses(); runSync();
    });
  });
}
if (incomeForm) {
  const d = document.getElementById('income-date');
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
  incomeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('income', {
      date: document.getElementById('income-date').value,
      description: document.getElementById('income-desc').value.trim(),
      amount: Number(document.getElementById('income-amount').value),
      module: MODULE
    });
    incomeForm.reset();
    if (d) d.value = new Date().toISOString().slice(0, 10);
    await renderIncome(); runSync();
  });
}
if (expenseForm) {
  const d = document.getElementById('expense-date');
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('expenses', {
      date: document.getElementById('expense-date').value,
      description: document.getElementById('expense-desc').value.trim(),
      amount: Number(document.getElementById('expense-amount').value),
      module: MODULE
    });
    expenseForm.reset();
    if (d) d.value = new Date().toISOString().slice(0, 10);
    await renderExpenses(); runSync();
  });
}

(async function init() {
  await renderAdmissions();
  await renderBatches();
  await renderEnrollments();
  await renderChallans();
  await renderJournal();
  await renderIncome();
  await renderExpenses();
})();
