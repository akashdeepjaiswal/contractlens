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

export const RISK_LEVEL_REASONS: Record<RiskLevel, string> = {
  high: 'High risk clauses create severe asymmetric exposure, broad indemnification without caps, or one-sided rights that significantly favor the counterparty.',
  medium: 'Medium risk clauses impose operational commitments, payment milestones, termination notice windows, or conditional liabilities requiring active founder tracking.',
  low: 'Low risk clauses represent standard balanced provisions (such as governing law, standard confidentiality, or routine warranties) with minimal adverse exposure.',
};

export const CLAUSE_TYPE_DESCRIPTIONS: Record<ClauseType, string> = {
  termination: 'Governs agreement duration, notice periods, termination for cause vs. convenience, and post-termination survival.',
  payment: 'Specifies pricing, payment schedules, fee milestones, invoicing terms, expense reimbursements, and late penalties.',
  ip_ownership: 'Defines ownership of background technology, deliverables, work product, and IP licensing scope.',
  liability: 'Sets legal damage caps, exclusions for consequential damages, and financial liability boundaries.',
  indemnification: 'Allocates financial responsibility to defend, hold harmless, and pay third-party claims or damages.',
  auto_renewal: 'Controls automatic renewal mechanisms, contract extension terms, and non-renewal notice deadlines.',
  confidentiality: 'Establishes obligations to protect proprietary information, trade secrets, and non-disclosure standards.',
  dispute_resolution: 'Defines escalation procedures, mediation steps, arbitration rules, and forum for legal disagreements.',
  governing_law: 'Designates the legal jurisdiction, state statutes, and venue that govern agreement interpretation.',
  force_majeure: 'Excuses contractual delays or non-performance caused by unforeseeable events beyond reasonable control.',
  warranties: 'Outlines product/service performance promises, representations, "as-is" disclaimers, and remedies.',
  data_privacy: 'Regulates processing, storage, transfer, and security compliance regarding customer or company data.',
  non_compete: 'Restricts competitive commercial activity, client solicitation, or hiring employees during or after the term.',
  assignment: 'Controls whether either party can assign or transfer rights and obligations to third parties or acquirers.',
  other: 'General contract boilerplate, notices, severability, entire agreement, or miscellaneous provisions.',
};

export const FLAG_DESCRIPTIONS: Record<string, string> = {
  'auto-renewal': 'Automatically renews contract terms and locks in financial commitments unless formally cancelled within a strict advance notice window.',
  'uncapped-liability': 'Exposes your company to unlimited legal damages and third-party claims without a monetary liability cap.',
  'one-sided-termination': 'Permits the counterparty to terminate at will or without penalty, while your organization remains locked into the agreement.',
  'ip-assignment': 'Transfers proprietary inventions, work product, or background intellectual property to the vendor or counterparty.',
  'non-compete': 'Restricts your ability to operate in specific markets, engage clients, or hire key talent during or after the contract.',
  'liquidated-damages': 'Mandates pre-set monetary financial penalties upon breach without requiring proof of actual harm or loss.',
  'broad-indemnification': 'Forces you to defend and cover all counterparty losses or third-party claims with no mutual liability limitation.',
  'no-limitation-of-liability': 'Omits standard limitation of liability protections, leaving you fully exposed to consequential and indirect damages.',
  'mandatory-arbitration': 'Waives court access and jury trial rights, requiring binding confidential private arbitration to resolve disputes.',
  'unilateral-amendment': 'Empowers the vendor to modify terms, pricing, or service conditions without your prior written agreement.',
};

