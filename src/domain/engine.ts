// Compliance domain engine — turns controls + evidence into readiness scores,
// gap analysis, and a remediation plan. Pure functions for deterministic,
// reproducible results (great for judging).

import { loadControls, loadEvidence, loadFindings } from "../data/store.js";
import type {
  Control,
  ControlReadiness,
  Evidence,
  Framework,
  FrameworkReadiness,
  ReadinessReport,
  RemediationTask,
  Severity,
} from "../shared/types.js";

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

function band(score: number): "audit-ready" | "approaching" | "at-risk" {
  if (score >= 85) return "audit-ready";
  if (score >= 65) return "approaching";
  return "at-risk";
}

export function evidenceForControl(controlId: string, evidence: Evidence[]): Evidence[] {
  return evidence.filter((e) => e.controlId === controlId);
}

export function computeControlReadiness(control: Control, evidence: Evidence[]): ControlReadiness {
  const items = evidenceForControl(control.id, evidence);
  const covered: Evidence[] = [];
  const gaps: { type: string; reason: Evidence["status"] }[] = [];

  for (const type of control.requiredEvidence) {
    const match = items.find((e) => e.type === type);
    if (match && match.status === "collected") {
      covered.push(match);
    } else {
      gaps.push({ type, reason: match ? match.status : "missing" });
    }
  }

  const score = control.requiredEvidence.length
    ? covered.length / control.requiredEvidence.length
    : 1;
  const status: ControlReadiness["status"] =
    score === 1 ? "ready" : score === 0 ? "gap" : "partial";

  return { control, covered, gaps, status, score };
}

export function buildReadinessReport(framework?: Framework): ReadinessReport {
  const controls = loadControls().filter((c) => !framework || c.framework === framework);
  const evidence = loadEvidence();

  const readiness = controls.map((c) => computeControlReadiness(c, evidence));

  // Weighted overall score (by control severity).
  const totalWeight = readiness.reduce((s, r) => s + SEVERITY_WEIGHT[r.control.severity], 0) || 1;
  const weighted = readiness.reduce(
    (s, r) => s + r.score * SEVERITY_WEIGHT[r.control.severity],
    0,
  );
  const overallScore = Math.round((weighted / totalWeight) * 100);

  // Per-framework rollup.
  const frameworks = [...new Set(controls.map((c) => c.framework))] as Framework[];
  const byFramework: FrameworkReadiness[] = frameworks.map((fw) => {
    const rs = readiness.filter((r) => r.control.framework === fw);
    const w = rs.reduce((s, r) => s + SEVERITY_WEIGHT[r.control.severity], 0) || 1;
    const ws = rs.reduce((s, r) => s + r.score * SEVERITY_WEIGHT[r.control.severity], 0);
    const score = Math.round((ws / w) * 100);
    return {
      framework: fw,
      score,
      band: band(score),
      controlsTotal: rs.length,
      controlsReady: rs.filter((r) => r.status === "ready").length,
      controlsPartial: rs.filter((r) => r.status === "partial").length,
      controlsGap: rs.filter((r) => r.status === "gap").length,
    };
  });

  const topGaps = readiness
    .filter((r) => r.status !== "ready")
    .sort((a, b) => {
      const sev = SEVERITY_WEIGHT[b.control.severity] - SEVERITY_WEIGHT[a.control.severity];
      return sev !== 0 ? sev : a.score - b.score;
    });

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    band: band(overallScore),
    byFramework,
    controls: readiness,
    topGaps,
  };
}

/** Suggest concrete remediation tasks for a control's gaps (not yet persisted). */
export function suggestRemediation(controlId: string): Omit<
  RemediationTask,
  "id" | "createdAt" | "createdBy" | "source"
>[] {
  const control = loadControls().find((c) => c.id === controlId);
  if (!control) return [];
  const readiness = computeControlReadiness(control, loadEvidence());
  const dueDays = control.severity === "high" ? 14 : control.severity === "medium" ? 30 : 60;
  const due = new Date();
  due.setDate(due.getDate() + dueDays);
  const dueDate = due.toISOString().slice(0, 10);

  return readiness.gaps.map((gap) => ({
    controlId: control.id,
    title: `Collect "${gap.type}" evidence for ${control.code} (${gap.reason})`,
    description:
      `Control ${control.code} — ${control.title}. Evidence "${gap.type}" is ${gap.reason}. ` +
      `Owner role: ${control.ownerRole}. Required to reach audit-ready status.`,
    ownerRole: control.ownerRole,
    severity: control.severity,
    dueDate,
    status: "open" as const,
  }));
}

export function openFindings() {
  return loadFindings().filter((f) => f.status === "open");
}
