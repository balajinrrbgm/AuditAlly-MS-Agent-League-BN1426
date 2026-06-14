// Runtime configuration + capability detection.
// AuditAlly is OFFLINE-FIRST: with zero env vars it runs deterministically on
// synthetic data. Setting Azure / Entra env vars transparently upgrades to live
// Foundry IQ retrieval and real OAuth token validation.

export interface AppConfig {
  port: number;
  publicBaseUrl: string;
  entra: {
    tenantId: string;
    clientId: string;
    audience: string;
    requiredScopes: string[];
    enabled: boolean;
  };
  search: {
    endpoint: string;
    apiKey: string;
    index: string;
    enabled: boolean;
  };
  openai: {
    endpoint: string;
    apiKey: string;
    deployment: string;
    enabled: boolean;
  };
}

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export function loadConfig(): AppConfig {
  const tenantId = env("ENTRA_TENANT_ID");
  const clientId = env("ENTRA_CLIENT_ID");
  const audience = env("ENTRA_AUDIENCE", clientId);
  const searchEndpoint = env("AZURE_SEARCH_ENDPOINT");
  const searchKey = env("AZURE_SEARCH_API_KEY");
  const openaiEndpoint = env("AZURE_OPENAI_ENDPOINT");
  const openaiKey = env("AZURE_OPENAI_API_KEY");

  const port = Number(env("PORT", "8787"));
  return {
    port,
    publicBaseUrl: env("PUBLIC_BASE_URL", `http://localhost:${port}`),
    entra: {
      tenantId,
      clientId,
      audience,
      requiredScopes: env("ENTRA_REQUIRED_SCOPES", "AuditAlly.Read,AuditAlly.Write")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      enabled: Boolean(tenantId && clientId),
    },
    search: {
      endpoint: searchEndpoint,
      apiKey: searchKey,
      index: env("AZURE_SEARCH_INDEX", "auditally-knowledge"),
      enabled: Boolean(searchEndpoint && searchKey),
    },
    openai: {
      endpoint: openaiEndpoint,
      apiKey: openaiKey,
      deployment: env("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini"),
      enabled: Boolean(openaiEndpoint && openaiKey),
    },
  };
}

export interface CapabilityReport {
  mode: "offline" | "hybrid" | "live";
  foundryIQ: "offline-index" | "azure-ai-search";
  auth: "dev-token" | "entra-oauth";
  answerSynthesis: "deterministic" | "azure-openai";
}

export function capabilityReport(cfg: AppConfig): CapabilityReport {
  const live = cfg.search.enabled && cfg.entra.enabled;
  const anyLive = cfg.search.enabled || cfg.entra.enabled || cfg.openai.enabled;
  return {
    mode: live ? "live" : anyLive ? "hybrid" : "offline",
    foundryIQ: cfg.search.enabled ? "azure-ai-search" : "offline-index",
    auth: cfg.entra.enabled ? "entra-oauth" : "dev-token",
    answerSynthesis: cfg.openai.enabled ? "azure-openai" : "deterministic",
  };
}

export const config = loadConfig();
