'use client';

import { useState } from 'react';
import type { Clause, ClauseType } from '@/lib/types';
import { CLAUSE_TYPE_LABELS } from '@/lib/types';

// Map clause types to colors (from CSS vars)
const CLAUSE_TYPE_COLORS: Record<ClauseType, string> = {
  termination: '#ef4444',
  payment: '#22c55e',
  ip_ownership: '#a855f7',
  liability: '#f97316',
  indemnification: '#ef4444',
  auto_renewal: '#f59e0b',
  confidentiality: '#3b82f6',
  dispute_resolution: '#6366f1',
  governing_law: '#8b5cf6',
  force_majeure: '#06b6d4',
  warranties: '#10b981',
  data_privacy: '#3b82f6',
  non_compete: '#f97316',
  assignment: '#84cc16',
  other: '#64748b',
};

const RISK_EMOJI: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

interface ClauseCardProps {
  clause: Clause;
  contractName?: string;
  showContract?: boolean;
  defaultExpanded?: boolean;
  similarity?: number;
}

export default function ClauseCard({
  clause,
  contractName,
  showContract = false,
  defaultExpanded = false,
  similarity,
}: ClauseCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showResolved, setShowResolved] = useState(false);

  const typeColor = CLAUSE_TYPE_COLORS[clause.clause_type] || '#64748b';
  const hasResolvedRefs = (clause.raw_references?.length ?? 0) > 0;
  const hasUnresolved = (clause.unresolved_references?.length ?? 0) > 0;

  return (
    <div
      className={`clause-card ${expanded ? 'expanded' : ''}`}
      style={{ '--type-color': typeColor } as React.CSSProperties}
      id={`clause-${clause.id}`}
    >
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', cursor: 'pointer' }}
        onClick={() => setExpanded((e) => !e)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((x) => !x)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            {/* Clause type badge */}
            <span
              className="badge"
              style={{
                background: `${typeColor}18`,
                color: typeColor,
                borderColor: `${typeColor}30`,
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {CLAUSE_TYPE_LABELS[clause.clause_type]}
            </span>

            {/* Risk level */}
            <span className={`badge badge-risk-${clause.risk_level}`} style={{ fontSize: '0.6875rem' }}>
              {RISK_EMOJI[clause.risk_level]} {clause.risk_level} risk
            </span>

            {/* Section number */}
            {clause.section_number && (
              <span className="tag" style={{ fontSize: '0.6875rem' }}>
                § {clause.section_number}
              </span>
            )}

            {/* Contract name */}
            {showContract && contractName && (
              <span className="tag" style={{ fontSize: '0.6875rem', color: 'var(--color-primary-light)' }}>
                {contractName}
              </span>
            )}

            {/* Similarity score */}
            {similarity !== undefined && similarity > 0 && (
              <span className="tag" style={{ fontSize: '0.6875rem', marginLeft: 'auto' }}>
                {Math.round(similarity * 100)}% match
              </span>
            )}
          </div>

          {/* Title */}
          <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-1)', lineHeight: 1.3 }}>
            {clause.title || CLAUSE_TYPE_LABELS[clause.clause_type]}
          </h4>

          {/* Flags */}
          {clause.flags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {clause.flags.map((flag) => (
                <span
                  key={flag}
                  style={{
                    fontSize: '0.6875rem',
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    fontWeight: 500,
                  }}
                >
                  ⚠ {flag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <svg
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{
            flexShrink: 0,
            marginTop: 2,
            color: 'var(--color-text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="animate-fade-in" style={{ marginTop: 'var(--space-4)' }}>
          <div
            style={{
              padding: 'var(--space-4)',
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: '0.875rem',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              fontFamily: 'Georgia, serif',
              color: 'var(--color-text-primary)',
            }}
          >
            {clause.content}
          </div>

          {/* Cross-reference section */}
          {hasResolvedRefs && clause.resolved_context && clause.resolved_context !== clause.content && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={(e) => { e.stopPropagation(); setShowResolved((r) => !r); }}
                id={`show-refs-${clause.id}`}
                style={{ gap: 6, fontSize: '0.8125rem' }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {showResolved ? 'Hide' : 'Show'} resolved cross-references
                ({clause.raw_references.length} reference{clause.raw_references.length !== 1 ? 's' : ''})
                {hasUnresolved && (
                  <span style={{ color: 'var(--color-risk-medium)', marginLeft: 4 }}>
                    · {clause.unresolved_references.length} unresolved
                  </span>
                )}
              </button>

              {showResolved && (
                <div
                  className="animate-fade-in"
                  style={{
                    marginTop: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    background: 'rgba(99, 102, 241, 0.04)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.7,
                  }}
                >
                  <p style={{ color: 'var(--color-primary-light)', fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Referenced Sections (resolved)
                  </p>
                  {/* Render the "--- Referenced Sections ---" part of resolved_context */}
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)' }}>
                    {clause.resolved_context.split('--- Referenced Sections ---')[1]?.split('--- Unresolved References ---')[0] || ''}
                  </div>

                  {hasUnresolved && (
                    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(245, 158, 11, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                      <p style={{ color: 'var(--color-risk-medium)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>
                        Could not resolve:
                      </p>
                      {clause.unresolved_references.map((ref) => (
                        <span key={ref} className="tag" style={{ display: 'inline-block', margin: '2px', color: 'var(--color-risk-medium)' }}>
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
