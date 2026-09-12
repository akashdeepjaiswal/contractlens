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
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      // Truncate if extremely long to fit Gemini context
      const textToAnalyze =
        fullText.length > 900_000 ? fullText.slice(0, 900_000) + '\n\n[DOCUMENT TRUNCATED]' : fullText;

      const prompt = buildStructurePrompt(textToAnalyze);
      const response = await geminiJSON<GeminiStructureResponse>(prompt);

      if (response && Array.isArray(response.sections) && response.sections.length > 0) {
        // Validate and normalize
        const sectionMap: SectionMapItem[] = response.sections.map((s) => ({
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
    } catch (err) {
      console.warn('Gemini structure analysis failed or quota exceeded, using rule-based fallback:', err);
    }
  }

  return ruleBasedStructureAnalysis(fullText);
}

/**
 * Rule-based fallback for structure analysis when LLM API is unavailable.
 * Deterministically parses sections, defined terms, and metadata from contract text.
 */
export function ruleBasedStructureAnalysis(fullText: string): StructureAnalysis {
  const sections: SectionMapItem[] = [];
  const definedTerms: DefinedTermItem[] = [];

  // 1. Extract Defined Terms
  const defRegex = /"([A-Z][A-Za-z0-9\s-]{2,40})"\s+(?:means|shall mean|refers to|has the meaning)\s+([^.\n]+(?:\.[^.\n]+)?)/gi;
  let defMatch;
  const seenTerms = new Set<string>();
  while ((defMatch = defRegex.exec(fullText)) !== null) {
    const term = defMatch[1].trim();
    if (!seenTerms.has(term.toLowerCase())) {
      seenTerms.add(term.toLowerCase());
      definedTerms.push({
        term,
        definition: defMatch[2].trim(),
        section_ref: null,
      });
    }
  }

  // 2. Extract Sections via heading patterns
  const lines = fullText.split('\n');
  let currentSection: { number: string; title: string | null; lines: string[] } | null = null;

  const headingRegex = /^(?:(?:SECTION|ARTICLE|CLAUSE)\s+([0-9A-Z.]+)|([0-9]{1,2}(?:\.[0-9]{1,2}){0,3})\.?)\s*(?:[:.–-]\s*|\s+)?([^\n]{3,80})?$/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(headingRegex);

    if (match) {
      if (currentSection) {
        sections.push({
          section_number: currentSection.number,
          title: currentSection.title,
          content: currentSection.lines.join('\n').trim(),
          depth: inferDepth(currentSection.number),
        });
      }
      const secNum = (match[1] || match[2] || '1').trim();
      const secTitle = match[3] ? match[3].trim() : null;
      currentSection = { number: secNum, title: secTitle, lines: [line] };
    } else if (currentSection) {
      currentSection.lines.push(rawLine);
    }
  }

  if (currentSection) {
    sections.push({
      section_number: currentSection.number,
      title: currentSection.title,
      content: currentSection.lines.join('\n').trim(),
      depth: inferDepth(currentSection.number),
    });
  }

  // If no structured headings were detected, create paragraph blocks
  if (sections.length === 0) {
    const paragraphs = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 30);
    paragraphs.forEach((para, idx) => {
      sections.push({
        section_number: String(idx + 1),
        title: para.slice(0, 40).replace(/[^a-zA-Z0-9\s]/g, '') + '...',
        content: para.trim(),
        depth: 0,
      });
    });
  }

  // 3. Extract Metadata
  let governingLaw: string | undefined;
  const govMatch = fullText.match(/governed by.*?laws of (?:the State of )?([A-Za-z\s]+?)(?:,|\.|\n|;)/i);
  if (govMatch) governingLaw = govMatch[1].trim();

  let parties: string[] = [];
  const partyMatch = fullText.match(/between\s+([A-Z][A-Za-z0-9\s,.]+?)\s+and\s+([A-Z][A-Za-z0-9\s,.]+?)(?:,|\.|\n|dated)/i);
  if (partyMatch) {
    parties = [partyMatch[1].trim(), partyMatch[2].trim()];
  }

  const dateMatch = fullText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i);

  const metadata: ContractMetadata = {
    parties,
    governing_law: governingLaw,
    date: dateMatch ? dateMatch[0] : undefined,
    contract_type: 'Commercial Contract',
    effective_date: dateMatch ? dateMatch[0] : undefined,
  };

  return { sectionMap: sections, definedTerms, metadata };
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
