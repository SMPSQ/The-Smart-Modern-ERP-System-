// modules/educational-academy/academy.js — Separate data + Print support
import { saveLocal, getAllLocal, deleteLocal, getLocal } from '../../js/db.js';
import { runSync } from '../../js/sync.js';
import { printDocument, buildAdmissionPrint, buildChallanPrint, buildCertificatePrint, buildIdCardPrint } from '../../js/print.js';

const MODULE = 'academy';
const INST_NAME = 'Future Tech Educational Academy';

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
        name: adm.name, className: adm.course || 'Academy',
        phone: adm.phone, guardianName: adm.guardianName,
        module: MODULE, admissionId: adm.id
      });
      await saveLocal('academyEnrollments', {
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
      set('adm-guardian', adm.guardianName);
      set('adm-course', adm.course);
      set('adm-timing', adm.timing);
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
      printDocument('Educational Academy Admission Form', buildAdmissionPrint(adm, INST_NAME), { subtitle: INST_NAME });
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
      guardianName: document.getElementById('adm-guardian').value.trim(),
      course: document.getElementById('adm-course').value.trim(),
      className: document.getElementById('adm-course').value.trim(),
      timing: document.getElementById('adm-timing').value.trim(),
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

// ========== TUTORS ==========
const tutorForm = document.getElementById('tutor-form');
const tutorList = document.getElementById('tutor-list');
const classTutor = document.getElementById('class-tutor');

async function renderTutors() {
  const tutors = await getModuleRecords('tutors');
  tutors.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (tutorList) {
    tutorList.innerHTML = tutors.length
      ? tutors.map(t => `
        <li>
          <strong>${esc(t.name)}</strong>
          <span class="tag">${esc(t.subject || '—')}</span>
          <span class="muted">${esc(t.phone || '')}</span>
          <button class="mini-btn danger" data-del-tutor="${t.id}" style="margin-left:auto">Delete</button>
        </li>
      `).join('')
      : '<li class="muted">No tutors yet.</li>';
    tutorList.querySelectorAll('[data-del-tutor]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this tutor?')) return;
        await deleteLocal('tutors', btn.dataset.delTutor);
        await renderTutors();
        runSync();
      });
    });
  }
  if (classTutor) {
    const current = classTutor.value;
    classTutor.innerHTML = '<option value="">Select tutor (optional)</option>' +
      tutors.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    if (current) classTutor.value = current;
  }
}

if (tutorForm) {
  tutorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('tutors', {
      name: document.getElementById('tutor-name').value.trim(),
      subject: document.getElementById('tutor-subject').value.trim(),
      phone: document.getElementById('tutor-phone').value.trim(),
      module: MODULE
    });
    tutorForm.reset();
    await renderTutors();
    runSync();
  });
}

// ========== CLASSES ==========
const classForm = document.getElementById('class-form');
const classList = document.getElementById('class-list');
const enrollClass = document.getElementById('enroll-class');

async function renderClasses() {
  const classes = await getModuleRecords('classes');
  const tutors = await getModuleRecords('tutors');
  const tutorMap = Object.fromEntries(tutors.map(t => [t.id, t.name]));
  classes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (classList) {
    classList.innerHTML = classes.length
      ? classes.map(c => `
        <li>
          <strong>${esc(c.name)}</strong>
          <span class="tag">${esc(tutorMap[c.tutorId] || 'No tutor')}</span>
          <span class="muted">${esc(c.timing || '')}</span>
          ${c.fee ? `<span class="amount">${formatMoney(c.fee)}</span>` : ''}
          <button class="mini-btn danger" data-del-class="${c.id}" style="margin-left:auto">Delete</button>
        </li>
      `).join('')
      : '<li class="muted">No classes yet.</li>';
    classList.querySelectorAll('[data-del-class]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this class?')) return;
        await deleteLocal('classes', btn.dataset.delClass);
        await renderClasses();
        runSync();
      });
    });
  }
  if (enrollClass) {
    const current = enrollClass.value;
    enrollClass.innerHTML = '<option value="">Select class</option>' +
      classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    if (current) enrollClass.value = current;
  }
}

if (classForm) {
  classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('classes', {
      name: document.getElementById('class-name').value.trim(),
      tutorId: document.getElementById('class-tutor').value || null,
      timing: document.getElementById('class-timing').value.trim(),
      fee: Number(document.getElementById('class-fee').value) || 0,
      module: MODULE
    });
    classForm.reset();
    await renderClasses();
    runSync();
  });
}

// ========== ENROLLMENTS ==========
const enrollForm = document.getElementById('enroll-form');
const enrollList = document.getElementById('enroll-list');

async function renderEnrollments() {
  if (!enrollList) return;
  const enrolls = await getModuleRecords('academyEnrollments');
  const classes = await getModuleRecords('classes');
  const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));
  enrolls.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  enrollList.innerHTML = enrolls.length
    ? enrolls.map(e => `
      <li>
        <strong>${esc(e.name)}</strong>
        <span class="tag">${esc(classMap[e.classId] || e.course || '—')}</span>
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
      const e = await getLocal('academyEnrollments', btn.dataset.cert);
      if (!e) return;
      printDocument('Certificate of Completion', buildCertificatePrint({
        studentName: e.name,
        type: 'Completion',
        course: classMap[e.classId] || e.course || 'the program',
        body: `has successfully completed the course at ${INST_NAME}.`
      }, INST_NAME), { subtitle: INST_NAME });
    });
  });

  enrollList.querySelectorAll('[data-del-enroll]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this enrollment?')) return;
      await deleteLocal('academyEnrollments', btn.dataset.delEnroll);
      await renderEnrollments();
      await populateStudentSelects();
      runSync();
    });
  });
  await populateStudentSelects();
}

if (enrollForm) {
  enrollForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const classId = document.getElementById('enroll-class').value;
    const name = document.getElementById('enroll-name').value.trim();
    const phone = document.getElementById('enroll-phone').value.trim();
    if (!classId || !name) return;
    await saveLocal('academyEnrollments', { name, classId, phone, module: MODULE });
    await saveLocal('students', { name, className: 'Academy', phone, module: MODULE });
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
  const enrolls = await getModuleRecords('academyEnrollments');
  enrolls.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (challanStudent) {
    const current = challanStudent.value;
    challanStudent.innerHTML = '<option value="">Select student</option>' +
      enrolls.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    if (current) challanStudent.value = current;
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
      printDocument('Fee Challan — Educational Academy', buildChallanPrint(c, INST_NAME), { subtitle: INST_NAME });
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



// ========== EXAMS ==========
const examForm = document.getElementById('exam-form');
const examList = document.getElementById('exam-list');
const examStudent = document.getElementById('exam-student');
async function populateExamStudents() {
  if (!examStudent) return;
  const all = await getAllLocal('academyEnrollments');
  const list = all.filter(e => e.module === MODULE);
  examStudent.innerHTML = '<option value="">Select student</option>' +
    list.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
}
async function renderExams() {
  if (!examList) return;
  const list = (await getAllLocal('exams')).filter(r => r.module === MODULE);
  list.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  examList.innerHTML = list.length ? list.map(x => {
    const pct = x.total ? Math.round((Number(x.marks)/Number(x.total))*100) : 0;
    return `<li><strong>${esc(x.studentName)}</strong> <span class="tag">${esc(x.title)}</span>
      <span class="muted">${esc(x.subject)}</span> <span class="amount">${x.marks}/${x.total} (${pct}%)</span>
      <span class="actions"><button class="mini-btn danger" data-del-exam="${x.id}">Delete</button></span></li>`;
  }).join('') : '<li class="muted">No exams yet.</li>';
  examList.querySelectorAll('[data-del-exam]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('exams', btn.dataset.delExam);
      await renderExams(); runSync();
    });
  });
}
if (examForm) {
  examForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const opt = examStudent?.selectedOptions[0];
    if (!opt?.value) return;
    await saveLocal('exams', {
      title: document.getElementById('exam-title').value.trim(),
      studentId: opt.value,
      studentName: opt.textContent,
      subject: document.getElementById('exam-subject').value.trim(),
      marks: Number(document.getElementById('exam-marks').value),
      total: Number(document.getElementById('exam-total').value) || 100,
      date: new Date().toISOString().slice(0, 10),
      module: MODULE
    });
    examForm.reset();
    await populateExamStudents();
    await renderExams();
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


// ========== HOMEWORK ==========
const hwForm = document.getElementById('hw-form');
const hwList = document.getElementById('hw-list');
async function renderHomework() {
  if (!hwList) return;
  const list = (await getAllLocal('homework')).filter(r => r.module === MODULE);
  list.sort((a,b)=>(b.due||'').localeCompare(a.due||''));
  hwList.innerHTML = list.length ? list.map(h => `
    <li><strong>${esc(h.title)}</strong> <span class="tag">${esc(h.className)}</span>
    <span class="muted">${esc(h.subject)}</span> <span class="muted">Due: ${esc(h.due)}</span>
    <span class="actions"><button class="mini-btn danger" data-del-hw="${h.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No homework.</li>';
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
    hwForm.reset(); await renderHomework(); runSync();
  });
}

// ========== CERTIFICATES ==========
const certForm = document.getElementById('cert-form');
const certStudent = document.getElementById('cert-student');
async function populateCertStudents() {
  if (!certStudent) return;
  const list = (await getAllLocal('academyEnrollments')).filter(e => e.module === MODULE);
  certStudent.innerHTML = '<option value="">Select student</option>' +
    list.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
}
if (certForm) {
  certForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const opt = certStudent?.selectedOptions[0];
    if (!opt?.value) return;
    const type = document.getElementById('cert-type').value;
    printDocument(type + ' Certificate', buildCertificatePrint({
      studentName: opt.textContent, type, course: 'Academy Program',
      body: `has successfully met the requirements for <strong>${type}</strong> at <strong>${INST_NAME}</strong>.`
    }, INST_NAME), { subtitle: INST_NAME });
  });
}

// ========== REPORTS ==========
async function renderReports() {
  const grid = document.getElementById('reports-grid');
  if (!grid) return;
  const filt = async (s) => (await getAllLocal(s)).filter(r => r.module === MODULE).length;
  const items = [
    ['Enrollments', await filt('academyEnrollments')],
    ['Tutors', await filt('tutors')],
    ['Classes', await filt('classes')],
    ['Admissions', await filt('admissions')],
    ['Challans', await filt('feeChallans')],
    ['Attendance', await filt('attendance')],
    ['Exams', await filt('exams')],
    ['Homework', await filt('homework')],
  ];
  grid.innerHTML = items.map(([k,v]) => `
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:0.85rem;border-top:3px solid #0A1628;">
      <div style="font-size:0.68rem;color:#64748B;text-transform:uppercase;font-weight:700;">${k}</div>
      <div style="font-size:1.25rem;font-weight:800;color:#0A1628;">${v}</div>
    </div>`).join('');
}
document.getElementById('reports-refresh')?.addEventListener('click', renderReports);


// ========== COURSES ==========
const courseForm = document.getElementById('course-form');
const courseList = document.getElementById('course-list');
async function renderCourses() {
  if (!courseList) return;
  const list = (await getAllLocal('courses')).filter(r => r.module === MODULE);
  courseList.innerHTML = list.length ? list.map(c => `
    <li><strong>${esc(c.name)}</strong> <span class="muted">${esc(c.duration||'')}</span>
    <span class="amount">${c.fee!=null?'Rs '+Number(c.fee).toLocaleString():''}</span>
    <span class="muted">${esc(c.teacher||'')}</span>
    <span class="actions"><button class="mini-btn danger" data-del-c="${c.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No courses.</li>';
  courseList.querySelectorAll('[data-del-c]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('courses', btn.dataset.delC);
      await renderCourses(); runSync();
    });
  });
}
if (courseForm) {
  courseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('courses', {
      name: document.getElementById('course-name').value.trim(),
      duration: document.getElementById('course-duration').value.trim(),
      fee: Number(document.getElementById('course-fee').value)||null,
      teacher: document.getElementById('course-teacher').value.trim(),
      description: document.getElementById('course-desc').value.trim(),
      module: MODULE
    });
    courseForm.reset(); await renderCourses(); runSync();
  });
}

// ========== BATCHES ==========
const batchForm = document.getElementById('batch-form');
const batchList = document.getElementById('batch-list');
async function renderBatches() {
  if (!batchList) return;
  const list = (await getAllLocal('batches')).filter(r => r.module === MODULE);
  batchList.innerHTML = list.length ? list.map(b => `
    <li><strong>${esc(b.name)}</strong> <span class="tag">${esc(b.course)}</span>
    <span class="muted">${esc(b.timing||'')} ${esc(b.days||'')}</span>
    <span class="muted">${esc(b.teacher||'')}</span>
    <span class="actions"><button class="mini-btn danger" data-del-b="${b.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No batches.</li>';
  batchList.querySelectorAll('[data-del-b]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('batches', btn.dataset.delB);
      await renderBatches(); runSync();
    });
  });
}
if (batchForm) {
  batchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('batches', {
      name: document.getElementById('batch-name').value.trim(),
      course: document.getElementById('batch-course').value.trim(),
      teacher: document.getElementById('batch-teacher').value.trim(),
      timing: document.getElementById('batch-timing').value.trim(),
      days: document.getElementById('batch-days').value.trim(),
      maxStudents: Number(document.getElementById('batch-max').value)||null,
      module: MODULE
    });
    batchForm.reset(); await renderBatches(); runSync();
  });
}

// ========== STAFF ==========
const staffForm = document.getElementById('staff-form');
const staffList = document.getElementById('staff-list');
async function renderStaff() {
  if (!staffList) return;
  const list = (await getAllLocal('staff')).filter(r => r.module === MODULE);
  staffList.innerHTML = list.length ? list.map(s => `
    <li><strong>${esc(s.name)}</strong> <span class="tag">${esc(s.role||'')}</span>
    <span class="muted">${esc(s.phone||'')}</span>
    <span class="actions"><button class="mini-btn danger" data-del-s="${s.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No staff.</li>';
  staffList.querySelectorAll('[data-del-s]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('staff', btn.dataset.delS);
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
      salary: Number(document.getElementById('staff-salary').value)||null,
      module: MODULE
    });
    staffForm.reset(); await renderStaff(); runSync();
  });
}

// ========== TIMETABLE ==========
const ttForm = document.getElementById('tt-form');
const ttList = document.getElementById('tt-list');
async function renderTimetable() {
  if (!ttList) return;
  const list = (await getAllLocal('timetable')).filter(r => r.module === MODULE);
  ttList.innerHTML = list.length ? list.map(t => `
    <li><strong>${esc(t.className||t.batch)}</strong> <span class="tag">${esc(t.day)}</span>
    <span class="muted">${esc(t.period)}</span> <span>${esc(t.subject)}</span>
    <span class="muted">${esc(t.teacher||'')}</span>
    <span class="actions"><button class="mini-btn danger" data-del-tt="${t.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No slots.</li>';
  ttList.querySelectorAll('[data-del-tt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('timetable', btn.dataset.delTt);
      await renderTimetable(); runSync();
    });
  });
}
if (ttForm) {
  ttForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('timetable', {
      className: document.getElementById('tt-batch').value.trim(),
      batch: document.getElementById('tt-batch').value.trim(),
      day: document.getElementById('tt-day').value,
      period: document.getElementById('tt-period').value.trim(),
      subject: document.getElementById('tt-subject').value.trim(),
      teacher: document.getElementById('tt-teacher').value.trim(),
      module: MODULE
    });
    ttForm.reset(); await renderTimetable(); runSync();
  });
}

// ========== LIBRARY ==========
const libForm = document.getElementById('lib-form');
const libList = document.getElementById('lib-list');
async function renderLibrary() {
  if (!libList) return;
  const list = (await getAllLocal('library')).filter(r => r.module === MODULE && r.type !== 'issue');
  libList.innerHTML = list.length ? list.map(b => `
    <li><strong>${esc(b.title)}</strong> <span class="muted">${esc(b.author||'')}</span>
    <span class="tag">${esc(b.category||'')}</span>
    <span class="actions"><button class="mini-btn danger" data-del-l="${b.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No books.</li>';
  libList.querySelectorAll('[data-del-l]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('library', btn.dataset.delL);
      await renderLibrary(); runSync();
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
    libForm.reset(); await renderLibrary(); runSync();
  });
}

// ========== INVENTORY ==========
const invForm = document.getElementById('inv-form');
const invList = document.getElementById('inv-list');
async function renderInventory() {
  if (!invList) return;
  const list = (await getAllLocal('inventory')).filter(r => r.module === MODULE);
  invList.innerHTML = list.length ? list.map(i => `
    <li><strong>${esc(i.item)}</strong> <span class="tag">${esc(i.category)}</span>
    <span class="muted">${esc(i.moveType)} × ${i.qty}</span>
    <span class="actions"><button class="mini-btn danger" data-del-i="${i.id}">Delete</button></span></li>`).join('')
    : '<li class="muted">No inventory.</li>';
  invList.querySelectorAll('[data-del-i]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await deleteLocal('inventory', btn.dataset.delI);
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
    invForm.reset(); await renderInventory(); runSync();
  });
}

// ========== ID CARDS ==========
const idcardForm = document.getElementById('idcard-form');
const idcardStudent = document.getElementById('idcard-student');
async function populateIdStudents() {
  if (!idcardStudent) return;
  const list = (await getAllLocal('academyEnrollments')).filter(e => e.module === MODULE);
  idcardStudent.innerHTML = '<option value="">Select student</option>' +
    list.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
}
if (idcardForm) {
  idcardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = idcardStudent?.value;
    if (!id) return;
    const s = await getLocal('academyEnrollments', id);
    if (!s) return;
    s.admissionNo = s.admissionNo || ('EA-' + String(s.id).replace(/\W/g,'').slice(-8).toUpperCase());
    printDocument('Student ID Card', buildIdCardPrint(s, INST_NAME), { subtitle: INST_NAME, showDate: false });
  });
}

// ========== SETTINGS ==========
const settingsForm = document.getElementById('settings-form');
async function loadSettings() {
  const all = (await getAllLocal('settings')).filter(r => r.module === MODULE);
  const s = all[0]; if (!s) return;
  const set = (id,v) => { const el=document.getElementById(id); if(el&&v!=null) el.value=v; };
  set('set-name', s.schoolName); set('set-city', s.city); set('set-phone', s.phone);
  set('set-email', s.email); set('set-address', s.address); set('set-session', s.session);
}
if (settingsForm) {
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const all = (await getAllLocal('settings')).filter(r => r.module === MODULE);
    await saveLocal('settings', {
      id: all[0]?.id,
      schoolName: document.getElementById('set-name').value.trim(),
      city: document.getElementById('set-city').value.trim(),
      phone: document.getElementById('set-phone').value.trim(),
      email: document.getElementById('set-email').value.trim(),
      address: document.getElementById('set-address').value.trim(),
      session: document.getElementById('set-session').value.trim(),
      module: MODULE
    });
    const st = document.getElementById('settings-status');
    if (st) st.textContent = 'Saved.';
    runSync();
  });
}

// ========== BACKUP ==========
document.getElementById('backup-export')?.addEventListener('click', async () => {
  const stores = ['academyEnrollments','admissions','tutors','classes','feeChallans','attendance','exams','homework','courses','batches','staff','timetable','library','inventory','settings','income','expenses'];
  const data = { exportedAt: new Date().toISOString(), academy: INST_NAME, records: {} };
  for (const s of stores) {
    data.records[s] = (await getAllLocal(s)).filter(r => r.module === MODULE);
  }
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `future-tech-edu-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  const st = document.getElementById('backup-status');
  if (st) st.textContent = 'Backup downloaded.';
});
document.getElementById('backup-import')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const records = data.records || data;
    let n = 0;
    for (const [store, list] of Object.entries(records)) {
      if (!Array.isArray(list)) continue;
      for (const rec of list) { rec.module = MODULE; await saveLocal(store, rec); n++; }
    }
    const st = document.getElementById('backup-status');
    if (st) st.textContent = `Imported ${n} records. Refresh page.`;
    runSync();
  } catch (err) { alert('Import failed: ' + err.message); }
});

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
      await populateExamStudents();
  await renderExams();
  await populateAttStudents();
  await renderAttendance();
  await renderHomework();
  await populateCertStudents();
  await renderReports();
  await renderCourses();
  await renderBatches();
  await renderStaff();
  await renderTimetable();
  await renderLibrary();
  await renderInventory();
  await populateIdStudents();
  await loadSettings();
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
  await renderTutors();
  await renderClasses();
  await renderEnrollments();
  await renderChallans();
  await renderIncome();
  await renderExpenses();
})();
