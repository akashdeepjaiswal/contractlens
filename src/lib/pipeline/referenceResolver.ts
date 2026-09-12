import type { RawClause, ResolvedClause, SectionMapItem, DefinedTermItem } from '@/lib/types';

// Maximum recursion depth to prevent circular reference loops
const MAX_DEPTH = 2;

// ============================================================
// Main: resolveReferences
// ============================================================

/**
 * Pass 3 of the pipeline: cross-reference resolution.
 *
 * This is the core of what makes ContractLens useful for non-lawyers.
 * A clause like "termination pursuant to Section 3.1(b) and subject to
 * the Minimum Commitment defined in Exhibit A" is meaningless without
 * knowing what those things say.
 *
 * For each raw clause:
 * 1. Try to resolve each raw_reference against the section map
 * 2. Try to resolve it against defined terms
 * 3. Build resolved_context = original clause + appended "References" block
 * 4. Track which references couldn't be resolved (flagged as unresolved)
 */
export function resolveReferences(
  clauses: RawClause[],
  sectionMap: SectionMapItem[],
  definedTerms: DefinedTermItem[]
): ResolvedClause[] {
  // Build lookup indexes for O(1) access
  const sectionIndex = buildSectionIndex(sectionMap);
  const termIndex = buildTermIndex(definedTerms);

  return clauses.map((clause) =>
    resolveClauseReferences(clause, sectionIndex, termIndex)
  );
}

// ============================================================
// Per-clause resolution
// ============================================================

function resolveClauseReferences(
  clause: RawClause,
  sectionIndex: Map<string, string>,
  termIndex: Map<string, string>
): ResolvedClause {
  if (clause.raw_references.length === 0) {
    return {
      ...clause,
      resolved_context: clause.content,
      unresolved_references: [],
    };
  }

  const resolvedParts: string[] = [];
  const unresolved: string[] = [];

  for (const ref of clause.raw_references) {
    const resolved = resolveReference(ref, sectionIndex, termIndex, 0);
    if (resolved !== null) {
      resolvedParts.push(`**${ref}:**\n${resolved}`);
    } else {
      unresolved.push(ref);
    }
  }

  // Build resolved_context: original clause + resolved reference block
  let resolvedContext = clause.content;
  if (resolvedParts.length > 0) {
    resolvedContext +=
      '\n\n--- Referenced Sections ---\n\n' + resolvedParts.join('\n\n---\n\n');
  }
  if (unresolved.length > 0) {
    resolvedContext +=
      '\n\n--- Unresolved References ---\n' +
      unresolved.map((r) => `[UNRESOLVED: ${r}]`).join('\n');
  }

  return {
    ...clause,
    resolved_context: resolvedContext,
    unresolved_references: unresolved,
  };
}

// ============================================================
// Reference resolution logic
// ============================================================

/**
 * Try to resolve a single reference string.
 * Returns the content string or null if not found.
 */
function resolveReference(
  ref: string,
  sectionIndex: Map<string, string>,
  termIndex: Map<string, string>,
  depth: number
): string | null {
  if (depth > MAX_DEPTH) return '[nested reference — depth limit reached]';

  const normalized = ref.trim();

  // 1. Exact section number match (e.g., "Section 3.1(b)" → "3.1(b)")
  const sectionNumber = extractSectionNumber(normalized);
  if (sectionNumber) {
    const exact = sectionIndex.get(sectionNumber.toLowerCase());
    if (exact) return truncate(exact, 800);

    // 1b. Fuzzy: try without sub-clause suffix (e.g., "3.1(b)" → try "3.1")
    const parent = stripSubClause(sectionNumber);
    if (parent !== sectionNumber) {
      const parentContent = sectionIndex.get(parent.toLowerCase());
      if (parentContent) return truncate(parentContent, 800);
    }

    // 1c. Exhibit/Schedule match
    const exhibitKey = normalized.toLowerCase().replace(/\s+/g, ' ').trim();
    const exhibitContent = sectionIndex.get(exhibitKey);
    if (exhibitContent) return truncate(exhibitContent, 800);
  }

  // 2. Defined term match (case-insensitive)
  const termKey = normalized.toLowerCase().replace(/^the\s+/i, '').trim();
  const termContent = termIndex.get(termKey);
  if (termContent) return truncate(termContent, 500);

  // 3. Partial match: try to find a section whose title or number contains the ref
  for (const [key, content] of sectionIndex.entries()) {
    if (key.includes(normalized.toLowerCase()) || normalized.toLowerCase().includes(key)) {
      return truncate(content, 800);
    }
  }

  return null;
}

/**
 * Extract a bare section number from a reference string.
 * "Section 3.1(b)" → "3.1(b)"
 * "Section 3" → "3"
 * "Exhibit A" → "Exhibit A"
 * "Schedule 2" → "Schedule 2"
 */
export function extractSectionNumber(ref: string): string | null {
  // "Section X.X", "Clause X.X", "Article X.X"
  const sectionMatch = ref.match(
    /(?:section|clause|article|paragraph)\s+(\d[\d.]*(?:\([a-z]+\))*)/i
  );
  if (sectionMatch) return sectionMatch[1];

  // "Exhibit A", "Schedule 2", "Annex B"
  const exhibitMatch = ref.match(/^(exhibit|schedule|annex|appendix)\s+[a-z0-9]+/i);
  if (exhibitMatch) return ref.trim();

  // Bare section number "3.1(b)"
  const bareMatch = ref.match(/^(\d[\d.]*(?:\([a-z]+\))*)$/i);
  if (bareMatch) return bareMatch[1];

  return null;
}

/**
 * Strip sub-clause suffix: "3.1(b)" → "3.1", "3.1.2" → "3.1"
 */
export function stripSubClause(sectionNumber: string): string {
  // Remove trailing (a), (b), (i), (ii) etc.
  const withoutParens = sectionNumber.replace(/\([a-z]+\)$/i, '');
  if (withoutParens !== sectionNumber) return withoutParens.trim();

  // Remove last dot-separated segment: "3.1.2" → "3.1"
  const parts = sectionNumber.split('.');
  if (parts.length > 1) {
    parts.pop();
    return parts.join('.');
  }

  return sectionNumber;
}

// ============================================================
// Index builders
// ============================================================

function buildSectionIndex(sectionMap: SectionMapItem[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const section of sectionMap) {
    const key = section.section_number.toLowerCase().trim();
    index.set(key, section.content);

    // Also index by title if present
    if (section.title) {
      index.set(section.title.toLowerCase().trim(), section.content);
    }

    // Index "exhibit a" → content
    const exhibitKey = section.section_number.toLowerCase().replace(/\s+/g, ' ').trim();
    if (exhibitKey !== key) index.set(exhibitKey, section.content);
  }
  return index;
}

function buildTermIndex(definedTerms: DefinedTermItem[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const term of definedTerms) {
    const key = term.term.toLowerCase().trim();
    index.set(key, term.definition);
    // Also index without "the" prefix
    const withoutThe = key.replace(/^the\s+/, '');
    if (withoutThe !== key) index.set(withoutThe, term.definition);
  }
  return index;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}
