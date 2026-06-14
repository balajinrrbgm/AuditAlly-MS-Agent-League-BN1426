// AuditAlly demo studio — talks to the local /api endpoints and embeds the
// real MCP App cards (/ui/*). Listens for the same `mcp:action` messages the
// cards post inside Copilot, so "Fix it" buttons drive the write path here too.

const $ = (id) => document.getElementById(id);

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function loadMode() {
  try {
    const cap = await getJSON("/api/capabilities");
    $("mode").textContent = `mode: ${cap.mode} · IQ: ${cap.foundryIQ} · auth: ${cap.auth}`;
  } catch {
    $("mode").textContent = "mode: offline";
  }
}

function refreshCockpit() {
  const fw = $("framework").value;
  $("cockpitFrame").src = "/ui/cockpit" + (fw ? `?framework=${fw}` : "");
}

async function loadControls() {
  try {
    const fw = $("framework").value;
    const data = await getJSON("/api/readiness" + (fw ? `?framework=${fw}` : ""));
    const list = $("controlList");
    list.innerHTML = "";
    for (const r of data.controls) {
      const el = document.createElement("div");
      el.className = "ctl";
      el.innerHTML =
        `<span><span class="code">${r.control.code}</span> · ${r.control.title}</span>` +
        `<span class="dot ${r.status}" title="${r.status}"></span>`;
      el.onclick = () => openControl(r.control.id);
      list.appendChild(el);
    }
  } catch (e) {
    $("controlList").textContent = "Failed to load controls.";
  }
}

function openControl(id) {
  $("detail").classList.remove("hidden");
  $("detailFrame").src = `/ui/control/${id}`;
}

async function ask() {
  const q = $("question").value.trim();
  if (!q) return;
  const ans = $("answer");
  ans.classList.remove("hidden");
  ans.textContent = "Thinking…";
  try {
    const result = await postJSON("/api/ask", { question: q });
    const cites = (result.citations || [])
      .map((c, i) => `[${i + 1}] ${c.title} › ${c.section}`)
      .join("\n");
    ans.textContent = result.grounded
      ? `${result.answer}\n\nSources:\n${cites}`
      : result.answer || JSON.stringify(result);
  } catch (e) {
    ans.textContent = "Error: " + e.message;
  }
}

async function loadTasks() {
  try {
    const data = await getJSON("/api/tasks");
    const el = $("tasks");
    if (!data.tasks || data.tasks.length === 0) {
      el.textContent = "No tasks yet.";
      return;
    }
    el.innerHTML = data.tasks
      .map(
        (t) =>
          `<div class="task"><span class="id">${t.id}</span> [${t.status}] ${t.title}<br>` +
          `<span class="hint">owner: ${t.ownerRole} · due ${t.dueDate}</span></div>`,
      )
      .join("");
  } catch {
    $("tasks").textContent = "Failed to load tasks.";
  }
}

async function createTask(controlId) {
  await postJSON("/api/tasks", { controlId });
  await loadTasks();
  refreshCockpit();
}

// Bridge: the MCP App cards post `mcp:action` messages (same as inside Copilot).
window.addEventListener("message", (ev) => {
  const msg = ev.data;
  if (msg && msg.type === "mcp:action" && msg.tool === "create_remediation_task") {
    createTask(msg.arguments.controlId);
  }
});

$("askBtn").onclick = ask;
$("question").addEventListener("keydown", (e) => e.key === "Enter" && ask());
$("refreshBtn").onclick = () => {
  refreshCockpit();
  loadControls();
};
$("framework").onchange = () => {
  refreshCockpit();
  loadControls();
};
$("closeDetail").onclick = () => $("detail").classList.add("hidden");

loadMode();
loadControls();
loadTasks();
