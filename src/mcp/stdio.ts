// stdio transport entry point.
// This is what the Declarative Agent / Microsoft 365 Copilot launches locally,
// and what the VS Code MCP client (.vscode/mcp.json) connects to.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const server = createServer(); // stdio = local, trusted
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs go to stderr so they don't corrupt the stdio JSON-RPC stream.
  console.error("AuditAlly MCP server running on stdio.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
