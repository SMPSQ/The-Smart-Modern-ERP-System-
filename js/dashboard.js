import { saveLocal, getAllLocal } from "./db.js";
import { runSync } from "./sync.js";

const listEl = document.getElementById("visitor-list");
const formEl = document.getElementById("visitor-form");

async function renderVisitors() {
  const visitors = await getAllLocal("visitors");
  visitors.sort((a, b) => b._updatedAt - a._updatedAt);

  listEl.innerHTML = "";
  for (const v of visitors.slice(0, 15)) {
    const li = document.createElement("li");
    li.className = v._synced ? "" : "pending";
    li.innerHTML = `
      <span>${escapeHtml(v.name)} — ${escapeHtml(v.reason || "No reason given")}</span>
      <span class="v-badge">${labelForModule(v.forModule)}</span>
    `;
    listEl.appendChild(li);
  }
}

function labelForModule(m) {
  return { school: "School", trading: "Trading Academy", academy: "Educational Academy", general: "General" }[m] || m;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

formEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("visitor-name").value.trim();
  const forModule = document.getElementById("visitor-for").value;
  const reason = document.getElementById("visitor-reason").value.trim();
  if (!name) return;

  await saveLocal("visitors", { name, forModule, reason, loggedAt: Date.now() });
  formEl.reset();
  await renderVisitors();
  runSync();
});

renderVisitors();
