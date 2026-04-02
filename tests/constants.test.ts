import { describe, it, expect } from "vitest";
import {
  POS_SYSTEMS,
  MAPPING_FIELDS,
  POS_DEFAULTS,
  createEmptyMappings,
  MAX_FILE_SIZE,
  MAPPING_GROUPS,
  PRODUCT_CATEGORIES,
  PRODUCT_SUBCATEGORIES,
  UOM_BY_CATEGORY,
  VALID_CLASSIFICATIONS,
} from "../lib/constants";

describe("POS_SYSTEMS", () => {
  it("contains all 6 POS systems", () => {
    expect(POS_SYSTEMS).toEqual(["Blaze", "Cova", "Dutchie", "Flowhub", "IndicaOnline", "Meadow"]);
  });
});

describe("MAPPING_FIELDS", () => {
  it("has 24 field definitions", () => {
    expect(MAPPING_FIELDS).toHaveLength(24);
  });

  it("each field has group property", () => {
    for (const field of MAPPING_FIELDS) {
      expect(field.group).toBeDefined();
      expect([
        "Product Info",
        "Cannabis Details",
        "Pricing",
        "Attributes",
        "Display & Media",
      ]).toContain(field.group);
    }
  });

  it("productName and productCategory are required", () => {
    const productName = MAPPING_FIELDS.find((f) => f.key === "productName");
    const productCategory = MAPPING_FIELDS.find((f) => f.key === "productCategory");
    expect(productName?.required).toBe(true);
    expect(productCategory?.required).toBe(true);
  });

  it("assigns correct groups to fields", () => {
    const grouped: Record<string, string[]> = {};
    for (const f of MAPPING_FIELDS) {
      if (!grouped[f.group]) grouped[f.group] = [];
      grouped[f.group].push(f.key);
    }

    expect(grouped["Product Info"]).toContain("productIdentifier");
    expect(grouped["Product Info"]).toContain("productName");
    expect(grouped["Product Info"]).toContain("brand");
    expect(grouped["Product Info"]).toContain("productCategory");
    expect(grouped["Product Info"]).toContain("status");
    expect(grouped["Product Info"]).toContain("description");

    expect(grouped["Cannabis Details"]).toContain("strain");
    expect(grouped["Cannabis Details"]).toContain("classification");
    expect(grouped["Cannabis Details"]).toContain("weight");
    expect(grouped["Cannabis Details"]).toContain("thc");
    expect(grouped["Cannabis Details"]).toContain("cbd");

    expect(grouped["Pricing"]).toContain("basePrice");
    expect(grouped["Pricing"]).toContain("priceTier");
    expect(grouped["Pricing"]).toContain("priceType");

    expect(grouped["Attributes"]).toContain("tags");
    expect(grouped["Attributes"]).toContain("effects");
    expect(grouped["Attributes"]).toContain("flavor");
    expect(grouped["Attributes"]).toContain("ingredients");

    expect(grouped["Display & Media"]).toContain("menuTitle");
    expect(grouped["Display & Media"]).toContain("availableOnline");
    expect(grouped["Display & Media"]).toContain("imageFilename");
    expect(grouped["Display & Media"]).toContain("externalCategory");
  });
});

describe("POS_DEFAULTS", () => {
  it("has templates for all 6 POS systems", () => {
    for (const pos of POS_SYSTEMS) {
      expect(POS_DEFAULTS[pos]).toBeDefined();
      expect(Object.keys(POS_DEFAULTS[pos]).length).toBeGreaterThan(0);
    }
  });

  it("Dutchie template has expected mappings", () => {
    expect(POS_DEFAULTS["Dutchie"]["productName"]).toBe("Product");
    expect(POS_DEFAULTS["Dutchie"]["brand"]).toBe("Brand");
    expect(POS_DEFAULTS["Dutchie"]["productIdentifier"]).toBe("SKU");
  });
});

describe("createEmptyMappings", () => {
  it("returns FieldMapping[] with null sourceHeaders", () => {
    const mappings = createEmptyMappings();
    expect(mappings).toHaveLength(24);
    for (const m of mappings) {
      expect(m.sourceHeader).toBeNull();
      expect(m.fieldKey).toBeTruthy();
      expect(m.label).toBeTruthy();
    }
  });
});

describe("MAX_FILE_SIZE", () => {
  it("is 100MB", () => {
    expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
  });
});

describe("MAPPING_GROUPS", () => {
  it("lists all 5 groups in display order", () => {
    expect(MAPPING_GROUPS).toHaveLength(5);
    expect(MAPPING_GROUPS).toContain("Product Info");
    expect(MAPPING_GROUPS).toContain("Cannabis Details");
    expect(MAPPING_GROUPS).toContain("Pricing");
    expect(MAPPING_GROUPS).toContain("Attributes");
    expect(MAPPING_GROUPS).toContain("Display & Media");
  });
});

describe("Phase 3 readiness constants", () => {
  it("PRODUCT_CATEGORIES has expected categories", () => {
    expect(PRODUCT_CATEGORIES).toContain("Flower");
    expect(PRODUCT_CATEGORIES).toContain("Edible");
    expect(PRODUCT_CATEGORIES).toContain("Cartridge");
  });

  it("PRODUCT_SUBCATEGORIES has entries for Flower", () => {
    expect(PRODUCT_SUBCATEGORIES["Flower"]).toBeDefined();
    expect(PRODUCT_SUBCATEGORIES["Flower"].length).toBeGreaterThan(0);
  });

  it("UOM_BY_CATEGORY maps categories to units", () => {
    expect(UOM_BY_CATEGORY["Flower"]).toBe("grams");
    expect(UOM_BY_CATEGORY["Edible"]).toBe("milligrams");
  });

  it("VALID_CLASSIFICATIONS has standard values", () => {
    expect(VALID_CLASSIFICATIONS).toContain("Sativa");
    expect(VALID_CLASSIFICATIONS).toContain("Indica");
    expect(VALID_CLASSIFICATIONS).toContain("Hybrid");
  });
});
