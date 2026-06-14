// AuditAlly MCP tools — the read/write operations the Declarative Agent calls.
//
// READ tools: readiness report, controls, control detail (grounded), policy Q&A,
//             findings, tasks.
// WRITE tools: create remediation task, update task status.
// Visual tools return an embedded MCP App (`ui://`) HTML resource.

import { z } from "zod";
import { foundryIQ } from "../iq/foundryIQ.js";
import {
  buildReadinessReport,
  computeControlReadiness,
  openFindings,
  suggestRemediation,
} from "../domain/engine.js";
import { loadControls, loadEvidence, loadTasks, saveTask, updateTaskStatus } from "../data/store.js";
import { renderCockpit, renderControlDetail, renderTaskConfirmation } from "./mcpApps.js";
import { screenRequest, screenWritePayload, TRANSPARENCY_NOTE } from "../shared/safety.js";
import type { Framework, RemediationTask } from "../shared/types.js";

export interface ToolResult {
  text: string;
  structured: Record<string, unknown>;
  uiHtml?: string;
  uiUri?: string;
}

const FRAMEWORKS = ["SOC2", "ISO27001", "GDPR"] as const;

// ── Schemas (exported so the server can register them) ──────────────────────
export const schemas = {
  get_readiness_report: { framework: z.enum(FRAMEWORKS).optional() },
  list_controls: { framework: z.enum(FRAMEWORKS).optional() },
  get_control: { controlId: z.string().describe("Control id, e.g. CTL-004") },
  ask_policy: { question: z.string().min(3).describe("A compliance/policy question") },
  list_findings: {},
  create_remediation_task: { controlId: z.string().describe("Control id with gaps, e.g. CTL-004") },
  update_task_status: {
    taskId: z.string(),
    status: z.enum(["open", "in-progress", "done"]),
  },
  list_tasks: {},
};

function nextTaskId(): string {
  const n = loadTasks().length + 1;
  return `TSK-${String(n).padStart(4, "0")}`;
}

// ── READ tools ───────────────────────────────────────────────────────────────

export function getReadinessReport(args: { framework?: Framework }): ToolResult {
  const report = buildReadinessReport(args.framework);
  const scope = args.framework ? `${args.framework} ` : "";
  const text =
    `${scope}audit readiness: **${report.overallScore}% (${report.band})**. ` +
    report.byFramework.map((f) => `${f.framework} ${f.score}%`).join(", ") +
    `. Top gaps: ${report.topGaps.slice(0, 3).map((g) => g.control.code).join(", ") || "none"}.`;
  return {
    text,
    structured: report as unknown as Record<string, unknown>,
    uiHtml: renderCockpit(report),
    uiUri: "ui://auditally/cockpit",
  };
}

export function listControls(args: { framework?: Framework }): ToolResult {
  const controls = loadControls().filter((c) => !args.framework || c.framework === args.framework);
  const text = controls
    .map((c) => `- ${c.code} (${c.framework}) — ${c.title} [${c.severity}]`)
    .join("\n");
  return { text, structured: { count: controls.length, controls } };
}

export function getControl(args: { controlId: string }): ToolResult {
  const control = loadControls().find(
    (c) => c.id.toLowerCase() === args.controlId.toLowerCase() ||
      c.code.toLowerCase() === args.controlId.toLowerCase(),
  );
  if (!control) {
    return { text: `No control found for "${args.controlId}".`, structured: { found: false } };
  }
  const readiness = computeControlReadiness(control, loadEvidence());
  const citations = foundryIQ.retrieve(`${control.title} ${control.description}`, 2);
  const text =
    `${control.code} — ${control.title} (${control.framework}). Status: ${readiness.status} ` +
    `(${Math.round(readiness.score * 100)}% covered). Owner: ${control.ownerRole}.`;
  return {
    text,
    structured: { control, readiness, citations },
    uiHtml: renderControlDetail(readiness, citations),
    uiUri: `ui://auditally/control/${control.id}`,
  };
}

export async function askPolicy(args: { question: string }): Promise<ToolResult> {
  screenRequest(args.question);
  const result = await foundryIQ.answer(args.question);
  const citeText = result.citations
    .map((c, i) => `[${i + 1}] ${c.title} › ${c.section}`)
    .join("\n");
  const text =
    `${result.answer}\n\n${result.grounded ? "Sources:\n" + citeText : ""}\n\n_${TRANSPARENCY_NOTE}_`;
  return { text: text.trim(), structured: result as unknown as Record<string, unknown> };
}

export function listFindings(): ToolResult {
  const findings = openFindings();
  const text = findings
    .map((f) => `- ${f.id} [${f.severity}] ${f.title} (control ${f.controlId})`)
    .join("\n");
  return { text: text || "No open findings.", structured: { count: findings.length, findings } };
}

export function listTasks(): ToolResult {
  const tasks = loadTasks();
  const text =
    tasks.map((t) => `- ${t.id} [${t.status}] ${t.title} (due ${t.dueDate})`).join("\n") ||
    "No remediation tasks yet.";
  return { text, structured: { count: tasks.length, tasks } };
}

// ── WRITE tools (require AuditAlly.Write scope, enforced at the server layer) ──

export function createRemediationTask(args: { controlId: string }, actor = "agent"): ToolResult {
  const suggestions = suggestRemediation(args.controlId);
  if (suggestions.length === 0) {
    return {
      text: `Control "${args.controlId}" has no open gaps — nothing to remediate. 🎉`,
      structured: { created: 0 },
    };
  }
  const created: RemediationTask[] = suggestions.map((s) => {
    screenWritePayload(`${s.title} ${s.description}`);
    return saveTask({
      ...s,
      id: nextTaskId(),
      createdBy: actor,
      createdAt: new Date().toISOString(),
      source: "AuditAlly",
    });
  });
  const text =
    `Created ${created.length} remediation task(s) for ${args.controlId}: ` +
    created.map((t) => `${t.id} (due ${t.dueDate})`).join(", ") + ".";
  return {
    text,
    structured: { created: created.length, tasks: created },
    uiHtml: renderTaskConfirmation(created),
    uiUri: "ui://auditally/tasks",
  };
}

export function setTaskStatus(args: {
  taskId: string;
  status: "open" | "in-progress" | "done";
}): ToolResult {
  const updated = updateTaskStatus(args.taskId, args.status);
  if (!updated) return { text: `Task "${args.taskId}" not found.`, structured: { updated: false } };
  return {
    text: `Task ${updated.id} is now "${updated.status}".`,
    structured: { updated: true, task: updated },
  };
}

/** Tools that perform writes — used by the server to enforce the Write scope. */
export const WRITE_TOOLS = new Set(["create_remediation_task", "update_task_status"]);
