// modules/educational-academy/academy.js — Educational Academy Module (ERP v4)
import { saveLocal, getAllLocal, deleteLocal } from '../../js/db.js';
import { runSync } from '../../js/sync.js';

function esc(str = '') {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function formatMoney(n) {
  return 'Rs ' + Number(n || 0).toLocaleString('en-PK');
}

// ========== TUTORS ==========
const tutorForm = document.getElementById('tutor-form');
const tutorList = document.getElementById('tutor-list');
const classTutor = document.getElementById('class-tutor');

async function renderTutors() {
  const tutors = await getAllLocal('tutors');
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
        await populateTutorSelect();
        runSync();
      });
    });
  }

  await populateTutorSelect();
}

async function populateTutorSelect() {
  if (!classTutor) return;
  const tutors = await getAllLocal('tutors');
  const current = classTutor.value;
  classTutor.innerHTML = '<option value="">Select tutor (optional)</option>' +
    tutors.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  if (current) classTutor.value = current;
}

if (tutorForm) {
  tutorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('tutors', {
      name: document.getElementById('tutor-name').value.trim(),
      subject: document.getElementById('tutor-subject').value.trim(),
      phone: document.getElementById('tutor-phone').value.trim(),
      module: 'academy'
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
  const classes = await getAllLocal('classes');
  const tutors = await getAllLocal('tutors');
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
        await populateClassSelect();
        runSync();
      });
    });
  }

  await populateClassSelect();
}

async function populateClassSelect() {
  if (!enrollClass) return;
  const classes = await getAllLocal('classes');
  const current = enrollClass.value;
  enrollClass.innerHTML = '<option value="">Select class</option>' +
    classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if (current) enrollClass.value = current;
}

if (classForm) {
  classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLocal('classes', {
      name: document.getElementById('class-name').value.trim(),
      tutorId: document.getElementById('class-tutor').value || null,
      timing: document.getElementById('class-timing').value.trim(),
      fee: Number(document.getElementById('class-fee').value) || 0,
      module: 'academy'
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
  const enrolls = await getAllLocal('academyEnrollments');
  const classes = await getAllLocal('classes');
  const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));

  enrolls.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  enrollList.innerHTML = enrolls.length
    ? enrolls.map(e => `
      <li>
        <strong>${esc(e.name)}</strong>
        <span class="tag">${esc(classMap[e.classId] || '—')}</span>
        <span class="muted">${esc(e.phone || '')}</span>
        <button class="mini-btn danger" data-del-enroll="${e.id}" style="margin-left:auto">Remove</button>
      </li>
    `).join('')
    : '<li class="muted">No enrollments yet.</li>';

  enrollList.querySelectorAll('[data-del-enroll]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this enrollment?')) return;
      await deleteLocal('academyEnrollments', btn.dataset.delEnroll);
      await renderEnrollments();
      runSync();
    });
  });
}

if (enrollForm) {
  enrollForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const classId = document.getElementById('enroll-class').value;
    if (!classId) return;

    const name = document.getElementById('enroll-name').value.trim();
    const phone = document.getElementById('enroll-phone').value.trim();

    await saveLocal('academyEnrollments', {
      name,
      classId,
      phone,
      module: 'academy'
    });

    // Also add to global students
    await saveLocal('students', {
      name,
      className: 'Academy',
      phone,
      module: 'academy'
    });

    enrollForm.reset();
    await renderEnrollments();
    runSync();
  });
}

// Init
(async function init() {
  await renderTutors();
  await renderClasses();
  await renderEnrollments();
})();
