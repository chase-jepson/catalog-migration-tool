import { describe, it, expect } from 'vitest';
import { buildInventoryCSV } from '../lib/inventory-csv-generator';
import type { InventoryDerivedRow } from '../lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<InventoryDerivedRow> = {}): InventoryDerivedRow {
  return {
    matched: true,
    posProductId: 'POS-001',
    productName: 'Test Product',
    treezVariantId: 'TREEZ-V-100',
    quantityOnHand: 10,
    cost: '5.00',
    room: 'Room A',
    excluded: false,
    ...overrides,
  };
}

// ── buildInventoryCSV ────────────────────────────────────────────────────────

describe('buildInventoryCSV', () => {
  it('produces correct header row', () => {
    const result = buildInventoryCSV([], 'STORE-1');

    expect(result).toHaveLength(1); // header only
    expect(result[0]).toEqual(['TreezVariantId', 'EntityId', 'QuantityOnHand', 'Cost', 'Room']);
  });

  it('includes matched, non-excluded rows in output', () => {
    const rows = [
      makeRow({ treezVariantId: 'TREEZ-V-100', quantityOnHand: 25, cost: '10.50', room: 'Room A' }),
      makeRow({ treezVariantId: 'TREEZ-V-200', quantityOnHand: 0, cost: '', room: '' }),
    ];

    const result = buildInventoryCSV(rows, 'STORE-1');

    expect(result).toHaveLength(3); // header + 2 data rows
    expect(result[1]).toEqual(['TREEZ-V-100', 'STORE-1', '25', '10.50', 'Room A']);
    expect(result[2]).toEqual(['TREEZ-V-200', 'STORE-1', '0', '', '']);
  });

  it('excludes unmatched rows', () => {
    const rows = [
      makeRow({ matched: true, treezVariantId: 'TREEZ-V-100' }),
      makeRow({ matched: false, treezVariantId: undefined }),
    ];

    const result = buildInventoryCSV(rows, 'STORE-1');

    expect(result).toHaveLength(2); // header + 1 matched row
  });

  it('excludes rows with excluded=true', () => {
    const rows = [
      makeRow({ excluded: false }),
      makeRow({ excluded: true }),
    ];

    const result = buildInventoryCSV(rows, 'STORE-1');

    expect(result).toHaveLength(2); // header + 1 non-excluded row
  });

  it('fills EntityId column with provided storeEntityId', () => {
    const rows = [makeRow()];
    const result = buildInventoryCSV(rows, 'MY-STORE-42');

    expect(result[1][1]).toBe('MY-STORE-42');
  });

  it('handles empty cost as empty string in output', () => {
    const rows = [makeRow({ cost: '' })];
    const result = buildInventoryCSV(rows, 'STORE-1');

    expect(result[1][3]).toBe('');
  });

  it('handles missing treezVariantId gracefully', () => {
    // Edge case: matched but somehow missing variant ID
    const rows = [makeRow({ matched: true, treezVariantId: undefined })];
    const result = buildInventoryCSV(rows, 'STORE-1');

    expect(result[1][0]).toBe('');
  });
});
