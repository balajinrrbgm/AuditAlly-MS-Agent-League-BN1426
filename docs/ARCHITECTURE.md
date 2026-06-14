# AuditAlly — Architecture

AuditAlly is a Microsoft 365 Copilot **declarative agent** backed by an **OAuth-secured MCP server**.
It is **offline-first**: with zero environment variables it runs deterministically on synthetic data,
and it upgrades transparently to live Azure services when configured.

## Components

| Layer | Module | Responsibility |
| --- | --- | --- |
| Agent surface | `appPackage/declarativeAgent.json` | Instructions, conversation starters, action wiring (the Copilot Chat agent). |
| Action bridge | `appPackage/aiPlugin.json` + `apiSpecificationFile/openapi.json` | API plugin so Copilot can call AuditAlly operations with OAuth. |
| MCP server | `src/mcp/server.ts` | Registers tools + a capabilities resource; returns MCP App UI resources. |
| Tools | `src/mcp/tools.ts` | Read tools (readiness, controls, policy Q&A, findings, tasks) and write tools (create/update tasks). |
| MCP Apps | `src/mcp/mcpApps.ts` | Interactive HTML cards (`ui://`) rendered inline in Copilot. |
| OAuth | `src/mcp/oauth.ts` | Dev-token mode + live Entra JWT validation (RS256/JWKS) + scope checks. |
| Transports | `src/mcp/stdio.ts`, `src/mcp/http.ts` | stdio (Copilot/VS Code) and streamable HTTP (remote, OAuth). |
| Foundry IQ | `src/iq/foundryIQ.ts` | Grounded, cited agentic retrieval — offline BM25-lite + live Azure AI Search. |
| Domain engine | `src/domain/engine.ts` | Readiness scoring, gap analysis, remediation suggestions (pure functions). |
| Data | `src/data/store.ts` | Loads synthetic catalogs; persists agent-written tasks. |
| Safety | `src/shared/safety.ts` | Prompt-injection screening, PII/secret write-blocking, transparency. |

## Request flow (read)
1. User asks a question in Copilot Chat.
2. The declarative agent picks an action → MCP tool (`get_readiness_report`, `get_control`, `ask_policy`, …).
3. HTTP transport validates the **OAuth** bearer token and scopes; binds the session to the caller.
4. The tool runs the **domain engine** and/or **Foundry IQ** to produce a grounded result.
5. The tool returns a text summary **plus an `ui://` MCP App resource** → Copilot renders the card.

## Request flow (write)
1. User clicks **Fix it** on a gap (or asks to remediate).
2. `create_remediation_task` first enforces the **`AuditAlly.Write`** scope.
3. The engine derives concrete tasks from the control's gaps; **safety** screens each payload for PII/secrets.
4. Tasks persist to `data/runtime/tasks.json`; a confirmation card is returned.

## Readiness scoring
- Per control: `score = collectedRequiredEvidence / requiredEvidence` → `ready | partial | gap`.
- Overall &amp; per-framework: **severity-weighted** average (high=3, medium=2, low=1) × 100.
- Bands: `audit-ready ≥ 85`, `approaching ≥ 65`, else `at-risk`.
- Deterministic and pure → reproducible scores for judging.

## Offline → live upgrade
| Capability | Offline (default) | Live (env set) |
| --- | --- | --- |
| Grounding | BM25-lite over `data/synthetic/policies` | Azure AI Search (`AZURE_SEARCH_*`) |
| Auth | static dev token | Microsoft Entra ID OAuth (`ENTRA_*`) |
| Synthesis | deterministic | Azure OpenAI (`AZURE_OPENAI_*`) |

`src/shared/config.ts#capabilityReport` reports the active mode; the studio header and the
`auditally://capabilities` MCP resource surface it.
