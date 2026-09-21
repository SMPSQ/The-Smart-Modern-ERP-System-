// modules/school/js/school.js — students + fee challans.
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
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
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

  const prevSelected = studentSelect.value;
  studentSelect.innerHTML = students.map((s) =>
    `<option value="${s.id}">${esc(s.name)}${s.className ? ' — ' + esc(s.className) : ''}</option>`
  ).join('');
  if (prevSelected) studentSelect.value = prevSelected;

  return students;
}

async function renderChallans() {
  let challans = await getAllLocal('feeChallans');
  const month = monthFilter.value;
  const status = statusFilter.value;
  if (month) challans = challans.filter((c) => c.month === month);
  if (status !== 'all') challans = challans.filter((c) => c.status === status);
  challans.sort((a, b) => b.updatedAt - a.updatedAt);

  challanList.innerHTML = challans.map((c) => `
    <li>
      <strong>${esc(c.studentName)}</strong>
      <span class="tag">${esc(c.month)}</span>
      <span class="amount">Rs ${esc(c.amount)}</span>
      <button type="button" class="status-btn status-btn--${c.status.toLowerCase()}" data-id="${c.id}">${esc(c.status)}</button>
    </li>
  `).join('') || '<li class="muted">No challans for this filter.</li>';
}

// ---------- Admissions (separate from enrolled students) ----------
async function renderAdmissions() {
  const admissions = await getAllLocal('admissions');
  admissions.sort((a, b) => b.updatedAt - a.updatedAt);

  admissionList.innerHTML = admissions.map((a) => `
    <li>
      <strong>${esc(a.name)}</strong>
      <span class="tag">${esc(a.className)}</span>
      <span class="muted">${esc(a.fatherName)} · ${esc(a.phone)}</span>
      <button type="button" class="status-btn status-btn--${a.status === 'Approved' ? 'paid' : 'unpaid'}" data-approve="${a.id}">
        ${a.status === 'Approved' ? 'Approved' : 'Approve'}
      </button>
    </li>
  `).join('') || '<li class="muted">No admission forms yet.</li>';
}

if (admissionForm) {
  admissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('adm-name').value.trim();
    const dob = document.getElementById('adm-dob').value;
    const gender = document.getElementById('adm-gender').value;
    const fatherName = document.getElementById('adm-father').value.trim();
    const cnic = document.getElementById('adm-cnic').value.trim();
    const address = document.getElementById('adm-address').value.trim();
    const phone = document.getElementById('adm-phone').value.trim();
    const prevSchool = document.getElementById('adm-prev-school').value.trim();
    const className = document.getElementById('adm-class').value.trim();
    const admissionDate = document.getElementById('adm-date').value;
    if (!name || !className) return;

    await saveLocal('admissions', {
      name, dob, gender, fatherName, cnic, address, phone,
      prevSchool, className, admissionDate, status: 'Pending'
    });
    admissionForm.reset();
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
    // Enroll as a student too — admission and enrollment stay separate records.
    await saveLocal('students', {
      name: rec.name, className: rec.className, guardian: rec.fatherName, phone: rec.phone
    });
    await renderAdmissions();
    await renderStudents();
    drainQueue();
  });
}

// ---------- Subjects (per class) ----------
async function renderSubjects() {
  const subjects = await getAllLocal('subjects');
  subjects.sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));

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
    const name = document.getElementById('subject-name').value.trim();
    const className = document.getElementById('subject-class').value.trim();
    if (!name || !className) return;

    await saveLocal('subjects', { name, className });
    subjectForm.reset();
    await renderSubjects();
    drainQueue();
  });
}

// ---------- Fee structure (monthly fee per class) ----------
async function renderFeeStructure() {
  const structure = await getAllLocal('feeStructure');
  structure.sort((a, b) => a.className.localeCompare(b.className));

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
    const className = document.getElementById('fs-class').value.trim();
    const amount = document.getElementById('fs-amount').value;
    if (!className || !amount) return;

    // One fee row per class — reuse existing record's id if this class already has one.
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
    const name = document.getElementById('student-name').value.trim();
    const className = document.getElementById('student-class').value.trim();
    const guardian = document.getElementById('student-guardian').value.trim();
    const phone = document.getElementById('student-phone').value.trim();
    if (!name) return;

    await saveLocal('students', { name, className, guardian, phone });
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
    const month = document.getElementById('challan-month').value;
    const amount = document.getElementById('challan-amount').value;
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
