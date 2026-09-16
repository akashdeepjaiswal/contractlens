'use client';

import type { Contract, Clause, ClauseType, SectionMapEntry, DefinedTerm } from '@/lib/types';
import { CLAUSE_TYPE_LABELS } from '@/lib/types';

interface ContractSummaryProps {
  contract: Contract;
  clauses: Clause[];
  sectionMap: SectionMapEntry[];
  definedTerms: DefinedTerm[];
  activeRiskFilter?: 'all' | 'high' | 'medium' | 'low';
  onSelectRiskFilter?: (risk: 'all' | 'high' | 'medium' | 'low') => void;
  activeTypeFilter?: 'all' | ClauseType;
  onSelectTypeFilter?: (type: 'all' | ClauseType) => void;
  activeFlagFilter?: string | null;
  onSelectFlagFilter?: (flag: string | null) => void;
  onToggleGlossary?: () => void;
  onToggleStructure?: () => void;
}

const RISK_EMOJI: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };

// Pull the most important flags across all clauses, deduplicated
function getTopFlags(clauses: Clause[]): string[] {
  const counts: Record<string, number> = {};
  for (const c of clauses) {
    for (const f of c.flags) {
      counts[f] = (counts[f] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([f]) => f);
}

// Build a brief narrative from what we know (no extra LLM call)
function buildNarrative(contract: Contract, clauses: Clause[]): string {
  const parts: string[] = [];

  const type = contract.metadata?.contract_type || 'contract';
  const parties = contract.metadata?.parties?.length
    ? contract.metadata.parties.join(' and ')
    : null;
  const govLaw = contract.metadata?.governing_law;

  if (parties) {
    parts.push(`This ${type} is between ${parties}.`);
  } else {
    parts.push(`This is a ${type}.`);
  }

  if (govLaw) parts.push(`Governed by ${govLaw} law.`);

  const highRisk = clauses.filter((c) => c.risk_level === 'high').length;
  const total = clauses.length;

  if (total > 0) {
    if (highRisk > 0) {
      parts.push(`${highRisk} of ${total} clauses are marked high risk — review before signing.`);
    } else {
      parts.push(`${total} clauses extracted — no high-risk provisions flagged.`);
    }
  }

  const hasAutoRenewal = clauses.some((c) => c.flags.includes('auto-renewal'));
  if (hasAutoRenewal) parts.push('⚠ Contains auto-renewal — check notice periods.');

  const hasUncapped = clauses.some((c) => c.flags.includes('uncapped-liability'));
  if (hasUncapped) parts.push('⚠ Contains uncapped liability provisions.');

  return parts.join(' ');
}

export default function ContractSummary({
  contract,
  clauses,
  sectionMap,
  definedTerms,
  activeRiskFilter = 'all',
  onSelectRiskFilter,
  activeTypeFilter = 'all',
  onSelectTypeFilter,
  activeFlagFilter = null,
  onSelectFlagFilter,
  onToggleGlossary,
  onToggleStructure,
}: ContractSummaryProps) {
  const total = clauses.length;
  const highCount = clauses.filter((c) => c.risk_level === 'high').length;
  const medCount = clauses.filter((c) => c.risk_level === 'medium').length;
  const lowCount = clauses.filter((c) => c.risk_level === 'low').length;

  const topTypes = Object.entries(
    clauses.reduce((acc, c) => {
      acc[c.clause_type] = (acc[c.clause_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  const topFlags = getTopFlags(clauses);
  const narrative = buildNarrative(contract, clauses);

  const isAllSelected = activeRiskFilter === 'all' && activeTypeFilter === 'all' && !activeFlagFilter;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
      {/* Top narrative strip */}
      <div
        style={{
          padding: 'var(--space-5) var(--space-6)',
          borderBottom: '1px solid var(--color-border)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(99,102,241,0.01) 100%)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-4)',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 'var(--radius-lg)',
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontSize: 20,
        }}>
          📋
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-primary-light)',
            marginBottom: 6,
          }}>
            Contract Overview
          </p>
          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
          }}>
            {narrative}
          </p>
        </div>
      </div>

      {/* Interactive Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        borderBottom: total > 0 ? '1px solid var(--color-border)' : undefined,
      }}>
        {/* Total Clauses card */}
        <div
          onClick={() => {
            if (onSelectRiskFilter) onSelectRiskFilter('all');
            if (onSelectTypeFilter) onSelectTypeFilter('all');
            if (onSelectFlagFilter) onSelectFlagFilter(null);
          }}
          className={`stat-filter-card stat-total ${isAllSelected ? 'active' : ''}`}
          title="Click to reset filters and view all clauses"
          role="button"
          tabIndex={0}
        >
          <p style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
            {total}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Total Clauses</p>
          {isAllSelected && (
            <span className="stat-active-badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary-light)' }}>
              All
            </span>
          )}
        </div>

        {/* High Risk card */}
        <div
          onClick={() => onSelectRiskFilter && onSelectRiskFilter(activeRiskFilter === 'high' ? 'all' : 'high')}
          className={`stat-filter-card stat-high ${activeRiskFilter === 'high' ? 'active' : ''}`}
          title="Click to filter high risk clauses"
          role="button"
          tabIndex={0}
        >
          <p style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--color-risk-high)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
            {highCount}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>High Risk</p>
          {activeRiskFilter === 'high' ? (
            <span className="stat-active-badge" style={{ background: 'var(--color-risk-high-bg)', color: 'var(--color-risk-high)' }}>
              ✓ Active
            </span>
          ) : (
            <span className="stat-active-badge" style={{ opacity: 0.6, fontSize: '0.5625rem', color: 'var(--color-risk-high)' }}>
              Filter
            </span>
          )}
        </div>

        {/* Medium Risk card */}
        <div
          onClick={() => onSelectRiskFilter && onSelectRiskFilter(activeRiskFilter === 'medium' ? 'all' : 'medium')}
          className={`stat-filter-card stat-medium ${activeRiskFilter === 'medium' ? 'active' : ''}`}
          title="Click to filter medium risk clauses"
          role="button"
          tabIndex={0}
        >
          <p style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--color-risk-medium)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
            {medCount}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Medium Risk</p>
          {activeRiskFilter === 'medium' ? (
            <span className="stat-active-badge" style={{ background: 'var(--color-risk-medium-bg)', color: 'var(--color-risk-medium)' }}>
              ✓ Active
            </span>
          ) : (
            <span className="stat-active-badge" style={{ opacity: 0.6, fontSize: '0.5625rem', color: 'var(--color-risk-medium)' }}>
              Filter
            </span>
          )}
        </div>

        {/* Low Risk card */}
        <div
          onClick={() => onSelectRiskFilter && onSelectRiskFilter(activeRiskFilter === 'low' ? 'all' : 'low')}
          className={`stat-filter-card stat-low ${activeRiskFilter === 'low' ? 'active' : ''}`}
          title="Click to filter low risk clauses"
          role="button"
          tabIndex={0}
        >
          <p style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--color-risk-low)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
            {lowCount}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Low Risk</p>
          {activeRiskFilter === 'low' ? (
            <span className="stat-active-badge" style={{ background: 'var(--color-risk-low-bg)', color: 'var(--color-risk-low)' }}>
              ✓ Active
            </span>
          ) : (
            <span className="stat-active-badge" style={{ opacity: 0.6, fontSize: '0.5625rem', color: 'var(--color-risk-low)' }}>
              Filter
            </span>
          )}
        </div>

        {/* Defined Terms card */}
        <div
          onClick={() => onToggleGlossary && onToggleGlossary()}
          className="stat-filter-card stat-terms"
          title="Click to view Defined Terms glossary"
          role="button"
          tabIndex={0}
        >
          <p style={{ fontSize: '1.625rem', fontWeight: 700, color: '#8b5cf6', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
            {definedTerms.length}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Defined Terms</p>
          <span className="stat-active-badge" style={{ opacity: 0.7, fontSize: '0.5625rem', color: '#8b5cf6' }}>
            Glossary 📖
          </span>
        </div>

        {/* Sections card */}
        <div
          onClick={() => onToggleStructure && onToggleStructure()}
          className="stat-filter-card stat-sections"
          title="Click to view Document Structure"
          role="button"
          tabIndex={0}
        >
          <p style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--color-text-secondary)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
            {sectionMap.length}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Sections</p>
          <span className="stat-active-badge" style={{ opacity: 0.7, fontSize: '0.5625rem', color: 'var(--color-text-secondary)' }}>
            Outline 🗂
          </span>
        </div>
      </div>

      {/* Bottom row: clause breakdown + top flags */}
      {total > 0 && (
        <div style={{
          padding: 'var(--space-4) var(--space-6)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-5)',
          alignItems: 'flex-start',
        }}>
          {/* Clause type breakdown */}
          {topTypes.length > 0 && (
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
                Clause Breakdown <span style={{ textTransform: 'none', fontWeight: 400 }}>(click to filter)</span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {topTypes.map(([type, count]) => {
                  const isActive = activeTypeFilter === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onSelectTypeFilter && onSelectTypeFilter(isActive ? 'all' : (type as ClauseType))}
                      className={`tag clickable-pill ${isActive ? 'active' : ''}`}
                      style={{
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        background: isActive ? 'var(--color-primary)' : undefined,
                        color: isActive ? '#ffffff' : undefined,
                        borderColor: isActive ? 'var(--color-primary)' : undefined,
                      }}
                      title={`Filter by ${CLAUSE_TYPE_LABELS[type as keyof typeof CLAUSE_TYPE_LABELS] || type}`}
                    >
                      {CLAUSE_TYPE_LABELS[type as keyof typeof CLAUSE_TYPE_LABELS] || type} · {count}
                      {isActive && ' ✕'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Risk flags */}
          {topFlags.length > 0 && (
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
                Watch Out For <span style={{ textTransform: 'none', fontWeight: 400 }}>(click to filter)</span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {topFlags.map((flag) => {
                  const isActive = activeFlagFilter === flag;
                  return (
                    <button
                      key={flag}
                      type="button"
                      onClick={() => onSelectFlagFilter && onSelectFlagFilter(isActive ? null : flag)}
                      className={`clickable-pill ${isActive ? 'active' : ''}`}
                      style={{
                        fontSize: '0.75rem',
                        padding: '3px 10px',
                        borderRadius: 4,
                        background: isActive ? 'var(--color-risk-high)' : 'var(--color-risk-high-bg)',
                        color: isActive ? '#ffffff' : 'var(--color-risk-high)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        fontWeight: 500,
                      }}
                      title={`Filter by flag "${flag}"`}
                    >
                      ⚠ {flag}
                      {isActive && ' ✕'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key dates */}
          {(contract.metadata?.effective_date || contract.metadata?.expiry_date) && (
            <div style={{ flex: 1, minWidth: 140 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
                Key Dates
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {contract.metadata.effective_date && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-text-muted)', marginRight: 6 }}>Effective</span>
                    {contract.metadata.effective_date}
                  </p>
                )}
                {contract.metadata.expiry_date && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-text-muted)', marginRight: 6 }}>Expires</span>
                    {contract.metadata.expiry_date}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
