import Link from 'next/link';
import type { Contract } from '@/lib/types';

interface ContractCardProps {
  contract: Contract;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  processing: 'Analyzing…',
  ready: 'Ready',
  error: 'Error',
};

export default function ContractCard({ contract }: ContractCardProps) {
  const riskTotal =
    (contract.risk_summary?.high ?? 0) +
    (contract.risk_summary?.medium ?? 0) +
    (contract.risk_summary?.low ?? 0);

  const highPct =
    riskTotal > 0 ? Math.round(((contract.risk_summary?.high ?? 0) / riskTotal) * 100) : 0;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Link href={`/contracts/${contract.id}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ cursor: 'pointer' }} id={`contract-card-${contract.id}`}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Document icon + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{
                width: 40, height: 40,
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--color-primary-light)" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 className="truncate" style={{ fontSize: '0.9375rem' }}>{contract.name}</h3>
                <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                  Uploaded {formatDate(contract.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <span className={`badge badge-status-${contract.status}`} style={{ flexShrink: 0 }}>
            {contract.status === 'processing' && (
              <span style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: 'currentColor',
                display: 'inline-block',
                marginRight: 4,
                animation: 'pulse 1.5s ease infinite',
              }} />
            )}
            {STATUS_LABEL[contract.status]}
          </span>
        </div>

        {/* Stats row */}
        {contract.status === 'ready' && (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '1.25rem', lineHeight: 1 }}>{contract.clause_count}</p>
                <p className="text-xs text-muted">Clauses</p>
              </div>
              <div style={{ width: 1, background: 'var(--color-border)' }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '1.25rem', lineHeight: 1, color: 'var(--color-risk-high)' }}>
                  {contract.risk_summary?.high ?? 0}
                </p>
                <p className="text-xs text-muted">High risk</p>
              </div>
              <div style={{ width: 1, background: 'var(--color-border)' }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '1.25rem', lineHeight: 1, color: 'var(--color-risk-medium)' }}>
                  {contract.risk_summary?.medium ?? 0}
                </p>
                <p className="text-xs text-muted">Medium</p>
              </div>
            </div>

            {/* Risk bar */}
            {riskTotal > 0 && (
              <div style={{ height: 4, borderRadius: 'var(--radius-full)', overflow: 'hidden', background: 'var(--color-surface-3)', display: 'flex' }}>
                <div style={{ width: `${highPct}%`, background: 'var(--color-risk-high)' }} />
                <div style={{ width: `${Math.round(((contract.risk_summary?.medium ?? 0) / riskTotal) * 100)}%`, background: 'var(--color-risk-medium)' }} />
                <div style={{ flex: 1, background: 'var(--color-risk-low)' }} />
              </div>
            )}
          </>
        )}

        {contract.status === 'error' && (
          <p className="text-sm" style={{ color: 'var(--color-risk-high)' }}>
            {contract.error_message || 'Processing failed'}
          </p>
        )}

        {/* Metadata tags */}
        {contract.metadata?.governing_law && (
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span className="tag">⚖ {contract.metadata.governing_law}</span>
            {contract.metadata.contract_type && (
              <span className="tag">{contract.metadata.contract_type}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
