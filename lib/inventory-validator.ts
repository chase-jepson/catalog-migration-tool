import type {
  InventoryDerivedRow,
  RowValidationError,
  ValidationResult,
} from './types';

export interface InventoryValidationOptions {
  /** Whether receipt files were provided (affects invoice field validation) */
  hasReceipts?: boolean;
}

/**
 * Validate inventory derived rows for the 56-column output.
 *
 * Rules:
 * - Excluded rows are skipped
 * - VariantReferenceId must not be empty (error)
 * - Units must be valid number >= 0 (error)
 * - UnitCost, if non-empty, must be valid number (warning)
 * - Date fields, if non-empty, must match yyyy-MM-dd (warning)
 * - ExternalPackageId should not be empty (warning)
 * - Missing invoice data when no receipts file is acceptable
 */
export function validateInventoryRows(
  rows: InventoryDerivedRow[],
  options: InventoryValidationOptions = {},
): ValidationResult {
  const errors: RowValidationError[] = [];
  const { hasReceipts = true } = options;

  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.excluded) continue;

    // VariantReferenceId must not be empty
    if (!row.variantReferenceId) {
      errors.push({
        rowIndex: i,
        field: 'variantReferenceId',
        currentValue: row.variantReferenceId,
        message: 'VariantReferenceId is required',
        fixType: 'text',
        severity: 'error',
      });
    }

    // Units must be valid number >= 0
    const unitsNum = Number(row.units);
    if (row.units !== '' && Number.isNaN(unitsNum)) {
      errors.push({
        rowIndex: i,
        field: 'units',
        currentValue: row.units,
        message: 'Units is not a valid number',
        fixType: 'text',
        severity: 'error',
      });
    } else if (unitsNum < 0) {
      errors.push({
        rowIndex: i,
        field: 'units',
        currentValue: row.units,
        message: 'Units cannot be negative',
        fixType: 'text',
        severity: 'error',
      });
    }

    // UnitCost: if non-empty, must be valid number
    if (row.unitCost && Number.isNaN(Number(row.unitCost))) {
      errors.push({
        rowIndex: i,
        field: 'unitCost',
        currentValue: row.unitCost,
        message: 'Unit cost is not a valid number',
        fixType: 'text',
        severity: 'warning',
      });
    }

    // Date fields: if non-empty, must match yyyy-MM-dd
    for (const dateField of ['harvestDate', 'expirationDate', 'packagedDate', 'invoiceCreatedDate'] as const) {
      const val = row[dateField];
      if (val && !dateRegex.test(val)) {
        errors.push({
          rowIndex: i,
          field: dateField,
          currentValue: val,
          message: `Invalid date format (expected yyyy-MM-dd): ${val}`,
          fixType: 'text',
          severity: 'warning',
        });
      }
    }

    // ExternalPackageId should not be empty
    if (!row.externalPackageId) {
      errors.push({
        rowIndex: i,
        field: 'externalPackageId',
        currentValue: row.externalPackageId,
        message: 'External Package ID is empty',
        fixType: 'text',
        severity: 'warning',
      });
    }

    // InvoiceId: only validate if receipts were provided
    if (hasReceipts && !row.invoiceId) {
      errors.push({
        rowIndex: i,
        field: 'invoiceId',
        currentValue: row.invoiceId,
        message: 'Invoice ID is empty (receipt data available but no match found)',
        fixType: 'text',
        severity: 'warning',
      });
    }
  }

  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;
  const activeRows = rows.filter((r) => !r.excluded).length;
  const validCount = activeRows - errorCount;

  return {
    validCount,
    errorCount,
    warningCount,
    errors,
  };
}

/**
 * Group validation errors by field+message for display.
 */
export function groupInventoryErrors(
  errors: RowValidationError[],
): { field: string; message: string; severity: 'error' | 'warning'; rows: { rowIndex: number; currentValue: string }[] }[] {
  const map = new Map<string, { field: string; message: string; severity: 'error' | 'warning'; rows: { rowIndex: number; currentValue: string }[] }>();

  for (const err of errors) {
    const key = `${err.field}::${err.message}`;
    if (!map.has(key)) {
      map.set(key, {
        field: err.field,
        message: err.message,
        severity: err.severity,
        rows: [],
      });
    }
    map.get(key)!.rows.push({
      rowIndex: err.rowIndex,
      currentValue: err.currentValue,
    });
  }

  return Array.from(map.values());
}
