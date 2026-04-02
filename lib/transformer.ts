import type {
  FieldMapping,
  DerivedRow,
  RowFix,
  CategoryResolution,
  TransformResult,
} from "./types";
import { UOM_BY_CATEGORY } from "./constants";
import {
  categoryKey,
  enhancedCategoryResolve,
  applyNameOverride,
  resolveSubCategoryFromName,
  getDefaultSubCategory,
  EXCLUDED_CATEGORY,
} from "./category-mapper";
import {
  lookupBrandCategory,
  lookupBrandSubcategory,
  normalizeBrandName,
  lookupStrainClassification,
} from "./reference-data";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a lookup: fieldKey -> sourceHeader */
function buildFieldMap(mappings: FieldMapping[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const m of mappings) {
    map[m.fieldKey] = m.sourceHeader;
  }
  return map;
}

/** Get a source value from a row using the field map */
function getVal(
  row: Record<string, string>,
  fieldMap: Record<string, string | null>,
  fieldKey: string,
): string {
  const col = fieldMap[fieldKey];
  if (!col) return "";
  return (row[col] ?? "").trim().replace(/\s{2,}/g, " ");
}

// ── Brand Deduplication ──────────────────────────────────────────────────────

const PLACEHOLDER_BRANDS = new Set([
  "n/a",
  "na",
  "none",
  "unknown",
  "-",
  "--",
  "null",
  "undefined",
]);

function deduplicateBrands(rows: Record<string, string>[], brandCol: string | null): string[] {
  if (!brandCol) return [];
  const counts = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const raw = (row[brandCol] ?? "").trim();
    if (!raw || PLACEHOLDER_BRANDS.has(raw.toLowerCase())) continue;
    const lower = raw.toLowerCase();
    if (!counts.has(lower)) counts.set(lower, new Map());
    const casings = counts.get(lower)!;
    casings.set(raw, (casings.get(raw) ?? 0) + 1);
  }

  const winners: string[] = [];
  for (const casings of counts.values()) {
    let best = "";
    let bestCount = 0;
    for (const [casing, count] of casings) {
      if (count > bestCount) {
        best = casing;
        bestCount = count;
      }
    }
    winners.push(best);
  }

  return winners.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function buildBrandCasingMap(brands: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of brands) map.set(b.toLowerCase(), b);
  return map;
}

// ── Classification ───────────────────────────────────────────────────────────

/**
 * Normalize a classification string to a valid Treez classification.
 * Optionally uses productName for name-based fallback.
 */
export function normalizeClassification(
  input: string,
  productName?: string,
  description?: string,
): string {
  if (!input && !productName && !description) return "";
  const lower = (input || "").toLowerCase().trim();

  // 1. Product name takes priority — when it explicitly mentions a classification,
  //    it's usually more accurate than the mapped column (per review feedback).
  if (productName) {
    const nameLower = productName.toLowerCase();
    if (/indica/i.test(nameLower) && /hybrid/i.test(nameLower)) return "I/S";
    if (/sativa/i.test(nameLower) && /hybrid/i.test(nameLower)) return "S/I";
    if (/\(I\)/i.test(productName) || /\bindica\b/i.test(productName)) return "Indica";
    if (/\(S\)/i.test(productName) || /\bsativa\b/i.test(productName)) return "Sativa";
    if (/\(H\)/i.test(productName) || /\bhybrid\b/i.test(productName)) return "Hybrid";
    if (/\bcbd\b/i.test(productName)) return "CBD";
  }

  // 2. Mapped column value — exact matches
  if (lower === "sativa") return "Sativa";
  if (lower === "indica") return "Indica";
  if (lower === "hybrid" || lower === "hbrid") return "Hybrid";
  if (lower === "i/s") return "I/S";
  if (lower === "s/i") return "S/I";
  if (lower === "cbd") return "CBD";

  // 3. Compound classifications (e.g., "Sativa-Hybrid", "Indica-Hybrid", "hybrid-indica")
  if (/indica[\s-]?hybrid|hybrid[\s-]?indica/i.test(lower)) return "I/S";
  if (/sativa[\s-]?hybrid|hybrid[\s-]?sativa/i.test(lower)) return "S/I";

  // 4. Dominant abbreviations
  if (/indica[\s-]?dom/i.test(lower)) return "I/S";
  if (/sativa[\s-]?dom/i.test(lower)) return "S/I";

  // 5. Description-based fallback
  if (description) {
    const descLower = description.toLowerCase();
    if (/indica/i.test(descLower) && /hybrid/i.test(descLower)) return "I/S";
    if (/sativa/i.test(descLower) && /hybrid/i.test(descLower)) return "S/I";
    if (/\bindica\b/i.test(descLower)) return "Indica";
    if (/\bsativa\b/i.test(descLower)) return "Sativa";
    if (/\bhybrid\b/i.test(descLower)) return "Hybrid";
  }

  return "";
}

// ── Extraction Method ────────────────────────────────────────────────────────

function deriveExtractionMethod(productName: string, description: string): string {
  if (/rosin|solventless/i.test(productName)) return "Solventless";
  if (/solventless/i.test(description)) return "Solventless";
  return "";
}

// ── Status ───────────────────────────────────────────────────────────────────

const INACTIVE_STATUS_VALUES = new Set([
  "yes",          // Dutchie "Is retired"
  "inactive",     // Generic
  "disabled",     // Cova "Product Status"
  "archived",     // Blaze
  "retired",      // Generic
  "discontinued", // Generic
  "deleted",      // Soft-deleted products
]);

function deriveStatus(value: string): string {
  return INACTIVE_STATUS_VALUES.has(value.toLowerCase().trim()) ? "inactive" : "active";
}

// ── Weight / Amount Parsing ──────────────────────────────────────────────────

interface ParsedWeight {
  value: number;
  unit: "g" | "mg" | "oz" | "unknown";
}

function internalParseWeight(raw: string): ParsedWeight {
  if (!raw) return { value: 0, unit: "unknown" };
  const cleaned = raw.replace(/,/g, "").trim();

  const match = cleaned.match(/^([\d.]+)\s*(g|mg|oz|grams?|milligrams?)?$/i);
  if (!match) {
    const num = parseFloat(cleaned);
    return { value: isNaN(num) ? 0 : num, unit: "unknown" };
  }

  const num = parseFloat(match[1]);
  const unitStr = (match[2] ?? "").toLowerCase();

  if (unitStr.startsWith("mg") || unitStr.startsWith("milligram"))
    return { value: num, unit: "mg" };
  if (unitStr.startsWith("g") || unitStr.startsWith("gram")) return { value: num, unit: "g" };
  if (unitStr.startsWith("oz")) return { value: num, unit: "oz" };

  return { value: num, unit: "unknown" };
}

/**
 * Parse a weight string into { amount, unit }.
 * Exported for testing. Converts oz to grams automatically.
 */
export function parseWeight(value: string): { amount: number; unit: string } {
  if (!value) return { amount: 0, unit: "" };
  const parsed = internalParseWeight(value);

  if (parsed.value === 0 && parsed.unit === "unknown") {
    return { amount: 0, unit: "" };
  }

  // Convert oz to grams
  if (parsed.unit === "oz") {
    return { amount: parsed.value * 28.3495, unit: "grams" };
  }

  if (parsed.unit === "g") return { amount: parsed.value, unit: "grams" };
  if (parsed.unit === "mg") return { amount: parsed.value, unit: "milligrams" };

  // Unknown unit -- return raw value
  return { amount: parsed.value, unit: "" };
}

/** Convert weight to the target UoM */
function convertAmount(parsed: ParsedWeight, targetUom: string): number {
  if (parsed.value === 0) return 0;

  if (targetUom === "grams") {
    if (parsed.unit === "g" || parsed.unit === "unknown") return parsed.value;
    if (parsed.unit === "mg") return parsed.value / 1000;
    if (parsed.unit === "oz") return parsed.value * 28.3495;
  }

  if (targetUom === "milligrams") {
    if (parsed.unit === "mg") return parsed.value;
    if (parsed.unit === "g" || parsed.unit === "unknown") return parsed.value * 1000;
    if (parsed.unit === "oz") return parsed.value * 28349.5;
  }

  return parsed.value;
}

/** Extract weight in grams from product name */
function extractGramsFromName(name: string): number {
  // Word-based weight phrases
  if (/\bfull\s*gram\b/i.test(name)) return 1;
  if (/\bhalf\s*gram\b/i.test(name)) return 0.5;

  const gramMatch = name.match(/(?:^|[\s\-–—])(\d*\.?\d+)\s*g\b/i);
  if (gramMatch) {
    const val = parseFloat(gramMatch[1]);
    if (!isNaN(val) && val > 0 && val <= 100) return val;
  }

  const mgMatch = name.match(/(\d+)\s*mg\b/i);
  if (mgMatch) {
    const mg = parseFloat(mgMatch[1]);
    if (!isNaN(mg) && mg >= 100) return mg / 1000;
  }

  // Fractional ounce names
  if (/\b1\/8\s*(oz|ounce)?\b/i.test(name) || /\beighth\b/i.test(name)) return 3.5;
  if (/\b(quarter|1\/4)\s*(oz|ounce)?\b/i.test(name)) return 7;
  if (/\bhalf\s*[-]?\s*(oz|ounce)\b/i.test(name) || /\b1\/2\s*(oz|ounce)?\b/i.test(name)) return 14;
  const nOzMatch = name.match(/\b(\d+)\s*(oz|ounce)s?\b/i);
  if (nOzMatch) return parseFloat(nOzMatch[1]) * 28;
  if (/\bounces?\b/i.test(name)) return 28;

  return 0;
}

// ── Unit Count ───────────────────────────────────────────────────────────────

const WORD_NUMBERS: Record<string, string> = {
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  twelve: "12",
  twenty: "20",
};

function extractUnitCount(productName: string): string {
  const name = productName;
  const packMatch = name.match(/(\d+)\s*[-/\s]?\s*(pack|pk|ct|count)\b/i);
  if (packMatch) return packMatch[1];
  const packNx = name.match(/\bpack\s*(?:of\s+)?(\d+)\s*x?\b/i);
  if (packNx) return packNx[1];
  const nxMatch = name.match(/\b(\d+)\s*x\b/i);
  if (nxMatch) return nxMatch[1];
  const xnMatch = name.match(/\bx\s*(\d+)\b/i);
  if (xnMatch) return xnMatch[1];
  const bracketMatch = name.match(/[([](\d+)[)\]]/);
  if (bracketMatch) {
    const num = parseInt(bracketMatch[1], 10);
    if (num >= 2 && num <= 100) return bracketMatch[1];
  }
  const npMatch = name.match(/\b(\d+)p\b/i);
  if (npMatch) return npMatch[1];
  const prerollMatch = name.match(/\b(\d+)\s*[-\s]?pre[\s-]?rolls?\b/i);
  if (prerollMatch) return prerollMatch[1];
  if (/\b(double|dual)\s*(pack)?\b/i.test(name)) return "2";
  if (/\btriple\s*(pack)?\b/i.test(name)) return "3";
  for (const [word, digit] of Object.entries(WORD_NUMBERS)) {
    const re = new RegExp(`\\b${word}\\s*[-\\s]?\\s*(pack|pk|ct|count)\\b`, "i");
    if (re.test(name)) return digit;
  }
  return "";
}

// ── Merchandise Size ─────────────────────────────────────────────────────────

function extractMerchSize(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes("6xl")) return "5XL";
  for (const size of ["5XL", "4XL", "3XL", "2XL", "XL", "XS"] as const) {
    if (lower.includes(size.toLowerCase())) return size;
  }
  if (/\bsmall\b/i.test(productName)) return "Small";
  if (/\bmedium\b|\bmed\b/i.test(productName)) return "Medium";
  if (/\blarge\b|\blg\b/i.test(productName)) return "Large";
  if (/\bone\s*size\b/i.test(productName)) return "One Size";
  return "One Size";
}

// ── Price Conversion ─────────────────────────────────────────────────────────

function priceToCents(raw: string): string {
  if (!raw) return "0";
  const cleaned = raw.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0";
  const cents = Math.round(num * 100);
  if (cents <= 0) return "0";
  return Math.min(cents, 99999999).toString();
}

// ── THC / CBD Parsing ────────────────────────────────────────────────────────

function parseCannaContent(raw: string, weightInGrams: number): string {
  if (!raw) return "";
  const cleaned = raw.replace(/,/g, "").trim();
  const mgPerG = cleaned.match(/^([\d.]+)\s*mg\s*\/\s*g/i);
  if (mgPerG) return (parseFloat(mgPerG[1]) * weightInGrams).toFixed(2);
  const mgMatch = cleaned.match(/^([\d.]+)\s*mg$/i);
  if (mgMatch) return parseFloat(mgMatch[1]).toFixed(2);
  const pctMatch = cleaned.match(/^([\d.]+)\s*%$/i);
  if (pctMatch) return ((parseFloat(pctMatch[1]) / 100) * weightInGrams * 1000).toFixed(2);
  const num = parseFloat(cleaned);
  if (!isNaN(num)) return num.toFixed(2);
  return "";
}

const MIN_CANNA_MG = 1;
const MAX_CANNA_MG = 5000;

/** Category-specific plausibility ceilings for mg amounts */
const CATEGORY_MAX_MG: Record<string, number> = {
  Edible: 1000,
  Beverage: 200,
  Topical: 500,
  Misc: 500,
  Pill: 500,
  Tincture: 2000,
};

function isPlausibleCannaMg(val: number): boolean {
  return val >= MIN_CANNA_MG && val <= MAX_CANNA_MG;
}

function bestCannaValue(columnValue: string, productName: string): string {
  const nameMg = extractMgFromName(productName);
  const colNum = parseFloat(columnValue);
  const nameNum = parseFloat(nameMg);
  const colValid = !isNaN(colNum) && colNum > 0;
  const nameValid = !isNaN(nameNum) && nameNum > 0;
  if (!columnValue || columnValue === "0.00" || !colValid) return nameMg;
  if (isPlausibleCannaMg(colNum)) {
    if (nameValid && nameNum > colNum * 10 && isPlausibleCannaMg(nameNum)) return nameMg;
    return columnValue;
  }
  if (nameValid && isPlausibleCannaMg(nameNum)) return nameMg;
  return columnValue;
}

function extractMgFromName(name: string): string {
  const match = name.match(/(\d+)\s*mg/i);
  return match ? match[1] : "";
}

// ── Subcategory Post-Processing ──────────────────────────────────────────────

function fixSubCategory(category: string, subCategory: string): string {
  const catLower = category.toLowerCase();
  const subLower = subCategory.toLowerCase();

  if (catLower === "tincture" && subLower === "distillate") return "Tincture - General";
  if (catLower === "merch" && subLower === "vape") return "Vaporizer";
  if (catLower === "merch" && subLower === "othr") return "Other";
  if (catLower === "cbd" && subLower === "chocolate") return "CBD - General";
  if (catLower === "edible" && subLower === "pod") return "Edible - General";
  if (catLower === "extract" && subLower === "510 thread") return "Extract - General";
  if (catLower === "extract" && subLower === "batter") return "Badder";
  if (catLower === "flower" && subLower === "infused") return "Infused Flower";

  if (["moon rocks", "accessory", "clothing"].includes(subLower)) {
    return `${category} - General`;
  }

  if (subCategory) return subCategory;
  return `${category} - General`;
}

function normalizeSubCategory(subCategory: string): string {
  if (!subCategory) return subCategory;
  const fullReplacements: [string, string][] = [
    ["Rso", "RSO"],
    ["Ccell", "CCELL"],
    ["Co2", "CO2"],
    ["Candy", "Hard Candy"],
  ];
  for (const [search, replace] of fullReplacements) {
    if (subCategory.toLowerCase() === search.toLowerCase()) return replace;
  }
  let result = subCategory;
  const subReplacements: [string, string][] = [
    ["Thc-A", "THC-A"],
    ["L.S 1St Press Rosin", "L.S 1st Press Rosin"],
    ["Fso", "Full Spectrum Oil"],
    ["Pax Era Pod", "Pax Pod"],
    ["Airgraft Pod", "Pod"],
    ["Oil Rig", "Dab Rig"],
    ["All-In-One", "All In One"],
    ["Hanu Pod", "Ready To Use"],
    ["Cbd", "CBD"],
  ];
  for (const [search, replace] of subReplacements) {
    const idx = result.toLowerCase().indexOf(search.toLowerCase());
    if (idx !== -1) {
      result = result.substring(0, idx) + replace + result.substring(idx + search.length);
    }
  }
  return result;
}

function blankIfZero(val: string): string {
  if (!val) return val;
  const num = parseFloat(val);
  if (!isNaN(num) && num === 0) return "";
  return val;
}

// ── Hide From Menu ───────────────────────────────────────────────────────────

function deriveHideFromMenu(
  availableOnline: string,
  productName: string,
  rawPrice: string,
): string {
  if (/\b(sample|promo)\b/i.test(productName)) return "TRUE";
  const priceNum = parseFloat(rawPrice.replace(/[$,\s]/g, ""));
  if (!isNaN(priceNum) && priceNum <= 0.1) return "TRUE";
  return availableOnline.toLowerCase() === "yes" ? "FALSE" : "TRUE";
}

// ── Derive Rows ──────────────────────────────────────────────────────────────

/**
 * Transform source rows + mappings into DerivedRow[] with normalized categories,
 * weights, classifications, and all derived fields.
 */
export function deriveRows(
  rows: Record<string, string>[],
  mappings: FieldMapping[],
  categoryResolutions?: Map<string, { category: string; subCategory: string }>,
): TransformResult {
  const fm = buildFieldMap(mappings);

  // Brand dedup + casing map
  const dedupedBrands = deduplicateBrands(rows, fm.brand);
  const brandCasingMap = buildBrandCasingMap(dedupedBrands);

  // Track category resolutions
  const resolutionMap = new Map<string, CategoryResolution>();

  const derivedRows: DerivedRow[] = rows.map((row) => {
    let rawId = getVal(row, fm, "productIdentifier");
    let rawName = getVal(row, fm, "productName");
    const rawBrand = getVal(row, fm, "brand");
    const rawCategory = getVal(row, fm, "productCategory");
    const rawSubCategory = getVal(row, fm, "productSubCategory");
    const rawExternalCategory = getVal(row, fm, "externalCategory");
    const rawStatus = getVal(row, fm, "status");
    const rawStrain = getVal(row, fm, "strain");
    const rawClassification = getVal(row, fm, "classification");
    const rawWeight = getVal(row, fm, "weight");
    const rawPrice = getVal(row, fm, "basePrice");
    const rawDescription =
      getVal(row, fm, "description") || (row["Alternate description"] ?? "").trim();
    const rawMenuTitle = getVal(row, fm, "menuTitle");
    const rawAvailOnline = getVal(row, fm, "availableOnline");
    const rawImage = getVal(row, fm, "imageFilename");
    const rawTHC = getVal(row, fm, "thc");
    const rawCBD = getVal(row, fm, "cbd");
    const rawTags = getVal(row, fm, "tags");
    const rawEffects = getVal(row, fm, "effects");
    const rawFlavor = getVal(row, fm, "flavor");
    const rawIngredients = getVal(row, fm, "ingredients");
    const rawVariantId = getVal(row, fm, "variantIdentifier");
    const rawPriceTier = getVal(row, fm, "priceTier");
    const rawPriceType = getVal(row, fm, "priceType");

    // Composite ID
    if (rawVariantId) rawId = `${rawId}-${rawVariantId}`;

    // MED/REC splitting
    const priceTypeUpper = rawPriceType.toUpperCase();
    if (priceTypeUpper === "MED") {
      rawName = `(Med) ${rawName}`;
      rawId = `${rawId}-MED`;
    } else if (priceTypeUpper === "REC") {
      rawName = `(Rec) ${rawName}`;
      rawId = `${rawId}-REC`;
    }

    // Category resolution
    const catKey = categoryKey({
      category: rawCategory,
      subCategory: rawSubCategory,
      externalCategory: rawExternalCategory,
    });
    const extraContext = Object.values(row).join(" ");
    const baseResolution =
      categoryResolutions?.get(catKey) ??
      enhancedCategoryResolve(
        rawCategory,
        rawSubCategory,
        rawExternalCategory,
        rawName,
        extraContext,
      );

    let finalResolution = applyNameOverride(
      baseResolution.category,
      baseResolution.subCategory,
      rawName,
    );

    // Brand→category fallback: when category resolution is weak (Other/Misc/empty),
    // use production data to infer category from brand name (≥95% confidence)
    if (
      (!finalResolution.category || finalResolution.category === "Other" || finalResolution.category === "Misc") &&
      rawBrand
    ) {
      const brandCat = lookupBrandCategory(rawBrand);
      if (brandCat) {
        const brandSub =
          resolveSubCategoryFromName(brandCat, rawName) ??
          getDefaultSubCategory(brandCat);
        finalResolution = { category: brandCat, subCategory: brandSub };
      }
    }

    // Non-cannabis flag: some POS exports have an explicit flag (e.g., IndicaOnline "Is MMJ?" = "N").
    // When present and negative, force to a non-THC category (CBD, Merch, or Non-Inv).
    const NON_CANNABIS_HEADERS = ["Is MMJ?", "Is MMJ", "is_mmj", "Is Cannabis", "Contains THC"];
    const CANNABIS_HEADERS = ["Is Marijuana", "Is Marijuana?", "is_marijuana"];
    const NON_CANNABIS_VALUES = new Set(["n", "no", "false", "0"]);
    const CANNABIS_VALUES = new Set(["y", "yes", "true", "1"]);
    const THC_CATEGORIES = new Set(["Flower", "Extract", "Cartridge", "Edible", "Preroll", "Beverage", "Tincture", "Topical", "Pill", "Misc"]);
    const NON_THC_CATEGORIES = new Set(["CBD", "Merch", "Non-Inv"]);

    let isNonCannabis = false;
    for (const header of NON_CANNABIS_HEADERS) {
      const val = (row[header] ?? "").trim().toLowerCase();
      if (val && NON_CANNABIS_VALUES.has(val)) {
        isNonCannabis = true;
        break;
      }
    }

    let isCannabis = false;
    for (const header of CANNABIS_HEADERS) {
      const val = (row[header] ?? "").trim().toLowerCase();
      if (val && CANNABIS_VALUES.has(val)) {
        isCannabis = true;
        break;
      }
    }

    // Cannabis products (Is Marijuana = YES) cannot go into CBD, Merch, or Non-Inv
    if (isCannabis && NON_THC_CATEGORIES.has(finalResolution.category)) {
      // Re-resolve from original source fields (not the already-resolved CBD/Merch result)
      const reResolved = enhancedCategoryResolve(
        rawCategory,
        rawSubCategory,
        rawExternalCategory,
        rawName,
        rawBrand,
      );
      if (THC_CATEGORIES.has(reResolved.category)) {
        finalResolution = reResolved;
      } else {
        // Fallback: default to Misc for cannabis products we can't classify
        finalResolution = { category: "Misc", subCategory: "Misc - General" };
      }
    }

    if (isNonCannabis && THC_CATEGORIES.has(finalResolution.category)) {
      // Re-route to non-THC category based on name/subcategory context
      const subLower = (finalResolution.subCategory || rawSubCategory).toLowerCase();
      if (/\b(gumm|chocolate|edible|cookie|brownie|mint|chew|candy)\b/i.test(rawName)) {
        finalResolution = { category: "CBD", subCategory: "Edible" };
      } else if (/\b(cream|creme|lotion|balm|salve|topical|patch)\b/i.test(rawName)) {
        finalResolution = { category: "CBD", subCategory: "Topical" };
      } else if (/\b(tincture|dropper|oil)\b/i.test(rawName)) {
        finalResolution = { category: "CBD", subCategory: "Tincture" };
      } else if (/\b(batter(y|ies)|pen|charger)\b/i.test(rawName) || subLower.includes("batter")) {
        finalResolution = { category: "Merch", subCategory: "Battery" };
      } else if (/\b(pipe|grinder|paper|cone|tray|lighter|bong|rig|glass)\b/i.test(rawName) || subLower.includes("accessor")) {
        finalResolution = { category: "Merch", subCategory: resolveSubCategoryFromName("Merch", rawName) ?? "Merch - General" };
      } else {
        // Default: CBD - General for non-cannabis products we can't further classify
        finalResolution = { category: "CBD", subCategory: "CBD - General" };
      }
    }

    const category = finalResolution.category;

    // Name-based subcategory refinement, with brand fallback
    const nameSubCat = resolveSubCategoryFromName(category, rawName);
    const brandSubCat = !nameSubCat && rawBrand
      ? lookupBrandSubcategory(rawBrand, category)
      : null;
    const subCategory = normalizeSubCategory(
      fixSubCategory(category, nameSubCat ?? brandSubCat ?? finalResolution.subCategory),
    );

    const isExcluded =
      category === EXCLUDED_CATEGORY || !category || !rawName || /^payment\s*fee$/i.test(rawName);
    const excludeReason = isExcluded
      ? category === EXCLUDED_CATEGORY
        ? "Category excluded (sample/display)"
        : !rawName
          ? "Missing product name"
          : !category
            ? "Could not resolve category"
            : "Excluded product (payment fee)"
      : "";
    const uom = isExcluded ? "each" : (UOM_BY_CATEGORY[category] ?? "each");

    // Track resolution
    if (!resolutionMap.has(catKey)) {
      const merchSize = category === "Merch" ? extractMerchSize(rawName) : "";
      resolutionMap.set(catKey, { category, subCategory, uom, merchSize });
    }

    // Weight parsing — use externalCategory as unit hint (e.g., Blaze "Custom Weight Type" = "mg")
    let parsed = internalParseWeight(rawWeight);
    if (parsed.unit === "unknown" && parsed.value > 0) {
      const unitHint = rawExternalCategory.toLowerCase().trim();
      if (unitHint === "mg" || unitHint === "milligram" || unitHint === "milligrams") {
        parsed = { value: parsed.value, unit: "mg" };
      } else if (unitHint === "g" || unitHint === "gram" || unitHint === "grams") {
        parsed = { value: parsed.value, unit: "g" };
      }
      // For gram-based categories: if plain number > 100, likely mg (e.g., Meadow "Cannabis Content" = 1000)
      if (
        parsed.unit === "unknown" &&
        parsed.value > 100 &&
        (uom === "grams")
      ) {
        parsed = { value: parsed.value, unit: "mg" };
      }
    }
    // weightInGrams should be empty when UOM is milligrams (per review feedback)
    const weightInGrams = uom === "milligrams" ? 0 : getWeightInGramsInternal(parsed);

    // THC/CBD — only populated for milligram-based products (not grams)
    let thc = "";
    let cbd = "";
    if (uom === "milligrams") {
      if (category !== "CBD") {
        thc = parseCannaContent(rawTHC, getWeightInGramsInternal(parsed));
        thc = bestCannaValue(thc, rawName);
      }
      cbd = parseCannaContent(rawCBD, getWeightInGramsInternal(parsed));
    }
    // THC/amount sync happens after amount calculation (below)

    // Amount
    const MAX_AMOUNT = 999999.9999;
    let amount: number;
    if (uom === "grams") {
      if (subCategory === "Bulk Flower") {
        amount = 1;
      } else {
        amount = convertAmount(parsed, uom);
        if (amount <= 0) amount = extractGramsFromName(rawName);
      }
    } else if (uom === "milligrams") {
      const cannaVal = category === "CBD" ? cbd : thc;
      const num = parseFloat(cannaVal);
      const catCeiling = CATEGORY_MAX_MG[category];
      // Use cannabinoid value as amount, but only if plausible for this category.
      // When THC/CBD is implausible (e.g., "9000" from a bad THC% column) and
      // weight is valid, prefer weight as the amount source.
      const cannaPlausible = !isNaN(num) && num > 0 && (!catCeiling || num <= catCeiling);
      if (cannaPlausible) {
        amount = num;
      } else {
        amount = 0;
      }
      // Fallback: use raw weight as mg amount.
      // For unknown-unit values, treat directly as mg (not grams) to avoid overflow.
      // E.g., Meadow "Cannabis Content" = 1000 means 1000mg, not 1000g.
      if (amount <= 0 && parsed.value > 0) {
        if (parsed.unit === "mg" || parsed.unit === "unknown") {
          amount = parsed.value;
        } else {
          amount = getWeightInGramsInternal(parsed) * 1000;
        }
      }
      if (amount <= 0) {
        const mgStr = extractMgFromName(rawName);
        const mgVal = parseFloat(mgStr);
        if (!isNaN(mgVal) && mgVal > 0) amount = mgVal;
      }
    } else {
      amount = category === "Non-Inv" || category === "Plant" ? 1 : convertAmount(parsed, uom);
    }

    if (amount > MAX_AMOUNT) {
      if (uom === "grams") {
        const nameAmount = extractGramsFromName(rawName);
        amount = nameAmount > 0 && nameAmount <= MAX_AMOUNT ? nameAmount : 0;
      } else if (uom === "milligrams") {
        const mgStr = extractMgFromName(rawName);
        const mgVal = parseFloat(mgStr);
        amount = !isNaN(mgVal) && mgVal > 0 && mgVal <= MAX_AMOUNT ? mgVal : 0;
      } else {
        amount = 0;
      }
    }

    // Category-specific plausibility: when amount exceeds category ceiling,
    // prefer name-extracted mg value. E.g., edible with 5600mg (from weight)
    // should use 100mg from name instead. Oz-based weights for topicals/misc
    // are net product weight, not cannabinoid content.
    const catMax = CATEGORY_MAX_MG[category];
    if (uom === "milligrams" && catMax && amount > catMax) {
      const nameMg = parseFloat(extractMgFromName(rawName));
      if (!isNaN(nameMg) && nameMg > 0 && nameMg <= catMax) {
        amount = nameMg;
      } else if (parsed.unit === "oz" || amount > catMax * 5) {
        // oz weight is liquid volume for topicals/misc, not THC — blank for review
        amount = 0;
      }
    }

    // Sync THC/CBD with amount for milligram products:
    // - THC should equal amount for non-CBD cannabis products
    // - CBD should equal amount for CBD category products
    // - Both should be blank for gram-based products
    // - Implausible THC/CBD values (exceeding category ceiling) are replaced by amount
    if (uom === "milligrams") {
      if (category !== "CBD") {
        const thcNum = parseFloat(thc);
        if (catMax && thcNum > catMax) {
          thc = amount > 0 ? amount.toString() : "";
        } else if (!thc && amount > 0) {
          thc = amount.toString();
        }
      }
      if (category === "CBD") {
        const cbdNum = parseFloat(cbd);
        if (catMax && cbdNum > catMax) {
          cbd = amount > 0 ? amount.toString() : "";
        } else if (!cbd && amount > 0) {
          cbd = amount.toString();
        }
      }
    }
    // Ensure THC/CBD are blank for grams-based products (cleanup after category overrides)
    if (uom === "grams") {
      thc = "";
      cbd = "";
    }
    thc = blankIfZero(thc);
    cbd = blankIfZero(cbd);

    // Brand with corrected casing + normalization from production data
    let brand =
      rawBrand && !PLACEHOLDER_BRANDS.has(rawBrand.toLowerCase())
        ? (brandCasingMap.get(rawBrand.toLowerCase()) ?? rawBrand)
        : "";
    if (brand) {
      brand = normalizeBrandName(brand);
    }

    const totalFlowerWeight = blankIfZero(uom === "grams" ? amount.toString() : "");
    const totalConcentrateWeight = blankIfZero(
      subCategory.toLowerCase().includes("infused") ? "0" : "",
    );

    return {
      excluded: isExcluded,
      excludeReason,
      productId: `P - ${rawId}`,
      productName: rawName,
      brand,
      category,
      subCategory,
      status: deriveStatus(rawStatus),
      strain: rawStrain,
      classification:
        normalizeClassification(rawClassification, rawName, rawDescription) ||
        normalizeClassification(rawExternalCategory, rawName, rawDescription) ||
        lookupStrainClassification(rawStrain) ||
        "",
      extractionMethod: deriveExtractionMethod(rawName, rawDescription),
      uom,
      amount,
      weightInGrams,
      unitCount:
        category === "Preroll" || category === "Beverage" ? extractUnitCount(rawName) || "1" : "",
      merchSize: category === "Merch" ? extractMerchSize(rawName) : "",
      skuBarcode: rawId,
      basePrice: priceToCents(rawPrice),
      description: rawDescription,
      menuTitle: rawMenuTitle,
      hideFromMenu: deriveHideFromMenu(rawAvailOnline, rawName, rawPrice),
      totalFlowerWeight,
      totalConcentrateWeight,
      thc,
      cbd,
      tags: rawTags,
      effects: rawEffects,
      flavor: rawFlavor,
      ingredients: rawIngredients,
      imageFilename: rawImage,
      priceTier: rawPriceTier,
    };
  });

  return { derivedRows, categoryResolutions: resolutionMap };
}

function getWeightInGramsInternal(parsed: ParsedWeight): number {
  if (parsed.unit === "g" || parsed.unit === "unknown") return parsed.value;
  if (parsed.unit === "mg") return parsed.value / 1000;
  if (parsed.unit === "oz") return parsed.value * 28.3495;
  return parsed.value;
}

// ── Apply Fixes ──────────────────────────────────────────────────────────────

/**
 * Apply user fixes to derived rows. When category changes, cascades to update
 * subCategory (default for new category), uom, and merchSize.
 */
export function applyFixes(derived: DerivedRow[], fixes: RowFix[]): DerivedRow[] {
  if (fixes.length === 0) return derived;

  const fixMap = new Map<number, Map<string, string>>();
  for (const fix of fixes) {
    if (!fixMap.has(fix.rowIndex)) fixMap.set(fix.rowIndex, new Map());
    fixMap.get(fix.rowIndex)!.set(fix.field, fix.newValue);
  }

  return derived.map((row, idx) => {
    const rowFixes = fixMap.get(idx);
    if (!rowFixes) return row;

    const updated = { ...row };

    for (const [field, value] of rowFixes) {
      if (field === "category") {
        updated.category = value;
        const subCatFix = rowFixes.get("subCategory");
        if (!subCatFix) {
          updated.subCategory = getDefaultSubCategory(value);
        }
        updated.uom = UOM_BY_CATEGORY[value] ?? "each";
        updated.merchSize = value === "Merch" ? extractMerchSize(updated.productName) : "";
      } else if (field === "subCategory") {
        updated.subCategory = value;
      } else if (field === "classification") {
        updated.classification = value;
      } else if (field === "status") {
        updated.status = value;
      } else if (field === "uom") {
        updated.uom = value;
      } else if (field === "merchSize") {
        updated.merchSize = value;
      } else if (field === "productName") {
        updated.productName = value;
      } else if (field === "productId") {
        updated.productId = value;
      } else if (field === "amount") {
        updated.amount = parseFloat(value) || 0;
      }
    }

    return updated;
  });
}
