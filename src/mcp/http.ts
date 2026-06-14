// Streamable HTTP transport + OAuth + local demo API/UI host.
//
// - POST/GET/DELETE /mcp        OAuth-secured MCP endpoint (per-session server
//                               bound to the caller's Entra scopes).
// - /.well-known/...            OAuth protected-resource metadata.
// - /api/*                      JSON endpoints powering the local demo studio.
// - /ui/*                       Raw MCP App HTML cards (for iframe preview).
// - /                           Static demo studio (public/).

import express from "express";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "./server.js";
import { authMiddleware, type AuthContext } from "./oauth.js";
import { config, capabilityReport } from "../shared/config.js";
import * as tools from "./tools.js";
import { buildReadinessReport, computeControlReadiness } from "../domain/engine.js";
import { loadControls, loadEvidence } from "../data/store.js";
import { renderCockpit, renderControlDetail, renderTaskConfirmation } from "./mcpApps.js";
import { foundryIQ } from "../iq/foundryIQ.js";
import type { Framework } from "../shared/types.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

// ── OAuth protected-resource metadata (RFC 9728) ────────────────────────────
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: config.publicBaseUrl,
    authorization_servers: config.entra.enabled
      ? [`https://login.microsoftonline.com/${config.entra.tenantId}/v2.0`]
      : [],
    scopes_supported: config.entra.requiredScopes,
    bearer_methods_supported: ["header"],
  });
});

// ── Streamable HTTP MCP endpoint (OAuth-secured) ────────────────────────────
const transports: Record<string, StreamableHTTPServerTransport> = {};

app.post("/mcp", authMiddleware(), async (req: express.Request & { auth?: AuthContext }, res) => {
  const sid = req.header("mcp-session-id");
  let transport = sid ? transports[sid] : undefined;

  if (!transport && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports[id] = transport!;
      },
    });
    transport.onclose = () => {
      if (transport!.sessionId) delete transports[transport!.sessionId];
    };
    const server = createServer(req.auth); // bind this session to the caller's scopes
    await server.connect(transport);
  } else if (!transport) {
    res.status(400).json({ error: "invalid_session", message: "No valid MCP session." });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await transport.handleRequest(req as any, res, req.body);
});

const sessionStream = async (req: express.Request, res: express.Response) => {
  const sid = req.header("mcp-session-id");
  const transport = sid ? transports[sid] : undefined;
  if (!transport) {
    res.status(400).send("Invalid or missing session id");
    return;
  }
  await transport.handleRequest(req, res);
};
app.get("/mcp", authMiddleware(), sessionStream);
app.delete("/mcp", authMiddleware(), sessionStream);

// ── Demo JSON API (local studio; open for easy preview) ─────────────────────
app.get("/api/capabilities", (_req, res) => res.json(capabilityReport(config)));

app.get("/api/readiness", (req, res) => {
  const fw = req.query.framework as Framework | undefined;
  res.json(buildReadinessReport(fw));
});

app.get("/api/control/:id", (req, res) => {
  const control = loadControls().find(
    (c) => c.id.toLowerCase() === req.params.id.toLowerCase(),
  );
  if (!control) return res.status(404).json({ error: "not_found" });
  const readiness = computeControlReadiness(control, loadEvidence());
  const citations = foundryIQ.retrieve(`${control.title} ${control.description}`, 2);
  res.json({ control, readiness, citations });
});

app.post("/api/ask", async (req, res) => {
  try {
    res.json((await tools.askPolicy({ question: String(req.body?.question ?? "") })).structured);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/findings", (_req, res) => res.json(tools.listFindings().structured));
app.get("/api/tasks", (_req, res) => res.json(tools.listTasks().structured));
app.post("/api/tasks", (req, res) => {
  try {
    res.json(tools.createRemediationTask({ controlId: String(req.body?.controlId ?? "") }).structured);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ── Raw MCP App cards (exactly what Copilot renders) ────────────────────────
app.get("/ui/cockpit", (req, res) => {
  res.type("html").send(renderCockpit(buildReadinessReport(req.query.framework as Framework)));
});
app.get("/ui/control/:id", (req, res) => {
  const control = loadControls().find((c) => c.id.toLowerCase() === req.params.id.toLowerCase());
  if (!control) return res.status(404).send("Not found");
  const readiness = computeControlReadiness(control, loadEvidence());
  const citations = foundryIQ.retrieve(`${control.title} ${control.description}`, 2);
  res.type("html").send(renderControlDetail(readiness, citations));
});
app.get("/ui/tasks", (_req, res) => {
  res.type("html").send(renderTaskConfirmation(tools.listTasks().structured.tasks as never));
});

// ── Static demo studio ──────────────────────────────────────────────────────
app.use(express.static(resolve(process.cwd(), "public")));

app.listen(config.port, () => {
  const cap = capabilityReport(config);
  console.log(`AuditAlly HTTP server: http://localhost:${config.port}`);
  console.log(`  mode=${cap.mode} foundryIQ=${cap.foundryIQ} auth=${cap.auth}`);
  console.log(`  MCP endpoint: http://localhost:${config.port}/mcp`);
  console.log(`  Demo studio:  http://localhost:${config.port}/`);
});
