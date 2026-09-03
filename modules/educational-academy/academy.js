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

// ---------------- Tutors ----------------
async function getTutors() {
  const tutors = await getAllLocal("tutors");
  return tutors.sort((a, b) => a.name.localeCompare(b.name));
}

async function renderTutors() {
  const tutors = await getTutors();
  const tbody = document.getElementById("tutors-tbody");
  const tutorSelect = document.getElementById("c-tutor");

  tbody.innerHTML = tutors.length
    ? ""
    : `<tr class="empty-row"><td colspan="4">No tutors yet — add one above.</td></tr>`;

  tutorSelect.innerHTML = `<option value="">Unassigned</option>`;

  for (const t of tutors) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td>${escapeHtml(t.subject || "—")}</td>
      <td>${escapeHtml(t.contact || "—")}</td>
      <td><button class="mini-btn danger" data-del-tutor="${t.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);

    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    opt.dataset.name = t.name;
    tutorSelect.appendChild(opt);
  }

  tbody.querySelectorAll("[data-del-tutor]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this tutor?")) return;
      await deleteLocal("tutors", btn.dataset.delTutor);
      await renderTutors();
      await renderClasses();
      runSync();
    });
  });
}

document.getElementById("tutor-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("t-name").value.trim();
  const subject = document.getElementById("t-subject").value.trim();
  const contact = document.getElementById("t-contact").value.trim();
  if (!name) return;

  await saveLocal("tutors", { name, subject, contact });
  e.target.reset();
  await renderTutors();
  runSync();
});

// ---------------- Classes / Timetable ----------------
async function getClasses() {
  const classes = await getAllLocal("tuition_classes");
  return classes.sort((a, b) => a.subject.localeCompare(b.subject));
}

async function renderClasses() {
  const classes = await getClasses();
  const enrollments = await getAllLocal("academy_enrollments");
  const tbody = document.getElementById("classes-tbody");
  const classSelect = document.getElementById("e-class");
  const filterSelect = document.getElementById("e-filter");

  tbody.innerHTML = classes.length
    ? ""
    : `<tr class="empty-row"><td colspan="6">No classes yet — add one above.</td></tr>`;

  classSelect.innerHTML = classes.length ? "" : `<option value="">Add a class first</option>`;
  const selectedFilter = filterSelect.value || "all";
  filterSelect.innerHTML = `<option value="all">All classes</option>`;

  for (const c of classes) {
    const count = enrollments.filter((e) => e.classId === c.id).length;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.subject)}</td>
      <td>${escapeHtml(c.room)}</td>
      <td>${escapeHtml(c.timing)}</td>
      <td>${escapeHtml(c.tutorName || "Unassigned")}</td>
      <td>${count}</td>
      <td><button class="mini-btn danger" data-del-class="${c.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);

    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.subject;
    opt.dataset.subject = c.subject;
    classSelect.appendChild(opt);

    const fopt = document.createElement("option");
    fopt.value = c.id;
    fopt.textContent = c.subject;
    filterSelect.appendChild(fopt);
  }
  filterSelect.value = [...filterSelect.options].some((o) => o.value === selectedFilter) ? selectedFilter : "all";

  tbody.querySelectorAll("[data-del-class]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this class? Existing enrollments keep their record but lose the live link.")) return;
      await deleteLocal("tuition_classes", btn.dataset.delClass);
      await renderClasses();
      await renderEnrollments();
      runSync();
    });
  });
}

document.getElementById("class-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const subject = document.getElementById("c-subject").value.trim();
  const room = document.getElementById("c-room").value.trim();
  const timing = document.getElementById("c-timing").value.trim();
  const tutorSelect = document.getElementById("c-tutor");
  const tutorOpt = tutorSelect.selectedOptions[0];
  if (!subject || !room || !timing) return;

  await saveLocal("tuition_classes", {
    subject,
    room,
    timing,
    tutorId: tutorOpt?.value || null,
    tutorName: tutorOpt?.value ? tutorOpt.dataset.name : "",
  });

  e.target.reset();
  await renderClasses();
  runSync();
});

// ---------------- Enrollments ----------------
async function getEnrollments() {
  const rows = await getAllLocal("academy_enrollments");
  return rows.sort((a, b) => b._updatedAt - a._updatedAt);
}

async function renderEnrollments() {
  const all = await getEnrollments();
  const activeFilter = document.getElementById("e-filter").value;
  const filtered = activeFilter === "all" ? all : all.filter((r) => r.classId === activeFilter);

  const tbody = document.getElementById("enrollments-tbody");
  tbody.innerHTML = filtered.length
    ? filtered.map((r) => `
        <tr>
          <td>${escapeHtml(r.studentName)}</td>
          <td>${escapeHtml(r.contact || "—")}</td>
          <td>${escapeHtml(r.className)}</td>
          <td>${new Date(r.enrolledOn).toLocaleDateString()}</td>
          <td><button class="mini-btn danger" data-del-enroll="${r.id}">Remove</button></td>
        </tr>
      `).join("")
    : `<tr class="empty-row"><td colspan="5">No enrollments for this filter yet.</td></tr>`;

  tbody.querySelectorAll("[data-del-enroll]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this enrollment?")) return;
      await deleteLocal("academy_enrollments", btn.dataset.delEnroll);
      await renderClasses();
      await renderEnrollments();
      runSync();
    });
  });
}

document.getElementById("enroll-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const select = document.getElementById("e-class");
  const opt = select.selectedOptions[0];
  if (!opt || !opt.value) return;

  const studentName = document.getElementById("e-name").value.trim();
  const contact = document.getElementById("e-contact").value.trim();
  if (!studentName) return;

  await saveLocal("academy_enrollments", {
    studentName,
    contact,
    classId: opt.value,
    className: opt.dataset.subject,
    enrolledOn: Date.now(),
  });

  e.target.reset();
  await renderClasses();
  await renderEnrollments();
  runSync();
});

document.getElementById("e-filter").addEventListener("change", renderEnrollments);

renderTutors().then(renderClasses).then(renderEnrollments);
