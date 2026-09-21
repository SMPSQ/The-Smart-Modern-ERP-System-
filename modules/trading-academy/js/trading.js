// modules/trading-academy/js/trading.js — batches + trader enrollments.
import { saveLocal, getAllLocal } from '../../../js/db.js';
import { drainQueue } from '../../../js/sync.js';

const batchForm = document.getElementById('batch-form');
const batchList = document.getElementById('batch-list');
const batchSelect = document.getElementById('enrollment-batch');
const batchFilter = document.getElementById('batch-filter');
const enrollmentForm = document.getElementById('enrollment-form');
const enrollmentList = document.getElementById('enrollment-list');

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function renderBatches() {
  const batches = await getAllLocal('batches');
  batches.sort((a, b) => a.name.localeCompare(b.name));

  batchList.innerHTML = batches.map((b) => `
    <li>
      <strong>${esc(b.name)}</strong>
      <span class="tag">${esc(b.gender)}</span>
      <span class="muted">${esc(b.timing || '')} ${b.instructor ? '· ' + esc(b.instructor) : ''}</span>
    </li>
  `).join('') || '<li class="muted">No batches yet.</li>';

  const options = batches.map((b) => `<option value="${b.id}">${esc(b.name)} (${esc(b.gender)})</option>`).join('');
  const prevSelect = batchSelect.value;
  batchSelect.innerHTML = options;
  if (prevSelect) batchSelect.value = prevSelect;

  const prevFilter = batchFilter.value;
  batchFilter.innerHTML = '<option value="">All batches</option>' + options;
  if (prevFilter) batchFilter.value = prevFilter;

  return batches;
}

async function renderEnrollments() {
  let enrollments = await getAllLocal('tradingEnrollments');
  const filterId = batchFilter.value;
  if (filterId) enrollments = enrollments.filter((e) => e.batchId === filterId);
  enrollments.sort((a, b) => b.updatedAt - a.updatedAt);

  enrollmentList.innerHTML = enrollments.map((e) => `
    <li>
      <strong>${esc(e.traderName)}</strong>
      <span class="tag">${esc(e.batchName)}</span>
      <span class="muted">${esc(e.phone || '')}</span>
    </li>
  `).join('') || '<li class="muted">No enrollments for this filter.</li>';
}

if (batchForm) {
  batchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('batch-name').value.trim();
    const gender = document.getElementById('batch-gender').value;
    const timing = document.getElementById('batch-timing').value.trim();
    const instructor = document.getElementById('batch-instructor').value.trim();
    if (!name) return;

    await saveLocal('batches', { name, gender, timing, instructor });
    batchForm.reset();
    await renderBatches();
    drainQueue();
  });
}

if (enrollmentForm) {
  enrollmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const batchId = batchSelect.value;
    const batchName = batchSelect.options[batchSelect.selectedIndex]?.textContent || '';
    const traderName = document.getElementById('trader-name').value.trim();
    const phone = document.getElementById('trader-phone').value.trim();
    if (!batchId || !traderName) return;

    await saveLocal('tradingEnrollments', { batchId, batchName, traderName, phone });
    document.getElementById('trader-name').value = '';
    document.getElementById('trader-phone').value = '';
    await renderEnrollments();
    drainQueue();
  });
}

if (batchFilter) batchFilter.addEventListener('change', renderEnrollments);

(async () => {
  await renderBatches();
  await renderEnrollments();
})();
