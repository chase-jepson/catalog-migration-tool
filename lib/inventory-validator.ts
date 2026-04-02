import type { InventoryDerivedRow, RowValidationError, ValidationResult } from "./types";

// ── Validation Constants ────────────────────────────────────────────────────

const CUSTOMER_TYPE_VALUES = ["ADULT", "MEDICAL", "ALL"] as const;
const LOCATION_INVENTORY_TYPE_VALUES = ["All Types", "Medical", "Adult"] as const;
const DISTRIBUTOR_TYPE_VALUES = ["Arms Length", "Non-Arms Length"] as const;
const LAB_UOM_VALUES = ["%", "mg"] as const;
const LICENSE_TYPE_VALUES = ["Adult", "Medical"] as const;
const PAYMENT_TERM_VALUES = ["COD", "PIA", "EOM", "Net 7", "Net 10", "Net 14", "Net 30"] as const;
const PAYMENT_METHOD_VALUES = ["CASH", "CHECK", "ACH", "WIRE"] as const;
const BOOLEAN_VALUES = ["TRUE", "FALSE"] as const;

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_LIMITS: Record<string, number> = {
  dispensaryLicense: 45,
  manifestNumber: 45,
  distributorName: 255,
  distributorDBA: 255,
  distributorAddress: 255,
  distributorEmail: 100,
  distributorRep1Email: 100,
  distributorRep2Email: 100,
  distributorRep3Email: 100,
};

function normalizePhone(raw: string): { valid: boolean; normalized: string } {
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  // Portal requires 10 digits with first digit 2-9
  return { valid: normalized.length === 10 && /^[2-9]/.test(normalized), normalized };
}

function matchesEnum(value: string, values: readonly string[]): boolean {
  const lower = value.toLowerCase();
  return values.some((v) => v.toLowerCase() === lower);
}

function isValidDecimal(value: string): boolean {
  return !Number.isNaN(Number(value)) && value.trim() !== "";
}

function isNonNegativeDecimal(value: string): boolean {
  const n = Number(value);
  return !Number.isNaN(n) && value.trim() !== "" && n >= 0;
}

function isWholeNumber(value: string): boolean {
  const n = Number(value);
  return !Number.isNaN(n) && value.trim() !== "" && Number.isInteger(n);
}

interface InventoryValidationOptions {
  /** Whether receipt files were provided (affects invoice field validation) */
  hasReceipts?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function err(
  rowIndex: number,
  field: string,
  currentValue: string,
  message: string,
  severity: "error" | "warning" = "error",
  fixType: "text" | "dropdown" = "text",
  dropdownOptions?: string[],
): RowValidationError {
  return { rowIndex, field, currentValue, message, fixType, severity, dropdownOptions };
}

// ── Layer 1: Per-field validation ────────────────────────────────────────────

/**
 * Validate inventory derived rows for the 56-column output.
 * Comprehensive per-field rules ported from the portal's csv_row.py.
 */
export function validateInventoryRows(
  rows: InventoryDerivedRow[],
  _options: InventoryValidationOptions = {},
): ValidationResult {
  const errors: RowValidationError[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.excluded) continue;

    // ── Product ID: at least one of treezVariantId or variantReferenceId ──
    if (!row.treezVariantId && !row.variantReferenceId) {
      errors.push(
        err(
          i,
          "variantReferenceId",
          row.variantReferenceId,
          "Must have at least one of TreezVariantId or VariantReferenceId",
        ),
      );
    }

    // ── TraceTreezId: exactly 24 chars (METRC) or empty ──
    if (row.traceTreezId && row.traceTreezId.length !== 24) {
      errors.push(
        err(
          i,
          "traceTreezId",
          row.traceTreezId,
          `TraceTreezId '${row.traceTreezId}' is invalid. Expected: exactly 24 characters for METRC items, or empty for Non-Inv/Merch`,
        ),
      );
    }

    // ── Dispensary License: required, max 45 chars ──
    if (!row.dispensaryLicense) {
      errors.push(
        err(i, "dispensaryLicense", row.dispensaryLicense, "Dispensary License is required"),
      );
    } else if (row.dispensaryLicense.length > FIELD_LIMITS.dispensaryLicense) {
      errors.push(
        err(
          i,
          "dispensaryLicense",
          row.dispensaryLicense,
          `Dispensary License exceeds ${FIELD_LIMITS.dispensaryLicense} characters`,
        ),
      );
    }

    // ── Invoice ID: required ──
    if (!row.invoiceId) {
      errors.push(err(i, "invoiceId", row.invoiceId, "Invoice ID is required"));
    }

    // ── Invoice Created Date: required, YYYY-MM-DD, not in future ──
    if (!row.invoiceCreatedDate) {
      errors.push(
        err(i, "invoiceCreatedDate", row.invoiceCreatedDate, "Invoice Created Date is required"),
      );
    } else if (!DATE_REGEX.test(row.invoiceCreatedDate)) {
      errors.push(
        err(
          i,
          "invoiceCreatedDate",
          row.invoiceCreatedDate,
          `Invalid date format (expected YYYY-MM-DD): ${row.invoiceCreatedDate}`,
        ),
      );
    } else if (row.invoiceCreatedDate > today) {
      errors.push(
        err(
          i,
          "invoiceCreatedDate",
          row.invoiceCreatedDate,
          `Invoice Created Date '${row.invoiceCreatedDate}' is in the future`,
        ),
      );
    }

    // ── Manifest Number: max 45 chars (warning) ──
    if (row.manifestNumber && row.manifestNumber.length > FIELD_LIMITS.manifestNumber) {
      errors.push(
        err(
          i,
          "manifestNumber",
          row.manifestNumber,
          `Manifest Number exceeds ${FIELD_LIMITS.manifestNumber} characters`,
          "warning",
        ),
      );
    }

    // ── Original Unit Count: required, whole number >= 0 ──
    if (!row.originalUnitCount && row.originalUnitCount !== "0") {
      errors.push(
        err(i, "originalUnitCount", row.originalUnitCount, "Original Unit Count is required"),
      );
    } else if (!isWholeNumber(row.originalUnitCount)) {
      errors.push(
        err(
          i,
          "originalUnitCount",
          row.originalUnitCount,
          `Original Unit Count '${row.originalUnitCount}' must be a whole number`,
        ),
      );
    } else if (Number(row.originalUnitCount) < 0) {
      errors.push(
        err(
          i,
          "originalUnitCount",
          row.originalUnitCount,
          "Original Unit Count cannot be negative",
        ),
      );
    }

    // ── Units: whole number >= 0 (empty = depleted, ok) ──
    if (row.units !== "") {
      if (!isWholeNumber(row.units)) {
        errors.push(err(i, "units", row.units, `Units '${row.units}' must be a whole number`));
      } else if (Number(row.units) < 0) {
        errors.push(err(i, "units", row.units, "Units cannot be negative"));
      }
    }

    // ── Unit Cost: required, decimal >= 0 ──
    if (!row.unitCost && row.unitCost !== "0") {
      errors.push(err(i, "unitCost", row.unitCost, "Unit Cost is required"));
    } else if (!isNonNegativeDecimal(row.unitCost)) {
      if (!isValidDecimal(row.unitCost)) {
        errors.push(
          err(i, "unitCost", row.unitCost, `Unit Cost '${row.unitCost}' is not a valid number`),
        );
      } else {
        errors.push(err(i, "unitCost", row.unitCost, "Unit Cost cannot be negative"));
      }
    }

    // ── Customer Type: ADULT/MEDICAL/ALL enum ──
    if (row.customerType && !matchesEnum(row.customerType, CUSTOMER_TYPE_VALUES)) {
      errors.push(
        err(
          i,
          "customerType",
          row.customerType,
          `Customer Type '${row.customerType}' not valid. Expected: ${CUSTOMER_TYPE_VALUES.join(", ")}`,
          "error",
          "dropdown",
          [...CUSTOMER_TYPE_VALUES],
        ),
      );
    }

    // ── THC Amount / UoM ──
    if (row.thcAmount) {
      if (!isNonNegativeDecimal(row.thcAmount)) {
        errors.push(
          err(
            i,
            "thcAmount",
            row.thcAmount,
            `THC Amount '${row.thcAmount}' must be a non-negative number`,
          ),
        );
      } else if (!row.thcUom) {
        errors.push(
          err(
            i,
            "thcUom",
            row.thcUom,
            "THC UoM is required when THC Amount is provided",
            "error",
            "dropdown",
            [...LAB_UOM_VALUES],
          ),
        );
      }
    }
    if (row.thcUom && !matchesEnum(row.thcUom, LAB_UOM_VALUES)) {
      errors.push(
        err(
          i,
          "thcUom",
          row.thcUom,
          `THC UoM '${row.thcUom}' not valid. Expected: ${LAB_UOM_VALUES.join(", ")}`,
          "error",
          "dropdown",
          [...LAB_UOM_VALUES],
        ),
      );
    }

    // ── CBD Amount / UoM ──
    if (row.cbdAmount) {
      if (!isNonNegativeDecimal(row.cbdAmount)) {
        errors.push(
          err(
            i,
            "cbdAmount",
            row.cbdAmount,
            `CBD Amount '${row.cbdAmount}' must be a non-negative number`,
          ),
        );
      } else if (!row.cbdUom) {
        errors.push(
          err(
            i,
            "cbdUom",
            row.cbdUom,
            "CBD UoM is required when CBD Amount is provided",
            "error",
            "dropdown",
            [...LAB_UOM_VALUES],
          ),
        );
      }
    }
    if (row.cbdUom && !matchesEnum(row.cbdUom, LAB_UOM_VALUES)) {
      errors.push(
        err(
          i,
          "cbdUom",
          row.cbdUom,
          `CBD UoM '${row.cbdUom}' not valid. Expected: ${LAB_UOM_VALUES.join(", ")}`,
          "error",
          "dropdown",
          [...LAB_UOM_VALUES],
        ),
      );
    }

    // ── Location Path: required when units > 0 ──
    const unitsNum = Number(row.units);
    if (!Number.isNaN(unitsNum) && unitsNum > 0 && !row.locationPath) {
      errors.push(
        err(i, "locationPath", row.locationPath, "Location Path is required when Units > 0"),
      );
    }

    // ── Location Inventory Type: enum ──
    if (
      row.locationInventoryType &&
      !matchesEnum(row.locationInventoryType, LOCATION_INVENTORY_TYPE_VALUES)
    ) {
      errors.push(
        err(
          i,
          "locationInventoryType",
          row.locationInventoryType,
          `Location Inventory Type '${row.locationInventoryType}' not valid. Expected: ${LOCATION_INVENTORY_TYPE_VALUES.join(", ")}`,
          "error",
          "dropdown",
          [...LOCATION_INVENTORY_TYPE_VALUES],
        ),
      );
    }

    // ── Location Is Sellable: TRUE/FALSE (warning) ──
    if (row.locationIsSellable && !matchesEnum(row.locationIsSellable, BOOLEAN_VALUES)) {
      errors.push(
        err(
          i,
          "locationIsSellable",
          row.locationIsSellable,
          `Location Is Sellable must be TRUE or FALSE`,
          "warning",
          "dropdown",
          [...BOOLEAN_VALUES],
        ),
      );
    }

    // ── Location Default Receiving: TRUE/FALSE (warning) ──
    if (
      row.locationDefaultReceivingLocation &&
      !matchesEnum(row.locationDefaultReceivingLocation, BOOLEAN_VALUES)
    ) {
      errors.push(
        err(
          i,
          "locationDefaultReceivingLocation",
          row.locationDefaultReceivingLocation,
          `Location Default Receiving Location must be TRUE or FALSE`,
          "warning",
          "dropdown",
          [...BOOLEAN_VALUES],
        ),
      );
    }

    // ── Distributor Name: required, max 255 chars ──
    if (!row.distributorName) {
      errors.push(err(i, "distributorName", row.distributorName, "Distributor Name is required"));
    } else if (row.distributorName.length > FIELD_LIMITS.distributorName) {
      errors.push(
        err(
          i,
          "distributorName",
          row.distributorName,
          `Distributor Name exceeds ${FIELD_LIMITS.distributorName} characters`,
        ),
      );
    }

    // ── Distributor DBA: max 255 ──
    if (row.distributorDBA && row.distributorDBA.length > FIELD_LIMITS.distributorDBA) {
      errors.push(
        err(
          i,
          "distributorDBA",
          row.distributorDBA,
          `Distributor DBA exceeds ${FIELD_LIMITS.distributorDBA} characters`,
          "warning",
        ),
      );
    }

    // ── Distributor Address: max 255 ──
    if (row.distributorAddress && row.distributorAddress.length > FIELD_LIMITS.distributorAddress) {
      errors.push(
        err(
          i,
          "distributorAddress",
          row.distributorAddress,
          `Distributor Address exceeds ${FIELD_LIMITS.distributorAddress} characters`,
          "warning",
        ),
      );
    }

    // ── Distributor Phone: 10 digits (warning) ──
    if (row.distributorPhoneNumber) {
      const phone = normalizePhone(row.distributorPhoneNumber);
      if (!phone.valid) {
        errors.push(
          err(
            i,
            "distributorPhoneNumber",
            row.distributorPhoneNumber,
            `Phone '${row.distributorPhoneNumber}' must be 10 digits`,
            "warning",
          ),
        );
      }
    }

    // ── Distributor Email: regex + max 100 (warning) ──
    if (row.distributorEmail) {
      if (row.distributorEmail.length > FIELD_LIMITS.distributorEmail) {
        errors.push(
          err(
            i,
            "distributorEmail",
            row.distributorEmail,
            "Distributor Email exceeds 100 characters",
            "warning",
          ),
        );
      } else if (!EMAIL_REGEX.test(row.distributorEmail)) {
        errors.push(
          err(
            i,
            "distributorEmail",
            row.distributorEmail,
            `Email '${row.distributorEmail}' is not valid`,
            "warning",
          ),
        );
      }
    }

    // ── Distributor Type: enum ──
    if (row.distributorType && !matchesEnum(row.distributorType, DISTRIBUTOR_TYPE_VALUES)) {
      errors.push(
        err(
          i,
          "distributorType",
          row.distributorType,
          `Distributor Type '${row.distributorType}' not valid. Expected: ${DISTRIBUTOR_TYPE_VALUES.join(", ")}`,
          "error",
          "dropdown",
          [...DISTRIBUTOR_TYPE_VALUES],
        ),
      );
    }

    // ── Distributor Default Payment Term: enum ──
    if (
      row.distributorDefaultPaymentTerm &&
      !matchesEnum(row.distributorDefaultPaymentTerm, PAYMENT_TERM_VALUES)
    ) {
      errors.push(
        err(
          i,
          "distributorDefaultPaymentTerm",
          row.distributorDefaultPaymentTerm,
          `Payment Term '${row.distributorDefaultPaymentTerm}' not valid. Expected: ${PAYMENT_TERM_VALUES.join(", ")}`,
          "error",
          "dropdown",
          [...PAYMENT_TERM_VALUES],
        ),
      );
    }

    // ── Distributor Lead Time: integer >= 1 ──
    if (row.distributorLeadTime) {
      const lt = Number(row.distributorLeadTime);
      if (!Number.isInteger(lt) || lt < 1) {
        errors.push(
          err(
            i,
            "distributorLeadTime",
            row.distributorLeadTime,
            `Lead Time '${row.distributorLeadTime}' must be an integer >= 1`,
          ),
        );
      }
    }

    // ── Distributor Preferred Payment Method: enum ──
    if (
      row.distributorPreferredPaymentMethod &&
      !matchesEnum(row.distributorPreferredPaymentMethod, PAYMENT_METHOD_VALUES)
    ) {
      errors.push(
        err(
          i,
          "distributorPreferredPaymentMethod",
          row.distributorPreferredPaymentMethod,
          `Payment Method '${row.distributorPreferredPaymentMethod}' not valid. Expected: ${PAYMENT_METHOD_VALUES.join(", ")}`,
          "error",
          "dropdown",
          [...PAYMENT_METHOD_VALUES],
        ),
      );
    }

    // ── License slots 1-3 ──
    for (const n of [1, 2, 3] as const) {
      const typeField = `distributorLicense${n}Type` as keyof InventoryDerivedRow;
      const numberField = `distributorLicense${n}Number` as keyof InventoryDerivedRow;
      const expField = `distributorLicense${n}ExpirationDate` as keyof InventoryDerivedRow;
      const typeVal = row[typeField] as string;
      const numberVal = row[numberField] as string;
      const expVal = row[expField] as string;

      if (typeVal && !matchesEnum(typeVal, LICENSE_TYPE_VALUES)) {
        errors.push(
          err(
            i,
            typeField,
            typeVal,
            `License ${n} Type '${typeVal}' not valid. Expected: ${LICENSE_TYPE_VALUES.join(", ")}`,
            "error",
            "dropdown",
            [...LICENSE_TYPE_VALUES],
          ),
        );
      }
      if (numberVal && !typeVal) {
        errors.push(
          err(
            i,
            typeField,
            typeVal,
            `License ${n} Type is required when License Number is present. Expected: ${LICENSE_TYPE_VALUES.join(", ")}`,
            "error",
            "dropdown",
            [...LICENSE_TYPE_VALUES],
          ),
        );
      }
      if (numberVal && !expVal) {
        errors.push(
          err(
            i,
            expField,
            expVal,
            `Distributor License '${numberVal}' is missing Expiration Date (required by SellTreez)`,
          ),
        );
      }
      if (expVal && !DATE_REGEX.test(expVal)) {
        errors.push(
          err(
            i,
            expField,
            expVal,
            `License ${n} Expiration Date '${expVal}' is not a valid date (YYYY-MM-DD)`,
          ),
        );
      }
    }

    // ── Representative slots 1-3: phone/email (warning) ──
    for (const n of [1, 2, 3] as const) {
      const phoneField = `distributorRep${n}Phone` as keyof InventoryDerivedRow;
      const emailField = `distributorRep${n}Email` as keyof InventoryDerivedRow;
      const phoneVal = row[phoneField] as string;
      const emailVal = row[emailField] as string;

      if (phoneVal) {
        const phone = normalizePhone(phoneVal);
        if (!phone.valid) {
          errors.push(
            err(
              i,
              phoneField,
              phoneVal,
              `Rep ${n} Phone '${phoneVal}' must be 10 digits`,
              "warning",
            ),
          );
        }
      }
      if (emailVal) {
        const limit = FIELD_LIMITS[`distributorRep${n}Email` as keyof typeof FIELD_LIMITS] ?? 100;
        if (emailVal.length > limit) {
          errors.push(
            err(i, emailField, emailVal, `Rep ${n} Email exceeds 100 characters`, "warning"),
          );
        } else if (!EMAIL_REGEX.test(emailVal)) {
          errors.push(
            err(i, emailField, emailVal, `Rep ${n} Email '${emailVal}' is not valid`, "warning"),
          );
        }
      }
    }

    // ── Optional date fields: warn on bad format ──
    for (const dateField of ["harvestDate", "expirationDate", "packagedDate"] as const) {
      const val = row[dateField];
      if (val && !DATE_REGEX.test(val)) {
        errors.push(
          err(i, dateField, val, `Invalid date format (expected YYYY-MM-DD): ${val}`, "warning"),
        );
      }
    }

    // ── ExternalPackageId: warn if empty ──
    if (!row.externalPackageId) {
      errors.push(
        err(
          i,
          "externalPackageId",
          row.externalPackageId,
          "External Package ID is empty",
          "warning",
        ),
      );
    }
  }

  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warningCount = errors.filter((e) => e.severity === "warning").length;
  const activeRows = rows.filter((r) => !r.excluded).length;
  // validCount = rows with zero errors (count unique rowIndices with errors)
  const rowsWithErrors = new Set(
    errors.filter((e) => e.severity === "error").map((e) => e.rowIndex),
  ).size;
  const validCount = activeRows - rowsWithErrors;

  return { validCount, errorCount, warningCount, errors };
}

// ── Layer 2: Cross-row validation ────────────────────────────────────────────

/**
 * Cross-row validation matching the portal's csv_parser.py.
 * Checks package group, invoice group, distributor, location, and global consistency.
 */
export function validateCrossRow(rows: InventoryDerivedRow[]): RowValidationError[] {
  const errors: RowValidationError[] = [];
  const active = rows.filter((r) => !r.excluded);

  _validatePackageGroupConsistency(active, rows, errors);
  _validateInvoiceGroupConsistency(active, rows, errors);
  _validateDistributorConsistency(active, rows, errors);
  _validateLocationConsistency(active, rows, errors);
  _validateGlobalDispensaryLicense(active, rows, errors);
  _validateTraceTreezIdCrossInvoice(active, rows, errors);

  return errors;
}

/** Find the original index in the full rows array for a given active row. */
function originalIndex(allRows: InventoryDerivedRow[], row: InventoryDerivedRow): number {
  return allRows.indexOf(row);
}

function fmtRows(indices: number[], maxShow = 5): string {
  const sorted = [...indices].sort((a, b) => a - b);
  if (sorted.length <= maxShow) return sorted.map((r) => String(r + 1)).join(", ");
  return (
    sorted
      .slice(0, maxShow)
      .map((r) => String(r + 1))
      .join(", ") + ` ... (${sorted.length} total)`
  );
}

// ── Package group: (invoiceId + traceTreezId) ────────────────────────────────

function _validatePackageGroupConsistency(
  active: InventoryDerivedRow[],
  allRows: InventoryDerivedRow[],
  errors: RowValidationError[],
): void {
  const groups = new Map<string, InventoryDerivedRow[]>();
  for (const row of active) {
    const key = `${row.invoiceId}||${row.traceTreezId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  for (const [, pkgRows] of groups) {
    if (pkgRows.length < 2) continue;
    const first = pkgRows[0];
    const firstIdx = originalIndex(allRows, first);

    for (const row of pkgRows.slice(1)) {
      const rowIdx = originalIndex(allRows, row);

      if (row.originalUnitCount !== first.originalUnitCount) {
        errors.push(
          err(
            rowIdx,
            "originalUnitCount",
            row.originalUnitCount,
            `Invoice '${first.invoiceId}', TraceTreezId '${first.traceTreezId}': ` +
              `Original Unit Count varies (${first.originalUnitCount} on row ${firstIdx + 1} vs ${row.originalUnitCount} on row ${rowIdx + 1})`,
          ),
        );
      }
      if (row.unitCost !== first.unitCost) {
        errors.push(
          err(
            rowIdx,
            "unitCost",
            row.unitCost,
            `Invoice '${first.invoiceId}', TraceTreezId '${first.traceTreezId}': ` +
              `Unit Cost varies (${first.unitCost} on row ${firstIdx + 1} vs ${row.unitCost} on row ${rowIdx + 1})`,
          ),
        );
      }
      if (row.customerType.toUpperCase() !== first.customerType.toUpperCase()) {
        errors.push(
          err(
            rowIdx,
            "customerType",
            row.customerType,
            `Invoice '${first.invoiceId}', TraceTreezId '${first.traceTreezId}': ` +
              `Customer Type varies (${first.customerType} vs ${row.customerType})`,
          ),
        );
      }
    }

    // SUM(units) <= originalUnitCount
    const totalUnits = pkgRows.reduce((sum, r) => sum + (Number(r.units) || 0), 0);
    const origCount = Number(first.originalUnitCount) || 0;
    if (totalUnits > origCount) {
      const detail = pkgRows
        .map((r) => `row ${originalIndex(allRows, r) + 1}: ${r.units || 0} units`)
        .join(", ");
      errors.push(
        err(
          firstIdx,
          "units",
          String(totalUnits),
          `Invoice '${first.invoiceId}', TraceTreezId '${first.traceTreezId}': ` +
            `SUM(Units)=${totalUnits} exceeds Original Unit Count=${origCount}. ` +
            `Rows: [${detail}]`,
        ),
      );
    }
  }
}

// ── Invoice group: (invoiceId) ───────────────────────────────────────────────

function _validateInvoiceGroupConsistency(
  active: InventoryDerivedRow[],
  allRows: InventoryDerivedRow[],
  errors: RowValidationError[],
): void {
  const groups = new Map<string, InventoryDerivedRow[]>();
  for (const row of active) {
    if (!row.invoiceId) continue;
    if (!groups.has(row.invoiceId)) groups.set(row.invoiceId, []);
    groups.get(row.invoiceId)!.push(row);
  }

  for (const [invoiceId, invRows] of groups) {
    if (invRows.length < 2) continue;

    // Distributor name consistency
    const distNames = new Map<string, number[]>();
    for (const row of invRows) {
      const idx = originalIndex(allRows, row);
      if (!distNames.has(row.distributorName)) distNames.set(row.distributorName, []);
      distNames.get(row.distributorName)!.push(idx);
    }
    if (distNames.size > 1) {
      const detail = Array.from(distNames.entries())
        .map(([name, idxs]) => `'${name}' on rows ${fmtRows(idxs)}`)
        .join("; ");
      errors.push(
        err(
          originalIndex(allRows, invRows[0]),
          "distributorName",
          "",
          `Invoice '${invoiceId}': Multiple distributors — ${detail}`,
        ),
      );
    }

    // Dispensary license consistency
    const licenses = new Map<string, number[]>();
    for (const row of invRows) {
      const idx = originalIndex(allRows, row);
      if (!licenses.has(row.dispensaryLicense)) licenses.set(row.dispensaryLicense, []);
      licenses.get(row.dispensaryLicense)!.push(idx);
    }
    if (licenses.size > 1) {
      const detail = Array.from(licenses.entries())
        .map(([lic, idxs]) => `'${lic}' on rows ${fmtRows(idxs)}`)
        .join("; ");
      errors.push(
        err(
          originalIndex(allRows, invRows[0]),
          "dispensaryLicense",
          "",
          `Invoice '${invoiceId}': Dispensary License varies — ${detail}`,
        ),
      );
    }

    // Invoice created date consistency
    const dates = new Map<string, number[]>();
    for (const row of invRows) {
      const idx = originalIndex(allRows, row);
      if (!dates.has(row.invoiceCreatedDate)) dates.set(row.invoiceCreatedDate, []);
      dates.get(row.invoiceCreatedDate)!.push(idx);
    }
    if (dates.size > 1) {
      const detail = Array.from(dates.entries())
        .map(([d, idxs]) => `${d} on rows ${fmtRows(idxs)}`)
        .join("; ");
      errors.push(
        err(
          originalIndex(allRows, invRows[0]),
          "invoiceCreatedDate",
          "",
          `Invoice '${invoiceId}': Invoice Created Date varies — ${detail}`,
        ),
      );
    }
  }
}

// ── Distributor consistency (by name, case-insensitive) ──────────────────────

const DISTRIBUTOR_CONSISTENCY_FIELDS: { field: keyof InventoryDerivedRow; display: string }[] = [
  { field: "distributorDBA", display: "Distributor DBA" },
  { field: "distributorPhoneNumber", display: "Distributor Phone Number" },
  { field: "distributorAddress", display: "Distributor Address" },
  { field: "distributorEmail", display: "Distributor Email" },
  { field: "distributorType", display: "Distributor Type" },
  { field: "distributorDefaultPaymentTerm", display: "Distributor Default Payment Term" },
  { field: "distributorLeadTime", display: "Distributor Lead Time" },
  { field: "distributorDeliveryDays", display: "Distributor Delivery Days" },
  { field: "distributorPreferredPaymentMethod", display: "Distributor Preferred Payment Method" },
];

const DISTRIBUTOR_LICENSE_FIELDS: (keyof InventoryDerivedRow)[] = [
  "distributorLicense1Type",
  "distributorLicense1Number",
  "distributorLicense1ExpirationDate",
  "distributorLicense2Type",
  "distributorLicense2Number",
  "distributorLicense2ExpirationDate",
  "distributorLicense3Type",
  "distributorLicense3Number",
  "distributorLicense3ExpirationDate",
];

const DISTRIBUTOR_REP_FIELDS: (keyof InventoryDerivedRow)[] = [
  "distributorRep1Name",
  "distributorRep1Phone",
  "distributorRep1Email",
  "distributorRep1Role",
  "distributorRep1Notes",
  "distributorRep2Name",
  "distributorRep2Phone",
  "distributorRep2Email",
  "distributorRep2Role",
  "distributorRep2Notes",
  "distributorRep3Name",
  "distributorRep3Phone",
  "distributorRep3Email",
  "distributorRep3Role",
  "distributorRep3Notes",
];

function _validateDistributorConsistency(
  active: InventoryDerivedRow[],
  allRows: InventoryDerivedRow[],
  errors: RowValidationError[],
): void {
  const distMap = new Map<string, InventoryDerivedRow[]>();
  for (const row of active) {
    const key = row.distributorName.toUpperCase();
    if (!key) continue;
    if (!distMap.has(key)) distMap.set(key, []);
    distMap.get(key)!.push(row);
  }

  for (const [, distRows] of distMap) {
    if (distRows.length < 2) continue;
    const first = distRows[0];
    const firstIdx = originalIndex(allRows, first);

    // Check each scalar distributor field
    for (const { field, display } of DISTRIBUTOR_CONSISTENCY_FIELDS) {
      const firstVal = first[field];
      for (const row of distRows.slice(1)) {
        if (row[field] !== firstVal) {
          const rowIdx = originalIndex(allRows, row);
          errors.push(
            err(
              rowIdx,
              field,
              String(row[field]),
              `Distributor '${first.distributorName}': ${display} varies ` +
                `('${firstVal}' on row ${firstIdx + 1} [invoice ${first.invoiceId}] ` +
                `vs '${row[field]}' on row ${rowIdx + 1} [invoice ${row.invoiceId}])`,
            ),
          );
          break; // one error per field per distributor
        }
      }
    }

    // Check license slots
    for (const row of distRows.slice(1)) {
      const differs = DISTRIBUTOR_LICENSE_FIELDS.some((f) => row[f] !== first[f]);
      if (differs) {
        const rowIdx = originalIndex(allRows, row);
        errors.push(
          err(
            rowIdx,
            "distributorLicense1Number",
            "",
            `Distributor '${first.distributorName}': License data varies across rows ` +
              `(row ${firstIdx + 1} [invoice ${first.invoiceId}] ` +
              `vs row ${rowIdx + 1} [invoice ${row.invoiceId}])`,
          ),
        );
        break;
      }
    }

    // Check representative slots
    for (const row of distRows.slice(1)) {
      const differs = DISTRIBUTOR_REP_FIELDS.some((f) => row[f] !== first[f]);
      if (differs) {
        const rowIdx = originalIndex(allRows, row);
        errors.push(
          err(
            rowIdx,
            "distributorRep1Name",
            "",
            `Distributor '${first.distributorName}': Representative data varies across rows ` +
              `(row ${firstIdx + 1} [invoice ${first.invoiceId}] ` +
              `vs row ${rowIdx + 1} [invoice ${row.invoiceId}])`,
          ),
        );
        break;
      }
    }
  }
}

// ── Location consistency (by path, case-insensitive) ─────────────────────────

function _validateLocationConsistency(
  active: InventoryDerivedRow[],
  allRows: InventoryDerivedRow[],
  errors: RowValidationError[],
): void {
  const locMap = new Map<string, InventoryDerivedRow[]>();
  for (const row of active) {
    if (!row.locationPath) continue;
    const key = row.locationPath.toUpperCase();
    if (!locMap.has(key)) locMap.set(key, []);
    locMap.get(key)!.push(row);
  }

  const locationFields: { field: keyof InventoryDerivedRow; display: string }[] = [
    { field: "locationInventoryType", display: "Location Inventory Type" },
    { field: "locationIsSellable", display: "Location Is Sellable" },
    { field: "locationDefaultReceivingLocation", display: "Location Default Receiving Location" },
  ];

  for (const [, locRows] of locMap) {
    if (locRows.length < 2) continue;
    const first = locRows[0];
    const firstIdx = originalIndex(allRows, first);

    for (const { field, display } of locationFields) {
      const firstVal = first[field];
      for (const row of locRows.slice(1)) {
        if (row[field] !== firstVal) {
          const rowIdx = originalIndex(allRows, row);
          errors.push(
            err(
              rowIdx,
              field,
              String(row[field]),
              `Location '${first.locationPath}': ${display} varies ` +
                `('${firstVal}' on row ${firstIdx + 1} vs '${row[field]}' on row ${rowIdx + 1})`,
            ),
          );
          break;
        }
      }
    }
  }
}

// ── Global: single dispensary license ────────────────────────────────────────

function _validateGlobalDispensaryLicense(
  active: InventoryDerivedRow[],
  _allRows: InventoryDerivedRow[],
  errors: RowValidationError[],
): void {
  const licenses = new Set(active.map((r) => r.dispensaryLicense).filter(Boolean));
  if (licenses.size > 1) {
    errors.push(
      err(
        -1,
        "dispensaryLicense",
        "",
        `Dispensary License varies across CSV: ${JSON.stringify([...licenses].sort())}`,
      ),
    );
  }
}

// ── TraceTreezId unique per invoice ──────────────────────────────────────────

function _validateTraceTreezIdCrossInvoice(
  active: InventoryDerivedRow[],
  allRows: InventoryDerivedRow[],
  errors: RowValidationError[],
): void {
  const ttidInvoices = new Map<string, Set<string>>();
  const ttidFirstRow = new Map<string, InventoryDerivedRow>();

  for (const row of active) {
    if (!row.traceTreezId) continue;
    if (!ttidInvoices.has(row.traceTreezId)) {
      ttidInvoices.set(row.traceTreezId, new Set());
      ttidFirstRow.set(row.traceTreezId, row);
    }
    ttidInvoices.get(row.traceTreezId)!.add(row.invoiceId);
  }

  for (const [ttid, invIds] of ttidInvoices) {
    if (invIds.size > 1) {
      const firstRow = ttidFirstRow.get(ttid)!;
      errors.push(
        err(
          originalIndex(allRows, firstRow),
          "traceTreezId",
          ttid,
          `TraceTreezId '${ttid}' appears in multiple invoices: ${JSON.stringify([...invIds].sort())}. ` +
            `Each TraceTreezId can only belong to one invoice (duplicate PKG_LABEL barcode).`,
        ),
      );
    }
  }
}

// ── Portal issue mapping ─────────────────────────────────────────────────────

/** Reverse mapping from CSV column header to camelCase field key. */
const COLUMN_TO_FIELD: Record<string, string> = {
  TreezVariantId: "treezVariantId",
  VariantReferenceId: "variantReferenceId",
  "Dispensary License": "dispensaryLicense",
  "Invoice ID": "invoiceId",
  "Invoice Created Date": "invoiceCreatedDate",
  "Manifest Number": "manifestNumber",
  TraceTreezId: "traceTreezId",
  "Inventory Barcode(s)": "inventoryBarcodes",
  "Original Unit Count": "originalUnitCount",
  Units: "units",
  "Unit Cost": "unitCost",
  "Harvest Date": "harvestDate",
  "Expiration Date": "expirationDate",
  "Packaged Date": "packagedDate",
  "Customer Type": "customerType",
  "THC Amount": "thcAmount",
  "THC UoM": "thcUom",
  "CBD Amount": "cbdAmount",
  "CBD UoM": "cbdUom",
  "Location Path": "locationPath",
  "Location Inventory Type": "locationInventoryType",
  "Location Is Sellable": "locationIsSellable",
  "Location Default Receiving Location": "locationDefaultReceivingLocation",
  "Distributor Name": "distributorName",
  "Distributor DBA": "distributorDBA",
  "Distributor Phone Number": "distributorPhoneNumber",
  "Distributor Address": "distributorAddress",
  "Distributor Email": "distributorEmail",
  "Distributor Type": "distributorType",
  "Distributor Default Payment Term": "distributorDefaultPaymentTerm",
  "Distributor Lead Time": "distributorLeadTime",
  "Distributor Delivery Days": "distributorDeliveryDays",
  "Distributor Preferred Payment Method": "distributorPreferredPaymentMethod",
};

interface PortalIssue {
  row_number: number | null;
  field_name: string | null;
  field_value: string | null;
  message: string;
  severity?: string;
}

/**
 * Map portal validation issues to the local RowValidationError format.
 * Portal row_number is 1-based with header (row 2 = first data row = index 0).
 */
export function mapPortalIssuesToErrors(issues: PortalIssue[]): RowValidationError[] {
  return issues.map((issue) => {
    const rowIndex = issue.row_number != null ? issue.row_number - 2 : -1;
    const field = issue.field_name
      ? (COLUMN_TO_FIELD[issue.field_name] ?? issue.field_name)
      : "unknown";
    const severity = issue.severity?.toUpperCase() === "WARNING" ? "warning" : "error";

    return {
      rowIndex,
      field,
      currentValue: issue.field_value ?? "",
      message: `[Portal] ${issue.message}`,
      fixType: "text" as const,
      severity,
    };
  });
}

// ── Error grouping ───────────────────────────────────────────────────────────

/**
 * Group validation errors by field+message for display.
 */
export function groupInventoryErrors(
  errors: RowValidationError[],
): {
  field: string;
  message: string;
  severity: "error" | "warning";
  rows: { rowIndex: number; currentValue: string }[];
}[] {
  const map = new Map<
    string,
    {
      field: string;
      message: string;
      severity: "error" | "warning";
      rows: { rowIndex: number; currentValue: string }[];
    }
  >();

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
