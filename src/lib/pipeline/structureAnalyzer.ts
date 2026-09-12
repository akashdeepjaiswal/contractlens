import { geminiJSON } from '@/lib/gemini';
import type {
  StructureAnalysis,
  SectionMapItem,
  DefinedTermItem,
  ContractMetadata,
} from '@/lib/types';

// ============================================================
// Gemini response schemas
// ============================================================

interface GeminiStructureResponse {
  sections: Array<{
    section_number: string;
    title: string | null;
    content: string;
    depth: number;
  }>;
  defined_terms: Array<{
    term: string;
    definition: string;
    section_ref: string | null;
  }>;
  metadata: {
    parties: string[];
    date: string | null;
    governing_law: string | null;
    contract_type: string | null;
    effective_date: string | null;
    expiry_date: string | null;
  };
}

// ============================================================
// Main: analyzeStructure
// ============================================================

/**
 * Pass 1 of the pipeline: structural analysis.
 *
 * Sends the full contract text to Gemini and asks it to:
 * 1. Identify every section/subsection with its number, title, and content
 * 2. Extract all defined terms (capitalized terms with explicit definitions)
 * 3. Extract top-level contract metadata
 *
 * This output is stored in the DB before clause extraction begins,
 * so the reference resolver can look up any cross-reference.
 */
export async function analyzeStructure(fullText: string): Promise<StructureAnalysis> {
  // Truncate if extremely long to fit Gemini context
  const textToAnalyze =
    fullText.length > 900_000 ? fullText.slice(0, 900_000) + '\n\n[DOCUMENT TRUNCATED]' : fullText;

  const prompt = buildStructurePrompt(textToAnalyze);
  const response = await geminiJSON<GeminiStructureResponse>(prompt);

  // Validate and normalize
  const sectionMap: SectionMapItem[] = (response.sections || []).map((s) => ({
    section_number: String(s.section_number || '').trim(),
    title: s.title ? String(s.title).trim() : null,
    content: String(s.content || '').trim(),
    depth: typeof s.depth === 'number' ? s.depth : inferDepth(String(s.section_number || '')),
  }));

  const definedTerms: DefinedTermItem[] = (response.defined_terms || []).map((t) => ({
    term: String(t.term || '').trim(),
    definition: String(t.definition || '').trim(),
    section_ref: t.section_ref ? String(t.section_ref).trim() : null,
  }));

  const metadata: ContractMetadata = {
    parties: Array.isArray(response.metadata?.parties) ? response.metadata.parties : [],
    date: response.metadata?.date || undefined,
    governing_law: response.metadata?.governing_law || undefined,
    contract_type: response.metadata?.contract_type || undefined,
    effective_date: response.metadata?.effective_date || undefined,
    expiry_date: response.metadata?.expiry_date || undefined,
  };

  return { sectionMap, definedTerms, metadata };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Infer section depth from its numbering pattern.
 * "1" → 0, "1.1" → 1, "1.1.1" → 2, "1.1(a)" → 2, "Exhibit A" → 0
 */
export function inferDepth(sectionNumber: string): number {
  if (!sectionNumber) return 0;
  const n = sectionNumber.trim();
  if (/^[A-Za-z]/.test(n)) return 0; // Exhibit A, Schedule B
  const parts = n.split(/[\.\s]/);
  const depth = parts.length - 1;
  // Additional depth for sub-clauses like (a), (i)
  if (/\([a-z]+\)$/i.test(n)) return depth + 1;
  return depth;
}

function buildStructurePrompt(text: string): string {
  return `You are a contract analysis engine. Analyze the following contract text and extract its structure.

Return a JSON object with EXACTLY this shape:
{
  "sections": [
    {
      "section_number": "1",
      "title": "Definitions",
      "content": "Full text of this section including all subsections...",
      "depth": 0
    },
    {
      "section_number": "1.1",
      "title": null,
      "content": "Full text of subsection 1.1...",
      "depth": 1
    }
  ],
  "defined_terms": [
    {
      "term": "Agreement",
      "definition": "this Software License Agreement entered into as of...",
      "section_ref": "Recitals"
    }
  ],
  "metadata": {
    "parties": ["Acme Corp", "Vendor Inc"],
    "date": "January 1, 2024",
    "governing_law": "State of California",
    "contract_type": "Software License Agreement",
    "effective_date": "January 1, 2024",
    "expiry_date": null
  }
}

Rules:
- Include EVERY section, subsection, sub-clause, exhibit, and schedule
- For "content", include the COMPLETE text of each section (not a summary)
- Depth: 0 = top-level section, 1 = subsection like "3.1", 2 = sub-subsection like "3.1(a)"
- For defined_terms: extract terms that are explicitly defined (usually in quotes or with "means")
- Capture defined terms scattered throughout the document (not just in a Definitions section)
- Return null for any metadata field you can't find
- Parties should be the legal entity names, not roles

CONTRACT TEXT:
---
${text}
---

Return ONLY the JSON object, no markdown, no explanation.`;
}
