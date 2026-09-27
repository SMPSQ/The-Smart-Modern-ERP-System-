// modules/shop/shop.js — Full Shop: Inventory · Purchase · Sale · P&L
import { saveLocal, getAllLocal, deleteLocal, getLocal } from '../../js/db.js';
import { runSync } from '../../js/sync.js';
import { getStaffSession, isShopOnlyRole } from '../../js/staff-auth.js';

const MODULE = 'shop';
let cart = [];
let editingProductId = null;

function esc(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function money(n) { return 'Rs ' + Number(n || 0).toLocaleString('en-PK'); }
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function num(id) { return Number(document.getElementById(id)?.value || 0); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthPrefix() { return new Date().toISOString().slice(0, 7); }

(function () {
  const staff = getStaffSession();
  if (staff && isShopOnlyRole(staff.role)) {
    const back = document.getElementById('back-dash');
    if (back) back.style.display = 'none';
  }
})();

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
    if (btn.dataset.tab === 'inventory') renderInventory();
    if (btn.dataset.tab === 'reports') runPLReport();
    if (btn.dataset.tab === 'purchase') fillPurchaseProductSelect();
    if (btn.dataset.tab === 'barcodes') renderBarcodeGrid();
  });
});

async function getProducts() {
  const all = await getAllLocal('shopProducts');
  return all.filter(p => !p.module || p.module === MODULE);
}
async function getSales() {
  const all = await getAllLocal('shopSales');
  return all.filter(s => !s.module || s.module === MODULE);
}
async function getPurchases() {
  const all = await getAllLocal('shopPurchases');
  return all.filter(p => !p.module || p.module === MODULE);
}

async function renderKpis() {
  const products = await getProducts();
  const sales = await getSales();
  const today = todayStr();
  const month = monthPrefix();
  const todaySum = sales.filter(s => (s.date || '').startsWith(today)).reduce((a, s) => a + Number(s.total || 0), 0);
  const monthSales = sales.filter(s => (s.date || '').startsWith(month));
  const monthSum = monthSales.reduce((a, s) => a + Number(s.total || 0), 0);
  const monthProfit = monthSales.reduce((a, s) => a + Number(s.profit || 0), 0);
  const stockVal = products.reduce((a, p) => a + Number(p.stock || 0) * Number(p.cost || 0), 0);
  const low = products.filter(p => Number(p.stock || 0) <= Number(p.lowStock ?? 5)).length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kpi-today', money(todaySum));
  set('kpi-month', money(monthSum));
  set('kpi-profit', money(monthProfit));
  set('kpi-stock-val', money(stockVal));
  set('kpi-products', products.length);
  set('kpi-low', low);
}


// ========== BARCODE HELPERS ==========
function generateBarcodeCode() {
  // CODE128-friendly: FT + yymmdd + 6 digits
  const d = new Date();
  const stamp = String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  return 'FT' + stamp + rnd;
}

function barcodeImgUrl(code, h = 60) {
  const text = encodeURIComponent(String(code || ''));
  // Free public barcode API (Code 128)
  return 'https://bwipjs-api.metafloor.com/?bcid=code128&text=' + text + '&scale=2&height=12&includetext&guardwhitespace';
}

function barcodeLabelHtml(p, copyIndex) {
  const code = p.sku || p.barcode || '';
  if (!code) return '';
  const copyTxt = copyIndex != null ? (' · #' + (copyIndex + 1)) : '';
  return `<div class="bc-label" style="border:1px dashed #94A3B8;border-radius:10px;padding:0.65rem;text-align:center;background:#fff;page-break-inside:avoid;">
    <div style="font-weight:800;font-size:0.82rem;color:#0A1628;margin-bottom:0.35rem;">${esc(p.name)}${copyTxt}</div>
    <img src="${barcodeImgUrl(code)}" alt="${esc(code)}" style="max-width:100%;height:52px;object-fit:contain;" onerror="this.style.display='none'" />
    <div style="font-family:monospace;font-size:0.75rem;font-weight:700;margin-top:0.25rem;letter-spacing:0.05em;">${esc(code)}</div>
    <div style="font-size:0.72rem;color:#C9A227;font-weight:800;">${money(p.price)}</div>
  </div>`;
}

/** One product → qty labels (same barcode, print for each unit) */
/** Units jitni → utni barcode labels (har pcs pe 1 sticker) */
function unitCount(p) {
  const n = Number(p.labelQty || p.stock || p.qty || p.copies || 0);
  return Math.max(1, Math.floor(n) || 1);
}
function labelsForProduct(p, forceQty) {
  const qty = forceQty != null ? Math.max(1, forceQty) : unitCount(p);
  let html = '';
  for (let i = 0; i < qty; i++) {
    html += barcodeLabelHtml(p, i);
  }
  return html;
}
function openLabelPrintWindow(title, body, total) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('Popup blocked — allow popups for print');
    return;
  }
  w.document.write(
    '<!DOCTYPE html><html><head><title>' + title + '</title>' +
    '<style>' +
    'body{font-family:system-ui,sans-serif;padding:10px;margin:0;}' +
    '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}' +
    '.bc-label{border:1px dashed #333;border-radius:6px;padding:8px;text-align:center;page-break-inside:avoid;}' +
    '@media print{body{padding:0;}.no-print{display:none;}.grid{gap:4px;}}' +
    '</style></head><body>' +
    '<p class="no-print" style="font-size:13px;">Total stickers: <b>' + total + '</b> — har pcs / unit pe 1 label chipkayein. ' +
    '<button onclick="window.print()">Print</button></p>' +
    '<div class="grid">' + body + '</div>' +
    '<script>setTimeout(function(){window.print();},800);</script></body></html>'
  );
  w.document.close();
}


async function ensureProductBarcode(p) {
  if (p.sku || p.barcode) return p;
  p.sku = generateBarcodeCode();
  p.barcode = p.sku;
  p.updatedAt = Date.now();
  await saveLocal('shopProducts', p);
  return p;
}

document.getElementById('btn-gen-barcode')?.addEventListener('click', () => {
  const el = document.getElementById('prod-sku');
  if (el) el.value = generateBarcodeCode();
});

// POS: scan barcode → Enter adds to cart
async function addToCartByBarcode(code) {
  code = String(code || '').trim();
  if (!code) return false;
  const products = await getProducts();
  const p = products.find(
    (x) =>
      String(x.sku || '').toLowerCase() === code.toLowerCase() ||
      String(x.barcode || '').toLowerCase() === code.toLowerCase()
  );
  if (!p) {
    alert('Barcode not found: ' + code);
    return false;
  }
  if (Number(p.stock || 0) <= 0) {
    alert('Out of stock: ' + p.name);
    return false;
  }
  const existing = cart.find((c) => c.productId === p.id);
  const inCart = existing ? existing.qty : 0;
  if (inCart + 1 > Number(p.stock || 0)) {
    alert('Stock limit: only ' + p.stock + ' available');
    return false;
  }
  if (existing) existing.qty += 1;
  else
    cart.push({
      productId: p.id,
      name: p.name,
      price: Number(p.price || 0),
      cost: Number(p.cost || 0),
      qty: 1,
      sku: p.sku || p.barcode || ''
    });
  renderCart();
  return true;
}

const posBarcode = document.getElementById('pos-barcode');
if (posBarcode) {
  posBarcode.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = posBarcode.value.trim();
      if (!code) return;
      const ok = await addToCartByBarcode(code);
      posBarcode.value = '';
      posBarcode.focus();
      if (ok) {
        // brief flash
        posBarcode.style.borderColor = '#059669';
        setTimeout(() => { posBarcode.style.borderColor = '#C9A227'; }, 400);
      }
    }
  });
}

async function renderBarcodeGrid() {
  const grid = document.getElementById('barcode-grid');
  if (!grid) return;
  const list = await getProducts();
  list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  grid.innerHTML = list.length
    ? list
        .map((p) => {
          const code = p.sku || p.barcode || '';
          const units = unitCount(p);
          if (!code) {
            return `<div style="border:1px solid #FECACA;border-radius:10px;padding:0.65rem;text-align:center;background:#FEF2F2;">
              <div style="font-weight:700;font-size:0.85rem;">${esc(p.name)}</div>
              <div class="muted" style="font-size:0.75rem;margin:0.35rem 0;">No barcode · stock ${units}</div>
              <button type="button" class="mini-btn edit" data-gen-one="${p.id}">Generate</button>
            </div>`;
          }
          return `<div>
            ${barcodeLabelHtml(p)}
            <div style="text-align:center;margin-top:4px;font-size:0.7rem;color:#64748B;">${units} unit label(s)</div>
            <div style="text-align:center;margin-top:4px;">
              <button type="button" class="mini-btn edit" data-print-one="${p.id}">Print ${units} labels</button>
            </div>
          </div>`;
        })
        .join('')
    : '<p class="muted">No products.</p>';

  grid.querySelectorAll('[data-gen-one]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = await getLocal('shopProducts', btn.dataset.genOne);
      if (!p) return;
      await ensureProductBarcode(p);
      await renderBarcodeGrid();
      await renderProducts();
      runSync();
    });
  });
}

document.getElementById('btn-gen-all-missing')?.addEventListener('click', async () => {
  const list = await getProducts();
  let n = 0;
  for (const p of list) {
    if (!p.sku && !p.barcode) {
      await ensureProductBarcode(p);
      n++;
    }
  }
  alert(n ? n + ' barcodes generated' : 'All products already have barcodes');
  await renderBarcodeGrid();
  await renderProducts();
  runSync();
});

document.getElementById('btn-print-barcodes')?.addEventListener('click', async () => {
  const list = await getProducts();
  const withCode = list.filter((p) => p.sku || p.barcode);
  if (!withCode.length) {
    alert('Pehle barcodes generate karein');
    return;
  }
  let body = '';
  let total = 0;
  for (const p of withCode) {
    const q = unitCount(p);
    total += q;
    body += labelsForProduct(p, q);
  }
  openLabelPrintWindow('All barcode labels (' + total + ')', body, total);
});

document.getElementById('barcode-grid')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-print-one]');
  if (!btn) return;
  const p = await getLocal('shopProducts', btn.dataset.printOne);
  if (!p || !(p.sku || p.barcode)) {
    alert('Pehle barcode generate karein');
    return;
  }
  const def = unitCount(p);
  const raw = prompt(
    p.name + '

Kitni units / pcs hain?
Utni hi barcode labels print hongi (har pcs pe 1 sticker).',
    String(def)
  );
  if (raw === null) return;
  const q = Math.max(1, parseInt(raw, 10) || def);
  // save preference
  p.labelQty = q;
  if (!p.stock || Number(p.stock) < q) {
    /* keep stock as is — labels can be for upcoming stock */
  }
  await saveLocal('shopProducts', p);
  openLabelPrintWindow(p.name + ' — ' + q + ' labels', labelsForProduct(p, q), q);
});


const productForm = document.getElementById('product-form');
const productList = document.getElementById('product-list');

async function renderProducts() {
  if (!productList) return;
  const list = await getProducts();
  list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  productList.innerHTML = list.length ? list.map(p => {
    const low = Number(p.stock || 0) <= Number(p.lowStock ?? 5);
    const margin = Number(p.price || 0) - Number(p.cost || 0);
    return `<li>
      <strong>${esc(p.name)}</strong>
      <span class="tag">${esc(p.category || 'Other')}</span>
      <span class="muted">Cost ${money(p.cost)} → Sale ${money(p.price)}</span>
      <span class="amount">Margin ${money(margin)}</span>
      <span class="muted">Stock: ${p.stock ?? 0}${low ? ' ⚠' : ''}</span>
      ${(p.sku||p.barcode) ? `<span class="tag" style="font-family:monospace;">${esc(p.sku||p.barcode)}</span>` : '<span class="muted">no barcode</span>'}
      <span class="actions">
        <button class="mini-btn edit" data-edit-prod="${p.id}">Edit</button>
        <button class="mini-btn danger" data-del-prod="${p.id}">Delete</button>
      </span>
    </li>`;
  }).join('') : '<li class="muted">No products yet.</li>';

  productList.querySelectorAll('[data-del-prod]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete product?')) return;
      await deleteLocal('shopProducts', btn.dataset.delProd);
      await refreshAll(); runSync();
    });
  });
  productList.querySelectorAll('[data-edit-prod]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = await getLocal('shopProducts', btn.dataset.editProd);
      if (!p) return;
      editingProductId = p.id;
      document.getElementById('prod-name').value = p.name || '';
      document.getElementById('prod-sku').value = p.sku || '';
      document.getElementById('prod-category').value = p.category || 'Other';
      document.getElementById('prod-cost').value = p.cost ?? '';
      document.getElementById('prod-price').value = p.price ?? '';
      document.getElementById('prod-stock').value = p.stock ?? 0;
      const lq = document.getElementById('prod-label-qty');
      if (lq) lq.value = p.labelQty ?? p.stock ?? 1;
      document.getElementById('prod-low').value = p.lowStock ?? 5;
      document.getElementById('prod-unit').value = p.unit || 'pcs';
      productForm.querySelector('button[type="submit"]').textContent = 'Update Product';
      const c = document.getElementById('prod-cancel');
      if (c) c.style.display = '';
    });
  });
}

document.getElementById('prod-cancel')?.addEventListener('click', () => {
  editingProductId = null;
  productForm.reset();
  document.getElementById('prod-low').value = 5;
  document.getElementById('prod-unit').value = 'pcs';
  productForm.querySelector('button[type="submit"]').textContent = 'Save Product';
  document.getElementById('prod-cancel').style.display = 'none';
});

if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rec = {
      id: editingProductId || undefined,
      module: MODULE,
      name: val('prod-name'),
      sku: val('prod-sku'),
      barcode: val('prod-sku'),
      category: val('prod-category') || 'Other',
      cost: num('prod-cost'),
      price: num('prod-price'),
      stock: num('prod-stock'),
      labelQty: num('prod-label-qty') || num('prod-stock') || 1,
      lowStock: num('prod-low') || 5,
      unit: val('prod-unit') || 'pcs',
      updatedAt: Date.now()
    };
    if (!rec.name || rec.price < 0) return;
    await saveLocal('shopProducts', rec);
    editingProductId = null;
    productForm.reset();
    document.getElementById('prod-low').value = 5;
    document.getElementById('prod-unit').value = 'pcs';
    productForm.querySelector('button[type="submit"]').textContent = 'Save Product';
    const c = document.getElementById('prod-cancel');
    if (c) c.style.display = 'none';
    await refreshAll(); runSync();
  });
}

const purchaseForm = document.getElementById('purchase-form');
const purchaseList = document.getElementById('purchase-list');

async function fillPurchaseProductSelect() {
  const sel = document.getElementById('pur-product');
  if (!sel) return;
  const list = await getProducts();
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select product *</option>' +
    list.map(p => `<option value="${p.id}" data-cost="${p.cost || 0}">${esc(p.name)} (stock ${p.stock ?? 0})</option>`).join('');
  if (cur) sel.value = cur;
}

document.getElementById('pur-product')?.addEventListener('change', (e) => {
  const opt = e.target.selectedOptions[0];
  if (opt && opt.dataset.cost) document.getElementById('pur-cost').value = opt.dataset.cost;
});

async function renderPurchases() {
  if (!purchaseList) return;
  const list = await getPurchases();
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  purchaseList.innerHTML = list.length ? list.map(p => `<li>
    <strong>${esc(p.productName || '')}</strong>
    <span class="tag">+${p.qty}</span>
    <span class="amount">${money(p.totalCost)}</span>
    <span class="muted">${esc(p.date)} · ${esc(p.supplier || '—')}</span>
    ${p.invoice ? `<span class="muted">#${esc(p.invoice)}</span>` : ''}
    <span class="actions"><button class="mini-btn danger" data-del-pur="${p.id}">Delete</button></span>
  </li>`).join('') : '<li class="muted">No purchases yet.</li>';
  purchaseList.querySelectorAll('[data-del-pur]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete purchase? Stock will NOT be reversed.')) return;
      await deleteLocal('shopPurchases', btn.dataset.delPur);
      await renderPurchases(); runSync();
    });
  });
}

if (purchaseForm) {
  const d = document.getElementById('pur-date');
  if (d && !d.value) d.value = todayStr();
  purchaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = val('pur-product');
    const qty = num('pur-qty');
    const unitCost = num('pur-cost');
    if (!productId || qty <= 0) return;
    const p = await getLocal('shopProducts', productId);
    if (!p) { alert('Product not found'); return; }
    const oldStock = Number(p.stock || 0);
    const oldCost = Number(p.cost || 0);
    const newStock = oldStock + qty;
    const newCost = newStock > 0 ? (oldStock * oldCost + qty * unitCost) / newStock : unitCost;
    p.stock = newStock;
    p.cost = Math.round(newCost * 100) / 100;
    p.updatedAt = Date.now();
    await saveLocal('shopProducts', p);
    const totalCost = qty * unitCost;
    await saveLocal('shopPurchases', {
      module: MODULE, productId, productName: p.name, qty, unitCost, totalCost,
      supplier: val('pur-supplier'), invoice: val('pur-invoice'),
      date: val('pur-date') || todayStr(), note: val('pur-note'), createdAt: Date.now()
    });
    await saveLocal('expenses', {
      module: 'school', date: val('pur-date') || todayStr(), category: 'Supplies',
      description: 'Shop purchase: ' + p.name + ' x ' + qty + (val('pur-supplier') ? ' (' + val('pur-supplier') + ')' : ''),
      amount: totalCost, source: 'shop-purchase', createdAt: Date.now()
    });
    purchaseForm.reset();
    if (d) d.value = todayStr();
    await refreshAll(); await renderPurchases(); runSync();
    alert('Purchase saved. Stock now: ' + p.stock);
  });
}

const posProducts = document.getElementById('pos-products');
const cartList = document.getElementById('cart-list');
const cartTotalEl = document.getElementById('cart-total');
const cartProfitEl = document.getElementById('cart-profit');
const btnCheckout = document.getElementById('btn-checkout');

async function renderPosProducts() {
  if (!posProducts) return;
  const q = (document.getElementById('pos-search')?.value || '').toLowerCase();
  let list = await getProducts();
  if (q) list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  const empty = document.getElementById('pos-empty');
  if (!list.length) { posProducts.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  posProducts.innerHTML = list.map(p => {
    const out = Number(p.stock || 0) <= 0;
    return '<div class="product-chip" data-add="' + p.id + '" style="' + (out ? 'opacity:0.4;pointer-events:none;' : '') + '">' +
      '<div class="name">' + esc(p.name) + '</div>' +
      '<div class="price">' + money(p.price) + '</div>' +
      '<div class="stock">' + (out ? 'Out of stock' : 'Stock: ' + p.stock) + '</div></div>';
  }).join('');
  posProducts.querySelectorAll('[data-add]').forEach(el => {
    el.addEventListener('click', async () => {
      const p = await getLocal('shopProducts', el.dataset.add);
      if (!p || Number(p.stock || 0) <= 0) return;
      const existing = cart.find(c => c.productId === p.id);
      const inCart = existing ? existing.qty : 0;
      if (inCart + 1 > Number(p.stock || 0)) { alert('Stock limit: only ' + p.stock + ' available'); return; }
      if (existing) existing.qty += 1;
      else cart.push({ productId: p.id, name: p.name, price: Number(p.price || 0), cost: Number(p.cost || 0), qty: 1 });
      renderCart();
    });
  });
}

document.getElementById('pos-search')?.addEventListener('input', () => renderPosProducts());

function renderCart() {
  if (!cartList) return;
  if (!cart.length) {
    cartList.innerHTML = '<div style="opacity:0.6;font-size:0.85rem;">Cart empty</div>';
    if (cartTotalEl) cartTotalEl.textContent = money(0);
    if (cartProfitEl) cartProfitEl.textContent = money(0);
    if (btnCheckout) btnCheckout.disabled = true;
    return;
  }
  cartList.innerHTML = cart.map((c, i) =>
    '<div class="cart-item"><span>' + esc(c.name) + ' x ' + c.qty + '</span><span>' + money(c.price * c.qty) +
    ' <button type="button" data-rm="' + i + '" style="margin-left:6px;background:#B91C1C;color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px;">X</button></span></div>'
  ).join('');
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const profit = cart.reduce((s, c) => s + (c.price - c.cost) * c.qty, 0);
  if (cartTotalEl) cartTotalEl.textContent = money(total);
  if (cartProfitEl) cartProfitEl.textContent = money(profit);
  if (btnCheckout) btnCheckout.disabled = false;
  cartList.querySelectorAll('[data-rm]').forEach(btn => {
    btn.addEventListener('click', () => { cart.splice(Number(btn.dataset.rm), 1); renderCart(); });
  });
}

document.getElementById('btn-clear-cart')?.addEventListener('click', () => { cart = []; renderCart(); });

btnCheckout?.addEventListener('click', async () => {
  if (!cart.length) return;
  const staff = getStaffSession();
  const items = cart.map(c => Object.assign({}, c));
  const total = items.reduce((s, c) => s + c.price * c.qty, 0);
  const profit = items.reduce((s, c) => s + (c.price - c.cost) * c.qty, 0);
  const cogs = items.reduce((s, c) => s + c.cost * c.qty, 0);
  for (const line of items) {
    const p = await getLocal('shopProducts', line.productId);
    if (!p) continue;
    p.stock = Math.max(0, Number(p.stock || 0) - line.qty);
    p.updatedAt = Date.now();
    await saveLocal('shopProducts', p);
  }
  await saveLocal('shopSales', {
    module: MODULE, date: todayStr(),
    time: new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
    items: items, total: total, cogs: cogs, profit: profit,
    payment: val('sale-pay') || 'Cash', note: val('sale-note'),
    soldBy: staff?.name || staff?.username || 'Staff', soldById: staff?.id || null, createdAt: Date.now()
  });
  await saveLocal('income', {
    module: 'school', date: todayStr(), category: 'Shop',
    description: 'Shop sale — ' + items.map(i => i.name + 'x' + i.qty).join(', ').slice(0, 80),
    amount: total, source: 'shop', profit: profit, createdAt: Date.now()
  });
  cart = [];
  const noteEl = document.getElementById('sale-note');
  if (noteEl) noteEl.value = '';
  renderCart(); await refreshAll(); runSync();
  alert('Sale complete: ' + money(total) + '\nProfit: ' + money(profit));
});

async function renderSales() {
  const salesList = document.getElementById('sales-list');
  if (!salesList) return;
  let list = await getSales();
  const from = val('sales-from');
  const to = val('sales-to');
  if (from) list = list.filter(s => (s.date || '') >= from);
  if (to) list = list.filter(s => (s.date || '') <= to);
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  salesList.innerHTML = list.length ? list.map(s => {
    const items = (s.items || []).map(i => esc(i.name) + 'x' + i.qty).join(', ');
    return '<li><strong>' + esc(s.date) + ' ' + esc(s.time || '') + '</strong>' +
      '<span class="amount">' + money(s.total) + '</span>' +
      '<span class="tag" style="background:#059669;">P ' + money(s.profit || 0) + '</span>' +
      '<span class="muted">' + items + '</span>' +
      '<span class="tag">' + esc(s.payment || 'Cash') + '</span>' +
      '<span class="muted">' + esc(s.soldBy || '') + '</span>' +
      '<span class="actions"><button class="mini-btn danger" data-del-sale="' + s.id + '">Delete</button></span></li>';
  }).join('') : '<li class="muted">No sales yet.</li>';
  salesList.querySelectorAll('[data-del-sale]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete sale? Stock will NOT be restored.')) return;
      await deleteLocal('shopSales', btn.dataset.delSale);
      await refreshAll(); runSync();
    });
  });
}
document.getElementById('sales-filter-btn')?.addEventListener('click', () => renderSales());

async function renderInventory() {
  const body = document.getElementById('inv-body');
  if (!body) return;
  const q = (document.getElementById('inv-search')?.value || '').toLowerCase();
  let list = await getProducts();
  if (q) list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  body.innerHTML = list.length ? list.map(p => {
    const low = Number(p.stock || 0) <= Number(p.lowStock ?? 5);
    const val = Number(p.stock || 0) * Number(p.cost || 0);
    const margin = Number(p.price || 0) - Number(p.cost || 0);
    const pct = Number(p.cost || 0) > 0 ? Math.round((margin / Number(p.cost)) * 100) : 0;
    return '<tr class="' + (low ? 'low' : '') + '"><td><strong>' + esc(p.name) + '</strong></td><td>' + esc(p.sku || '—') +
      '</td><td>' + esc(p.category || '') + '</td><td>' + (p.stock ?? 0) + ' ' + esc(p.unit || '') + (low ? ' !' : '') +
      '</td><td>' + money(p.cost) + '</td><td>' + money(p.price) + '</td><td>' + money(val) +
      '</td><td>' + money(margin) + ' (' + pct + '%)</td></tr>';
  }).join('') : '<tr><td colspan="8" class="muted">No products</td></tr>';
}
document.getElementById('inv-search')?.addEventListener('input', () => renderInventory());
document.getElementById('inv-refresh')?.addEventListener('click', () => renderInventory());

async function runPLReport() {
  let from = val('pl-from');
  let to = val('pl-to');
  if (!from) { from = monthPrefix() + '-01'; const el = document.getElementById('pl-from'); if (el) el.value = from; }
  if (!to) { to = todayStr(); const el = document.getElementById('pl-to'); if (el) el.value = to; }
  const sales = (await getSales()).filter(s => (s.date || '') >= from && (s.date || '') <= to);
  const purchases = (await getPurchases()).filter(p => (p.date || '') >= from && (p.date || '') <= to);
  const totalSales = sales.reduce((a, s) => a + Number(s.total || 0), 0);
  const totalCogs = sales.reduce((a, s) => a + Number(s.cogs || 0), 0);
  const gross = sales.reduce((a, s) => a + Number(s.profit || 0), 0);
  const totalPur = purchases.reduce((a, p) => a + Number(p.totalCost || 0), 0);
  const units = sales.reduce((a, s) => a + (s.items || []).reduce((x, i) => x + Number(i.qty || 0), 0), 0);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('pl-sales', money(totalSales));
  set('pl-cogs', money(totalCogs));
  set('pl-gross', money(gross));
  set('pl-purchases', money(totalPur));
  set('pl-units', units);
  set('pl-tx', sales.length);
  const byProd = {};
  sales.forEach(s => {
    (s.items || []).forEach(i => {
      if (!byProd[i.name]) byProd[i.name] = { qty: 0, sales: 0, profit: 0 };
      byProd[i.name].qty += i.qty;
      byProd[i.name].sales += i.price * i.qty;
      byProd[i.name].profit += (i.price - (i.cost || 0)) * i.qty;
    });
  });
  const top = Object.entries(byProd).sort((a, b) => b[1].profit - a[1].profit).slice(0, 15);
  const topEl = document.getElementById('pl-top');
  if (topEl) {
    topEl.innerHTML = top.length ? top.map(([name, d]) =>
      '<li><strong>' + esc(name) + '</strong> <span class="muted">x' + d.qty + '</span>' +
      '<span class="amount">' + money(d.sales) + '</span>' +
      '<span class="tag" style="background:#059669;">P ' + money(d.profit) + '</span></li>'
    ).join('') : '<li class="muted">No sales in this period.</li>';
  }
}
document.getElementById('pl-run')?.addEventListener('click', () => runPLReport());

async function refreshAll() {
  await Promise.all([renderKpis(), renderProducts(), renderPosProducts(), renderSales(), fillPurchaseProductSelect()]);
}

renderCart();
const pd = document.getElementById('pur-date');
if (pd && !pd.value) pd.value = todayStr();
refreshAll();
renderPurchases();
