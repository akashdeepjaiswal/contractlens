'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Upload',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    href: '/contracts',
    label: 'Contracts',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/query',
    label: 'Search Clauses',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Read active theme set by head script or localStorage
    const current = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
    if (current === 'light' || current === 'dark') {
      setTheme(current);
    } else {
      const saved = (localStorage.getItem('cl-theme') as 'light' | 'dark' | null) || 'light';
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('cl-theme', nextTheme);
    } catch {
      // Ignore localStorage unavailable
    }
  };

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.875rem', fontWeight: 700, color: 'white',
            boxShadow: '0 0 16px var(--color-primary-glow)',
          }}>
            CL
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
            ContractLens
          </span>
        </Link>

        <div style={{ flex: 1 }} />

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn btn-ghost btn-sm"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          aria-label="Toggle light/dark theme"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            cursor: 'pointer',
          }}
        >
          {theme === 'light' ? (
            <>
              {/* Moon icon for switching to dark */}
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <span className="text-xs" style={{ fontWeight: 600 }}>Dark</span>
            </>
          ) : (
            <>
              {/* Sun icon for switching to light */}
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-xs" style={{ fontWeight: 600 }}>Light</span>
            </>
          )}
        </button>

        <a
          href="https://github.com/akashdeepjaiswal/contractlens"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
          style={{ gap: 6 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </a>
      </header>

      {/* Sidebar */}
      <nav className="sidebar">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <p className="text-xs text-muted" style={{ padding: '0 var(--space-3)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Navigation
          </p>
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            <span style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>ContractLens</span>
            {' '}extracts and explains every clause in your vendor contracts.
          </p>
        </div>
      </nav>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="mobile-nav-icon">{item.icon}</div>
              <span className="mobile-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
