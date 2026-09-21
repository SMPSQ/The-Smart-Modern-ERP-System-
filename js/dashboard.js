// js/dashboard.js — walk-in visitor log on the shared reception dashboard.
import { saveLocal, getAllLocal } from './db.js';
import { drainQueue } from './sync.js';

const form = document.getElementById('visitor-form');
const list = document.getElementById('visitor-list');

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const FOR_LABELS = {
  school: 'School',
  trading: 'Trading Academy',
  academy: 'Educational Academy',
  general: 'General inquiry'
};

async function render() {
  if (!list) return;
  const visitors = await getAllLocal('visitors');
  visitors.sort((a, b) => b.updatedAt - a.updatedAt);
  list.innerHTML = visitors.map((v) => `
    <li>
      <strong>${esc(v.name)}</strong>
      <span class="tag">${esc(FOR_LABELS[v.for] || v.for)}</span>
      ${v.reason ? `<span class="reason">${esc(v.reason)}</span>` : ''}
      <span class="visitor-time">${new Date(v.updatedAt).toLocaleString()}</span>
    </li>
  `).join('') || '<li class="muted">No visitors logged yet.</li>';
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('visitor-name').value.trim();
    const forWhom = document.getElementById('visitor-for').value;
    const reason = document.getElementById('visitor-reason').value.trim();
    if (!name) return;

    await saveLocal('visitors', { name, for: forWhom, reason });
    form.reset();
    await render();
    drainQueue();
  });
}

render();
