import { describe, it, expect } from "vitest";
import { validateDerivedRows, groupErrors } from "../lib/validator";
import type { DerivedRow, RowValidationError } from "../lib/types";
import { PRODUCT_CATEGORIES, VALID_CLASSIFICATIONS, PRODUCT_SUBCATEGORIES } from "../lib/constants";

/** Helper to create a valid DerivedRow with overrides */
function makeRow(overrides: Partial<DerivedRow> = {}): DerivedRow {
  return {
    excluded: false,
    productId: "P - SKU-001",
    productName: "Test Product",
    brand: "TestBrand",
    category: "Flower",
    subCategory: "Flower - General",
    status: "active",
    strain: "OG Kush",
    classification: "Hybrid",
    extractionMethod: "",
    uom: "grams",
    amount: 3.5,
    weightInGrams: 3.5,
    unitCount: "",
    merchSize: "",
    skuBarcode: "SKU-001",
    basePrice: "1000",
    description: "A test product",
    menuTitle: "",
    hideFromMenu: "FALSE",
    totalFlowerWeight: "3.5",
    totalConcentrateWeight: "",
    thc: "20.00",
    cbd: "5.00",
    tags: "",
    effects: "",
    flavor: "",
    ingredients: "",
    imageFilename: "",
    priceTier: "",
    ...overrides,
  };
}

describe("validateDerivedRows", () => {
  it("returns validCount = N, errorCount = 0 for valid rows", () => {
    const rows = [makeRow(), makeRow({ productId: "P - SKU-002", skuBarcode: "SKU-002" })];
    const result = validateDerivedRows(rows);
    expect(result.validCount).toBe(2);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns error severity for missing category", () => {
    const rows = [makeRow({ category: "InvalidCat" })];
    const result = validateDerivedRows(rows);
    expect(result.errorCount).toBeGreaterThan(0);
    const catError = result.errors.find((e) => e.field === "category");
    expect(catError).toBeDefined();
    expect(catError!.severity).toBe("error");
    expect(catError!.fixType).toBe("dropdown");
    expect(catError!.dropdownOptions).toEqual([...PRODUCT_CATEGORIES]);
  });

  it("returns warning severity for missing optional description", () => {
    const rows = [makeRow({ description: "" })];
    const result = validateDerivedRows(rows);
    expect(result.warningCount).toBeGreaterThan(0);
    const descWarning = result.errors.find((e) => e.field === "description");
    expect(descWarning).toBeDefined();
    expect(descWarning!.severity).toBe("warning");
  });

  it("returns error with dropdown for invalid classification", () => {
    const rows = [makeRow({ classification: "NotAClass" })];
    const result = validateDerivedRows(rows);
    const classError = result.errors.find((e) => e.field === "classification");
    expect(classError).toBeDefined();
    expect(classError!.severity).toBe("error");
    expect(classError!.fixType).toBe("dropdown");
    expect(classError!.dropdownOptions).toEqual([...VALID_CLASSIFICATIONS]);
  });

  it("returns error for amount = 0 on non-each category", () => {
    const rows = [makeRow({ amount: 0 })];
    const result = validateDerivedRows(rows);
    const amountError = result.errors.find((e) => e.field === "amount");
    expect(amountError).toBeDefined();
    expect(amountError!.severity).toBe("error");
  });

  it("returns error for missing productName", () => {
    const rows = [makeRow({ productName: "" })];
    const result = validateDerivedRows(rows);
    const nameError = result.errors.find((e) => e.field === "productName");
    expect(nameError).toBeDefined();
    expect(nameError!.severity).toBe("error");
    expect(nameError!.fixType).toBe("text");
  });

  it("returns error for invalid status with dropdown options", () => {
    const rows = [makeRow({ status: "unknown" })];
    const result = validateDerivedRows(rows);
    const statusError = result.errors.find((e) => e.field === "status");
    expect(statusError).toBeDefined();
    expect(statusError!.severity).toBe("error");
    expect(statusError!.fixType).toBe("dropdown");
    expect(statusError!.dropdownOptions).toContain("active");
  });

  it("returns error for invalid subCategory with dropdown options", () => {
    const rows = [makeRow({ category: "Flower", subCategory: "Nonsense" })];
    const result = validateDerivedRows(rows);
    const subError = result.errors.find((e) => e.field === "subCategory");
    expect(subError).toBeDefined();
    expect(subError!.severity).toBe("error");
    expect(subError!.fixType).toBe("dropdown");
    expect(subError!.dropdownOptions).toEqual(PRODUCT_SUBCATEGORIES["Flower"]);
  });

  it("returns warning for missing optional strain", () => {
    const rows = [makeRow({ strain: "" })];
    const result = validateDerivedRows(rows);
    const strainWarning = result.errors.find((e) => e.field === "strain");
    expect(strainWarning).toBeDefined();
    expect(strainWarning!.severity).toBe("warning");
  });

  it("returns warning for empty classification (not invalid)", () => {
    const rows = [makeRow({ classification: "" })];
    const result = validateDerivedRows(rows);
    const classWarning = result.errors.find((e) => e.field === "classification");
    expect(classWarning).toBeDefined();
    expect(classWarning!.severity).toBe("warning");
  });

  it("produces multiple errors for a single row with multiple issues", () => {
    const rows = [makeRow({ productName: "", category: "BadCat", amount: 0 })];
    const result = validateDerivedRows(rows);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("productName");
    expect(fields).toContain("category");
    expect(fields).toContain("amount");
  });

  it("skips excluded rows", () => {
    const rows = [makeRow({ excluded: true, productName: "" })];
    const result = validateDerivedRows(rows);
    expect(result.validCount).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("counts errors and warnings correctly in result", () => {
    const rows = [makeRow({ productName: "", description: "", strain: "" })];
    const result = validateDerivedRows(rows);
    // productName = error, description = warning, strain = warning
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(2);
  });
});

describe("groupErrors", () => {
  it("groups errors by field + message with row indices", () => {
    const errors: RowValidationError[] = [
      {
        rowIndex: 0,
        field: "category",
        currentValue: "Bad",
        message: 'Invalid category: "Bad"',
        fixType: "dropdown",
        dropdownOptions: [...PRODUCT_CATEGORIES],
        severity: "error",
      },
      {
        rowIndex: 5,
        field: "category",
        currentValue: "Bad",
        message: 'Invalid category: "Bad"',
        fixType: "dropdown",
        dropdownOptions: [...PRODUCT_CATEGORIES],
        severity: "error",
      },
      {
        rowIndex: 1,
        field: "productName",
        currentValue: "",
        message: "Product name is empty",
        fixType: "text",
        severity: "error",
      },
    ];
    const groups = groupErrors(errors);
    expect(groups).toHaveLength(2);
    const catGroup = groups.find((g) => g.field === "category");
    expect(catGroup).toBeDefined();
    expect(catGroup!.rows).toHaveLength(2);
    expect(catGroup!.rows.map((r) => r.rowIndex)).toEqual([0, 5]);
  });

  it("sorts groups by affected row count descending", () => {
    const errors: RowValidationError[] = [];
    // 47 rows with bad category
    for (let i = 0; i < 47; i++) {
      errors.push({
        rowIndex: i,
        field: "category",
        currentValue: "X",
        message: 'Invalid category: "X"',
        fixType: "dropdown",
        severity: "error",
      });
    }
    // 3 rows with bad name
    for (let i = 0; i < 3; i++) {
      errors.push({
        rowIndex: i,
        field: "productName",
        currentValue: "",
        message: "Product name is empty",
        fixType: "text",
        severity: "error",
      });
    }
    const groups = groupErrors(errors);
    expect(groups[0].field).toBe("category");
    expect(groups[0].rows).toHaveLength(47);
    expect(groups[1].field).toBe("productName");
    expect(groups[1].rows).toHaveLength(3);
  });

  it("preserves severity and fixType in groups", () => {
    const errors: RowValidationError[] = [
      {
        rowIndex: 0,
        field: "description",
        currentValue: "",
        message: "Description is empty",
        fixType: "text",
        severity: "warning",
      },
    ];
    const groups = groupErrors(errors);
    expect(groups[0].severity).toBe("warning");
    expect(groups[0].fixType).toBe("text");
  });

  it("preserves dropdownOptions in groups", () => {
    const errors: RowValidationError[] = [
      {
        rowIndex: 0,
        field: "category",
        currentValue: "X",
        message: "Invalid category",
        fixType: "dropdown",
        dropdownOptions: [...PRODUCT_CATEGORIES],
        severity: "error",
      },
    ];
    const groups = groupErrors(errors);
    expect(groups[0].dropdownOptions).toEqual([...PRODUCT_CATEGORIES]);
  });
});
