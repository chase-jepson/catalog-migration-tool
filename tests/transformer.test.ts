import { describe, it, expect } from "vitest";
import { deriveRows, applyFixes, normalizeClassification, parseWeight } from "../lib/transformer";
import type { FieldMapping, RowFix } from "../lib/types";

// ── Helper: create minimal mappings for testing ─────────────────────────────

function makeMappings(overrides: Record<string, string>): FieldMapping[] {
  const allFields = [
    "productIdentifier",
    "productName",
    "brand",
    "productCategory",
    "productSubCategory",
    "externalCategory",
    "status",
    "strain",
    "classification",
    "weight",
    "basePrice",
    "description",
    "menuTitle",
    "availableOnline",
    "imageFilename",
    "thc",
    "cbd",
    "tags",
    "effects",
    "flavor",
    "ingredients",
    "variantIdentifier",
    "priceTier",
    "priceType",
  ];

  return allFields.map((key) => ({
    fieldKey: key,
    label: key,
    sourceHeader: overrides[key] ?? null,
  }));
}

function makeRow(data: Record<string, string>): Record<string, string> {
  return data;
}

// ── parseWeight ──────────────────────────────────────────────────────────────

describe("parseWeight", () => {
  it('parses "0.5g" correctly', () => {
    const result = parseWeight("0.5g");
    expect(result.amount).toBeCloseTo(0.5);
    expect(result.unit).toBe("grams");
  });

  it('parses "500mg" correctly', () => {
    const result = parseWeight("500mg");
    expect(result.amount).toBeCloseTo(500);
    expect(result.unit).toBe("milligrams");
  });

  it('parses "1oz" and converts to grams', () => {
    const result = parseWeight("1oz");
    expect(result.amount).toBeCloseTo(28.3495, 2);
    expect(result.unit).toBe("grams");
  });

  it("parses plain number without unit", () => {
    const result = parseWeight("3.5");
    expect(result.amount).toBeCloseTo(3.5);
  });

  it("returns zero for unparseable values", () => {
    const result = parseWeight("unparseable");
    expect(result.amount).toBe(0);
    expect(result.unit).toBe("");
  });

  it("handles empty string", () => {
    const result = parseWeight("");
    expect(result.amount).toBe(0);
  });

  it('parses "3.5 grams"', () => {
    const result = parseWeight("3.5 grams");
    expect(result.amount).toBeCloseTo(3.5);
    expect(result.unit).toBe("grams");
  });
});

// ── normalizeClassification ──────────────────────────────────────────────────

describe("normalizeClassification", () => {
  it('normalizes "SATIVA" to "Sativa"', () => {
    expect(normalizeClassification("SATIVA")).toBe("Sativa");
  });

  it('normalizes "hybrid" to "Hybrid"', () => {
    expect(normalizeClassification("hybrid")).toBe("Hybrid");
  });

  it('preserves "I/S"', () => {
    expect(normalizeClassification("I/S")).toBe("I/S");
  });

  it('normalizes "indica" to "Indica"', () => {
    expect(normalizeClassification("indica")).toBe("Indica");
  });

  it('normalizes "s/i" to "S/I"', () => {
    expect(normalizeClassification("s/i")).toBe("S/I");
  });

  it('normalizes "cbd" to "CBD"', () => {
    expect(normalizeClassification("cbd")).toBe("CBD");
  });

  it("returns empty string for unknown classification", () => {
    expect(normalizeClassification("unknown")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeClassification("")).toBe("");
  });

  it("handles indica-dom abbreviation", () => {
    expect(normalizeClassification("indica-dom")).toBe("I/S");
  });

  it("handles sativa-dom abbreviation", () => {
    expect(normalizeClassification("sativa-dom")).toBe("S/I");
  });
});

// ── deriveRows ───────────────────────────────────────────────────────────────

describe("deriveRows", () => {
  const mappings = makeMappings({
    productIdentifier: "SKU",
    productName: "Product",
    brand: "Brand",
    productCategory: "Category",
    classification: "Strain Type",
    weight: "Weight",
    basePrice: "Price",
    status: "Status",
  });

  it("transforms source rows to DerivedRow[] with normalized category", () => {
    const rows = [
      makeRow({
        SKU: "SKU-001",
        Product: "Blue Dream Pre-Pack 3.5g",
        Brand: "TopShelf",
        Category: "Flower",
        "Strain Type": "Sativa",
        Weight: "3.5g",
        Price: "35.00",
        Status: "No",
      }),
    ];

    const result = deriveRows(rows, mappings);
    expect(result.derivedRows).toHaveLength(1);
    const row = result.derivedRows[0];
    expect(row.category).toBe("Flower");
    expect(row.uom).toBe("grams");
    expect(row.classification).toBe("Sativa");
    expect(row.amount).toBeGreaterThan(0);
    expect(row.productName).toBe("Blue Dream Pre-Pack 3.5g");
  });

  it("normalizes classification in derived rows", () => {
    const rows = [
      makeRow({
        SKU: "SKU-002",
        Product: "OG Kush",
        Brand: "Brand",
        Category: "Flower",
        "Strain Type": "INDICA",
        Weight: "1g",
        Price: "10",
        Status: "",
      }),
    ];

    const result = deriveRows(rows, mappings);
    expect(result.derivedRows[0].classification).toBe("Indica");
  });

  it("handles milligrams UoM for edibles", () => {
    const rows = [
      makeRow({
        SKU: "SKU-003",
        Product: "Sour Gummies 100mg",
        Brand: "Gummy Co",
        Category: "Edible",
        "Strain Type": "",
        Weight: "100mg",
        Price: "25",
        Status: "",
      }),
    ];

    const result = deriveRows(rows, mappings);
    const row = result.derivedRows[0];
    expect(row.category).toBe("Edible");
    expect(row.uom).toBe("milligrams");
  });

  it("returns categoryResolutions map", () => {
    const rows = [
      makeRow({
        SKU: "SKU-004",
        Product: "Test Flower",
        Brand: "",
        Category: "Flower",
        "Strain Type": "",
        Weight: "1g",
        Price: "10",
        Status: "",
      }),
    ];

    const result = deriveRows(rows, mappings);
    expect(result.categoryResolutions).toBeInstanceOf(Map);
  });

  it("handles 1000 rows in under 500ms (performance)", () => {
    const rows = Array.from({ length: 1000 }, (_, i) =>
      makeRow({
        SKU: `SKU-${i}`,
        Product: `Product ${i} Flower 3.5g`,
        Brand: "Brand",
        Category: "Flower",
        "Strain Type": "Hybrid",
        Weight: "3.5g",
        Price: "35.00",
        Status: "",
      }),
    );

    const start = performance.now();
    const result = deriveRows(rows, mappings);
    const elapsed = performance.now() - start;

    expect(result.derivedRows).toHaveLength(1000);
    expect(elapsed).toBeLessThan(500);
  });
});

// ── applyFixes ───────────────────────────────────────────────────────────────

describe("applyFixes", () => {
  const mappings = makeMappings({
    productIdentifier: "SKU",
    productName: "Product",
    productCategory: "Category",
    weight: "Weight",
    basePrice: "Price",
  });

  function getDerivedRows() {
    const rows = [
      makeRow({
        SKU: "SKU-100",
        Product: "Test Product",
        Category: "Flower",
        Weight: "3.5g",
        Price: "35",
      }),
      makeRow({
        SKU: "SKU-101",
        Product: "Test Product 2",
        Category: "Edible",
        Weight: "100mg",
        Price: "25",
      }),
    ];
    return deriveRows(rows, mappings).derivedRows;
  }

  it("changes category and cascades to subCategory, uom, merchSize", () => {
    const derived = getDerivedRows();
    const fixes: RowFix[] = [{ rowIndex: 0, field: "category", newValue: "Merch" }];

    const fixed = applyFixes(derived, fixes);
    expect(fixed[0].category).toBe("Merch");
    expect(fixed[0].uom).toBe("each");
    expect(fixed[0].merchSize).toBeTruthy(); // Should compute merchSize for Merch
    expect(fixed[0].subCategory).toBeTruthy(); // Should get default Merch sub
    // Row 1 unchanged
    expect(fixed[1].category).toBe("Edible");
  });

  it("applies classification fix", () => {
    const derived = getDerivedRows();
    const fixes: RowFix[] = [{ rowIndex: 1, field: "classification", newValue: "Indica" }];

    const fixed = applyFixes(derived, fixes);
    expect(fixed[1].classification).toBe("Indica");
  });

  it("returns original array when no fixes", () => {
    const derived = getDerivedRows();
    const fixed = applyFixes(derived, []);
    expect(fixed).toBe(derived);
  });

  it("applies subCategory fix without cascading", () => {
    const derived = getDerivedRows();
    const fixes: RowFix[] = [{ rowIndex: 0, field: "subCategory", newValue: "Shake" }];

    const fixed = applyFixes(derived, fixes);
    expect(fixed[0].subCategory).toBe("Shake");
    expect(fixed[0].category).toBe("Flower"); // category unchanged
  });
});
