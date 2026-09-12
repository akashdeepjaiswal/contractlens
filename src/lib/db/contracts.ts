import { createServerClient, isSupabaseConfigured } from './client';
import { mockStore } from './mockStore';
import type { Contract, ContractMetadata, RiskSummary, ContractStatus } from '@/lib/types';

export async function createContract(data: {
  name: string;
  filePath: string | null;
}): Promise<Contract> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data: contract, error } = await supabase
        .from('contracts')
        .insert({
          name: data.name,
          file_path: data.filePath,
          status: 'pending' as ContractStatus,
        })
        .select()
        .single();

      if (!error && contract) return contract as Contract;
      console.warn('Supabase createContract failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase client error in createContract, using local store:', err);
    }
  }

  return mockStore.createContract(data);
}

export async function updateContractStatus(
  id: string,
  status: ContractStatus,
  extra?: {
    rawText?: string;
    pageCount?: number;
    errorMessage?: string;
  }
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { error } = await supabase
        .from('contracts')
        .update({
          status,
          ...(extra?.rawText !== undefined && { raw_text: extra.rawText }),
          ...(extra?.pageCount !== undefined && { page_count: extra.pageCount }),
          ...(extra?.errorMessage !== undefined && { error_message: extra.errorMessage }),
        })
        .eq('id', id);

      if (!error) return;
      console.warn('Supabase updateContractStatus failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase client error in updateContractStatus, using local store:', err);
    }
  }

  await mockStore.updateContractStatus(id, status, extra);
}

export async function updateContractMetadata(
  id: string,
  metadata: ContractMetadata,
  riskSummary: RiskSummary,
  clauseCount: number
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { error } = await supabase
        .from('contracts')
        .update({
          metadata,
          risk_summary: riskSummary,
          clause_count: clauseCount,
          status: 'ready' as ContractStatus,
        })
        .eq('id', id);

      if (!error) return;
      console.warn('Supabase updateContractMetadata failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase client error in updateContractMetadata, using local store:', err);
    }
  }

  await mockStore.updateContractMetadata(id, metadata, riskSummary, clauseCount);
}

export async function getContract(id: string): Promise<Contract | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.warn('Supabase getContract failed, falling back to local store:', error.message);
      } else if (data) {
        return data as Contract;
      }
    } catch (err) {
      console.warn('Supabase client error in getContract, using local store:', err);
    }
  }

  return mockStore.getContract(id);
}

export async function listContracts(): Promise<Contract[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) return data as Contract[];
      console.warn('Supabase listContracts failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase client error in listContracts, using local store:', err);
    }
  }

  return mockStore.listContracts();
}

export async function deleteContract(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { error } = await supabase.from('contracts').delete().eq('id', id);
      if (!error) return;
      console.warn('Supabase deleteContract failed, falling back to local store:', error?.message);
    } catch (err) {
      console.warn('Supabase client error in deleteContract, using local store:', err);
    }
  }

  await mockStore.deleteContract(id);
}
