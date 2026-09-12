import { createServerClient } from './client';
import type {
  Clause,
  DefinedTerm,
  SectionMapEntry,
  SectionMapItem,
  DefinedTermItem,
  ResolvedClause,
  QueryResult,
} from '@/lib/types';

// ============================================================
// Section Map
// ============================================================

export async function insertSectionMap(
  contractId: string,
  sections: SectionMapItem[]
): Promise<void> {
  if (sections.length === 0) return;
  const supabase = createServerClient();
  const rows = sections.map((s) => ({ ...s, contract_id: contractId }));
  const { error } = await supabase.from('section_map').insert(rows);
  if (error) throw new Error(`Failed to insert section map: ${error.message}`);
}

export async function getSectionMap(contractId: string): Promise<SectionMapEntry[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('section_map')
    .select('*')
    .eq('contract_id', contractId)
    .order('section_number');
  if (error) throw new Error(`Failed to get section map: ${error.message}`);
  return (data || []) as SectionMapEntry[];
}

// ============================================================
// Defined Terms
// ============================================================

export async function insertDefinedTerms(
  contractId: string,
  terms: DefinedTermItem[]
): Promise<void> {
  if (terms.length === 0) return;
  const supabase = createServerClient();
  const rows = terms.map((t) => ({ ...t, contract_id: contractId }));
  const { error } = await supabase.from('defined_terms').insert(rows);
  if (error) throw new Error(`Failed to insert defined terms: ${error.message}`);
}

export async function getDefinedTerms(contractId: string): Promise<DefinedTerm[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('defined_terms')
    .select('*')
    .eq('contract_id', contractId);
  if (error) throw new Error(`Failed to get defined terms: ${error.message}`);
  return (data || []) as DefinedTerm[];
}

// ============================================================
// Clauses
// ============================================================

export async function insertClauses(
  contractId: string,
  clauses: ResolvedClause[]
): Promise<Clause[]> {
  if (clauses.length === 0) return [];
  const supabase = createServerClient();

  const rows = clauses.map((c) => ({
    contract_id: contractId,
    section_number: c.section_number,
    title: c.title,
    clause_type: c.clause_type,
    content: c.content,
    resolved_context: c.resolved_context,
    risk_level: c.risk_level,
    flags: c.flags,
    raw_references: c.raw_references,
    unresolved_references: c.unresolved_references,
  }));

  const { data, error } = await supabase.from('clauses').insert(rows).select();
  if (error) throw new Error(`Failed to insert clauses: ${error.message}`);
  return (data || []) as Clause[];
}

export async function updateClauseEmbedding(
  clauseId: string,
  embedding: number[]
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('clauses')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', clauseId);
  if (error) throw new Error(`Failed to update clause embedding: ${error.message}`);
}

export async function getClausesByContract(contractId: string): Promise<Clause[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('clauses')
    .select('*')
    .eq('contract_id', contractId)
    .order('section_number');
  if (error) throw new Error(`Failed to get clauses: ${error.message}`);
  return (data || []) as Clause[];
}

export async function searchClauses(
  queryEmbedding: number[],
  options: {
    matchThreshold?: number;
    matchCount?: number;
    contractId?: string;
    clauseType?: string;
    riskLevel?: string;
    flag?: string;
  } = {}
): Promise<(Clause & { similarity: number })[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('search_clauses', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: options.matchThreshold ?? 0.4,
    match_count: options.matchCount ?? 20,
    filter_contract_id: options.contractId ?? null,
    filter_clause_type: options.clauseType ?? null,
    filter_risk_level: options.riskLevel ?? null,
    filter_flag: options.flag ?? null,
  });
  if (error) throw new Error(`Failed to search clauses: ${error.message}`);
  return (data || []) as (Clause & { similarity: number })[];
}

export async function filterClauses(options: {
  contractId?: string;
  clauseType?: string;
  riskLevel?: string;
  flag?: string;
  limit?: number;
}): Promise<Clause[]> {
  const supabase = createServerClient();
  let query = supabase.from('clauses').select('*');

  if (options.contractId) query = query.eq('contract_id', options.contractId);
  if (options.clauseType) query = query.eq('clause_type', options.clauseType);
  if (options.riskLevel) query = query.eq('risk_level', options.riskLevel);
  if (options.flag) query = query.contains('flags', [options.flag]);
  if (options.limit) query = query.limit(options.limit);

  query = query.order('created_at');
  const { data, error } = await query;
  if (error) throw new Error(`Failed to filter clauses: ${error.message}`);
  return (data || []) as Clause[];
}
