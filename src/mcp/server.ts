// Builds the AuditAlly MCP server and registers all tools + UI resources.
// Used by both transports: stdio (for the Declarative Agent / Copilot) and
// streamable HTTP (for OAuth-secured remote access).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "./oauth.js";
import { requireScope } from "./oauth.js";
import { capabilityReport, config } from "../shared/config.js";
import * as tools from "./tools.js";
import type { ToolResult } from "./tools.js";

type TextContent = { type: "text"; text: string };
type ResourceContent = {
  type: "resource";
  resource: { uri: string; mimeType: string; text: string };
};

function toMcp(r: ToolResult) {
  const content: Array<TextContent | ResourceContent> = [{ type: "text", text: r.text }];
  if (r.uiHtml && r.uiUri) {
    content.push({
      type: "resource",
      resource: { uri: r.uiUri, mimeType: "text/html", text: r.uiHtml },
    });
  }
  return { content, structuredContent: r.structured };
}

/**
 * @param auth  Present in HTTP mode (carries OAuth scopes). Absent in stdio
 *              mode (local, trusted). Write tools enforce AuditAlly.Write.
 */
export function createServer(auth?: AuthContext): McpServer {
  const server = new McpServer(
    { name: "auditally", version: "1.0.0" },
    {
      instructions:
        "AuditAlly surfaces enterprise audit & compliance readiness. Use get_readiness_report " +
        "for an overview, get_control for detail, ask_policy for grounded answers, and the write " +
        "tools to create/track remediation. All sample data is synthetic.",
    },
  );

  const enforceWrite = () => {
    if (auth) requireScope(auth, "AuditAlly.Write");
  };

  server.registerTool(
    "get_readiness_report",
    {
      title: "Get audit readiness report",
      description:
        "Overall and per-framework audit readiness (SOC2/ISO27001/GDPR) with top gaps. Renders the Compliance Cockpit.",
      inputSchema: tools.schemas.get_readiness_report,
    },
    async (args) => toMcp(tools.getReadinessReport(args)),
  );

  server.registerTool(
    "list_controls",
    {
      title: "List compliance controls",
      description: "List controls, optionally filtered by framework.",
      inputSchema: tools.schemas.list_controls,
    },
    async (args) => toMcp(tools.listControls(args)),
  );

  server.registerTool(
    "get_control",
    {
      title: "Get control detail",
      description:
        "Detail for one control: required evidence, coverage status, and grounded policy citations.",
      inputSchema: tools.schemas.get_control,
    },
    async (args) => toMcp(tools.getControl(args)),
  );

  server.registerTool(
    "ask_policy",
    {
      title: "Ask a policy question (grounded)",
      description:
        "Answer a compliance/policy question grounded in the approved policy library with citations (Foundry IQ).",
      inputSchema: tools.schemas.ask_policy,
    },
    async (args) => toMcp(await tools.askPolicy(args)),
  );

  server.registerTool(
    "list_findings",
    {
      title: "List open audit findings",
      description: "List open findings from prior audits with their recommendations.",
      inputSchema: tools.schemas.list_findings,
    },
    async () => toMcp(tools.listFindings()),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List remediation tasks",
      description: "List remediation tasks AuditAlly has created.",
      inputSchema: tools.schemas.list_tasks,
    },
    async () => toMcp(tools.listTasks()),
  );

  server.registerTool(
    "create_remediation_task",
    {
      title: "Create remediation task (write)",
      description:
        "Create remediation task(s) to close a control's evidence gaps. Requires AuditAlly.Write scope.",
      inputSchema: tools.schemas.create_remediation_task,
    },
    async (args) => {
      enforceWrite();
      return toMcp(tools.createRemediationTask(args, auth?.subject ?? "agent"));
    },
  );

  server.registerTool(
    "update_task_status",
    {
      title: "Update remediation task status (write)",
      description: "Update a remediation task's status. Requires AuditAlly.Write scope.",
      inputSchema: tools.schemas.update_task_status,
    },
    async (args) => {
      enforceWrite();
      return toMcp(tools.setTaskStatus(args));
    },
  );

  // Expose runtime capability/mode as a readable resource (transparency).
  server.registerResource(
    "capabilities",
    "auditally://capabilities",
    { title: "AuditAlly capabilities", description: "Current runtime mode and IQ wiring." },
    async () => ({
      contents: [
        {
          uri: "auditally://capabilities",
          mimeType: "application/json",
          text: JSON.stringify(capabilityReport(config), null, 2),
        },
      ],
    }),
  );

  return server;
}
