import { describe, it, expect } from 'vitest';
import { deriveInventoryRows, applyInventoryFixes } from '../lib/inventory-transformer';
import type { ParsedFile, FieldMapping, InventoryDerivedRow, RowFix } from '../lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeParsedFile(rows: Record<string, string>[], headers?: string[]): ParsedFile {
  const h = headers ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
  return {
    fileName: 'test.csv',
    fileSize: 100,
    headers: h,
    rows,
    rowCount: rows.length,
    previewRows: rows.slice(0, 10),
  };
}

function makeMappings(map: Record<string, string | null>): FieldMapping[] {
  return Object.entries(map).map(([fieldKey, sourceHeader]) => ({
    fieldKey,
    label: fieldKey,
    sourceHeader,
  }));
}

// ── deriveInventoryRows ──────────────────────────────────────────────────────

describe('deriveInventoryRows', () => {
  const productLookup: Record<string, string> = {
    'POS-001': 'TREEZ-V-100',
    'POS-002': 'TREEZ-V-200',
  };

  it('extracts fields from parsed rows using mappings', () => {
    const rows = [
      { ID: 'POS-001', Name: 'Blue Dream 1g', Qty: '25', Price: '10.50', Location: 'Room A' },
    ];
    const mappings = makeMappings({
      productIdentifier: 'ID',
      productName: 'Name',
      quantityOnHand: 'Qty',
      cost: 'Price',
      room: 'Location',
    });

    const result = deriveInventoryRows([makeParsedFile(rows)], mappings, productLookup);

    expect(result).toHaveLength(1);
    expect(result[0].posProductId).toBe('POS-001');
    expect(result[0].productName).toBe('Blue Dream 1g');
    expect(result[0].quantityOnHand).toBe(25);
    expect(result[0].cost).toBe('10.50');
    expect(result[0].room).toBe('Room A');
    expect(result[0].excluded).toBe(false);
  });

  it('matches rows with entries in the product lookup map', () => {
    const rows = [
      { ID: 'POS-001', Name: 'Blue Dream', Qty: '10', Price: '', Location: '' },
    ];
    const mappings = makeMappings({
      productIdentifier: 'ID',
      productName: 'Name',
      quantityOnHand: 'Qty',
      cost: 'Price',
      room: 'Location',
    });

    const result = deriveInventoryRows([makeParsedFile(rows)], mappings, productLookup);

    expect(result[0].matched).toBe(true);
    expect(result[0].treezVariantId).toBe('TREEZ-V-100');
  });

  it('marks unmatched rows with matched=false and no treezVariantId', () => {
    const rows = [
      { ID: 'POS-999', Name: 'Unknown Product', Qty: '5', Price: '', Location: '' },
    ];
    const mappings = makeMappings({
      productIdentifier: 'ID',
      productName: 'Name',
      quantityOnHand: 'Qty',
      cost: 'Price',
      room: 'Location',
    });

    const result = deriveInventoryRows([makeParsedFile(rows)], mappings, productLookup);

    expect(result[0].matched).toBe(false);
    expect(result[0].treezVariantId).toBeUndefined();
  });

  it('parses quantity: numeric string, zero, empty, non-numeric', () => {
    const rows = [
      { ID: 'POS-001', Name: 'A', Qty: '10', Price: '', Location: '' },
      { ID: 'POS-002', Name: 'B', Qty: '0', Price: '', Location: '' },
      { ID: 'POS-001', Name: 'C', Qty: '', Price: '', Location: '' },
      { ID: 'POS-001', Name: 'D', Qty: 'abc', Price: '', Location: '' },
    ];
    const mappings = makeMappings({
      productIdentifier: 'ID',
      productName: 'Name',
      quantityOnHand: 'Qty',
      cost: 'Price',
      room: 'Location',
    });

    const result = deriveInventoryRows([makeParsedFile(rows)], mappings, productLookup);

    expect(result[0].quantityOnHand).toBe(10);
    expect(result[1].quantityOnHand).toBe(0);
    expect(result[2].quantityOnHand).toBe(0);
    expect(result[3].quantityOnHand).toBeNaN();
  });

  it('parses cost: strips $ prefix, passthrough valid numbers, empty for unmapped', () => {
    const rows = [
      { ID: 'POS-001', Name: 'A', Qty: '1', Price: '$10.50', Location: '' },
      { ID: 'POS-001', Name: 'B', Qty: '1', Price: '5.25', Location: '' },
      { ID: 'POS-001', Name: 'C', Qty: '1', Price: '', Location: '' },
    ];
    const mappings = makeMappings({
      productIdentifier: 'ID',
      productName: 'Name',
      quantityOnHand: 'Qty',
      cost: 'Price',
      room: 'Location',
    });

    const result = deriveInventoryRows([makeParsedFile(rows)], mappings, productLookup);

    expect(result[0].cost).toBe('10.50');
    expect(result[1].cost).toBe('5.25');
    expect(result[2].cost).toBe('');
  });

  it('returns empty room when room is not mapped', () => {
    const rows = [
      { ID: 'POS-001', Name: 'A', Qty: '1', Price: '' },
    ];
    const mappings = makeMappings({
      productIdentifier: 'ID',
      productName: 'Name',
      quantityOnHand: 'Qty',
      cost: 'Price',
      room: null,
    });

    const result = deriveInventoryRows([makeParsedFile(rows)], mappings, productLookup);

    expect(result[0].room).toBe('');
  });

  it('handles multiple parsed files by merging them', () => {
    const file1 = makeParsedFile([
      { ID: 'POS-001', Name: 'Product A', Qty: '10', Price: '', Location: '' },
    ]);
    const file2 = makeParsedFile([
      { ID: 'POS-002', Name: 'Product B', Qty: '20', Price: '', Location: '' },
    ]);
    const mappings = makeMappings({
      productIdentifier: 'ID',
      productName: 'Name',
      quantityOnHand: 'Qty',
      cost: 'Price',
      room: 'Location',
    });

    const result = deriveInventoryRows([file1, file2], mappings, productLookup);

    expect(result).toHaveLength(2);
    expect(result[0].posProductId).toBe('POS-001');
    expect(result[1].posProductId).toBe('POS-002');
  });
});

// ── applyInventoryFixes ──────────────────────────────────────────────────────

describe('applyInventoryFixes', () => {
  const baseRows: InventoryDerivedRow[] = [
    {
      matched: true,
      posProductId: 'POS-001',
      productName: 'Blue Dream',
      treezVariantId: 'TREEZ-V-100',
      quantityOnHand: 10,
      cost: '5.00',
      room: 'Room A',
      excluded: false,
    },
    {
      matched: false,
      posProductId: 'POS-999',
      productName: 'Unknown',
      quantityOnHand: 5,
      cost: '',
      room: '',
      excluded: false,
    },
  ];

  it('applies fixes to specified fields', () => {
    const fixes: RowFix[] = [
      { rowIndex: 0, field: 'quantityOnHand', newValue: '20' },
      { rowIndex: 0, field: 'cost', newValue: '8.00' },
    ];

    const result = applyInventoryFixes(baseRows, fixes);

    expect(result[0].quantityOnHand).toBe(20);
    expect(result[0].cost).toBe('8.00');
    // Unchanged row
    expect(result[1].quantityOnHand).toBe(5);
  });

  it('returns original array when no fixes provided', () => {
    const result = applyInventoryFixes(baseRows, []);
    expect(result).toEqual(baseRows);
  });

  it('does not mutate the original rows', () => {
    const fixes: RowFix[] = [
      { rowIndex: 0, field: 'room', newValue: 'Room B' },
    ];

    const result = applyInventoryFixes(baseRows, fixes);

    expect(result[0].room).toBe('Room B');
    expect(baseRows[0].room).toBe('Room A');
  });
});
