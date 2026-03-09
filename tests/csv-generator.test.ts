import { describe, it, expect, vi } from 'vitest';
import { buildOutputCSVs, arrayToCSV, generateZip } from '../lib/csv-generator';
import type { DerivedRow, OutputCSVs } from '../lib/types';

/** Helper to create a valid DerivedRow with overrides */
function makeRow(overrides: Partial<DerivedRow> = {}): DerivedRow {
  return {
    excluded: false,
    productId: 'P - SKU-001',
    productName: 'Test Product',
    brand: 'TestBrand',
    category: 'Flower',
    subCategory: 'Flower - General',
    status: 'active',
    strain: 'OG Kush',
    classification: 'Hybrid',
    extractionMethod: '',
    uom: 'grams',
    amount: 3.5,
    weightInGrams: 3.5,
    unitCount: '',
    merchSize: '',
    skuBarcode: 'SKU-001',
    basePrice: '1000',
    description: 'A test product',
    menuTitle: '',
    hideFromMenu: 'FALSE',
    totalFlowerWeight: '3.5',
    totalConcentrateWeight: '',
    thc: '20.00',
    cbd: '5.00',
    tags: 'indoor',
    effects: 'relaxing',
    flavor: 'earthy',
    ingredients: '',
    imageFilename: 'https://example.com/img.jpg',
    priceTier: '',
    ...overrides,
  };
}

describe('buildOutputCSVs', () => {
  it('produces 6 non-empty arrays from valid rows', () => {
    const rows = [
      makeRow(),
      makeRow({ productId: 'P - SKU-002', productName: 'Product 2', skuBarcode: 'SKU-002', brand: 'BrandB' }),
      makeRow({ productId: 'P - SKU-003', productName: 'Product 3', skuBarcode: 'SKU-003', brand: 'BrandC' }),
    ];
    const result = buildOutputCSVs(rows);
    expect(result.brands.length).toBeGreaterThan(1); // header + data
    expect(result.attributes.length).toBeGreaterThan(1);
    expect(result.products.length).toBeGreaterThan(1);
    expect(result.variants.length).toBeGreaterThan(1);
    expect(result.attributeJoins.length).toBeGreaterThan(1);
    expect(result.images.length).toBeGreaterThan(1);
  });

  it('brands CSV has correct headers and deduplicates brands', () => {
    const rows: DerivedRow[] = [];
    // 10 rows with 3 unique brands
    for (let i = 0; i < 4; i++) rows.push(makeRow({ productId: `P - A${i}`, skuBarcode: `A${i}`, brand: 'Alpha' }));
    for (let i = 0; i < 3; i++) rows.push(makeRow({ productId: `P - B${i}`, skuBarcode: `B${i}`, brand: 'Beta' }));
    for (let i = 0; i < 3; i++) rows.push(makeRow({ productId: `P - G${i}`, skuBarcode: `G${i}`, brand: 'Gamma' }));

    const result = buildOutputCSVs(rows);
    // Header row
    expect(result.brands[0]).toEqual(['Name']);
    // 3 unique brands (data rows)
    const dataRows = result.brands.slice(1);
    expect(dataRows).toHaveLength(3);
    const brandNames = dataRows.map((r) => r[0]);
    expect(brandNames).toContain('Alpha');
    expect(brandNames).toContain('Beta');
    expect(brandNames).toContain('Gamma');
  });

  it('products CSV has correct headers and one row per unique product', () => {
    const rows = [
      makeRow({ productId: 'P - PROD1', productName: 'Widget', skuBarcode: 'V1' }),
      makeRow({ productId: 'P - PROD1', productName: 'Widget', skuBarcode: 'V2' }), // same product, diff variant
      makeRow({ productId: 'P - PROD2', productName: 'Gadget', skuBarcode: 'V3' }),
    ];
    const result = buildOutputCSVs(rows);
    // Header check
    expect(result.products[0][0]).toBe('ImportProductReferenceId');
    // 2 unique products
    const productData = result.products.slice(1);
    expect(productData).toHaveLength(2);
  });

  it('variants CSV has one row per DerivedRow (by skuBarcode)', () => {
    const rows = [
      makeRow({ productId: 'P - PROD1', skuBarcode: 'V1' }),
      makeRow({ productId: 'P - PROD1', skuBarcode: 'V2' }),
      makeRow({ productId: 'P - PROD2', skuBarcode: 'V3' }),
    ];
    const result = buildOutputCSVs(rows);
    expect(result.variants[0][0]).toBe('ImportProductReferenceId');
    const variantData = result.variants.slice(1);
    expect(variantData).toHaveLength(3);
  });

  it('attributes CSV contains effects, flavor, tags deduped', () => {
    const rows = [
      makeRow({ productId: 'P - 1', skuBarcode: 'S1', effects: 'relaxing, uplifting', flavor: 'earthy', tags: 'indoor' }),
      makeRow({ productId: 'P - 2', skuBarcode: 'S2', effects: 'relaxing', flavor: 'citrus', tags: 'indoor' }),
    ];
    const result = buildOutputCSVs(rows);
    expect(result.attributes[0]).toEqual(['Name', 'Category']);
    const attrData = result.attributes.slice(1);
    // Should have: relaxing (Effects), uplifting (Effects), earthy (Flavor), citrus (Flavor), indoor (Internal Tags)
    const names = attrData.map((r) => r[0]);
    expect(names).toContain('relaxing');
    expect(names).toContain('uplifting');
    expect(names).toContain('earthy');
    expect(names).toContain('citrus');
    expect(names).toContain('indoor');
    // 'relaxing' should appear only once (deduped)
    expect(names.filter((n) => n === 'relaxing')).toHaveLength(1);
  });

  it('attributeJoins CSV links products to their attributes', () => {
    const rows = [
      makeRow({ productId: 'P - 1', skuBarcode: 'S1', effects: 'relaxing', flavor: 'earthy', tags: 'indoor' }),
    ];
    const result = buildOutputCSVs(rows);
    expect(result.attributeJoins[0][0]).toBe('ImportProductReferenceId');
    const joinData = result.attributeJoins.slice(1);
    expect(joinData).toHaveLength(1);
    expect(joinData[0][0]).toBe('P - 1'); // product ref
  });

  it('images CSV only includes rows with imageFilename', () => {
    const rows = [
      makeRow({ productId: 'P - 1', skuBarcode: 'S1', imageFilename: 'https://img.com/a.jpg' }),
      makeRow({ productId: 'P - 2', skuBarcode: 'S2', imageFilename: '' }),
      makeRow({ productId: 'P - 3', skuBarcode: 'S3', imageFilename: 'https://img.com/b.jpg' }),
    ];
    const result = buildOutputCSVs(rows);
    const imageData = result.images.slice(1);
    expect(imageData).toHaveLength(2);
  });

  it('excludes rows with excluded = true', () => {
    const rows = [
      makeRow({ excluded: true, productId: 'P - EX', skuBarcode: 'EX' }),
      makeRow({ productId: 'P - OK', skuBarcode: 'OK' }),
    ];
    const result = buildOutputCSVs(rows);
    const productData = result.products.slice(1);
    expect(productData).toHaveLength(1);
    expect(productData[0][0]).toBe('P - OK');
  });
});

describe('arrayToCSV', () => {
  it('converts a 2D array to CSV string', () => {
    const data = [['Name', 'Value'], ['Test', '123']];
    const csv = arrayToCSV(data);
    expect(csv).toContain('Name');
    expect(csv).toContain('Test');
  });

  it('escapes fields containing commas', () => {
    const data = [['Name'], ['Hello, World']];
    const csv = arrayToCSV(data);
    // RFC 4180: fields with commas are quoted
    expect(csv).toContain('"Hello, World"');
  });

  it('escapes fields containing quotes', () => {
    const data = [['Name'], ['Say "Hello"']];
    const csv = arrayToCSV(data);
    // RFC 4180: quotes are doubled inside quoted fields
    expect(csv).toContain('"Say ""Hello"""');
  });
});

describe('generateZip', () => {
  it('produces a Blob containing 6 CSV files', async () => {
    const csvs: OutputCSVs = {
      brands: [['Name'], ['TestBrand']],
      attributes: [['Name', 'Category'], ['relaxing', 'Effects']],
      products: [['ImportProductReferenceId'], ['P - 1']],
      variants: [['ImportProductReferenceId'], ['P - 1']],
      attributeJoins: [['ImportProductReferenceId'], ['P - 1']],
      images: [['ImportVariantReferenceId'], ['S1']],
    };
    const blob = await generateZip(csvs);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
