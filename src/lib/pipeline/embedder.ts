import { geminiEmbed, geminiEmbedBatch } from '@/lib/gemini';
import { updateClauseEmbedding } from '@/lib/db/clauses';
import type { Clause } from '@/lib/types';

/**
 * Generate embeddings for a batch of clauses and persist them to the DB.
 *
 * We embed resolved_context (clause content + inlined references) rather than
 * raw content, so semantic search benefits from the full resolved meaning.
 *
 * Rate-limited to avoid Gemini quota errors (200ms between calls).
 */
export async function embedClauses(
  clauses: Clause[],
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  const total = clauses.length;

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];
    const textToEmbed = buildEmbedText(clause);

    const embedding = await geminiEmbed(textToEmbed);
    await updateClauseEmbedding(clause.id, embedding);

    onProgress?.(i + 1, total);

    // Rate limiting: 200ms between embedding calls
    if (i < clauses.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

/**
 * Embed a single query string (for search).
 */
export async function embedQuery(query: string): Promise<number[]> {
  return geminiEmbed(query);
}

/**
 * Build the text to embed for a clause.
 * Includes type, title, and resolved context for richer semantic representation.
 */
function buildEmbedText(clause: Clause): string {
  const parts: string[] = [];

  if (clause.clause_type && clause.clause_type !== 'other') {
    parts.push(`Type: ${clause.clause_type.replace(/_/g, ' ')}`);
  }
  if (clause.title) {
    parts.push(`Title: ${clause.title}`);
  }
  if (clause.flags.length > 0) {
    parts.push(`Flags: ${clause.flags.join(', ')}`);
  }

  // Use resolved context if available, otherwise raw content
  const mainText = clause.resolved_context || clause.content;
  parts.push(mainText);

  return parts.join('\n');
}
