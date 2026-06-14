# Evaluation — mapping to the Battle #3 judging rubric

Judges should be able to verify each item from this repository alone. Every claim below points to
concrete files and runnable commands. **All data is synthetic.**

## Required (must pass both)

### 1. Microsoft 365 Copilot Chat agent ✅
- **Evidence:** `appPackage/declarativeAgent.json` (declarative agent: name, description,
  instructions via `instruction.md`, conversation starters, action), `appPackage/manifest.json`
  (`copilotAgents.declarativeAgents`), `m365agents.yml` (ATK provision/publish lifecycle).
- **Notes:** Works with Copilot Free; no paid license required to demo. Sideload steps in
  `docs/COPILOT_USAGE.md`.

### 2. Microsoft IQ integration ✅ — Foundry IQ
- **Evidence:** `src/iq/foundryIQ.ts` — agentic retrieval with sub-query planning, BM25-lite scoring
  over the approved policy library, **cited** results; live **Azure AI Search** path when
  `AZURE_SEARCH_*` is set.
- **Verify:** `npm run verify` asserts the policy answer is *grounded* and *has citations*.

## Bonus (extra points)

### 3. MCP Apps 🌟
- **Evidence:** `src/mcp/mcpApps.ts` renders interactive HTML cards returned as `ui://` resources by
  the tools (`src/mcp/tools.ts`, `src/mcp/server.ts`): **Compliance Cockpit** gauge, **control
  detail** with citations, **task confirmation**. Cards post `mcp:action` messages to drive
  follow-up tool calls (e.g. the "Fix it" button).
- **See it:** `npm run serve` → http://localhost:8787 embeds the exact cards; or open `/ui/cockpit`.

### 4. External MCP server with read/write 🌟
- **Evidence:** Full MCP server (`src/mcp/server.ts`) over **stdio** (`src/mcp/stdio.ts`) and
  **streamable HTTP** (`src/mcp/http.ts`).
  - **Read:** `get_readiness_report`, `list_controls`, `get_control`, `ask_policy`,
    `list_findings`, `list_tasks`.
  - **Write:** `create_remediation_task`, `update_task_status` (persist to
    `data/runtime/tasks.json`).
- **Verify:** `npm run verify` creates a task and confirms it persisted.

### 5. OAuth security for the MCP server 🌟
- **Evidence:** `src/mcp/oauth.ts` — Microsoft Entra ID JWT validation (RS256 signature via tenant
  JWKS, issuer/audience/expiry checks) and **least-privilege scope** enforcement; write tools
  require `AuditAlly.Write`. HTTP transport is wrapped with the auth middleware and binds each MCP
  session to the caller's scopes. `GET /.well-known/oauth-protected-resource` advertises metadata.

## Additional strengths
- **Responsible AI** (`src/shared/safety.ts`): prompt-injection screening, PII/secret write-blocking,
  transparency notes. `npm run verify` asserts PII is blocked on writes.
- **Offline-first & reproducible:** zero keys required; deterministic scoring; `npm run verify`
  prints `ALL CHECKS PASSED`.
- **No secrets committed:** `.gitignore` + `.env.example` only.

## One-command proof
```powershell
cd AuditAlly && npm install && npm run verify
```
Expected: a walkthrough followed by `ALL CHECKS PASSED ✅`.
