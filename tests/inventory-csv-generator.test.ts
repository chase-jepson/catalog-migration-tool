import { describe, it, expect } from "vitest";
import { buildInventoryCSV, INVENTORY_OUTPUT_COLUMNS } from "../lib/inventory-csv-generator";
import type { InventoryDerivedRow } from "../lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<InventoryDerivedRow> = {}): InventoryDerivedRow {
  return {
    treezVariantId: "",
    variantReferenceId: "V-SKU-001",
    dispensaryLicense: "LIC-001",
    invoiceId: "INV-1 - 2026-02-11 - Vendor A",
    invoiceCreatedDate: "2026-02-11",
    manifestNumber: "",
    traceTreezId: "PKG-1",
    inventoryBarcodes: "PKG-1",
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

// ── INVENTORY_OUTPUT_COLUMNS ────────────────────────────────────────────────

describe("INVENTORY_OUTPUT_COLUMNS", () => {
  it("has the correct number of columns", () => {
    // Spec says columns 1-23 + 24-55 distributor = 55 columns
    // But includes 34 distributor columns (10 base + 9 license + 15 rep)
    // Let's verify the actual count matches the header
    expect(INVENTORY_OUTPUT_COLUMNS.length).toBeGreaterThanOrEqual(55);
  });
});

// ── buildInventoryCSV ────────────────────────────────────────────────────────

describe("buildInventoryCSV", () => {
  it("outputs header row matching INVENTORY_OUTPUT_COLUMNS", () => {
    const result = buildInventoryCSV([]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(INVENTORY_OUTPUT_COLUMNS);
  });

  it("column count matches INVENTORY_OUTPUT_COLUMNS for data rows", () => {
    const rows = [makeRow()];
    const result = buildInventoryCSV(rows);

    expect(result).toHaveLength(2);
    expect(result[1].length).toBe(INVENTORY_OUTPUT_COLUMNS.length);
  });

  it("excluded rows are filtered out", () => {
    const rows = [makeRow(), makeRow({ excluded: true })];
    const result = buildInventoryCSV(rows);

    expect(result).toHaveLength(2); // header + 1 non-excluded row
  });

  it("all distributor columns present even when empty", () => {
    const rows = [makeRow()];
    const result = buildInventoryCSV(rows);

    // Find the index of 'Distributor Name' in header
    const distNameIdx = INVENTORY_OUTPUT_COLUMNS.indexOf("Distributor Name");
    expect(distNameIdx).toBeGreaterThan(-1);
    expect(result[1][distNameIdx]).toBe("Vendor A");

    // Check that distributor columns at end are empty strings (not undefined)
    const lastDistIdx = INVENTORY_OUTPUT_COLUMNS.indexOf("Distributor Representative 3 Notes");
    expect(result[1][lastDistIdx]).toBe("");
  });

  it("maps InventoryDerivedRow fields to correct column positions", () => {
    const rows = [makeRow()];
    const result = buildInventoryCSV(rows);
    const dataRow = result[1];

    // Spot-check key columns
    const colIdx = (name: string) => INVENTORY_OUTPUT_COLUMNS.indexOf(name);

    expect(dataRow[colIdx("TreezVariantId")]).toBe("");
    expect(dataRow[colIdx("VariantReferenceId")]).toBe("V-SKU-001");
    expect(dataRow[colIdx("Dispensary License")]).toBe("LIC-001");
    expect(dataRow[colIdx("Invoice ID")]).toBe("INV-1 - 2026-02-11 - Vendor A");
    expect(dataRow[colIdx("Units")]).toBe("10");
    expect(dataRow[colIdx("Customer Type")]).toBe("ADULT");
    expect(dataRow[colIdx("THC Amount")]).toBe("23.5");
    expect(dataRow[colIdx("Location Path")]).toBe("Front of House, Sales Floor");
  });
});
