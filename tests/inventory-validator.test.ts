import { describe, it, expect } from 'vitest';
import {
  validateInventoryRows,
  validateCrossRow,
  groupInventoryErrors,
  mapPortalIssuesToErrors,
} from '../lib/inventory-validator';
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
    traceTreezId: '1A406030000296B000099999',
    inventoryBarcodes: '1A406030000296B000099999',
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

// ── Layer 1: validateInventoryRows ───────────────────────────────────────────

describe('validateInventoryRows', () => {
  it('valid row passes without errors', () => {
    const result = validateInventoryRows([makeRow()]);
    expect(result.errorCount).toBe(0);
    expect(result.validCount).toBe(1);
  });

  it('skips excluded rows', () => {
    const result = validateInventoryRows([makeRow({ excluded: true, variantReferenceId: '' })]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  // ── Product ID ──

  it('errors when both treezVariantId and variantReferenceId are empty', () => {
    const result = validateInventoryRows([makeRow({ treezVariantId: '', variantReferenceId: '' })]);
    expect(result.errors.some((e) => e.field === 'variantReferenceId' && e.severity === 'error')).toBe(true);
  });

  it('passes when treezVariantId is set but variantReferenceId is empty', () => {
    const result = validateInventoryRows([makeRow({ treezVariantId: 'TV-123', variantReferenceId: '' })]);
    const prodErrors = result.errors.filter((e) => e.field === 'variantReferenceId' && e.severity === 'error');
    expect(prodErrors.length).toBe(0);
  });

  // ── TraceTreezId ──

  it('errors on TraceTreezId that is not 24 chars or empty', () => {
    const result = validateInventoryRows([makeRow({ traceTreezId: 'SHORT' })]);
    expect(result.errors.some((e) => e.field === 'traceTreezId' && e.message.includes('exactly 24 characters'))).toBe(true);
  });

  it('accepts empty TraceTreezId (Non-Inv/Merch)', () => {
    const result = validateInventoryRows([makeRow({ traceTreezId: '' })]);
    expect(result.errors.filter((e) => e.field === 'traceTreezId').length).toBe(0);
  });

  it('accepts 24-char TraceTreezId', () => {
    const result = validateInventoryRows([makeRow({ traceTreezId: '1A406030000296B000099999' })]);
    expect(result.errors.filter((e) => e.field === 'traceTreezId').length).toBe(0);
  });

  // ── Dispensary License ──

  it('errors on empty dispensaryLicense', () => {
    const result = validateInventoryRows([makeRow({ dispensaryLicense: '' })]);
    expect(result.errors.some((e) => e.field === 'dispensaryLicense' && e.severity === 'error')).toBe(true);
  });

  it('errors when dispensaryLicense exceeds 45 chars', () => {
    const result = validateInventoryRows([makeRow({ dispensaryLicense: 'A'.repeat(46) })]);
    expect(result.errors.some((e) => e.field === 'dispensaryLicense' && e.message.includes('45'))).toBe(true);
  });

  // ── Invoice ID ──

  it('errors on empty invoiceId', () => {
    const result = validateInventoryRows([makeRow({ invoiceId: '' })]);
    expect(result.errors.some((e) => e.field === 'invoiceId' && e.severity === 'error')).toBe(true);
  });

  // ── Invoice Created Date ──

  it('errors on empty invoiceCreatedDate', () => {
    const result = validateInventoryRows([makeRow({ invoiceCreatedDate: '' })]);
    expect(result.errors.some((e) => e.field === 'invoiceCreatedDate' && e.severity === 'error')).toBe(true);
  });

  it('errors on invalid invoiceCreatedDate format', () => {
    const result = validateInventoryRows([makeRow({ invoiceCreatedDate: '02/11/2026' })]);
    expect(result.errors.some((e) => e.field === 'invoiceCreatedDate' && e.severity === 'error')).toBe(true);
  });

  it('errors on future invoiceCreatedDate', () => {
    const result = validateInventoryRows([makeRow({ invoiceCreatedDate: '2099-01-01' })]);
    expect(result.errors.some((e) => e.field === 'invoiceCreatedDate' && e.message.includes('future'))).toBe(true);
  });

  // ── Manifest Number ──

  it('warns when manifestNumber exceeds 45 chars', () => {
    const result = validateInventoryRows([makeRow({ manifestNumber: 'M'.repeat(46) })]);
    expect(result.errors.some((e) => e.field === 'manifestNumber' && e.severity === 'warning')).toBe(true);
  });

  // ── Original Unit Count ──

  it('errors on empty originalUnitCount', () => {
    const result = validateInventoryRows([makeRow({ originalUnitCount: '' })]);
    expect(result.errors.some((e) => e.field === 'originalUnitCount' && e.severity === 'error')).toBe(true);
  });

  it('errors on non-whole originalUnitCount', () => {
    const result = validateInventoryRows([makeRow({ originalUnitCount: '5.5' })]);
    expect(result.errors.some((e) => e.field === 'originalUnitCount' && e.message.includes('whole number'))).toBe(true);
  });

  it('errors on negative originalUnitCount', () => {
    const result = validateInventoryRows([makeRow({ originalUnitCount: '-1' })]);
    expect(result.errors.some((e) => e.field === 'originalUnitCount' && e.severity === 'error')).toBe(true);
  });

  it('passes originalUnitCount of 0', () => {
    const result = validateInventoryRows([makeRow({ originalUnitCount: '0' })]);
    expect(result.errors.filter((e) => e.field === 'originalUnitCount').length).toBe(0);
  });

  // ── Units ──

  it('errors on non-whole units', () => {
    const result = validateInventoryRows([makeRow({ units: '5.5' })]);
    expect(result.errors.some((e) => e.field === 'units' && e.message.includes('whole number'))).toBe(true);
  });

  it('errors on negative units', () => {
    const result = validateInventoryRows([makeRow({ units: '-5' })]);
    expect(result.errors.some((e) => e.field === 'units' && e.severity === 'error')).toBe(true);
  });

  it('accepts empty units (depleted)', () => {
    const result = validateInventoryRows([makeRow({ units: '', locationPath: '' })]);
    expect(result.errors.filter((e) => e.field === 'units').length).toBe(0);
  });

  // ── Unit Cost ──

  it('errors on empty unitCost', () => {
    const result = validateInventoryRows([makeRow({ unitCost: '' })]);
    expect(result.errors.some((e) => e.field === 'unitCost' && e.severity === 'error')).toBe(true);
  });

  it('errors on non-numeric unitCost', () => {
    const result = validateInventoryRows([makeRow({ unitCost: 'abc' })]);
    expect(result.errors.some((e) => e.field === 'unitCost' && e.severity === 'error')).toBe(true);
  });

  it('errors on negative unitCost', () => {
    const result = validateInventoryRows([makeRow({ unitCost: '-1' })]);
    expect(result.errors.some((e) => e.field === 'unitCost' && e.message.includes('negative'))).toBe(true);
  });

  // ── Customer Type ──

  it('errors on invalid customerType', () => {
    const result = validateInventoryRows([makeRow({ customerType: 'INVALID' })]);
    expect(result.errors.some((e) => e.field === 'customerType' && e.severity === 'error')).toBe(true);
  });

  it('accepts case-insensitive customerType', () => {
    const result = validateInventoryRows([makeRow({ customerType: 'adult' })]);
    expect(result.errors.filter((e) => e.field === 'customerType').length).toBe(0);
  });

  // ── THC / CBD ──

  it('errors when thcAmount present but thcUom missing', () => {
    const result = validateInventoryRows([makeRow({ thcAmount: '23.5', thcUom: '' })]);
    expect(result.errors.some((e) => e.field === 'thcUom' && e.severity === 'error')).toBe(true);
  });

  it('errors on negative thcAmount', () => {
    const result = validateInventoryRows([makeRow({ thcAmount: '-1', thcUom: '%' })]);
    expect(result.errors.some((e) => e.field === 'thcAmount' && e.severity === 'error')).toBe(true);
  });

  it('errors when cbdAmount present but cbdUom missing', () => {
    const result = validateInventoryRows([makeRow({ cbdAmount: '1.2', cbdUom: '' })]);
    expect(result.errors.some((e) => e.field === 'cbdUom' && e.severity === 'error')).toBe(true);
  });

  it('errors on invalid thcUom', () => {
    const result = validateInventoryRows([makeRow({ thcUom: 'grams' })]);
    expect(result.errors.some((e) => e.field === 'thcUom' && e.severity === 'error')).toBe(true);
  });

  // ── Location ──

  it('errors when units > 0 but locationPath empty', () => {
    const result = validateInventoryRows([makeRow({ units: '10', locationPath: '' })]);
    expect(result.errors.some((e) => e.field === 'locationPath' && e.severity === 'error')).toBe(true);
  });

  it('no location error when units is 0', () => {
    const result = validateInventoryRows([makeRow({ units: '0', locationPath: '' })]);
    expect(result.errors.filter((e) => e.field === 'locationPath').length).toBe(0);
  });

  it('errors on invalid locationInventoryType', () => {
    const result = validateInventoryRows([makeRow({ locationInventoryType: 'Both' })]);
    expect(result.errors.some((e) => e.field === 'locationInventoryType' && e.severity === 'error')).toBe(true);
  });

  it('warns on invalid locationIsSellable', () => {
    const result = validateInventoryRows([makeRow({ locationIsSellable: 'Yes' })]);
    expect(result.errors.some((e) => e.field === 'locationIsSellable' && e.severity === 'warning')).toBe(true);
  });

  // ── Distributor ──

  it('errors on empty distributorName', () => {
    const result = validateInventoryRows([makeRow({ distributorName: '' })]);
    expect(result.errors.some((e) => e.field === 'distributorName' && e.severity === 'error')).toBe(true);
  });

  it('errors when distributorName exceeds 255 chars', () => {
    const result = validateInventoryRows([makeRow({ distributorName: 'D'.repeat(256) })]);
    expect(result.errors.some((e) => e.field === 'distributorName' && e.message.includes('255'))).toBe(true);
  });

  it('warns on invalid phone number', () => {
    const result = validateInventoryRows([makeRow({ distributorPhoneNumber: '123' })]);
    expect(result.errors.some((e) => e.field === 'distributorPhoneNumber' && e.severity === 'warning')).toBe(true);
  });

  it('warns on phone starting with 0 or 1', () => {
    const result = validateInventoryRows([makeRow({ distributorPhoneNumber: '0551234567' })]);
    expect(result.errors.some((e) => e.field === 'distributorPhoneNumber' && e.severity === 'warning')).toBe(true);
  });

  it('accepts valid 10-digit phone starting with 2-9', () => {
    const result = validateInventoryRows([makeRow({ distributorPhoneNumber: '5551234567' })]);
    expect(result.errors.filter((e) => e.field === 'distributorPhoneNumber').length).toBe(0);
  });

  it('warns on invalid email', () => {
    const result = validateInventoryRows([makeRow({ distributorEmail: 'not-an-email' })]);
    expect(result.errors.some((e) => e.field === 'distributorEmail' && e.severity === 'warning')).toBe(true);
  });

  it('errors on invalid distributorType', () => {
    const result = validateInventoryRows([makeRow({ distributorType: 'Unknown' })]);
    expect(result.errors.some((e) => e.field === 'distributorType' && e.severity === 'error')).toBe(true);
  });

  it('errors on invalid paymentTerm', () => {
    const result = validateInventoryRows([makeRow({ distributorDefaultPaymentTerm: 'Net 99' })]);
    expect(result.errors.some((e) => e.field === 'distributorDefaultPaymentTerm' && e.severity === 'error')).toBe(true);
  });

  it('errors on lead time < 1', () => {
    const result = validateInventoryRows([makeRow({ distributorLeadTime: '0' })]);
    expect(result.errors.some((e) => e.field === 'distributorLeadTime' && e.severity === 'error')).toBe(true);
  });

  it('errors on invalid paymentMethod', () => {
    const result = validateInventoryRows([makeRow({ distributorPreferredPaymentMethod: 'BITCOIN' })]);
    expect(result.errors.some((e) => e.field === 'distributorPreferredPaymentMethod' && e.severity === 'error')).toBe(true);
  });

  // ── License slots ──

  it('errors on invalid license type', () => {
    const result = validateInventoryRows([makeRow({ distributorLicense1Type: 'Commercial' })]);
    expect(result.errors.some((e) => e.field === 'distributorLicense1Type' && e.severity === 'error')).toBe(true);
  });

  it('errors when license number present but type missing', () => {
    const result = validateInventoryRows([makeRow({
      distributorLicense1Number: 'LIC-123',
      distributorLicense1Type: '',
      distributorLicense1ExpirationDate: '2028-12-31',
    })]);
    expect(result.errors.some((e) => e.field === 'distributorLicense1Type' && e.message.includes('required when License Number'))).toBe(true);
  });

  it('errors when license number present but expiration missing', () => {
    const result = validateInventoryRows([makeRow({
      distributorLicense1Number: 'LIC-123',
      distributorLicense1ExpirationDate: '',
    })]);
    expect(result.errors.some((e) => e.field === 'distributorLicense1ExpirationDate' && e.message.includes('missing Expiration Date'))).toBe(true);
  });

  it('errors on invalid license expiration date format', () => {
    const result = validateInventoryRows([makeRow({
      distributorLicense1Number: 'LIC-123',
      distributorLicense1ExpirationDate: '2026/12/31',
    })]);
    expect(result.errors.some((e) => e.field === 'distributorLicense1ExpirationDate')).toBe(true);
  });

  // ── Rep slots ──

  it('warns on invalid rep phone', () => {
    const result = validateInventoryRows([makeRow({ distributorRep1Phone: '555' })]);
    expect(result.errors.some((e) => e.field === 'distributorRep1Phone' && e.severity === 'warning')).toBe(true);
  });

  it('warns on invalid rep email', () => {
    const result = validateInventoryRows([makeRow({ distributorRep1Email: 'bad' })]);
    expect(result.errors.some((e) => e.field === 'distributorRep1Email' && e.severity === 'warning')).toBe(true);
  });

  // ── Date fields ──

  it('warns on invalid harvestDate format', () => {
    const result = validateInventoryRows([makeRow({ harvestDate: '2025-13-01' })]);
    expect(result.errors.some((e) => e.field === 'harvestDate' && e.severity === 'warning')).toBe(true);
  });

  // ── External Package ID ──

  it('warns on empty externalPackageId', () => {
    const result = validateInventoryRows([makeRow({ externalPackageId: '' })]);
    expect(result.errors.some((e) => e.field === 'externalPackageId' && e.severity === 'warning')).toBe(true);
  });

  // ── Counts ──

  it('counts rows with errors correctly (validCount)', () => {
    const rows = [
      makeRow(), // valid
      makeRow({ dispensaryLicense: '', distributorName: '' }), // 2 errors on same row
      makeRow({ externalPackageId: '' }), // only warning
    ];
    const result = validateInventoryRows(rows);
    // 3 active - 1 row with errors = 2 valid
    expect(result.validCount).toBe(2);
  });
});

// ── Layer 2: validateCrossRow ────────────────────────────────────────────────

describe('validateCrossRow', () => {
  // ── Package group consistency ──

  it('flags inconsistent originalUnitCount within package group', () => {
    const rows = [
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', originalUnitCount: '20' }),
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', originalUnitCount: '30' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.field === 'originalUnitCount')).toBe(true);
  });

  it('flags inconsistent unitCost within package group', () => {
    const rows = [
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', unitCost: '5.00' }),
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', unitCost: '10.00' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.field === 'unitCost')).toBe(true);
  });

  it('flags inconsistent customerType within package group', () => {
    const rows = [
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', customerType: 'ADULT' }),
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', customerType: 'MEDICAL' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.field === 'customerType')).toBe(true);
  });

  it('flags SUM(units) > originalUnitCount', () => {
    const rows = [
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', originalUnitCount: '10', units: '7' }),
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', originalUnitCount: '10', units: '5' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.field === 'units' && e.message.includes('SUM(Units)'))).toBe(true);
  });

  it('no error when SUM(units) <= originalUnitCount', () => {
    const rows = [
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', originalUnitCount: '20', units: '7' }),
      makeRow({ invoiceId: 'INV-1', traceTreezId: 'TT-1', originalUnitCount: '20', units: '5' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.filter((e) => e.message.includes('SUM(Units)')).length).toBe(0);
  });

  // ── Invoice group consistency ──

  it('flags multiple distributors within same invoice', () => {
    const rows = [
      makeRow({ invoiceId: 'INV-1', distributorName: 'Vendor A' }),
      makeRow({ invoiceId: 'INV-1', distributorName: 'Vendor B' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.field === 'distributorName' && e.message.includes('Multiple distributors'))).toBe(true);
  });

  it('flags dispensaryLicense variation within invoice', () => {
    const rows = [
      makeRow({ invoiceId: 'INV-1', dispensaryLicense: 'LIC-001' }),
      makeRow({ invoiceId: 'INV-1', dispensaryLicense: 'LIC-002' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.field === 'dispensaryLicense' && e.message.includes('varies'))).toBe(true);
  });

  it('flags invoiceCreatedDate variation within invoice', () => {
    const rows = [
      makeRow({ invoiceId: 'INV-1', invoiceCreatedDate: '2026-01-01' }),
      makeRow({ invoiceId: 'INV-1', invoiceCreatedDate: '2026-01-02' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.field === 'invoiceCreatedDate' && e.message.includes('varies'))).toBe(true);
  });

  // ── Distributor consistency ──

  it('flags distributor field variation across rows (case-insensitive name match)', () => {
    const rows = [
      makeRow({ distributorName: 'Vendor A', distributorType: 'Arms Length' }),
      makeRow({ distributorName: 'vendor a', distributorType: 'Non-Arms Length', invoiceId: 'INV-2' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.message.includes('Distributor Type varies'))).toBe(true);
  });

  // ── Location consistency ──

  it('flags location field variation (case-insensitive path match)', () => {
    const rows = [
      makeRow({ locationPath: 'Front of House', locationInventoryType: 'All Types' }),
      makeRow({ locationPath: 'front of house', locationInventoryType: 'Adult', invoiceId: 'INV-2' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.message.includes('Location Inventory Type varies'))).toBe(true);
  });

  // ── Global dispensary license ──

  it('flags multiple dispensary licenses globally', () => {
    const rows = [
      makeRow({ dispensaryLicense: 'LIC-001', invoiceId: 'INV-1' }),
      makeRow({ dispensaryLicense: 'LIC-002', invoiceId: 'INV-2' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.field === 'dispensaryLicense' && e.message.includes('varies across CSV'))).toBe(true);
  });

  // ── TraceTreezId cross-invoice ──

  it('flags traceTreezId appearing in multiple invoices', () => {
    const rows = [
      makeRow({ traceTreezId: 'TT-UNIQUE', invoiceId: 'INV-1' }),
      makeRow({ traceTreezId: 'TT-UNIQUE', invoiceId: 'INV-2' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.some((e) => e.field === 'traceTreezId' && e.message.includes('multiple invoices'))).toBe(true);
  });

  it('no error when traceTreezId is unique per invoice', () => {
    const rows = [
      makeRow({ traceTreezId: 'TT-1', invoiceId: 'INV-1' }),
      makeRow({ traceTreezId: 'TT-2', invoiceId: 'INV-2' }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.filter((e) => e.field === 'traceTreezId').length).toBe(0);
  });

  // ── Excluded rows ──

  it('skips excluded rows', () => {
    const rows = [
      makeRow({ dispensaryLicense: 'LIC-001' }),
      makeRow({ dispensaryLicense: 'LIC-002', excluded: true }),
    ];
    const errors = validateCrossRow(rows);
    expect(errors.filter((e) => e.field === 'dispensaryLicense' && e.message.includes('varies across CSV')).length).toBe(0);
  });
});

// ── groupInventoryErrors ────────────────────────────────────────────────────

describe('groupInventoryErrors', () => {
  it('groups errors by field+message', () => {
    const rows = [
      makeRow({ variantReferenceId: '', treezVariantId: '' }),
      makeRow({ variantReferenceId: '', treezVariantId: '' }),
    ];
    const result = validateInventoryRows(rows);
    const groups = groupInventoryErrors(result.errors);
    const prodGroup = groups.find((g) => g.field === 'variantReferenceId');
    expect(prodGroup?.rows).toHaveLength(2);
  });
});

// ── mapPortalIssuesToErrors ─────────────────────────────────────────────────

describe('mapPortalIssuesToErrors', () => {
  it('converts portal row_number (1-based + header) to 0-based rowIndex', () => {
    const issues = [
      { row_number: 2, field_name: 'Invoice ID', field_value: '', message: 'Required', severity: 'ERROR' },
    ];
    const mapped = mapPortalIssuesToErrors(issues);
    expect(mapped[0].rowIndex).toBe(0); // row 2 - 2 = 0
    expect(mapped[0].field).toBe('invoiceId');
    expect(mapped[0].severity).toBe('error');
    expect(mapped[0].message).toContain('[Portal]');
  });

  it('maps CSV column names to camelCase fields', () => {
    const issues = [
      { row_number: 5, field_name: 'Distributor Name', field_value: 'X', message: 'too long', severity: 'ERROR' },
    ];
    const mapped = mapPortalIssuesToErrors(issues);
    expect(mapped[0].field).toBe('distributorName');
    expect(mapped[0].rowIndex).toBe(3);
  });

  it('maps WARNING severity correctly', () => {
    const issues = [
      { row_number: 3, field_name: null, field_value: null, message: 'Minor issue', severity: 'WARNING' },
    ];
    const mapped = mapPortalIssuesToErrors(issues);
    expect(mapped[0].severity).toBe('warning');
    expect(mapped[0].field).toBe('unknown');
  });

  it('handles null row_number (global issue)', () => {
    const issues = [
      { row_number: null, field_name: 'Dispensary License', field_value: null, message: 'Multiple', severity: 'ERROR' },
    ];
    const mapped = mapPortalIssuesToErrors(issues);
    expect(mapped[0].rowIndex).toBe(-1);
  });
});
