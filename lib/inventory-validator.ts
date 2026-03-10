import type {
  InventoryDerivedRow,
  RowValidationError,
  ValidationResult,
} from './types';

/**
 * Validate inventory derived rows.
 *
 * Rules:
 * - Excluded rows are skipped entirely
 * - Unmatched rows (matched=false) produce a warning, NOT an error
 * - Matched rows: quantity must be a valid number >= 0
 * - Matched rows: cost, if non-empty, must be a valid number >= 0
 */
export function validateInventoryRows(
  rows: InventoryDerivedRow[],
): ValidationResult {
  const errors: RowValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.excluded) continue;

    // Unmatched rows produce a warning
    if (!row.matched) {
      errors.push({
        rowIndex: i,
        field: 'matched',
        currentValue: row.posProductId,
        message: `No Treez product match for "${row.posProductId || row.productName}"`,
        fixType: 'text',
        severity: 'warning',
      });
      continue; // Skip further validation for unmatched rows
    }

    // Quantity validation (required, must be number >= 0)
    if (Number.isNaN(row.quantityOnHand)) {
      errors.push({
        rowIndex: i,
        field: 'quantityOnHand',
        currentValue: String(row.quantityOnHand),
        message: 'Quantity is not a valid number',
        fixType: 'text',
        severity: 'error',
      });
    } else if (row.quantityOnHand < 0) {
      errors.push({
        rowIndex: i,
        field: 'quantityOnHand',
        currentValue: String(row.quantityOnHand),
        message: 'Quantity cannot be negative',
        fixType: 'text',
        severity: 'error',
      });
    }

    // Cost validation (optional, but if non-empty must be valid number >= 0)
    if (row.cost !== '') {
      const costNum = Number(row.cost);
      if (Number.isNaN(costNum)) {
        errors.push({
          rowIndex: i,
          field: 'cost',
          currentValue: row.cost,
          message: 'Cost is not a valid number',
          fixType: 'text',
          severity: 'error',
        });
      } else if (costNum < 0) {
        errors.push({
          rowIndex: i,
          field: 'cost',
          currentValue: row.cost,
          message: 'Cost cannot be negative',
          fixType: 'text',
          severity: 'error',
        });
      }
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
