import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set.');
  if (!genAI) genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

/**
 * Run a structured JSON prompt using Gemini.
 * Defaults to gemini-2.5-flash (latest) with gemini-2.0-flash as fallback.
 * Returns parsed JSON or throws on failure.
 */
export async function geminiJSON<T>(
  prompt: string,
  retries = 2
): Promise<T> {
  const client = getClient();
  // gemini-2.5-flash: latest model with significantly better reasoning,
  // multi-step instruction following, and structured JSON accuracy over 2.0-flash.
  // Falls back to 2.0-flash if the 2.5 endpoint is unavailable.
  const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const modelsToTry = [preferredModel, 'gemini-2.0-flash', 'gemini-1.5-flash'];
  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastError: Error | null = null;

  for (const modelName of uniqueModels) {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1, // Low temp for consistent structured output
      },
    });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        // Strip markdown code fences if Gemini wraps JSON in them
        const cleaned = text
          .replace(/^```(?:json)?\n?/i, '')
          .replace(/\n?```$/i, '')
          .trim();

        return JSON.parse(cleaned) as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retries) {
          // Exponential backoff: 1s, 2s
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
  }

  throw new Error(`Gemini JSON call failed: ${lastError?.message}`);
}

/**
 * Generate an embedding vector for the given text using text-embedding-004.
 */
export async function geminiEmbed(text: string): Promise<number[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: 'text-embedding-004' });

  // Truncate to ~8000 chars to stay well within token limit
  const truncated = text.length > 8000 ? text.slice(0, 8000) + '...' : text;

  const result = await model.embedContent(truncated);
  return result.embedding.values;
}

/**
 * Embed a batch of texts with rate limiting (sequential with small delay).
 * Returns embeddings in same order as input.
 */
export async function geminiEmbedBatch(
  texts: string[],
  delayMs = 200
): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    const embedding = await geminiEmbed(text);
    embeddings.push(embedding);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return embeddings;
}
