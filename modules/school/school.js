// modules/school/school.js — School Module (Separate Data + Print)
import { saveLocal, getAllLocal, deleteLocal, getLocal } from '../../js/db.js';
import { runSync } from '../../js/sync.js';
import { printDocument, buildAdmissionPrint, buildChallanPrint, buildCertificatePrint } from '../../js/print.js';

const MODULE = 'school';
const INST_NAME = 'The Smart Modern Public School';

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

// Only this module's records
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
        <span class="tag">${esc(a.className)}</span>
        <span class="muted">${esc(a.fatherName || '')}</span>
        <span class="muted">${esc(a.phone || '')}</span>
        ${a.status === 'approved'
          ? '<span class="tag" style="background:#d1fae5;color:#065f46">Approved</span>'
          : `<button class="mini-btn" data-approve="${a.id}">Approve</button>`
        }
        <button class="mini-btn ghost" data-print-adm="${a.id}">🖨 Print</button>
        <button class="mini-btn danger" data-del-adm="${a.id}">Delete</button>
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

  admissionList.querySelectorAll('[data-print-adm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const adm = await getLocal('admissions', btn.dataset.printAdm);
      if (!adm) return;
      printDocument('Student Admission Form', buildAdmissionPrint(adm, INST_NAME), {
        subtitle: INST_NAME
      });
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
    const data = {
      name: document.getElementById('adm-name').value.trim(),
      dob: document.getElementById('adm-dob').value,
      gender: document.getElementById('adm-gender').value,
      bform: document.getElementById('adm-bform').value.trim(),
      className: document.getElementById('adm-class').value.trim(),
      section: document.getElementById('adm-section').value.trim(),
      admissionDate: document.getElementById('adm-date').value,
      session: document.getElementById('adm-session').value.trim(),
      fatherName: document.getElementById('adm-father').value.trim(),
      fatherCnic: document.getElementById('adm-father-cnic').value.trim(),
      fatherPhone: document.getElementById('adm-father-phone').value.trim(),
      fatherOcc: document.getElementById('adm-father-occ').value.trim(),
      address: document.getElementById('adm-address').value.trim(),
      city: document.getElementById('adm-city').value.trim(),
      phone: document.getElementById('adm-phone').value.trim(),
      status: 'pending',
      module: MODULE
    };
    await saveLocal('admissions', data);
    admissionForm.reset();
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    await renderAdmissions();
    runSync();
  });
}

// ========== FEE STRUCTURE (School only) ==========
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
    : '<li class="muted">No fee structure defined yet.</li>';

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
    const className = document.getElementById('fs-class').value.trim();
    const amount = Number(document.getElementById('fs-amount').value);
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

// ========== STUDENTS (School only) ==========
const studentForm = document.getElementById('student-form');
const studentList = document.getElementById('student-list');
const studentSearch = document.getElementById('student-search');

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
        <button class="mini-btn ghost" data-cert="${s.id}">🎓 Certificate</button>
        <button class="mini-btn danger" data-del-student="${s.id}">Remove</button>
      </li>
    `).join('')
    : '<li class="muted">No students enrolled yet.</li>';

  studentList.querySelectorAll('[data-cert]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = await getLocal('students', btn.dataset.cert);
      if (!s) return;
      printDocument('Certificate of Enrollment', buildCertificatePrint({
        studentName: s.name,
        type: 'Enrollment',
        course: s.className,
        className: s.className,
        body: `has been duly enrolled in <strong>Class ${s.className}</strong> at ${INST_NAME} for the academic session ${s.session || 'current'}.`
      }, INST_NAME), { subtitle: INST_NAME });
    });
  });

  studentList.querySelectorAll('[data-del-student]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this student?')) return;
      await deleteLocal('students', btn.dataset.delStudent);
      await renderStudents(studentSearch?.value || '');
      await populateStudentSelect();
      runSync();
    });
  });
}

if (studentForm) {
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('students', {
      name: document.getElementById('student-name').value.trim(),
      className: document.getElementById('student-class').value.trim(),
      guardianName: document.getElementById('student-guardian').value.trim(),
      phone: document.getElementById('student-phone').value.trim(),
      module: MODULE
    });
    studentForm.reset();
    await renderStudents();
    await populateStudentSelect();
    runSync();
  });
}
if (studentSearch) {
  studentSearch.addEventListener('input', () => renderStudents(studentSearch.value.trim()));
}

// ========== FEE CHALLANS (School only) ==========
const challanForm = document.getElementById('challan-form');
const challanList = document.getElementById('challan-list');
const challanStudent = document.getElementById('challan-student');
const challanAmount = document.getElementById('challan-amount');
const monthFilter = document.getElementById('month-filter');
const statusFilter = document.getElementById('status-filter');

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
    if (match && challanAmount) challanAmount.value = match.amount;
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
            <button class="mini-btn ghost" data-print-challan="${c.id}">🖨 Print</button>
            <button class="mini-btn danger" data-del-challan="${c.id}">×</button>
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
      studentName: opt.textContent.split(' (')[0],
      className: opt.dataset.class || '',
      month,
      amount,
      status: 'Unpaid',
      module: MODULE
    });
    challanForm.reset();
    if (monthInput) {
      const now = new Date();
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    await populateStudentSelect();
    await renderChallans();
    runSync();
  });
}
if (monthFilter) monthFilter.addEventListener('change', renderChallans);
if (statusFilter) statusFilter.addEventListener('change', renderChallans);

// ========== INIT ==========
(async function init() {
  await renderAdmissions();
  await renderFeeStructure();
  await renderStudents();
  await populateStudentSelect();
  await renderChallans();
})();
