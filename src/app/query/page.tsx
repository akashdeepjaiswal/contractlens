'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ClauseCard from '@/components/ClauseCard';
import type { QueryResponse, Contract, ClauseType, RiskLevel } from '@/lib/types';
import { CLAUSE_TYPE_LABELS } from '@/lib/types';

const EXAMPLE_QUERIES = [
  'Show me all termination clauses',
  'Which contracts have auto-renewal?',
  'Find uncapped liability clauses',
  'Data privacy and GDPR clauses',
  'Indemnification provisions',
  'IP ownership and assignment clauses',
];

export default function QueryPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filters, setFilters] = useState({
    contractId: '',
    clauseType: '' as ClauseType | '',
    riskLevel: '' as RiskLevel | '',
    flag: '',
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/contracts')
      .then((r) => r.json())
      .then((data) => setContracts((data.contracts || []).filter((c: Contract) => c.status === 'ready')))
      .catch(() => {});
  }, []);

  const runQuery = useCallback(async (q: string = query) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          filters: {
            ...(filters.contractId && { contractId: filters.contractId }),
            ...(filters.clauseType && { clauseType: filters.clauseType }),
            ...(filters.riskLevel && { riskLevel: filters.riskLevel }),
            ...(filters.flag && { flag: filters.flag }),
          },
          limit: 25,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  }, [query, filters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runQuery();
  };

  const contractMap = new Map(contracts.map((c) => [c.id, c]));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>Search Clauses</h1>
        <p className="text-muted text-sm">
          Ask anything across all your contracts in plain English
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit}>
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-2)',
          display: 'flex',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
          transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
          boxShadow: 'none',
        }}
          onFocus={() => {}}
          id="query-form"
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <svg
              width="18"
              height="18"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              id="query-input"
              className="input search-input"
              style={{ background: 'transparent', border: 'none', fontSize: '1rem', boxShadow: 'none', paddingLeft: 44 }}
              placeholder="Ask anything — e.g. 'termination clauses' or 'auto-renewal'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search query"
              autoFocus
            />
          </div>
          <button
            type="submit"
            id="query-submit"
            className="btn btn-primary"
            disabled={loading || !query.trim()}
          >
            {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Search'}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
          {contracts.length > 0 && (
            <select
              className="input"
              style={{ width: 'auto', fontSize: '0.875rem' }}
              value={filters.contractId}
              onChange={(e) => setFilters((f) => ({ ...f, contractId: e.target.value }))}
              id="filter-contract"
              aria-label="Filter by contract"
            >
              <option value="">All contracts</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          <select
            className="input"
            style={{ width: 'auto', fontSize: '0.875rem' }}
            value={filters.clauseType}
            onChange={(e) => setFilters((f) => ({ ...f, clauseType: e.target.value as ClauseType | '' }))}
            id="filter-clause-type"
            aria-label="Filter by clause type"
          >
            <option value="">Any clause type</option>
            {Object.entries(CLAUSE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            className="input"
            style={{ width: 'auto', fontSize: '0.875rem' }}
            value={filters.riskLevel}
            onChange={(e) => setFilters((f) => ({ ...f, riskLevel: e.target.value as RiskLevel | '' }))}
            id="filter-risk"
            aria-label="Filter by risk level"
          >
            <option value="">Any risk level</option>
            <option value="high">🔴 High risk</option>
            <option value="medium">🟡 Medium risk</option>
            <option value="low">🟢 Low risk</option>
          </select>

          <select
            className="input"
            style={{ width: 'auto', fontSize: '0.875rem' }}
            value={filters.flag}
            onChange={(e) => setFilters((f) => ({ ...f, flag: e.target.value }))}
            id="filter-flag"
            aria-label="Filter by flag"
          >
            <option value="">Any flag</option>
            <option value="auto-renewal">Auto-renewal</option>
            <option value="uncapped-liability">Uncapped liability</option>
            <option value="one-sided-termination">One-sided termination</option>
            <option value="ip-assignment">IP assignment</option>
            <option value="non-compete">Non-compete</option>
            <option value="mandatory-arbitration">Mandatory arbitration</option>
            <option value="broad-indemnification">Broad indemnification</option>
            <option value="unilateral-amendment">Unilateral amendment</option>
          </select>
        </div>
      </form>

      {/* Example queries */}
      {!results && !loading && (
        <div className="animate-fade-in">
          <p className="text-xs text-muted" style={{ marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Try these
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {EXAMPLE_QUERIES.map((eq) => (
              <button
                key={eq}
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setQuery(eq);
                  runQuery(eq);
                }}
                id={`example-${eq.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`}
              >
                {eq}
              </button>
            ))}
          </div>

          {contracts.length === 0 && (
            <div className="empty-state" style={{ marginTop: 'var(--space-12)' }}>
              <div className="empty-state-icon">📄</div>
              <h3>No contracts ready</h3>
              <p>Upload and process a contract first, then come back to search.</p>
              <a href="/" className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>
                Upload a Contract
              </a>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-6) 0', color: 'var(--color-text-secondary)' }}>
          <div className="spinner" />
          Searching across your contracts…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-risk-high-bg)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-risk-high)',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
            <p style={{ fontWeight: 600 }}>
              {results.totalFound} result{results.totalFound !== 1 ? 's' : ''} for{' '}
              <span style={{ color: 'var(--color-primary-light)' }}>"{results.query}"</span>
            </p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setResults(null); setQuery(''); }}
            >
              Clear
            </button>
          </div>

          {results.results.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
              <div className="empty-state-icon">🔍</div>
              <p>No clauses found matching your query</p>
              <p className="text-sm text-muted">Try different keywords or remove some filters</p>
            </div>
          ) : (
            <div id="query-results" className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {results.results.map((result) => (
                <ClauseCard
                  key={result.clause.id}
                  clause={result.clause}
                  contractName={contractMap.get(result.clause.contract_id)?.name || result.contract.name}
                  showContract={true}
                  similarity={result.similarity}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
