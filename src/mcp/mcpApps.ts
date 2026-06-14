// MCP Apps — interactive HTML UI rendered inline inside Microsoft 365 Copilot.
//
// Bonus criterion (Battle #3): "MCP Apps (Higher Rating)". Tools return an
// embedded `ui://` HTML resource (the MCP-UI convention) so Copilot renders a
// rich, interactive card instead of plain text. Cards post `mcp` action
// messages back to the host to drive follow-up tool calls.

import type { ReadinessReport, ControlReadiness, RemediationTask } from "../shared/types.js";

const COLORS = {
  ready: "#107c10",
  approaching: "#f7a600",
  "at-risk": "#d13438",
  partial: "#f7a600",
  gap: "#d13438",
} as const;

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bandColor(band: string): string {
  return (COLORS as Record<string, string>)[band] ?? "#666";
}

const BASE_STYLE = `
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 16px; color: #242424; background: #faf9f8; }
    .card { background: #fff; border: 1px solid #edebe9; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h2 { margin: 0 0 4px; font-size: 18px; }
    .sub { color: #605e5c; font-size: 13px; margin-bottom: 14px; }
    .gauge { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .ring { width: 92px; height: 92px; border-radius: 50%; display: grid; place-items: center; font-size: 24px; font-weight: 700; color: #fff; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #fff; }
    .fw-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: 10px; margin: 12px 0; }
    .fw { border: 1px solid #edebe9; border-radius: 8px; padding: 10px; }
    .fw .name { font-weight: 600; font-size: 13px; }
    .fw .score { font-size: 22px; font-weight: 700; }
    .bar { height: 6px; border-radius: 3px; background: #edebe9; overflow: hidden; margin-top: 6px; }
    .bar > span { display: block; height: 100%; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #f3f2f1; }
    th { color: #605e5c; font-weight: 600; }
    .sev { font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .btn { cursor: pointer; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; background: #0f6cbd; color: #fff; }
    .btn:hover { background: #115ea3; }
    .cite { font-size: 12px; color: #605e5c; border-left: 3px solid #0f6cbd; padding: 6px 10px; margin: 6px 0; background: #f3f9fd; border-radius: 0 6px 6px 0; }
    .foot { margin-top: 12px; font-size: 11px; color: #8a8886; }
  </style>`;

const ACTION_SCRIPT = `
  <script>
    function mcpAction(tool, args) {
      try {
        window.parent.postMessage({ type: 'mcp:action', tool: tool, arguments: args }, '*');
        var n = document.getElementById('status');
        if (n) n.textContent = 'Requested: ' + tool + ' \u2192 ' + JSON.stringify(args);
      } catch (e) { console.error(e); }
    }
  </script>`;

/** The flagship "Compliance Cockpit" — overall readiness + frameworks + top gaps. */
export function renderCockpit(report: ReadinessReport): string {
  const fwCards = report.byFramework
    .map(
      (f) => `
      <div class="fw">
        <div class="name">${esc(f.framework)}</div>
        <div class="score" style="color:${bandColor(f.band)}">${f.score}%</div>
        <div class="bar"><span style="width:${f.score}%;background:${bandColor(f.band)}"></span></div>
        <div class="sub" style="margin:6px 0 0">${f.controlsReady}/${f.controlsTotal} ready · ${f.controlsGap} gaps</div>
      </div>`,
    )
    .join("");

  const gapRows = report.topGaps
    .slice(0, 5)
    .map(
      (g) => `
      <tr>
        <td><strong>${esc(g.control.code)}</strong><br><span class="sub">${esc(g.control.title)}</span></td>
        <td><span class="sev" style="color:${bandColor(g.control.severity === "high" ? "at-risk" : "approaching")}">${esc(g.control.severity)}</span></td>
        <td><span class="pill" style="background:${bandColor(g.status)}">${esc(g.status)}</span></td>
        <td><button class="btn" onclick="mcpAction('create_remediation_task',{controlId:'${esc(g.control.id)}'})">Fix it</button></td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">${BASE_STYLE}</head><body>
    <div class="card">
      <h2>🛡️ Compliance Cockpit</h2>
      <div class="sub">Audit readiness across ${report.byFramework.length} frameworks · ${new Date(report.generatedAt).toLocaleString()}</div>
      <div class="gauge">
        <div class="ring" style="background:${bandColor(report.band)}">${report.overallScore}%</div>
        <div>
          <span class="pill" style="background:${bandColor(report.band)}">${esc(report.band)}</span>
          <div class="sub" style="margin-top:6px">Weighted by control severity. Synthetic demo data.</div>
        </div>
      </div>
      <div class="fw-grid">${fwCards}</div>
      <h2 style="font-size:14px">Top gaps to close</h2>
      <table>
        <thead><tr><th>Control</th><th>Severity</th><th>Status</th><th></th></tr></thead>
        <tbody>${gapRows || '<tr><td colspan="4">No gaps — audit ready! 🎉</td></tr>'}</tbody>
      </table>
      <div id="status" class="foot"></div>
      <div class="foot">AuditAlly · grounded with Foundry IQ · all data synthetic.</div>
    </div>${ACTION_SCRIPT}</body></html>`;
}

/** Per-control detail card with evidence + grounded citations. */
export function renderControlDetail(
  r: ControlReadiness,
  citations: { title: string; section: string; snippet: string }[],
): string {
  const evidenceRows = r.control.requiredEvidence
    .map((type) => {
      const ev = r.covered.find((e) => e.type === type);
      const ok = Boolean(ev);
      const reason = r.gaps.find((g) => g.type === type)?.reason ?? "collected";
      return `<tr>
        <td>${esc(type)}</td>
        <td>${ok ? esc(ev!.source) : "—"}</td>
        <td><span class="pill" style="background:${ok ? COLORS.ready : COLORS.gap}">${esc(ok ? "collected" : reason)}</span></td>
      </tr>`;
    })
    .join("");

  const cites = citations
    .map((c) => `<div class="cite"><strong>${esc(c.title)} › ${esc(c.section)}</strong><br>${esc(c.snippet)}</div>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">${BASE_STYLE}</head><body>
    <div class="card">
      <h2>${esc(r.control.code)} — ${esc(r.control.title)}</h2>
      <div class="sub">${esc(r.control.framework)} · owner: ${esc(r.control.ownerRole)} · ${Math.round(r.score * 100)}% covered</div>
      <span class="pill" style="background:${bandColor(r.status)}">${esc(r.status)}</span>
      <p style="font-size:13px">${esc(r.control.description)}</p>
      <h2 style="font-size:14px">Required evidence</h2>
      <table><thead><tr><th>Type</th><th>Source</th><th>Status</th></tr></thead><tbody>${evidenceRows}</tbody></table>
      ${cites ? `<h2 style="font-size:14px;margin-top:14px">Grounded policy citations</h2>${cites}` : ""}
      ${r.status !== "ready" ? `<button class="btn" style="margin-top:12px" onclick="mcpAction('create_remediation_task',{controlId:'${esc(r.control.id)}'})">Create remediation task</button>` : ""}
      <div id="status" class="foot"></div>
      <div class="foot">AuditAlly · synthetic demo data.</div>
    </div>${ACTION_SCRIPT}</body></html>`;
}

/** Confirmation card after a remediation task is written. */
export function renderTaskConfirmation(tasks: RemediationTask[]): string {
  const rows = tasks
    .map(
      (t) => `<tr>
        <td><strong>${esc(t.id)}</strong></td>
        <td>${esc(t.title)}</td>
        <td>${esc(t.ownerRole)}</td>
        <td>${esc(t.dueDate)}</td>
      </tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8">${BASE_STYLE}</head><body>
    <div class="card">
      <h2>✅ Remediation tasks created</h2>
      <div class="sub">${tasks.length} task(s) written to the tracker.</div>
      <table><thead><tr><th>ID</th><th>Task</th><th>Owner</th><th>Due</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="foot">AuditAlly · written via OAuth-secured MCP write tool · synthetic demo data.</div>
    </div></body></html>`;
}
