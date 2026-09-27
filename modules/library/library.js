// modules/library/library.js — Standalone Library Module
import { saveLocal, getAllLocal, deleteLocal, getLocal } from '../../js/db.js';
import { runSync } from '../../js/sync.js';

const MODULE = 'library';

function esc(str = '') {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
    if (btn.dataset.tab === 'issue') fillIssueSelects();
    if (btn.dataset.tab === 'issued') renderIssued();
    if (btn.dataset.tab === 'history') renderHistory();
  });
});

async function getBooks() {
  const all = await getAllLocal('library');
  return all.filter((b) => !b.module || b.module === 'school' || b.module === MODULE || !b.type || b.type === 'book');
}
async function getIssues() {
  const all = await getAllLocal('libraryIssues');
  return all.filter((i) => !i.module || i.module === MODULE || i.module === 'school');
}

async function renderKpis() {
  const books = await getBooks();
  const issues = await getIssues();
  const copies = books.reduce((s, b) => s + Number(b.qty || b.copies || 1), 0);
  const issued = issues.filter((i) => (i.status || 'Issued') === 'Issued').length;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set('kpi-books', books.length);
  set('kpi-copies', copies);
  set('kpi-issued', issued);
  set('kpi-avail', Math.max(0, copies - issued));
}

// Books
const bookForm = document.getElementById('book-form');
const bookList = document.getElementById('book-list');

async function renderBooks() {
  if (!bookList) return;
  const q = (document.getElementById('book-search')?.value || '').toLowerCase();
  let list = await getBooks();
  if (q) {
    list = list.filter(
      (b) =>
        (b.title || b.name || '').toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q) ||
        (b.category || '').toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));
  bookList.innerHTML = list.length
    ? list
        .map(
          (b) => `<li>
      <strong>${esc(b.title || b.name)}</strong>
      <span class="muted">${esc(b.author || '')}</span>
      <span class="tag">${esc(b.category || b.cat || '—')}</span>
      <span class="tag">×${b.qty ?? b.copies ?? 1}</span>
      ${b.shelf ? `<span class="muted">${esc(b.shelf)}</span>` : ''}
      <span class="actions">
        <button type="button" class="mini-btn edit" data-edit="${b.id}">Edit</button>
        <button type="button" class="mini-btn danger" data-del="${b.id}">Delete</button>
      </span>
    </li>`
        )
        .join('')
    : '<li class="muted">No books yet.</li>';

  bookList.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete book?')) return;
      await deleteLocal('library', btn.dataset.del);
      await refresh();
      runSync();
    });
  });
  bookList.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const b = await getLocal('library', btn.dataset.edit);
      if (!b) return;
      document.getElementById('book-edit-id').value = b.id;
      document.getElementById('book-title').value = b.title || b.name || '';
      document.getElementById('book-author').value = b.author || '';
      document.getElementById('book-cat').value = b.category || b.cat || '';
      document.getElementById('book-isbn').value = b.isbn || '';
      document.getElementById('book-qty').value = b.qty ?? b.copies ?? 1;
      document.getElementById('book-shelf').value = b.shelf || '';
      bookForm.querySelector('button[type="submit"]').textContent = 'Update Book';
    });
  });
}

document.getElementById('book-search')?.addEventListener('input', () => renderBooks());

if (bookForm) {
  bookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = val('book-edit-id');
    const rec = {
      id: editId || undefined,
      title: val('book-title'),
      name: val('book-title'),
      author: val('book-author'),
      category: val('book-cat'),
      cat: val('book-cat'),
      isbn: val('book-isbn'),
      qty: Number(document.getElementById('book-qty')?.value || 1),
      copies: Number(document.getElementById('book-qty')?.value || 1),
      shelf: val('book-shelf'),
      type: 'book',
      module: MODULE,
      updatedAt: Date.now()
    };
    if (!rec.title) return;
    await saveLocal('library', rec);
    bookForm.reset();
    document.getElementById('book-edit-id').value = '';
    document.getElementById('book-qty').value = 1;
    bookForm.querySelector('button[type="submit"]').textContent = 'Save Book';
    await refresh();
    runSync();
  });
}

async function fillIssueSelects() {
  const books = await getBooks();
  const issues = await getIssues();
  const issuedCount = {};
  issues
    .filter((i) => (i.status || 'Issued') === 'Issued')
    .forEach((i) => {
      issuedCount[i.bookId || i.bookTitle] = (issuedCount[i.bookId || i.bookTitle] || 0) + 1;
    });

  const bookSel = document.getElementById('issue-book');
  if (bookSel) {
    bookSel.innerHTML =
      '<option value="">Select book *</option>' +
      books
        .map((b) => {
          const qty = Number(b.qty || b.copies || 1);
          const out = issuedCount[b.id] || issuedCount[b.title] || 0;
          const avail = qty - out;
          return `<option value="${b.id}" data-title="${esc(b.title || b.name)}" ${avail <= 0 ? 'disabled' : ''}>${esc(b.title || b.name)} (avail ${avail})</option>`;
        })
        .join('');
  }

  const retSel = document.getElementById('return-issue');
  if (retSel) {
    const open = issues.filter((i) => (i.status || 'Issued') === 'Issued');
    retSel.innerHTML =
      '<option value="">Select issued record *</option>' +
      open
        .map(
          (i) =>
            `<option value="${i.id}">${esc(i.bookTitle || '')} → ${esc(i.studentName || '')} (${esc(i.issueDate || '')})</option>`
        )
        .join('');
  }

  // student names from school students
  try {
    const students = await getAllLocal('students');
    const dl = document.getElementById('student-names');
    if (dl) {
      const names = [...new Set(students.map((s) => s.name).filter(Boolean))].sort();
      dl.innerHTML = names.map((n) => `<option value="${esc(n)}"></option>`).join('');
    }
  } catch (_) {}
}

const issueForm = document.getElementById('issue-form');
if (issueForm) {
  const d = document.getElementById('issue-date');
  if (d && !d.value) d.value = todayStr();
  issueForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bookId = val('issue-book');
    const book = bookId ? await getLocal('library', bookId) : null;
    const bookTitle = book?.title || book?.name || document.getElementById('issue-book')?.selectedOptions?.[0]?.dataset?.title || '';
    if (!bookTitle || !val('issue-student')) return;
    await saveLocal('libraryIssues', {
      bookId: bookId || null,
      bookTitle,
      studentName: val('issue-student'),
      className: val('issue-class'),
      issueDate: val('issue-date') || todayStr(),
      dueDate: val('issue-due'),
      note: val('issue-note'),
      status: 'Issued',
      module: MODULE,
      createdAt: Date.now()
    });
    issueForm.reset();
    if (d) d.value = todayStr();
    await refresh();
    await fillIssueSelects();
    runSync();
    alert('Book issued: ' + bookTitle);
  });
}

const returnForm = document.getElementById('return-form');
if (returnForm) {
  const rd = document.getElementById('return-date');
  if (rd && !rd.value) rd.value = todayStr();
  returnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = val('return-issue');
    if (!id) return;
    const rec = await getLocal('libraryIssues', id);
    if (!rec) return;
    rec.status = 'Returned';
    rec.returnDate = val('return-date') || todayStr();
    rec.updatedAt = Date.now();
    await saveLocal('libraryIssues', rec);
    returnForm.reset();
    if (rd) rd.value = todayStr();
    await refresh();
    await fillIssueSelects();
    runSync();
    alert('Book returned');
  });
}

async function renderIssued() {
  const el = document.getElementById('issued-list');
  if (!el) return;
  const list = (await getIssues()).filter((i) => (i.status || 'Issued') === 'Issued');
  list.sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
  el.innerHTML = list.length
    ? list
        .map(
          (i) => `<li>
      <strong>${esc(i.bookTitle)}</strong>
      <span class="tag">Issued</span>
      <span class="muted">${esc(i.studentName)} ${i.className ? '· ' + esc(i.className) : ''}</span>
      <span class="muted">${esc(i.issueDate)}${i.dueDate ? ' → due ' + esc(i.dueDate) : ''}</span>
    </li>`
        )
        .join('')
    : '<li class="muted">Koi book issued nahi.</li>';
}

async function renderHistory() {
  const el = document.getElementById('history-list');
  if (!el) return;
  const list = await getIssues();
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  el.innerHTML = list.length
    ? list
        .map(
          (i) => `<li>
      <strong>${esc(i.bookTitle)}</strong>
      <span class="tag">${esc(i.status || 'Issued')}</span>
      <span class="muted">${esc(i.studentName)}</span>
      <span class="muted">${esc(i.issueDate)}${i.returnDate ? ' → returned ' + esc(i.returnDate) : ''}</span>
      <span class="actions"><button type="button" class="mini-btn danger" data-del-iss="${i.id}">Delete</button></span>
    </li>`
        )
        .join('')
    : '<li class="muted">No history.</li>';
  el.querySelectorAll('[data-del-iss]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete record?')) return;
      await deleteLocal('libraryIssues', btn.dataset.delIss);
      await renderHistory();
      await refresh();
      runSync();
    });
  });
}

async function refresh() {
  await Promise.all([renderKpis(), renderBooks(), fillIssueSelects()]);
}

const idate = document.getElementById('issue-date');
if (idate && !idate.value) idate.value = todayStr();
const rdate = document.getElementById('return-date');
if (rdate && !rdate.value) rdate.value = todayStr();
refresh();
