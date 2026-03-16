import type { DerivedRow, RowValidationError, ValidationResult, ErrorGroup } from './types';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SUBCATEGORIES,
  VALID_CLASSIFICATIONS,
  EACH_UOM_CATEGORIES,
} from './constants';

const VALID_STATUSES = ['draft', 'active', 'inactive'];
const VALID_UOMS = ['each', 'grams', 'kilograms', 'milligrams', 'ounces', 'pounds'];

/**
 * Validate derived rows against Treez import schema rules.
 * Required field violations produce severity 'error' (blocking).
 * Missing optional fields produce severity 'warning' (non-blocking).
 * Only validates non-excluded rows.
 */
export function validateDerivedRows(derived: DerivedRow[]): ValidationResult {
  const errors: RowValidationError[] = [];

  for (let i = 0; i < derived.length; i++) {
    const row = derived[i];
    if (row.excluded) continue;

    // ── Required fields (severity: 'error') ──────────────────────────────

    // productName: non-empty
    if (!row.productName.trim()) {
      errors.push({
        rowIndex: i,
        field: 'productName',
        currentValue: row.productName,
        message: 'Product name is empty',
        fixType: 'text',
        severity: 'error',
      });
    }

    // category: must be in PRODUCT_CATEGORIES
    if (!PRODUCT_CATEGORIES.includes(row.category as (typeof PRODUCT_CATEGORIES)[number])) {
      errors.push({
        rowIndex: i,
        field: 'category',
        currentValue: row.category,
        message: `Invalid category: "${row.category}"`,
        fixType: 'dropdown',
        dropdownOptions: [...PRODUCT_CATEGORIES],
        severity: 'error',
      });
    }

    // subCategory: must be valid for its category
    const validSubs = PRODUCT_SUBCATEGORIES[row.category];
    if (validSubs && row.subCategory && !validSubs.includes(row.subCategory)) {
      errors.push({
        rowIndex: i,
        field: 'subCategory',
        currentValue: row.subCategory,
        message: `Invalid sub-category "${row.subCategory}" for ${row.category}`,
        fixType: 'dropdown',
        dropdownOptions: validSubs,
        severity: 'error',
      });
    }

    // status: must be draft/active/inactive
    if (!VALID_STATUSES.includes(row.status)) {
      errors.push({
        rowIndex: i,
        field: 'status',
        currentValue: row.status,
        message: `Invalid status: "${row.status}"`,
        fixType: 'dropdown',
        dropdownOptions: VALID_STATUSES,
        severity: 'error',
      });
    }

    // uom: must be valid enum
    if (!VALID_UOMS.includes(row.uom)) {
      errors.push({
        rowIndex: i,
        field: 'uom',
        currentValue: row.uom,
        message: `Invalid UoM: "${row.uom}"`,
        fixType: 'dropdown',
        dropdownOptions: VALID_UOMS,
        severity: 'error',
      });
    }

    // amount: required for non-each categories, must be > 0
    if (!EACH_UOM_CATEGORIES.has(row.category)) {
      if (!row.amount || row.amount < 0.0001) {
        errors.push({
          rowIndex: i,
          field: 'amount',
          currentValue: String(row.amount || 0),
          message: `Amount is required for ${row.category} variants`,
          fixType: 'text',
          severity: 'error',
        });
      } else if (row.amount > 999999.9999) {
        errors.push({
          rowIndex: i,
          field: 'amount',
          currentValue: String(row.amount),
          message: `Amount must be <= 999,999.9999 (got ${row.amount.toLocaleString()})`,
          fixType: 'text',
          severity: 'error',
        });
      }
    }

    // basePrice: required (non-empty)
    if (!row.basePrice || row.basePrice === '0') {
      errors.push({
        rowIndex: i,
        field: 'basePrice',
        currentValue: row.basePrice,
        message: 'Base price is required',
        fixType: 'text',
        severity: 'error',
      });
    }

    // classification: error if non-empty and invalid, warning if empty
    if (row.classification) {
      if (!VALID_CLASSIFICATIONS.includes(row.classification as (typeof VALID_CLASSIFICATIONS)[number])) {
        errors.push({
          rowIndex: i,
          field: 'classification',
          currentValue: row.classification,
          message: `Invalid classification: "${row.classification}"`,
          fixType: 'dropdown',
          dropdownOptions: [...VALID_CLASSIFICATIONS],
          severity: 'error',
        });
      }
    } else {
      errors.push({
        rowIndex: i,
        field: 'classification',
        currentValue: '',
        message: 'Classification is empty',
        fixType: 'dropdown',
        dropdownOptions: [...VALID_CLASSIFICATIONS],
        severity: 'warning',
      });
    }

    // ── Optional fields (severity: 'warning') ────────────────────────────

    // strain: warn if empty
    if (!row.strain?.trim()) {
      errors.push({
        rowIndex: i,
        field: 'strain',
        currentValue: row.strain || '',
        message: 'Strain is empty',
        fixType: 'text',
        severity: 'warning',
      });
    }

    // description: warn if empty
    if (!row.description?.trim()) {
      errors.push({
        rowIndex: i,
        field: 'description',
        currentValue: row.description || '',
        message: 'Description is empty',
        fixType: 'text',
        severity: 'warning',
      });
    }
  }

  // Count unique rows with errors vs warnings
  const errorRowIndices = new Set<number>();
  const warningRowIndices = new Set<number>();
  let errorCount = 0;
  let warningCount = 0;

  for (const err of errors) {
    if (err.severity === 'error') {
      errorRowIndices.add(err.rowIndex);
      errorCount++;
    } else {
      warningRowIndices.add(err.rowIndex);
      warningCount++;
    }
  }

  // errorCount/warningCount = count of individual error/warning entries
  // validCount = rows with zero errors (warnings don't block)
  const nonExcluded = derived.filter((r) => !r.excluded);
  const validCount = nonExcluded.length - errorRowIndices.size;

  return {
    validCount,
    errorCount,
    warningCount,
    errors,
  };
}

/**
 * Group errors by field + message for ReviewStep display.
 * Each group contains all affected rows. Sorted by row count descending.
 */
export function groupErrors(errors: RowValidationError[]): ErrorGroup[] {
  const groupMap = new Map<string, ErrorGroup>();

  for (const err of errors) {
    const key = `${err.field}|${err.message}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        field: err.field,
        message: err.message,
        severity: err.severity,
        fixType: err.fixType,
        dropdownOptions: err.dropdownOptions,
        rows: [],
      });
    }
    groupMap.get(key)!.rows.push({
      rowIndex: err.rowIndex,
      currentValue: err.currentValue,
    });
  }

  // Sort by affected row count descending
  return [...groupMap.values()].sort((a, b) => b.rows.length - a.rows.length);
}
