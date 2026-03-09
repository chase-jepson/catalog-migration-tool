import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { validateFile, parseFile, mergeFiles, formatFileSize, getSheetNames } from '../lib/parser';
import { MAX_FILE_SIZE } from '../lib/constants';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function csvToFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/csv' });
}

function readFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

describe('validateFile', () => {
  it('accepts .csv files', () => {
    const file = new File(['data'], 'test.csv', { type: 'text/csv' });
    expect(validateFile(file)).toBeNull();
  });

  it('accepts .xlsx files', () => {
    const file = new File(['data'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(validateFile(file)).toBeNull();
  });

  it('accepts .xls files', () => {
    const file = new File(['data'], 'test.xls', { type: 'application/vnd.ms-excel' });
    expect(validateFile(file)).toBeNull();
  });

  it('rejects .txt files', () => {
    const file = new File(['data'], 'test.txt', { type: 'text/plain' });
    expect(validateFile(file)).toBeTruthy();
  });

  it('rejects .json files', () => {
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    expect(validateFile(file)).toBeTruthy();
  });

  it('rejects oversized files', () => {
    // Create a mock File object with overridden size
    const file = new File(['x'], 'big.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1 });
    expect(validateFile(file)).toBeTruthy();
  });

  it('accepts file at exactly MAX_FILE_SIZE', () => {
    const file = new File(['x'], 'ok.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE });
    expect(validateFile(file)).toBeNull();
  });
});

describe('parseFile', () => {
  it('parses Dutchie fixture CSV with correct headers and rows', async () => {
    const content = readFixture('dutchie-sample.csv');
    const file = csvToFile('dutchie-export.csv', content);
    const result = await parseFile(file);

    expect(result.fileName).toBe('dutchie-export.csv');
    expect(result.headers).toContain('SKU');
    expect(result.headers).toContain('Product');
    expect(result.headers).toContain('Brand');
    expect(result.rowCount).toBe(5);
    expect(result.rows).toHaveLength(5);
    expect(result.previewRows.length).toBeLessThanOrEqual(10);
    expect(result.rows[0]['Product']).toBe('Blue Dream Flower');
  });

  it('parses Blaze fixture CSV correctly', async () => {
    const content = readFixture('blaze-sample.csv');
    const file = csvToFile('blaze-export.csv', content);
    const result = await parseFile(file);

    expect(result.headers).toContain('Product ID');
    expect(result.headers).toContain('Item');
    expect(result.rowCount).toBe(6);
  });

  it('handles XLSX files', async () => {
    // Create a test XLSX workbook in memory
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { Name: 'Product A', Price: '10.00' },
      { Name: 'Product B', Price: '20.00' },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buffer], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const result = await parseFile(file);
    expect(result.headers).toContain('Name');
    expect(result.headers).toContain('Price');
    expect(result.rowCount).toBe(2);
  });

  it('parses selected sheet for multi-sheet XLSX', async () => {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet([{ Col1: 'A' }]);
    const ws2 = XLSX.utils.json_to_sheet([{ Col2: 'B' }, { Col2: 'C' }]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws2, 'Data');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buffer], 'multi.xlsx');

    const result = await parseFile(file, 'Data');
    expect(result.headers).toContain('Col2');
    expect(result.rowCount).toBe(2);
  });

  it('handles 10k+ rows without error', async () => {
    // Generate a large CSV in memory
    const headers = 'Name,Price,Category\n';
    const rows = Array.from({ length: 10_000 }, (_, i) =>
      `Product ${i},${(Math.random() * 100).toFixed(2)},Flower`
    ).join('\n');
    const file = csvToFile('large.csv', headers + rows);

    const result = await parseFile(file);
    expect(result.rowCount).toBe(10_000);
    expect(result.previewRows.length).toBeLessThanOrEqual(10);
  });
});

describe('getSheetNames', () => {
  it('returns sheet names from multi-sheet XLSX', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ A: 1 }]), 'Sheet1');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ B: 2 }]), 'Sheet2');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buffer], 'test.xlsx');

    const names = await getSheetNames(file);
    expect(names).toEqual(['Sheet1', 'Sheet2']);
  });
});

describe('mergeFiles', () => {
  it('unions columns from two files and adds Source File column', async () => {
    const file1Content = readFixture('dutchie-sample.csv');
    const file2Content = readFixture('blaze-sample.csv');

    const parsed1 = await parseFile(csvToFile('dutchie.csv', file1Content));
    const parsed2 = await parseFile(csvToFile('blaze.csv', file2Content));

    const merged = mergeFiles([parsed1, parsed2]);

    expect(merged.headers).toContain('Source File');
    // Should have union of all columns from both files
    expect(merged.headers).toContain('SKU'); // Dutchie only
    expect(merged.headers).toContain('Product ID'); // Blaze only
    expect(merged.headers).toContain('Brand'); // Both
    expect(merged.rowCount).toBe(parsed1.rowCount + parsed2.rowCount);

    // Check source file tracking
    const dutchieRows = merged.rows.filter((r) => r['Source File'] === 'dutchie.csv');
    expect(dutchieRows).toHaveLength(parsed1.rowCount);

    // Missing columns should be empty string
    const blazeRow = merged.rows.find((r) => r['Source File'] === 'blaze.csv');
    expect(blazeRow?.['SKU']).toBe('');
  });
});

describe('formatFileSize', () => {
  it('formats bytes correctly', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});
