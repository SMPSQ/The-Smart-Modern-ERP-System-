import { saveLocal, getAllLocal, deleteLocal } from "../../js/db.js";
import { runSync } from "../../js/sync.js";

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

// ---------------- Batches ----------------
async function getBatches() {
  const batches = await getAllLocal("batches");
  return batches.sort((a, b) => a.name.localeCompare(b.name));
}

async function renderBatches() {
  const batches = await getBatches();
  const enrollments = await getAllLocal("trading_enrollments");
  const tbody = document.getElementById("batches-tbody");
  const batchSelect = document.getElementById("e-batch");
  const filterSelect = document.getElementById("e-filter");

  tbody.innerHTML = batches.length
    ? ""
    : `<tr class="empty-row"><td colspan="6">No batches yet — add one above.</td></tr>`;

  batchSelect.innerHTML = batches.length ? "" : `<option value="">Add a batch first</option>`;
  const selectedFilter = filterSelect.value || "all";
  filterSelect.innerHTML = `<option value="all">All batches</option>`;

  for (const b of batches) {
    const count = enrollments.filter((e) => e.batchId === b.id).length;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(b.name)}</td>
      <td style="text-transform:capitalize;">${escapeHtml(b.gender)}</td>
      <td>${escapeHtml(b.timing)}</td>
      <td>${escapeHtml(b.instructor || "—")}</td>
      <td>${count}</td>
      <td><button class="mini-btn danger" data-del-batch="${b.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);

    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = `${b.name} (${b.gender})`;
    opt.dataset.name = b.name;
    batchSelect.appendChild(opt);

    const fopt = document.createElement("option");
    fopt.value = b.id;
    fopt.textContent = `${b.name} (${b.gender})`;
    filterSelect.appendChild(fopt);
  }
  filterSelect.value = [...filterSelect.options].some((o) => o.value === selectedFilter) ? selectedFilter : "all";

  tbody.querySelectorAll("[data-del-batch]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this batch? Existing enrollments keep their record but lose the live link.")) return;
      await deleteLocal("batches", btn.dataset.delBatch);
      await renderBatches();
      await renderEnrollments();
      runSync();
    });
  });
}

document.getElementById("batch-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("b-name").value.trim();
  const gender = document.getElementById("b-gender").value;
  const timing = document.getElementById("b-timing").value.trim();
  const instructor = document.getElementById("b-instructor").value.trim();
  if (!name || !timing) return;

  await saveLocal("batches", { name, gender, timing, instructor });
  e.target.reset();
  await renderBatches();
  runSync();
});

// ---------------- Enrollments ----------------
async function getEnrollments() {
  const rows = await getAllLocal("trading_enrollments");
  return rows.sort((a, b) => b._updatedAt - a._updatedAt);
}

async function renderEnrollments() {
  const all = await getEnrollments();
  const activeFilter = document.getElementById("e-filter").value;
  const filtered = activeFilter === "all" ? all : all.filter((r) => r.batchId === activeFilter);

  const tbody = document.getElementById("enrollments-tbody");
  tbody.innerHTML = filtered.length
    ? filtered.map((r) => `
        <tr>
          <td>${escapeHtml(r.studentName)}</td>
          <td>${escapeHtml(r.contact || "—")}</td>
          <td>${escapeHtml(r.batchName)}</td>
          <td>${new Date(r.enrolledOn).toLocaleDateString()}</td>
          <td><button class="mini-btn danger" data-del-enroll="${r.id}">Remove</button></td>
        </tr>
      `).join("")
    : `<tr class="empty-row"><td colspan="5">No enrollments for this filter yet.</td></tr>`;

  tbody.querySelectorAll("[data-del-enroll]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this enrollment?")) return;
      await deleteLocal("trading_enrollments", btn.dataset.delEnroll);
      await renderBatches();
      await renderEnrollments();
      runSync();
    });
  });
}

document.getElementById("enroll-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const select = document.getElementById("e-batch");
  const opt = select.selectedOptions[0];
  if (!opt || !opt.value) return;

  const studentName = document.getElementById("e-name").value.trim();
  const contact = document.getElementById("e-contact").value.trim();
  if (!studentName) return;

  await saveLocal("trading_enrollments", {
    studentName,
    contact,
    batchId: opt.value,
    batchName: opt.dataset.name,
    enrolledOn: Date.now(),
  });

  e.target.reset();
  await renderBatches();
  await renderEnrollments();
  runSync();
});

document.getElementById("e-filter").addEventListener("change", renderEnrollments);

renderBatches().then(renderEnrollments);
