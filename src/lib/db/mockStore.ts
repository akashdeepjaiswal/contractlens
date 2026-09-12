import type {
  Contract,
  ContractMetadata,
  RiskSummary,
  ContractStatus,
  Clause,
  DefinedTerm,
  SectionMapEntry,
  SectionMapItem,
  DefinedTermItem,
  ResolvedClause,
} from '@/lib/types';
import fs from 'fs';
import path from 'path';

interface StoreState {
  contracts: Record<string, Contract>;
  sectionMaps: Record<string, SectionMapEntry[]>;
  definedTerms: Record<string, DefinedTerm[]>;
  clauses: Record<string, Clause[]>;
  embeddings: Record<string, number[]>;
  fileBuffers: Record<string, string>; // base64 encoded for JSON persistence
}

const TMP_STORE_FILE = path.join('/tmp', 'contractlens_store.json');

// Global singleton to preserve state across hot reloads and Next.js route requests
declare global {
  // eslint-disable-next-line no-var
  var __contractlens_store: StoreState | undefined;
}

function loadState(): StoreState {
  if (globalThis.__contractlens_store) {
    return globalThis.__contractlens_store;
  }

  // Try loading from /tmp
  try {
    if (fs.existsSync(TMP_STORE_FILE)) {
      const raw = fs.readFileSync(TMP_STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as StoreState;
      if (!parsed.embeddings) parsed.embeddings = {};
      globalThis.__contractlens_store = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn('Could not read from tmp store:', err);
  }

  // Default seed with sample contract
  const seedState: StoreState = {
    contracts: {},
    sectionMaps: {},
    definedTerms: {},
    clauses: {},
    embeddings: {},
    fileBuffers: {},
  };

  // Seed sample contract for instant interactive evaluation
  const sampleContractId = 'sample-saas-agreement-001';
  const now = new Date().toISOString();

  seedState.contracts[sampleContractId] = {
    id: sampleContractId,
    name: 'Sample SaaS Master Services Agreement',
    file_path: 'contracts/sample-saas-agreement.pdf',
    status: 'ready',
    error_message: null,
    raw_text: 'MASTER SERVICES AGREEMENT between Acme Cloud Inc and Client Corp...',
    page_count: 8,
    clause_count: 5,
    risk_summary: { high: 2, medium: 2, low: 1 },
    metadata: {
      parties: ['Acme Cloud Technologies Inc.', 'Client Enterprise Corp'],
      date: 'January 15, 2025',
      governing_law: 'State of Delaware',
      contract_type: 'Master Services Agreement',
      effective_date: '2025-02-01',
    },
    created_at: now,
    updated_at: now,
  };

  seedState.sectionMaps[sampleContractId] = [
    {
      id: 'sm-1',
      contract_id: sampleContractId,
      section_number: '1',
      title: 'Definitions',
      content: '1. Definitions. As used in this Agreement, the following terms have meanings set forth below...',
      depth: 1,
      created_at: now,
    },
    {
      id: 'sm-2',
      contract_id: sampleContractId,
      section_number: '3.2',
      title: 'Termination for Convenience',
      content: '3.2 Termination for Convenience. Either party may terminate upon 60 days written notice subject to Minimum Commitment.',
      depth: 2,
      created_at: now,
    },
    {
      id: 'sm-3',
      contract_id: sampleContractId,
      section_number: '4',
      title: 'Fees and Minimum Spend',
      content: '4. Fees. Client agrees to satisfy Minimum Spend of $50,000 annually.',
      depth: 1,
      created_at: now,
    },
    {
      id: 'sm-4',
      contract_id: sampleContractId,
      section_number: '7',
      title: 'Limitation of Liability',
      content: '7. Limitation of Liability. Except for indemnification, aggregate liability capped at fees paid in prior 12 months.',
      depth: 1,
      created_at: now,
    },
    {
      id: 'sm-5',
      contract_id: sampleContractId,
      section_number: '8',
      title: 'Indemnification',
      content: '8. Indemnification. Vendor defends Client against third party infringement claims.',
      depth: 1,
      created_at: now,
    },
  ];

  seedState.definedTerms[sampleContractId] = [
    {
      id: 'dt-1',
      contract_id: sampleContractId,
      term: 'Minimum Spend',
      definition: 'A non-refundable commitment of $50,000 USD payable per annual term.',
      section_ref: '4',
      created_at: now,
    },
    {
      id: 'dt-2',
      contract_id: sampleContractId,
      term: 'Confidential Information',
      definition: 'All proprietary software, technical specs, security documentation, and pricing.',
      section_ref: '1',
      created_at: now,
    },
  ];

  seedState.clauses[sampleContractId] = [
    {
      id: 'cl-1',
      contract_id: sampleContractId,
      section_number: '3.2',
      title: 'Termination and Early Cancellation',
      clause_type: 'termination',
      content: 'Termination may occur pursuant to Section 3.2 subject to the Minimum Spend defined in Section 4. Customer must provide 60 days written notice.',
      resolved_context: 'Termination may occur pursuant to Section 3.2 subject to the Minimum Spend defined in Section 4. Customer must provide 60 days written notice.\n\n--- Referenced: Section 3.2 ---\nEither party may terminate upon 60 days written notice subject to Minimum Commitment.\n\n--- Defined Term: Minimum Spend ---\nA non-refundable commitment of $50,000 USD payable per annual term.',
      risk_level: 'medium',
      flags: ['one-sided-termination'],
      raw_references: ['Section 3.2', 'Section 4'],
      unresolved_references: [],
      metadata: {},
      created_at: now,
    },
    {
      id: 'cl-2',
      contract_id: sampleContractId,
      section_number: '3.1',
      title: 'Term and Automatic Renewal',
      clause_type: 'auto_renewal',
      content: 'This Agreement shall automatically renew for successive 12-month periods unless either party delivers written notice of non-renewal at least 45 days prior to expiration.',
      resolved_context: 'This Agreement shall automatically renew for successive 12-month periods unless either party delivers written notice of non-renewal at least 45 days prior to expiration.',
      risk_level: 'high',
      flags: ['auto-renewal'],
      raw_references: [],
      unresolved_references: [],
      metadata: {},
      created_at: now,
    },
    {
      id: 'cl-3',
      contract_id: sampleContractId,
      section_number: '7.1',
      title: 'Limitation of Liability and Cap',
      clause_type: 'liability',
      content: 'EXCEPT FOR INDEMNIFICATION OBLIGATIONS UNDER SECTION 8, NEITHER PARTY SHALL BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES. AGGREGATE LIABILITY IS CAPPED AT TOTAL FEES PAID IN PRECEDING 12 MONTHS.',
      resolved_context: 'EXCEPT FOR INDEMNIFICATION OBLIGATIONS UNDER SECTION 8, NEITHER PARTY SHALL BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES. AGGREGATE LIABILITY IS CAPPED AT TOTAL FEES PAID IN PRECEDING 12 MONTHS.\n\n--- Referenced: Section 8 ---\nVendor defends Client against third party infringement claims.',
      risk_level: 'medium',
      flags: ['uncapped-liability'],
      raw_references: ['Section 8'],
      unresolved_references: [],
      metadata: {},
      created_at: now,
    },
    {
      id: 'cl-4',
      contract_id: sampleContractId,
      section_number: '8.1',
      title: 'Vendor IP Indemnification',
      clause_type: 'indemnification',
      content: 'Vendor shall defend, indemnify, and hold harmless Customer against any third-party claims alleging infringement of patent, copyright, or trademark.',
      resolved_context: 'Vendor shall defend, indemnify, and hold harmless Customer against any third-party claims alleging infringement of patent, copyright, or trademark.',
      risk_level: 'high',
      flags: ['broad-indemnification'],
      raw_references: [],
      unresolved_references: [],
      metadata: {},
      created_at: now,
    },
    {
      id: 'cl-5',
      contract_id: sampleContractId,
      section_number: '12.4',
      title: 'Governing Law and Jurisdiction',
      clause_type: 'governing_law',
      content: 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.',
      resolved_context: 'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.',
      risk_level: 'low',
      flags: [],
      raw_references: [],
      unresolved_references: [],
      metadata: {},
      created_at: now,
    },
  ];

  globalThis.__contractlens_store = seedState;
  saveState(seedState);
  return seedState;
}

function saveState(state: StoreState) {
  try {
    fs.writeFileSync(TMP_STORE_FILE, JSON.stringify(state), 'utf-8');
  } catch (err) {
    // Non-fatal if /tmp is not writable in some environments
    console.warn('Could not save to tmp store:', err);
  }
}

export class MockStore {
  private get state(): StoreState {
    return loadState();
  }

  // Contracts
  async createContract(data: { id?: string; name: string; filePath: string | null }): Promise<Contract> {
    const state = this.state;
    const id = data.id || `contract-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const contract: Contract = {
      id,
      name: data.name,
      file_path: data.filePath,
      status: 'pending',
      error_message: null,
      raw_text: null,
      page_count: null,
      metadata: {},
      clause_count: 0,
      risk_summary: { high: 0, medium: 0, low: 0 },
      created_at: now,
      updated_at: now,
    };

    state.contracts[id] = contract;
    saveState(state);
    return contract;
  }

  async updateContractStatus(
    id: string,
    status: ContractStatus,
    extra?: { rawText?: string; pageCount?: number; errorMessage?: string }
  ): Promise<void> {
    const state = this.state;
    const contract = state.contracts[id];
    if (contract) {
      contract.status = status;
      contract.updated_at = new Date().toISOString();
      if (extra?.rawText !== undefined) contract.raw_text = extra.rawText;
      if (extra?.pageCount !== undefined) contract.page_count = extra.pageCount;
      if (extra?.errorMessage !== undefined) contract.error_message = extra.errorMessage;
      saveState(state);
    }
  }

  async updateContractMetadata(
    id: string,
    metadata: ContractMetadata,
    riskSummary: RiskSummary,
    clauseCount: number
  ): Promise<void> {
    const state = this.state;
    const contract = state.contracts[id];
    if (contract) {
      contract.metadata = metadata;
      contract.risk_summary = riskSummary;
      contract.clause_count = clauseCount;
      contract.status = 'ready';
      contract.updated_at = new Date().toISOString();
      saveState(state);
    }
  }

  async getContract(id: string): Promise<Contract | null> {
    return this.state.contracts[id] || null;
  }

  async listContracts(): Promise<Contract[]> {
    const list = Object.values(this.state.contracts);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async deleteContract(id: string): Promise<void> {
    const state = this.state;
    delete state.contracts[id];
    delete state.sectionMaps[id];
    delete state.definedTerms[id];
    delete state.clauses[id];
    saveState(state);
  }

  // Section Map
  async insertSectionMap(contractId: string, sections: SectionMapItem[]): Promise<void> {
    const state = this.state;
    const now = new Date().toISOString();
    const rows: SectionMapEntry[] = sections.map((s, idx) => ({
      id: `sm-${contractId}-${idx}`,
      contract_id: contractId,
      section_number: s.section_number,
      title: s.title,
      content: s.content,
      depth: s.depth,
      created_at: now,
    }));
    state.sectionMaps[contractId] = rows;
    saveState(state);
  }

  async getSectionMap(contractId: string): Promise<SectionMapEntry[]> {
    return this.state.sectionMaps[contractId] || [];
  }

  // Defined Terms
  async insertDefinedTerms(contractId: string, terms: DefinedTermItem[]): Promise<void> {
    const state = this.state;
    const now = new Date().toISOString();
    const rows: DefinedTerm[] = terms.map((t, idx) => ({
      id: `dt-${contractId}-${idx}`,
      contract_id: contractId,
      term: t.term,
      definition: t.definition,
      section_ref: t.section_ref,
      created_at: now,
    }));
    state.definedTerms[contractId] = rows;
    saveState(state);
  }

  async getDefinedTerms(contractId: string): Promise<DefinedTerm[]> {
    return this.state.definedTerms[contractId] || [];
  }

  // Clauses
  async insertClauses(contractId: string, clauses: ResolvedClause[]): Promise<Clause[]> {
    const state = this.state;
    const now = new Date().toISOString();
    const rows: Clause[] = clauses.map((c, idx) => ({
      id: `cl-${contractId}-${idx}`,
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
      metadata: {},
      created_at: now,
    }));
    state.clauses[contractId] = rows;
    saveState(state);
    return rows;
  }

  async updateClauseEmbedding(clauseId: string, embedding: number[]): Promise<void> {
    const state = this.state;
    state.embeddings[clauseId] = embedding;
    saveState(state);
  }

  async getClausesByContract(contractId: string): Promise<Clause[]> {
    return this.state.clauses[contractId] || [];
  }

  async filterClauses(options: {
    contractId?: string;
    clauseType?: string;
    riskLevel?: string;
    flag?: string;
    limit?: number;
  }): Promise<Clause[]> {
    const state = this.state;
    let pool: Clause[] = [];

    if (options.contractId) {
      pool = state.clauses[options.contractId] || [];
    } else {
      pool = Object.values(state.clauses).flat();
    }

    let filtered = pool.filter((c) => {
      if (options.clauseType && c.clause_type !== options.clauseType) return false;
      if (options.riskLevel && c.risk_level !== options.riskLevel) return false;
      if (options.flag && !c.flags.includes(options.flag)) return false;
      return true;
    });

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }

  async searchClauses(
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
    const state = this.state;
    let pool: Clause[] = [];

    if (options.contractId) {
      pool = state.clauses[options.contractId] || [];
    } else {
      pool = Object.values(state.clauses).flat();
    }

    // Apply strict filters
    let candidates = pool.filter((c) => {
      if (options.clauseType && c.clause_type !== options.clauseType) return false;
      if (options.riskLevel && c.risk_level !== options.riskLevel) return false;
      if (options.flag && !c.flags.includes(options.flag)) return false;
      return true;
    });

    const queryTokens = (options.queryText || '')
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2);

    const scored = candidates.map((clause) => {
      let similarity = 0.5;

      // If embeddings are present, calculate cosine similarity
      const clauseVec = state.embeddings[clause.id];
      if (clauseVec && queryEmbedding && queryEmbedding.length > 0) {
        if (Array.isArray(clauseVec) && clauseVec.length === queryEmbedding.length) {
          let dot = 0;
          for (let i = 0; i < clauseVec.length; i++) {
            dot += clauseVec[i] * queryEmbedding[i];
          }
          similarity = Math.max(0, Math.min(1, (dot + 1) / 2));
        }
      }

      // Keyword / semantic text match bonus
      if (queryTokens.length > 0) {
        const text = `${clause.title || ''} ${clause.clause_type} ${clause.content} ${clause.resolved_context || ''}`.toLowerCase();
        let matchCount = 0;
        for (const token of queryTokens) {
          if (text.includes(token)) matchCount++;
        }
        const textScore = matchCount / queryTokens.length;
        similarity = Math.max(similarity, 0.4 + textScore * 0.55);
      }

      return {
        ...clause,
        similarity: Math.round(similarity * 100) / 100,
      };
    });

    const threshold = options.matchThreshold ?? 0.35;
    const sorted = scored
      .filter((c) => c.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    return sorted.slice(0, options.matchCount ?? 20);
  }

  // Storage
  async saveFile(filePath: string, buffer: Buffer): Promise<void> {
    const state = this.state;
    state.fileBuffers[filePath] = buffer.toString('base64');
    saveState(state);

    // Also write to disk if possible
    try {
      const diskPath = path.join('/tmp', path.basename(filePath));
      fs.writeFileSync(diskPath, buffer);
    } catch {
      // ignore
    }
  }

  async getFile(filePath: string): Promise<Buffer | null> {
    const state = this.state;
    const b64 = state.fileBuffers[filePath];
    if (b64) {
      return Buffer.from(b64, 'base64');
    }

    // Try disk fallback
    try {
      const diskPath = path.join('/tmp', path.basename(filePath));
      if (fs.existsSync(diskPath)) {
        return fs.readFileSync(diskPath);
      }
    } catch {
      // ignore
    }

    return null;
  }
}

export const mockStore = new MockStore();
