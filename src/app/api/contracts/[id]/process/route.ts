import { NextRequest } from 'next/server';
import { downloadContractFile, uploadContractFile } from '@/lib/db/storage';
import {
  getContract,
  createContract,
  updateContractStatus,
  updateContractMetadata,
} from '@/lib/db/contracts';
import {
  insertSectionMap,
  insertDefinedTerms,
  insertClauses,
  getClausesByContract,
  getSectionMap,
  getDefinedTerms,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Optional payload recovery for serverless environments where containers don't share memory
  let requestPayload: {
    contract?: { id: string; name: string; file_path: string | null };
    fileBase64?: string;
  } | null = null;

  try {
    requestPayload = await request.json();
  } catch {
    // Body is optional
  }

  // SSE setup
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      function closeController() {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {
            // ignore
          }
        }
      }

      function send(event: ProcessingEvent & Record<string, unknown>) {
        if (isClosed) return;
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // stream might be closed by client
        }
      }

      try {
        // Load contract from DB/store, or reconstruct from client payload if serverless container switched
        let contract = await getContract(id);

        if (!contract && requestPayload?.contract) {
          try {
            contract = await createContract({
              id,
              name: requestPayload.contract.name,
              filePath: requestPayload.contract.file_path,
            });
            // sync ID if possible
            if (contract && requestPayload.fileBase64 && requestPayload.contract.file_path) {
              await uploadContractFile(
                requestPayload.contract.file_path,
                Buffer.from(requestPayload.fileBase64, 'base64')
              );
            }
          } catch (err) {
            console.warn('Could not re-seed contract from payload:', err);
          }
        }

        if (!contract) {
          send({ stage: 'error', message: 'Contract not found', progress: 0, error: 'NOT_FOUND' });
          closeController();
          return;
        }

        if (contract.status === 'processing') {
          send({ stage: 'error', message: 'Already processing', progress: 0 });
          closeController();
          return;
        }

        await updateContractStatus(id, 'processing');

        // ── Stage 1: Extract PDF ───────────────────────────────────────
        send({ stage: 'extracting', message: 'Extracting text from PDF…', progress: 5 });

        let buffer: Buffer | null = null;
        if (contract.file_path) {
          const { data, error: downloadError } = await downloadContractFile(contract.file_path);
          if (!downloadError && data) {
            buffer = data;
          }
        }

        if (!buffer && requestPayload?.fileBase64) {
          buffer = Buffer.from(requestPayload.fileBase64, 'base64');
        }

        if (!buffer) {
          throw new Error('Failed to retrieve PDF file for processing.');
        }

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

        const finalContract = await getContract(id);
        const finalClauses = await getClausesByContract(id);
        const finalSectionMap = await getSectionMap(id);
        const finalDefinedTerms = await getDefinedTerms(id);

        send({
          stage: 'done',
          message: `Done! ${resolvedClauses.length} clauses extracted and indexed.`,
          progress: 100,
          contract: finalContract,
          clauses: finalClauses,
          sectionMap: finalSectionMap,
          definedTerms: finalDefinedTerms,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Processing error for contract ${id}:`, err);
        await updateContractStatus(id, 'error', { errorMessage: message });
        send({ stage: 'error', message, progress: 0, error: message });
      } finally {
        closeController();
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
