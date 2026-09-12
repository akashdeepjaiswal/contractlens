import { createServerClient } from './client';
import type { Contract, ContractMetadata, RiskSummary, ContractStatus } from '@/lib/types';

export async function createContract(data: {
  name: string;
  filePath: string | null;
}): Promise<Contract> {
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

  if (error) throw new Error(`Failed to create contract: ${error.message}`);
  return contract as Contract;
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

  if (error) throw new Error(`Failed to update contract status: ${error.message}`);
}

export async function updateContractMetadata(
  id: string,
  metadata: ContractMetadata,
  riskSummary: RiskSummary,
  clauseCount: number
): Promise<void> {
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

  if (error) throw new Error(`Failed to update contract metadata: ${error.message}`);
}

export async function getContract(id: string): Promise<Contract | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get contract: ${error.message}`);
  }
  return data as Contract;
}

export async function listContracts(): Promise<Contract[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list contracts: ${error.message}`);
  return (data || []) as Contract[];
}

export async function deleteContract(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('contracts').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete contract: ${error.message}`);
}
