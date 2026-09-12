import type { ExtractedPDF } from '@/lib/types';

/**
 * Extract text from a PDF buffer.
 *
 * Uses pdf-parse to get raw text. We also attempt to preserve page
 * boundaries by splitting on form-feed characters (\f) that pdf-parse
 * inserts between pages.
 */
export async function extractPDF(buffer: Buffer): Promise<ExtractedPDF> {
  // Dynamic import to avoid Next.js edge-runtime issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');

  const data = await pdfParse(buffer, {
    // Preserve structure markers
    normalizeWhitespace: false,
  });

  const fullText: string = data.text;
  const pageCount: number = data.numpages;

  // Split into pages by form-feed character inserted by pdf-parse
  const rawPages = fullText.split('\f');

  const pages = rawPages
    .map((p: string) => cleanPageText(p))
    .filter((p: string) => p.trim().length > 10); // Drop blank pages

  // If form-feed splitting gives wrong page count, just return as one
  const finalPages = pages.length > 0 ? pages : [cleanPageText(fullText)];

  return {
    fullText: cleanPageText(fullText),
    pages: finalPages,
    pageCount,
  };
}

/**
 * Clean extracted page text:
 * - Remove common header/footer patterns (page numbers, document titles repeated on each page)
 * - Normalize whitespace
 * - Remove excessive blank lines (keep max 2 consecutive)
 */
function cleanPageText(text: string): string {
  return text
    // Remove lines that are purely page numbers (e.g., "- 3 -", "Page 3 of 12", "3")
    .replace(/^[\s]*[-–]?\s*Page\s+\d+\s+(of\s+\d+)?\s*[-–]?[\s]*$/gim, '')
    .replace(/^[\s]*\d+\s*$/gm, '')
    // Normalize Windows line endings
    .replace(/\r\n/g, '\n')
    // Collapse runs of 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
