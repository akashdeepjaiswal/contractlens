import { geminiEmbed } from '@/lib/gemini';
import { updateClauseEmbedding } from '@/lib/db/clauses';
import type { Clause } from '@/lib/types';

/**
 * Generate embeddings for a batch of clauses and persist them to the DB.
 * Uses Gemini text-embedding-004 when GEMINI_API_KEY is available, with
 * local normalized vector hashing fallback for offline/demo operation.
 */
export async function embedClauses(
  clauses: Clause[],
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  const total = clauses.length;
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];
    const textToEmbed = buildEmbedText(clause);

    let embedding: number[];
    if (hasApiKey) {
      try {
        embedding = await geminiEmbed(textToEmbed);
      } catch (err) {
        console.warn('Gemini embedding failed, using local vector fallback:', err);
        embedding = generateLocalVector(textToEmbed);
      }
    } else {
      embedding = generateLocalVector(textToEmbed);
    }

    await updateClauseEmbedding(clause.id, embedding);
    onProgress?.(i + 1, total);

    // Rate limiting: 200ms between Gemini embedding calls if using remote API
    if (hasApiKey && i < clauses.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

/**
 * Embed a single query string (for search).
 */
export async function embedQuery(query: string): Promise<number[]> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiEmbed(query);
    } catch (err) {
      console.warn('Gemini embedQuery failed, using local vector fallback:', err);
    }
  }
  return generateLocalVector(query);
}

/**
 * Deterministic local term-frequency normalized vector for offline/demo search.
 * Produces a 768-dimensional L2-normalized vector compatible with pgvector schema.
 */
export function generateLocalVector(text: string): number[] {
  const dim = 768;
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().match(/\w+/g) || [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash * 31 + word.charCodeAt(j)) % dim;
    }
    vec[Math.abs(hash)] += 1;
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
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
