import type { DerivedRow, FieldMapping, RowValidationError } from "./types";
import type { CatalogReviewConfidence, CatalogReviewReason } from "../.logic-review/review-types";

interface ScoreCatalogReviewRowInput {
  originalRow: Record<string, string>;
  derivedRow: DerivedRow;
  mappings: FieldMapping[];
  validationErrors: RowValidationError[];
  detectedPOSConfidence?: number;
}

const CATEGORY_NAME_HINTS: Record<string, RegExp> = {
  Flower: /\b(flower|bud|eighth|1\/8|3\.5g|7g|14g|28g|ounce|smalls|shake)\b/i,
  Edible: /\b(gummy|gummies|chocolate|mint|cookie|brownie|chew|candy|lozenge|edible)\b/i,
  Cartridge: /\b(cart|cartridge|vape|510|pod|aio|all[-\s]?in[-\s]?one)\b/i,
  Preroll: /\b(pre[-\s]?roll|joint|blunt)\b/i,
  Beverage: /\b(drink|soda|seltzer|tea|coffee|lemonade|shot|beverage)\b/i,
  Tincture: /\b(tincture|drops|dropper|spray|syrup)\b/i,
  Topical: /\b(lotion|balm|cream|salve|patch|topical)\b/i,
  Extract: /\b(wax|shatter|rosin|resin|badder|budder|hash|diamond|crumble|extract)\b/i,
  Merch: /\b(battery|paper|grinder|lighter|accessory|bong|pipe|vaporizer)\b/i,
  CBD: /\bcbd\b/i,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeConfidence(score: number): number {
  return Number((clampScore(score) / 100).toFixed(2));
}

function buildFieldMap(mappings: FieldMapping[]): Record<string, string | null> {
  const fieldMap: Record<string, string | null> = {};
  for (const mapping of mappings) {
    fieldMap[mapping.fieldKey] = mapping.sourceHeader;
  }
  return fieldMap;
}

function parseNumeric(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function scoreCatalogReviewRow({
  originalRow,
  derivedRow,
  mappings,
  validationErrors,
  detectedPOSConfidence = 1,
}: ScoreCatalogReviewRowInput): CatalogReviewConfidence {
  const reasons: CatalogReviewReason[] = [];
  const fieldMap = buildFieldMap(mappings);
  const sourceCategory = fieldMap.productCategory ? originalRow[fieldMap.productCategory] ?? "" : "";
  const sourceWeight = fieldMap.weight ? originalRow[fieldMap.weight] ?? "" : "";
  const sourceThc = fieldMap.thc ? originalRow[fieldMap.thc] ?? "" : "";
  const name = derivedRow.productName || "";

  let categoryScore = 100;
  let amountScore = 100;
  let thcScore = 100;
  let uomScore = 100;

  const addReason = (
    code: string,
    message: string,
    deduction: number,
    bucket: "category" | "amount" | "thc" | "uom" | "global",
  ) => {
    reasons.push({ code, message, deduction });
    switch (bucket) {
      case "category":
        categoryScore -= deduction;
        break;
      case "amount":
        amountScore -= deduction;
        break;
      case "thc":
        thcScore -= deduction;
        break;
      case "uom":
        uomScore -= deduction;
        break;
      case "global":
        categoryScore -= deduction / 2;
        amountScore -= deduction / 4;
        thcScore -= deduction / 8;
        uomScore -= deduction / 8;
        break;
    }
  };

  if (!derivedRow.category || derivedRow.category === "Misc" || derivedRow.category === "Other") {
    addReason(
      "weak-category",
      `Category resolved to ${derivedRow.category || "(empty)"}`,
      35,
      "category",
    );
  }

  if (derivedRow.category && !derivedRow.subCategory) {
    addReason("missing-subcategory", "Derived row is missing a subcategory", 12, "category");
  }

  for (const [hintCategory, pattern] of Object.entries(CATEGORY_NAME_HINTS)) {
    if (pattern.test(name) && derivedRow.category !== hintCategory) {
      addReason(
        "category-name-mismatch",
        `Product name suggests ${hintCategory} but transformed category is ${derivedRow.category}`,
        22,
        "category",
      );
      break;
    }
  }

  if (sourceCategory && derivedRow.category && sourceCategory.toLowerCase() === derivedRow.category.toLowerCase()) {
    categoryScore = Math.min(100, categoryScore + 5);
  }

  if (derivedRow.amount <= 0) {
    addReason("missing-amount", "Transformed amount is empty or zero", 30, "amount");
  }

  if (sourceWeight && derivedRow.amount <= 0) {
    addReason(
      "source-weight-lost",
      `Source weight "${sourceWeight}" did not produce a usable amount`,
      20,
      "amount",
    );
  }

  if (derivedRow.category === "Flower" && derivedRow.uom !== "grams") {
    addReason(
      "category-interpretation-risk",
      `Flower category is low-confidence because the transformed UOM is "${derivedRow.uom}"`,
      25,
      "category",
    );
    addReason(
      "category-uom-mismatch",
      `Flower product has UOM "${derivedRow.uom}" instead of grams`,
      28,
      "uom",
    );
    addReason(
      "amount-interpretation-risk",
      `Flower amount is likely misinterpreted because UOM is "${derivedRow.uom}"`,
      24,
      "amount",
    );
  }

  if (derivedRow.category === "Edible" && derivedRow.uom === "grams") {
    addReason(
      "category-interpretation-risk",
      'Edible category is low-confidence because the transformed UOM is "grams"',
      20,
      "category",
    );
    addReason(
      "category-uom-mismatch",
      'Edible product has UOM "grams"',
      24,
      "uom",
    );
    addReason(
      "amount-interpretation-risk",
      'Edible amount is likely misinterpreted because UOM is "grams"',
      18,
      "amount",
    );
  }

  if (/mg/i.test(sourceWeight) && derivedRow.uom === "grams") {
    addReason(
      "source-unit-drift",
      `Source weight "${sourceWeight}" looks milligram-based but transformed UOM is grams`,
      18,
      "uom",
    );
  }

  if (/\bg\b/i.test(sourceWeight) && derivedRow.category === "Flower" && derivedRow.uom !== "grams") {
    addReason(
      "source-unit-drift",
      `Source weight "${sourceWeight}" looks gram-based but transformed UOM is ${derivedRow.uom}`,
      18,
      "uom",
    );
  }

  const sourceThcValue = parseNumeric(sourceThc);
  if (sourceThcValue && sourceThcValue > 0.5 && !derivedRow.thc && derivedRow.category !== "Flower") {
    addReason(
      "missing-output-thc",
      `Source THC "${sourceThc}" is present but transformed THC is empty`,
      24,
      "thc",
    );
  }

  for (const error of validationErrors) {
    addReason(
      "validation-error",
      `${error.field}: ${error.message}`,
      error.severity === "error" ? 12 : 6,
      error.field === "category" || error.field === "subCategory"
        ? "category"
        : error.field === "amount"
          ? "amount"
          : error.field === "uom"
            ? "uom"
            : error.field === "thc"
              ? "thc"
              : "global",
    );
  }

  if (detectedPOSConfidence < 0.6) {
    addReason(
      "low-pos-confidence",
      `POS auto-detection confidence is ${(detectedPOSConfidence * 100).toFixed(0)}%`,
      10,
      "global",
    );
  }

  const score = clampScore(
    categoryScore * 0.45 + amountScore * 0.25 + uomScore * 0.15 + thcScore * 0.15,
  );

  return {
    score,
    categoryConfidence: normalizeConfidence(categoryScore),
    amountConfidence: normalizeConfidence(amountScore),
    thcConfidence: normalizeConfidence(thcScore),
    uomConfidence: normalizeConfidence(uomScore),
    reasons,
  };
}
