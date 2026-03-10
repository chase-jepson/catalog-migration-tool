import { describe, it, expect } from 'vitest';
import { validateInventoryRows } from '../lib/inventory-validator';
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

// ── validateInventoryRows ────────────────────────────────────────────────────

describe('validateInventoryRows', () => {
  it('returns clean result for valid matched rows', () => {
    const rows = [makeRow(), makeRow({ posProductId: 'POS-002', treezVariantId: 'TREEZ-V-200' })];
    const result = validateInventoryRows(rows);

    expect(result.validCount).toBe(2);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('produces warning (not error) for unmatched rows', () => {
    const rows = [
      makeRow({ matched: false, treezVariantId: undefined, posProductId: 'POS-999' }),
    ];
    const result = validateInventoryRows(rows);

    expect(result.warningCount).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].severity).toBe('warning');
    expect(result.errors[0].field).toBe('matched');
  });

  it('produces error for NaN quantity on matched row', () => {
    const rows = [makeRow({ quantityOnHand: NaN })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(1);
    expect(result.errors[0].field).toBe('quantityOnHand');
    expect(result.errors[0].severity).toBe('error');
    expect(result.errors[0].message).toContain('not a valid number');
  });

  it('produces error for negative quantity on matched row', () => {
    const rows = [makeRow({ quantityOnHand: -5 })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(1);
    expect(result.errors[0].field).toBe('quantityOnHand');
    expect(result.errors[0].severity).toBe('error');
    expect(result.errors[0].message).toContain('negative');
  });

  it('accepts zero quantity without error', () => {
    const rows = [makeRow({ quantityOnHand: 0 })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(0);
    expect(result.validCount).toBe(1);
  });

  it('produces error for non-numeric non-empty cost', () => {
    const rows = [makeRow({ cost: 'abc' })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(1);
    expect(result.errors[0].field).toBe('cost');
    expect(result.errors[0].severity).toBe('error');
  });

  it('produces error for negative cost', () => {
    const rows = [makeRow({ cost: '-10' })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(1);
    expect(result.errors[0].field).toBe('cost');
    expect(result.errors[0].severity).toBe('error');
    expect(result.errors[0].message).toContain('negative');
  });

  it('accepts empty cost without error (optional field)', () => {
    const rows = [makeRow({ cost: '' })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(0);
    expect(result.validCount).toBe(1);
  });

  it('skips excluded rows entirely', () => {
    const rows = [
      makeRow({ excluded: true, quantityOnHand: NaN }), // Would fail if not excluded
      makeRow(),
    ];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.validCount).toBe(1); // Only the non-excluded row counts
  });

  it('returns correct counts with mixed errors and warnings', () => {
    const rows = [
      makeRow(), // valid
      makeRow({ matched: false, treezVariantId: undefined }), // warning
      makeRow({ quantityOnHand: NaN }), // error
      makeRow({ cost: '-5' }), // error
    ];
    const result = validateInventoryRows(rows);

    expect(result.validCount).toBe(2); // 4 active - 2 errors
    expect(result.errorCount).toBe(2);
    expect(result.warningCount).toBe(1);
    expect(result.errors).toHaveLength(3);
  });
});
