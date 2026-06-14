// Responsible-AI and security guardrails for AuditAlly.
// - Screens inbound free-text for prompt-injection / unsafe asks.
// - Validates write payloads so the agent cannot persist PII or secrets.
// - Provides a transparency banner the agent appends to actionable answers.

export class SafetyError extends Error {
  constructor(
    message: string,
    public readonly code: "injection" | "pii" | "secret" | "scope" | "invalid",
  ) {
    super(message);
    this.name = "SafetyError";
  }
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|previous|prior) instructions/i,
  /disregard (the )?(system|safety) (prompt|rules)/i,
  /reveal (your )?(system prompt|instructions|secrets|api key)/i,
  /print (the )?(env|environment|secrets|tokens)/i,
  /\bexfiltrat/i,
];

// Lightweight detectors. Intentionally conservative — block obvious leaks of
// real secrets/PII into the synthetic store.
const SECRET_PATTERNS: RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/, // AWS key id
  /\bsk-[A-Za-z0-9]{20,}\b/, // generic API key
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
];

const PII_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/, // US SSN
  /\b\d{16}\b/, // bare 16-digit card-like number
  /\b[A-Za-z0-9._%+-]+@(?!contoso\.com)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // external email
];

export function screenRequest(text: string): void {
  const value = (text ?? "").trim();
  if (!value) return;
  for (const re of INJECTION_PATTERNS) {
    if (re.test(value)) {
      throw new SafetyError(
        "Request blocked: it looks like a prompt-injection or instruction-override attempt.",
        "injection",
      );
    }
  }
}

/** Validate a free-text field that will be persisted by a write tool. */
export function screenWritePayload(text: string): void {
  const value = (text ?? "").trim();
  if (!value) throw new SafetyError("Empty content is not allowed.", "invalid");
  for (const re of SECRET_PATTERNS) {
    if (re.test(value)) {
      throw new SafetyError(
        "Write blocked: the content appears to contain a secret or credential. Remove it and retry.",
        "secret",
      );
    }
  }
  for (const re of PII_PATTERNS) {
    if (re.test(value)) {
      throw new SafetyError(
        "Write blocked: the content appears to contain PII. AuditAlly stores controls and evidence references only — never personal data.",
        "pii",
      );
    }
  }
}

export const TRANSPARENCY_NOTE =
  "AuditAlly is an AI assistant. Answers are grounded in your policy library with citations; " +
  "verify before relying on them for a formal audit. All sample data here is synthetic.";
