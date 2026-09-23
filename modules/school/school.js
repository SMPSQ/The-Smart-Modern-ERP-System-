// modules/school/school.js — Full CRUD: Add / Edit / Delete for Admission, Student, Challan
import { saveLocal, getAllLocal, deleteLocal, getLocal } from '../../js/db.js';
import { runSync } from '../../js/sync.js';
import { printDocument, buildAdmissionPrint, buildChallanPrint, buildCertificatePrint } from '../../js/print.js';

const MODULE = 'school';
const INST_NAME = 'The Smart Modern Public School';

// Edit mode state
let editingAdmissionId = null;
let editingStudentId = null;
let editingChallanId = null;

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
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v == null ? '' : v;
}

// ========== ADMISSIONS ==========
const admissionForm = document.getElementById('admission-form');
const admissionList = document.getElementById('admission-list');

function clearAdmissionForm() {
  editingAdmissionId = null;
  if (admissionForm) admissionForm.reset();
  const dateInput = document.getElementById('adm-date');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  const submitBtn = admissionForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Submit Admission';
}

function fillAdmissionForm(a) {
  editingAdmissionId = a.id;
  setVal('adm-name', a.name);
  setVal('adm-dob', a.dob);
  setVal('adm-gender', a.gender);
  setVal('adm-bform', a.bform);
  setVal('adm-class', a.className);
  setVal('adm-section', a.section);
  setVal('adm-date', a.admissionDate);
  setVal('adm-session', a.session);
  setVal('adm-father', a.fatherName);
  setVal('adm-father-cnic', a.fatherCnic);
  setVal('adm-father-phone', a.fatherPhone);
  setVal('adm-father-occ', a.fatherOcc);
  setVal('adm-address', a.address);
  setVal('adm-city', a.city);
  setVal('adm-phone', a.phone);
  const submitBtn = admissionForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update Admission';
  // Switch to admission tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const tabBtn = document.querySelector('.tab-btn[data-tab="admission"]');
  const tabPanel = document.getElementById('tab-admission');
  if (tabBtn) tabBtn.classList.add('active');
  if (tabPanel) tabPanel.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function renderAdmissions() {
  if (!admissionList) return;
  const list = await getModuleRecords('admissions');
  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  admissionList.innerHTML = list.length
    ? list.map(a => `
      <li>
        <strong>${esc(a.name)}</strong>
        <span class="tag">${esc(a.className)}</span>
        <span class="muted">${esc(a.fatherName || '')}</span>
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
        name: adm.name,
        className: adm.className,
        section: adm.section || '',
        guardianName: adm.fatherName,
        guardianContact: adm.fatherPhone || adm.phone,
        phone: adm.phone,
        module: MODULE,
        admissionId: adm.id,
        dob: adm.dob,
        gender: adm.gender,
        address: adm.address,
        city: adm.city,
        session: adm.session
      });
      adm.status = 'approved';
      await saveLocal('admissions', adm);
      await renderAdmissions();
      await renderStudents();
      await populateStudentSelect();
      runSync();
    });
  });

  admissionList.querySelectorAll('[data-edit-adm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const adm = await getLocal('admissions', btn.dataset.editAdm);
      if (adm) fillAdmissionForm(adm);
    });
  });

  admissionList.querySelectorAll('[data-print-adm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const adm = await getLocal('admissions', btn.dataset.printAdm);
      if (!adm) return;
      printDocument('Student Admission Form', buildAdmissionPrint(adm, INST_NAME), { subtitle: INST_NAME });
    });
  });

  admissionList.querySelectorAll('[data-del-adm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this admission?')) return;
      await deleteLocal('admissions', btn.dataset.delAdm);
      if (editingAdmissionId === btn.dataset.delAdm) clearAdmissionForm();
      await renderAdmissions();
      runSync();
    });
  });
}

if (admissionForm) {
  const dateInput = document.getElementById('adm-date');
  if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);

  admissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      id: editingAdmissionId || undefined,
      name: val('adm-name'),
      dob: val('adm-dob'),
      gender: val('adm-gender'),
      bform: val('adm-bform'),
      className: val('adm-class'),
      section: val('adm-section'),
      admissionDate: val('adm-date'),
      session: val('adm-session'),
      fatherName: val('adm-father'),
      fatherCnic: val('adm-father-cnic'),
      fatherPhone: val('adm-father-phone'),
      fatherOcc: val('adm-father-occ'),
      address: val('adm-address'),
      city: val('adm-city'),
      phone: val('adm-phone'),
      status: editingAdmissionId
        ? ((await getLocal('admissions', editingAdmissionId))?.status || 'pending')
        : 'pending',
      module: MODULE
    };
    await saveLocal('admissions', data);
    clearAdmissionForm();
    await renderAdmissions();
    runSync();
  });

  admissionForm.addEventListener('reset', () => {
    setTimeout(clearAdmissionForm, 0);
  });
}

// ========== FEE STRUCTURE ==========
const fsForm = document.getElementById('fee-structure-form');
const fsList = document.getElementById('fee-structure-list');

async function renderFeeStructure() {
  if (!fsList) return;
  const list = await getModuleRecords('feeStructure');
  list.sort((a, b) => (a.className || '').localeCompare(b.className || ''));
  fsList.innerHTML = list.length
    ? list.map(f => `
      <li>
        <strong>${esc(f.className)}</strong>
        <span class="amount">${formatMoney(f.amount)}</span>
        <button class="mini-btn danger" data-del-fs="${f.id}" style="margin-left:auto">Delete</button>
      </li>
    `).join('')
    : '<li class="muted">No fee structure yet.</li>';
  fsList.querySelectorAll('[data-del-fs]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this fee structure?')) return;
      await deleteLocal('feeStructure', btn.dataset.delFs);
      await renderFeeStructure();
      runSync();
    });
  });
}

if (fsForm) {
  fsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const className = val('fs-class');
    const amount = Number(document.getElementById('fs-amount')?.value);
    if (!className || !amount) return;
    const all = await getModuleRecords('feeStructure');
    const existing = all.find(f => f.className.toLowerCase() === className.toLowerCase());
    await saveLocal('feeStructure', {
      id: existing?.id,
      className,
      amount,
      module: MODULE
    });
    fsForm.reset();
    await renderFeeStructure();
    runSync();
  });
}

// ========== STUDENTS ==========
const studentForm = document.getElementById('student-form');
const studentList = document.getElementById('student-list');
const studentSearch = document.getElementById('student-search');

function clearStudentForm() {
  editingStudentId = null;
  if (studentForm) studentForm.reset();
  const submitBtn = studentForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Add';
}

function fillStudentForm(s) {
  editingStudentId = s.id;
  setVal('student-name', s.name);
  setVal('student-class', s.className);
  setVal('student-guardian', s.guardianName);
  setVal('student-phone', s.phone || s.guardianContact);
  const submitBtn = studentForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const tabBtn = document.querySelector('.tab-btn[data-tab="students"]');
  const tabPanel = document.getElementById('tab-students');
  if (tabBtn) tabBtn.classList.add('active');
  if (tabPanel) tabPanel.classList.add('active');
}

async function renderStudents(filter = '') {
  if (!studentList) return;
  let students = await getModuleRecords('students');
  if (filter) {
    const q = filter.toLowerCase();
    students = students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.className || '').toLowerCase().includes(q)
    );
  }
  students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  studentList.innerHTML = students.length
    ? students.map(s => `
      <li>
        <strong>${esc(s.name)}</strong>
        <span class="tag">${esc(s.className)}</span>
        <span class="muted">${esc(s.guardianName || '')}</span>
        <span class="muted">${esc(s.phone || s.guardianContact || '')}</span>
        <span class="actions">
          <button class="mini-btn edit" data-edit-student="${s.id}">Edit</button>
          <button class="mini-btn ghost" data-cert="${s.id}">Certificate</button>
          <button class="mini-btn danger" data-del-student="${s.id}">Delete</button>
        </span>
      </li>
    `).join('')
    : '<li class="muted">No students yet.</li>';

  studentList.querySelectorAll('[data-edit-student]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = await getLocal('students', btn.dataset.editStudent);
      if (s) fillStudentForm(s);
    });
  });

  studentList.querySelectorAll('[data-cert]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = await getLocal('students', btn.dataset.cert);
      if (!s) return;
      printDocument('Certificate of Enrollment', buildCertificatePrint({
        studentName: s.name,
        type: 'Enrollment',
        course: s.className,
        className: s.className,
        body: `has been duly enrolled in <strong>Class ${s.className}</strong> at ${INST_NAME}.`
      }, INST_NAME), { subtitle: INST_NAME });
    });
  });

  studentList.querySelectorAll('[data-del-student]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this student?')) return;
      await deleteLocal('students', btn.dataset.delStudent);
      if (editingStudentId === btn.dataset.delStudent) clearStudentForm();
      await renderStudents(studentSearch?.value || '');
      await populateStudentSelect();
      await populateAttStudentSelect();
      runSync();
    });
  });
}

if (studentForm) {
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('students', {
      id: editingStudentId || undefined,
      name: val('student-name'),
      className: val('student-class'),
      guardianName: val('student-guardian'),
      phone: val('student-phone'),
      module: MODULE
    });
    clearStudentForm();
    await renderStudents();
    await populateStudentSelect();
    runSync();
  });
}
if (studentSearch) {
  studentSearch.addEventListener('input', () => renderStudents(studentSearch.value.trim()));
}

// ========== FEE CHALLANS ==========
const challanForm = document.getElementById('challan-form');
const challanList = document.getElementById('challan-list');
const challanStudent = document.getElementById('challan-student');
const challanAmount = document.getElementById('challan-amount');
const monthFilter = document.getElementById('month-filter');
const statusFilter = document.getElementById('status-filter');

function clearChallanForm() {
  editingChallanId = null;
  if (challanForm) {
    const month = document.getElementById('challan-month')?.value;
    challanForm.reset();
    const monthInput = document.getElementById('challan-month');
    if (monthInput) {
      const now = new Date();
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  const submitBtn = challanForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Create';
}

async function fillChallanForm(c) {
  editingChallanId = c.id;
  await populateStudentSelect();
  setVal('challan-student', c.studentId);
  setVal('challan-month', c.month);
  setVal('challan-amount', c.amount);
  const submitBtn = challanForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update Challan';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const tabBtn = document.querySelector('.tab-btn[data-tab="challans"]');
  const tabPanel = document.getElementById('tab-challans');
  if (tabBtn) tabBtn.classList.add('active');
  if (tabPanel) tabPanel.classList.add('active');
}

async function populateStudentSelect() {
  if (!challanStudent) return;
  const students = await getModuleRecords('students');
  students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const current = challanStudent.value;
  challanStudent.innerHTML = '<option value="">Select student</option>' +
    students.map(s => `<option value="${s.id}" data-class="${esc(s.className)}">${esc(s.name)} (${esc(s.className)})</option>`).join('');
  if (current) challanStudent.value = current;
}

if (challanStudent) {
  challanStudent.addEventListener('change', async () => {
    const opt = challanStudent.selectedOptions[0];
    if (!opt || !opt.value) return;
    const className = opt.dataset.class;
    const structures = await getModuleRecords('feeStructure');
    const match = structures.find(f => f.className.toLowerCase() === (className || '').toLowerCase());
    if (match && challanAmount && !editingChallanId) challanAmount.value = match.amount;
  });
}

async function renderChallans() {
  if (!challanList) return;
  let challans = await getModuleRecords('feeChallans');
  const mFilter = monthFilter?.value || '';
  const sFilter = statusFilter?.value || 'all';
  if (mFilter) challans = challans.filter(c => c.month === mFilter);
  if (sFilter !== 'all') {
    challans = challans.filter(c => (c.status || '').toLowerCase() === sFilter.toLowerCase());
  }
  challans.sort((a, b) => (b.month || '').localeCompare(a.month || '') || (a.studentName || '').localeCompare(b.studentName || ''));

  challanList.innerHTML = challans.length
    ? challans.map(c => {
        const isPaid = (c.status || '').toLowerCase() === 'paid';
        return `
          <li>
            <strong>${esc(c.studentName)}</strong>
            <span class="tag">${esc(c.className || '')}</span>
            <span class="muted">${monthLabel(c.month)}</span>
            <span class="amount">${formatMoney(c.amount)}</span>
            <button class="status-btn ${isPaid ? 'status-btn--paid' : 'status-btn--unpaid'}" data-toggle="${c.id}">
              ${isPaid ? 'Paid' : 'Unpaid'}
            </button>
            <span class="actions">
              <button class="mini-btn edit" data-edit-challan="${c.id}">Edit</button>
              <button class="mini-btn ghost" data-print-challan="${c.id}">Print</button>
              <button class="mini-btn danger" data-del-challan="${c.id}">Delete</button>
            </span>
          </li>
        `;
      }).join('')
    : '<li class="muted">No challans found.</li>';

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

  challanList.querySelectorAll('[data-edit-challan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const c = await getLocal('feeChallans', btn.dataset.editChallan);
      if (c) await fillChallanForm(c);
    });
  });

  challanList.querySelectorAll('[data-print-challan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const c = await getLocal('feeChallans', btn.dataset.printChallan);
      if (!c) return;
      c.monthLabel = monthLabel(c.month);
      printDocument('Fee Challan', buildChallanPrint(c, INST_NAME), { subtitle: INST_NAME });
    });
  });

  challanList.querySelectorAll('[data-del-challan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this challan?')) return;
      await deleteLocal('feeChallans', btn.dataset.delChallan);
      if (editingChallanId === btn.dataset.delChallan) clearChallanForm();
      await renderChallans();
      runSync();
    });
  });
}

if (challanForm) {
  const monthInput = document.getElementById('challan-month');
  if (monthInput && !monthInput.value) {
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  challanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const select = document.getElementById('challan-student');
    const opt = select?.selectedOptions[0];
    if (!opt || !opt.value) return;
    const month = val('challan-month');
    const amount = Number(document.getElementById('challan-amount')?.value);
    if (!month || !amount) return;

    let status = 'Unpaid';
    let paidOn = null;
    if (editingChallanId) {
      const old = await getLocal('feeChallans', editingChallanId);
      if (old) {
        status = old.status || 'Unpaid';
        paidOn = old.paidOn || null;
      }
    }

    await saveLocal('feeChallans', {
      id: editingChallanId || undefined,
      studentId: opt.value,
      studentName: opt.textContent.split(' (')[0],
      className: opt.dataset.class || '',
      month,
      amount,
      status,
      paidOn,
      module: MODULE
    });
    clearChallanForm();
    await populateStudentSelect();
    await renderChallans();
    runSync();
  });
}
if (monthFilter) monthFilter.addEventListener('change', renderChallans);
if (statusFilter) statusFilter.addEventListener('change', renderChallans);


// ========== ATTENDANCE ==========
const attendanceForm = document.getElementById('attendance-form');
const attendanceList = document.getElementById('attendance-list');
const attStudent = document.getElementById('att-student');
const attFilterDate = document.getElementById('att-filter-date');

async function populateAttStudentSelect() {
  if (!attStudent) return;
  const students = await getModuleRecords('students');
  students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const current = attStudent.value;
  attStudent.innerHTML = '<option value="">Select student</option>' +
    students.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.className)})</option>`).join('');
  if (current) attStudent.value = current;
}

async function renderAttendance() {
  if (!attendanceList) return;
  let records = await getModuleRecords('attendance');
  const fDate = attFilterDate?.value || '';
  if (fDate) records = records.filter(r => r.date === fDate);
  records.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.studentName || '').localeCompare(b.studentName || ''));

  attendanceList.innerHTML = records.length
    ? records.map(r => {
        const color = r.status === 'Present' ? '#1B7A4E' : r.status === 'Leave' ? '#B45309' : '#B91C1C';
        return `
          <li>
            <strong>${esc(r.studentName)}</strong>
            <span class="muted">${esc(r.date)}</span>
            <span class="tag" style="background:${color};color:#fff">${esc(r.status)}</span>
            <button class="mini-btn danger" data-del-att="${r.id}" style="margin-left:auto">Delete</button>
          </li>
        `;
      }).join('')
    : '<li class="muted">No attendance records.</li>';

  attendanceList.querySelectorAll('[data-del-att]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this attendance record?')) return;
      await deleteLocal('attendance', btn.dataset.delAtt);
      await renderAttendance();
      runSync();
    });
  });
}

if (attendanceForm) {
  const attDate = document.getElementById('att-date');
  if (attDate && !attDate.value) attDate.value = new Date().toISOString().slice(0, 10);

  attendanceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('att-student')?.value;
    const date = document.getElementById('att-date')?.value;
    const status = document.getElementById('att-status')?.value || 'Present';
    if (!studentId || !date) return;

    const opt = document.getElementById('att-student')?.selectedOptions[0];
    const studentName = opt ? opt.textContent.split(' (')[0] : '';

    // Upsert: one record per student per day
    const all = await getModuleRecords('attendance');
    const existing = all.find(r => r.studentId === studentId && r.date === date);

    await saveLocal('attendance', {
      id: existing?.id,
      studentId,
      studentName,
      date,
      status,
      module: MODULE
    });

    await renderAttendance();
    runSync();
  });
}
if (attFilterDate) attFilterDate.addEventListener('change', renderAttendance);

// ========== INIT ==========
(async function init() {
  await renderAdmissions();
  await renderFeeStructure();
  await renderStudents();
  await populateStudentSelect();
  await renderChallans();
  await populateAttStudentSelect();
  await renderAttendance();
})();
