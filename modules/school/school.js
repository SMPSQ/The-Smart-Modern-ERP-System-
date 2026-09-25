// modules/school/school.js — Full CRUD: Add / Edit / Delete for Admission, Student, Challan
import { saveLocal, getAllLocal, deleteLocal, getLocal } from '../../js/db.js';
import { runSync } from '../../js/sync.js';
import { printDocument, buildAdmissionPrint, buildChallanPrint, buildCertificatePrint, buildIdCardPrint } from '../../js/print.js';

const MODULE = 'school';
const INST_NAME = 'Future Tech Public School';

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
function calcGrade(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
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
  setVal('adm-roll', a.rollNo);
  setVal('adm-blood', a.bloodGroup);
  setVal('adm-prev-school', a.previousSchool);
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
      const admNo = 'FT-' + new Date().getFullYear().toString().slice(-2) + '-' + String(Date.now()).slice(-6);
      await saveLocal('students', {
        name: adm.name,
        className: adm.className,
        section: adm.section || '',
        rollNo: adm.rollNo || '',
        guardianName: adm.fatherName,
        guardianContact: adm.fatherPhone || adm.phone,
        phone: adm.phone,
        module: MODULE,
        admissionId: adm.id,
        admissionNo: admNo,
        dob: adm.dob,
        gender: adm.gender,
        address: adm.address,
        city: adm.city,
        session: adm.session,
        bloodGroup: adm.bloodGroup || '',
        previousSchool: adm.previousSchool || ''
      });
      adm.admissionNo = admNo;
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
      rollNo: val('adm-roll'),
      bloodGroup: val('adm-blood'),
      previousSchool: val('adm-prev-school'),
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
        <span class="muted">${esc(s.admissionNo || '')}</span>
        <span class="muted">${esc(s.guardianName || '')}</span>
        <span class="muted">${esc(s.phone || s.guardianContact || '')}</span>
        <span class="actions">
          <button class="mini-btn edit" data-edit-student="${s.id}">Edit</button>
          <button class="mini-btn ghost" data-idcard="${s.id}">ID Card</button>
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

  
  studentList.querySelectorAll('[data-idcard]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = await getLocal('students', btn.dataset.idcard);
      if (!s) return;
      printDocument('Student ID Card', buildIdCardPrint(s, INST_NAME), { subtitle: INST_NAME, showDate: false });
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
      await populateExamStudentSelect();
      await populateLeaveStudents();
      await populateCertStudents();
      await populatePromoteStudents();
      runSync();
    });
  });
}

if (studentForm) {
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const existing = editingStudentId ? await getLocal('students', editingStudentId) : null;
    await saveLocal('students', {
      id: editingStudentId || undefined,
      name: val('student-name'),
      className: val('student-class'),
      guardianName: val('student-guardian'),
      phone: val('student-phone'),
      admissionNo: existing?.admissionNo || ('FT-' + new Date().getFullYear().toString().slice(-2) + '-' + String(Date.now()).slice(-6)),
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
            <span class="tag">${esc(c.feeType || 'Monthly')}</span>
            <span class="amount">${formatMoney(c.amount)}</span>
            <button class="status-btn ${isPaid ? 'status-btn--paid' : ((c.status||'').toLowerCase()==='partial' ? 'status-btn--unpaid' : 'status-btn--unpaid')}" data-toggle="${c.id}">
              ${isPaid ? 'Paid' : ((c.status||'').toLowerCase()==='partial' ? 'Partial' : 'Unpaid')}
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
      const st = (rec.status || '').toLowerCase();
      if (st === 'paid') { rec.status = 'Unpaid'; rec.paidOn = null; }
      else if (st === 'partial') { rec.status = 'Paid'; rec.paidOn = Date.now(); }
      else { rec.status = 'Partial'; rec.paidOn = null; }
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

    const feeType = document.getElementById('challan-type')?.value || 'Monthly';
    const statusNew = document.getElementById('challan-status-new')?.value;
    if (!editingChallanId && statusNew) status = statusNew;
    await saveLocal('feeChallans', {
      id: editingChallanId || undefined,
      studentId: opt.value,
      studentName: opt.textContent.split(' (')[0],
      className: opt.dataset.class || '',
      month,
      amount,
      feeType,
      status,
      paidOn: status === 'Paid' ? (paidOn || Date.now()) : paidOn,
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


// ========== TEACHERS ==========
const teacherForm = document.getElementById('teacher-form');
const teacherList = document.getElementById('teacher-list');

async function renderTeachers() {
  if (!teacherList) return;
  const list = await getModuleRecords('teachers');
  list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  teacherList.innerHTML = list.length
    ? list.map(t => `
      <li>
        <strong>${esc(t.name)}</strong>
        <span class="tag">${esc(t.subject || '—')}</span>
        <span class="muted">${esc(t.phone || '')}</span>
        <span class="actions">
          <button class="mini-btn danger" data-del-teacher="${t.id}">Delete</button>
        </span>
      </li>`).join('')
    : '<li class="muted">No teachers yet.</li>';
  teacherList.querySelectorAll('[data-del-teacher]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this teacher?')) return;
      await deleteLocal('teachers', btn.dataset.delTeacher);
      await renderTeachers();
      runSync();
    });
  });
}
if (teacherForm) {
  teacherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('teachers', {
      name: val('teacher-name'),
      subject: val('teacher-subject'),
      phone: val('teacher-phone'),
      module: MODULE
    });
    teacherForm.reset();
    await renderTeachers();
    runSync();
  });
}

// ========== EXAMS ==========
const examForm = document.getElementById('exam-form');
const examList = document.getElementById('exam-list');
const examStudent = document.getElementById('exam-student');

async function populateExamStudentSelect() {
  if (!examStudent) return;
  const students = await getModuleRecords('students');
  students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  examStudent.innerHTML = '<option value="">Select student</option>' +
    students.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.className)})</option>`).join('');
}

async function renderExams() {
  if (!examList) return;
  const list = await getModuleRecords('exams');
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.studentName || '').localeCompare(b.studentName || ''));
  examList.innerHTML = list.length
    ? list.map(x => {
        const pct = x.total ? Math.round((Number(x.marks) / Number(x.total)) * 100) : 0;
        const grade = calcGrade(pct);
        return `
      <li>
        <strong>${esc(x.studentName)}</strong>
        <span class="tag">${esc(x.title)}</span>
        <span class="muted">${esc(x.subject)}</span>
        <span class="amount">${x.marks}/${x.total} (${pct}% · ${grade})</span>
        <span class="muted">${esc(x.date || '')}</span>
        <span class="actions">
          <button class="mini-btn ghost" data-result-card="${x.id}">Result Card</button>
          <button class="mini-btn danger" data-del-exam="${x.id}">Delete</button>
        </span>
      </li>`;
      }).join('')
    : '<li class="muted">No exam records yet.</li>';
  examList.querySelectorAll('[data-del-exam]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this exam record?')) return;
      await deleteLocal('exams', btn.dataset.delExam);
      await renderExams();
      runSync();
    });
  });
  examList.querySelectorAll('[data-result-card]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const x = await getLocal('exams', btn.dataset.resultCard);
      if (!x) return;
      const pct = x.total ? Math.round((Number(x.marks) / Number(x.total)) * 100) : 0;
      const grade = calcGrade(pct);
      const status = pct >= 50 ? 'PASS' : 'FAIL';
      printDocument('Result Card', `
        <div class="section-title">Result Card</div>
        <table class="info">
          <tr><td class="label">Student</td><td>${esc(x.studentName)}</td></tr>
          <tr><td class="label">Exam</td><td>${esc(x.title)}</td></tr>
          <tr><td class="label">Subject</td><td>${esc(x.subject)}</td></tr>
          <tr><td class="label">Marks</td><td>${x.marks} / ${x.total}</td></tr>
          <tr><td class="label">Percentage</td><td>${pct}%</td></tr>
          <tr><td class="label">Grade</td><td><strong>${grade}</strong></td></tr>
          <tr><td class="label">Status</td><td><strong>${status}</strong></td></tr>
          <tr><td class="label">Date</td><td>${esc(x.date || '—')}</td></tr>
        </table>`, { subtitle: INST_NAME });
    });
  });
}
if (examForm) {
  const ed = document.getElementById('exam-date');
  if (ed && !ed.value) ed.value = new Date().toISOString().slice(0, 10);
  examForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const opt = examStudent?.selectedOptions[0];
    if (!opt || !opt.value) return;
    await saveLocal('exams', {
      title: val('exam-title'),
      studentId: opt.value,
      studentName: opt.textContent.split(' (')[0],
      subject: val('exam-subject'),
      marks: Number(document.getElementById('exam-marks')?.value),
      total: Number(document.getElementById('exam-total')?.value) || 100,
      date: val('exam-date'),
      module: MODULE
    });
    examForm.reset();
    if (ed) ed.value = new Date().toISOString().slice(0, 10);
    await populateExamStudentSelect();
    await renderExams();
    runSync();
  });
}

// ========== FINANCE (Income / Expense) ==========
const incomeForm = document.getElementById('income-form');
const expenseForm = document.getElementById('expense-form');
const incomeList = document.getElementById('income-list');
const expenseList = document.getElementById('expense-list');

async function renderIncome() {
  if (!incomeList) return;
  const list = await getModuleRecords('income');
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  incomeList.innerHTML = list.length
    ? list.map(r => `
      <li>
        <strong>${esc(r.description)}</strong>
        <span class="muted">${esc(r.date)}</span>
        <span class="amount">${formatMoney(r.amount)}</span>
        <span class="actions"><button class="mini-btn danger" data-del-income="${r.id}">Delete</button></span>
      </li>`).join('')
    : '<li class="muted">No other income yet.</li>';
  incomeList.querySelectorAll('[data-del-income]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('income', btn.dataset.delIncome);
      await renderIncome();
      await renderFinanceSummary();
      runSync();
    });
  });
}
async function renderExpenses() {
  if (!expenseList) return;
  const list = await getModuleRecords('expenses');
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  expenseList.innerHTML = list.length
    ? list.map(r => `
      <li>
        <strong>${esc(r.description)}</strong>
        <span class="muted">${esc(r.date)}</span>
        <span class="amount">${formatMoney(r.amount)}</span>
        <span class="actions"><button class="mini-btn danger" data-del-expense="${r.id}">Delete</button></span>
      </li>`).join('')
    : '<li class="muted">No expenses yet.</li>';
  expenseList.querySelectorAll('[data-del-expense]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('expenses', btn.dataset.delExpense);
      await renderExpenses();
      await renderFinanceSummary();
      runSync();
    });
  });
}
async function renderFinanceSummary() {
  const challans = await getModuleRecords('feeChallans');
  const fees = challans.filter(c => (c.status || '').toLowerCase() === 'paid')
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const incomes = await getModuleRecords('income');
  const otherInc = incomes.reduce((s, r) => s + Number(r.amount || 0), 0);
  const expenses = await getModuleRecords('expenses');
  const exp = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
  const net = fees + otherInc - exp;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = formatMoney(v); };
  set('sum-fees', fees);
  set('sum-income', otherInc);
  set('sum-expense', exp);
  set('sum-net', net);
}
if (incomeForm) {
  const d = document.getElementById('income-date');
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
  incomeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('income', {
      date: val('income-date'),
      description: val('income-desc'),
      amount: Number(document.getElementById('income-amount')?.value),
      module: MODULE
    });
    incomeForm.reset();
    if (d) d.value = new Date().toISOString().slice(0, 10);
    await renderIncome();
    await renderFinanceSummary();
    runSync();
  });
}
if (expenseForm) {
  const d = document.getElementById('expense-date');
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('expenses', {
      date: val('expense-date'),
      description: val('expense-desc'),
      amount: Number(document.getElementById('expense-amount')?.value),
      module: MODULE
    });
    expenseForm.reset();
    if (d) d.value = new Date().toISOString().slice(0, 10);
    await renderExpenses();
    await renderFinanceSummary();
    runSync();
  });
}


// ========== LEAVE ==========
const leaveForm = document.getElementById('leave-form');
const leaveList = document.getElementById('leave-list');
const leaveStudent = document.getElementById('leave-student');

async function populateLeaveStudents() {
  if (!leaveStudent) return;
  const students = await getModuleRecords('students');
  students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  leaveStudent.innerHTML = '<option value="">Select student</option>' +
    students.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.className)})</option>`).join('');
}
async function renderLeaves() {
  if (!leaveList) return;
  const list = await getModuleRecords('leaves');
  list.sort((a, b) => (b.from || '').localeCompare(a.from || ''));
  leaveList.innerHTML = list.length ? list.map(l => `
    <li>
      <strong>${esc(l.studentName)}</strong>
      <span class="muted">${esc(l.from)} → ${esc(l.to)}</span>
      <span class="muted">${esc(l.reason)}</span>
      <span class="tag">${esc(l.status)}</span>
      <span class="actions">
        <button class="mini-btn edit" data-leave-status="${l.id}|Approved">Approve</button>
        <button class="mini-btn ghost" data-leave-status="${l.id}|Rejected">Reject</button>
        <button class="mini-btn danger" data-del-leave="${l.id}">Delete</button>
      </span>
    </li>`).join('') : '<li class="muted">No leave records.</li>';
  leaveList.querySelectorAll('[data-leave-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [id, status] = btn.dataset.leaveStatus.split('|');
      const rec = await getLocal('leaves', id);
      if (!rec) return;
      rec.status = status;
      await saveLocal('leaves', rec);
      await renderLeaves();
      runSync();
    });
  });
  leaveList.querySelectorAll('[data-del-leave]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete leave?')) return;
      await deleteLocal('leaves', btn.dataset.delLeave);
      await renderLeaves();
      runSync();
    });
  });
}
if (leaveForm) {
  leaveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const opt = leaveStudent?.selectedOptions[0];
    if (!opt?.value) return;
    await saveLocal('leaves', {
      studentId: opt.value,
      studentName: opt.textContent.split(' (')[0],
      from: document.getElementById('leave-from').value,
      to: document.getElementById('leave-to').value,
      reason: document.getElementById('leave-reason').value.trim(),
      status: document.getElementById('leave-status')?.value || 'Pending',
      module: MODULE
    });
    leaveForm.reset();
    await populateLeaveStudents();
    await renderLeaves();
    runSync();
  });
}

// ========== TIMETABLE ==========
const ttForm = document.getElementById('tt-form');
const ttList = document.getElementById('tt-list');
const ttFilter = document.getElementById('tt-filter');

async function renderTimetable(filter = '') {
  if (!ttList) return;
  let list = await getModuleRecords('timetable');
  if (filter) {
    const q = filter.toLowerCase();
    list = list.filter(t => (t.className || '').toLowerCase().includes(q));
  }
  const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  list.sort((a, b) => {
    const d = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    return d !== 0 ? d : (a.period || '').localeCompare(b.period || '');
  });
  ttList.innerHTML = list.length ? list.map(t => `
    <li>
      <strong>${esc(t.className)}</strong>
      <span class="tag">${esc(t.day)}</span>
      <span class="muted">${esc(t.period)}</span>
      <span>${esc(t.subject)}</span>
      <span class="muted">${esc(t.teacher || '')}</span>
      <span class="actions"><button class="mini-btn danger" data-del-tt="${t.id}">Delete</button></span>
    </li>`).join('') : '<li class="muted">No timetable slots.</li>';
  ttList.querySelectorAll('[data-del-tt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete slot?')) return;
      await deleteLocal('timetable', btn.dataset.delTt);
      await renderTimetable(ttFilter?.value || '');
      runSync();
    });
  });
}
if (ttForm) {
  ttForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('timetable', {
      className: document.getElementById('tt-class').value.trim(),
      day: document.getElementById('tt-day').value,
      period: document.getElementById('tt-period').value.trim(),
      subject: document.getElementById('tt-subject').value.trim(),
      teacher: document.getElementById('tt-teacher')?.value.trim() || '',
      module: MODULE
    });
    ttForm.reset();
    await renderTimetable(ttFilter?.value || '');
    runSync();
  });
}
if (ttFilter) ttFilter.addEventListener('input', () => renderTimetable(ttFilter.value.trim()));


// ========== CLASSES / SUBJECTS ==========
const classMgmtForm = document.getElementById('class-mgmt-form');
const classMgmtList = document.getElementById('class-mgmt-list');
const subjectForm = document.getElementById('subject-form');
const subjectList = document.getElementById('subject-list');

async function renderClassMgmt() {
  if (!classMgmtList) return;
  const list = await getModuleRecords('schoolClasses');
  list.sort((a,b) => (a.className||'').localeCompare(b.className||'') || (a.section||'').localeCompare(b.section||''));
  classMgmtList.innerHTML = list.length ? list.map(c => `
    <li><strong>${esc(c.className)}</strong> <span class="tag">${esc(c.section||'—')}</span>
    <span class="muted">${esc(c.teacher||'')}</span>
    <span class="muted">Cap: ${c.capacity||'—'}</span>
    <span class="actions"><button class="mini-btn danger" data-del-cm="${c.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No classes configured.</li>';
  classMgmtList.querySelectorAll('[data-del-cm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete class?')) return;
      await deleteLocal('schoolClasses', btn.dataset.delCm);
      await renderClassMgmt(); runSync();
    });
  });
}
if (classMgmtForm) {
  classMgmtForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('schoolClasses', {
      className: document.getElementById('cm-class').value,
      section: document.getElementById('cm-section').value.trim(),
      teacher: document.getElementById('cm-teacher').value.trim(),
      capacity: Number(document.getElementById('cm-capacity').value) || null,
      module: MODULE
    });
    classMgmtForm.reset();
    await renderClassMgmt(); runSync();
  });
}
async function renderSubjects() {
  if (!subjectList) return;
  const list = await getModuleRecords('subjects');
  subjectList.innerHTML = list.length ? list.map(s => `
    <li><strong>${esc(s.name)}</strong> <span class="muted">${esc(s.className||'All')}</span>
    <span class="actions"><button class="mini-btn danger" data-del-sub="${s.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No subjects yet.</li>';
  subjectList.querySelectorAll('[data-del-sub]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('subjects', btn.dataset.delSub);
      await renderSubjects(); runSync();
    });
  });
}
if (subjectForm) {
  subjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('subjects', {
      name: document.getElementById('sub-name').value.trim(),
      className: document.getElementById('sub-class').value.trim(),
      module: MODULE
    });
    subjectForm.reset();
    await renderSubjects(); runSync();
  });
}

// ========== HOMEWORK ==========
const hwForm = document.getElementById('hw-form');
const hwList = document.getElementById('hw-list');
async function renderHomework() {
  if (!hwList) return;
  const list = await getModuleRecords('homework');
  list.sort((a,b) => (b.due||'').localeCompare(a.due||''));
  hwList.innerHTML = list.length ? list.map(h => `
    <li><strong>${esc(h.title)}</strong> <span class="tag">${esc(h.className)}</span>
    <span class="muted">${esc(h.subject)}</span> <span class="muted">Due: ${esc(h.due)}</span>
    <span class="muted">${esc(h.note||'')}</span>
    <span class="actions"><button class="mini-btn danger" data-del-hw="${h.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No homework posted.</li>';
  hwList.querySelectorAll('[data-del-hw]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('homework', btn.dataset.delHw);
      await renderHomework(); runSync();
    });
  });
}
if (hwForm) {
  hwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('homework', {
      className: document.getElementById('hw-class').value.trim(),
      subject: document.getElementById('hw-subject').value.trim(),
      title: document.getElementById('hw-title').value.trim(),
      due: document.getElementById('hw-due').value,
      note: document.getElementById('hw-note').value.trim(),
      module: MODULE
    });
    hwForm.reset();
    await renderHomework(); runSync();
  });
}

// ========== CERTIFICATES (types) ==========
const certForm = document.getElementById('cert-form');
const certStudent = document.getElementById('cert-student');
async function populateCertStudents() {
  if (!certStudent) return;
  const students = await getModuleRecords('students');
  students.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  certStudent.innerHTML = '<option value="">Select student</option>' +
    students.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.className)})</option>`).join('');
}
if (certForm) {
  certForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const opt = certStudent?.selectedOptions[0];
    if (!opt?.value) return;
    const s = await getLocal('students', opt.value);
    if (!s) return;
    const type = document.getElementById('cert-type').value;
    const bodies = {
      Character: `is a student of good moral character at <strong>${INST_NAME}</strong>, Class ${s.className}.`,
      Bonafide: `is a bonafide student of <strong>${INST_NAME}</strong>, currently enrolled in Class ${s.className}.`,
      Leaving: `was a student of <strong>${INST_NAME}</strong> in Class ${s.className} and is leaving the school.`,
      Enrollment: `has been duly enrolled in Class ${s.className} at <strong>${INST_NAME}</strong>.`
    };
    printDocument(type + ' Certificate', buildCertificatePrint({
      studentName: s.name,
      type,
      course: s.className,
      className: s.className,
      body: bodies[type] || bodies.Enrollment
    }, INST_NAME), { subtitle: INST_NAME });
  });
}

// ========== STAFF ==========
const staffForm = document.getElementById('staff-form');
const staffList = document.getElementById('staff-list');
async function renderStaff() {
  if (!staffList) return;
  const list = await getModuleRecords('staff');
  staffList.innerHTML = list.length ? list.map(s => `
    <li><strong>${esc(s.name)}</strong> <span class="tag">${esc(s.role||'Staff')}</span>
    <span class="muted">${esc(s.phone||'')}</span>
    <span class="amount">${s.salary != null ? formatMoney(s.salary) : ''}</span>
    <span class="actions"><button class="mini-btn danger" data-del-staff="${s.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No staff records.</li>';
  staffList.querySelectorAll('[data-del-staff]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('staff', btn.dataset.delStaff);
      await renderStaff(); runSync();
    });
  });
}
if (staffForm) {
  staffForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('staff', {
      name: document.getElementById('staff-name').value.trim(),
      role: document.getElementById('staff-role').value.trim(),
      phone: document.getElementById('staff-phone').value.trim(),
      salary: Number(document.getElementById('staff-salary').value) || null,
      module: MODULE
    });
    staffForm.reset();
    await renderStaff(); runSync();
  });
}


// ========== PAYROLL ==========
const payrollForm = document.getElementById('payroll-form');
const payrollList = document.getElementById('payroll-list');
async function renderPayroll() {
  if (!payrollList) return;
  const list = await getModuleRecords('payroll');
  list.sort((a,b)=>(b.month||'').localeCompare(a.month||''));
  payrollList.innerHTML = list.length ? list.map(r => {
    const net = Number(r.basic||0)+Number(r.allowances||0)-Number(r.deductions||0);
    return `<li><strong>${esc(r.name)}</strong> <span class="tag">${esc(r.role||'')}</span>
      <span class="muted">${esc(r.month)}</span> <span class="amount">Net ${formatMoney(net)}</span>
      <span class="actions">
        <button class="mini-btn ghost" data-print-pay="${r.id}">Slip</button>
        <button class="mini-btn danger" data-del-pay="${r.id}">Delete</button>
      </span></li>`;
  }).join('') : '<li class="muted">No payroll entries.</li>';
  payrollList.querySelectorAll('[data-del-pay]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('payroll', btn.dataset.delPay);
      await renderPayroll(); runSync();
    });
  });
  payrollList.querySelectorAll('[data-print-pay]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await getLocal('payroll', btn.dataset.printPay);
      if (!r) return;
      const net = Number(r.basic||0)+Number(r.allowances||0)-Number(r.deductions||0);
      printDocument('Salary Slip', `
        <div class="section-title">Salary Slip — ${esc(r.month)}</div>
        <table class="info">
          <tr><td class="label">Employee</td><td>${esc(r.name)}</td></tr>
          <tr><td class="label">Role</td><td>${esc(r.role||'—')}</td></tr>
          <tr><td class="label">Basic</td><td>${formatMoney(r.basic)}</td></tr>
          <tr><td class="label">Allowances</td><td>${formatMoney(r.allowances)}</td></tr>
          <tr><td class="label">Deductions</td><td>${formatMoney(r.deductions)}</td></tr>
          <tr><td class="label"><strong>Net Pay</strong></td><td><strong>${formatMoney(net)}</strong></td></tr>
        </table>`, { subtitle: INST_NAME });
    });
  });
}
if (payrollForm) {
  const m = document.getElementById('pay-month');
  if (m && !m.value) { const n=new Date(); m.value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }
  payrollForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('payroll', {
      name: document.getElementById('pay-name').value.trim(),
      role: document.getElementById('pay-role').value.trim(),
      month: document.getElementById('pay-month').value,
      basic: Number(document.getElementById('pay-basic').value),
      allowances: Number(document.getElementById('pay-allow').value)||0,
      deductions: Number(document.getElementById('pay-deduct').value)||0,
      module: MODULE
    });
    payrollForm.reset();
    await renderPayroll(); runSync();
  });
}

// ========== LIBRARY ==========
const libForm = document.getElementById('lib-form');
const libList = document.getElementById('lib-list');
const libIssueForm = document.getElementById('lib-issue-form');
const libIssueList = document.getElementById('lib-issue-list');
async function renderLibrary() {
  if (!libList) return;
  const list = (await getModuleRecords('library')).filter(x => x.type !== 'issue');
  libList.innerHTML = list.length ? list.map(b => `
    <li><strong>${esc(b.title)}</strong> <span class="muted">${esc(b.author||'')}</span>
    <span class="tag">${esc(b.category||'')}</span> <span class="muted">Qty: ${b.qty||1}</span>
    <span class="actions"><button class="mini-btn danger" data-del-lib="${b.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No books.</li>';
  libList.querySelectorAll('[data-del-lib]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('library', btn.dataset.delLib);
      await renderLibrary(); runSync();
    });
  });
}
async function renderLibIssues() {
  if (!libIssueList) return;
  const list = (await getModuleRecords('library')).filter(x => x.type === 'issue');
  libIssueList.innerHTML = list.length ? list.map(b => `
    <li><strong>${esc(b.book)}</strong> → ${esc(b.student)} <span class="muted">${esc(b.date)}</span>
    <span class="tag">${esc(b.status)}</span>
    <span class="actions"><button class="mini-btn danger" data-del-li="${b.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No issues.</li>';
  libIssueList.querySelectorAll('[data-del-li]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('library', btn.dataset.delLi);
      await renderLibIssues(); runSync();
    });
  });
}
if (libForm) {
  libForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('library', {
      type: 'book',
      title: document.getElementById('lib-title').value.trim(),
      author: document.getElementById('lib-author').value.trim(),
      category: document.getElementById('lib-cat').value.trim(),
      qty: Number(document.getElementById('lib-qty').value)||1,
      module: MODULE
    });
    libForm.reset();
    await renderLibrary(); runSync();
  });
}
if (libIssueForm) {
  const d = document.getElementById('lib-issue-date');
  if (d && !d.value) d.value = new Date().toISOString().slice(0,10);
  libIssueForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('library', {
      type: 'issue',
      book: document.getElementById('lib-issue-book').value.trim(),
      student: document.getElementById('lib-issue-student').value.trim(),
      date: document.getElementById('lib-issue-date').value,
      status: document.getElementById('lib-issue-status').value,
      module: MODULE
    });
    libIssueForm.reset();
    if (d) d.value = new Date().toISOString().slice(0,10);
    await renderLibIssues(); runSync();
  });
}

// ========== TRANSPORT ==========
const transForm = document.getElementById('trans-form');
const transList = document.getElementById('trans-list');
async function renderTransport() {
  if (!transList) return;
  const list = await getModuleRecords('transport');
  transList.innerHTML = list.length ? list.map(t => `
    <li><strong>${esc(t.vehicle)}</strong> <span class="tag">${esc(t.route)}</span>
    <span class="muted">${esc(t.driver||'')} ${esc(t.phone||'')}</span>
    <span class="amount">${t.fee!=null?formatMoney(t.fee):''}</span>
    <span class="actions"><button class="mini-btn danger" data-del-tr="${t.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No transport routes.</li>';
  transList.querySelectorAll('[data-del-tr]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('transport', btn.dataset.delTr);
      await renderTransport(); runSync();
    });
  });
}
if (transForm) {
  transForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('transport', {
      vehicle: document.getElementById('trans-vehicle').value.trim(),
      route: document.getElementById('trans-route').value.trim(),
      driver: document.getElementById('trans-driver').value.trim(),
      phone: document.getElementById('trans-phone').value.trim(),
      fee: Number(document.getElementById('trans-fee').value)||null,
      module: MODULE
    });
    transForm.reset();
    await renderTransport(); runSync();
  });
}

// ========== INVENTORY ==========
const invForm = document.getElementById('inv-form');
const invList = document.getElementById('inv-list');
async function renderInventory() {
  if (!invList) return;
  const list = await getModuleRecords('inventory');
  invList.innerHTML = list.length ? list.map(i => `
    <li><strong>${esc(i.item)}</strong> <span class="tag">${esc(i.category)}</span>
    <span class="muted">${esc(i.moveType)} × ${i.qty}</span>
    <span class="actions"><button class="mini-btn danger" data-del-inv="${i.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No inventory records.</li>';
  invList.querySelectorAll('[data-del-inv]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('inventory', btn.dataset.delInv);
      await renderInventory(); runSync();
    });
  });
}
if (invForm) {
  invForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('inventory', {
      item: document.getElementById('inv-item').value.trim(),
      category: document.getElementById('inv-cat').value,
      qty: Number(document.getElementById('inv-qty').value),
      moveType: document.getElementById('inv-type').value,
      module: MODULE
    });
    invForm.reset();
    await renderInventory(); runSync();
  });
}

// ========== REPORTS ==========
async function renderReports() {
  const grid = document.getElementById('reports-grid');
  if (!grid) return;
  const count = async (store) => (await getModuleRecords(store)).length;
  const students = await getModuleRecords('students');
  const challans = await getModuleRecords('feeChallans');
  const paid = challans.filter(c => (c.status||'').toLowerCase()==='paid');
  const unpaid = challans.filter(c => (c.status||'').toLowerCase()!=='paid');
  const coll = paid.reduce((s,c)=>s+Number(c.amount||0),0);
  const pend = unpaid.reduce((s,c)=>s+Number(c.amount||0),0);
  const items = [
    ['Students', students.length],
    ['Admissions', await count('admissions')],
    ['Teachers', await count('teachers')],
    ['Staff', await count('staff')],
    ['Attendance rows', await count('attendance')],
    ['Exam records', await count('exams')],
    ['Homework', await count('homework')],
    ['Classes', await count('schoolClasses')],
    ['Paid collection', formatMoney(coll)],
    ['Pending fees', formatMoney(pend)],
    ['Library items', await count('library')],
    ['Transport routes', await count('transport')],
    ['Inventory rows', await count('inventory')],
    ['Payroll entries', await count('payroll')],
  ];
  grid.innerHTML = items.map(([k,v]) => `
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:0.85rem;border-top:3px solid #0A1628;">
      <div style="font-size:0.68rem;color:#64748B;text-transform:uppercase;font-weight:700;">${k}</div>
      <div style="font-size:1.25rem;font-weight:800;color:#0A1628;margin-top:0.25rem;">${v}</div>
    </div>`).join('');
}
document.getElementById('reports-refresh')?.addEventListener('click', renderReports);

// ========== SETTINGS ==========
const settingsForm = document.getElementById('settings-form');
async function loadSettings() {
  const all = await getModuleRecords('settings');
  const s = all[0];
  if (!s) return;
  const set = (id,v) => { const el=document.getElementById(id); if(el&&v!=null) el.value=v; };
  set('set-name', s.schoolName); set('set-city', s.city); set('set-phone', s.phone);
  set('set-email', s.email); set('set-address', s.address); set('set-session', s.session); set('set-web', s.website);
}
if (settingsForm) {
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const all = await getModuleRecords('settings');
    await saveLocal('settings', {
      id: all[0]?.id,
      schoolName: document.getElementById('set-name').value.trim(),
      city: document.getElementById('set-city').value.trim(),
      phone: document.getElementById('set-phone').value.trim(),
      email: document.getElementById('set-email').value.trim(),
      address: document.getElementById('set-address').value.trim(),
      session: document.getElementById('set-session').value.trim(),
      website: document.getElementById('set-web').value.trim(),
      module: MODULE
    });
    const st = document.getElementById('settings-status');
    if (st) st.textContent = 'Settings saved.';
    runSync();
  });
}

// ========== BACKUP ==========
document.getElementById('backup-export')?.addEventListener('click', async () => {
  const stores = ['students','admissions','feeStructure','feeChallans','attendance','teachers','exams','expenses','income','leaves','timetable','schoolClasses','subjects','homework','staff','library','transport','inventory','payroll','settings'];
  const data = { exportedAt: new Date().toISOString(), school: INST_NAME, records: {} };
  for (const s of stores) data.records[s] = await getModuleRecords(s);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `future-tech-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  const st = document.getElementById('backup-status');
  if (st) st.textContent = 'Backup downloaded.';
});
document.getElementById('backup-import')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const records = data.records || data;
    let n = 0;
    for (const [store, list] of Object.entries(records)) {
      if (!Array.isArray(list)) continue;
      for (const rec of list) {
        rec.module = MODULE;
        await saveLocal(store, rec);
        n++;
      }
    }
    const st = document.getElementById('backup-status');
    if (st) st.textContent = `Imported ${n} records. Refresh page.`;
    runSync();
  } catch (err) {
    alert('Import failed: ' + (err.message || err));
  }
});


// ========== PROMOTION ==========
const promoteForm = document.getElementById('promote-form');
const promoteStudent = document.getElementById('promote-student');
async function populatePromoteStudents() {
  if (!promoteStudent) return;
  const students = await getModuleRecords('students');
  students.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  promoteStudent.innerHTML = '<option value="">Select student</option>' +
    students.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.className)})</option>`).join('');
}
if (promoteForm) {
  promoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = promoteStudent?.value;
    const toClass = document.getElementById('promote-to')?.value.trim();
    if (!id || !toClass) return;
    const s = await getLocal('students', id);
    if (!s || s.module !== MODULE) return;
    const from = s.className;
    s.className = toClass;
    s.promotedFrom = from;
    s.promotedAt = Date.now();
    await saveLocal('students', s);
    promoteForm.reset();
    await populatePromoteStudents();
    await renderStudents();
    await populateStudentSelect();
    await populateCertStudents();
    runSync();
    alert(`Promoted from ${from} → ${toClass}`);
  });
}

// ========== TEACHER ATTENDANCE ==========
const tattForm = document.getElementById('tatt-form');
const tattList = document.getElementById('tatt-list');
async function renderTeacherAttendance() {
  if (!tattList) return;
  const list = (await getModuleRecords('attendance')).filter(r => r.personType === 'staff');
  list.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  tattList.innerHTML = list.length ? list.map(r => {
    const color = r.status === 'Present' ? '#1B7A4E' : r.status === 'Leave' ? '#B45309' : '#B91C1C';
    return `<li><strong>${esc(r.studentName)}</strong> <span class="muted">${esc(r.date)}</span>
      <span class="tag" style="background:${color};color:#fff">${esc(r.status)}</span>
      <span class="actions"><button class="mini-btn danger" data-del-tatt="${r.id}">Delete</button></span></li>`;
  }).join('') : '<li class="muted">No teacher/staff attendance.</li>';
  tattList.querySelectorAll('[data-del-tatt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('attendance', btn.dataset.delTatt);
      await renderTeacherAttendance(); runSync();
    });
  });
}
if (tattForm) {
  const d = document.getElementById('tatt-date');
  if (d && !d.value) d.value = new Date().toISOString().slice(0,10);
  tattForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('attendance', {
      personType: 'staff',
      studentName: document.getElementById('tatt-name').value.trim(),
      studentId: 'staff_' + Date.now(),
      date: document.getElementById('tatt-date').value,
      status: document.getElementById('tatt-status').value,
      module: MODULE
    });
    tattForm.reset();
    if (d) d.value = new Date().toISOString().slice(0,10);
    await renderTeacherAttendance(); runSync();
  });
}

// ========== ACTIVITY LOG VIEW ==========
async function renderActivityLog() {
  const el = document.getElementById('activity-list');
  if (!el) return;
  try {
    const { getActivityLogs } = await import('../../js/db.js');
    const logs = await getActivityLogs(30);
    el.innerHTML = logs.length ? logs.map(l => `
      <li><strong>${esc(l.action || l.type || 'edit')}</strong>
      <span class="tag">${esc(l.storeName || '')}</span>
      <span class="muted">${esc(l.summary || l.recordId || '')}</span>
      <span class="muted">${l.createdAt ? new Date(l.createdAt).toLocaleString() : ''}</span></li>`).join('')
      : '<li class="muted">No activity yet.</li>';
  } catch {
    el.innerHTML = '<li class="muted">Activity log unavailable.</li>';
  }
}

// ========== INIT ==========
(async function init() {
  await renderAdmissions();
  await renderFeeStructure();
  await renderStudents();
  await populateStudentSelect();
  await renderChallans();
  await populateAttStudentSelect();
  await renderAttendance();
  await renderTeachers();
  await populateExamStudentSelect();
  await renderExams();
  await renderIncome();
  await renderExpenses();
  await renderFinanceSummary();
  await populateLeaveStudents();
  await renderLeaves();
  await renderTimetable();
  await renderClassMgmt();
  await renderSubjects();
  await renderHomework();
  await populateCertStudents();
  await renderStaff();
  await renderPayroll();
  await renderLibrary();
  await renderLibIssues();
  await renderTransport();
  await renderInventory();
  await renderReports();
  await loadSettings();
  await populatePromoteStudents();
  await renderTeacherAttendance();
  await renderActivityLog();
})();
