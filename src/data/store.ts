// Synthetic data loader + runtime task store.
// Reads the synthetic catalogs from /data and persists agent-created
// remediation tasks to /data/runtime/tasks.json (the "write" path).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Control, Evidence, Finding, RemediationTask } from "../shared/types.js";

const DATA_DIR = resolve(process.cwd(), "data");
const SYNTH_DIR = join(DATA_DIR, "synthetic");
const POLICY_DIR = join(SYNTH_DIR, "policies");
const RUNTIME_DIR = join(DATA_DIR, "runtime");
const TASKS_FILE = join(RUNTIME_DIR, "tasks.json");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function loadControls(): Control[] {
  return readJson<{ controls: Control[] }>(join(SYNTH_DIR, "controls.json")).controls;
}

export function loadEvidence(): Evidence[] {
  return readJson<{ evidence: Evidence[] }>(join(SYNTH_DIR, "evidence.json")).evidence;
}

export function loadFindings(): Finding[] {
  return readJson<{ findings: Finding[] }>(join(SYNTH_DIR, "audit_findings.json")).findings;
}

export interface PolicyDoc {
  id: string;
  title: string;
  text: string;
}

export function loadPolicyDocs(): PolicyDoc[] {
  if (!existsSync(POLICY_DIR)) return [];
  return readdirSync(POLICY_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const text = readFileSync(join(POLICY_DIR, file), "utf-8");
      const firstHeading = text.split("\n").find((l) => l.startsWith("# "));
      const title = firstHeading ? firstHeading.replace(/^#\s*/, "").trim() : file;
      return { id: file, title, text };
    });
}

// ── Runtime task store (the write path) ─────────────────────────────────────

function ensureRuntime(): void {
  if (!existsSync(RUNTIME_DIR)) mkdirSync(RUNTIME_DIR, { recursive: true });
  if (!existsSync(TASKS_FILE)) writeFileSync(TASKS_FILE, JSON.stringify({ tasks: [] }, null, 2));
}

export function loadTasks(): RemediationTask[] {
  ensureRuntime();
  return readJson<{ tasks: RemediationTask[] }>(TASKS_FILE).tasks;
}

export function saveTask(task: RemediationTask): RemediationTask {
  ensureRuntime();
  const tasks = loadTasks();
  tasks.push(task);
  writeFileSync(TASKS_FILE, JSON.stringify({ tasks }, null, 2));
  return task;
}

export function updateTaskStatus(
  id: string,
  status: RemediationTask["status"],
): RemediationTask | null {
  ensureRuntime();
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx].status = status;
  writeFileSync(TASKS_FILE, JSON.stringify({ tasks }, null, 2));
  return tasks[idx];
}
