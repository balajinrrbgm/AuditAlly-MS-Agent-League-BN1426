// Shared domain types for AuditAlly.
// All data is synthetic; these types model compliance controls, evidence,
// readiness scoring, grounded citations, and remediation tasks.

export type Framework = "SOC2" | "ISO27001" | "GDPR";
export type Severity = "high" | "medium" | "low";
export type EvidenceStatus = "collected" | "stale" | "expired" | "missing";

export interface Control {
  id: string;
  framework: Framework;
  code: string;
  title: string;
  category: string;
  severity: Severity;
  ownerRole: string;
  description: string;
  requiredEvidence: string[];
  policyDoc: string;
}

export interface Evidence {
  id: string;
  controlId: string;
  type: string;
  title: string;
  status: EvidenceStatus;
  source: string;
  owner: string;
  collectedDate: string | null;
  expiresDate: string | null;
  link: string | null;
}

export interface Finding {
  id: string;
  controlId: string;
  framework: Framework;
  severity: Severity;
  title: string;
  status: "open" | "closed";
  raisedDate: string;
  auditor: string;
  recommendation: string;
}

export interface RemediationTask {
  id: string;
  controlId: string;
  title: string;
  description: string;
  ownerRole: string;
  severity: Severity;
  dueDate: string;
  status: "open" | "in-progress" | "done";
  createdBy: string;
  createdAt: string;
  source: "AuditAlly";
}

/** A grounded, cited snippet returned by the Foundry IQ retrieval layer. */
export interface Citation {
  docId: string;
  title: string;
  section: string;
  snippet: string;
  score: number;
  source: string;
}

export interface GroundedAnswer {
  answer: string;
  citations: Citation[];
  grounded: boolean;
}

/** Per-control readiness computed by the domain engine. */
export interface ControlReadiness {
  control: Control;
  covered: Evidence[];
  gaps: { type: string; reason: EvidenceStatus }[];
  status: "ready" | "partial" | "gap";
  score: number; // 0..1
}

export interface FrameworkReadiness {
  framework: Framework;
  score: number; // 0..100
  band: "audit-ready" | "approaching" | "at-risk";
  controlsTotal: number;
  controlsReady: number;
  controlsPartial: number;
  controlsGap: number;
}

export interface ReadinessReport {
  generatedAt: string;
  overallScore: number; // 0..100
  band: "audit-ready" | "approaching" | "at-risk";
  byFramework: FrameworkReadiness[];
  controls: ControlReadiness[];
  topGaps: ControlReadiness[];
}
