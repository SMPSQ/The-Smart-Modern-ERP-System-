// modules/educational-academy/js/academy.js — tutors, classes/timetable, enrollments.
import { saveLocal, getAllLocal } from '../../../js/db.js';
import { drainQueue } from '../../../js/sync.js';

const tutorForm = document.getElementById('tutor-form');
const tutorList = document.getElementById('tutor-list');
const classTutorSelect = document.getElementById('class-tutor');

const classForm = document.getElementById('class-form');
const classList = document.getElementById('class-list');
const enrollmentClassSelect = document.getElementById('enrollment-class');
const classFilter = document.getElementById('class-filter');

const enrollmentForm = document.getElementById('enrollment-form');
const enrollmentList = document.getElementById('enrollment-list');

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function renderTutors() {
  const tutors = await getAllLocal('tutors');
  tutors.sort((a, b) => a.name.localeCompare(b.name));

  tutorList.innerHTML = tutors.map((t) => `
    <li>
      <strong>${esc(t.name)}</strong>
      <span class="tag">${esc(t.subject || '—')}</span>
      <span class="muted">${esc(t.phone || '')}</span>
    </li>
  `).join('') || '<li class="muted">No tutors yet.</li>';

  const prev = classTutorSelect.value;
  classTutorSelect.innerHTML = tutors.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  if (prev) classTutorSelect.value = prev;

  return tutors;
}

async function renderClasses() {
  const classes = await getAllLocal('classes');
  classes.sort((a, b) => (a.timing || '').localeCompare(b.timing || ''));

  classList.innerHTML = classes.map((c) => `
    <li>
      <strong>${esc(c.subject)}</strong>
      <span class="tag">${esc(c.room || '—')}</span>
      <span class="muted">${esc(c.timing || '')} · ${esc(c.tutorName || '')}</span>
    </li>
  `).join('') || '<li class="muted">No classes yet.</li>';

  const options = classes.map((c) =>
    `<option value="${c.id}">${esc(c.subject)}${c.timing ? ' — ' + esc(c.timing) : ''}</option>`
  ).join('');

  const prevEnroll = enrollmentClassSelect.value;
  enrollmentClassSelect.innerHTML = options;
  if (prevEnroll) enrollmentClassSelect.value = prevEnroll;

  const prevFilter = classFilter.value;
  classFilter.innerHTML = '<option value="">All classes</option>' + options;
  if (prevFilter) classFilter.value = prevFilter;

  return classes;
}

async function renderEnrollments() {
  let enrollments = await getAllLocal('academyEnrollments');
  const filterId = classFilter.value;
  if (filterId) enrollments = enrollments.filter((e) => e.classId === filterId);
  enrollments.sort((a, b) => b.updatedAt - a.updatedAt);

  enrollmentList.innerHTML = enrollments.map((e) => `
    <li>
      <strong>${esc(e.studentName)}</strong>
      <span class="tag">${esc(e.className)}</span>
    </li>
  `).join('') || '<li class="muted">No enrollments for this filter.</li>';
}

if (tutorForm) {
  tutorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('tutor-name').value.trim();
    const subject = document.getElementById('tutor-subject').value.trim();
    const phone = document.getElementById('tutor-phone').value.trim();
    if (!name) return;

    await saveLocal('tutors', { name, subject, phone });
    tutorForm.reset();
    await renderTutors();
    drainQueue();
  });
}

if (classForm) {
  classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('class-subject').value.trim();
    const room = document.getElementById('class-room').value.trim();
    const timing = document.getElementById('class-timing').value.trim();
    const tutorId = classTutorSelect.value;
    const tutorName = classTutorSelect.options[classTutorSelect.selectedIndex]?.textContent || '';
    if (!subject || !tutorId) return;

    await saveLocal('classes', { subject, room, timing, tutorId, tutorName });
    classForm.reset();
    await renderClasses();
    drainQueue();
  });
}

if (enrollmentForm) {
  enrollmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const classId = enrollmentClassSelect.value;
    const className = enrollmentClassSelect.options[enrollmentClassSelect.selectedIndex]?.textContent || '';
    const studentName = document.getElementById('student-name').value.trim();
    if (!classId || !studentName) return;

    await saveLocal('academyEnrollments', { classId, className, studentName });
    document.getElementById('student-name').value = '';
    await renderEnrollments();
    drainQueue();
  });
}

if (classFilter) classFilter.addEventListener('change', renderEnrollments);

(async () => {
  await renderTutors();
  await renderClasses();
  await renderEnrollments();
})();
