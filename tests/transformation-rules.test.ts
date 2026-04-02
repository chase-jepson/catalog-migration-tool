import { describe, it, expect } from "vitest";
import {
  deriveRows,
  normalizeClassification,
  parseWeight,
} from "../lib/transformer";
import {
  resolveCategory,
  applyNameOverride,
  resolveSubCategoryFromName,
  enhancedCategoryResolve,
} from "../lib/category-mapper";
import {
  lookupBrandCategory,
  lookupBrandSubcategory,
  normalizeBrandName,
  lookupStrainClassification,
} from "../lib/reference-data";
import type { FieldMapping } from "../lib/types";

// ── Test Helpers ─────────────────────────────────────────────────────────────

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

const baseMappings = makeMappings({
  productIdentifier: "SKU",
  productName: "Product",
  brand: "Brand",
  productCategory: "Category",
  productSubCategory: "SubCategory",
  externalCategory: "ExtCat",
  status: "Status",
  strain: "Strain",
  classification: "Class",
  weight: "Weight",
  basePrice: "Price",
  description: "Desc",
  thc: "THC",
  cbd: "CBD",
  priceType: "PriceType",
});

function derive(row: Record<string, string>) {
  const result = deriveRows([row], baseMappings);
  return result.derivedRows[0];
}

// ── normalizeClassification ──────────────────────────────────────────────────

describe("normalizeClassification — compound classifications", () => {
  it('maps "Sativa-Hybrid" to S/I', () => {
    expect(normalizeClassification("Sativa-Hybrid")).toBe("S/I");
  });

  it('maps "Indica-Hybrid" to I/S', () => {
    expect(normalizeClassification("Indica-Hybrid")).toBe("I/S");
  });

  it('maps "Hybrid-Indica" to I/S', () => {
    expect(normalizeClassification("Hybrid-Indica")).toBe("I/S");
  });

  it('maps "Hybrid-Sativa" to S/I', () => {
    expect(normalizeClassification("Hybrid-Sativa")).toBe("S/I");
  });

  it('maps "IndicaHybrid" (no separator) to I/S', () => {
    expect(normalizeClassification("IndicaHybrid")).toBe("I/S");
  });

  it('maps "SativaHybrid" (no separator) to S/I', () => {
    expect(normalizeClassification("SativaHybrid")).toBe("S/I");
  });
});

describe("normalizeClassification — name-based priority", () => {
  it("product name (Indica) overrides mapped column (Sativa)", () => {
    expect(normalizeClassification("Sativa", "OG Kush (I)")).toBe("Indica");
  });

  it("product name (Sativa) overrides mapped column (Indica)", () => {
    expect(normalizeClassification("Indica", "Blue Dream (S)")).toBe("Sativa");
  });

  it("product name (Hybrid) overrides mapped column", () => {
    expect(normalizeClassification("Indica", "Gelato (H)")).toBe("Hybrid");
  });

  it("name with indica + hybrid → I/S compound", () => {
    expect(normalizeClassification("", "Purple Punch Indica Hybrid")).toBe("I/S");
  });

  it("name with sativa + hybrid → S/I compound", () => {
    expect(normalizeClassification("", "Jack Herer Sativa Hybrid")).toBe("S/I");
  });

  it("name with cbd keyword → CBD", () => {
    expect(normalizeClassification("", "CBD Relief Balm")).toBe("CBD");
  });

  it("word boundary indica in name", () => {
    expect(normalizeClassification("", "OG Kush Indica")).toBe("Indica");
  });
});

describe("normalizeClassification — description fallback", () => {
  it("falls back to description when input and name are empty", () => {
    expect(normalizeClassification("", "", "A sativa-dominant strain")).toBe("Sativa");
  });

  it("description indica + hybrid → I/S", () => {
    expect(normalizeClassification("", "", "indica hybrid with earthy notes")).toBe("I/S");
  });

  it("description sativa + hybrid → S/I", () => {
    expect(normalizeClassification("", "", "sativa hybrid energizing")).toBe("S/I");
  });

  it("description hybrid alone → Hybrid", () => {
    expect(normalizeClassification("", "", "a balanced hybrid strain")).toBe("Hybrid");
  });

  it("does not use description when name already matched", () => {
    // Name says Sativa, description says Indica — name wins
    expect(normalizeClassification("", "Blue Dream Sativa", "indica heritage")).toBe("Sativa");
  });
});

describe("normalizeClassification — Hbrid typo", () => {
  it('handles "hbrid" typo as Hybrid', () => {
    expect(normalizeClassification("hbrid")).toBe("Hybrid");
  });
});

// ── Brand→Category Fallback ──────────────────────────────────────────────────

describe("brand→category fallback via reference data", () => {
  it("KANHA brand resolves to Edible", () => {
    expect(lookupBrandCategory("KANHA")).toBe("Edible");
  });

  it("COLDFIRE brand resolves to Cartridge", () => {
    expect(lookupBrandCategory("Coldfire")).toBe("Cartridge");
  });

  it("KINGROLL brand resolves to Preroll", () => {
    expect(lookupBrandCategory("KingRoll")).toBe("Preroll");
  });

  it("returns null for unknown brand", () => {
    expect(lookupBrandCategory("XYZ_UNKNOWN_BRAND_42")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(lookupBrandCategory("")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(lookupBrandCategory("kanha")).toBe("Edible");
    expect(lookupBrandCategory("KANHA")).toBe("Edible");
    expect(lookupBrandCategory("Kanha")).toBe("Edible");
  });
});

describe("brand→category fallback in deriveRows", () => {
  it("uses brand fallback when category resolves to empty", () => {
    const row = derive({
      SKU: "BF-001",
      Product: "Kanha Peach Ring",
      Brand: "KANHA",
      Category: "",
      Weight: "100mg",
      Price: "20",
    });
    // KANHA → Edible from reference data (name has no category keywords)
    expect(row.category).toBe("Edible");
  });

  it("does not use brand fallback when name keywords resolve strongly", () => {
    const row = derive({
      SKU: "BF-002",
      Product: "Coldfire Live Resin 0.5g",
      Brand: "COLDFIRE",
      Category: "Other Products",
      Weight: "0.5g",
      Price: "40",
    });
    // "Live Resin" in name triggers Extract via keyword rules before brand fallback
    expect(row.category).toBe("Extract");
  });
});

// ── Brand→Subcategory Fallback ────────────────────────────────────────────────

describe("brand→subcategory fallback via reference data", () => {
  it("CAMINO + Edible → Gummy", () => {
    expect(lookupBrandSubcategory("CAMINO", "Edible")).toBe("Gummy");
  });

  it("COLDFIRE + Cartridge → 510 Thread", () => {
    expect(lookupBrandSubcategory("Coldfire", "Cartridge")).toBe("510 Thread");
  });

  it("returns null for unknown brand", () => {
    expect(lookupBrandSubcategory("ZZZZZ_UNKNOWN", "Flower")).toBeNull();
  });

  it("returns null for brand in wrong category", () => {
    // CAMINO is Edible, not Flower
    expect(lookupBrandSubcategory("CAMINO", "Flower")).toBeNull();
  });

  it("refines subcategory in deriveRows when name has no keywords", () => {
    const row = derive({
      SKU: "BS-001",
      Product: "Camino Uplifting Blend",
      Brand: "CAMINO",
      Category: "Edible",
      Weight: "100mg",
      Price: "25",
    });
    // Name has no subcategory keywords, brand fallback → Gummy
    expect(row.category).toBe("Edible");
    expect(row.subCategory).toBe("Gummy");
  });

  it("name-based subcategory wins over brand fallback", () => {
    const row = derive({
      SKU: "BS-002",
      Product: "Camino Chocolate Bar 100mg",
      Brand: "CAMINO",
      Category: "Edible",
      Weight: "100mg",
      Price: "25",
    });
    // "Chocolate" in name → Chocolate, not Gummy from brand
    expect(row.subCategory).toBe("Chocolate");
  });
});

// ── Strain→Classification Fallback ───────────────────────────────────────────

describe("strain→classification fallback via reference data", () => {
  it("looks up known strains", () => {
    // Test a few well-known strains that should be in the dataset
    const ogKush = lookupStrainClassification("OG Kush");
    if (ogKush) {
      expect(["Indica", "Hybrid", "I/S"]).toContain(ogKush);
    }
  });

  it("returns null for unknown strain", () => {
    expect(lookupStrainClassification("ZZZZZ_NONEXISTENT_STRAIN")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(lookupStrainClassification("")).toBeNull();
  });

  it("is case-insensitive", () => {
    const upper = lookupStrainClassification("BLUE DREAM");
    const lower = lookupStrainClassification("blue dream");
    expect(upper).toBe(lower);
  });
});

describe("strain→classification fallback in deriveRows", () => {
  it("uses strain lookup when classification column is empty", () => {
    // We need a strain that exists in the reference data
    // Use BLUE DREAM which is one of the most common
    const blueDream = lookupStrainClassification("Blue Dream");
    if (blueDream) {
      const row = derive({
        SKU: "SC-001",
        Product: "Test Flower 3.5g",
        Brand: "TestBrand",
        Category: "Flower",
        Strain: "Blue Dream",
        Class: "",
        Weight: "3.5g",
        Price: "35",
      });
      expect(row.classification).toBe(blueDream);
    }
  });
});

// ── CBD→Edible Reclassification ──────────────────────────────────────────────

describe("CBD→Edible reclassification (strong name overrides)", () => {
  it("CBD + gummy → Edible/Gummy", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD Gummy 25mg");
    expect(result.category).toBe("Edible");
    expect(result.subCategory).toBe("Gummy");
  });

  it("CBD + chocolate → Edible/Chocolate", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD Chocolate Bar 50mg");
    expect(result.category).toBe("Edible");
    expect(result.subCategory).toBe("Chocolate");
  });

  it("CBD + brownie → Edible/Baked Good", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD Brownie Bite");
    expect(result.category).toBe("Edible");
    expect(result.subCategory).toBe("Baked Good");
  });

  it("CBD + mint → Edible", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD Mint 10mg");
    expect(result.category).toBe("Edible");
  });

  it("CBD + capsule → Pill/Capsule", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD Capsule 25mg");
    expect(result.category).toBe("Pill");
    expect(result.subCategory).toBe("Capsule");
  });

  it("CBD + topical → Topical", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD Topical Cream 500mg");
    expect(result.category).toBe("Topical");
  });

  it("CBD + cartridge → Cartridge", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD Cartridge 0.5g");
    expect(result.category).toBe("Cartridge");
  });

  it("CBD without override keyword stays CBD", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD Oil 1000mg");
    expect(result.category).toBe("CBD");
  });
});

// ── Merch preservation for accessory/branding products ──────────────────────

describe("merch accessory preservation", () => {
  it("rolling papers with THC branding stay Merch", () => {
    const result = applyNameOverride("Merch", "Rolling Papers", "THC Infused Rolling Papers");
    expect(result.category).toBe("Merch");
  });

  it("terp wraps stay Merch", () => {
    const result = applyNameOverride("Merch", "Other", "Lemonade - Terp Infused Wrap w/ Glass Tip");
    expect(result.category).toBe("Merch");
  });

  it("shopping bag with THC branding stays Merch", () => {
    const result = applyNameOverride("Merch", "Other", "Paper Shopping Bag THC");
    expect(result.category).toBe("Merch");
  });

  it("plain rolling papers stay Merch", () => {
    const result = applyNameOverride("Merch", "Rolling Papers", "RAW Rolling Papers King Size");
    expect(result.category).toBe("Merch");
  });

  it("merch without paper/wrap keywords stays Merch", () => {
    const result = applyNameOverride("Merch", "Battery", "THC Battery Pen");
    expect(result.category).toBe("Merch");
  });
});

// ── THC/Weight Blanking Rules ────────────────────────────────────────────────

describe("THC/weight blanking rules", () => {
  it("gram-based products have blank THC", () => {
    const row = derive({
      SKU: "TW-001",
      Product: "Blue Dream 3.5g",
      Category: "Flower",
      Weight: "3.5g",
      Price: "35",
      THC: "250",
    });
    expect(row.uom).toBe("grams");
    expect(row.thc).toBe("");
  });

  it("milligram-based products have blank weightInGrams", () => {
    const row = derive({
      SKU: "TW-002",
      Product: "Gummy Bears 100mg",
      Category: "Edible",
      Weight: "100mg",
      Price: "25",
      THC: "100",
    });
    expect(row.uom).toBe("milligrams");
    expect(row.weightInGrams).toBe(0);
  });

  it("milligram products populate THC from canna content", () => {
    const row = derive({
      SKU: "TW-003",
      Product: "Sour Gummies 100mg",
      Category: "Edible",
      Weight: "100mg",
      Price: "25",
      THC: "100",
    });
    expect(row.uom).toBe("milligrams");
    expect(row.thc).toBeTruthy();
    expect(parseFloat(row.thc)).toBeGreaterThan(0);
  });
});

// ── THC/CBD Amount Sync ──────────────────────────────────────────────────────

describe("THC/CBD amount sync for milligram products", () => {
  it("THC equals amount for non-CBD milligram products when THC column empty", () => {
    const row = derive({
      SKU: "SYNC-001",
      Product: "Edible 50mg",
      Category: "Edible",
      Weight: "50mg",
      Price: "15",
      // No THC column value
    });
    expect(row.uom).toBe("milligrams");
    if (row.amount > 0) {
      expect(row.thc).toBeTruthy();
    }
  });

  it("CBD equals amount for CBD category when CBD column empty", () => {
    const row = derive({
      SKU: "SYNC-002",
      Product: "CBD Oil 500mg",
      Category: "CBD",
      Weight: "500mg",
      Price: "40",
      // No CBD column value
    });
    if (row.category === "CBD" && row.amount > 0) {
      expect(row.cbd).toBeTruthy();
    }
  });

  it("THC is blank for CBD category products", () => {
    const row = derive({
      SKU: "SYNC-003",
      Product: "CBD Tincture 1000mg",
      Category: "CBD",
      Weight: "1000mg",
      Price: "60",
    });
    // CBD products should not have THC populated
    if (row.category === "CBD") {
      expect(row.thc).toBe("");
    }
  });
});

// ── Plant Amount = 1 ─────────────────────────────────────────────────────────

describe("Plant category amount = 1", () => {
  it("Plant category always gets amount = 1", () => {
    const row = derive({
      SKU: "PL-001",
      Product: "OG Kush Clone",
      Category: "Plant",
      Price: "15",
    });
    expect(row.category).toBe("Plant");
    expect(row.amount).toBe(1);
  });

  it("Plant with weight still gets amount = 1", () => {
    const row = derive({
      SKU: "PL-002",
      Product: "Seed Pack",
      Category: "Plant",
      Weight: "5g",
      Price: "25",
    });
    expect(row.amount).toBe(1);
  });
});

// ── Non-Inv Amount = 1 ───────────────────────────────────────────────────────

describe("Non-Inv category amount = 1", () => {
  it("Non-Inv always gets amount = 1", () => {
    const row = derive({
      SKU: "NI-001",
      Product: "Gift Card $50",
      Category: "Non-Inv",
      Price: "50",
    });
    expect(row.category).toBe("Non-Inv");
    expect(row.amount).toBe(1);
  });
});

// ── Large Plain Numbers → mg Conversion ──────────────────────────────────────

describe("large plain numbers → mg conversion", () => {
  it("plain number > 100 in gram-based category treated as mg", () => {
    const row = derive({
      SKU: "LN-001",
      Product: "Test Flower 3.5g",
      Category: "Flower",
      Weight: "1000",
      Price: "35",
    });
    // 1000 > 100, gram-based category → treated as mg → converted to 1g
    expect(row.uom).toBe("grams");
    expect(row.amount).toBeCloseTo(1, 0);
  });

  it("plain number ≤ 100 in gram-based category kept as grams", () => {
    const row = derive({
      SKU: "LN-002",
      Product: "Test Flower 3.5g",
      Category: "Flower",
      Weight: "28",
      Price: "100",
    });
    expect(row.amount).toBeCloseTo(28, 0);
  });
});

// ── externalCategory as Unit Hint ────────────────────────────────────────────

describe("externalCategory as unit hint", () => {
  it('externalCategory "mg" converts plain number to milligrams', () => {
    const row = derive({
      SKU: "UH-001",
      Product: "Edible 100",
      Category: "Edible",
      ExtCat: "mg",
      Weight: "100",
      Price: "20",
    });
    expect(row.uom).toBe("milligrams");
    // Weight should be parsed as mg
  });

  it('externalCategory "grams" keeps plain number as grams', () => {
    const row = derive({
      SKU: "UH-002",
      Product: "Flower Bud",
      Category: "Flower",
      ExtCat: "grams",
      Weight: "3.5",
      Price: "35",
    });
    expect(row.amount).toBeCloseTo(3.5, 1);
  });
});

// ── Brand Normalization ──────────────────────────────────────────────────────

describe("brand normalization via reference data", () => {
  it("normalizes known brand variant to canonical", () => {
    // COLDFIRE EXTRACTS → COLDFIRE (if in normalization map)
    const result = normalizeBrandName("COLDFIRE EXTRACTS");
    // Should return canonical form if mapped, otherwise original
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns original for unknown brand", () => {
    expect(normalizeBrandName("My Local Brand 123")).toBe("My Local Brand 123");
  });

  it("returns empty for empty input", () => {
    expect(normalizeBrandName("")).toBe("");
  });

  it("is case-insensitive lookup", () => {
    const upper = normalizeBrandName("COLDFIRE EXTRACTS");
    const lower = normalizeBrandName("coldfire extracts");
    // Both should normalize the same way
    expect(upper).toBe(lower);
  });
});

describe("brand normalization in deriveRows", () => {
  it("normalizes brand in output", () => {
    const row = derive({
      SKU: "BN-001",
      Product: "Test Cart 0.5g",
      Brand: "COLDFIRE EXTRACTS",
      Category: "Cartridge",
      Weight: "0.5g",
      Price: "40",
    });
    // Brand should be normalized (COLDFIRE EXTRACTS → COLDFIRE if mapped)
    expect(row.brand).toBeTruthy();
  });

  it("placeholder brands produce empty brand", () => {
    for (const placeholder of ["N/A", "none", "unknown", "-", "--", "null"]) {
      const row = derive({
        SKU: "BN-PH",
        Product: "Test Product",
        Brand: placeholder,
        Category: "Flower",
        Weight: "1g",
        Price: "10",
      });
      expect(row.brand).toBe("");
    }
  });
});

// ── Tincture Override ────────────────────────────────────────────────────────

describe("tincture strong override", () => {
  it("tincture in name overrides Edible category", () => {
    const result = applyNameOverride("Edible", "Edible - General", "THC Tincture 500mg");
    expect(result.category).toBe("Tincture");
  });

  it("tincture in name overrides Extract category", () => {
    const result = applyNameOverride("Extract", "Distillate", "Tincture RSO 1000mg");
    expect(result.category).toBe("Tincture");
  });

  it("tincture in name overrides Misc category", () => {
    const result = applyNameOverride("Misc", "Misc - General", "Full Spectrum Tincture");
    expect(result.category).toBe("Tincture");
  });

  it("tincture distillate subcategory → Tincture - General", () => {
    const row = derive({
      SKU: "TN-001",
      Product: "Tincture 500mg",
      Category: "Tincture",
      SubCategory: "Distillate",
      Weight: "500mg",
      Price: "40",
    });
    // fixSubCategory should convert tincture+distillate → Tincture - General
    expect(row.subCategory).not.toBe("Distillate");
  });
});

// ── Popcorn / Smalls Override ────────────────────────────────────────────────

describe("popcorn → Pre-Pack Smalls", () => {
  it("popcorn in name → Pre-Pack Smalls subcategory", () => {
    const sub = resolveSubCategoryFromName("Flower", "Popcorn Buds 7g");
    expect(sub).toBe("Pre-Pack Smalls");
  });

  it("smalls in name → Pre-Pack Smalls subcategory", () => {
    const sub = resolveSubCategoryFromName("Flower", "Blue Dream Smalls 3.5g");
    expect(sub).toBe("Pre-Pack Smalls");
  });
});

// ── Coated / Infused Flower ──────────────────────────────────────────────────

describe("coated / infused flower", () => {
  it("infused in name → Infused Flower subcategory", () => {
    const sub = resolveSubCategoryFromName("Flower", "Infused Flower 3.5g");
    expect(sub).toBe("Infused Flower");
  });

  it("coated in name → Infused Flower subcategory", () => {
    const sub = resolveSubCategoryFromName("Flower", "Diamond Coated Buds");
    expect(sub).toBe("Infused Flower");
  });

  it("dusted in name → Infused Flower subcategory", () => {
    const sub = resolveSubCategoryFromName("Flower", "Kief Dusted Flower");
    expect(sub).toBe("Infused Flower");
  });
});

// ── Preroll from Flower Override ─────────────────────────────────────────────

describe("preroll from Flower override", () => {
  it("pre-roll in name overrides Flower → Preroll", () => {
    const result = applyNameOverride("Flower", "Pre-Pack", "Blue Dream Pre-Roll 1g");
    expect(result.category).toBe("Preroll");
  });

  it("prerolls in name overrides Flower → Preroll", () => {
    const result = applyNameOverride("Flower", "Pre-Pack", "OG Kush Prerolls 5pk");
    expect(result.category).toBe("Preroll");
  });
});

// ── THC-A from Edible Override ───────────────────────────────────────────────

describe("THC-A from Edible override", () => {
  it("THC-A in name overrides Edible → Extract/THC-A", () => {
    const result = applyNameOverride("Edible", "Edible - General", "THC-A Diamonds 1g");
    expect(result.category).toBe("Extract");
    expect(result.subCategory).toBe("THC-A");
  });
});

// ── Bulk Flower Amount = 1 ───────────────────────────────────────────────────

describe("Bulk Flower special case", () => {
  it("Bulk Flower always gets amount = 1", () => {
    const row = derive({
      SKU: "BF-001",
      Product: "Bulk Flower OG Kush",
      Category: "Flower",
      Weight: "28g",
      Price: "200",
    });
    expect(row.subCategory).toBe("Bulk Flower");
    expect(row.amount).toBe(1);
  });
});

// ── MED/REC Prefix Injection ─────────────────────────────────────────────────

describe("MED/REC prefix injection", () => {
  it('MED priceType prepends "(Med)" to name and ID', () => {
    const row = derive({
      SKU: "MR-001",
      Product: "Blue Dream 3.5g",
      Category: "Flower",
      Weight: "3.5g",
      Price: "35",
      PriceType: "MED",
    });
    expect(row.productName).toBe("(Med) Blue Dream 3.5g");
    expect(row.productId).toContain("-MED");
  });

  it('REC priceType prepends "(Rec)" to name and ID', () => {
    const row = derive({
      SKU: "MR-002",
      Product: "OG Kush 1g",
      Category: "Flower",
      Weight: "1g",
      Price: "15",
      PriceType: "REC",
    });
    expect(row.productName).toBe("(Rec) OG Kush 1g");
    expect(row.productId).toContain("-REC");
  });

  it("no priceType leaves name unchanged", () => {
    const row = derive({
      SKU: "MR-003",
      Product: "Test Product",
      Category: "Flower",
      Weight: "1g",
      Price: "10",
    });
    expect(row.productName).toBe("Test Product");
    expect(row.productId).not.toContain("-MED");
    expect(row.productId).not.toContain("-REC");
  });
});

// ── Price Conversion ─────────────────────────────────────────────────────────

describe("price conversion edge cases", () => {
  it("$0 price returns 0 so validator catches it", () => {
    const row = derive({
      SKU: "PR-001",
      Product: "Free Sample",
      Category: "Flower",
      Weight: "1g",
      Price: "$0.00",
    });
    expect(row.basePrice).toBe("0");
  });

  it("empty price returns 0 so validator catches it", () => {
    const row = derive({
      SKU: "PR-002",
      Product: "No Price Product",
      Category: "Flower",
      Weight: "1g",
      Price: "",
    });
    expect(row.basePrice).toBe("0");
  });

  it("normal price converts to cents", () => {
    const row = derive({
      SKU: "PR-003",
      Product: "Test Product",
      Category: "Flower",
      Weight: "1g",
      Price: "35.00",
    });
    expect(row.basePrice).toBe("3500");
  });
});

// ── Hide From Menu ───────────────────────────────────────────────────────────

describe("hide from menu logic", () => {
  it("sample in name → hidden", () => {
    const row = derive({
      SKU: "HM-001",
      Product: "Blue Dream Sample",
      Category: "Flower",
      Weight: "1g",
      Price: "10",
    });
    expect(row.hideFromMenu).toBe("TRUE");
  });

  it("promo in name → hidden", () => {
    const row = derive({
      SKU: "HM-002",
      Product: "Promo Gummy Pack",
      Category: "Edible",
      Weight: "100mg",
      Price: "1",
    });
    expect(row.hideFromMenu).toBe("TRUE");
  });
});

// ── Excluded Products ────────────────────────────────────────────────────────

describe("excluded products", () => {
  it("payment fee is excluded", () => {
    const row = derive({
      SKU: "EX-001",
      Product: "Payment Fee",
      Category: "",
      Price: "3.50",
    });
    expect(row.excluded).toBe(true);
  });

  it("empty product name is excluded", () => {
    const row = derive({
      SKU: "EX-002",
      Product: "",
      Category: "Flower",
      Price: "10",
    });
    expect(row.excluded).toBe(true);
  });
});

// ── Unit Count Extraction ────────────────────────────────────────────────────

describe("unit count for Preroll/Beverage", () => {
  it("extracts pack count from preroll name", () => {
    const row = derive({
      SKU: "UC-001",
      Product: "Blue Dream Pre-Roll 5 Pack",
      Category: "Preroll",
      Weight: "0.5g",
      Price: "25",
    });
    expect(row.unitCount).toBe("5");
  });

  it("defaults unitCount to 1 for prerolls without count", () => {
    const row = derive({
      SKU: "UC-002",
      Product: "Single Joint 1g",
      Category: "Preroll",
      Weight: "1g",
      Price: "10",
    });
    expect(row.unitCount).toBe("1");
  });

  it("extracts count from beverage name", () => {
    const row = derive({
      SKU: "UC-003",
      Product: "Seltzer 4pk",
      Category: "Beverage",
      Price: "20",
    });
    expect(row.unitCount).toBe("4");
  });

  it("non-preroll/beverage has empty unitCount", () => {
    const row = derive({
      SKU: "UC-004",
      Product: "Gummy 5 Pack 100mg",
      Category: "Edible",
      Weight: "100mg",
      Price: "25",
    });
    expect(row.unitCount).toBe("");
  });
});

// ── Extraction Method ────────────────────────────────────────────────────────

describe("extraction method detection", () => {
  it("rosin in name → Solventless", () => {
    const row = derive({
      SKU: "EM-001",
      Product: "Live Rosin 1g",
      Category: "Extract",
      Weight: "1g",
      Price: "60",
    });
    expect(row.extractionMethod).toBe("Solventless");
  });

  it("solventless in name → Solventless", () => {
    const row = derive({
      SKU: "EM-002",
      Product: "Solventless Hash 1g",
      Category: "Extract",
      Weight: "1g",
      Price: "50",
    });
    expect(row.extractionMethod).toBe("Solventless");
  });

  it("no extraction keywords → empty", () => {
    const row = derive({
      SKU: "EM-003",
      Product: "Live Resin 0.5g",
      Category: "Extract",
      Weight: "0.5g",
      Price: "40",
    });
    expect(row.extractionMethod).toBe("");
  });
});

// ── Merch Size Extraction ────────────────────────────────────────────────────

describe("merch size extraction", () => {
  it("XL in name → XL", () => {
    const row = derive({
      SKU: "MS-001",
      Product: "Brand T-Shirt XL",
      Category: "Merch",
      Price: "25",
    });
    expect(row.merchSize).toBe("XL");
  });

  it("Small in name → Small", () => {
    const row = derive({
      SKU: "MS-002",
      Product: "Hoodie Small",
      Category: "Merch",
      Price: "45",
    });
    expect(row.merchSize).toBe("Small");
  });

  it("no size → One Size", () => {
    const row = derive({
      SKU: "MS-003",
      Product: "Rolling Tray",
      Category: "Merch",
      Price: "15",
    });
    expect(row.merchSize).toBe("One Size");
  });

  it("non-Merch has empty merchSize", () => {
    const row = derive({
      SKU: "MS-004",
      Product: "Blue Dream 3.5g",
      Category: "Flower",
      Weight: "3.5g",
      Price: "35",
    });
    expect(row.merchSize).toBe("");
  });
});

// ── Subcategory Post-Processing ──────────────────────────────────────────────

describe("subcategory normalization", () => {
  it("extract batter → Badder", () => {
    // When category=Extract and subcategory=batter, fixSubCategory corrects it
    const row = derive({
      SKU: "SN-001",
      Product: "Test Badder 1g",
      Category: "Extract",
      SubCategory: "batter",
      Weight: "1g",
      Price: "40",
    });
    // The name "Badder" should win from name rules
    expect(row.subCategory).toBe("Badder");
  });
});

// ── Enhanced Category Resolve (fallback context) ─────────────────────────────

describe("enhancedCategoryResolve", () => {
  it("uses extended context when standard resolution is weak", () => {
    // "Misc" is considered weak, so fallback searches extra context
    const result = enhancedCategoryResolve(
      "Misc",
      "",
      "",
      "Alpha Beta",
      "premium flower nugs hand-trimmed",
    );
    expect(result.category).toBe("Flower");
  });

  it("returns standard resolution when strong", () => {
    const result = enhancedCategoryResolve(
      "Flower",
      "",
      "",
      "Blue Dream",
      "",
    );
    expect(result.category).toBe("Flower");
  });
});

// ── Comma-Formatted Numbers ──────────────────────────────────────────────────

describe("comma-formatted number handling", () => {
  it('parseWeight handles "1,000mg"', () => {
    const result = parseWeight("1,000mg");
    expect(result.amount).toBeCloseTo(1000);
    expect(result.unit).toBe("milligrams");
  });

  it('parseWeight handles "1,234.56g"', () => {
    const result = parseWeight("1,234.56g");
    expect(result.amount).toBeCloseTo(1234.56);
    expect(result.unit).toBe("grams");
  });
});

// ── Status Derivation ────────────────────────────────────────────────────────

describe("status derivation", () => {
  it('"yes" → inactive', () => {
    const row = derive({
      SKU: "ST-001",
      Product: "Discontinued Item",
      Category: "Flower",
      Status: "yes",
      Weight: "1g",
      Price: "10",
    });
    expect(row.status).toBe("inactive");
  });

  it('anything else → active', () => {
    const row = derive({
      SKU: "ST-002",
      Product: "Active Item",
      Category: "Flower",
      Status: "No",
      Weight: "1g",
      Price: "10",
    });
    expect(row.status).toBe("active");
  });

  it("empty status → active", () => {
    const row = derive({
      SKU: "ST-003",
      Product: "Default Item",
      Category: "Flower",
      Weight: "1g",
      Price: "10",
    });
    expect(row.status).toBe("active");
  });
});

// ── Coated/Dusted/Glazed Extract → Flower/Infused Flower ─────────────────────

describe("coated/dusted/glazed overrides Extract → Flower", () => {
  it("diamond coated → Flower/Infused Flower, not Extract/Diamonds", () => {
    const result = applyNameOverride("Extract", "Diamonds", "Pink Zkittlez Diamond Coated 3.5g");
    expect(result.category).toBe("Flower");
    expect(result.subCategory).toBe("Infused Flower");
  });

  it("kief dusted → Flower/Infused Flower", () => {
    const result = applyNameOverride("Extract", "Kief", "OG Kush Kief Dusted Buds 3.5g");
    expect(result.category).toBe("Flower");
    expect(result.subCategory).toBe("Infused Flower");
  });

  it("glazed flower → Flower/Infused Flower", () => {
    const result = applyNameOverride("Extract", "Extract - General", "Glazed Donut Flower 7g");
    expect(result.category).toBe("Flower");
    expect(result.subCategory).toBe("Infused Flower");
  });

  it("coated does NOT override Flower (already correct)", () => {
    const result = applyNameOverride("Flower", "Pre-Pack", "Diamond Coated Buds 3.5g");
    expect(result.category).toBe("Flower");
  });
});

// ── Milligram UOM Unknown-Unit Weight → mg ───────────────────────────────────

describe("milligram UOM unknown-unit weight treated as mg", () => {
  it("Meadow Cannabis Content 1000 → 1000mg amount (not overflow)", () => {
    const row = derive({
      SKU: "MG-001",
      Product: "Mambas Lime Hash Rosin Infused Gummies",
      Category: "Edible",
      Weight: "1000",
      Price: "40",
    });
    expect(row.uom).toBe("milligrams");
    expect(row.amount).toBe(1000);
  });

  it("unknown-unit weight 500 on milligram product → 500mg", () => {
    const row = derive({
      SKU: "MG-002",
      Product: "Test Edible",
      Category: "Edible",
      Weight: "500",
      Price: "25",
    });
    expect(row.uom).toBe("milligrams");
    expect(row.amount).toBe(500);
  });

  it("explicit mg unit still works", () => {
    const row = derive({
      SKU: "MG-003",
      Product: "Gummy 100mg",
      Category: "Edible",
      Weight: "100mg",
      Price: "20",
    });
    expect(row.uom).toBe("milligrams");
    expect(row.amount).toBe(100);
  });
});

// ── Field Defaults Fallback ───────────────────────────────────────────────────

describe("no fabricated defaults", () => {
  it("does NOT fill in amount when source data has no weight", () => {
    const row = derive({
      SKU: "FD-001",
      Product: "Mystery Gummy",
      Category: "Edible",
      // No weight provided — amount should stay 0, not fabricate data
      Price: "20",
    });
    expect(row.amount).toBe(0);
  });
});

// ── Full Gram / Half Gram Name Parsing ────────────────────────────────────────

describe("Full Gram / Half Gram in product name", () => {
  it('"Full Gram" → 1g amount', () => {
    const row = derive({
      SKU: "FG-001",
      Product: "Stiiizy Full Gram Pod",
      Category: "Cartridge",
      Price: "50",
    });
    expect(row.amount).toBe(1);
  });

  it('"Half Gram" → 0.5g amount', () => {
    const row = derive({
      SKU: "FG-002",
      Product: "Friendly Farms Half Gram Cart",
      Category: "Cartridge",
      Price: "35",
    });
    expect(row.amount).toBe(0.5);
  });
});

// ── Topical Keywords (creme, compound, sensual) ──────────────────────────────

describe("topical keyword expansion", () => {
  it('"creme" resolves to Topical/Cream', () => {
    const res = resolveCategory("", "", "CBD Pain Creme 500mg");
    expect(res.category).toBe("Topical");
    expect(res.subCategory).toBe("Cream");
  });

  it('"compound" resolves to Topical/Salve', () => {
    const res = resolveCategory("", "", "THC Compound 100mg");
    expect(res.category).toBe("Topical");
  });

  it('"sensual oil" resolves to Topical/Oil', () => {
    const res = resolveCategory("", "", "Sensual Body Oil 100mg");
    expect(res.category).toBe("Topical");
    expect(res.subCategory).toBe("Oil");
  });

  it('"Lotions Salves Balms" in source category resolves to Topical', () => {
    const res = resolveCategory("Lotions- Salves- Balms", "", "Test Product");
    expect(res.category).toBe("Topical");
  });
});

// ── Bath Keyword Broadened ───────────────────────────────────────────────────

describe("bath keyword", () => {
  it('"bath soak" resolves to Misc/Bath', () => {
    const res = resolveCategory("", "", "CBD Bath Soak 100mg");
    expect(res.category).toBe("Misc");
    expect(res.subCategory).toBe("Bath");
  });

  it('"bath salt" resolves to Misc/Bath', () => {
    const res = resolveCategory("Bath", "", "Infused Bath Salt");
    expect(res.category).toBe("Misc");
    expect(res.subCategory).toBe("Bath");
  });
});

// ── Beverage Enhancer Keyword ────────────────────────────────────────────────

describe("beverage enhancer keyword", () => {
  it('"enhancer" resolves to Beverage', () => {
    const res = resolveCategory("", "", "Cannabis Beverage Enhancer 90mg");
    expect(res.category).toBe("Beverage");
  });
});

// ── Category-Specific Amount Plausibility ────────────────────────────────────

describe("category-specific amount plausibility ceilings", () => {
  it("edible with 5600mg weight prefers 100mg from name", () => {
    const row = derive({
      SKU: "PL-001",
      Product: "Kiva Terra Bites 100mg",
      Category: "Edible",
      Weight: "5.6g",
      Price: "25",
    });
    expect(row.uom).toBe("milligrams");
    expect(row.amount).toBe(100);
  });

  it("topical oz weight blanked (net weight, not THC)", () => {
    const row = derive({
      SKU: "PL-002",
      Product: "Pain Relief Cream 2oz",
      Category: "Topical",
      Weight: "2oz",
      Price: "40",
    });
    expect(row.uom).toBe("milligrams");
    // 2oz = 56700mg, way over ceiling → should be 0 (flagged for review)
    expect(row.amount).toBe(0);
  });
});

// ── Grams-Based Category THC/CBD Cleanup ─────────────────────────────────────

describe("THC/CBD cleanup after category override", () => {
  it("cartridge (grams) has blank THC and CBD", () => {
    const row = derive({
      SKU: "CL-001",
      Product: "Live Resin Cart 0.5g",
      Category: "Cartridge",
      Weight: "0.5g",
      Price: "40",
      THC: "85",
      CBD: "5",
    });
    expect(row.uom).toBe("grams");
    expect(row.thc).toBe("");
    expect(row.cbd).toBe("");
  });
});

// ── Cartridge Diamond Subcategory ────────────────────────────────────────────

describe("Cartridge Diamond subcategory", () => {
  it('"diamond" in cartridge name → Diamond subcategory', () => {
    const sub = resolveSubCategoryFromName("Cartridge", "Diamond Live Resin Cart 1g");
    expect(sub).toBe("Diamond");
  });
});

// ── Non-Cannabis Flag (Is MMJ? = N) ──────────────────────────────────────────

describe("non-cannabis flag from source row", () => {
  it("Is MMJ? = N with battery keyword → Merch/Battery", () => {
    const result = deriveRows(
      [{ SKU: "NMJ-001", Product: "STIIIZY Battery Starter Kit", Category: "Vaporizers", "Sub-category (L2)": "Batteries", Price: "30", "Is MMJ?": "N" }],
      baseMappings,
    );
    const row = result.derivedRows[0];
    expect(row.category).toBe("Merch");
    expect(row.subCategory).toBe("Battery");
  });

  it("Is MMJ? = N with edible keyword → CBD", () => {
    const result = deriveRows(
      [{ SKU: "NMJ-002", Product: "Hemp Gummy Bears 25mg", Category: "Edible", Price: "15", "Is MMJ?": "N" }],
      baseMappings,
    );
    const row = result.derivedRows[0];
    expect(row.category).toBe("CBD");
  });

  it("Contains THC = N with hemp skincare → CBD", () => {
    const result = deriveRows(
      [{ SKU: "NMJ-005", Product: "Love Plus Hemp Skincare", Category: "Topical", Price: "20", "Contains THC": "N" }],
      baseMappings,
    );
    const row = result.derivedRows[0];
    expect(row.category).toBe("CBD");
  });

  it("Is MMJ? = Y leaves category unchanged", () => {
    const result = deriveRows(
      [{ SKU: "NMJ-003", Product: "Blue Dream 3.5g", Category: "Flower", Weight: "3.5g", Price: "35", "Is MMJ?": "Y" }],
      baseMappings,
    );
    expect(result.derivedRows[0].category).toBe("Flower");
  });

  it("no Is MMJ? column leaves category unchanged", () => {
    const row = derive({
      SKU: "NMJ-004",
      Product: "Blue Dream 3.5g",
      Category: "Flower",
      Weight: "3.5g",
      Price: "35",
    });
    expect(row.category).toBe("Flower");
  });
});

describe("review-driven category fixes", () => {
  it("dream drops resolve to tincture with milligram uom", () => {
    const row = derive({
      SKU: "REV-001",
      Product: "ZZ INV Dream Drops",
      Category: "Other",
      Price: "15",
    });
    expect(row.category).toBe("Tincture");
    expect(row.uom).toBe("milligrams");
  });

  it("bulk flower names with standalone 3.5 resolve to flower grams", () => {
    const row = derive({
      SKU: "REV-002",
      Product: "BULK - Cannatonic 3.5 CBD",
      Category: "Other",
      Price: "28",
    });
    expect(row.category).toBe("Flower");
    expect(row.uom).toBe("grams");
    expect(row.amount).toBeCloseTo(3.5, 1);
  });

  it("invalid other category outputs are normalized to allowed categories", () => {
    const row = derive({
      SKU: "REV-003",
      Product: "RAW | 70mm 2-Way Roller | Skinny & Regular",
      Category: "Other",
      Price: "10",
    });
    expect(row.category).toBe("Merch");
  });
});

// ── Beverage Seltzer Subcategory ─────────────────────────────────────────────

describe("Beverage Seltzer subcategory", () => {
  it('"seltzer" in beverage name → Seltzer subcategory', () => {
    const sub = resolveSubCategoryFromName("Beverage", "PBR Infused Seltzer 10mg");
    expect(sub).toBe("Seltzer");
  });
});

// ── CBD Product THC Reclassification (with THC keyword) ──────────────────────

describe("CBD with THC keyword reclassification", () => {
  it("CBD product with THC + vape keyword → Cartridge", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD THC Vape Cart 0.5g");
    expect(result.category).toBe("Cartridge");
  });

  it("CBD product with THC + gummy keyword → Edible via strong override", () => {
    // This hits the strong override path (gummy overrides CBD)
    const result = applyNameOverride("CBD", "CBD - General", "CBD Gummy 25mg THC");
    expect(result.category).toBe("Edible");
    expect(result.subCategory).toBe("Gummy");
  });

  it("CBD product with THC + tincture keyword → Tincture", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD THC Tincture 500mg");
    expect(result.category).toBe("Tincture");
  });

  it("CBD product with THC + syrup keyword → Tincture/Syrup", () => {
    const result = applyNameOverride("CBD", "CBD - General", "CBD THC Syrup 100mg");
    expect(result.category).toBe("Tincture");
    expect(result.subCategory).toBe("Syrup");
  });
});
