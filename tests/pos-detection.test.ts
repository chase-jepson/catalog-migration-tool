import { describe, it, expect } from 'vitest';
import { detectPOS, scorePOS } from '../lib/pos-detection';
import { POS_DEFAULTS } from '../lib/constants';
import { parseFile } from '../lib/parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedFile } from '../lib/types';

function readFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

function csvToFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/csv' });
}

async function parseFixture(name: string): Promise<ParsedFile> {
  const content = readFixture(name);
  return parseFile(csvToFile(name, content));
}

describe('scorePOS', () => {
  it('scores Dutchie headers correctly', () => {
    const dutchieHeaders = new Set(Object.values(POS_DEFAULTS['Dutchie']));
    const result = scorePOS('Dutchie', dutchieHeaders);
    expect(result.matched).toBe(result.total);
    expect(result.matched).toBeGreaterThan(0);
  });

  it('scores zero for unknown POS', () => {
    const result = scorePOS('NonExistent', new Set(['col1', 'col2']));
    expect(result.matched).toBe(0);
    expect(result.total).toBe(0);
  });

  it('scores partial match for mixed headers', () => {
    const headers = new Set(['SKU', 'Product', 'Brand', 'RandomColumn']);
    const result = scorePOS('Dutchie', headers);
    expect(result.matched).toBeGreaterThanOrEqual(3);
    expect(result.matched).toBeLessThan(result.total);
  });
});

describe('detectPOS', () => {
  it('detects Dutchie from fixture', async () => {
    const file = await parseFixture('dutchie-sample.csv');
    const result = detectPOS([file]);
    expect(result.detected).toBe('Dutchie');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.disagreement).toBe(false);
  });

  it('detects Blaze from fixture', async () => {
    const file = await parseFixture('blaze-sample.csv');
    const result = detectPOS([file]);
    expect(result.detected).toBe('Blaze');
  });

  it('detects Flowhub from fixture', async () => {
    const file = await parseFixture('flowhub-sample.csv');
    const result = detectPOS([file]);
    expect(result.detected).toBe('Flowhub');
  });

  it('detects IndicaOnline from fixture', async () => {
    const file = await parseFixture('indicaonline-sample.csv');
    const result = detectPOS([file]);
    expect(result.detected).toBe('IndicaOnline');
  });

  it('detects Meadow from fixture', async () => {
    const file = await parseFixture('meadow-sample.csv');
    const result = detectPOS([file]);
    expect(result.detected).toBe('Meadow');
  });

  it('detects Cova from fixture', async () => {
    const file = await parseFixture('cova-sample.csv');
    const result = detectPOS([file]);
    expect(result.detected).toBe('Cova');
  });

  it('returns null for unknown headers', async () => {
    const content = 'Alpha,Beta,Gamma\n1,2,3\n4,5,6';
    const file = await parseFile(csvToFile('unknown.csv', content));
    const result = detectPOS([file]);
    expect(result.detected).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('handles multi-file majority vote', async () => {
    const dutchie1 = await parseFixture('dutchie-sample.csv');
    const dutchie2 = await parseFixture('dutchie-sample.csv');
    const blaze = await parseFixture('blaze-sample.csv');

    const result = detectPOS([dutchie1, dutchie2, blaze]);
    expect(result.detected).toBe('Dutchie');
    expect(result.disagreement).toBe(true);
  });
});
