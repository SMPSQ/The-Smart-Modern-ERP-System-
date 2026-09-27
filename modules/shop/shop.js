// modules/shop/shop.js — School Shop POS + Inventory
import { saveLocal, getAllLocal, deleteLocal, getLocal, uid } from '../../js/db.js';
import { runSync } from '../../js/sync.js';
import { getStaffSession, isShopOnlyRole } from '../../js/staff-auth.js';

const MODULE = 'shop';
let cart = []; // { productId, name, price, qty }
let editingProductId = null;

function esc(str = '') {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function money(n) {
  return 'Rs ' + Number(n || 0).toLocaleString('en-PK');
}
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthPrefix() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// Hide back link for shop-only users
(function () {
  const staff = getStaffSession();
  if (staff && isShopOnlyRole(staff.role)) {
    const back = document.getElementById('back-dash');
    if (back) back.style.display = 'none';
  }
})();

// Tabs
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
  });
});

async function getProducts() {
  const all = await getAllLocal('shopProducts');
  return all.filter((p) => !p.module || p.module === MODULE);
}
async function getSales() {
  const all = await getAllLocal('shopSales');
  return all.filter((s) => !s.module || s.module === MODULE);
}

// ========== KPIs ==========
async function renderKpis() {
  const products = await getProducts();
  const sales = await getSales();
  const today = todayStr();
  const month = monthPrefix();
  const todaySum = sales
    .filter((s) => (s.date || '').startsWith(today))
    .reduce((a, s) => a + Number(s.total || 0), 0);
  const monthSum = sales
    .filter((s) => (s.date || '').startsWith(month))
    .reduce((a, s) => a + Number(s.total || 0), 0);
  const low = products.filter(
    (p) => Number(p.stock || 0) <= Number(p.lowStock ?? 5)
  ).length;

  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set('kpi-today', money(todaySum));
  set('kpi-month', money(monthSum));
  set('kpi-products', products.length);
  set('kpi-low', low);
}

// ========== PRODUCTS ==========
const productForm = document.getElementById('product-form');
const productList = document.getElementById('product-list');

async function renderProducts() {
  if (!productList) return;
  const list = await getProducts();
  list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  productList.innerHTML = list.length
    ? list
        .map((p) => {
          const low = Number(p.stock || 0) <= Number(p.lowStock ?? 5);
          return `<li>
            <strong>${esc(p.name)}</strong>
            <span class="tag">${esc(p.category || 'Other')}</span>
            <span class="amount">${money(p.price)}</span>
            <span class="muted">Stock: ${p.stock ?? 0}${low ? ' ⚠' : ''}</span>
            ${p.sku ? `<span class="muted">${esc(p.sku)}</span>` : ''}
            <span class="actions">
              <button class="mini-btn edit" data-edit-prod="${p.id}">Edit</button>
              <button class="mini-btn danger" data-del-prod="${p.id}">Delete</button>
            </span>
          </li>`;
        })
        .join('')
    : '<li class="muted">No products yet. Add stationery, books, uniform…</li>';

  productList.querySelectorAll('[data-del-prod]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete product?')) return;
      await deleteLocal('shopProducts', btn.dataset.delProd);
      await refreshAll();
      runSync();
    });
  });
  productList.querySelectorAll('[data-edit-prod]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = await getLocal('shopProducts', btn.dataset.editProd);
      if (!p) return;
      editingProductId = p.id;
      document.getElementById('prod-name').value = p.name || '';
      document.getElementById('prod-sku').value = p.sku || '';
      document.getElementById('prod-category').value = p.category || 'Other';
      document.getElementById('prod-price').value = p.price ?? '';
      document.getElementById('prod-cost').value = p.cost ?? '';
      document.getElementById('prod-stock').value = p.stock ?? '';
      document.getElementById('prod-low').value = p.lowStock ?? 5;
      productForm.querySelector('button[type="submit"]').textContent = 'Update Product';
    });
  });
}

if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rec = {
      id: editingProductId || undefined,
      module: MODULE,
      name: val('prod-name'),
      sku: val('prod-sku'),
      category: val('prod-category') || 'Other',
      price: Number(document.getElementById('prod-price')?.value || 0),
      cost: Number(document.getElementById('prod-cost')?.value || 0),
      stock: Number(document.getElementById('prod-stock')?.value || 0),
      lowStock: Number(document.getElementById('prod-low')?.value || 5),
      updatedAt: Date.now()
    };
    if (!rec.name || rec.price < 0) return;
    await saveLocal('shopProducts', rec);
    editingProductId = null;
    productForm.reset();
    document.getElementById('prod-low').value = 5;
    productForm.querySelector('button[type="submit"]').textContent = 'Save Product';
    await refreshAll();
    runSync();
  });
}

// ========== POS / CART ==========
const posProducts = document.getElementById('pos-products');
const cartList = document.getElementById('cart-list');
const cartTotalEl = document.getElementById('cart-total');
const btnCheckout = document.getElementById('btn-checkout');

async function renderPosProducts() {
  if (!posProducts) return;
  const list = await getProducts();
  const empty = document.getElementById('pos-empty');
  if (!list.length) {
    posProducts.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  posProducts.innerHTML = list
    .map((p) => {
      const out = Number(p.stock || 0) <= 0;
      return `<div class="product-chip" data-add="${p.id}" style="${out ? 'opacity:0.45;pointer-events:none;' : ''}">
        <div class="name">${esc(p.name)}</div>
        <div class="price">${money(p.price)}</div>
        <div class="stock">${out ? 'Out of stock' : 'Stock: ' + p.stock}</div>
      </div>`;
    })
    .join('');
  posProducts.querySelectorAll('[data-add]').forEach((el) => {
    el.addEventListener('click', async () => {
      const p = await getLocal('shopProducts', el.dataset.add);
      if (!p || Number(p.stock || 0) <= 0) return;
      const existing = cart.find((c) => c.productId === p.id);
      const inCart = existing ? existing.qty : 0;
      if (inCart + 1 > Number(p.stock || 0)) {
        alert('Stock limit: only ' + p.stock + ' available');
        return;
      }
      if (existing) existing.qty += 1;
      else
        cart.push({
          productId: p.id,
          name: p.name,
          price: Number(p.price || 0),
          qty: 1
        });
      renderCart();
    });
  });
}

function renderCart() {
  if (!cartList) return;
  if (!cart.length) {
    cartList.innerHTML = '<div style="opacity:0.6;font-size:0.85rem;">Cart empty — products select karein</div>';
    if (cartTotalEl) cartTotalEl.textContent = money(0);
    if (btnCheckout) btnCheckout.disabled = true;
    return;
  }
  cartList.innerHTML = cart
    .map(
      (c, i) => `<div class="cart-item">
        <span>${esc(c.name)} × ${c.qty}</span>
        <span>
          ${money(c.price * c.qty)}
          <button type="button" data-rm="${i}" style="margin-left:6px;background:#B91C1C;color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px;">✕</button>
        </span>
      </div>`
    )
    .join('');
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  if (cartTotalEl) cartTotalEl.textContent = money(total);
  if (btnCheckout) btnCheckout.disabled = false;
  cartList.querySelectorAll('[data-rm]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cart.splice(Number(btn.dataset.rm), 1);
      renderCart();
    });
  });
}

document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
  cart = [];
  renderCart();
});

btnCheckout?.addEventListener('click', async () => {
  if (!cart.length) return;
  const staff = getStaffSession();
  const items = cart.map((c) => ({ ...c }));
  const total = items.reduce((s, c) => s + c.price * c.qty, 0);

  // Deduct stock
  for (const line of items) {
    const p = await getLocal('shopProducts', line.productId);
    if (!p) continue;
    p.stock = Math.max(0, Number(p.stock || 0) - line.qty);
    p.updatedAt = Date.now();
    await saveLocal('shopProducts', p);
  }

  await saveLocal('shopSales', {
    module: MODULE,
    date: todayStr(),
    time: new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
    items,
    total,
    note: val('sale-note'),
    soldBy: staff?.name || staff?.username || 'Staff',
    soldById: staff?.id || null,
    createdAt: Date.now()
  });

  // Mirror sale as school income (for accounting)
  await saveLocal('income', {
    module: 'school',
    date: todayStr(),
    description: 'Shop sale — ' + items.map((i) => i.name + '×' + i.qty).join(', ').slice(0, 80),
    amount: total,
    source: 'shop',
    createdAt: Date.now()
  });

  cart = [];
  const noteEl = document.getElementById('sale-note');
  if (noteEl) noteEl.value = '';
  renderCart();
  await refreshAll();
  runSync();
  alert('Sale complete: ' + money(total));
});

// ========== SALES HISTORY ==========
const salesList = document.getElementById('sales-list');

async function renderSales() {
  if (!salesList) return;
  let list = await getSales();
  const from = val('sales-from');
  const to = val('sales-to');
  if (from) list = list.filter((s) => (s.date || '') >= from);
  if (to) list = list.filter((s) => (s.date || '') <= to);
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  salesList.innerHTML = list.length
    ? list
        .map((s) => {
          const items = (s.items || [])
            .map((i) => `${esc(i.name)}×${i.qty}`)
            .join(', ');
          return `<li>
            <strong>${esc(s.date)} ${esc(s.time || '')}</strong>
            <span class="amount">${money(s.total)}</span>
            <span class="muted">${items}</span>
            <span class="tag">${esc(s.soldBy || '')}</span>
            <span class="actions">
              <button class="mini-btn danger" data-del-sale="${s.id}">Delete</button>
            </span>
          </li>`;
        })
        .join('')
    : '<li class="muted">No sales yet.</li>';

  salesList.querySelectorAll('[data-del-sale]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this sale record? (stock will NOT be restored)')) return;
      await deleteLocal('shopSales', btn.dataset.delSale);
      await refreshAll();
      runSync();
    });
  });
}

document.getElementById('sales-filter-btn')?.addEventListener('click', () => renderSales());

async function refreshAll() {
  await Promise.all([renderKpis(), renderProducts(), renderPosProducts(), renderSales()]);
}

renderCart();
refreshAll();
