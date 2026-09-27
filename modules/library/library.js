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
      ${(b.barcode||b.isbn) ? `<span class="tag" style="font-family:monospace;">${esc(b.barcode||b.isbn)}</span>` : ''}
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
      const bcEl = document.getElementById('book-barcode');
      if (bcEl) bcEl.value = b.barcode || b.isbn || '';
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
      barcode: val('book-barcode') || undefined,
      isbn: val('book-barcode') || val('book-isbn') || undefined,
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



// ========== BARCODES ==========
function genBookBarcode() {
  const d = new Date();
  const stamp = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  return 'BK' + stamp + String(Math.floor(Math.random()*1e6)).padStart(6,'0');
}
function bookBcImg(code) {
  return 'https://bwipjs-api.metafloor.com/?bcid=code128&text=' + encodeURIComponent(code) + '&scale=2&height=12&includetext&guardwhitespace';
}
function bookLabelHtml(b, i) {
  const code = b.barcode || b.isbn || '';
  if (!code) return '';
  const n = i != null ? ' · #' + (i+1) : '';
  return `<div style="border:1px dashed #94A3B8;border-radius:10px;padding:0.6rem;text-align:center;background:#fff;page-break-inside:avoid;">
    <div style="font-weight:800;font-size:0.8rem;">${esc(b.title||b.name)}${n}</div>
    <img src="${bookBcImg(code)}" alt="" style="max-width:100%;height:48px;object-fit:contain;" />
    <div style="font-family:monospace;font-size:0.72rem;font-weight:700;">${esc(code)}</div>
  </div>`;
}

document.getElementById('btn-gen-book-bc')?.addEventListener('click', () => {
  const el = document.getElementById('book-barcode');
  if (el) el.value = genBookBarcode();
});

async function findBookByBarcode(code) {
  code = String(code||'').trim().toLowerCase();
  if (!code) return null;
  const books = await getBooks();
  return books.find(b =>
    String(b.barcode||'').toLowerCase() === code ||
    String(b.isbn||'').toLowerCase() === code
  );
}





async function renderLibBarcodeGrid() {
  const grid = document.getElementById('lib-barcode-grid');
  if (!grid) return;
  const list = await getBooks();
  grid.innerHTML = list.map(b => {
    const code = b.barcode || b.isbn || '';
    const units = Math.max(1, Number(b.qty||b.copies||1));
    if (!code) {
      return `<div style="border:1px solid #FECACA;border-radius:10px;padding:0.6rem;text-align:center;">
        <strong>${esc(b.title||b.name)}</strong>
        <div class="muted" style="font-size:0.75rem;">No barcode</div>
        <button type="button" class="mini-btn edit" data-gen-book="${b.id}">Generate</button>
      </div>`;
    }
    return `<div>${bookLabelHtml(b)}
      <div style="text-align:center;font-size:0.7rem;color:#64748B;">${units} copies</div>
      <div style="text-align:center;"><button type="button" class="mini-btn edit" data-print-book="${b.id}">Print ${units} labels</button></div>
    </div>`;
  }).join('') || '<p class="muted">No books</p>';

  grid.querySelectorAll('[data-gen-book]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const b = await getLocal('library', btn.dataset.genBook);
      if (!b) return;
      b.barcode = genBookBarcode();
      b.isbn = b.isbn || b.barcode;
      await saveLocal('library', b);
      await renderLibBarcodeGrid();
      await renderBooks();
      runSync();
    });
  });
  grid.querySelectorAll('[data-print-book]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const b = await getLocal('library', btn.dataset.printBook);
      if (!b) return;
      const def = Math.max(1, Number(b.qty || b.copies || 1));
      const raw = prompt((b.title || b.name) + '\n\nKitni copies / pcs? Utni labels print hongi.', String(def));
      if (raw === null) return;
      const units = Math.max(1, parseInt(raw, 10) || def);
      b.qty = units;
      b.copies = units;
      await saveLocal('library', b);
      let body = '';
      for (let i = 0; i < units; i++) body += bookLabelHtml(b, i);
      const w = window.open('', '_blank', 'width=700,height=500');
      if (!w) return;
      w.document.write('<!DOCTYPE html><html><head><title>' + units + ' labels</title><style>.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px;}@media print{body{padding:0}}</style></head><body><p>Total: ' + units + ' stickers (har copy pe 1)</p><div class="grid">' + body + '</div><script>setTimeout(function(){print();},600);</script></body></html>');
      w.document.close();
    });
  });
}

document.getElementById('btn-lib-gen-missing')?.addEventListener('click', async () => {
  const list = await getBooks();
  let n = 0;
  for (const b of list) {
    if (!b.barcode && !b.isbn) {
      b.barcode = genBookBarcode();
      b.isbn = b.barcode;
      await saveLocal('library', b);
      n++;
    }
  }
  alert(n ? n + ' barcodes generated' : 'All books have barcodes');
  await renderLibBarcodeGrid();
  await renderBooks();
  runSync();
});

document.getElementById('btn-lib-print-labels')?.addEventListener('click', async () => {
  const list = await getBooks();
  let body = '';
  let total = 0;
  for (const b of list) {
    if (!(b.barcode || b.isbn)) continue;
    const units = Math.max(1, Number(b.qty||b.copies||1));
    total += units;
    for (let i = 0; i < units; i++) body += bookLabelHtml(b, i);
  }
  if (!body) { alert('Pehle barcodes generate karein'); return; }
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write('<!DOCTYPE html><html><head><title>Book Labels '+total+'</title><style>.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px;}</style></head><body><p>Total: '+total+' labels</p><div class="grid">'+body+'</div><script>setTimeout(function(){print();},700);</script></body></html>');
  w.document.close();
});

// tab barcodes
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'barcodes') renderLibBarcodeGrid();
  });
});



// ========== AUTOMATIC BARCODE DESK (Issue / Return / Add) ==========
let scanMode = 'issue'; // issue | return | add

function setScanFeedback(msg, ok) {
  const fb = document.getElementById('auto-feedback');
  if (!fb) return;
  fb.style.color = ok ? '#059669' : '#B91C1C';
  fb.textContent = msg;
}

function beep(ok) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.08;
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.2));
  } catch (_) {}
}

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    scanMode = btn.dataset.mode || 'issue';
    const issueEx = document.getElementById('auto-issue-extra');
    const addEx = document.getElementById('auto-add-extra');
    if (issueEx) issueEx.style.display = scanMode === 'issue' ? 'block' : 'none';
    if (addEx) addEx.style.display = scanMode === 'add' ? 'block' : 'none';
    const scan = document.getElementById('auto-scan');
    if (scan) {
      scan.value = '';
      scan.focus();
      scan.placeholder =
        scanMode === 'issue'
          ? '📷 ISSUE — book barcode scan…'
          : scanMode === 'return'
            ? '📷 RETURN — book barcode scan…'
            : '📷 ADD — new book barcode scan…';
    }
    setScanFeedback('Mode: ' + scanMode.toUpperCase(), true);
  });
});

async function findBookByBarcode(code) {
  code = String(code || '').trim();
  if (!code) return null;
  const books = await getBooks();
  const c = code.toLowerCase();
  return (
    books.find(
      (b) =>
        String(b.barcode || '').toLowerCase() === c ||
        String(b.isbn || '').toLowerCase() === c ||
        String(b.id || '').toLowerCase() === c
    ) || null
  );
}

async function autoIssueByBarcode(code) {
  const book = await findBookByBarcode(code);
  if (!book) {
    setScanFeedback('Book not found: ' + code + ' — pehle ADD mode se book save karein', false);
    beep(false);
    return;
  }
  let student = (document.getElementById('auto-student')?.value || '').trim();
  if (!student) {
    student = prompt('Student name (issue ke liye):', '') || '';
  }
  if (!student) {
    setScanFeedback('Student name zaroori hai', false);
    beep(false);
    return;
  }
  const className = (document.getElementById('auto-class')?.value || '').trim();
  const title = book.title || book.name || '';
  // check already issued same book open?
  const open = (await getIssues()).filter(
    (i) =>
      (i.status || 'Issued') === 'Issued' &&
      (i.bookId === book.id || i.bookTitle === title)
  );
  if (open.length >= Number(book.qty || book.copies || 1)) {
    setScanFeedback('No copies available: ' + title, false);
    beep(false);
    return;
  }
  await saveLocal('libraryIssues', {
    bookId: book.id,
    bookTitle: title,
    studentName: student,
    className,
    issueDate: todayStr(),
    dueDate: '',
    status: 'Issued',
    method: 'barcode',
    module: MODULE,
    createdAt: Date.now()
  });
  setScanFeedback('✓ ISSUED: ' + title + ' → ' + student, true);
  beep(true);
  if (document.getElementById('auto-student')) document.getElementById('auto-student').value = student;
  await refresh();
  await fillIssueSelects();
  await renderIssued();
  runSync();
}

async function autoReturnByBarcode(code) {
  const book = await findBookByBarcode(code);
  if (!book) {
    setScanFeedback('Book not found: ' + code, false);
    beep(false);
    return;
  }
  const title = book.title || book.name || '';
  const issues = (await getIssues()).filter(
    (i) =>
      (i.status || 'Issued') === 'Issued' &&
      (i.bookId === book.id || (i.bookTitle || '') === title)
  );
  if (!issues.length) {
    setScanFeedback('Koi open issue nahi: ' + title, false);
    beep(false);
    return;
  }
  // return most recent
  issues.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const rec = issues[0];
  rec.status = 'Returned';
  rec.returnDate = todayStr();
  rec.method = 'barcode';
  rec.updatedAt = Date.now();
  await saveLocal('libraryIssues', rec);
  setScanFeedback('✓ RETURNED: ' + title + ' (was with ' + (rec.studentName || '') + ')', true);
  beep(true);
  await refresh();
  await fillIssueSelects();
  await renderIssued();
  runSync();
}

async function autoAddBookByBarcode(code) {
  const existing = await findBookByBarcode(code);
  if (existing) {
    setScanFeedback('Already exists: ' + (existing.title || existing.name) + ' · ' + code, false);
    beep(false);
    return;
  }
  let title = (document.getElementById('auto-title')?.value || '').trim();
  if (!title) {
    title = prompt('New book title:', code) || '';
  }
  if (!title) {
    setScanFeedback('Title zaroori hai', false);
    beep(false);
    return;
  }
  const author = (document.getElementById('auto-author')?.value || '').trim();
  await saveLocal('library', {
    title,
    name: title,
    author,
    barcode: code,
    isbn: code,
    qty: 1,
    copies: 1,
    type: 'book',
    module: MODULE,
    updatedAt: Date.now()
  });
  setScanFeedback('✓ BOOK ADDED: ' + title + ' · barcode ' + code, true);
  beep(true);
  if (document.getElementById('auto-title')) document.getElementById('auto-title').value = '';
  await refresh();
  await renderLibBarcodeGrid();
  runSync();
}

async function handleAutoScan(code) {
  code = String(code || '').trim();
  if (!code) return;
  if (scanMode === 'issue') await autoIssueByBarcode(code);
  else if (scanMode === 'return') await autoReturnByBarcode(code);
  else if (scanMode === 'add') await autoAddBookByBarcode(code);
}

function bindAutoScanInput() {
  const scan = document.getElementById('auto-scan');
  if (!scan || scan.dataset.bound === '1') return;
  scan.dataset.bound = '1';

  // Scanners send characters then Enter
  scan.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const code = scan.value.trim();
      scan.value = '';
      await handleAutoScan(code);
      scan.focus();
    }
  });

  // Some scanners fire change without Enter handling
  scan.addEventListener('change', async () => {
    const code = scan.value.trim();
    if (!code) return;
    scan.value = '';
    await handleAutoScan(code);
    scan.focus();
  });
}

bindAutoScanInput();

// Focus scan when Issue tab opens
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'issue') {
      setTimeout(() => {
        bindAutoScanInput();
        document.getElementById('auto-scan')?.focus();
      }, 100);
    }
  });
});

// Load student names for datalist
(async function loadStudentNames() {
  try {
    const students = await getAllLocal('students');
    const dl = document.getElementById('student-names');
    if (dl) {
      const names = [...new Set(students.map((s) => s.name).filter(Boolean))].sort();
      dl.innerHTML = names.map((n) => '<option value="' + esc(n) + '"></option>').join('');
    }
  } catch (_) {}
})();
