import { describe, it, expect } from 'vitest';
import { uploadContractFile, downloadContractFile } from '@/lib/db/storage';
import { createContract, getContract, listContracts, updateContractStatus } from '@/lib/db/contracts';
import { insertSectionMap, getSectionMap, insertDefinedTerms, getDefinedTerms, insertClauses, getClausesByContract, searchClauses } from '@/lib/db/clauses';
import { ruleBasedStructureAnalysis } from '@/lib/pipeline/structureAnalyzer';
import { ruleBasedClauseExtraction } from '@/lib/pipeline/clauseExtractor';
import { resolveReferences } from '@/lib/pipeline/referenceResolver';
import { generateLocalVector } from '@/lib/pipeline/embedder';

describe('Fallback In-Memory Store and Pipeline', () => {
  it('handles contract lifecycle in local store', async () => {
    const contract = await createContract({
      name: 'Test Non-Disclosure Agreement',
      filePath: 'contracts/test-nda.pdf',
    });

    expect(contract.id).toBeDefined();
    expect(contract.name).toBe('Test Non-Disclosure Agreement');
    expect(contract.status).toBe('pending');

    await updateContractStatus(contract.id, 'processing', { pageCount: 3 });
    const fetched = await getContract(contract.id);
    expect(fetched?.status).toBe('processing');
    expect(fetched?.page_count).toBe(3);

    const all = await listContracts();
    expect(all.some((c) => c.id === contract.id)).toBe(true);
  });

  it('stores and retrieves file buffers', async () => {
    const testBuffer = Buffer.from('PDF file content sample');
    const path = 'contracts/sample-test.pdf';

    const { error: uploadError } = await uploadContractFile(path, testBuffer);
    expect(uploadError).toBeNull();

    const { data, error: downloadError } = await downloadContractFile(path);
    expect(downloadError).toBeNull();
    expect(data?.toString()).toBe('PDF file content sample');
  });

  it('runs rule-based structure and clause extraction on contract text', () => {
    const contractText = `
MUTUAL NON-DISCLOSURE AGREEMENT
This Agreement is entered into between Alpha Corp and Beta Inc.

1. Definitions
"Confidential Information" means all proprietary data, financial statements, and technical specifications disclosed hereunder.

2. Term and Termination
Either party may terminate this Agreement pursuant to Section 2.1 upon thirty (30) days prior written notice.

3. Limitation of Liability
IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES. AGGREGATE LIABILITY SHALL BE CAPPED AT $10,000.

4. Governing Law
This Agreement shall be governed by the laws of the State of New York.
    `.trim();

    // 1. Structure Analysis
    const structure = ruleBasedStructureAnalysis(contractText);
    expect(structure.sectionMap.length).toBeGreaterThanOrEqual(3);
    expect(structure.definedTerms.some((t) => t.term === 'Confidential Information')).toBe(true);
    expect(structure.metadata.parties?.length).toBe(2);

    // 2. Clause Extraction
    const rawClauses = ruleBasedClauseExtraction(contractText);
    expect(rawClauses.length).toBeGreaterThan(0);
    const termClause = rawClauses.find((c) => c.clause_type === 'termination');
    expect(termClause).toBeDefined();

    // 3. Reference Resolution
    const resolved = resolveReferences(rawClauses, structure.sectionMap, structure.definedTerms);
    expect(resolved.length).toBe(rawClauses.length);
  });

  it('performs local vector search on clauses', async () => {
    const contract = await createContract({
      name: 'Search Test Contract',
      filePath: 'contracts/search-test.pdf',
    });

    const clauses = [
      {
        section_number: '5.1',
        title: 'Automatic Renewal',
        clause_type: 'auto_renewal' as const,
        content: 'This Agreement automatically renews for 12 months.',
        resolved_context: 'This Agreement automatically renews for 12 months.',
        risk_level: 'high' as const,
        flags: ['auto-renewal'],
        raw_references: [],
        unresolved_references: [],
      },
      {
        section_number: '6.1',
        title: 'Governing Law',
        clause_type: 'governing_law' as const,
        content: 'Governed by the laws of California.',
        resolved_context: 'Governed by the laws of California.',
        risk_level: 'low' as const,
        flags: [],
        raw_references: [],
        unresolved_references: [],
      },
    ];

    await insertClauses(contract.id, clauses);

    const queryVec = generateLocalVector('automatic renewal');
    const searchResults = await searchClauses(queryVec, {
      contractId: contract.id,
      queryText: 'automatic renewal',
    });

    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    expect(searchResults[0].clause_type).toBe('auto_renewal');
  });
});
