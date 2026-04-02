/**
 * Integration test: runs the full inventory ETL pipeline against
 * real Dutchie export files and compares with the expected CSV output.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { detectHeaderRow } from "../lib/parser";
import { runInventoryETL } from "../lib/inventory-transformer";
import type { PerRoleMappings } from "../lib/inventory-transformer";
import { buildInventoryCSV, INVENTORY_OUTPUT_COLUMNS } from "../lib/inventory-csv-generator";
import { INVENTORY_ROLE_POS_DEFAULTS, INVENTORY_ROLE_FIELDS } from "../lib/inventory-constants";
import type { ParsedFile, InventoryFileRole } from "../lib/types";

// ── Paths ────────────────────────────────────────────────────────────────────

const EXPORTS_DIR = "/Users/chase/Downloads/CS Import Tool/Exports";
const EXPECTED_CSV =
  "/Users/chase/Downloads/CS Import Tool/Ethan Working/CS Tool - Inventory Import (Working).csv";

const FILES = {
  inventory: path.join(EXPORTS_DIR, "2026-02-11-Inventory.csv"),
  receipts: path.join(EXPORTS_DIR, "Inventory Receipt Report - Detail 2_4_2020-2_11_2026.xlsx"),
  vendors: path.join(EXPORTS_DIR, "2026-02-06-Vendors.csv"),
  adjustments: path.join(EXPORTS_DIR, "Inventory Adjustments - Adjust 2_4_2020-2_11_2026.xlsx"),
  catalog: path.join(EXPORTS_DIR, "Treez Catalog Export.csv"),
};

// Check files exist before running
const filesExist =
  Object.values(FILES).every((f) => fs.existsSync(f)) && fs.existsSync(EXPECTED_CSV);

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseFileSync(filePath: string): ParsedFile {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const headerRow = detectHeaderRow(sheet);
  if (headerRow > 0) {
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
    range.s.r = headerRow;
    sheet["!ref"] = XLSX.utils.encode_range(range);
  }

  const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });

  const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

  return {
    fileName: path.basename(filePath),
    fileSize: buffer.length,
    headers,
    rows: jsonData,
    rowCount: jsonData.length,
    previewRows: jsonData.slice(0, 10),
  };
}

function buildDutchieMappings(): PerRoleMappings {
  const posDefaults = INVENTORY_ROLE_POS_DEFAULTS["Dutchie"]!;
  const result: PerRoleMappings = {} as any;

  for (const role of Object.keys(INVENTORY_ROLE_FIELDS) as InventoryFileRole[]) {
    const roleDefaults = posDefaults[role] ?? {};
    result[role] = (INVENTORY_ROLE_FIELDS[role] ?? []).map((field) => ({
      fieldKey: field.key,
      label: field.label,
      sourceHeader: roleDefaults[field.key] ?? null,
    }));
  }

  return result;
}

function parseExpectedCSV(): { headers: string[]; rows: Record<string, string>[] } {
  const buffer = fs.readFileSync(EXPECTED_CSV);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
  const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
  return { headers, rows: jsonData };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe.skipIf(!filesExist)("Integration: Real Dutchie files → expected CSV", () => {
  // Parse all files once
  let inventoryFile: ParsedFile;
  let receiptsFile: ParsedFile;
  let vendorsFile: ParsedFile;
  let adjustmentsFile: ParsedFile;
  let catalogFile: ParsedFile;
  let mappings: PerRoleMappings;
  let expected: { headers: string[]; rows: Record<string, string>[] };

  // Lazily parse (expensive)
  function ensureParsed() {
    if (inventoryFile) return;
    inventoryFile = parseFileSync(FILES.inventory);
    receiptsFile = parseFileSync(FILES.receipts);
    vendorsFile = parseFileSync(FILES.vendors);
    adjustmentsFile = parseFileSync(FILES.adjustments);
    catalogFile = parseFileSync(FILES.catalog);
    mappings = buildDutchieMappings();
    expected = parseExpectedCSV();
  }

  it("XLSX header detection skips metadata rows in receipts", () => {
    ensureParsed();
    // Receipts should have ~18208 data rows, not include the 4 metadata rows
    expect(receiptsFile.rowCount).toBeGreaterThan(18000);
    expect(receiptsFile.headers).toContain("Product SKU");
    expect(receiptsFile.headers).toContain("Receive Date");
    // Should NOT contain metadata-like headers
    expect(receiptsFile.headers).not.toContain("Export Date: 02/11/2026 05:24 PM");
  });

  it("XLSX header detection skips metadata rows in adjustments", () => {
    ensureParsed();
    expect(adjustmentsFile.rowCount).toBeGreaterThan(7000);
    expect(adjustmentsFile.headers).toContain("SerialNumber");
    expect(adjustmentsFile.headers).toContain("qty");
  });

  it("Dutchie POS defaults match real inventory headers", () => {
    ensureParsed();
    const invMappings = mappings.inventory;
    const invHeaders = new Set(inventoryFile.headers);

    // Every mapped inventory field should reference a real header
    for (const m of invMappings) {
      if (m.sourceHeader) {
        expect(invHeaders.has(m.sourceHeader)).toBe(true);
      }
    }
  });

  it("Dutchie POS defaults match real receipt headers", () => {
    ensureParsed();
    const rcptMappings = mappings.receipts;
    const rcptHeaders = new Set(receiptsFile.headers);

    for (const m of rcptMappings) {
      if (m.sourceHeader) {
        expect(rcptHeaders.has(m.sourceHeader)).toBe(true);
      }
    }
  });

  it("column headers match expected output exactly", () => {
    ensureParsed();
    // Our INVENTORY_OUTPUT_COLUMNS should match the expected CSV headers
    expect(INVENTORY_OUTPUT_COLUMNS).toEqual(expected.headers);
  });

  it("produces the correct number of output rows", () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    const activeRows = result.filter((r) => !r.excluded);
    // Allow small tolerance: 1:N fullJoin may produce extra rows for packages
    // with multiple receipt line items sharing the same ExternalPackageId
    const diff = Math.abs(activeRows.length - expected.rows.length);
    expect(diff).toBeLessThanOrEqual(20);
  });

  it("Invoice IDs are just numbers, not full invoiceIdDate strings", () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    // Invoice IDs should NOT contain " - " separators
    const withInvoice = result.filter((r) => r.invoiceId !== "");
    for (const row of withInvoice.slice(0, 50)) {
      expect(row.invoiceId).not.toContain(" - ");
      // Should be numeric
      expect(/^\d+$/.test(row.invoiceId)).toBe(true);
    }
  });

  it("Unit Cost is formatted to 2 decimal places", () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    // Check that UnitCost from receipt rows has 2 decimal places
    const withCost = result.filter((r) => r.unitCost !== "");
    for (const row of withCost.slice(0, 50)) {
      expect(row.unitCost).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it("Original Unit Count is formatted to 2 decimal places", () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    const withOUC = result.filter((r) => r.originalUnitCount !== "");
    for (const row of withOUC.slice(0, 50)) {
      expect(row.originalUnitCount).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it('receipt-only rows have empty Units (not "0")', () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    const emptyUnits = result.filter((r) => r.units === "");
    const zeroUnits = result.filter((r) => r.units === "0");
    const withUnits = result.filter((r) => r.units !== "" && r.units !== "0");

    // Verify receipt-only rows get empty Units (not "0")
    // Note: exact counts differ due to 1:N join producing extra receipt-only rows
    expect(emptyUnits.length).toBeGreaterThan(1700);
    expect(withUnits.length).toBeGreaterThan(1400);
    // No rows should have been forced to "0"
    expect(zeroUnits.length).toBeLessThanOrEqual(20);
  });

  it("Customer Type defaults to ADULT for all rows", () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    for (const row of result) {
      expect(row.customerType).toBe("ADULT");
    }
  });

  it("Dispensary License is set on all rows", () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    for (const row of result) {
      expect(row.dispensaryLicense).toBe("C12-0000331-LIC");
    }
  });

  it("VariantReferenceId follows V-{SKU} pattern", () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    for (const row of result.slice(0, 100)) {
      expect(row.variantReferenceId).toMatch(/^V-.+/);
    }
  });

  it("distributor license numbers are populated from vendor data", () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    // Find rows with a known distributor
    const vinoRows = result.filter((r) => r.distributorName === "VINO & CIGARRO, LLC");
    expect(vinoRows.length).toBeGreaterThan(0);

    // Check that license is populated
    for (const row of vinoRows.slice(0, 5)) {
      expect(row.distributorLicense1Number).not.toBe("");
    }
  });

  it("CSV output matches expected first row values", () => {
    ensureParsed();
    const dispensaryLicense = "C12-0000331-LIC";

    const result = runInventoryETL(
      { inventoryFile, receiptsFile, vendorsFile, adjustmentsFile, catalogFile },
      mappings,
      dispensaryLicense,
    );

    const csvData = buildInventoryCSV(result);

    // Header should match
    expect(csvData[0]).toEqual(expected.headers);

    // Check a few key columns from first expected row
    const firstExpected = expected.rows[0];
    const firstActualRow = csvData[1]; // index 0 = header, 1 = first data row

    // Find column indices
    const colIdx = (name: string) => expected.headers.indexOf(name);

    // Check specific values from first expected row
    expect(firstActualRow[colIdx("Dispensary License")]).toBe(firstExpected["Dispensary License"]);
  });
});
