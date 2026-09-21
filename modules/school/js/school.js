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
  await renderStudents();
  await renderChallans();
})();
