import { geminiJSON } from '@/lib/gemini';
import type { RawClause, ClauseType, RiskLevel } from '@/lib/types';

// ============================================================
// Gemini response schema
// ============================================================

interface GeminiClauseResponse {
  clauses: Array<{
    section_number: string | null;
    title: string | null;
    clause_type: string;
    content: string;
    risk_level: string;
    flags: string[];
    raw_references: string[];
    risk_rationale: string;
  }>;
}

const VALID_CLAUSE_TYPES: ClauseType[] = [
  'termination',
  'payment',
  'ip_ownership',
  'liability',
  'indemnification',
  'auto_renewal',
  'confidentiality',
  'dispute_resolution',
  'governing_law',
  'force_majeure',
  'warranties',
  'data_privacy',
  'non_compete',
  'assignment',
  'other',
];

const VALID_RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high'];

const VALID_FLAGS = new Set([
  'auto-renewal',
  'uncapped-liability',
  'one-sided-termination',
  'ip-assignment',
  'non-compete',
  'liquidated-damages',
  'broad-indemnification',
  'no-limitation-of-liability',
  'mandatory-arbitration',
  'unilateral-amendment',
]);

// ============================================================
// Main: extractClauses
// ============================================================

/**
 * Pass 2 of the pipeline: clause extraction.
 *
 * Sends full contract text to Gemini and asks it to identify each
 * distinct legal clause, classify it, assess risk, detect flags,
 * and list all cross-references found in that clause.
 *
 * Cross-references are recorded here (not resolved yet) — resolution
 * happens in Pass 3 using the section map built in Pass 1.
 */
export async function extractClauses(fullText: string): Promise<RawClause[]> {
  const textToAnalyze =
    fullText.length > 900_000 ? fullText.slice(0, 900_000) + '\n\n[DOCUMENT TRUNCATED]' : fullText;

  const prompt = buildClausePrompt(textToAnalyze);
  const response = await geminiJSON<GeminiClauseResponse>(prompt);

  const clauses = (response.clauses || [])
    .map(normalizeClause)
    .filter((c) => c.content.trim().length > 20); // Drop near-empty clauses

  return clauses;
}

// ============================================================
// Helpers
// ============================================================

function normalizeClause(raw: GeminiClauseResponse['clauses'][0]): RawClause {
  const clauseType: ClauseType = VALID_CLAUSE_TYPES.includes(raw.clause_type as ClauseType)
    ? (raw.clause_type as ClauseType)
    : 'other';

  const riskLevel: RiskLevel = VALID_RISK_LEVELS.includes(raw.risk_level as RiskLevel)
    ? (raw.risk_level as RiskLevel)
    : 'low';

  const flags = (Array.isArray(raw.flags) ? raw.flags : []).filter(
    (f) => VALID_FLAGS.has(f)
  );

  const rawReferences = (
    Array.isArray(raw.raw_references) ? raw.raw_references : []
  ).map((r) => String(r).trim()).filter(Boolean);

  return {
    section_number: raw.section_number ? String(raw.section_number).trim() : null,
    title: raw.title ? String(raw.title).trim() : null,
    clause_type: clauseType,
    content: String(raw.content || '').trim(),
    risk_level: riskLevel,
    flags,
    raw_references: rawReferences,
  };
}

function buildClausePrompt(text: string): string {
  return `You are a legal contract analysis engine for founders and non-lawyers.

Analyze the contract below and extract every meaningful legal clause.
For each clause, identify its type, assess risk for the party being protected (typically the customer/buyer), detect red flags, and list all cross-references within the clause text.

Return a JSON object with EXACTLY this shape:
{
  "clauses": [
    {
      "section_number": "8.2",
      "title": "Termination for Convenience",
      "clause_type": "termination",
      "content": "FULL VERBATIM TEXT of the clause as it appears in the contract",
      "risk_level": "high",
      "flags": ["one-sided-termination"],
      "raw_references": ["Section 3.1(b)", "Exhibit A", "the Minimum Commitment"],
      "risk_rationale": "Vendor can terminate with 30 days notice but customer requires 90 days"
    }
  ]
}

Clause types (use EXACTLY these values):
- termination
- payment
- ip_ownership
- liability
- indemnification
- auto_renewal
- confidentiality
- dispute_resolution
- governing_law
- force_majeure
- warranties
- data_privacy
- non_compete
- assignment
- other

Risk levels (use EXACTLY these values):
- low: Standard, balanced clause
- medium: Somewhat one-sided or has meaningful obligations
- high: Heavily one-sided, unusual, or exposes the customer to significant risk

Flags (include ONLY when clearly present, use EXACTLY these values):
- auto-renewal: Contract renews automatically without active opt-in
- uncapped-liability: No cap on damages or liability
- one-sided-termination: Only one party can terminate or termination conditions are very unequal
- ip-assignment: Customer assigns IP rights to vendor
- non-compete: Non-compete restriction on customer
- liquidated-damages: Pre-specified damages amounts
- broad-indemnification: Very wide indemnification scope
- no-limitation-of-liability: Excludes limitation of liability clause entirely
- mandatory-arbitration: Requires arbitration instead of courts
- unilateral-amendment: Vendor can modify terms without customer consent

For raw_references: list every reference to another section, exhibit, schedule, or defined term that appears in this clause's text. Examples:
- "Section 3.1(b)"
- "Exhibit A"
- "Schedule 2"
- "the Minimum Commitment" (if it's a defined term used in the clause)
- "the Agreement"

Rules:
- Use VERBATIM clause text — do not summarize or paraphrase the content field
- Include sub-clauses as separate entries if they have distinct legal meaning
- Do not skip any clause, even boilerplate ones
- A single long section may produce multiple clauses if it covers multiple topics

CONTRACT:
---
${text}
---

Return ONLY the JSON object.`;
}
