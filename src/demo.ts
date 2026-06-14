// AuditAlly demo + verification harness.
//   npm run demo      → human-readable walkthrough
//   npm run verify    → deterministic assertions (exit 1 on failure)
//
// Exercises the full reasoning path offline: Foundry IQ grounding, readiness
// scoring, gap analysis, and the OAuth-gated write path — no server required.

import { capabilityReport, config } from "./shared/config.js";
import * as tools from "./mcp/tools.js";
import { SafetyError, screenWritePayload } from "./shared/safety.js";

const verify = process.argv.includes("--verify");
let failures = 0;

function check(name: string, cond: boolean) {
  const ok = Boolean(cond);
  if (!ok) failures++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}`);
}

function line() {
  console.log("─".repeat(64));
}

async function main() {
  line();
  console.log("🛡️  AuditAlly — Compliance Readiness Agent (demo)");
  line();
  const cap = capabilityReport(config);
  console.log(`Mode: ${cap.mode} · Foundry IQ: ${cap.foundryIQ} · Auth: ${cap.auth}`);
  console.log("(All data is synthetic.)\n");

  // 1) Overall readiness
  const report = tools.getReadinessReport({});
  console.log("1) Readiness report");
  console.log("   " + report.text + "\n");

  // 2) Grounded policy Q&A (Foundry IQ)
  const ask = await tools.askPolicy({ question: "How often must we run an IR tabletop exercise?" });
  console.log("2) Grounded policy Q&A");
  console.log("   " + ask.text.split("\n").join("\n   ") + "\n");

  // 3) Control detail with a real gap
  const ctl = tools.getControl({ controlId: "CTL-004" });
  console.log("3) Control detail (CTL-004)");
  console.log("   " + ctl.text + "\n");

  // 4) Write path — create remediation task (OAuth.Write enforced at server)
  const created = tools.createRemediationTask({ controlId: "CTL-004" }, "demo@contoso.com");
  console.log("4) Create remediation task");
  console.log("   " + created.text + "\n");

  // 5) List tasks
  const list = tools.listTasks();
  console.log("5) Remediation tasks");
  console.log("   " + list.text.split("\n").join("\n   ") + "\n");

  if (verify) {
    line();
    console.log("Verification");
    const r = report.structured as { overallScore: number; topGaps: unknown[] };
    check("readiness score in 0..100", r.overallScore >= 0 && r.overallScore <= 100);
    check("has top gaps", (r.topGaps as unknown[]).length > 0);

    const askS = ask.structured as { grounded: boolean; citations: unknown[] };
    check("policy answer is grounded", askS.grounded === true);
    check("policy answer has citations", (askS.citations as unknown[]).length > 0);

    const ctlS = ctl.structured as { readiness: { status: string } };
    check("CTL-004 detected as a gap", ctlS.readiness.status !== "ready");

    const cS = created.structured as { created: number };
    check("remediation task created", cS.created > 0);

    const tS = list.structured as { count: number };
    check("task persisted to store", tS.count > 0);

    let blocked = false;
    try {
      screenWritePayload("Contact john.doe@gmail.com SSN 123-45-6789");
    } catch (e) {
      blocked = e instanceof SafetyError && e.code === "pii";
    }
    check("safety blocks PII in writes", blocked);

    line();
    console.log(failures === 0 ? "ALL CHECKS PASSED ✅" : `${failures} CHECK(S) FAILED ❌`);
    process.exit(failures === 0 ? 0 : 1);
  }
  line();
  console.log("Tip: run `npm run serve` then open http://localhost:8787 for the studio.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
