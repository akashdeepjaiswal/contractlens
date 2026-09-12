import { describe, it, expect } from 'vitest';
import { inferDepth } from '@/lib/pipeline/structureAnalyzer';

describe('inferDepth', () => {
  it('infers depth 0 for top-level sections', () => {
    expect(inferDepth('1')).toBe(0);
    expect(inferDepth('5')).toBe(0);
    expect(inferDepth('12')).toBe(0);
  });

  it('infers depth 1 for subsections', () => {
    expect(inferDepth('1.1')).toBe(1);
    expect(inferDepth('3.2')).toBe(1);
  });

  it('infers depth 2 for sub-subsections', () => {
    expect(inferDepth('1.1.1')).toBe(2);
    expect(inferDepth('3.2.4')).toBe(2);
  });

  it('infers depth 0 for Exhibits and Schedules', () => {
    expect(inferDepth('Exhibit A')).toBe(0);
    expect(inferDepth('Schedule 1')).toBe(0);
  });

  it('adds depth for parenthetical sub-clauses', () => {
    // "3.1(b)" has 2 parts + parenthetical → depth 2
    const depth = inferDepth('3.1(b)');
    expect(depth).toBeGreaterThanOrEqual(2);
  });

  it('handles empty string', () => {
    expect(inferDepth('')).toBe(0);
  });
});
