import { NextRequest, NextResponse } from 'next/server';
import { embedQuery } from '@/lib/pipeline/embedder';
import { searchClauses, filterClauses } from '@/lib/db/clauses';
import { getContract } from '@/lib/db/contracts';
import { createServerClient } from '@/lib/db/client';
import type { QueryRequest, QueryResponse, QueryResult, Clause } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Clause type synonyms for natural-language query enhancement
const CLAUSE_TYPE_SYNONYMS: Record<string, string> = {
  termination: 'termination',
  terminate: 'termination',
  cancel: 'termination',
  cancellation: 'termination',
  'auto-renewal': 'auto_renewal',
  'auto renewal': 'auto_renewal',
  renewal: 'auto_renewal',
  payment: 'payment',
  fee: 'payment',
  pricing: 'payment',
  ip: 'ip_ownership',
  'intellectual property': 'ip_ownership',
  ownership: 'ip_ownership',
  liability: 'liability',
  'limitation of liability': 'liability',
  indemnification: 'indemnification',
  indemnify: 'indemnification',
  confidentiality: 'confidentiality',
  'non-disclosure': 'confidentiality',
  nda: 'confidentiality',
  arbitration: 'dispute_resolution',
  dispute: 'dispute_resolution',
  'governing law': 'governing_law',
  jurisdiction: 'governing_law',
  'force majeure': 'force_majeure',
  warranties: 'warranties',
  warranty: 'warranties',
  'data privacy': 'data_privacy',
  gdpr: 'data_privacy',
  'non-compete': 'non_compete',
  assignment: 'assignment',
};

// Flag synonyms
const FLAG_SYNONYMS: Record<string, string> = {
  'auto-renewal': 'auto-renewal',
  'auto renewal': 'auto-renewal',
  'uncapped liability': 'uncapped-liability',
  'ip assignment': 'ip-assignment',
  'non-compete': 'non-compete',
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QueryRequest;
    const { query, filters = {}, limit = 20 } = body;

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const queryLower = query.toLowerCase();

    // Detect clause type from query synonyms (augment filters)
    let detectedClauseType = filters.clauseType;
    if (!detectedClauseType) {
      for (const [synonym, type] of Object.entries(CLAUSE_TYPE_SYNONYMS)) {
        if (queryLower.includes(synonym)) {
          detectedClauseType = type as typeof filters.clauseType;
          break;
        }
      }
    }

    // Detect flag from query
    let detectedFlag = filters.flag;
    if (!detectedFlag) {
      for (const [synonym, flag] of Object.entries(FLAG_SYNONYMS)) {
        if (queryLower.includes(synonym)) {
          detectedFlag = flag;
          break;
        }
      }
    }

    // If we have strong filter signals, combine semantic + filter
    // If no semantic signal, use pure filter
    const isSemanticQuery = query.length > 3;

    let results: (Clause & { similarity?: number })[] = [];

    if (isSemanticQuery) {
      // Embed the query and do semantic search
      const queryEmbedding = await embedQuery(query);
      const semanticResults = await searchClauses(queryEmbedding, {
        matchThreshold: 0.4,
        matchCount: limit,
        contractId: filters.contractId,
        clauseType: detectedClauseType,
        riskLevel: filters.riskLevel,
        flag: detectedFlag,
      });

      results = semanticResults;
    } else {
      // Pure filter
      const filtered = await filterClauses({
        contractId: filters.contractId,
        clauseType: detectedClauseType,
        riskLevel: filters.riskLevel,
        flag: detectedFlag,
        limit,
      });
      results = filtered;
    }

    // Fetch contract info for each unique contract_id
    const contractIds = [...new Set(results.map((r) => r.contract_id))];
    const supabase = createServerClient();
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, name, metadata')
      .in('id', contractIds);

    const contractMap = new Map(
      (contracts || []).map((c) => [c.id, c])
    );

    const queryResults: QueryResult[] = results.map((clause) => ({
      clause: clause as Clause,
      contract: contractMap.get(clause.contract_id) || {
        id: clause.contract_id,
        name: 'Unknown',
        metadata: {},
      },
      similarity: (clause as Clause & { similarity?: number }).similarity ?? 0,
    }));

    const response: QueryResponse = {
      results: queryResults,
      query,
      totalFound: queryResults.length,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('Query error:', err);
    return NextResponse.json({ error: 'Query failed. Please try again.' }, { status: 500 });
  }
}
