// OAuth 2.0 security for the AuditAlly MCP server.
//
// Bonus criterion (Battle #3): OAuth-secured MCP server consumption.
// - Offline/dev mode (no Entra env): accepts a static dev Bearer token so the
//   server is testable locally, and grants the configured scopes.
// - Live mode (ENTRA_* set): validates the incoming Microsoft Entra ID JWT —
//   RS256 signature via the tenant JWKS, plus issuer, audience, expiry, and
//   least-privilege scope checks. Dependency-free (uses node:crypto).

import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "../shared/config.js";

export const DEV_TOKEN = "dev-token-auditally";

export interface AuthContext {
  subject: string;
  scopes: string[];
  mode: "dev-token" | "entra-oauth";
}

interface Jwk extends JsonWebKey {
  kid?: string;
  x5c?: string[];
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

async function getJwks(tenantId: string): Promise<Jwk[]> {
  const ttl = 60 * 60 * 1000; // 1 hour
  if (jwksCache && Date.now() - jwksCache.fetchedAt < ttl) return jwksCache.keys;
  const url = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

function b64urlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function decodeSegment<T>(seg: string): T {
  return JSON.parse(b64urlToBuffer(seg).toString("utf-8")) as T;
}

interface EntraClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  scp?: string;
  roles?: string[];
}

async function verifyEntraJwt(token: string): Promise<AuthContext> {
  const [headerB64, payloadB64, sigB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error("Malformed JWT");

  const header = decodeSegment<{ kid?: string; alg?: string }>(headerB64);
  if (header.alg !== "RS256") throw new Error("Unsupported alg");

  const keys = await getJwks(config.entra.tenantId);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Signing key not found");

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = b64urlToBuffer(sigB64);
  const ok = cryptoVerify("RSA-SHA256", signingInput, publicKey, signature);
  if (!ok) throw new Error("Invalid signature");

  const claims = decodeSegment<EntraClaims>(payloadB64);
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) throw new Error("Token expired");
  if (claims.aud && config.entra.audience && claims.aud !== config.entra.audience) {
    throw new Error("Audience mismatch");
  }
  if (claims.iss && !claims.iss.includes(config.entra.tenantId)) {
    throw new Error("Issuer mismatch");
  }

  const scopes = [...(claims.scp ? claims.scp.split(" ") : []), ...(claims.roles ?? [])];
  return { subject: claims.sub ?? "unknown", scopes, mode: "entra-oauth" };
}

/** Verify a raw Authorization header value ("Bearer <token>"). */
export async function verifyBearer(authHeader?: string): Promise<AuthContext> {
  const token = (authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");

  if (!config.entra.enabled) {
    if (token !== DEV_TOKEN) throw new Error("Invalid dev token");
    return { subject: "dev@contoso.com", scopes: config.entra.requiredScopes, mode: "dev-token" };
  }
  return verifyEntraJwt(token);
}

export function requireScope(auth: AuthContext, scope: string): void {
  const has = auth.scopes.some((s) => s === scope || s.endsWith(`/${scope}`));
  if (!has) {
    const err = new Error(`Insufficient scope. Required: ${scope}`);
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

/** Express middleware that attaches req.auth or returns 401/403. */
export function authMiddleware() {
  return async (req: Request & { auth?: AuthContext }, res: Response, next: NextFunction) => {
    try {
      req.auth = await verifyBearer(req.header("authorization"));
      next();
    } catch (err) {
      res.status(401).json({
        error: "unauthorized",
        message: (err as Error).message,
        hint: config.entra.enabled
          ? "Provide a valid Microsoft Entra ID Bearer token."
          : `Dev mode: send "Authorization: Bearer ${DEV_TOKEN}".`,
      });
    }
  };
}
