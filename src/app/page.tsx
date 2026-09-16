import UploadZone from '@/components/UploadZone';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)', paddingTop: 'var(--space-8)' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 14px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--color-primary-light)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
          AI-powered contract analysis
        </div>

        <h1 style={{ marginBottom: 'var(--space-4)' }}>
          Review contracts like a{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--color-primary-light), #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            lawyer.
          </span>
          <br />Without one.
        </h1>

        <p style={{ fontSize: '1.125rem', color: 'var(--color-text-secondary)', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
          Upload any vendor contract and ContractLens extracts every clause,
          resolves cross-references, flags risk, and lets you query across all your contracts.
        </p>
      </div>

      {/* Upload zone */}
      <UploadZone />

      {/* Features */}
      <div className="responsive-features-grid">
        {[
          {
            icon: '🔍',
            title: 'Deep Extraction',
            description: 'Every clause extracted and classified — termination, payment, IP, liability, auto-renewal and more.',
          },
          {
            icon: '🔗',
            title: 'Cross-Reference Resolution',
            description: 'When a clause says "see Section 3.1(b)", we show you what Section 3.1(b) actually says.',
          },
          {
            icon: '💬',
            title: 'Natural Language Query',
            description: 'Ask "which contracts have auto-renewal?" or "show me liability clauses" in plain English.',
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="card"
            style={{ textAlign: 'center', padding: 'var(--space-6)' }}
          >
            <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-3)' }}>{feature.icon}</div>
            <h4 style={{ marginBottom: 'var(--space-2)' }}>{feature.title}</h4>
            <p className="text-sm text-muted" style={{ lineHeight: 1.6 }}>{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Quick nav */}
      <div style={{ marginTop: 'var(--space-8)', display: 'flex', justifyContent: 'center', gap: 'var(--space-3)' }}>
        <Link href="/contracts" className="btn btn-secondary">
          View Contracts
        </Link>
        <Link href="/query" className="btn btn-ghost">
          Search Clauses →
        </Link>
      </div>
    </div>
  );
}
