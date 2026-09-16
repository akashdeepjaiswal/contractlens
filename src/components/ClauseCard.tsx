'use client';

import { useState, useEffect } from 'react';
import type { Clause, ClauseType, RiskLevel } from '@/lib/types';
import {
  CLAUSE_TYPE_LABELS,
  RISK_LEVEL_REASONS,
  CLAUSE_TYPE_DESCRIPTIONS,
  FLAG_DESCRIPTIONS,
} from '@/lib/types';

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

// Trigger keywords per flag for in-paragraph highlighting
const FLAG_TRIGGERS: Record<string, string[]> = {
  'broad-indemnification': [
    'indemnif', 'hold harmless', 'defend', 'liable for any and all', 'reasonable costs',
    'reprocurement costs', 'losses', 'claims', 'liabilities', 'damages', 'defending',
  ],
  'uncapped-liability': [
    'liable', 'liability', 'unlimited', 'no limitation', 'not be limited', 'consequential',
    'reprocurement costs', 'reasonable costs', 'all damages', 'incurred by',
  ],
  'one-sided-termination': [
    'may terminate', 'terminate this agreement', 'written notice', 'cure', 'breach',
    'default', 'one hundred and twenty', '120 days', '10 days', 'advance written notice',
    'sole discretion', 'at will', 'without cause',
  ],
  'auto-renewal': [
    'renew', 'renewal', 'automatic', 'successive', 'extension', 'unless notice',
    'prior notice', 'advance notice',
  ],
  'ip-assignment': [
    'assign', 'assignment', 'exclusive property', 'ownership', 'work product',
    'inventions', 'intellectual property', 'all rights', 'deliverables',
  ],
  'non-compete': [
    'non-compete', 'compete', 'solicit', 'solicitation', 'restrict', 'customers',
    'competitor', 'business relationship',
  ],
  'liquidated-damages': [
    'liquidated damages', 'penalty', 'forfeit', 'pre-estimated', 'fine',
  ],
  'mandatory-arbitration': [
    'arbitration', 'arbitrator', 'binding', 'dispute', 'waive jury', 'class action',
  ],
  'unilateral-amendment': [
    'modify', 'amend', 'at any time', 'sole discretion', 'update terms', 'unilateral',
  ],
};

const RISK_TRIGGERS: Record<'high' | 'medium' | 'low', string[]> = {
  high: [
    'shall be liable', 'liable for any and all', 'reprocurement costs', 'reasonable costs',
    'indemnif', 'hold harmless', 'defend', 'sole discretion', 'without limitation',
    'one hundred and twenty', '120 days', '10 days', 'default', 'penalty', 'breach',
    'forfeit', 'uncapped', 'unlimited', 'consequential damages', 'assignment for the benefit',
  ],
  medium: [
    'written notice', 'advance notice', 'cure', 'thirty', '30 days', 'sixty', '60 days',
    'invoicing', 'payment', 'milestone', 'reimbursement', 'reimbursed', 'default',
    'expense', 'consultant', 'commission',
  ],
  low: [
    'governing law', 'laws of', 'jurisdiction', 'state of', 'confidential', 'warranty',
    'severability', 'entire agreement', 'counterparts',
  ],
};

const TYPE_TRIGGERS: Record<ClauseType, string[]> = {
  termination: ['terminate', 'termination', 'notice', 'cure', 'breach', 'default', 'advance written notice', 'survive', 'survival', 'expiration'],
  payment: ['payment', 'invoice', 'invoices', 'compensation', 'reimbursed', 'fee', 'fees', 'cost', 'costs', 'billing', 'milestone', 'expenses'],
  ip_ownership: ['intellectual property', 'ownership', 'license', 'copyright', 'patent', 'deliverables', 'work product', 'proprietary', 'inventions'],
  liability: ['liability', 'liable', 'limitation of liability', 'damages', 'consequential', 'direct damages', 'cap', 'exceed'],
  indemnification: ['indemnify', 'indemnification', 'defense', 'defend', 'hold harmless', 'claims', 'losses', 'liabilities'],
  auto_renewal: ['renew', 'renewal', 'automatic', 'successive', 'extension', 'advance notice'],
  confidentiality: ['confidential', 'confidentiality', 'non-disclosure', 'proprietary information', 'trade secret'],
  dispute_resolution: ['dispute', 'arbitration', 'mediation', 'court', 'litigation', 'escalation'],
  governing_law: ['governing law', 'laws of', 'jurisdiction', 'venue', 'state of'],
  force_majeure: ['force majeure', 'acts of god', 'unforeseeable', 'beyond reasonable control'],
  warranties: ['warrant', 'warranty', 'as is', 'representation', 'disclaimer'],
  data_privacy: ['personal data', 'privacy', 'security', 'gdpr', 'processing'],
  non_compete: ['non-compete', 'compete', 'solicitation', 'restrictive'],
  assignment: ['assign', 'assignment', 'transfer', 'successor'],
  other: ['general', 'notice', 'agreement', 'provisions'],
};

// ============================================================
// HighlightedText — highlights search terms inside a string
// ============================================================
function HighlightedText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || !highlight.trim() || !text) {
    return <>{text}</>;
  }

  const terms = highlight
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        part.match(pattern) ? (
          <mark key={i} className="query-highlight">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ============================================================
// EnhancedClauseText — Highlights the specific lines/sentences
// and terms that caused the clause to match the active filter
// ============================================================
function EnhancedClauseText({
  text,
  highlight,
  activeRiskFilter,
  activeTypeFilter,
  activeFlagFilter,
  clause,
}: {
  text: string;
  highlight?: string;
  activeRiskFilter?: 'all' | 'high' | 'medium' | 'low';
  activeTypeFilter?: 'all' | ClauseType;
  activeFlagFilter?: string | null;
  clause: Clause;
}) {
  if (!text) return null;

  // Determine active theme and keywords
  let filterTheme: 'risk-high' | 'risk-medium' | 'risk-low' | 'clause-type' | 'clause-flag' | null = null;
  const triggerTerms: string[] = [];

  if (activeFlagFilter && clause.flags.includes(activeFlagFilter)) {
    filterTheme = 'clause-flag';
    triggerTerms.push(...(FLAG_TRIGGERS[activeFlagFilter] || [activeFlagFilter]));
  } else if (activeRiskFilter && activeRiskFilter !== 'all' && clause.risk_level === activeRiskFilter) {
    filterTheme = `risk-${activeRiskFilter}` as any;
    triggerTerms.push(...(RISK_TRIGGERS[activeRiskFilter] || []));
    for (const f of clause.flags) {
      if (FLAG_TRIGGERS[f]) triggerTerms.push(...FLAG_TRIGGERS[f]);
    }
  } else if (activeTypeFilter && activeTypeFilter !== 'all' && clause.clause_type === activeTypeFilter) {
    filterTheme = 'clause-type';
    triggerTerms.push(...(TYPE_TRIGGERS[activeTypeFilter] || [activeTypeFilter]));
  }

  // Also include search query terms if present
  if (highlight && highlight.trim()) {
    triggerTerms.push(
      ...highlight
        .trim()
        .split(/\s+/)
        .filter((t) => t.length >= 2)
    );
  }

  // If no filters or query are active, return default text
  if (triggerTerms.length === 0) {
    return <HighlightedText text={text} highlight={highlight} />;
  }

  // Helper to highlight words inside a sentence
  const highlightWords = (str: string) => {
    const escaped = triggerTerms
      .filter(Boolean)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length);

    if (escaped.length === 0) return str;
    const wordPattern = new RegExp(`(${escaped.join('|')})`, 'gi');
    const segments = str.split(wordPattern);

    return segments.map((seg, idx) => {
      if (seg.match(wordPattern)) {
        return (
          <mark
            key={idx}
            className={filterTheme ? `reason-word-match ${filterTheme}` : 'query-highlight'}
          >
            {seg}
          </mark>
        );
      }
      return seg;
    });
  };

  // Split text by newlines to preserve structure
  const lines = text.split(/(\r?\n+)/);

  return (
    <>
      {lines.map((line, lineIdx) => {
        if (/^\r?\n+$/.test(line)) {
          return line;
        }

        // Split line into sentences
        const sentenceSegments = line.split(/(?<=[.?!;])\s+/);

        return (
          <span key={lineIdx}>
            {sentenceSegments.map((sentence, sIdx) => {
              const matchesTrigger = triggerTerms.some((term) =>
                sentence.toLowerCase().includes(term.toLowerCase())
              );

              if (matchesTrigger && filterTheme) {
                return (
                  <span
                    key={sIdx}
                    className={`reason-sentence-match ${filterTheme}`}
                  >
                    {highlightWords(sentence)}{' '}
                  </span>
                );
              }

              return (
                <span key={sIdx}>
                  {highlightWords(sentence)}{' '}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}


interface ClauseCardProps {
  clause: Clause;
  contractName?: string;
  showContract?: boolean;
  defaultExpanded?: boolean;
  forceExpanded?: boolean | null;
  similarity?: number;
  /** If provided, matching terms in title/content/resolved_context are highlighted */
  highlight?: string;
  activeRiskFilter?: 'all' | 'high' | 'medium' | 'low';
  activeTypeFilter?: 'all' | ClauseType;
  activeFlagFilter?: string | null;
}

export default function ClauseCard({
  clause,
  contractName,
  showContract = false,
  defaultExpanded = false,
  forceExpanded = null,
  similarity,
  highlight,
  activeRiskFilter = 'all',
  activeTypeFilter = 'all',
  activeFlagFilter = null,
}: ClauseCardProps) {
  const [showResolved, setShowResolved] = useState(false);
  const typeColor = CLAUSE_TYPE_COLORS[clause.clause_type] || '#64748b';
  const hasResolvedRefs = (clause.raw_references?.length ?? 0) > 0;
  const hasUnresolved = (clause.unresolved_references?.length ?? 0) > 0;

  // Filter match booleans
  const isRiskMatched = activeRiskFilter !== 'all' && clause.risk_level === activeRiskFilter;
  const isTypeMatched = activeTypeFilter !== 'all' && clause.clause_type === activeTypeFilter;
  const isFlagMatched = Boolean(activeFlagFilter && clause.flags.includes(activeFlagFilter));
  const isFilterActive = isRiskMatched || isTypeMatched || isFlagMatched;

  // Collapsed by default; user clicks to expand and read full clause
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  // Sync with global Expand All / Collapse All controls
  useEffect(() => {
    if (forceExpanded !== null && forceExpanded !== undefined) {
      setExpanded(forceExpanded);
    }
  }, [forceExpanded]);

  return (
    <div
      className={`clause-card ${expanded ? 'expanded' : ''}`}
      style={{ '--type-color': typeColor } as React.CSSProperties}
      id={`clause-${clause.id}`}
    >
      {/* Active Filter Reason Banners */}
      {isFlagMatched && activeFlagFilter && (
        <div className="clause-reason-banner clause-flag">
          <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-risk-high)', marginBottom: 2 }}>
              Red Flag Match: {activeFlagFilter}
            </p>
            <p style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
              {FLAG_DESCRIPTIONS[activeFlagFilter] || 'Exposes your business to elevated legal or financial exposure.'}
            </p>
          </div>
        </div>
      )}

      {isRiskMatched && !isFlagMatched && (
        <div className={`clause-reason-banner risk-${clause.risk_level}`}>
          <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>{RISK_EMOJI[clause.risk_level]}</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              Why this is {clause.risk_level} risk
            </p>
            <p style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
              {clause.flags.length > 0 && clause.risk_level === 'high' ? (
                <>
                  <strong>Flagged for {clause.flags.join(', ')}: </strong>
                  {FLAG_DESCRIPTIONS[clause.flags[0]] || RISK_LEVEL_REASONS[clause.risk_level]}
                </>
              ) : (
                RISK_LEVEL_REASONS[clause.risk_level]
              )}
            </p>
          </div>
        </div>
      )}

      {isTypeMatched && !isRiskMatched && !isFlagMatched && (
        <div className="clause-reason-banner clause-type">
          <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>📌</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-primary-light)', marginBottom: 2 }}>
              {CLAUSE_TYPE_LABELS[clause.clause_type]} Clause Scope
            </p>
            <p style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
              {CLAUSE_TYPE_DESCRIPTIONS[clause.clause_type] || 'Standard legal clause governing this section.'}
            </p>
          </div>
        </div>
      )}

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
                borderColor: isTypeMatched ? typeColor : `${typeColor}30`,
                boxShadow: isTypeMatched ? `0 0 0 2px ${typeColor}, 0 0 10px ${typeColor}40` : undefined,
                fontSize: '0.6875rem',
                fontWeight: isTypeMatched ? 700 : 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                transition: 'all 0.2s',
              }}
            >
              {CLAUSE_TYPE_LABELS[clause.clause_type]}
            </span>

            {/* Risk level */}
            <span
              className={`badge badge-risk-${clause.risk_level}`}
              style={{
                fontSize: '0.6875rem',
                boxShadow: isRiskMatched ? `0 0 0 2px var(--color-risk-${clause.risk_level}), 0 0 10px var(--color-risk-${clause.risk_level}-bg)` : undefined,
                fontWeight: isRiskMatched ? 700 : 500,
                transition: 'all 0.2s',
              }}
            >
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

          {/* Title — highlighted */}
          <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-1)', lineHeight: 1.3 }}>
            <HighlightedText
              text={clause.title || CLAUSE_TYPE_LABELS[clause.clause_type]}
              highlight={highlight}
            />
          </h4>

          {/* Flags */}
          {clause.flags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {clause.flags.map((flag) => {
                const isSelectedFlag = activeFlagFilter === flag;
                return (
                  <span
                    key={flag}
                    style={{
                      fontSize: '0.6875rem',
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: isSelectedFlag ? 'var(--color-risk-high)' : 'var(--color-risk-high-bg)',
                      color: isSelectedFlag ? '#ffffff' : 'var(--color-risk-high)',
                      border: isSelectedFlag ? '1px solid var(--color-risk-high)' : '1px solid rgba(239, 68, 68, 0.2)',
                      boxShadow: isSelectedFlag ? '0 0 0 2px rgba(239, 68, 68, 0.4), 0 0 10px rgba(239, 68, 68, 0.3)' : undefined,
                      fontWeight: isSelectedFlag ? 700 : 500,
                      transition: 'all 0.2s',
                    }}
                  >
                    ⚠ {flag}
                  </span>
                );
              })}
            </div>
          )}

          {/* Snippet preview only when text search is active */}
          {!expanded && highlight && clause.content && (
            <p style={{
              marginTop: 'var(--space-2)',
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
              overflow: 'hidden',
            }}>
              <EnhancedClauseText
                text={clause.content.slice(0, 380)}
                highlight={highlight}
                activeRiskFilter={activeRiskFilter}
                activeTypeFilter={activeTypeFilter}
                activeFlagFilter={activeFlagFilter}
                clause={clause}
              />
            </p>
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
          {/* Helpful note explaining highlighted lines */}
          {isFilterActive && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 'var(--space-2)',
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
            }}>
              <span style={{ fontSize: '0.875rem' }}>🎯</span>
              <span>
                <strong>Highlighted in paragraph:</strong> The specific lines and phrases that caused this clause to match the active filter.
              </span>
            </div>
          )}

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
            <EnhancedClauseText
              text={clause.content}
              highlight={highlight}
              activeRiskFilter={activeRiskFilter}
              activeTypeFilter={activeTypeFilter}
              activeFlagFilter={activeFlagFilter}
              clause={clause}
            />
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
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)' }}>
                    <EnhancedClauseText
                      text={clause.resolved_context.split('--- Referenced Sections ---')[1]?.split('--- Unresolved References ---')[0] || ''}
                      highlight={highlight}
                      activeRiskFilter={activeRiskFilter}
                      activeTypeFilter={activeTypeFilter}
                      activeFlagFilter={activeFlagFilter}
                      clause={clause}
                    />
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
