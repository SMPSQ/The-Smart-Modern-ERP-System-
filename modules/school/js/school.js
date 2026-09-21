// modules/school/js/school.js — students, complete admission, fee challans.
import { saveLocal, getAllLocal } from '../../../js/db.js';
import { drainQueue } from '../../../js/sync.js';

const studentForm = document.getElementById('student-form');
const studentList = document.getElementById('student-list');
const studentSelect = document.getElementById('challan-student');
const challanForm = document.getElementById('challan-form');
const challanList = document.getElementById('challan-list');
const monthFilter = document.getElementById('month-filter');
const statusFilter = document.getElementById('status-filter');

const admissionForm = document.getElementById('admission-form');
const admissionList = document.getElementById('admission-list');

const subjectForm = document.getElementById('subject-form');
const subjectList = document.getElementById('subject-list');

const feeStructureForm = document.getElementById('fee-structure-form');
const feeStructureList = document.getElementById('fee-structure-list');

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

async function renderStudents() {
  const students = await getAllLocal('students');
  students.sort((a, b) => a.name.localeCompare(b.name));

  studentList.innerHTML = students.map((s) => `
    <li>
      <strong>${esc(s.name)}</strong>
      <span class="tag">${esc(s.className || '—')}</span>
      <span class="muted">${esc(s.guardian || '')} ${esc(s.phone || '')}</span>
    </li>
  `).join('') || '<li class="muted">No students yet.</li>';

  if (studentSelect) {
    const prevSelected = studentSelect.value;
    studentSelect.innerHTML = students.map((s) =>
      `<option value="${s.id}">${esc(s.name)}${s.className ? ' — ' + esc(s.className) : ''}</option>`
    ).join('') || '<option value="">Add a student first</option>';
    if (prevSelected) studentSelect.value = prevSelected;
  }

  return students;
}

async function renderChallans() {
  let challans = await getAllLocal('feeChallans');
  const month = monthFilter?.value;
  const status = statusFilter?.value;
  if (month) challans = challans.filter((c) => c.month === month);
  if (status && status !== 'all') challans = challans.filter((c) => c.status === status);
  challans.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  challanList.innerHTML = challans.map((c) => `
    <li>
      <strong>${esc(c.studentName)}</strong>
      <span class="tag">${esc(c.month)}</span>
      <span class="amount">Rs ${esc(c.amount)}</span>
      <button type="button" class="status-btn status-btn--${(c.status || 'unpaid').toLowerCase()}" data-id="${c.id}">${esc(c.status)}</button>
    </li>
  `).join('') || '<li class="muted">No challans for this filter.</li>';
}

// ---------- Admissions (complete details) ----------
async function renderAdmissions() {
  const admissions = await getAllLocal('admissions');
  admissions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  admissionList.innerHTML = admissions.map((a) => `
    <li>
      <strong>${esc(a.name)}</strong>
      <span class="tag">${esc(a.className)}</span>
      <span class="muted">${esc(a.gender)} · DOB ${esc(a.dob)} · ${esc(a.fatherName)} · ${esc(a.phone)}</span>
      <div class="admission-detail">
        B-Form: ${esc(a.bform || '—')} · Father CNIC: ${esc(a.fatherCnic || '—')}<br>
        ${esc(a.address)}${a.city ? ', ' + esc(a.city) : ''} · Session: ${esc(a.session || '—')}
        ${a.medical ? '<br>Medical: ' + esc(a.medical) : ''}
      </div>
      <button type="button" class="status-btn status-btn--${a.status === 'Approved' ? 'paid' : 'unpaid'}" data-approve="${a.id}">
        ${a.status === 'Approved' ? 'Approved' : 'Approve'}
      </button>
    </li>
  `).join('') || '<li class="muted">No admission forms yet.</li>';
}

if (admissionForm) {
  admissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = val('adm-name');
    const className = val('adm-class');
    if (!name || !className) return;

    await saveLocal('admissions', {
      // Personal
      name,
      dob: val('adm-dob'),
      gender: val('adm-gender'),
      bform: val('adm-bform'),
      blood: val('adm-blood'),
      religion: val('adm-religion'),
      nationality: val('adm-nationality'),
      placeBirth: val('adm-place-birth'),
      // Class
      className,
      section: val('adm-section'),
      admissionDate: val('adm-date'),
      session: val('adm-session'),
      prevSchool: val('adm-prev-school'),
      prevClass: val('adm-prev-class'),
      // Father / Mother / Guardian
      fatherName: val('adm-father'),
      fatherCnic: val('adm-father-cnic'),
      fatherOcc: val('adm-father-occ'),
      fatherPhone: val('adm-father-phone'),
      motherName: val('adm-mother'),
      motherPhone: val('adm-mother-phone'),
      guardian: val('adm-guardian'),
      guardianRel: val('adm-guardian-rel'),
      // Contact
      address: val('adm-address'),
      city: val('adm-city'),
      phone: val('adm-phone'),
      email: val('adm-email'),
      emergency: val('adm-emergency'),
      emergencyPhone: val('adm-emergency-phone'),
      // Medical & other
      medical: val('adm-medical'),
      transport: val('adm-transport'),
      siblings: val('adm-siblings'),
      remarks: val('adm-remarks'),
      status: 'Pending'
    });
    admissionForm.reset();
    // restore nationality default
    const nat = document.getElementById('adm-nationality');
    if (nat) nat.value = 'Pakistani';
    await renderAdmissions();
    drainQueue();
  });
}

if (admissionList) {
  admissionList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-approve]');
    if (!btn) return;
    const id = btn.dataset.approve;
    const admissions = await getAllLocal('admissions');
    const rec = admissions.find((a) => a.id === id);
    if (!rec || rec.status === 'Approved') return;

    rec.status = 'Approved';
    await saveLocal('admissions', rec);
    // Enroll as student with key fields from admission
    await saveLocal('students', {
      name: rec.name,
      className: rec.className,
      guardian: rec.fatherName || rec.guardian,
      phone: rec.phone || rec.fatherPhone,
      dob: rec.dob,
      gender: rec.gender,
      bform: rec.bform,
      address: rec.address,
      city: rec.city
    });
    await renderAdmissions();
    await renderStudents();
    drainQueue();
  });
}

// ---------- Subjects ----------
async function renderSubjects() {
  const subjects = await getAllLocal('subjects');
  subjects.sort((a, b) => (a.className || '').localeCompare(b.className || '') || a.name.localeCompare(b.name));

  subjectList.innerHTML = subjects.map((s) => `
    <li>
      <strong>${esc(s.name)}</strong>
      <span class="tag">${esc(s.className)}</span>
    </li>
  `).join('') || '<li class="muted">No subjects yet.</li>';
}

if (subjectForm) {
  subjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = val('subject-name');
    const className = val('subject-class');
    if (!name || !className) return;
    await saveLocal('subjects', { name, className });
    subjectForm.reset();
    await renderSubjects();
    drainQueue();
  });
}

// ---------- Fee structure ----------
async function renderFeeStructure() {
  const structure = await getAllLocal('feeStructure');
  structure.sort((a, b) => (a.className || '').localeCompare(b.className || ''));

  feeStructureList.innerHTML = structure.map((f) => `
    <li>
      <strong>${esc(f.className)}</strong>
      <span class="amount">Rs ${esc(f.amount)}/month</span>
    </li>
  `).join('') || '<li class="muted">No fee structure set yet.</li>';

  return structure;
}

if (feeStructureForm) {
  feeStructureForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const className = val('fs-class');
    const amount = val('fs-amount');
    if (!className || !amount) return;
    const existing = (await getAllLocal('feeStructure')).find((f) => f.className === className);
    await saveLocal('feeStructure', { id: existing?.id, className, amount });
    feeStructureForm.reset();
    await renderFeeStructure();
    drainQueue();
  });
}

if (studentForm) {
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = val('student-name');
    if (!name) return;
    await saveLocal('students', {
      name,
      className: val('student-class'),
      guardian: val('student-guardian'),
      phone: val('student-phone')
    });
    studentForm.reset();
    await renderStudents();
    drainQueue();
  });
}

if (studentSelect) {
  studentSelect.addEventListener('change', async () => {
    const students = await getAllLocal('students');
    const student = students.find((s) => s.id === studentSelect.value);
    if (!student || !student.className) return;
    const structure = await getAllLocal('feeStructure');
    const match = structure.find((f) => f.className === student.className);
    const amountInput = document.getElementById('challan-amount');
    if (match && amountInput) amountInput.value = match.amount;
  });
}

if (challanForm) {
  challanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = studentSelect.value;
    const studentName = studentSelect.options[studentSelect.selectedIndex]?.textContent.split(' — ')[0] || '';
    const month = val('challan-month');
    const amount = val('challan-amount');
    if (!studentId || !month || !amount) return;

    await saveLocal('feeChallans', { studentId, studentName, month, amount, status: 'Unpaid' });
    challanForm.reset();
    await renderChallans();
    drainQueue();
  });
}

if (challanList) {
  challanList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.status-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const challans = await getAllLocal('feeChallans');
    const rec = challans.find((c) => c.id === id);
    if (!rec) return;
    rec.status = rec.status === 'Paid' ? 'Unpaid' : 'Paid';
    await saveLocal('feeChallans', rec);
    await renderChallans();
    drainQueue();
  });
}

if (monthFilter) monthFilter.addEventListener('change', renderChallans);
if (statusFilter) statusFilter.addEventListener('change', renderChallans);

(async () => {
  await renderAdmissions();
  await renderSubjects();
  await renderFeeStructure();
  await renderStudents();
  await renderChallans();
})();
