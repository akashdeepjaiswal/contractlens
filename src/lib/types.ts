// ============================================================
// Shared TypeScript Types for ContractLens
// ============================================================

export type ContractStatus = 'pending' | 'processing' | 'ready' | 'error';

export type ClauseType =
  | 'termination'
  | 'payment'
  | 'ip_ownership'
  | 'liability'
  | 'indemnification'
  | 'auto_renewal'
  | 'confidentiality'
  | 'dispute_resolution'
  | 'governing_law'
  | 'force_majeure'
  | 'warranties'
  | 'data_privacy'
  | 'non_compete'
  | 'assignment'
  | 'other';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ContractFlag =
  | 'auto-renewal'
  | 'uncapped-liability'
  | 'one-sided-termination'
  | 'ip-assignment'
  | 'non-compete'
  | 'liquidated-damages'
  | 'broad-indemnification'
  | 'no-limitation-of-liability'
  | 'mandatory-arbitration'
  | 'unilateral-amendment';

// ============================================================
// Database row types (match Supabase table schemas)
// ============================================================

export interface Contract {
  id: string;
  name: string;
  file_path: string | null;
  status: ContractStatus;
  error_message: string | null;
  raw_text: string | null;
  page_count: number | null;
  metadata: ContractMetadata;
  clause_count: number;
  risk_summary: RiskSummary;
  created_at: string;
  updated_at: string;
}

export interface ContractMetadata {
  parties?: string[];
  date?: string;
  governing_law?: string;
  contract_type?: string;
  effective_date?: string;
  expiry_date?: string;
}

export interface RiskSummary {
  high: number;
  medium: number;
  low: number;
}

export interface DefinedTerm {
  id: string;
  contract_id: string;
  term: string;
  definition: string;
  section_ref: string | null;
  created_at: string;
}

export interface SectionMapEntry {
  id: string;
  contract_id: string;
  section_number: string;
  title: string | null;
  content: string;
  depth: number;
  created_at: string;
}

export interface Clause {
  id: string;
  contract_id: string;
  section_number: string | null;
  title: string | null;
  clause_type: ClauseType;
  content: string;
  resolved_context: string | null;
  risk_level: RiskLevel;
  flags: string[];
  raw_references: string[];
  unresolved_references: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// Pipeline types (intermediate processing structures)
// ============================================================

export interface ExtractedPDF {
  fullText: string;
  pages: string[];
  pageCount: number;
}

export interface StructureAnalysis {
  sectionMap: SectionMapItem[];
  definedTerms: DefinedTermItem[];
  metadata: ContractMetadata;
}

export interface SectionMapItem {
  section_number: string;
  title: string | null;
  content: string;
  depth: number;
}

export interface DefinedTermItem {
  term: string;
  definition: string;
  section_ref: string | null;
}

export interface RawClause {
  section_number: string | null;
  title: string | null;
  clause_type: ClauseType;
  content: string;
  risk_level: RiskLevel;
  flags: string[];
  raw_references: string[];
}

export interface ResolvedClause extends RawClause {
  resolved_context: string;
  unresolved_references: string[];
}

// ============================================================
// API Request/Response types
// ============================================================

export interface UploadResponse {
  contractId: string;
  name: string;
}

export interface ProcessingEvent {
  stage: ProcessingStage;
  message: string;
  progress: number; // 0-100
  error?: string;
}

export type ProcessingStage =
  | 'extracting'
  | 'analyzing_structure'
  | 'extracting_clauses'
  | 'resolving_references'
  | 'generating_embeddings'
  | 'done'
  | 'error';

export interface QueryRequest {
  query: string;
  filters?: {
    contractId?: string;
    clauseType?: ClauseType;
    riskLevel?: RiskLevel;
    flag?: string;
  };
  limit?: number;
}

export interface QueryResult {
  clause: Clause;
  contract: Pick<Contract, 'id' | 'name' | 'metadata'>;
  similarity: number;
}

export interface QueryResponse {
  results: QueryResult[];
  query: string;
  totalFound: number;
}

// ============================================================
// UI types
// ============================================================

export interface ContractWithClauses extends Contract {
  clauses: Clause[];
}

export const CLAUSE_TYPE_LABELS: Record<ClauseType, string> = {
  termination: 'Termination',
  payment: 'Payment',
  ip_ownership: 'IP Ownership',
  liability: 'Liability',
  indemnification: 'Indemnification',
  auto_renewal: 'Auto-Renewal',
  confidentiality: 'Confidentiality',
  dispute_resolution: 'Dispute Resolution',
  governing_law: 'Governing Law',
  force_majeure: 'Force Majeure',
  warranties: 'Warranties',
  data_privacy: 'Data Privacy',
  non_compete: 'Non-Compete',
  assignment: 'Assignment',
  other: 'Other',
};

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};
