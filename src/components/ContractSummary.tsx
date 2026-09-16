'use client';

import type { Contract, Clause, SectionMapEntry, DefinedTerm } from '@/lib/types';
import { CLAUSE_TYPE_LABELS } from '@/lib/types';

interface ContractSummaryProps {
  contract: Contract;
  clauses: Clause[];
  sectionMap: SectionMapEntry[];
  definedTerms: DefinedTerm[];
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
}: ContractSummaryProps) {
  const topFlags = getTopFlags(clauses);
  const narrative = buildNarrative(contract, clauses);
  const highCount = contract.risk_summary?.high ?? 0;
  const medCount = contract.risk_summary?.medium ?? 0;
  const lowCount = contract.risk_summary?.low ?? 0;
  const total = clauses.length;

  // Top clause types by count
  const typeCounts: Record<string, number> = {};
  for (const c of clauses) {
    typeCounts[c.clause_type] = (typeCounts[c.clause_type] || 0) + 1;
  }
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div
      style={{
        marginBottom: 'var(--space-8)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        background: 'var(--color-surface)',
      }}
    >
      {/* Header strip */}
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

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        borderBottom: total > 0 ? '1px solid var(--color-border)' : undefined,
      }}>
        {[
          { label: 'Total Clauses', value: total, color: 'var(--color-text-primary)' },
          { label: 'High Risk', value: highCount, color: 'var(--color-risk-high)' },
          { label: 'Medium Risk', value: medCount, color: 'var(--color-risk-medium)' },
          { label: 'Low Risk', value: lowCount, color: 'var(--color-risk-low)' },
          { label: 'Defined Terms', value: definedTerms.length, color: 'var(--color-primary-light)' },
          { label: 'Sections', value: sectionMap.length, color: 'var(--color-text-secondary)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            padding: 'var(--space-4) var(--space-5)',
            borderRight: '1px solid var(--color-border)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '1.625rem', fontWeight: 700, color, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{label}</p>
          </div>
        ))}
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
                Clause Breakdown
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {topTypes.map(([type, count]) => (
                  <span key={type} className="tag" style={{ fontSize: '0.75rem' }}>
                    {CLAUSE_TYPE_LABELS[type as keyof typeof CLAUSE_TYPE_LABELS] || type} · {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk flags */}
          {topFlags.length > 0 && (
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
                Watch Out For
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {topFlags.map((flag) => (
                  <span key={flag} style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(239,68,68,0.08)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239,68,68,0.15)',
                    fontWeight: 500,
                  }}>
                    ⚠ {flag}
                  </span>
                ))}
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
