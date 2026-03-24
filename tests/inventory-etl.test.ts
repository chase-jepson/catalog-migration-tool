/**
 * Comprehensive test suite for the Inventory ETL pipeline.
 *
 * Covers:
 *  1. ETL helpers  (groupBy, sumByGroup, leftJoin, fullJoin, formatDateToISO,
 *                   splitPotency, extractInvoiceId, derive* functions)
 *  2. Inventory transformer  (processInventory, processVendors, processReceipts,
 *                             runInventoryETL end-to-end)
 *  3. Validator    (validateInventoryRows, groupInventoryErrors)
 *  4. CSV Generator (buildInventoryCSV column count, exclusion, field mapping)
 */
import { describe, it, expect } from "vitest";

// ── ETL helpers ──────────────────────────────────────────────────────────────
import {
  groupBy,
  sumByGroup,
  leftJoin,
  fullJoin,
  formatDateToISO,
  splitPotency,
  extractInvoiceId,
  deriveCustomerType,
  deriveLocationPath,
  deriveLocationIsSellable,
  deriveLocationDefaultReceiving,
  deriveLocationInventoryType,
} from "../lib/inventory-etl-helpers";

// ── Transformer ──────────────────────────────────────────────────────────────
import type { ETLInput, PerRoleMappings } from "../lib/inventory-transformer";
import {
  processInventory,
  processVendors,
  processReceipts,
  runInventoryETL,
} from "../lib/inventory-transformer";

// ── Validator ────────────────────────────────────────────────────────────────
import { validateInventoryRows, groupInventoryErrors } from "../lib/inventory-validator";

// ── CSV Generator ────────────────────────────────────────────────────────────
import { buildInventoryCSV, INVENTORY_OUTPUT_COLUMNS } from "../lib/inventory-csv-generator";

// ── Types ────────────────────────────────────────────────────────────────────
import type { ParsedFile, FieldMapping, InventoryDerivedRow } from "../lib/types";

// ═══════════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeParsedFile(rows: Record<string, string>[], headers?: string[]): ParsedFile {
  const h = headers ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
  return {
    fileName: "test.csv",
    fileSize: 100,
    headers: h,
    rows,
    rowCount: rows.length,
    previewRows: rows.slice(0, 10),
  };
}

function makeMapping(fieldKey: string, sourceHeader: string | null): FieldMapping {
  return { fieldKey, label: fieldKey, sourceHeader };
}

function makeInventoryMappings(): FieldMapping[] {
  return [
    makeMapping("inv_sku", "SKU"),
    makeMapping("inv_product", "Product"),
    makeMapping("inv_externalPackageId", "External package ID"),
    makeMapping("inv_room", "Room"),
    makeMapping("inv_quantityIncAllocated", "Quantity (including allocated)"),
    makeMapping("inv_cost", "Cost"),
    makeMapping("inv_thc", "THC"),
    makeMapping("inv_cbd", "CBD"),
    makeMapping("inv_availableFor", "Available for"),
    makeMapping("inv_expirationDate", "Expiration date"),
    makeMapping("inv_packagingDate", "Packaging date"),
    makeMapping("inv_harvestDate", "Harvest date"),
    makeMapping("inv_category", "Category"),
  ];
}

function makeReceiptMappings(): FieldMapping[] {
  return [
    makeMapping("rcpt_productSKU", "Product SKU"),
    makeMapping("rcpt_externalPackageId", "External Package ID"),
    makeMapping("rcpt_receiveDate", "Receive Date"),
    makeMapping("rcpt_quantity", "Quantity"),
    makeMapping("rcpt_totalCost", "Total Cost"),
    makeMapping("rcpt_unitCost", "Unit Cost"),
    makeMapping("rcpt_vendorName", "Vendor Name"),
    makeMapping("rcpt_orderTitle", "Order Title"),
  ];
}

function makeAdjustmentMappings(): FieldMapping[] {
  return [
    makeMapping("adj_externalPackageId", "SerialNumber"),
    makeMapping("adj_quantity", "qty"),
    makeMapping("adj_cost", "Cost"),
  ];
}

function makeVendorMappings(): FieldMapping[] {
  return [
    makeMapping("vnd_vendorName", "Vendor name"),
    makeMapping("vnd_vendorCode", "Vendor code"),
    makeMapping("vnd_abbreviation", "Abbreviation"),
    makeMapping("vnd_address", "Address"),
    makeMapping("vnd_city", "City"),
    makeMapping("vnd_state", "State"),
    makeMapping("vnd_postalCode", "Postal code"),
    makeMapping("vnd_contactPhone", "Contact phone"),
    makeMapping("vnd_contactEmail", "Contact email"),
  ];
}

function makeCatalogMappings(): FieldMapping[] {
  return [
    makeMapping("cat_productKey", "Product Key"),
    makeMapping("cat_productCategory", "Product Category"),
  ];
}

function makeFullMappings(): PerRoleMappings {
  return {
    inventory: makeInventoryMappings(),
    receipts: makeReceiptMappings(),
    vendors: makeVendorMappings(),
    adjustments: makeAdjustmentMappings(),
    catalog_export: makeCatalogMappings(),
  };
}

/** Dutchie-style inventory row */
function dutchieInvRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    SKU: "SKU-100",
    Product: "Blue Dream 3.5g",
    "External package ID": "PKG-ABC",
    Room: "Sales Floor",
    Available: "8",
    "Quantity (including allocated)": "10",
    Cost: "5.50",
    THC: "23.5 %",
    CBD: "0.00 mg",
    "Available for": "All enabled customer types",
    "Expiration date": "12/31/2026",
    "Packaging date": "1/15/2025",
    "Harvest date": "1/1/2025",
    Category: "Flower",
    ...overrides,
  };
}

/** Dutchie-style receipt row */
function dutchieRcptRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "Product SKU": "SKU-100",
    "External Package ID": "PKG-ABC",
    "Receive Date": "02/11/2026",
    Quantity: "20",
    "Total Cost": "200",
    "Vendor Name": "Vendor A",
    "Order Title": "PO-99 - INV-5001",
    "Unit Cost": "10",
    ...overrides,
  };
}

function makeDerivedRow(overrides: Partial<InventoryDerivedRow> = {}): InventoryDerivedRow {
  return {
    treezVariantId: "",
    variantReferenceId: "V-SKU-001",
    dispensaryLicense: "LIC-001",
    invoiceId: "INV-1 - 2026-02-11 - Vendor A",
    invoiceCreatedDate: "2026-02-11",
    manifestNumber: "",
    traceTreezId: "1A406030000296B000099999",
    inventoryBarcodes: "1A406030000296B000099999",
    originalUnitCount: "20",
    units: "10",
    unitCost: "5.00",
    harvestDate: "2025-01-01",
    expirationDate: "2026-12-31",
    packagedDate: "2025-01-15",
    customerType: "ADULT",
    thcAmount: "23.5",
    thcUom: "%",
    cbdAmount: "1.2",
    cbdUom: "mg",
    locationPath: "Front of House, Sales Floor",
    locationInventoryType: "All Types",
    locationIsSellable: "TRUE",
    locationDefaultReceivingLocation: "FALSE",
    distributorName: "Vendor A",
    distributorDBA: "",
    distributorAddress: "",
    distributorPhoneNumber: "",
    distributorEmail: "",
    distributorType: "Non-Arms Length",
    distributorDefaultPaymentTerm: "",
    distributorLeadTime: "",
    distributorDeliveryDays: "",
    distributorPreferredPaymentMethod: "",
    distributorLicense1Type: "",
    distributorLicense1Number: "",
    distributorLicense1ExpirationDate: "",
    distributorLicense2Type: "",
    distributorLicense2Number: "",
    distributorLicense2ExpirationDate: "",
    distributorLicense3Type: "",
    distributorLicense3Number: "",
    distributorLicense3ExpirationDate: "",
    distributorRep1Name: "",
    distributorRep1Phone: "",
    distributorRep1Email: "",
    distributorRep1Role: "",
    distributorRep1Notes: "",
    distributorRep2Name: "",
    distributorRep2Phone: "",
    distributorRep2Email: "",
    distributorRep2Role: "",
    distributorRep2Notes: "",
    distributorRep3Name: "",
    distributorRep3Phone: "",
    distributorRep3Email: "",
    distributorRep3Role: "",
    distributorRep3Notes: "",
    productSKU: "SKU-001",
    externalPackageId: "PKG-1",
    productCategory: "Flower",
    excluded: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ETL Helpers
// ═══════════════════════════════════════════════════════════════════════════════

describe("ETL Helpers", () => {
  // ── groupBy ──────────────────────────────────────────────────────────────
  describe("groupBy", () => {
    it("groups objects by key function", () => {
      const data = [
        { dept: "eng", name: "Alice" },
        { dept: "sales", name: "Bob" },
        { dept: "eng", name: "Carol" },
      ];
      const result = groupBy(data, (r) => r.dept);
      expect(result.get("eng")).toHaveLength(2);
      expect(result.get("sales")).toHaveLength(1);
      expect(result.has("hr")).toBe(false);
    });

    it("returns empty map for empty array", () => {
      expect(groupBy([], () => "x").size).toBe(0);
    });

    it("each unique key produces its own group", () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = groupBy(data, (r) => String(r.id));
      expect(result.size).toBe(3);
    });

    it("preserves insertion order within each group", () => {
      const data = [
        { g: "A", v: 1 },
        { g: "A", v: 2 },
        { g: "A", v: 3 },
      ];
      const result = groupBy(data, (r) => r.g);
      expect(result.get("A")!.map((r) => r.v)).toEqual([1, 2, 3]);
    });
  });

  // ── sumByGroup ───────────────────────────────────────────────────────────
  describe("sumByGroup", () => {
    it("sums numeric fields per group", () => {
      const data = [
        { pkg: "A", Quantity: "10", TotalCost: "100" },
        { pkg: "A", Quantity: "5", TotalCost: "50" },
        { pkg: "B", Quantity: "3", TotalCost: "30" },
      ];
      const result = sumByGroup(data, (r) => r.pkg, ["Quantity", "TotalCost"]);
      const a = result.find((r) => r._groupKey === "A")!;
      expect(a.Quantity).toBe(15);
      expect(a.TotalCost).toBe(150);
      expect(result.find((r) => r._groupKey === "B")!.Quantity).toBe(3);
    });

    it("treats non-numeric values as 0", () => {
      const data = [
        { pkg: "A", Quantity: "abc", TotalCost: "50" },
        { pkg: "A", Quantity: "10", TotalCost: "N/A" },
      ];
      const result = sumByGroup(data, (r) => r.pkg, ["Quantity", "TotalCost"]);
      expect(result[0].Quantity).toBe(10);
      expect(result[0].TotalCost).toBe(50);
    });

    it("treats empty strings as 0", () => {
      const data = [{ pkg: "X", Quantity: "", TotalCost: "" }];
      const result = sumByGroup(data, (r) => r.pkg, ["Quantity", "TotalCost"]);
      expect(result[0].Quantity).toBe(0);
      expect(result[0].TotalCost).toBe(0);
    });

    it("returns empty array for empty input", () => {
      expect(sumByGroup([], () => "k", ["v"])).toHaveLength(0);
    });

    it("handles negative numbers correctly", () => {
      const data = [
        { pkg: "A", Quantity: "10" },
        { pkg: "A", Quantity: "-3" },
      ];
      const result = sumByGroup(data, (r) => r.pkg, ["Quantity"]);
      expect(result[0].Quantity).toBe(7);
    });
  });

  // ── leftJoin ─────────────────────────────────────────────────────────────
  describe("leftJoin", () => {
    it("merges matching rows", () => {
      const left = [{ id: "1", name: "Alice" }];
      const right = [{ id: "1", dept: "eng" }];
      const result = leftJoin(
        left,
        right,
        (r) => r.id,
        (r) => r.id,
      );
      expect(result[0]).toEqual({ id: "1", name: "Alice", dept: "eng" });
    });

    it("fills unmatched left rows with empty right fields", () => {
      const left = [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
      ];
      const right = [{ id: "1", dept: "eng" }];
      const result = leftJoin(
        left,
        right,
        (r) => r.id,
        (r) => r.id,
      );
      expect(result).toHaveLength(2);
      expect(result[1].dept).toBe("");
    });

    it("never includes right-only rows", () => {
      const left = [{ id: "1", name: "Alice" }];
      const right = [{ id: "99", dept: "sales" }];
      const result = leftJoin(
        left,
        right,
        (r) => r.id,
        (r) => r.id,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("first match wins when right has duplicate keys", () => {
      const left = [{ id: "1", name: "Alice" }];
      const right = [
        { id: "1", dept: "eng" },
        { id: "1", dept: "sales" },
      ];
      const result = leftJoin(
        left,
        right,
        (r) => r.id,
        (r) => r.id,
      );
      expect(result).toHaveLength(1);
      expect(result[0].dept).toBe("eng");
    });

    it("works with empty right side", () => {
      const left = [{ id: "1", val: "x" }];
      const result = leftJoin(
        left,
        [],
        (r) => r.id,
        (r: any) => r.id,
      );
      expect(result).toHaveLength(1);
      expect(result[0].val).toBe("x");
    });
  });

  // ── fullJoin ─────────────────────────────────────────────────────────────
  describe("fullJoin", () => {
    it("1:1 matching merges both sides", () => {
      const left = [{ id: "A", lv: "1" }];
      const right = [{ id: "A", rv: "2" }];
      const result = fullJoin(
        left,
        right,
        (r) => r.id,
        (r) => r.id,
      );
      expect(result).toHaveLength(1);
      expect(result[0].lv).toBe("1");
      expect(result[0].rv).toBe("2");
    });

    it("1:N matching produces N rows (package with multiple invoices)", () => {
      const left = [{ ExternalPackageId: "PKG-1", Units: "10" }];
      const right = [
        { ExternalPackageId: "PKG-1", InvoiceId: "INV-A" },
        { ExternalPackageId: "PKG-1", InvoiceId: "INV-B" },
      ];
      const result = fullJoin(
        left,
        right,
        (r) => r.ExternalPackageId,
        (r) => r.ExternalPackageId,
      );
      expect(result).toHaveLength(2);
      expect(result[0].Units).toBe("10");
      expect(result[0].InvoiceId).toBe("INV-A");
      expect(result[1].Units).toBe("10");
      expect(result[1].InvoiceId).toBe("INV-B");
    });

    it("includes right-only rows with empty left fields", () => {
      const left = [{ id: "1", name: "Alice" }];
      const right = [{ id: "3", dept: "sales" }];
      const result = fullJoin(
        left,
        right,
        (r) => r.id,
        (r) => r.id,
      );
      expect(result).toHaveLength(2);
      const rightOnly = result.find((r) => r.id === "3")!;
      expect(rightOnly.dept).toBe("sales");
      expect(rightOnly.name).toBe("");
    });

    it("includes left-only rows with empty right fields", () => {
      const left = [{ id: "1", name: "Alice" }];
      const right = [{ id: "2", dept: "eng" }];
      const result = fullJoin(
        left,
        right,
        (r) => r.id,
        (r) => r.id,
      );
      const leftOnly = result.find((r) => r.id === "1")!;
      expect(leftOnly.name).toBe("Alice");
      expect(leftOnly.dept).toBe("");
    });

    it("handles both sides empty", () => {
      expect(
        fullJoin(
          [],
          [],
          (r: any) => r.id,
          (r: any) => r.id,
        ),
      ).toHaveLength(0);
    });

    it("right-only rows are de-duplicated by key", () => {
      const left: Record<string, string>[] = [];
      const right = [
        { id: "X", val: "1" },
        { id: "X", val: "2" },
      ];
      const result = fullJoin(
        left,
        right,
        (r: any) => r.id,
        (r) => r.id,
      );
      // Only one right-only entry per key
      expect(result).toHaveLength(1);
    });
  });

  // ── formatDateToISO ──────────────────────────────────────────────────────
  describe("formatDateToISO", () => {
    it("converts MM/dd/yyyy to yyyy-MM-dd", () => {
      expect(formatDateToISO("02/11/2026")).toBe("2026-02-11");
    });

    it("converts M/d/yyyy (single digit) to zero-padded ISO", () => {
      expect(formatDateToISO("1/5/2023")).toBe("2023-01-05");
    });

    it("returns already-ISO strings as-is", () => {
      expect(formatDateToISO("2025-06-15")).toBe("2025-06-15");
    });

    it("returns empty string for empty input", () => {
      expect(formatDateToISO("")).toBe("");
    });

    it("returns empty string for whitespace-only input", () => {
      expect(formatDateToISO("   ")).toBe("");
    });

    it("returns empty for null/undefined (edge case)", () => {
      expect(formatDateToISO(null as any)).toBe("");
      expect(formatDateToISO(undefined as any)).toBe("");
    });

    it("trims leading/trailing whitespace before parsing", () => {
      expect(formatDateToISO(" 3/14/2024 ")).toBe("2024-03-14");
    });
  });

  // ── splitPotency ─────────────────────────────────────────────────────────
  describe("splitPotency", () => {
    it('splits "23.5 %" into amount and uom', () => {
      expect(splitPotency("23.5 %")).toEqual({ amount: "23.5", uom: "%" });
    });

    it('splits "0.00 mg" into empty (zero-clean)', () => {
      expect(splitPotency("0.00 mg")).toEqual({ amount: "", uom: "" });
    });

    it("handles single value with no unit", () => {
      expect(splitPotency("18.7")).toEqual({ amount: "18.7", uom: "" });
    });

    it("returns empty for null", () => {
      expect(splitPotency(null)).toEqual({ amount: "", uom: "" });
    });

    it("returns empty for undefined", () => {
      expect(splitPotency(undefined)).toEqual({ amount: "", uom: "" });
    });

    it("returns empty for empty string", () => {
      expect(splitPotency("")).toEqual({ amount: "", uom: "" });
    });

    it("blanks values with mg/g unit", () => {
      expect(splitPotency("23.5 mg/g")).toEqual({ amount: "", uom: "" });
      expect(splitPotency("218.85 mg/g")).toEqual({ amount: "", uom: "" });
      expect(splitPotency("0.79 MG/G")).toEqual({ amount: "", uom: "" });
    });

    it('cleans "0" to empty', () => {
      expect(splitPotency("0")).toEqual({ amount: "", uom: "" });
    });
  });

  // ── extractInvoiceId ─────────────────────────────────────────────────────
  describe("extractInvoiceId", () => {
    it('extracts text after last " - " separator', () => {
      expect(extractInvoiceId("PO-123 - INV456")).toBe("INV456");
    });

    it('returns full string when no " - " separator', () => {
      expect(extractInvoiceId("SimpleTitle")).toBe("SimpleTitle");
    });

    it("uses last separator when multiple present", () => {
      expect(extractInvoiceId("PO-1 - Sub - INV789")).toBe("INV789");
    });

    it("returns empty for empty string", () => {
      expect(extractInvoiceId("")).toBe("");
    });

    it("returns empty for null-ish input", () => {
      expect(extractInvoiceId(null as any)).toBe("");
      expect(extractInvoiceId(undefined as any)).toBe("");
    });
  });

  // ── deriveCustomerType ───────────────────────────────────────────────────
  describe("deriveCustomerType", () => {
    it('"All enabled customer types" => ADULT', () => {
      expect(deriveCustomerType("All enabled customer types")).toBe("ADULT");
    });

    it('"Adult" => ADULT', () => {
      expect(deriveCustomerType("Adult")).toBe("ADULT");
    });

    it("empty string => ADULT", () => {
      expect(deriveCustomerType("")).toBe("ADULT");
    });

    it('"Medical" => MEDICAL', () => {
      expect(deriveCustomerType("Medical")).toBe("MEDICAL");
    });

    it('"Medical Only" => MEDICAL', () => {
      expect(deriveCustomerType("Medical Only")).toBe("MEDICAL");
    });
  });

  // ── deriveLocationPath ───────────────────────────────────────────────────
  describe("deriveLocationPath", () => {
    it("maps known rooms correctly", () => {
      expect(deriveLocationPath("Sales Floor")).toBe("Front of House, Sales Floor");
      expect(deriveLocationPath("Back Stock")).toBe("Back of House, Back Stock");
      expect(deriveLocationPath("Budtender Vault")).toBe("Back of House, Budtender Vault");
      expect(deriveLocationPath("Promo")).toBe("Back of House, Promo");
      expect(deriveLocationPath("Display")).toBe("Back of House, Display");
      expect(deriveLocationPath("Waste")).toBe("Quarantine");
    });

    it("returns empty for unknown room", () => {
      expect(deriveLocationPath("Basement")).toBe("");
    });

    it("returns empty for empty room", () => {
      expect(deriveLocationPath("")).toBe("");
    });
  });

  // ── deriveLocationIsSellable ─────────────────────────────────────────────
  describe("deriveLocationIsSellable", () => {
    it('TRUE when path contains "Front of House"', () => {
      expect(deriveLocationIsSellable("Front of House, Sales Floor")).toBe("TRUE");
    });

    it("FALSE for back-of-house paths", () => {
      expect(deriveLocationIsSellable("Back of House, Back Stock")).toBe("FALSE");
    });

    it("FALSE for empty path", () => {
      expect(deriveLocationIsSellable("")).toBe("FALSE");
    });
  });

  // ── deriveLocationDefaultReceiving ───────────────────────────────────────
  describe("deriveLocationDefaultReceiving", () => {
    it('TRUE only for "Back of House, Back Stock"', () => {
      expect(deriveLocationDefaultReceiving("Back of House, Back Stock")).toBe("TRUE");
    });

    it("FALSE for all other paths", () => {
      expect(deriveLocationDefaultReceiving("Front of House, Sales Floor")).toBe("FALSE");
      expect(deriveLocationDefaultReceiving("Back of House, Budtender Vault")).toBe("FALSE");
      expect(deriveLocationDefaultReceiving("Quarantine")).toBe("FALSE");
      expect(deriveLocationDefaultReceiving("")).toBe("FALSE");
    });
  });

  // ── deriveLocationInventoryType ──────────────────────────────────────────
  describe("deriveLocationInventoryType", () => {
    it('"MEDICAL" => Medical', () => {
      expect(deriveLocationInventoryType("MEDICAL")).toBe("Medical");
    });

    it('"ADULT" => All Types', () => {
      expect(deriveLocationInventoryType("ADULT")).toBe("All Types");
    });

    it("empty => All Types", () => {
      expect(deriveLocationInventoryType("")).toBe("All Types");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Inventory Transformer
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inventory Transformer", () => {
  // ── processInventory ─────────────────────────────────────────────────────
  describe("processInventory", () => {
    it("maps basic Dutchie row to InventoryProcessedRow", () => {
      const rows = [dutchieInvRow()];
      const result = processInventory(rows, makeInventoryMappings());

      expect(result).toHaveLength(1);
      const r = result[0];
      expect(r.ProductSKU).toBe("SKU-100");
      expect(r.ProductName).toBe("Blue Dream 3.5g");
      expect(r.ExternalPackageId).toBe("PKG-ABC");
      expect(r.Units).toBe("10");
      expect(r.Cost).toBe("5.50");
      expect(r.Category).toBe("Flower");
    });

    it("splits THC and cleans zero CBD", () => {
      const rows = [dutchieInvRow({ THC: "23.5 %", CBD: "0.00 mg" })];
      const result = processInventory(rows, makeInventoryMappings());

      expect(result[0].thcAmount).toBe("23.5");
      expect(result[0].thcUom).toBe("%");
      expect(result[0].cbdAmount).toBe("");
      expect(result[0].cbdUom).toBe("");
    });

    it('derives customerType ADULT from "All enabled customer types"', () => {
      const rows = [dutchieInvRow({ "Available for": "All enabled customer types" })];
      const result = processInventory(rows, makeInventoryMappings());
      expect(result[0].customerType).toBe("ADULT");
    });

    it("derives customerType MEDICAL", () => {
      const rows = [dutchieInvRow({ "Available for": "Medical" })];
      const result = processInventory(rows, makeInventoryMappings());
      expect(result[0].customerType).toBe("MEDICAL");
      expect(result[0].locationInventoryType).toBe("Medical");
    });

    it("derives location path and sellable/receiving flags", () => {
      const sfRow = dutchieInvRow({ Room: "Sales Floor" });
      const bsRow = dutchieInvRow({
        Room: "Back Stock",
        SKU: "SKU-200",
        "External package ID": "PKG-2",
      });
      const result = processInventory([sfRow, bsRow], makeInventoryMappings());

      expect(result[0].locationPath).toBe("Front of House, Sales Floor");
      expect(result[0].locationIsSellable).toBe("TRUE");
      expect(result[0].locationDefaultReceivingLocation).toBe("FALSE");

      expect(result[1].locationPath).toBe("Back of House, Back Stock");
      expect(result[1].locationIsSellable).toBe("FALSE");
      expect(result[1].locationDefaultReceivingLocation).toBe("TRUE");
    });

    it("handles multiple rows", () => {
      const rows = [
        dutchieInvRow({ SKU: "A", "External package ID": "P1" }),
        dutchieInvRow({ SKU: "B", "External package ID": "P2" }),
        dutchieInvRow({ SKU: "C", "External package ID": "P3" }),
      ];
      const result = processInventory(rows, makeInventoryMappings());
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.ProductSKU)).toEqual(["A", "B", "C"]);
    });
  });

  // ── processVendors ───────────────────────────────────────────────────────
  describe("processVendors", () => {
    it("deduplicates vendors by name", () => {
      const vendorRows = [
        {
          "Vendor name": "V1",
          "Vendor code": "L1",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
        {
          "Vendor name": "V1",
          "Vendor code": "L2",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
        {
          "Vendor name": "V2",
          "Vendor code": "L3",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
      ];
      const result = processVendors(vendorRows, makeVendorMappings());

      expect(Object.keys(result)).toHaveLength(2);
      expect(result["v1"]).toBeDefined();
      expect(result["v2"]).toBeDefined();
    });

    it("merges vendor codes across rows and splits into licenses 1-3", () => {
      const vendorRows = [
        {
          "Vendor name": "V",
          "Vendor code": "LIC-A",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
        {
          "Vendor name": "V",
          "Vendor code": "LIC-B",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
        {
          "Vendor name": "V",
          "Vendor code": "LIC-C",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
      ];
      const result = processVendors(vendorRows, makeVendorMappings());

      expect(result["v"].distributorLicense1Number).toBe("LIC-A");
      expect(result["v"].distributorLicense2Number).toBe("LIC-B");
      expect(result["v"].distributorLicense3Number).toBe("LIC-C");
      expect(result["v"].distributorLicense1Type).toBe("Adult");
      expect(result["v"].distributorLicense2Type).toBe("Adult");
      expect(result["v"].distributorLicense3Type).toBe("Adult");
    });

    it("splits comma-separated codes in a single cell", () => {
      const vendorRows = [
        {
          "Vendor name": "V",
          "Vendor code": "LIC-X, LIC-Y",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
      ];
      const result = processVendors(vendorRows, makeVendorMappings());

      expect(result["v"].distributorLicense1Number).toBe("LIC-X");
      expect(result["v"].distributorLicense2Number).toBe("LIC-Y");
    });

    it("builds distributor address from parts", () => {
      const vendorRows = [
        {
          "Vendor name": "V",
          "Vendor code": "",
          Abbreviation: "VA",
          Address: "123 Main",
          City: "LA",
          State: "CA",
          "Postal code": "90001",
          "Contact phone": "555-1234",
          "Contact email": "v@test.com",
        },
      ];
      const result = processVendors(vendorRows, makeVendorMappings());

      expect(result["v"].distributorAddress).toBe("123 Main LA, CA 90001");
      expect(result["v"].distributorDBA).toBe("VA");
      expect(result["v"].distributorPhoneNumber).toBe("555-1234");
      expect(result["v"].distributorEmail).toBe("v@test.com");
    });

    it("sets distributor type to Non-Arms Length", () => {
      const vendorRows = [
        {
          "Vendor name": "V",
          "Vendor code": "",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
      ];
      const result = processVendors(vendorRows, makeVendorMappings());
      expect(result["v"].distributorType).toBe("Non-Arms Length");
    });

    it("skips vendors with empty name", () => {
      const vendorRows = [
        {
          "Vendor name": "",
          "Vendor code": "L1",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
      ];
      const result = processVendors(vendorRows, makeVendorMappings());
      expect(Object.keys(result)).toHaveLength(0);
    });

    it("license expiration date is today + 2 years", () => {
      const vendorRows = [
        {
          "Vendor name": "V",
          "Vendor code": "LIC-1",
          Abbreviation: "",
          Address: "",
          City: "",
          State: "",
          "Postal code": "",
          "Contact phone": "",
          "Contact email": "",
        },
      ];
      const result = processVendors(vendorRows, makeVendorMappings());

      const exp = result["v"].distributorLicense1ExpirationDate;
      expect(exp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Should be ~2 years from now
      const expYear = parseInt(exp.substring(0, 4), 10);
      const currentYear = new Date().getFullYear();
      expect(expYear).toBeGreaterThanOrEqual(currentYear + 1);
      expect(expYear).toBeLessThanOrEqual(currentYear + 3);
    });
  });

  // ── processReceipts ──────────────────────────────────────────────────────
  describe("processReceipts", () => {
    it("sums receipt quantities by group key", () => {
      const receiptRows = [
        dutchieRcptRow({ Quantity: "10", "Total Cost": "100" }),
        dutchieRcptRow({ Quantity: "5", "Total Cost": "50" }),
      ];
      const result = processReceipts(
        receiptRows,
        [],
        new Set(["PKG-ABC"]),
        makeReceiptMappings(),
        makeAdjustmentMappings(),
      );

      const row = result.find((r) => r.ExternalPackageId === "PKG-ABC");
      expect(row).toBeDefined();
      expect(Number(row!.Quantity)).toBe(15);
    });

    it("stacks adjustments with receipts", () => {
      const receiptRows = [dutchieRcptRow({ Quantity: "10", "Total Cost": "100" })];
      const adjRows = [{ SerialNumber: "PKG-ABC", qty: "-2", Cost: "-20" }];
      const result = processReceipts(
        receiptRows,
        adjRows,
        new Set(["PKG-ABC"]),
        makeReceiptMappings(),
        makeAdjustmentMappings(),
      );

      const row = result.find((r) => r.ExternalPackageId === "PKG-ABC")!;
      expect(Number(row.Quantity)).toBe(8);
      expect(Number(row.TotalCost)).toBe(80);
    });

    it("computes UnitCost as TotalCost / Quantity", () => {
      const receiptRows = [dutchieRcptRow({ Quantity: "20", "Total Cost": "200" })];
      const result = processReceipts(
        receiptRows,
        [],
        new Set(["PKG-ABC"]),
        makeReceiptMappings(),
        makeAdjustmentMappings(),
      );

      const row = result.find((r) => r.ExternalPackageId === "PKG-ABC")!;
      expect(Number(row.UnitCost)).toBe(10);
    });

    it("extracts InvoiceId from OrderTitle", () => {
      const receiptRows = [dutchieRcptRow({ "Order Title": "PO-99 - INV-5001" })];
      const result = processReceipts(
        receiptRows,
        [],
        new Set(["PKG-ABC"]),
        makeReceiptMappings(),
        makeAdjustmentMappings(),
      );
      expect(result[0].InvoiceId).toContain("INV-5001");
    });

    it("filters inactive invoices (no overlap with inventory)", () => {
      const receiptRows = [
        dutchieRcptRow({ "External Package ID": "PKG-ACTIVE", "Order Title": "PO - INV-A" }),
        dutchieRcptRow({ "External Package ID": "PKG-GONE", "Order Title": "PO - INV-B" }),
      ];
      // Only PKG-ACTIVE is in inventory
      const result = processReceipts(
        receiptRows,
        [],
        new Set(["PKG-ACTIVE"]),
        makeReceiptMappings(),
        makeAdjustmentMappings(),
      );
      expect(result.every((r) => r.InvoiceId.includes("INV-A"))).toBe(true);
    });

    it("keeps all invoice rows when at least one package overlaps", () => {
      const receiptRows = [
        dutchieRcptRow({ "External Package ID": "PKG-1", "Order Title": "PO - INV-SHARED" }),
        dutchieRcptRow({ "External Package ID": "PKG-2", "Order Title": "PO - INV-SHARED" }),
      ];
      // Only PKG-1 overlaps, but both belong to INV-SHARED
      const result = processReceipts(
        receiptRows,
        [],
        new Set(["PKG-1"]),
        makeReceiptMappings(),
        makeAdjustmentMappings(),
      );
      expect(result.some((r) => r.ExternalPackageId === "PKG-2")).toBe(true);
    });

    it("filters out rows where Quantity equals 0 after summing", () => {
      const receiptRows = [
        dutchieRcptRow({ "External Package ID": "PKG-ZERO", Quantity: "5", "Total Cost": "50" }),
      ];
      const adjRows = [{ SerialNumber: "PKG-ZERO", qty: "-5", Cost: "-50" }];
      const result = processReceipts(
        receiptRows,
        adjRows,
        new Set(["PKG-ZERO"]),
        makeReceiptMappings(),
        makeAdjustmentMappings(),
      );
      expect(result.some((r) => r.ExternalPackageId === "PKG-ZERO")).toBe(false);
    });

    it("returns empty array for empty receipt input", () => {
      const result = processReceipts(
        [],
        [],
        new Set(["PKG-1"]),
        makeReceiptMappings(),
        makeAdjustmentMappings(),
      );
      expect(result).toHaveLength(0);
    });
  });

  // ── runInventoryETL end-to-end ───────────────────────────────────────────
  describe("runInventoryETL", () => {
    it("inventory-only (no receipts, no vendors) produces valid output", () => {
      const inventoryFile = makeParsedFile([
        dutchieInvRow({ SKU: "S1", "External package ID": "PKG-1" }),
        dutchieInvRow({ SKU: "S2", "External package ID": "PKG-2", Room: "Back Stock" }),
      ]);

      const input: ETLInput = { inventoryFile };
      const result = runInventoryETL(input, makeFullMappings(), "LIC-TEST");

      expect(result).toHaveLength(2);
      expect(result[0].variantReferenceId).toBe("V-S1");
      expect(result[0].dispensaryLicense).toBe("LIC-TEST");
      // No receipts => empty invoice fields
      expect(result[0].invoiceId).toBe("");
      expect(result[0].invoiceCreatedDate).toBe("");
      // No vendors => empty distributor fields
      expect(result[0].distributorName).toBe("");
      // Inventory data still present
      expect(result[0].units).toBe("10");
      expect(result[0].thcAmount).toBe("23.5");
      expect(result[1].locationPath).toBe("Back of House, Back Stock");
    });

    it("full multi-file join (inventory + receipts + vendors)", () => {
      const inventoryFile = makeParsedFile([
        dutchieInvRow({ SKU: "SKU-1", "External package ID": "PKG-1" }),
      ]);
      const receiptsFile = makeParsedFile([
        dutchieRcptRow({
          "Product SKU": "SKU-1",
          "External Package ID": "PKG-1",
          Quantity: "20",
          "Total Cost": "200",
          "Vendor Name": "Green Farms",
          "Order Title": "PO-5 - INV-100",
        }),
      ]);
      const vendorsFile = makeParsedFile([
        {
          "Vendor name": "Green Farms",
          "Vendor code": "GF-LIC-001",
          Abbreviation: "GF",
          Address: "456 Elm",
          City: "SF",
          State: "CA",
          "Postal code": "94102",
          "Contact phone": "555-9876",
          "Contact email": "gf@test.com",
        },
      ]);

      const input: ETLInput = { inventoryFile, receiptsFile, vendorsFile };
      const result = runInventoryETL(input, makeFullMappings(), "C12-0000331-LIC");

      expect(result.length).toBeGreaterThan(0);
      const row = result[0];
      // Identity
      expect(row.variantReferenceId).toBe("V-SKU-1");
      expect(row.dispensaryLicense).toBe("C12-0000331-LIC");
      // Invoice joined from receipts
      expect(row.invoiceId).toContain("INV-100");
      expect(row.originalUnitCount).toBe("20");
      // Distributor joined from vendors
      expect(row.distributorName).toBe("Green Farms");
      expect(row.distributorDBA).toBe("GF");
      expect(row.distributorAddress).toBe("456 Elm SF, CA 94102");
      expect(row.distributorLicense1Number).toBe("GF-LIC-001");
      // Inventory data
      expect(row.thcAmount).toBe("23.5");
      expect(row.locationPath).toBe("Front of House, Sales Floor");
      expect(row.excluded).toBe(false);
    });

    it("handles package appearing in multiple invoices (1:N join)", () => {
      const inventoryFile = makeParsedFile([
        dutchieInvRow({ SKU: "SKU-1", "External package ID": "PKG-MULTI" }),
      ]);
      // Same package, two different invoices/dates
      const receiptsFile = makeParsedFile([
        dutchieRcptRow({
          "Product SKU": "SKU-1",
          "External Package ID": "PKG-MULTI",
          "Receive Date": "01/01/2026",
          "Vendor Name": "V1",
          "Order Title": "PO-A - INV-A",
          Quantity: "10",
          "Total Cost": "100",
        }),
        dutchieRcptRow({
          "Product SKU": "SKU-1",
          "External Package ID": "PKG-MULTI",
          "Receive Date": "02/01/2026",
          "Vendor Name": "V1",
          "Order Title": "PO-B - INV-B",
          Quantity: "10",
          "Total Cost": "100",
        }),
      ]);

      const input: ETLInput = { inventoryFile, receiptsFile };
      const result = runInventoryETL(input, makeFullMappings(), "LIC");

      // 1:N fullJoin: 1 inventory row × 2 invoice rows = 2 output rows
      expect(result.length).toBe(2);
      const invoiceIds = result.map((r) => r.invoiceId);
      // invoiceId is now full InvoiceIdDate format: "InvoiceId - Date - VendorName"
      expect(invoiceIds).toContain("INV-A - 2026-01-01 - V1");
      expect(invoiceIds).toContain("INV-B - 2026-02-01 - V1");
    });

    it("formats dates in final output", () => {
      const inventoryFile = makeParsedFile([
        dutchieInvRow({
          SKU: "S1",
          "External package ID": "PKG-1",
          "Expiration date": "12/31/2026",
          "Harvest date": "1/1/2025",
          "Packaging date": "2/15/2025",
        }),
      ]);

      const input: ETLInput = { inventoryFile };
      const result = runInventoryETL(input, makeFullMappings(), "LIC");

      expect(result[0].expirationDate).toBe("2026-12-31");
      expect(result[0].harvestDate).toBe("2025-01-01");
      expect(result[0].packagedDate).toBe("2025-02-15");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Validator
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inventory Validator", () => {
  describe("validateInventoryRows", () => {
    it("valid rows pass with zero errors and warnings", () => {
      const rows = [makeDerivedRow()];
      const result = validateInventoryRows(rows);
      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it("missing variantReferenceId produces error", () => {
      const rows = [makeDerivedRow({ variantReferenceId: "" })];
      const result = validateInventoryRows(rows);
      expect(result.errorCount).toBe(1);
      const err = result.errors.find((e) => e.field === "variantReferenceId");
      expect(err).toBeDefined();
      expect(err!.severity).toBe("error");
    });

    it("negative units produces error", () => {
      const rows = [makeDerivedRow({ units: "-5" })];
      const result = validateInventoryRows(rows);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].field).toBe("units");
      expect(result.errors[0].severity).toBe("error");
      expect(result.errors[0].message).toContain("negative");
    });

    it("non-numeric units produces error", () => {
      const rows = [makeDerivedRow({ units: "abc" })];
      const result = validateInventoryRows(rows);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].field).toBe("units");
    });

    it("invalid date format produces warning", () => {
      const rows = [makeDerivedRow({ harvestDate: "13/01/2025" })];
      const result = validateInventoryRows(rows);
      const warning = result.errors.find((e) => e.field === "harvestDate");
      expect(warning).toBeDefined();
      expect(warning!.severity).toBe("warning");
    });

    it("valid ISO date passes without warning", () => {
      const rows = [makeDerivedRow({ harvestDate: "2025-06-15" })];
      const result = validateInventoryRows(rows);
      const dateWarning = result.errors.find((e) => e.field === "harvestDate");
      expect(dateWarning).toBeUndefined();
    });

    it("empty externalPackageId produces warning", () => {
      const rows = [makeDerivedRow({ externalPackageId: "" })];
      const result = validateInventoryRows(rows);
      const w = result.errors.find((e) => e.field === "externalPackageId");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warning");
    });

    it("empty invoiceId always produces error (upgraded from warning)", () => {
      const rows = [makeDerivedRow({ invoiceId: "" })];
      const result = validateInventoryRows(rows);
      const invoiceError = result.errors.find((e) => e.field === "invoiceId");
      expect(invoiceError).toBeDefined();
      expect(invoiceError!.severity).toBe("error");
    });

    it("excluded rows are skipped entirely", () => {
      const rows = [makeDerivedRow({ excluded: true, variantReferenceId: "", units: "-1" })];
      const result = validateInventoryRows(rows);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it("returns correct aggregate counts with mixed issues", () => {
      const rows = [
        makeDerivedRow(), // clean
        makeDerivedRow({ variantReferenceId: "" }), // 1 error
        makeDerivedRow({ externalPackageId: "" }), // 1 warning
        makeDerivedRow({ excluded: true, units: "-1" }), // excluded, ignored
      ];
      const result = validateInventoryRows(rows);
      expect(result.validCount).toBe(2); // 3 active - 1 error
      expect(result.errorCount).toBe(1);
      expect(result.warningCount).toBe(1);
    });

    it("non-numeric unitCost produces error (upgraded from warning)", () => {
      const rows = [makeDerivedRow({ unitCost: "free" })];
      const result = validateInventoryRows(rows);
      const w = result.errors.find((e) => e.field === "unitCost");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("error");
    });

    it("validates all date fields (invoiceCreatedDate is error, others are warning)", () => {
      const rows = [
        makeDerivedRow({
          harvestDate: "bad",
          expirationDate: "nope",
          packagedDate: "wrong",
          invoiceCreatedDate: "!!",
        }),
      ];
      const result = validateInventoryRows(rows);
      const dateErrors = result.errors.filter((e) =>
        ["harvestDate", "expirationDate", "packagedDate", "invoiceCreatedDate"].includes(e.field),
      );
      expect(dateErrors).toHaveLength(4);
      // invoiceCreatedDate is now an error (required + format); others are warnings
      const invoiceDateErr = dateErrors.find((e) => e.field === "invoiceCreatedDate");
      expect(invoiceDateErr!.severity).toBe("error");
      const optionalDates = dateErrors.filter((e) => e.field !== "invoiceCreatedDate");
      optionalDates.forEach((w) => expect(w.severity).toBe("warning"));
    });
  });

  describe("groupInventoryErrors", () => {
    it("groups identical errors from multiple rows", () => {
      const rows = [
        makeDerivedRow({ variantReferenceId: "" }),
        makeDerivedRow({ variantReferenceId: "" }),
        makeDerivedRow({ externalPackageId: "" }),
      ];
      const result = validateInventoryRows(rows);
      const groups = groupInventoryErrors(result.errors);

      // 2 distinct field+message combos
      expect(groups).toHaveLength(2);

      const varIdGroup = groups.find((g) => g.field === "variantReferenceId");
      expect(varIdGroup!.rows).toHaveLength(2);

      const pkgGroup = groups.find((g) => g.field === "externalPackageId");
      expect(pkgGroup!.rows).toHaveLength(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CSV Generator
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inventory CSV Generator", () => {
  describe("INVENTORY_OUTPUT_COLUMNS", () => {
    it("has the expected number of columns (57)", () => {
      expect(INVENTORY_OUTPUT_COLUMNS).toHaveLength(57);
    });

    it("starts with TreezVariantId and ends with Distributor Representative 3 Notes", () => {
      expect(INVENTORY_OUTPUT_COLUMNS[0]).toBe("TreezVariantId");
      expect(INVENTORY_OUTPUT_COLUMNS[INVENTORY_OUTPUT_COLUMNS.length - 1]).toBe(
        "Distributor Representative 3 Notes",
      );
    });
  });

  describe("buildInventoryCSV", () => {
    it("produces correct header row matching INVENTORY_OUTPUT_COLUMNS", () => {
      const csv = buildInventoryCSV([]);
      expect(csv).toHaveLength(1);
      expect(csv[0]).toEqual(INVENTORY_OUTPUT_COLUMNS);
      expect(csv[0]).toHaveLength(INVENTORY_OUTPUT_COLUMNS.length);
    });

    it("data rows match column count", () => {
      const csv = buildInventoryCSV([makeDerivedRow()]);
      expect(csv).toHaveLength(2); // header + 1 data row
      expect(csv[1]).toHaveLength(INVENTORY_OUTPUT_COLUMNS.length);
    });

    it("excluded rows are filtered out", () => {
      const rows = [
        makeDerivedRow({ excluded: false }),
        makeDerivedRow({ excluded: true }),
        makeDerivedRow({ excluded: false }),
      ];
      const csv = buildInventoryCSV(rows);
      expect(csv).toHaveLength(3); // header + 2 non-excluded
    });

    it("field values map to correct column positions", () => {
      const row = makeDerivedRow({
        variantReferenceId: "V-TEST-SKU",
        dispensaryLicense: "C12-LIC",
        units: "42",
        customerType: "MEDICAL",
        thcAmount: "19.8",
        locationPath: "Back of House, Back Stock",
        distributorName: "Test Vendor",
      });
      const csv = buildInventoryCSV([row]);
      const dataRow = csv[1];
      const colIdx = (name: string) => INVENTORY_OUTPUT_COLUMNS.indexOf(name);

      expect(dataRow[colIdx("VariantReferenceId")]).toBe("V-TEST-SKU");
      expect(dataRow[colIdx("Dispensary License")]).toBe("C12-LIC");
      expect(dataRow[colIdx("Units")]).toBe("42");
      expect(dataRow[colIdx("Customer Type")]).toBe("MEDICAL");
      expect(dataRow[colIdx("THC Amount")]).toBe("19.8");
      expect(dataRow[colIdx("Location Path")]).toBe("Back of House, Back Stock");
      expect(dataRow[colIdx("Distributor Name")]).toBe("Test Vendor");
    });

    it("unmapped columns produce empty strings", () => {
      const csv = buildInventoryCSV([makeDerivedRow()]);
      const dataRow = csv[1];
      const colIdx = (name: string) => INVENTORY_OUTPUT_COLUMNS.indexOf(name);

      // TreezVariantId is always empty in derived rows
      expect(dataRow[colIdx("TreezVariantId")]).toBe("");
      // Manifest Number is always empty
      expect(dataRow[colIdx("Manifest Number")]).toBe("");
    });

    it("all column values are strings (never undefined)", () => {
      const csv = buildInventoryCSV([makeDerivedRow()]);
      const dataRow = csv[1];
      for (let i = 0; i < INVENTORY_OUTPUT_COLUMNS.length; i++) {
        expect(typeof dataRow[i]).toBe("string");
      }
    });

    it("works with empty distributor fields", () => {
      const row = makeDerivedRow({ distributorName: "", distributorDBA: "" });
      const csv = buildInventoryCSV([row]);
      const dataRow = csv[1];
      const colIdx = INVENTORY_OUTPUT_COLUMNS.indexOf("Distributor Name");
      expect(dataRow[colIdx]).toBe("");
    });
  });
});
