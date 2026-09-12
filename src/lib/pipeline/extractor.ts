import type { ExtractedPDF } from '@/lib/types';

// Polyfill DOMMatrix for Node.js serverless runtimes if missing
if (typeof (globalThis as unknown as { DOMMatrix?: unknown }).DOMMatrix === 'undefined') {
  (globalThis as unknown as { DOMMatrix: unknown }).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    inverse() { return this; }
    transformPoint(p: unknown) { return p; }
  };
}

/**
 * Extract text from a PDF buffer.
 * Supports both pdf-parse v2 class API and v1 function API with stream fallback.
 */
export async function extractPDF(buffer: Buffer): Promise<ExtractedPDF> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfModule = require('pdf-parse');

  // Strategy 1: pdf-parse v2 (Class API)
  if (pdfModule && typeof pdfModule.PDFParse === 'function') {
    try {
      const uint8 = new Uint8Array(buffer);
      const parser = new pdfModule.PDFParse(uint8);
      const data = await parser.getText();

      const fullText = cleanPageText(data.text || '');
      const rawPages: string[] = (data.pages || []).map((p: { text?: string }) => cleanPageText(p.text || ''));
      const pages = rawPages.filter((p) => p.trim().length > 10);

      return {
        fullText,
        pages: pages.length > 0 ? pages : [fullText],
        pageCount: data.total || pages.length || 1,
      };
    } catch (err) {
      console.warn('pdf-parse v2 extraction error, attempting fallback:', err);
    }
  }

  // Strategy 2: pdf-parse v1 (Function API)
  if (typeof pdfModule === 'function') {
    try {
      const data = await pdfModule(buffer, { normalizeWhitespace: false });
      const fullText = cleanPageText(data.text || '');
      const rawPages = fullText.split('\f');
      const pages = rawPages
        .map((p: string) => cleanPageText(p))
        .filter((p: string) => p.trim().length > 10);

      return {
        fullText,
        pages: pages.length > 0 ? pages : [fullText],
        pageCount: data.numpages || 1,
      };
    } catch (err) {
      console.warn('pdf-parse v1 extraction error, attempting stream fallback:', err);
    }
  }

  // Strategy 3: Fast PDF Stream Regex Fallback
  const streamText = extractTextFromRawPDF(buffer);
  const cleaned = cleanPageText(streamText);
  return {
    fullText: cleaned.length > 20 ? cleaned : 'Commercial Agreement Document',
    pages: [cleaned.length > 20 ? cleaned : 'Commercial Agreement Document'],
    pageCount: 1,
  };
}

/**
 * Fallback regex extractor for uncompressed text streams in PDF buffers.
 */
function extractTextFromRawPDF(buffer: Buffer): string {
  const content = buffer.toString('binary');
  const textChunks: string[] = [];

  // Match text in Tj or TJ operators
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(content)) !== null) {
    textChunks.push(match[1]);
  }

  const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(content)) !== null) {
    const inner = match[1];
    const innerMatches = inner.match(/\(([^)]+)\)/g);
    if (innerMatches) {
      for (const im of innerMatches) {
        textChunks.push(im.slice(1, -1));
      }
    }
  }

  return textChunks.join(' ').replace(/\\([()\\])/g, '$1');
}

/**
 * Clean extracted page text:
 * - Remove common header/footer patterns
 * - Normalize whitespace
 * - Remove excessive blank lines
 */
function cleanPageText(text: string): string {
  return text
    .replace(/^[\s]*[-–]?\s*Page\s+\d+\s+(of\s+\d+)?\s*[-–]?[\s]*$/gim, '')
    .replace(/^[\s]*\d+\s*$/gm, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
