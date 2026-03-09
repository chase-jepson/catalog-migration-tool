import { describe, it, expect } from 'vitest';
import { calculateETA, getAdaptiveInterval, isTerminalStatus } from '../lib/import-poller';

describe('calculateETA', () => {
  it('returns a human-readable time string for in-progress imports', () => {
    // 2 of 6 files done, current file 50% complete, started 5 minutes ago
    const startTime = Date.now() - 5 * 60 * 1000;
    const result = calculateETA(startTime, 2, 6, 0.5);
    expect(typeof result).toBe('string');
    expect(result).not.toBe('Calculating...');
    // Should contain time-like content (minutes or seconds)
    expect(result).toMatch(/\d+/);
  });

  it('returns "Calculating..." when 0 files completed and no current progress', () => {
    const result = calculateETA(Date.now(), 0, 6, 0);
    expect(result).toBe('Calculating...');
  });

  it('returns a short ETA when near completion', () => {
    const startTime = Date.now() - 10 * 60 * 1000; // 10 min ago
    const result = calculateETA(startTime, 5, 6, 0.5);
    expect(typeof result).toBe('string');
    expect(result).not.toBe('Calculating...');
  });
});

describe('getAdaptiveInterval', () => {
  it('returns 5000ms for fewer than 1000 rows', () => {
    expect(getAdaptiveInterval(500)).toBe(5000);
    expect(getAdaptiveInterval(0)).toBe(5000);
    expect(getAdaptiveInterval(999)).toBe(5000);
  });

  it('returns 15000ms for 1000 or more rows', () => {
    expect(getAdaptiveInterval(1000)).toBe(15000);
    expect(getAdaptiveInterval(5000)).toBe(15000);
    expect(getAdaptiveInterval(100000)).toBe(15000);
  });
});

describe('isTerminalStatus', () => {
  it('returns true for terminal statuses', () => {
    expect(isTerminalStatus('FINISHED')).toBe(true);
    expect(isTerminalStatus('FINISHED_WITH_FAILURES')).toBe(true);
    expect(isTerminalStatus('FINISHED_AND_STOPPED_EARLY')).toBe(true);
  });

  it('returns false for non-terminal statuses', () => {
    expect(isTerminalStatus('PROCESSING')).toBe(false);
    expect(isTerminalStatus('PENDING')).toBe(false);
    expect(isTerminalStatus('UPLOADING')).toBe(false);
  });
});
