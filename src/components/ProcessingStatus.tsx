'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ProcessingEvent, ProcessingStage } from '@/lib/types';

const STAGE_LABELS: Record<ProcessingStage, string> = {
  extracting: 'Extracting text',
  analyzing_structure: 'Building section map',
  extracting_clauses: 'Classifying clauses',
  resolving_references: 'Resolving cross-references',
  generating_embeddings: 'Generating embeddings',
  done: 'Complete',
  error: 'Error',
};

const STAGE_ORDER: ProcessingStage[] = [
  'extracting',
  'analyzing_structure',
  'extracting_clauses',
  'resolving_references',
  'generating_embeddings',
  'done',
];

interface ProcessingStatusProps {
  contractId: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

export default function ProcessingStatus({
  contractId,
  onComplete,
  onError,
}: ProcessingStatusProps) {
  const [events, setEvents] = useState<ProcessingEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<ProcessingEvent | null>(null);
  const [started, setStarted] = useState(false);

  const startProcessing = useCallback(async () => {
    if (started) return;
    setStarted(true);

    try {
      let clientPayload = null;
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(`contract_${contractId}`);
        if (cached) {
          try {
            clientPayload = JSON.parse(cached);
          } catch {
            // ignore
          }
        }
      }

      const response = await fetch(`/api/contracts/${contractId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: clientPayload ? JSON.stringify(clientPayload) : undefined,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: ProcessingEvent & {
                contract?: unknown;
                clauses?: unknown;
                sectionMap?: unknown;
                definedTerms?: unknown;
              } = JSON.parse(line.slice(6));

              setCurrentEvent(event);
              setEvents((prev) => [...prev, event]);

              if (event.stage === 'done') {
                if (typeof window !== 'undefined' && event.contract) {
                  try {
                    sessionStorage.setItem(`contract_${contractId}`, JSON.stringify(event.contract));
                    if (event.clauses) {
                      sessionStorage.setItem(`clauses_${contractId}`, JSON.stringify(event.clauses));
                    }
                  } catch {
                    // ignore
                  }
                }
                setTimeout(onComplete, 1000);
              } else if (event.stage === 'error') {
                onError(event.error || event.message);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      onError(message);
    }
  }, [contractId, started, onComplete, onError]);

  useEffect(() => {
    startProcessing();
  }, [startProcessing]);

  const progress = currentEvent?.progress ?? 0;
  const stage = currentEvent?.stage ?? 'extracting';
  const isError = stage === 'error';
  const isDone = stage === 'done';

  const currentStageIndex = STAGE_ORDER.indexOf(stage as ProcessingStage);

  return (
    <div
      id="processing-status"
      style={{
        padding: 'var(--space-6)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {isDone ? (
          <div style={{
            width: 36, height: 36,
            background: 'var(--color-risk-low-bg)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'scaleIn 0.3s ease',
          }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--color-risk-low)" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isError ? (
          <div style={{
            width: 36, height: 36,
            background: 'var(--color-risk-high-bg)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--color-risk-high)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        ) : (
          <div className="spinner" />
        )}

        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
            {isDone ? 'Analysis complete' : isError ? 'Processing failed' : 'Analyzing contract…'}
          </p>
          <p className="text-sm text-muted" style={{ marginTop: 2 }}>
            {currentEvent?.message || 'Starting up…'}
          </p>
        </div>

        <span style={{ fontWeight: 700, fontSize: '1.25rem', color: isDone ? 'var(--color-risk-low)' : isError ? 'var(--color-risk-high)' : 'var(--color-primary-light)', fontVariantNumeric: 'tabular-nums' }}>
          {progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar" style={{ marginBottom: 'var(--space-5)' }}>
        <div
          className="progress-fill"
          style={{
            width: `${progress}%`,
            background: isError
              ? 'var(--color-risk-high)'
              : isDone
              ? 'var(--color-risk-low)'
              : 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))',
          }}
        />
      </div>

      {/* Stage indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {STAGE_ORDER.filter(s => s !== 'done').map((s, i) => {
          const isCompleted = currentStageIndex > i;
          const isCurrent = currentStageIndex === i && !isDone && !isError;
          const isPending = currentStageIndex < i;

          return (
            <div
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                opacity: isPending ? 0.35 : 1,
                transition: 'opacity 0.3s ease',
              }}
            >
              <div style={{
                width: 20, height: 20,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                background: isCompleted
                  ? 'var(--color-risk-low-bg)'
                  : isCurrent
                  ? 'rgba(99, 102, 241, 0.15)'
                  : 'var(--color-surface-3)',
                border: `1px solid ${isCompleted ? 'rgba(34,197,94,0.3)' : isCurrent ? 'rgba(99,102,241,0.4)' : 'var(--color-border)'}`,
              }}>
                {isCompleted ? (
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="var(--color-risk-low)" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', animation: 'pulse 1.5s ease infinite' }} />
                ) : (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-muted)' }} />
                )}
              </div>

              <span style={{
                fontSize: '0.8125rem',
                color: isCompleted ? 'var(--color-text-secondary)' : isCurrent ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                fontWeight: isCurrent ? 500 : 400,
              }}>
                {STAGE_LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
