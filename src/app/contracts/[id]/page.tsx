'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProcessingStatus from '@/components/ProcessingStatus';
import ClauseCard from '@/components/ClauseCard';
import Link from 'next/link';
import type { Contract, Clause, ClauseType, SectionMapEntry, DefinedTerm } from '@/lib/types';
import { CLAUSE_TYPE_LABELS } from '@/lib/types';

type FilterType = 'all' | ClauseType;
type RiskFilter = 'all' | 'high' | 'medium' | 'low';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [contract, setContract] = useState<Contract | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [sectionMap, setSectionMap] = useState<SectionMapEntry[]>([]);
  const [definedTerms, setDefinedTerms] = useState<DefinedTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [showStructure, setShowStructure] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const loadContract = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setContract(data.contract);
        setClauses(data.clauses || []);
        setSectionMap(data.sectionMap || []);
        setDefinedTerms(data.definedTerms || []);
        setLoading(false);
        return;
      }
    } catch {
      // Fallback to local session cache
    }

    // Try reading from client session storage
    if (typeof window !== 'undefined') {
      try {
        const cachedRaw = sessionStorage.getItem(`contract_${id}`);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const contractObj = cached.contract || cached;
          setContract(contractObj);

          const cachedClausesRaw = sessionStorage.getItem(`clauses_${id}`);
          if (cachedClausesRaw) {
            setClauses(JSON.parse(cachedClausesRaw));
          }
          setLoading(false);
          return;
        }
      } catch {
        // ignore
      }
    }

    setError('Contract not found');
    setLoading(false);
  }, [id]);

  const handleRetry = useCallback(async () => {
    if (!contract) return;
    setRetrying(true);
    try {
      // Reset error status so ProcessingStatus component auto-starts
      const res = await fetch(`/api/contracts/${id}`);
      if (res.ok) {
        const data = await res.json();
        // Force status back to pending so the ProcessingStatus panel re-mounts
        setContract({ ...data.contract, status: 'pending' });
      }
    } catch {
      // ignore — UI will still show retry button
    }
    setRetrying(false);
  }, [contract, id]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  const handleProcessingComplete = useCallback(() => {
    setLoading(true);
    loadContract();
  }, [loadContract]);

  const handleProcessingError = useCallback((errorMsg: string) => {
    setError(errorMsg);
  }, []);

  // Filter clauses
  const filteredClauses = clauses.filter((c) => {
    if (typeFilter !== 'all' && c.clause_type !== typeFilter) return false;
    if (riskFilter !== 'all' && c.risk_level !== riskFilter) return false;
    if (searchText) {
      const lower = searchText.toLowerCase();
      if (
        !c.title?.toLowerCase().includes(lower) &&
        !c.content.toLowerCase().includes(lower) &&
        !c.clause_type.toLowerCase().includes(lower)
      ) return false;
    }
    return true;
  });

  // Get unique clause types present
  const presentTypes = [...new Set(clauses.map((c) => c.clause_type))];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-16)' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <p style={{ color: 'var(--color-risk-high)', marginBottom: 'var(--space-3)' }}>{error}</p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/contracts" className="btn btn-secondary">
            Back to Contracts
          </Link>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const isPending = contract.status === 'pending';
  const isProcessing = contract.status === 'processing';
  const isReady = contract.status === 'ready';
  const isError = contract.status === 'error';

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
        <Link href="/contracts" style={{ color: 'var(--color-text-secondary)' }}>Contracts</Link>
        <span>/</span>
        <span style={{ color: 'var(--color-text-primary)' }}>{contract.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 'var(--space-8)', alignItems: 'start' }}>
        {/* Main column */}
        <div>
          {/* Contract header */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
              <div>
                <h1 style={{ fontSize: '1.625rem', marginBottom: 'var(--space-2)' }}>{contract.name}</h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <span className={`badge badge-status-${contract.status}`}>
                    {contract.status === 'processing' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4, animation: 'pulse 1.5s ease infinite' }} />}
                    {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                  </span>
                  {contract.metadata?.contract_type && (
                    <span className="tag">{contract.metadata.contract_type}</span>
                  )}
                  {contract.metadata?.governing_law && (
                    <span className="tag">⚖ {contract.metadata.governing_law}</span>
                  )}
                  {contract.page_count && (
                    <span className="tag">{contract.page_count} pages</span>
                  )}
                </div>
              </div>
              {isReady && (
                <Link href="/query" className="btn btn-secondary btn-sm">
                  Search Clauses →
                </Link>
              )}
            </div>
          </div>

          {/* Processing panel */}
          {(isPending || isProcessing) && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <ProcessingStatus
                contractId={id}
                onComplete={handleProcessingComplete}
                onError={handleProcessingError}
              />
            </div>
          )}

          {isError && (
            <div style={{
              marginBottom: 'var(--space-6)',
              padding: 'var(--space-4)',
              background: 'var(--color-risk-high-bg)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--color-risk-high)',
            }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Processing failed</p>
              <p className="text-sm" style={{ marginBottom: 'var(--space-3)' }}>{contract.error_message || 'An unknown error occurred'}</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRetry}
                disabled={retrying}
                id="retry-processing-btn"
                style={{ marginTop: 4 }}
              >
                {retrying ? 'Retrying…' : '↺ Retry Processing'}
              </button>
            </div>
          )}

          {/* Clauses section */}
          {isReady && (
            <>
              {/* Filter toolbar */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {/* Text search */}
                  <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      className="input search-input"
                      placeholder="Filter clauses…"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      id="clause-search"
                      aria-label="Search clauses"
                    />
                  </div>

                  {/* Risk filter */}
                  <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
                    id="risk-filter"
                    aria-label="Filter by risk level"
                  >
                    <option value="all">All risk levels</option>
                    <option value="high">🔴 High risk</option>
                    <option value="medium">🟡 Medium risk</option>
                    <option value="low">🟢 Low risk</option>
                  </select>
                </div>

                {/* Type filter chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <button
                    className={`btn btn-sm ${typeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTypeFilter('all')}
                    id="filter-all"
                  >
                    All ({clauses.length})
                  </button>
                  {presentTypes.map((type) => {
                    const count = clauses.filter((c) => c.clause_type === type).length;
                    return (
                      <button
                        key={type}
                        id={`filter-${type}`}
                        className={`btn btn-sm ${typeFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTypeFilter(type as FilterType)}
                      >
                        {CLAUSE_TYPE_LABELS[type as ClauseType]} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clause list */}
              {filteredClauses.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
                  <div className="empty-state-icon">🔍</div>
                  <p>No clauses match your filters</p>
                </div>
              ) : (
                <div id="clauses-list" className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {filteredClauses.map((clause) => (
                    <ClauseCard key={clause.id} clause={clause} highlight={searchText || undefined} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar: metadata & risk summary */}
        {isReady && (
          <div style={{ position: 'sticky', top: 'calc(var(--topbar-height) + var(--space-8))', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Risk Summary */}
            <div className="card-elevated" style={{ padding: 'var(--space-5)' }}>
              <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Summary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {(['high', 'medium', 'low'] as const).map((level) => {
                  const count = contract.risk_summary?.[level] ?? 0;
                  const total = clauses.length;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  const colors = { high: 'var(--color-risk-high)', medium: 'var(--color-risk-medium)', low: 'var(--color-risk-low)' };
                  return (
                    <div key={level}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.8125rem', color: colors[level], fontWeight: 500 }}>
                          {level.charAt(0).toUpperCase() + level.slice(1)} risk
                        </span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{count}</span>
                      </div>
                      <div className="progress-bar" style={{ height: 3 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: colors[level] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metadata */}
            {contract.metadata && Object.keys(contract.metadata).some(k => (contract.metadata as Record<string, unknown>)[k]) && (
              <div className="card-elevated" style={{ padding: 'var(--space-5)' }}>
                <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contract Info</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {contract.metadata.parties && contract.metadata.parties.length > 0 && (
                    <div>
                      <p className="text-xs text-muted" style={{ marginBottom: 4 }}>Parties</p>
                      {contract.metadata.parties.map((p) => (
                        <p key={p} style={{ fontSize: '0.875rem' }}>{p}</p>
                      ))}
                    </div>
                  )}
                  {contract.metadata.governing_law && (
                    <div>
                      <p className="text-xs text-muted" style={{ marginBottom: 4 }}>Governing Law</p>
                      <p style={{ fontSize: '0.875rem' }}>{contract.metadata.governing_law}</p>
                    </div>
                  )}
                  {contract.metadata.effective_date && (
                    <div>
                      <p className="text-xs text-muted" style={{ marginBottom: 4 }}>Effective Date</p>
                      <p style={{ fontSize: '0.875rem' }}>{contract.metadata.effective_date}</p>
                    </div>
                  )}
                  {contract.metadata.expiry_date && (
                    <div>
                      <p className="text-xs text-muted" style={{ marginBottom: 4 }}>Expiry Date</p>
                      <p style={{ fontSize: '0.875rem' }}>{contract.metadata.expiry_date}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Flags summary */}
            {clauses.some(c => c.flags.length > 0) && (
              <div className="card-elevated" style={{ padding: 'var(--space-5)' }}>
                <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Detected Flags</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...new Set(clauses.flatMap(c => c.flags))].map(flag => {
                    const count = clauses.filter(c => c.flags.includes(flag)).length;
                    return (
                      <div key={flag} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', color: '#fca5a5' }}>⚠ {flag}</span>
                        <span className="tag" style={{ fontSize: '0.6875rem' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Defined Terms Glossary */}
            {definedTerms.length > 0 && (
              <div className="card-elevated" style={{ padding: 'var(--space-5)' }}>
                <button
                  onClick={() => setShowGlossary(g => !g)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: showGlossary ? 'var(--space-4)' : 0,
                  }}
                  id="toggle-glossary-btn"
                  aria-expanded={showGlossary}
                >
                  <h4 style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    📖 Defined Terms
                  </h4>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="tag" style={{ fontSize: '0.6875rem' }}>{definedTerms.length}</span>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      style={{ color: 'var(--color-text-muted)', transform: showGlossary ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {showGlossary && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {definedTerms.map(dt => (
                      <div key={dt.id} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                        <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-primary-light)', marginBottom: 4 }}>
                          {dt.term}
                          {dt.section_ref && (
                            <span className="tag" style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 400 }}>§ {dt.section_ref}</span>
                          )}
                        </p>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{dt.definition}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Document Structure */}
            {sectionMap.length > 0 && (
              <div className="card-elevated" style={{ padding: 'var(--space-5)' }}>
                <button
                  onClick={() => setShowStructure(s => !s)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: showStructure ? 'var(--space-4)' : 0,
                  }}
                  id="toggle-structure-btn"
                  aria-expanded={showStructure}
                >
                  <h4 style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    🗂 Document Structure
                  </h4>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="tag" style={{ fontSize: '0.6875rem' }}>{sectionMap.length} sections</span>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      style={{ color: 'var(--color-text-muted)', transform: showStructure ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {showStructure && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sectionMap.slice(0, 30).map(section => (
                      <div
                        key={section.id}
                        style={{
                          paddingLeft: `${section.depth * 12}px`,
                          paddingTop: 4,
                          paddingBottom: 4,
                          borderLeft: section.depth > 0 ? '1px solid var(--color-border)' : 'none',
                          marginLeft: section.depth > 0 ? 6 : 0,
                        }}
                      >
                        <p style={{ fontSize: '0.75rem', color: section.depth === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: section.depth === 0 ? 600 : 400 }}>
                          <span style={{ color: 'var(--color-text-muted)', marginRight: 6 }}>{section.section_number}</span>
                          {section.title || '—'}
                        </p>
                      </div>
                    ))}
                    {sectionMap.length > 30 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>+ {sectionMap.length - 30} more sections</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
