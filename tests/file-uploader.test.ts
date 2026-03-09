import { describe, it, expect } from 'vitest';
import { buildUploadPayload, getUploadSequence } from '../lib/file-uploader';
import type { OutputCSVs } from '../lib/types';

describe('buildUploadPayload', () => {
  it('produces csvContent and contentLength from string[][] data', () => {
    const data = [
      ['Name'],
      ['BrandA'],
      ['BrandB'],
    ];
    const result = buildUploadPayload(data, 'brands.csv');
    expect(result.csvContent).toBe('Name\nBrandA\nBrandB');
    expect(result.contentLength).toBeGreaterThan(0);
    // contentLength should be byte length of the CSV string
    expect(result.contentLength).toBe(new TextEncoder().encode(result.csvContent).byteLength);
  });

  it('handles fields with commas and quotes per RFC 4180', () => {
    const data = [
      ['Name', 'Description'],
      ['Brand "A"', 'Has, commas'],
    ];
    const result = buildUploadPayload(data, 'test.csv');
    expect(result.csvContent).toContain('"Brand ""A"""');
    expect(result.csvContent).toContain('"Has, commas"');
  });

  it('handles empty data (header only)', () => {
    const data = [['Name']];
    const result = buildUploadPayload(data, 'empty.csv');
    expect(result.csvContent).toBe('Name');
    expect(result.contentLength).toBe(4);
  });
});

describe('getUploadSequence', () => {
  const makeCsvs = (overrides: Partial<OutputCSVs> = {}): OutputCSVs => ({
    brands: [['Name'], ['BrandA']],
    attributes: [['Name', 'Category'], ['Attr1', 'Effects']],
    products: [['ImportProductReferenceId'], ['P1']],
    variants: [['ImportProductReferenceId'], ['P1']],
    attributeJoins: [['ImportProductReferenceId'], ['P1']],
    images: [['ImportVariantReferenceId'], ['V1']],
    ...overrides,
  });

  it('returns files in correct order: brands, attributes, products, variants, attributeJoins, images', () => {
    const csvs = makeCsvs();
    const seq = getUploadSequence(csvs);
    const keys = seq.map((s) => s.key);
    expect(keys).toEqual(['brands', 'attributes', 'products', 'variants', 'attributeJoins', 'images']);
  });

  it('skips empty files (header only)', () => {
    const csvs = makeCsvs({
      images: [['ImportVariantReferenceId']], // header only -- empty
    });
    const seq = getUploadSequence(csvs);
    const keys = seq.map((s) => s.key);
    expect(keys).not.toContain('images');
  });

  it('provides human-readable labels for each file', () => {
    const csvs = makeCsvs();
    const seq = getUploadSequence(csvs);
    expect(seq[0].label).toBe('Brands');
    expect(seq[4].label).toBe('Attribute Joins');
    expect(seq[5].label).toBe('Images');
  });

  it('includes the data array for each file', () => {
    const csvs = makeCsvs();
    const seq = getUploadSequence(csvs);
    expect(seq[0].data).toEqual([['Name'], ['BrandA']]);
  });
});
