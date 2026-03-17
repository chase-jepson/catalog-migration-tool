/**
 * Production catalog reference data derived from 407 Treez orgs / 6.3M products.
 * Used as fallback lookups when source data is incomplete.
 *
 * Generated from: /Users/chase/Code/migration-reference-docs/
 * - brand-category-raw.csv → brandCategory (507 brands, ≥95% confidence)
 * - brand-normalization-raw.csv → brandNormalization (4,349 variant→canonical mappings)
 * - strain-classification-raw.csv → strainClassification (427 strains, ≥90% confidence)
 */
import data from "./reference-data.json";

const brandCategoryMap = new Map<string, string>(
  Object.entries(data.brandCategory),
);

const brandNormMap = new Map<string, string>(
  Object.entries(data.brandNormalization),
);

const strainClassMap = new Map<string, string>(
  Object.entries(data.strainClassification),
);

/**
 * Look up the most likely category for a brand name.
 * Returns the category (e.g., "Edible", "Cartridge") or null if unknown.
 * Uses production data where the brand has ≥95% of products in one category.
 */
export function lookupBrandCategory(brand: string): string | null {
  if (!brand) return null;
  const upper = brand.toUpperCase().trim();
  return brandCategoryMap.get(upper) ?? null;
}

/**
 * Normalize a brand name to its canonical spelling.
 * E.g., "Raw Garden" → "RAW GARDEN", "COLDFIRE EXTRACTS" → "COLDFIRE"
 * Returns the canonical name or the original if no normalization found.
 */
export function normalizeBrandName(brand: string): string {
  if (!brand) return brand;
  const upper = brand.toUpperCase().trim();
  return brandNormMap.get(upper) ?? brand;
}

/**
 * Look up the classification for a strain name.
 * Returns "Sativa", "Indica", "Hybrid", etc. or null if unknown.
 * Uses production data where the strain has ≥90% consensus on classification.
 */
export function lookupStrainClassification(strain: string): string | null {
  if (!strain) return null;
  const upper = strain.toUpperCase().trim();
  return strainClassMap.get(upper) ?? null;
}
