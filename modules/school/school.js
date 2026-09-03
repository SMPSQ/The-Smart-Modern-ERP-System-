import { saveLocal, getAllLocal, deleteLocal } from "../../js/db.js";
import { runSync } from "../../js/sync.js";

// ---------------- Tabs ----------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = true));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).hidden = false;
  });
});

function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------------- Students ----------------
async function getStudents() {
  const students = await getAllLocal("students");
  return students.sort((a, b) => a.name.localeCompare(b.name));
}

async function renderStudents() {
  const students = await getStudents();
  const tbody = document.getElementById("students-tbody");
  const studentSelect = document.getElementById("f-student");

  tbody.innerHTML = students.length
    ? ""
    : `<tr class="empty-row"><td colspan="5">No students yet — add one above.</td></tr>`;

  studentSelect.innerHTML = students.length
    ? ""
    : `<option value="">Add a student first</option>`;

  for (const s of students) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.className)}</td>
      <td>${escapeHtml(s.guardianName || "—")}</td>
      <td>${escapeHtml(s.guardianContact || "—")}</td>
      <td><button class="mini-btn danger" data-del-student="${s.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);

    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.name} (${s.className})`;
    opt.dataset.name = s.name;
    opt.dataset.className = s.className;
    studentSelect.appendChild(opt);
  }

  tbody.querySelectorAll("[data-del-student]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this student? Their fee history stays on record.")) return;
      await deleteLocal("students", btn.dataset.delStudent);
      await renderStudents();
      runSync();
    });
  });
}

document.getElementById("student-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("s-name").value.trim();
  const className = document.getElementById("s-class").value.trim();
  const guardianName = document.getElementById("s-guardian").value.trim();
  const guardianContact = document.getElementById("s-contact").value.trim();
  if (!name || !className) return;

  await saveLocal("students", { name, className, guardianName, guardianContact });
  e.target.reset();
  await renderStudents();
  runSync();
});

// ---------------- Fee Challans ----------------
function monthLabel(monthStr) {
  const [y, m] = monthStr.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

async function getChallans() {
  const challans = await getAllLocal("fee_challans");
  return challans.sort((a, b) => b.month.localeCompare(a.month) || a.studentName.localeCompare(b.studentName));
}

async function populateMonthFilter(challans) {
  const filter = document.getElementById("f-filter");
  const selected = filter.value || "all";
  const months = [...new Set(challans.map((c) => c.month))].sort().reverse();

  filter.innerHTML = `<option value="all">All months</option>` +
    months.map((m) => `<option value="${m}">${monthLabel(m)}</option>`).join("");
  filter.value = months.includes(selected) ? selected : "all";
}

function challanRow(c) {
  const statusBtn = c.status === "paid"
    ? `<button class="mini-btn ghost-mini" data-mark-unpaid="${c.id}">Mark unpaid</button>`
    : `<button class="mini-btn" data-mark-paid="${c.id}">Mark paid</button>`;

  return `
    <tr>
      <td>${escapeHtml(c.studentName)}</td>
      <td>${escapeHtml(c.className || "—")}</td>
      <td>${monthLabel(c.month)}</td>
      <td>${Number(c.amount).toLocaleString()}</td>
      <td><span class="status-badge ${c.status}">${c.status}</span></td>
      <td style="white-space:nowrap;">
        ${statusBtn}
        <button class="mini-btn danger" data-del-challan="${c.id}">Delete</button>
      </td>
    </tr>
  `;
}

async function renderChallans() {
  const all = await getChallans();
  await populateMonthFilter(all);

  const activeMonth = document.getElementById("f-filter").value;
  const filtered = activeMonth === "all" ? all : all.filter((c) => c.month === activeMonth);

  const unpaid = filtered.filter((c) => c.status !== "paid");
  const paid = filtered.filter((c) => c.status === "paid");

  const unpaidBody = document.getElementById("unpaid-tbody");
  const paidBody = document.getElementById("paid-tbody");

  unpaidBody.innerHTML = unpaid.length
    ? unpaid.map(challanRow).join("")
    : `<tr class="empty-row"><td colspan="6">Nothing unpaid for this filter.</td></tr>`;

  paidBody.innerHTML = paid.length
    ? paid.map(challanRow).join("")
    : `<tr class="empty-row"><td colspan="6">Nothing paid yet for this filter.</td></tr>`;

  document.querySelectorAll("[data-mark-paid]").forEach((btn) =>
    btn.addEventListener("click", () => setChallanStatus(btn.dataset.markPaid, "paid"))
  );
  document.querySelectorAll("[data-mark-unpaid]").forEach((btn) =>
    btn.addEventListener("click", () => setChallanStatus(btn.dataset.markUnpaid, "unpaid"))
  );
  document.querySelectorAll("[data-del-challan]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this fee record?")) return;
      await deleteLocal("fee_challans", btn.dataset.delChallan);
      await renderChallans();
      runSync();
    })
  );
}

async function setChallanStatus(id, status) {
  const all = await getAllLocal("fee_challans");
  const record = all.find((c) => c.id === id);
  if (!record) return;
  record.status = status;
  record.paidOn = status === "paid" ? Date.now() : null;
  await saveLocal("fee_challans", record, "update");
  await renderChallans();
  runSync();
}

document.getElementById("fee-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const select = document.getElementById("f-student");
  const opt = select.selectedOptions[0];
  if (!opt || !opt.value) return;

  const month = document.getElementById("f-month").value;
  const amount = Number(document.getElementById("f-amount").value);
  if (!month || !amount) return;

  await saveLocal("fee_challans", {
    studentId: opt.value,
    studentName: opt.dataset.name,
    className: opt.dataset.className,
    month,
    amount,
    status: "unpaid",
  });

  e.target.reset();
  await renderChallans();
  runSync();
});

document.getElementById("f-filter").addEventListener("change", renderChallans);

// Default the month picker to the current month.
const now = new Date();
document.getElementById("f-month").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

renderStudents().then(renderChallans);
