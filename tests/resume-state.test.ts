import { describe, expect, it } from "vitest";
import type { PersistedInventoryState, PersistedMigrationState } from "../lib/types";
import {
  normalizeInventoryResumeState,
  normalizeMigrationResumeState,
} from "../lib/resume-state";

const parsedFile = {
  fileName: "catalog.csv",
  fileSize: 123,
  headers: ["Name"],
  rows: [{ Name: "Product A" }],
  rowCount: 1,
  previewRows: [{ Name: "Product A" }],
};

const baseCatalogState: PersistedMigrationState = {
  parsedFiles: [parsedFile],
  mergedHeaders: ["Name"],
  selectedPOS: "Dutchie",
  detectedPOS: { detected: "Dutchie", confidence: 0.9, disagreement: false },
  mappings: [{ fieldKey: "productName", label: "Product Name", sourceHeader: "Name" }],
  fixes: [],
  derivedRows: [],
  currentStep: 1,
  updatedAt: "2026-04-01T00:00:00.000Z",
};

const baseInventoryState: PersistedInventoryState = {
  parsedFiles: [parsedFile],
  mergedHeaders: ["Name"],
  selectedPOS: "Flowhub",
  detectedPOS: { detected: "Flowhub", confidence: 0.8, disagreement: false },
  selectedStore: { entityId: "store-1", name: "Downtown" },
  mappings: [],
  perRoleMappings: {
    inventory: [],
    receipts: [],
    vendors: [],
    adjustments: [],
    catalog_export: [],
  },
  fixes: [],
  inventoryDerivedRows: [],
  portalJobId: null,
  portalStoreId: null,
  currentStep: 1,
  updatedAt: "2026-04-01T00:00:00.000Z",
  fileAssignments: [{ file: parsedFile, role: "inventory" }],
  dispensaryLicense: "LIC-123",
};

describe("normalizeMigrationResumeState", () => {
  it("downgrades import-step resume to review when derived rows are missing", () => {
    const normalized = normalizeMigrationResumeState({
      ...baseCatalogState,
      currentStep: 3,
      derivedRows: [],
    });

    expect(normalized.currentStep).toBe(2);
  });

  it("preserves import-step resume when derived rows are present", () => {
    const normalized = normalizeMigrationResumeState({
      ...baseCatalogState,
      currentStep: 3,
      derivedRows: [
        {
          excluded: false,
          excludeReason: "",
          productId: "p-1",
          productName: "Product A",
          brand: "Brand",
          category: "Flower",
          subCategory: "Bud",
          status: "Active",
          strain: "",
          classification: "",
          extractionMethod: "",
          uom: "grams",
          amount: 1,
          weightInGrams: 1,
          unitCount: "1",
          merchSize: "1g",
          skuBarcode: "",
          basePrice: "10",
          description: "",
          menuTitle: "",
          hideFromMenu: "false",
          totalFlowerWeight: "",
          totalConcentrateWeight: "",
          thc: "",
          cbd: "",
          tags: "",
          effects: "",
          flavor: "",
          ingredients: "",
          imageFilename: "",
          priceTier: "",
        },
      ],
    });

    expect(normalized.currentStep).toBe(3);
    expect(normalized.derivedRows).toHaveLength(1);
  });
});

describe("normalizeInventoryResumeState", () => {
  it("downgrades inventory import resume to review when derived rows are missing", () => {
    const normalized = normalizeInventoryResumeState({
      ...baseInventoryState,
      currentStep: 3,
      inventoryDerivedRows: [],
      portalJobId: "job-1",
      portalStoreId: "portal-store-1",
    });

    expect(normalized.currentStep).toBe(2);
    expect(normalized.portalJobId).toBeNull();
    expect(normalized.portalStoreId).toBeNull();
  });

  it("preserves inventory import resume when import data exists", () => {
    const normalized = normalizeInventoryResumeState({
      ...baseInventoryState,
      currentStep: 3,
      inventoryDerivedRows: [
        {
          treezVariantId: "variant-1",
          variantReferenceId: "ref-1",
          dispensaryLicense: "LIC-123",
          invoiceId: "inv-1",
          invoiceCreatedDate: "",
          manifestNumber: "",
          traceTreezId: "",
          inventoryBarcodes: "",
          originalUnitCount: "1",
          units: "1",
          unitCost: "10",
          harvestDate: "",
          expirationDate: "",
          packagedDate: "",
          customerType: "",
          thcAmount: "",
          thcUom: "",
          cbdAmount: "",
          cbdUom: "",
          locationPath: "",
          locationInventoryType: "",
          locationIsSellable: "",
          locationDefaultReceivingLocation: "",
          distributorName: "",
          distributorDBA: "",
          distributorAddress: "",
          distributorPhoneNumber: "",
          distributorEmail: "",
          distributorType: "",
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
          productSKU: "",
          externalPackageId: "",
          productCategory: "",
          excluded: false,
        },
      ],
      portalJobId: "job-1",
      portalStoreId: "portal-store-1",
    });

    expect(normalized.currentStep).toBe(3);
    expect(normalized.portalJobId).toBe("job-1");
    expect(normalized.portalStoreId).toBe("portal-store-1");
  });
});
