'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  error: string | null;
  contractId: string | null;
}

export default function UploadZone() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    contractId: null,
  });

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setState((s) => ({ ...s, status: 'error', error: 'Only PDF files are supported.' }));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setState((s) => ({ ...s, status: 'error', error: 'File too large. Maximum size is 50 MB.' }));
      return;
    }

    setState({ status: 'uploading', progress: 10, error: null, contractId: null });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      if (typeof window !== 'undefined' && data.contract) {
        try {
          sessionStorage.setItem(
            `contract_${data.contractId}`,
            JSON.stringify({
              contract: data.contract,
              fileBase64: data.fileBase64,
            })
          );
        } catch {
          // ignore
        }
      }

      setState({ status: 'success', progress: 100, error: null, contractId: data.contractId });

      // Navigate to the contract page for processing
      setTimeout(() => {
        router.push(`/contracts/${data.contractId}`);
      }, 800);
    } catch (err) {
      setState({
        status: 'error',
        progress: 0,
        error: err instanceof Error ? err.message : 'Upload failed',
        contractId: null,
      });
    }
  }, [router]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const isUploading = state.status === 'uploading';
  const isSuccess = state.status === 'success';

  return (
    <div>
      <div
        id="upload-zone"
        className={`upload-zone ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload contract PDF"
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        style={{ cursor: isUploading ? 'wait' : 'pointer' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          style={{ display: 'none' }}
          id="file-input"
          aria-label="Choose PDF file"
        />

        {isSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: 56, height: 56,
              background: 'var(--color-risk-low-bg)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'scaleIn 0.3s ease',
            }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--color-risk-low)" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p style={{ color: 'var(--color-risk-low)', fontWeight: 600 }}>Uploaded! Redirecting…</p>
          </div>
        ) : isUploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', width: '100%', maxWidth: 320 }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>Uploading contract…</p>
            <div className="progress-bar" style={{ width: '100%' }}>
              <div className="progress-fill" style={{ width: `${state.progress}%` }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{
              width: 72, height: 72,
              borderRadius: 'var(--radius-xl)',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all var(--transition-base)',
            }}>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="var(--color-primary-light)" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>

            <div>
              <p style={{ fontWeight: 600, fontSize: '1.0625rem', marginBottom: 4 }}>
                Drop your contract here
              </p>
              <p className="text-sm text-muted">
                or <span style={{ color: 'var(--color-primary-light)' }}>browse to upload</span> · PDF only · max 50 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {state.error && (
        <div
          id="upload-error"
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-risk-high-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-risk-high)',
            fontSize: '0.875rem',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {state.error}
        </div>
      )}
    </div>
  );
}
