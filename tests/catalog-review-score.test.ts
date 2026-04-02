import { describe, expect, it } from "vitest";
import { scoreCatalogReviewRow } from "../lib/catalog-review-score";
import type { DerivedRow, FieldMapping, RowValidationError } from "../lib/types";

function makeDerivedRow(overrides: Partial<DerivedRow> = {}): DerivedRow {
  return {
    excluded: false,
    excludeReason: "",
    productId: "P-1",
    productName: "Blue Dream 3.5g Flower",
    brand: "Test Brand",
    category: "Flower",
    subCategory: "Flower - General",
    status: "active",
    strain: "Blue Dream",
    classification: "Hybrid",
    extractionMethod: "",
    uom: "grams",
    amount: 3.5,
    weightInGrams: 3.5,
    unitCount: "",
    merchSize: "",
    skuBarcode: "SKU-1",
    basePrice: "2500",
    description: "",
    menuTitle: "",
    hideFromMenu: "FALSE",
    totalFlowerWeight: "3.5",
    totalConcentrateWeight: "",
    thc: "0",
    cbd: "0",
    tags: "",
    effects: "",
    flavor: "",
    ingredients: "",
    imageFilename: "",
    priceTier: "",
    ...overrides,
  };
}

function makeMappings(overrides: Record<string, string>): FieldMapping[] {
  const fields = ["productCategory", "weight", "thc", "cbd", "classification"];
  return fields.map((fieldKey) => ({
    fieldKey,
    label: fieldKey,
    sourceHeader: overrides[fieldKey] ?? null,
  }));
}

describe("scoreCatalogReviewRow", () => {
  it("scores weak category outcomes lower than direct matches", () => {
    const original = {
      Category: "Flower",
      Weight: "3.5g",
    };

    const strong = scoreCatalogReviewRow({
      originalRow: original,
      derivedRow: makeDerivedRow(),
      mappings: makeMappings({ productCategory: "Category", weight: "Weight" }),
      validationErrors: [],
    });

    const weak = scoreCatalogReviewRow({
      originalRow: original,
      derivedRow: makeDerivedRow({ category: "Misc", subCategory: "Misc - General" }),
      mappings: makeMappings({ productCategory: "Category", weight: "Weight" }),
      validationErrors: [],
    });

    expect(weak.score).toBeLessThan(strong.score);
    expect(weak.reasons.some((reason) => reason.code === "weak-category")).toBe(true);
  });

  it("penalizes suspicious UOM and amount combinations", () => {
    const score = scoreCatalogReviewRow({
      originalRow: { Category: "Flower", Weight: "3.5g" },
      derivedRow: makeDerivedRow({ uom: "milligrams", amount: 3.5 }),
      mappings: makeMappings({ productCategory: "Category", weight: "Weight" }),
      validationErrors: [],
    });

    expect(score.score).toBeLessThan(80);
    expect(score.reasons.some((reason) => reason.code === "category-uom-mismatch")).toBe(true);
    expect(score.uomConfidence).toBeLessThan(1);
  });

  it("penalizes missing transformed THC when source THC is present", () => {
    const score = scoreCatalogReviewRow({
      originalRow: { Category: "Edible", Weight: "100mg", THC: "100" },
      derivedRow: makeDerivedRow({
        category: "Edible",
        subCategory: "Edible - General",
        uom: "milligrams",
        amount: 100,
        thc: "",
      }),
      mappings: makeMappings({
        productCategory: "Category",
        weight: "Weight",
        thc: "THC",
      }),
      validationErrors: [],
    });

    expect(score.reasons.some((reason) => reason.code === "missing-output-thc")).toBe(true);
    expect(score.thcConfidence).toBeLessThan(1);
  });

  it("accounts for row validation errors in the final score", () => {
    const validationErrors: RowValidationError[] = [
      {
        rowIndex: 0,
        field: "category",
        currentValue: "Misc",
        message: "Invalid category",
        fixType: "dropdown",
        severity: "error",
      },
    ];

    const score = scoreCatalogReviewRow({
      originalRow: { Category: "Flower", Weight: "3.5g" },
      derivedRow: makeDerivedRow({ category: "Misc" }),
      mappings: makeMappings({ productCategory: "Category", weight: "Weight" }),
      validationErrors,
    });

    expect(score.reasons.some((reason) => reason.code === "validation-error")).toBe(true);
    expect(score.score).toBeLessThan(70);
  });
});
