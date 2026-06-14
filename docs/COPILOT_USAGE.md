# Using AuditAlly with Microsoft 365 Copilot, VS Code & GitHub Copilot

## A. Local demo (no tenant, no keys)
```powershell
cd AuditAlly
npm install
npm run icons
npm run serve      # http://localhost:8787
```
The studio previews the **exact MCP App cards** Copilot renders, plus grounded Q&A and the
OAuth-secured write path.

## B. Connect the MCP server to GitHub Copilot in VS Code
`.vscode/mcp.json` is included:
```jsonc
{
  "servers": {
    "auditally": { "type": "stdio", "command": "npx", "args": ["tsx", "src/mcp/stdio.ts"], "cwd": "${workspaceFolder}/AuditAlly" }
  }
}
```
1. Open the **AuditAlly** folder in VS Code.
2. Open the MCP servers view → **Start** the `auditally` server (or run `npm run mcp`).
3. In Copilot Chat (Agent mode), try:
   - *"Use auditally to show our audit readiness."*
   - *"Ask auditally how often we must run an IR tabletop."*
   - *"Create remediation tasks for CTL-004 with auditally."*

## C. Sideload the declarative agent into Microsoft 365 Copilot (ATK)
**Prerequisites:** VS Code + **Microsoft 365 Agents Toolkit (ATK)**, a Microsoft 365 tenant with
custom-app sideloading enabled, and (for live OAuth) an Azure subscription.

1. Generate icons + package: `npm run icons` then `npm run package`
   (or let ATK build via `m365agents.yml`).
2. In VS Code, open the **Microsoft 365 Agents Toolkit** panel → **Provision** (creates the Entra
   app + OAuth registration via `m365agents.yml`).
3. **Publish / Preview** → AuditAlly appears in Microsoft 365 Copilot Chat.
4. Use the conversation starters defined in `appPackage/declarativeAgent.json`.

### Live mode (optional)
Copy `.env.example` → `.env` and set:
- `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_AUDIENCE` → real OAuth token validation.
- `AZURE_SEARCH_*` → live Foundry IQ grounding via Azure AI Search.
- `AZURE_OPENAI_*` → live answer synthesis.

The server auto-detects these and reports the active mode at startup and via
`auditally://capabilities`.

## D. Calling the OAuth-secured HTTP MCP endpoint
```powershell
npm run serve
# In offline/dev mode, the static dev token is accepted:
#   Authorization: Bearer dev-token-auditally
# When ENTRA_* is configured, send a real Entra ID access token instead.
```
- `POST /mcp` — MCP initialize + tool calls (session via `mcp-session-id`).
- Write tools (`create_remediation_task`, `update_task_status`) require the `AuditAlly.Write` scope.
- `GET /.well-known/oauth-protected-resource` — OAuth resource metadata.

## Example prompts
- "Are we audit-ready for SOC 2?"
- "What's our weakest framework and the top 3 gaps?"
- "Explain control CTL-010 and cite the policy."
- "Create remediation tasks to close CTL-004, then list all open tasks."
