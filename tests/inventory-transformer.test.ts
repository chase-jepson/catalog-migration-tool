import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ParsedFile, FieldMapping } from "../lib/types";
import type { ETLInput, PerRoleMappings } from "../lib/inventory-transformer";
import {
  processReceipts,
  processVendors,
  processInventory,
  joinChain,
  finalEnrichment,
  runInventoryETL,
} from "../lib/inventory-transformer";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Phase A: Receipt Processing ─────────────────────────────────────────────

describe("processReceipts", () => {
  it("sums receipts by group and calculates UnitCost", () => {
    const receiptRows = [
      {
        "Product SKU": "SKU-1",
        "External Package ID": "PKG-1",
        "Receive Date": "02/11/2026",
        Quantity: "10",
        "Total Cost": "100",
        "Vendor Name": "Vendor A",
        "Order Title": "PO-1 - INV001",
        "Unit Cost": "",
      },
      {
        "Product SKU": "SKU-1",
        "External Package ID": "PKG-1",
        "Receive Date": "02/11/2026",
        Quantity: "5",
        "Total Cost": "50",
        "Vendor Name": "Vendor A",
        "Order Title": "PO-1 - INV001",
        "Unit Cost": "",
      },
    ];
    const inventoryExtPkgIds = new Set(["PKG-1"]);

    const result = processReceipts(
      receiptRows,
      [],
      inventoryExtPkgIds,
      makeReceiptMappings(),
      makeAdjustmentMappings(),
    );

    expect(result.length).toBeGreaterThan(0);
    const row = result.find((r) => r.ExternalPackageId === "PKG-1");
    expect(row).toBeDefined();
    // Summed quantity: 10 + 5 = 15
    expect(Number(row!.Quantity)).toBe(15);
  });

  it("stacks adjustments with receipts and re-sums", () => {
    const receiptRows = [
      {
        "Product SKU": "SKU-1",
        "External Package ID": "PKG-1",
        "Receive Date": "02/11/2026",
        Quantity: "10",
        "Total Cost": "100",
        "Vendor Name": "Vendor A",
        "Order Title": "PO-1 - INV001",
        "Unit Cost": "",
      },
    ];
    const adjustmentRows = [{ SerialNumber: "PKG-1", qty: "-2", Cost: "-20" }];
    const inventoryExtPkgIds = new Set(["PKG-1"]);

    const result = processReceipts(
      receiptRows,
      adjustmentRows,
      inventoryExtPkgIds,
      makeReceiptMappings(),
      makeAdjustmentMappings(),
    );

    const row = result.find((r) => r.ExternalPackageId === "PKG-1");
    expect(row).toBeDefined();
    // Receipt 10 + Adjustment -2 = 8
    expect(Number(row!.Quantity)).toBe(8);
  });

  it("extracts InvoiceId from Order Title", () => {
    const receiptRows = [
      {
        "Product SKU": "SKU-1",
        "External Package ID": "PKG-1",
        "Receive Date": "02/11/2026",
        Quantity: "10",
        "Total Cost": "100",
        "Vendor Name": "Vendor A",
        "Order Title": "PO-123 - INV456",
        "Unit Cost": "",
      },
    ];
    const inventoryExtPkgIds = new Set(["PKG-1"]);

    const result = processReceipts(
      receiptRows,
      [],
      inventoryExtPkgIds,
      makeReceiptMappings(),
      makeAdjustmentMappings(),
    );

    const row = result.find((r) => r.ExternalPackageId === "PKG-1");
    expect(row!.InvoiceId).toContain("INV456");
  });

  it("filters to active invoices that overlap with inventory", () => {
    const receiptRows = [
      // PKG-1 is in inventory, PKG-2 is NOT -- but same invoice
      {
        "Product SKU": "SKU-1",
        "External Package ID": "PKG-1",
        "Receive Date": "02/11/2026",
        Quantity: "10",
        "Total Cost": "100",
        "Vendor Name": "Vendor A",
        "Order Title": "PO-1 - INV001",
        "Unit Cost": "",
      },
      {
        "Product SKU": "SKU-2",
        "External Package ID": "PKG-2",
        "Receive Date": "02/11/2026",
        Quantity: "5",
        "Total Cost": "50",
        "Vendor Name": "Vendor A",
        "Order Title": "PO-1 - INV001",
        "Unit Cost": "",
      },
      // PKG-3 is NOT in inventory, different invoice
      {
        "Product SKU": "SKU-3",
        "External Package ID": "PKG-3",
        "Receive Date": "01/01/2025",
        Quantity: "3",
        "Total Cost": "30",
        "Vendor Name": "Vendor B",
        "Order Title": "PO-2 - INV002",
        "Unit Cost": "",
      },
    ];
    // Only PKG-1 is in current inventory
    const inventoryExtPkgIds = new Set(["PKG-1"]);

    const result = processReceipts(
      receiptRows,
      [],
      inventoryExtPkgIds,
      makeReceiptMappings(),
      makeAdjustmentMappings(),
    );

    // INV001 is active because PKG-1 overlaps. So both PKG-1 and PKG-2 from INV001 survive.
    // INV002 is NOT active (PKG-3 not in inventory). So it's filtered out.
    const invoiceIds = result.map((r) => r.InvoiceId);
    expect(invoiceIds.every((id) => id.includes("INV001"))).toBe(true);
    expect(result.some((r) => r.ExternalPackageId === "PKG-2")).toBe(true);
    expect(result.some((r) => r.ExternalPackageId === "PKG-3")).toBe(false);
  });

  it("filters out rows where Quantity = 0", () => {
    const receiptRows = [
      {
        "Product SKU": "SKU-1",
        "External Package ID": "PKG-1",
        "Receive Date": "02/11/2026",
        Quantity: "10",
        "Total Cost": "100",
        "Vendor Name": "Vendor A",
        "Order Title": "PO-1 - INV001",
        "Unit Cost": "",
      },
      {
        "Product SKU": "SKU-2",
        "External Package ID": "PKG-Z",
        "Receive Date": "02/11/2026",
        Quantity: "0",
        "Total Cost": "0",
        "Vendor Name": "Vendor A",
        "Order Title": "PO-1 - INV001",
        "Unit Cost": "",
      },
    ];
    const inventoryExtPkgIds = new Set(["PKG-1", "PKG-Z"]);

    const result = processReceipts(
      receiptRows,
      [],
      inventoryExtPkgIds,
      makeReceiptMappings(),
      makeAdjustmentMappings(),
    );

    expect(result.some((r) => r.ExternalPackageId === "PKG-Z")).toBe(false);
  });
});

// ── Phase B: Vendor/Distributor Processing ──────────────────────────────────

describe("processVendors", () => {
  it("builds distributor address from address parts", () => {
    const vendorRows = [
      {
        "Vendor name": "Vendor A",
        Address: "123 Main St",
        City: "LA",
        State: "CA",
        "Postal code": "90001",
        "Vendor code": "LIC-001",
        Abbreviation: "VA",
        "Contact phone": "555-1234",
        "Contact email": "a@test.com",
      },
    ];

    const result = processVendors(vendorRows, makeVendorMappings());

    expect(result["vendor a"]).toBeDefined();
    expect(result["vendor a"].distributorAddress).toBe("123 Main St LA, CA 90001");
  });

  it("creates 32 distributor columns", () => {
    const vendorRows = [
      {
        "Vendor name": "Vendor A",
        Address: "123 Main",
        City: "LA",
        State: "CA",
        "Postal code": "90001",
        "Vendor code": "LIC-1",
        Abbreviation: "VA",
        "Contact phone": "555",
        "Contact email": "a@b.com",
      },
    ];

    const result = processVendors(vendorRows, makeVendorMappings());
    const v = result["vendor a"];

    expect(v.distributorName).toBe("Vendor A");
    expect(v.distributorDBA).toBe("VA");
    expect(v.distributorPhoneNumber).toBe("555");
    expect(v.distributorEmail).toBe("a@b.com");
    expect(v.distributorType).toBe("Non-Arms Length");
    // Empty fields
    expect(v.distributorDefaultPaymentTerm).toBe("");
    expect(v.distributorLeadTime).toBe("");
    expect(v.distributorRep1Name).toBe("");
  });

  it('enriches license type to "Adult" when license number is present', () => {
    const vendorRows = [
      {
        "Vendor name": "V",
        Address: "",
        City: "",
        State: "",
        "Postal code": "",
        "Vendor code": "LIC-1",
        Abbreviation: "",
        "Contact phone": "",
        "Contact email": "",
      },
      {
        "Vendor name": "V",
        Address: "",
        City: "",
        State: "",
        "Postal code": "",
        "Vendor code": "LIC-2",
        Abbreviation: "",
        "Contact phone": "",
        "Contact email": "",
      },
    ];

    const result = processVendors(vendorRows, makeVendorMappings());

    expect(result["v"].distributorLicense1Type).toBe("Adult");
    expect(result["v"].distributorLicense1Number).toBe("LIC-1");
    expect(result["v"].distributorLicense2Type).toBe("Adult");
    expect(result["v"].distributorLicense2Number).toBe("LIC-2");
    expect(result["v"].distributorLicense3Type).toBe("");
    expect(result["v"].distributorLicense3Number).toBe("");
  });

  it("generates license expiration (today + 2 years) for non-empty licenses", () => {
    const vendorRows = [
      {
        "Vendor name": "V",
        Address: "",
        City: "",
        State: "",
        "Postal code": "",
        "Vendor code": "LIC-1",
        Abbreviation: "",
        "Contact phone": "",
        "Contact email": "",
      },
    ];

    const result = processVendors(vendorRows, makeVendorMappings());

    // Expiration should be a valid date string
    expect(result["v"].distributorLicense1ExpirationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // License 2 has no number, so no expiration
    expect(result["v"].distributorLicense2ExpirationDate).toBe("");
  });
});

// ── Phase C: Inventory Processing ───────────────────────────────────────────

describe("processInventory", () => {
  it("cleans THC/CBD via splitPotency", () => {
    const rows = [
      {
        SKU: "S1",
        Product: "P1",
        "External package ID": "PKG-1",
        Room: "Sales Floor",
        Available: "10",
        "Quantity (including allocated)": "10",
        Cost: "5",
        THC: "23.5 %",
        CBD: "0.00 mg",
        "Available for": "",
        "Expiration date": "",
        "Packaging date": "",
        "Harvest date": "",
        Category: "Flower",
      },
    ];

    const result = processInventory(rows, makeInventoryMappings());

    expect(result[0].thcAmount).toBe("23.5");
    expect(result[0].thcUom).toBe("%");
    expect(result[0].cbdAmount).toBe("");
    expect(result[0].cbdUom).toBe("");
  });

  it("derives customerType from Available for", () => {
    const rows = [
      {
        SKU: "S1",
        Product: "P1",
        "External package ID": "PKG-1",
        Room: "Sales Floor",
        Available: "10",
        "Quantity (including allocated)": "10",
        Cost: "5",
        THC: "",
        CBD: "",
        "Available for": "All enabled customer types",
        "Expiration date": "",
        "Packaging date": "",
        "Harvest date": "",
        Category: "Flower",
      },
      {
        SKU: "S2",
        Product: "P2",
        "External package ID": "PKG-2",
        Room: "Back Stock",
        Available: "5",
        "Quantity (including allocated)": "5",
        Cost: "10",
        THC: "",
        CBD: "",
        "Available for": "Medical",
        "Expiration date": "",
        "Packaging date": "",
        "Harvest date": "",
        Category: "Flower",
      },
    ];

    const result = processInventory(rows, makeInventoryMappings());

    expect(result[0].customerType).toBe("ADULT");
    expect(result[1].customerType).toBe("MEDICAL");
  });

  it("derives location path and sub-fields", () => {
    const rows = [
      {
        SKU: "S1",
        Product: "P1",
        "External package ID": "PKG-1",
        Room: "Sales Floor",
        Available: "10",
        "Quantity (including allocated)": "10",
        Cost: "5",
        THC: "",
        CBD: "",
        "Available for": "",
        "Expiration date": "",
        "Packaging date": "",
        "Harvest date": "",
        Category: "Flower",
      },
      {
        SKU: "S2",
        Product: "P2",
        "External package ID": "PKG-2",
        Room: "Back Stock",
        Available: "5",
        "Quantity (including allocated)": "5",
        Cost: "10",
        THC: "",
        CBD: "",
        "Available for": "",
        "Expiration date": "",
        "Packaging date": "",
        "Harvest date": "",
        Category: "Flower",
      },
    ];

    const result = processInventory(rows, makeInventoryMappings());

    expect(result[0].locationPath).toBe("Front of House, Sales Floor");
    expect(result[0].locationIsSellable).toBe("TRUE");
    expect(result[0].locationDefaultReceivingLocation).toBe("FALSE");
    expect(result[0].locationInventoryType).toBe("All Types");

    expect(result[1].locationPath).toBe("Back of House, Back Stock");
    expect(result[1].locationIsSellable).toBe("FALSE");
    expect(result[1].locationDefaultReceivingLocation).toBe("TRUE");
  });
});

// ── Phase D: Join Chain ─────────────────────────────────────────────────────

describe("joinChain", () => {
  it("full joins inventory + invoice on ExternalPackageId", () => {
    const inventoryData = [{ ExternalPackageId: "PKG-1", Units: "10", ProductSKU: "SKU-1" }];
    const invoiceData = [{ ExternalPackageId: "PKG-1", Quantity: "15", InvoiceId: "INV-1" }];

    const result = joinChain(inventoryData, invoiceData, {}, []);

    expect(result).toHaveLength(1);
    expect(result[0].Units).toBe("10");
    expect(result[0].Quantity).toBe("15");
    expect(result[0].InvoiceId).toBe("INV-1");
  });

  it("left joins inventory + distributor on VendorName", () => {
    const inventoryData = [
      { ExternalPackageId: "PKG-1", Units: "10", ProductSKU: "SKU-1", VendorName: "Vendor A" },
    ];
    const distributorData = {
      "vendor a": { distributorName: "Vendor A", distributorDBA: "VA" },
    } as any;

    const result = joinChain(inventoryData, [], distributorData, []);

    expect(result[0].distributorName).toBe("Vendor A");
    expect(result[0].distributorDBA).toBe("VA");
  });

  it("handles unmatched rows gracefully", () => {
    const inventoryData = [
      { ExternalPackageId: "PKG-1", Units: "10", ProductSKU: "SKU-1", VendorName: "Unknown" },
    ];

    const result = joinChain(inventoryData, [], {}, []);

    expect(result).toHaveLength(1);
    expect(result[0].ExternalPackageId).toBe("PKG-1");
  });

  it("left joins with catalog on ProductSKU = ProductKey", () => {
    const inventoryData = [{ ExternalPackageId: "PKG-1", Units: "10", ProductSKU: "SKU-1" }];
    const catalogData = [{ ProductKey: "SKU-1", ProductCategory: "Merch" }];

    const result = joinChain(inventoryData, [], {}, catalogData);

    expect(result[0].ProductCategory).toBe("Merch");
  });
});

// ── Phase E: Final Enrichment ───────────────────────────────────────────────

describe("finalEnrichment", () => {
  it("leaves blank Units empty for receipt-only rows", () => {
    const rows = [
      { ExternalPackageId: "PKG-1", Units: "", ProductSKU: "SKU-1", ProductCategory: "Flower" },
    ];

    const result = finalEnrichment(rows as any[], "LIC-001");

    expect(result[0].units).toBe("");
  });

  it("assigns row numbers partitioned by ExternalPackageId", () => {
    const rows = [
      {
        ExternalPackageId: "PKG-1",
        Units: "5",
        ProductSKU: "SKU-1",
        ProductCategory: "Flower",
        VendorName: "",
      },
      {
        ExternalPackageId: "PKG-1",
        Units: "3",
        ProductSKU: "SKU-2",
        ProductCategory: "Flower",
        VendorName: "",
      },
      {
        ExternalPackageId: "PKG-2",
        Units: "10",
        ProductSKU: "SKU-3",
        ProductCategory: "Flower",
        VendorName: "",
      },
    ];

    const result = finalEnrichment(rows as any[], "LIC-001");

    const pkg1Rows = result.filter((r) => r.externalPackageId === "PKG-1");
    expect(pkg1Rows[0]._rowNumber).toBe(1);
    expect(pkg1Rows[1]._rowNumber).toBe(2);

    const pkg2Rows = result.filter((r) => r.externalPackageId === "PKG-2");
    expect(pkg2Rows[0]._rowNumber).toBe(1);
  });

  it("Merch TraceTreezId uses ExternalPackageId-RowNumber", () => {
    const rows = [
      {
        ExternalPackageId: "PKG-1",
        Units: "5",
        ProductSKU: "SKU-1",
        ProductCategory: "Merch",
        VendorName: "",
      },
      {
        ExternalPackageId: "PKG-1",
        Units: "3",
        ProductSKU: "SKU-2",
        ProductCategory: "Merch",
        VendorName: "",
      },
    ];

    const result = finalEnrichment(rows as any[], "LIC-001");

    expect(result[0].traceTreezId).toBe("PKG-1-1");
    expect(result[1].traceTreezId).toBe("PKG-1-2");
  });

  it("non-Merch TraceTreezId is plain ExternalPackageId", () => {
    const rows = [
      {
        ExternalPackageId: "PKG-1",
        Units: "5",
        ProductSKU: "SKU-1",
        ProductCategory: "Flower",
        VendorName: "",
      },
    ];

    const result = finalEnrichment(rows as any[], "LIC-001");

    expect(result[0].traceTreezId).toBe("PKG-1");
  });

  it("Merch InventoryBarcodes is empty; non-Merch is ExternalPackageId", () => {
    const rows = [
      {
        ExternalPackageId: "PKG-1",
        Units: "5",
        ProductSKU: "SKU-1",
        ProductCategory: "Merch",
        VendorName: "",
      },
      {
        ExternalPackageId: "PKG-2",
        Units: "5",
        ProductSKU: "SKU-2",
        ProductCategory: "Flower",
        VendorName: "",
      },
    ];

    const result = finalEnrichment(rows as any[], "LIC-001");

    expect(result[0].inventoryBarcodes).toBe("");
    expect(result[1].inventoryBarcodes).toBe("PKG-2");
  });

  it("generates VariantReferenceId as V-{ProductSKU}", () => {
    const rows = [
      {
        ExternalPackageId: "PKG-1",
        Units: "5",
        ProductSKU: "SKU-1",
        ProductCategory: "Flower",
        VendorName: "",
      },
    ];

    const result = finalEnrichment(rows as any[], "LIC-001");

    expect(result[0].variantReferenceId).toBe("V-SKU-1");
  });

  it("sets dispensaryLicense on all rows", () => {
    const rows = [
      {
        ExternalPackageId: "PKG-1",
        Units: "5",
        ProductSKU: "SKU-1",
        ProductCategory: "Flower",
        VendorName: "",
      },
    ];

    const result = finalEnrichment(rows as any[], "C12-0000331-LIC");

    expect(result[0].dispensaryLicense).toBe("C12-0000331-LIC");
  });

  it("formats dates to yyyy-MM-dd", () => {
    const rows = [
      {
        ExternalPackageId: "PKG-1",
        Units: "5",
        ProductSKU: "SKU-1",
        ProductCategory: "Flower",
        VendorName: "",
        ReceiveDate: "02/11/2026",
        HarvestDate: "1/5/2025",
        ExpirationDate: "12/31/2026",
        PackagedDate: "2/1/2025",
      },
    ];

    const result = finalEnrichment(rows as any[], "LIC-001");

    expect(result[0].invoiceCreatedDate).toBe("2026-02-11");
    expect(result[0].harvestDate).toBe("2025-01-05");
    expect(result[0].expirationDate).toBe("2026-12-31");
    expect(result[0].packagedDate).toBe("2025-02-01");
  });
});

// ── Integration: runInventoryETL ────────────────────────────────────────────

describe("runInventoryETL", () => {
  it("produces InventoryDerivedRow[] from full fixture data", () => {
    const inventoryFile = makeParsedFile([
      {
        SKU: "SKU-1",
        Product: "Blue Dream",
        "External package ID": "PKG-1",
        Room: "Sales Floor",
        Available: "10",
        "Quantity (including allocated)": "10",
        Cost: "5",
        THC: "23.5 %",
        CBD: "1.2 mg",
        "Available for": "All enabled customer types",
        "Expiration date": "12/31/2026",
        "Packaging date": "1/15/2025",
        "Harvest date": "1/1/2025",
        Category: "Flower",
      },
    ]);
    const receiptsFile = makeParsedFile([
      {
        "Product SKU": "SKU-1",
        "External Package ID": "PKG-1",
        "Receive Date": "02/11/2026",
        Quantity: "20",
        "Total Cost": "200",
        "Vendor Name": "Vendor A",
        "Order Title": "PO-1 - INV001",
        "Unit Cost": "10",
      },
    ]);
    const vendorsFile = makeParsedFile([
      {
        "Vendor name": "Vendor A",
        Address: "123 Main",
        City: "LA",
        State: "CA",
        "Postal code": "90001",
        "Vendor code": "LIC-1",
        Abbreviation: "VA",
        "Contact phone": "555",
        "Contact email": "a@b.com",
      },
    ]);
    const catalogFile = makeParsedFile([{ "Product Key": "SKU-1", "Product Category": "Flower" }]);

    const input: ETLInput = { inventoryFile, receiptsFile, vendorsFile, catalogFile };
    const result = runInventoryETL(input, makeFullMappings(), "C12-0000331-LIC");

    expect(result.length).toBeGreaterThan(0);
    const row = result[0];
    expect(row.variantReferenceId).toBe("V-SKU-1");
    expect(row.dispensaryLicense).toBe("C12-0000331-LIC");
    expect(row.thcAmount).toBe("23.5");
    expect(row.thcUom).toBe("%");
    expect(row.locationPath).toBe("Front of House, Sales Floor");
    expect(row.distributorName).toBe("Vendor A");
    expect(row.excluded).toBe(false);
  });

  it("gracefully degrades when only inventory file provided", () => {
    const inventoryFile = makeParsedFile([
      {
        SKU: "SKU-1",
        Product: "Blue Dream",
        "External package ID": "PKG-1",
        Room: "Sales Floor",
        Available: "10",
        "Quantity (including allocated)": "10",
        Cost: "5",
        THC: "23.5 %",
        CBD: "",
        "Available for": "",
        "Expiration date": "",
        "Packaging date": "",
        "Harvest date": "",
        Category: "Flower",
      },
    ]);

    const input: ETLInput = { inventoryFile };
    const mappings = makeFullMappings();
    const result = runInventoryETL(input, mappings, "LIC-001");

    expect(result.length).toBeGreaterThan(0);
    const row = result[0];
    expect(row.variantReferenceId).toBe("V-SKU-1");
    // No receipts: invoice columns should be empty
    expect(row.invoiceId).toBe("");
    expect(row.invoiceCreatedDate).toBe("");
    // No vendors: distributor columns should be empty
    expect(row.distributorName).toBe("");
    // Inventory data should still be present
    expect(row.units).toBe("10");
    expect(row.thcAmount).toBe("23.5");
  });
});
