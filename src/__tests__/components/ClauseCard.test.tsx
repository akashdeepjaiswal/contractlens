import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClauseCard from '@/components/ClauseCard';
import type { Clause } from '@/lib/types';

const mockClause: Clause = {
  id: 'test-clause-1',
  contract_id: 'contract-1',
  section_number: '8.2',
  title: 'Termination for Convenience',
  clause_type: 'termination',
  content: 'Either party may terminate this Agreement upon 90 days written notice.',
  resolved_context:
    'Either party may terminate this Agreement upon 90 days written notice.\n\n--- Referenced Sections ---\n\n**Section 3.1(b):**\nLate payments shall accrue interest at 1.5% per month.',
  risk_level: 'high',
  flags: ['one-sided-termination'],
  raw_references: ['Section 3.1(b)'],
  unresolved_references: [],
  metadata: {},
  created_at: '2024-01-01T00:00:00Z',
};

describe('ClauseCard', () => {
  it('renders clause title', () => {
    render(<ClauseCard clause={mockClause} />);
    expect(screen.getByText('Termination for Convenience')).toBeInTheDocument();
  });

  it('renders clause type badge', () => {
    render(<ClauseCard clause={mockClause} />);
    expect(screen.getByText('Termination')).toBeInTheDocument();
  });

  it('renders risk level badge', () => {
    render(<ClauseCard clause={mockClause} />);
    expect(screen.getByText(/high risk/i)).toBeInTheDocument();
  });

  it('renders flags', () => {
    render(<ClauseCard clause={mockClause} />);
    expect(screen.getByText(/one-sided-termination/i)).toBeInTheDocument();
  });

  it('renders section number', () => {
    render(<ClauseCard clause={mockClause} />);
    expect(screen.getByText(/§ 8.2/)).toBeInTheDocument();
  });

  it('expands to show clause content on click', () => {
    render(<ClauseCard clause={mockClause} />);
    // Clause content is not initially visible
    expect(screen.queryByText(/90 days written notice/)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: /Termination for Convenience/i }));
    expect(screen.getByText(/90 days written notice/)).toBeInTheDocument();
  });

  it('shows "Show resolved cross-references" when clause has references', () => {
    render(<ClauseCard clause={mockClause} defaultExpanded={true} />);
    expect(screen.getByText(/show resolved cross-references/i)).toBeInTheDocument();
  });

  it('shows resolved context when refs button is clicked', () => {
    render(<ClauseCard clause={mockClause} defaultExpanded={true} />);
    fireEvent.click(screen.getByText(/show resolved cross-references/i));
    expect(screen.getByText(/Late payments shall accrue interest/i)).toBeInTheDocument();
  });

  it('shows contract name when showContract is true', () => {
    render(<ClauseCard clause={mockClause} contractName="Vendor Agreement 2024" showContract={true} />);
    expect(screen.getByText('Vendor Agreement 2024')).toBeInTheDocument();
  });

  it('does not show contract name when showContract is false', () => {
    render(<ClauseCard clause={mockClause} contractName="Vendor Agreement 2024" showContract={false} />);
    expect(screen.queryByText('Vendor Agreement 2024')).not.toBeInTheDocument();
  });

  it('shows similarity score when provided', () => {
    render(<ClauseCard clause={mockClause} similarity={0.87} />);
    expect(screen.getByText(/87% match/)).toBeInTheDocument();
  });

  it('renders clause with no references without cross-ref button', () => {
    const simpleClause: Clause = { ...mockClause, raw_references: [], resolved_context: mockClause.content };
    render(<ClauseCard clause={simpleClause} defaultExpanded={true} />);
    expect(screen.queryByText(/show resolved cross-references/i)).not.toBeInTheDocument();
  });

  it('shows unresolved reference warning when present', () => {
    const unresolvedClause: Clause = {
      ...mockClause,
      unresolved_references: ['Section 99.99'],
      resolved_context:
        mockClause.content + '\n\n--- Referenced Sections ---\n\n--- Unresolved References ---\n[UNRESOLVED: Section 99.99]',
    };
    render(<ClauseCard clause={unresolvedClause} defaultExpanded={true} />);
    fireEvent.click(screen.getByText(/show resolved cross-references/i));
    expect(screen.getByText(/1 unresolved/i)).toBeInTheDocument();
  });
});
