import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import {
  getContract,
  updateContractStatus,
  updateContractMetadata,
} from '@/lib/db/contracts';
import {
  insertSectionMap,
  insertDefinedTerms,
  insertClauses,
} from '@/lib/db/clauses';
import { extractPDF } from '@/lib/pipeline/extractor';
import { analyzeStructure } from '@/lib/pipeline/structureAnalyzer';
import { extractClauses } from '@/lib/pipeline/clauseExtractor';
import { resolveReferences } from '@/lib/pipeline/referenceResolver';
import { embedClauses } from '@/lib/pipeline/embedder';
import type { ProcessingEvent, RiskSummary } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min for large contracts

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // SSE setup
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: ProcessingEvent) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      try {
        // Load contract
        const contract = await getContract(id);
        if (!contract) {
          send({ stage: 'error', message: 'Contract not found', progress: 0, error: 'NOT_FOUND' });
          controller.close();
          return;
        }

        if (contract.status === 'processing') {
          send({ stage: 'error', message: 'Already processing', progress: 0 });
          controller.close();
          return;
        }

        await updateContractStatus(id, 'processing');

        // ── Stage 1: Extract PDF ───────────────────────────────────────
        send({ stage: 'extracting', message: 'Extracting text from PDF…', progress: 5 });

        const supabase = createServerClient();
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('contracts')
          .download(contract.file_path!);

        if (downloadError || !fileData) {
          throw new Error(`Failed to download PDF: ${downloadError?.message}`);
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        const extracted = await extractPDF(buffer);

        await updateContractStatus(id, 'processing', {
          rawText: extracted.fullText,
          pageCount: extracted.pageCount,
        });

        send({
          stage: 'extracting',
          message: `Extracted ${extracted.pageCount} pages (${extracted.fullText.length.toLocaleString()} chars)`,
          progress: 15,
        });

        // ── Stage 2: Analyze Structure ────────────────────────────────
        send({
          stage: 'analyzing_structure',
          message: 'Building section map and defined terms registry…',
          progress: 20,
        });

        const structure = await analyzeStructure(extracted.fullText);

        await insertSectionMap(id, structure.sectionMap);
        await insertDefinedTerms(id, structure.definedTerms);

        send({
          stage: 'analyzing_structure',
          message: `Found ${structure.sectionMap.length} sections, ${structure.definedTerms.length} defined terms`,
          progress: 40,
        });

        // ── Stage 3: Extract Clauses ──────────────────────────────────
        send({
          stage: 'extracting_clauses',
          message: 'Extracting and classifying clauses…',
          progress: 45,
        });

        const rawClauses = await extractClauses(extracted.fullText);

        send({
          stage: 'extracting_clauses',
          message: `Extracted ${rawClauses.length} clauses`,
          progress: 60,
        });

        // ── Stage 4: Resolve Cross-References ─────────────────────────
        send({
          stage: 'resolving_references',
          message: 'Resolving cross-references and building context…',
          progress: 65,
        });

        const resolvedClauses = resolveReferences(
          rawClauses,
          structure.sectionMap,
          structure.definedTerms
        );

        const insertedClauses = await insertClauses(id, resolvedClauses);

        const unresolvedCount = resolvedClauses.reduce(
          (sum, c) => sum + c.unresolved_references.length,
          0
        );

        send({
          stage: 'resolving_references',
          message: `Resolved references (${unresolvedCount} unresolvable)`,
          progress: 75,
        });

        // ── Stage 5: Generate Embeddings ──────────────────────────────
        send({
          stage: 'generating_embeddings',
          message: `Generating semantic embeddings for ${insertedClauses.length} clauses…`,
          progress: 78,
        });

        await embedClauses(insertedClauses, (completed, total) => {
          const pct = Math.round(78 + (completed / total) * 18);
          send({
            stage: 'generating_embeddings',
            message: `Embedding ${completed}/${total} clauses…`,
            progress: pct,
          });
        });

        // ── Stage 6: Finalize ─────────────────────────────────────────
        const riskSummary: RiskSummary = { high: 0, medium: 0, low: 0 };
        for (const c of resolvedClauses) {
          riskSummary[c.risk_level]++;
        }

        await updateContractMetadata(
          id,
          structure.metadata,
          riskSummary,
          resolvedClauses.length
        );

        send({
          stage: 'done',
          message: `Done! ${resolvedClauses.length} clauses extracted and indexed.`,
          progress: 100,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Processing error for contract ${id}:`, err);
        await updateContractStatus(id, 'error', { errorMessage: message });
        send({ stage: 'error', message, progress: 0, error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
