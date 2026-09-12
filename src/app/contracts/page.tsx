'use client';

import { useEffect, useState } from 'react';
import ContractCard from '@/components/ContractCard';
import Link from 'next/link';
import type { Contract } from '@/lib/types';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/contracts')
      .then((r) => r.json())
      .then((data) => {
        setContracts(data.contracts || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

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
        <p style={{ color: 'var(--color-risk-high)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-1)' }}>Contracts</h1>
          <p className="text-muted text-sm">{contracts.length} contract{contracts.length !== 1 ? 's' : ''} uploaded</p>
        </div>
        <Link href="/" className="btn btn-primary">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Upload New
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h3>No contracts yet</h3>
          <p style={{ maxWidth: 360, lineHeight: 1.6 }}>
            Upload your first vendor contract and ContractLens will extract and analyze every clause for you.
          </p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>
            Upload a Contract
          </Link>
        </div>
      ) : (
        <div
          id="contracts-grid"
          className="stagger"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}
        >
          {contracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      )}
    </div>
  );
}
