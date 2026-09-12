import { describe, it, expect } from 'vitest';
import {
  resolveReferences,
  extractSectionNumber,
  stripSubClause,
} from '@/lib/pipeline/referenceResolver';
import type { RawClause, SectionMapItem, DefinedTermItem } from '@/lib/types';

// ============================================================
// Test fixtures
// ============================================================

const sectionMap: SectionMapItem[] = [
  {
    section_number: '1',
    title: 'Definitions',
    content: 'For purposes of this Agreement, the following terms shall have the meanings set forth herein.',
    depth: 0,
  },
  {
    section_number: '3.1',
    title: 'Payment Terms',
    content: 'Customer shall pay all fees within thirty (30) days of receipt of invoice.',
    depth: 1,
  },
  {
    section_number: '3.1(b)',
    title: null,
    content: 'Late payments shall accrue interest at 1.5% per month compounded monthly.',
    depth: 2,
  },
  {
    section_number: 'Exhibit A',
    title: 'Minimum Commitment',
    content: 'The Minimum Commitment shall be USD 50,000 per year for the Initial Term.',
    depth: 0,
  },
  {
    section_number: '8.2',
    title: 'Termination for Convenience',
    content: 'Either party may terminate this Agreement with 90 days written notice.',
    depth: 1,
  },
];

const definedTerms: DefinedTermItem[] = [
  {
    term: 'Agreement',
    definition: 'This Software License Agreement dated January 1, 2024.',
    section_ref: 'Preamble',
  },
  {
    term: 'Minimum Commitment',
    definition: 'As defined in Exhibit A.',
    section_ref: 'Exhibit A',
  },
  {
    term: 'Services',
    definition: 'The software services described in Exhibit B.',
    section_ref: '2.1',
  },
];

// ============================================================
// extractSectionNumber
// ============================================================
describe('extractSectionNumber', () => {
  it('extracts bare section number "Section 3.1(b)"', () => {
    expect(extractSectionNumber('Section 3.1(b)')).toBe('3.1(b)');
  });

  it('extracts clause format "Clause 5"', () => {
    expect(extractSectionNumber('Clause 5')).toBe('5');
  });

  it('extracts exhibit "Exhibit A"', () => {
    expect(extractSectionNumber('Exhibit A')).toBe('Exhibit A');
  });

  it('extracts schedule "Schedule 2"', () => {
    expect(extractSectionNumber('Schedule 2')).toBe('Schedule 2');
  });

  it('returns null for non-reference strings', () => {
    expect(extractSectionNumber('the Minimum Commitment')).toBeNull();
    expect(extractSectionNumber('this Agreement')).toBeNull();
  });

  it('handles "Article 3"', () => {
    expect(extractSectionNumber('Article 3')).toBe('3');
  });
});

// ============================================================
// stripSubClause
// ============================================================
describe('stripSubClause', () => {
  it('strips parenthetical sub-clause', () => {
    expect(stripSubClause('3.1(b)')).toBe('3.1');
  });

  it('strips last dot segment', () => {
    expect(stripSubClause('3.1.2')).toBe('3.1');
  });

  it('does not strip top-level number', () => {
    expect(stripSubClause('3')).toBe('3');
  });

  it('handles already-stripped number', () => {
    expect(stripSubClause('3.1')).toBe('3');
  });
});

// ============================================================
// resolveReferences — core cross-reference resolution
// ============================================================
describe('resolveReferences', () => {
  it('resolves an exact section number reference', () => {
    const clause: RawClause = {
      section_number: '8.2',
      title: 'Termination for Convenience',
      clause_type: 'termination',
      content: 'Termination may occur pursuant to Section 3.1(b).',
      risk_level: 'medium',
      flags: [],
      raw_references: ['Section 3.1(b)'],
    };

    const [resolved] = resolveReferences([clause], sectionMap, definedTerms);

    expect(resolved.unresolved_references).toHaveLength(0);
    expect(resolved.resolved_context).toContain('Late payments shall accrue interest');
    expect(resolved.resolved_context).toContain('Section 3.1(b)');
  });

  it('resolves a defined term reference', () => {
    const clause: RawClause = {
      section_number: '5.1',
      title: 'Fees',
      clause_type: 'payment',
      content: 'Customer shall pay fees subject to the Minimum Commitment.',
      risk_level: 'medium',
      flags: [],
      raw_references: ['the Minimum Commitment'],
    };

    const [resolved] = resolveReferences([clause], sectionMap, definedTerms);

    expect(resolved.unresolved_references).toHaveLength(0);
    expect(resolved.resolved_context).toContain('As defined in Exhibit A');
  });

  it('resolves an Exhibit reference', () => {
    const clause: RawClause = {
      section_number: '2.1',
      title: 'Services',
      clause_type: 'other',
      content: 'Vendor shall provide services as described in Exhibit A.',
      risk_level: 'low',
      flags: [],
      raw_references: ['Exhibit A'],
    };

    const [resolved] = resolveReferences([clause], sectionMap, definedTerms);

    expect(resolved.unresolved_references).toHaveLength(0);
    expect(resolved.resolved_context).toContain('USD 50,000');
  });

  it('tracks unresolvable references', () => {
    const clause: RawClause = {
      section_number: '1.1',
      title: 'Scope',
      clause_type: 'other',
      content: 'Subject to Section 99.99 which does not exist.',
      risk_level: 'low',
      flags: [],
      raw_references: ['Section 99.99'],
    };

    const [resolved] = resolveReferences([clause], sectionMap, definedTerms);

    expect(resolved.unresolved_references).toContain('Section 99.99');
    expect(resolved.resolved_context).toContain('[UNRESOLVED: Section 99.99]');
  });

  it('handles clauses with no references (passthrough)', () => {
    const clause: RawClause = {
      section_number: '9',
      title: 'Governing Law',
      clause_type: 'governing_law',
      content: 'This Agreement is governed by the laws of California.',
      risk_level: 'low',
      flags: [],
      raw_references: [],
    };

    const [resolved] = resolveReferences([clause], sectionMap, definedTerms);

    expect(resolved.resolved_context).toBe(clause.content);
    expect(resolved.unresolved_references).toHaveLength(0);
  });

  it('processes multiple clauses independently', () => {
    const clauses: RawClause[] = [
      {
        section_number: '3.1',
        title: 'Payment',
        clause_type: 'payment',
        content: 'Payment per Section 3.1(b).',
        risk_level: 'low',
        flags: [],
        raw_references: ['Section 3.1(b)'],
      },
      {
        section_number: '8.2',
        title: 'Termination',
        clause_type: 'termination',
        content: 'Termination per Section 3.1.',
        risk_level: 'medium',
        flags: ['one-sided-termination'],
        raw_references: ['Section 3.1'],
      },
    ];

    const resolved = resolveReferences(clauses, sectionMap, definedTerms);

    expect(resolved).toHaveLength(2);
    expect(resolved[0].resolved_context).toContain('Late payments');
    expect(resolved[1].resolved_context).toContain('Customer shall pay');
  });

  it('resolves case-insensitively for defined terms', () => {
    const clause: RawClause = {
      section_number: '1.1',
      title: 'Scope',
      clause_type: 'other',
      content: 'Per the SERVICES defined herein.',
      risk_level: 'low',
      flags: [],
      raw_references: ['the SERVICES'],
    };

    const [resolved] = resolveReferences([clause], sectionMap, definedTerms);
    // "SERVICES" normalized to "services" which matches "Services" term
    expect(resolved.unresolved_references).toHaveLength(0);
    expect(resolved.resolved_context).toContain('software services');
  });
});
