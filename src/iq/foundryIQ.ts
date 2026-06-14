// Foundry IQ — grounded, cited agentic retrieval.
//
// REQUIRED Microsoft IQ integration for the Enterprise Agents track.
// Offline-first: builds a BM25-lite index over the synthetic policy library and
// answers with citations. When AZURE_SEARCH_* is configured it transparently
// upgrades to live Azure AI Search agentic retrieval (the production Foundry IQ
// path) and falls back to the offline index if the live call fails.

import { config } from "../shared/config.js";
import { loadPolicyDocs } from "../data/store.js";
import type { Citation, GroundedAnswer } from "../shared/types.js";

interface Chunk {
  docId: string;
  title: string;
  section: string;
  text: string;
  source: string;
  terms: Map<string, number>;
}

const STOPWORDS = new Set(
  "a an the and or of to in for on with is are be by as at from this that all any per least".split(" "),
);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t),
  );
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Split a policy doc into heading-delimited sections for precise citation. */
function chunkDoc(docId: string, title: string, text: string): Chunk[] {
  const lines = text.split(/\r?\n/);
  const chunks: Chunk[] = [];
  let section = "";
  let started = false; // skip front-matter (title + metadata) before first H2/H3
  let buffer: string[] = [];
  const flush = () => {
    const body = buffer.join("\n").trim();
    if (started && body) {
      chunks.push({
        docId,
        title,
        section,
        text: body,
        source: "Policy Library (SharePoint)",
        terms: termFreq(tokenize(`${section} ${body}`)),
      });
    }
    buffer = [];
  };
  for (const line of lines) {
    const m = line.match(/^#{2,3}\s+(.*)$/);
    if (m) {
      flush();
      started = true;
      section = m[1].replace(/^[0-9.]+\s*/, "").trim();
    } else if (started) {
      buffer.push(line);
    }
  }
  flush();
  return chunks;
}

export class FoundryIQ {
  private chunks: Chunk[] = [];
  private idf = new Map<string, number>();

  constructor() {
    this.buildIndex();
  }

  private buildIndex(): void {
    const docs = loadPolicyDocs();
    this.chunks = docs.flatMap((d) => chunkDoc(d.id, d.title, d.text));
    const df = new Map<string, number>();
    for (const c of this.chunks) {
      for (const term of c.terms.keys()) df.set(term, (df.get(term) ?? 0) + 1);
    }
    const N = this.chunks.length || 1;
    for (const [term, count] of df) {
      this.idf.set(term, Math.log(1 + N / count));
    }
  }

  /** Agentic sub-query planning: expand the question into focused sub-queries. */
  private planSubQueries(query: string): string[] {
    const base = query.trim();
    const tokens = tokenize(query);
    const expansions: string[] = [];
    const synonyms: Record<string, string> = {
      mfa: "multi-factor authentication conditional access",
      access: "least privilege access review",
      breach: "breach notification 72 hours incident",
      backup: "backup restore continuity recovery",
      vendor: "vendor cloud supplier assessment",
      vulnerability: "vulnerability scan patch remediation",
      training: "security awareness training phishing",
      privacy: "personal data gdpr ropa dpia encryption",
      change: "change management approval rollback",
      incident: "incident response tabletop monitoring",
    };
    for (const t of tokens) if (synonyms[t]) expansions.push(synonyms[t]);
    return [base, ...expansions].slice(0, 4);
  }

  private scoreChunk(chunk: Chunk, queryTerms: string[]): number {
    let score = 0;
    for (const term of queryTerms) {
      const tf = chunk.terms.get(term);
      if (tf) score += (this.idf.get(term) ?? 1) * (1 + Math.log(tf));
    }
    return score;
  }

  /** Retrieve top-K cited chunks for a query using planned sub-queries. */
  retrieve(query: string, k = 3): Citation[] {
    const subQueries = this.planSubQueries(query);
    const scores = new Map<number, number>();
    for (const sq of subQueries) {
      const terms = tokenize(sq);
      this.chunks.forEach((chunk, i) => {
        const s = this.scoreChunk(chunk, terms);
        if (s > 0) scores.set(i, Math.max(scores.get(i) ?? 0, s));
      });
    }
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([i, score]) => {
        const c = this.chunks[i];
        return {
          docId: c.docId,
          title: c.title,
          section: c.section,
          snippet: c.text.replace(/\s+/g, " ").slice(0, 280),
          score: Number(score.toFixed(3)),
          source: c.source,
        };
      });
  }

  /** Produce a grounded answer with citations. Live mode hits Azure AI Search. */
  async answer(query: string): Promise<GroundedAnswer> {
    if (config.search.enabled) {
      try {
        return await this.answerLive(query);
      } catch {
        // fall through to offline grounding
      }
    }
    const citations = this.retrieve(query, 3);
    if (citations.length === 0) {
      return {
        answer:
          "I couldn't find this in the approved policy library, so I won't guess. " +
          "Try rephrasing, or ask an owner to add the relevant policy.",
        citations: [],
        grounded: false,
      };
    }
    const lead = citations[0];
    const answer =
      `Based on the policy library: ${lead.snippet} ` +
      (citations.length > 1
        ? `Related guidance appears in "${citations[1].title} › ${citations[1].section}".`
        : "");
    return { answer: answer.trim(), citations, grounded: true };
  }

  private async answerLive(query: string): Promise<GroundedAnswer> {
    const url = `${config.search.endpoint.replace(/\/$/, "")}/indexes/${config.search.index}/docs/search?api-version=2024-07-01`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": config.search.apiKey },
      body: JSON.stringify({ search: query, top: 3, queryType: "semantic" }),
    });
    if (!res.ok) throw new Error(`Azure AI Search ${res.status}`);
    const data = (await res.json()) as { value: Array<Record<string, unknown>> };
    const citations: Citation[] = (data.value ?? []).map((d, i) => ({
      docId: String(d.id ?? `doc-${i}`),
      title: String(d.title ?? "Policy"),
      section: String(d.section ?? ""),
      snippet: String(d.content ?? "").slice(0, 280),
      score: Number(d["@search.score"] ?? 0),
      source: "Azure AI Search",
    }));
    return {
      answer: citations[0]?.snippet ?? "No grounded result.",
      citations,
      grounded: citations.length > 0,
    };
  }
}

export const foundryIQ = new FoundryIQ();
