import { createServerClient, isSupabaseConfigured } from './client';
import { mockStore } from './mockStore';
import type {
  Clause,
  DefinedTerm,
  SectionMapEntry,
  SectionMapItem,
  DefinedTermItem,
  ResolvedClause,
} from '@/lib/types';

// ============================================================
// Section Map
// ============================================================

export async function insertSectionMap(
  contractId: string,
  sections: SectionMapItem[]
): Promise<void> {
  if (sections.length === 0) return;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const rows = sections.map((s) => ({ ...s, contract_id: contractId }));
      const { error } = await supabase.from('section_map').insert(rows);
      if (!error) return;
      console.warn('Supabase insertSectionMap failed, falling back to local store:', error.message);
    } catch (err) {
      console.warn('Supabase error in insertSectionMap, using local store:', err);
    }
  }

  await mockStore.insertSectionMap(contractId, sections);
}

export async function getSectionMap(contractId: string): Promise<SectionMapEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('section_map')
        .select('*')
        .eq('contract_id', contractId)
        .order('section_number');

      if (!error && data) return data as SectionMapEntry[];
      console.warn('Supabase getSectionMap failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase error in getSectionMap, using local store:', err);
    }
  }

  return mockStore.getSectionMap(contractId);
}

// ============================================================
// Defined Terms
// ============================================================

export async function insertDefinedTerms(
  contractId: string,
  terms: DefinedTermItem[]
): Promise<void> {
  if (terms.length === 0) return;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const rows = terms.map((t) => ({ ...t, contract_id: contractId }));
      const { error } = await supabase.from('defined_terms').insert(rows);
      if (!error) return;
      console.warn('Supabase insertDefinedTerms failed, falling back to local store:', error.message);
    } catch (err) {
      console.warn('Supabase error in insertDefinedTerms, using local store:', err);
    }
  }

  await mockStore.insertDefinedTerms(contractId, terms);
}

export async function getDefinedTerms(contractId: string): Promise<DefinedTerm[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('defined_terms')
        .select('*')
        .eq('contract_id', contractId);

      if (!error && data) return data as DefinedTerm[];
      console.warn('Supabase getDefinedTerms failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase error in getDefinedTerms, using local store:', err);
    }
  }

  return mockStore.getDefinedTerms(contractId);
}

// ============================================================
// Clauses
// ============================================================

export async function insertClauses(
  contractId: string,
  clauses: ResolvedClause[]
): Promise<Clause[]> {
  if (clauses.length === 0) return [];

  if (isSupabaseConfigured()) {
    try {
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
      if (!error && data) return data as Clause[];
      console.warn('Supabase insertClauses failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase error in insertClauses, using local store:', err);
    }
  }

  return mockStore.insertClauses(contractId, clauses);
}

export async function updateClauseEmbedding(
  clauseId: string,
  embedding: number[]
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { error } = await supabase
        .from('clauses')
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', clauseId);
      if (!error) return;
      console.warn('Supabase updateClauseEmbedding failed, falling back to local store:', error.message);
    } catch (err) {
      console.warn('Supabase error in updateClauseEmbedding, using local store:', err);
    }
  }

  await mockStore.updateClauseEmbedding(clauseId, embedding);
}

export async function getClausesByContract(contractId: string): Promise<Clause[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('clauses')
        .select('*')
        .eq('contract_id', contractId)
        .order('section_number');

      if (!error && data) return data as Clause[];
      console.warn('Supabase getClausesByContract failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase error in getClausesByContract, using local store:', err);
    }
  }

  return mockStore.getClausesByContract(contractId);
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
    queryText?: string;
  } = {}
): Promise<(Clause & { similarity: number })[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase.rpc('search_clauses', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: options.matchThreshold ?? 0.35,
        match_count: options.matchCount ?? 20,
        filter_contract_id: options.contractId ?? null,
        filter_clause_type: options.clauseType ?? null,
        filter_risk_level: options.riskLevel ?? null,
        filter_flag: options.flag ?? null,
      });

      if (!error && data) return data as (Clause & { similarity: number })[];
      console.warn('Supabase search_clauses failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase error in searchClauses, using local store:', err);
    }
  }

  return mockStore.searchClauses(queryEmbedding, options);
}

export async function filterClauses(options: {
  contractId?: string;
  clauseType?: string;
  riskLevel?: string;
  flag?: string;
  limit?: number;
}): Promise<Clause[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      let query = supabase.from('clauses').select('*');

      if (options.contractId) query = query.eq('contract_id', options.contractId);
      if (options.clauseType) query = query.eq('clause_type', options.clauseType);
      if (options.riskLevel) query = query.eq('risk_level', options.riskLevel);
      if (options.flag) query = query.contains('flags', [options.flag]);
      if (options.limit) query = query.limit(options.limit);

      query = query.order('created_at');
      const { data, error } = await query;
      if (!error && data) return data as Clause[];
      console.warn('Supabase filterClauses failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase error in filterClauses, using local store:', err);
    }
  }

  return mockStore.filterClauses(options);
}
