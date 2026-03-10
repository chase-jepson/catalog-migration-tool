import { describe, it, expect } from 'vitest';
import { validateInventoryRows, groupInventoryErrors } from '../lib/inventory-validator';
import type { InventoryDerivedRow } from '../lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<InventoryDerivedRow> = {}): InventoryDerivedRow {
  return {
    treezVariantId: '',
    variantReferenceId: 'V-SKU-001',
    dispensaryLicense: 'LIC-001',
    invoiceId: 'INV-1 - 2026-02-11 - Vendor A',
    invoiceCreatedDate: '2026-02-11',
    manifestNumber: '',
    traceTreezId: 'PKG-1',
    inventoryBarcodes: 'PKG-1',
    originalUnitCount: '20',
    units: '10',
    unitCost: '5.00',
    harvestDate: '2025-01-01',
    expirationDate: '2026-12-31',
    packagedDate: '2025-01-15',
    customerType: 'ADULT',
    thcAmount: '23.5',
    thcUom: '%',
    cbdAmount: '1.2',
    cbdUom: 'mg',
    locationPath: 'Front of House, Sales Floor',
    locationInventoryType: 'All Types',
    locationIsSellable: 'TRUE',
    locationDefaultReceivingLocation: 'FALSE',
    distributorName: 'Vendor A',
    distributorDBA: '',
    distributorAddress: '',
    distributorPhoneNumber: '',
    distributorEmail: '',
    distributorType: 'Non-Arms Length',
    distributorDefaultPaymentTerm: '',
    distributorLeadTime: '',
    distributorDeliveryDays: '',
    distributorPreferredPaymentMethod: '',
    distributorLicense1Type: '',
    distributorLicense1Number: '',
    distributorLicense1ExpirationDate: '',
    distributorLicense2Type: '',
    distributorLicense2Number: '',
    distributorLicense2ExpirationDate: '',
    distributorLicense3Type: '',
    distributorLicense3Number: '',
    distributorLicense3ExpirationDate: '',
    distributorRep1Name: '',
    distributorRep1Phone: '',
    distributorRep1Email: '',
    distributorRep1Role: '',
    distributorRep1Notes: '',
    distributorRep2Name: '',
    distributorRep2Phone: '',
    distributorRep2Email: '',
    distributorRep2Role: '',
    distributorRep2Notes: '',
    distributorRep3Name: '',
    distributorRep3Phone: '',
    distributorRep3Email: '',
    distributorRep3Role: '',
    distributorRep3Notes: '',
    productSKU: 'SKU-001',
    externalPackageId: 'PKG-1',
    productCategory: 'Flower',
    excluded: false,
    ...overrides,
  };
}

// ── validateInventoryRows ────────────────────────────────────────────────────

describe('validateInventoryRows', () => {
  it('valid row passes without errors', () => {
    const rows = [makeRow()];
    const result = validateInventoryRows(rows);

    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('empty VariantReferenceId produces error', () => {
    const rows = [makeRow({ variantReferenceId: '' })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(1);
    expect(result.errors[0].field).toBe('variantReferenceId');
    expect(result.errors[0].severity).toBe('error');
  });

  it('invalid Units (non-numeric) produces error', () => {
    const rows = [makeRow({ units: 'abc' })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(1);
    expect(result.errors[0].field).toBe('units');
    expect(result.errors[0].severity).toBe('error');
  });

  it('negative Units produces error', () => {
    const rows = [makeRow({ units: '-5' })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(1);
    expect(result.errors[0].field).toBe('units');
  });

  it('missing receipt data (empty invoiceId) produces warning', () => {
    const rows = [makeRow({ invoiceId: '', invoiceCreatedDate: '' })];
    const result = validateInventoryRows(rows, { hasReceipts: false });

    // When no receipts provided, empty invoiceId is acceptable (no warning)
    expect(result.warningCount).toBe(0);
  });

  it('empty invoiceId when receipts ARE provided produces warning', () => {
    const rows = [makeRow({ invoiceId: '' })];
    const result = validateInventoryRows(rows, { hasReceipts: true });

    expect(result.warningCount).toBeGreaterThanOrEqual(1);
    const invoiceWarning = result.errors.find((e) => e.field === 'invoiceId');
    expect(invoiceWarning?.severity).toBe('warning');
  });

  it('invalid date format produces warning', () => {
    const rows = [makeRow({ harvestDate: '2025-13-01' })];
    const result = validateInventoryRows(rows);

    // Invalid month 13 -- should warn
    const dateWarnings = result.errors.filter((e) => e.field === 'harvestDate');
    expect(dateWarnings.length).toBeGreaterThanOrEqual(1);
    expect(dateWarnings[0].severity).toBe('warning');
  });

  it('empty ExternalPackageId produces warning', () => {
    const rows = [makeRow({ externalPackageId: '' })];
    const result = validateInventoryRows(rows);

    const warning = result.errors.find((e) => e.field === 'externalPackageId');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('warning');
  });

  it('skips excluded rows', () => {
    const rows = [makeRow({ excluded: true, variantReferenceId: '' })];
    const result = validateInventoryRows(rows);

    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('returns correct counts with mixed errors and warnings', () => {
    const rows = [
      makeRow(), // valid
      makeRow({ variantReferenceId: '' }), // error
      makeRow({ externalPackageId: '' }), // warning
    ];
    const result = validateInventoryRows(rows);

    expect(result.validCount).toBe(2); // 3 active - 1 error
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(1);
  });
});

// ── groupInventoryErrors ────────────────────────────────────────────────────

describe('groupInventoryErrors', () => {
  it('groups errors by field+message', () => {
    const rows = [
      makeRow({ variantReferenceId: '' }),
      makeRow({ variantReferenceId: '' }),
    ];
    const result = validateInventoryRows(rows);
    const groups = groupInventoryErrors(result.errors);

    expect(groups.length).toBe(1);
    expect(groups[0].rows).toHaveLength(2);
  });
});
