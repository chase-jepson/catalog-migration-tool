import {
  PRODUCT_CATEGORIES,
  PRODUCT_SUBCATEGORIES,
  UOM_BY_CATEGORY,
  EACH_UOM_CATEGORIES,
} from "./constants";
import type { CategoryResolution } from "./types";

// ── Keyword Rules ────────────────────────────────────────────────────────────

interface KeywordRule {
  keywords: RegExp;
  category: string;
  subCategory?: string;
}

// Exclude rules -- these source values should be skipped entirely
const EXCLUDE_PATTERNS = [/\b(sample|display)\b/i];

export const EXCLUDED_CATEGORY = "__EXCLUDE__";

/** When a subcategory name exists in multiple categories, prefer this category */
const SUBCATEGORY_CATEGORY_PRIORITY: Record<string, string> = {
  Capsule: "Pill",
};

const KEYWORD_RULES: KeywordRule[] = [
  // ── Order follows Parabola rules: more specific before general ─────

  // Merch -- battery/batteries must come BEFORE Cartridge so that
  // "Jeeter - 510 Battery" resolves to Merch, not Cartridge.
  { keywords: /\b(batter(y|ies))\b/i, category: "Merch", subCategory: "Battery" },

  // Beverage -- BEFORE Edible so "edible (liquid)" maps here
  {
    keywords: /\b(beverages?|drinks?|sips?|seltzer|soda|water|juice|tea|coffee|tonic|elixir|shot|margarita|lemonade|punch|enhancer)\b/i,
    category: "Beverage",
  },
  { keywords: /edible\s*\(liquid\)/i, category: "Beverage" },
  { keywords: /\b(dissolvable)\b/i, category: "Beverage", subCategory: "Dissolvable" },

  // Cartridge -- "cart" and "vape" both trigger this
  { keywords: /\b(cartridges?|cart|vapes?|vaporizers?|510|ccell)\b/i, category: "Cartridge" },
  { keywords: /\b(pod|reload)\b/i, category: "Cartridge", subCategory: "Pod" },
  {
    keywords: /\b(all[\s-]?in[\s-]?one|aio|disposable|dispo|ready[\s-]?to[\s-]?use|rtu)\b/i,
    category: "Cartridge",
    subCategory: "Ready To Use",
  },
  { keywords: /\b(pax)\b/i, category: "Cartridge", subCategory: "Pax" },

  // Edible -- after Beverage so "edible (liquid)" doesn't land here
  { keywords: /\b(edibles?)\b/i, category: "Edible" },
  { keywords: /\b(gumm(y|ies))\b/i, category: "Edible", subCategory: "Gummy" },
  { keywords: /\b(chocolate)\b/i, category: "Edible", subCategory: "Chocolate" },
  {
    keywords: /\b(candy|candies|hard[\s-]?candy)\b/i,
    category: "Edible",
    subCategory: "Hard Candy",
  },
  { keywords: /\b(cookie)\b/i, category: "Edible", subCategory: "Cookie" },
  {
    keywords: /\b(baked[\s-]?good|brownie|pastry)\b/i,
    category: "Edible",
    subCategory: "Baked Good",
  },
  { keywords: /\b(mint)\b/i, category: "Edible", subCategory: "Mints" },
  { keywords: /\b(chew|taffy|caramel)\b/i, category: "Edible", subCategory: "Chew" },
  { keywords: /\b(lozenge)\b/i, category: "Edible", subCategory: "Lozenge" },

  // Extract -- "concentrate", "extract", "wax", "hash"
  { keywords: /\bthc[\s-]?a\b/i, category: "Extract", subCategory: "THC-A" },
  { keywords: /\b(extracts?|concentrates?|dab|wax|hash)\b/i, category: "Extract" },
  { keywords: /\bHCE\b/, category: "Extract", subCategory: "Extract - General" },
  { keywords: /\b(shatter)\b/i, category: "Extract", subCategory: "Shatter" },
  { keywords: /\b(live[\s-]?rosin)\b/i, category: "Extract", subCategory: "Live Rosin" },
  { keywords: /\b(live[\s-]?resin)\b/i, category: "Extract", subCategory: "Live Resin" },
  { keywords: /\b(cured[\s-]?resin)\b/i, category: "Extract", subCategory: "Cured Resin" },
  { keywords: /\b(rosin)\b/i, category: "Extract", subCategory: "Rosin" },
  { keywords: /\b(badder)\b/i, category: "Extract", subCategory: "Badder" },
  { keywords: /\b(budder)\b/i, category: "Extract", subCategory: "Budder" },
  { keywords: /\b(sauce)\b/i, category: "Extract", subCategory: "Sauce" },
  { keywords: /\b(sugar)\b/i, category: "Extract", subCategory: "Sugar" },
  { keywords: /\b(crumble)\b/i, category: "Extract", subCategory: "Crumble" },
  { keywords: /\b(diamond)\b/i, category: "Extract", subCategory: "Diamonds" },
  { keywords: /\b(kief)\b/i, category: "Extract", subCategory: "Kief" },
  { keywords: /\b(rso)\b/i, category: "Extract", subCategory: "RSO" },
  { keywords: /\b(moon[\s-]?rock)/i, category: "Extract", subCategory: "Moon Rocks" },
  {
    keywords: /\b(fsho|full[\s-]?spectrum[\s-]?hash[\s-]?oil)\b/i,
    category: "Extract",
    subCategory: "Full Spectrum Oil",
  },

  // Preroll -- "roll" alone is enough
  { keywords: /\b(pre[\s-]?rolls?|prerolls?|joints?|rolls?)\b/i, category: "Preroll" },
  { keywords: /\b(blunts?)\b/i, category: "Preroll", subCategory: "Blunt" },
  {
    keywords: /\b(infused[\s-]?pre[\s-]?rolls?|infused[\s-]?joints?)\b/i,
    category: "Preroll",
    subCategory: "Infused",
  },

  // Flower -- weight-based POS categories + weight hints
  { keywords: /\b(eighth|1\/8)\b/i, category: "Flower", subCategory: "Pre-Pack" },
  { keywords: /\b(quarter|1\/4)\b/i, category: "Flower", subCategory: "Pre-Pack" },
  { keywords: /\b(half[\s-]?(oz|ounce))\b/i, category: "Flower", subCategory: "Pre-Pack" },
  { keywords: /\bounce\b/i, category: "Flower", subCategory: "Pre-Pack" },
  { keywords: /\b\d+(\.\d+)?g\b/i, category: "Flower", subCategory: "Pre-Pack" },
  { keywords: /\b(flowers?|bud|buds|nug|nugs)\b/i, category: "Flower" },
  { keywords: /\b(pre[\s-]?pack|prepack)\b/i, category: "Flower", subCategory: "Pre-Pack" },
  { keywords: /\b(shake)\b/i, category: "Flower", subCategory: "Shake" },
  { keywords: /\b(pre[\s-]?ground)\b/i, category: "Flower", subCategory: "Pre-Ground" },
  { keywords: /\b(bulk[\s-]?flower)\b/i, category: "Flower", subCategory: "Bulk Flower" },
  { keywords: /\b(smalls)\b/i, category: "Flower", subCategory: "Pre-Pack Smalls" },

  // Merch -- "merch", "para" (paraphernalia), "gear", "access", etc.
  {
    keywords:
      /\b(merch|merchandise|para|paraphernalia|gear|access|batter|battery|pipe|grinder|accessory|accessories|bong|lighter|rolling[\s-]?paper|non[\s-]?thc|clothing|glass|candle|hardware)\b/i,
    category: "Merch",
  },
  { keywords: /\b(shirt|t[\s-]?shirt|tee)\b/i, category: "Merch", subCategory: "T Shirt" },
  { keywords: /\b(sweater|sweatshirt|hoodie)\b/i, category: "Merch", subCategory: "Apparel" },

  // Pill -- "tab", "pill", "capsule"
  { keywords: /\b(pills?|capsules?|tablets?|tab)\b/i, category: "Pill" },

  // Plant
  { keywords: /\b(plants?|clones?|seeds?)\b/i, category: "Plant" },

  // Tincture
  { keywords: /\b(tinctures?|dropper)\b/i, category: "Tincture" },
  { keywords: /\b(syrup)\b/i, category: "Tincture", subCategory: "Syrup" },
  { keywords: /\b(spray)\b/i, category: "Tincture", subCategory: "Spray" },

  // Topical
  { keywords: /\b(topicals?|transdermals?)\b|\b(lotions?|salves?|balms?)\b.*\b(lotions?|salves?|balms?)\b/i, category: "Topical" },
  { keywords: /\b(balm)\b/i, category: "Topical", subCategory: "Balm" },
  { keywords: /\b(cream|creme)\b/i, category: "Topical", subCategory: "Cream" },
  { keywords: /\b(lotion)\b/i, category: "Topical", subCategory: "Lotion" },
  { keywords: /\b(patch|transdermal)\b/i, category: "Topical", subCategory: "Patch" },
  { keywords: /\b(salve|compound)\b/i, category: "Topical", subCategory: "Salve" },
  { keywords: /\b(roll[\s-]?on)\b/i, category: "Topical", subCategory: "Roll-On" },
  { keywords: /\b(gel)\b/i, category: "Topical", subCategory: "Gel" },
  { keywords: /\b(lubricant|lube)\b/i, category: "Topical", subCategory: "Lubricant" },
  { keywords: /\bsensual\b/i, category: "Topical", subCategory: "Oil" },

  // Non-Inv
  { keywords: /\b(non[\s-]?inv|gift[\s-]?card|fee|membership)\b/i, category: "Non-Inv" },

  // Misc
  { keywords: /\b(misc|miscellaneous|suppository)\b/i, category: "Misc" },
  { keywords: /\b(bath)\b/i, category: "Misc", subCategory: "Bath" },

  // CBD -- check last since many categories can have CBD products
  { keywords: /\bcbd\b/i, category: "CBD" },
];

// ── Name Override Rules (highest priority) ──────────────────────────────────

const NAME_OVERRIDE_RULES: KeywordRule[] = [
  { keywords: /\b(batter(y|ies))\b/i, category: "Merch", subCategory: "Battery" },
  { keywords: /\b(pod|reload)\b/i, category: "Cartridge", subCategory: "Pod" },
  {
    keywords: /\b(ready[\s-]?to[\s-]?use|rtu|all[\s-]?in[\s-]?one|aio|dispo|disposable)\b/i,
    category: "Cartridge",
    subCategory: "Ready To Use",
  },
  { keywords: /\b(cart|vape|vaporizers?)\b/i, category: "Cartridge" },
  { keywords: /\b(syrup)\b/i, category: "Tincture", subCategory: "Syrup" },
  { keywords: /\b(tincture)\b/i, category: "Tincture" },
  { keywords: /\b(tablet|tablit)\b/i, category: "Pill" },
];

/** Strong overrides -- unambiguous name patterns */
const STRONG_NAME_OVERRIDES: {
  namePattern: RegExp;
  overrideCategories: string[];
  category: string;
  subCategory?: string;
}[] = [
  {
    namePattern: /\b(pre[\s-]?rolls?|prerolls?)\b/i,
    overrideCategories: ["Flower"],
    category: "Preroll",
  },
  // "Diamond coated" / "kief dusted" products miscategorized as Extract due to
  // "diamond" keyword — these are infused flower, not concentrates.
  {
    namePattern: /\b(coated|dusted|glazed)\b/i,
    overrideCategories: ["Extract"],
    category: "Flower",
    subCategory: "Infused Flower",
  },
  {
    namePattern: /\bthc[\s-]?a\b/i,
    overrideCategories: ["Edible"],
    category: "Extract",
    subCategory: "THC-A",
  },
  {
    namePattern: /\btincture\b/i,
    overrideCategories: ["Edible", "Misc", "Extract"],
    category: "Tincture",
  },
  // Edible products miscategorized as CBD — name clearly indicates edible type
  {
    namePattern: /\b(gumm(y|ies))\b/i,
    overrideCategories: ["CBD"],
    category: "Edible",
    subCategory: "Gummy",
  },
  {
    namePattern: /\b(chocolate)\b/i,
    overrideCategories: ["CBD"],
    category: "Edible",
    subCategory: "Chocolate",
  },
  {
    namePattern: /\b(brownie|cookie|baked)\b/i,
    overrideCategories: ["CBD"],
    category: "Edible",
    subCategory: "Baked Good",
  },
  {
    namePattern: /\b(mint|lozenge)\b/i,
    overrideCategories: ["CBD"],
    category: "Edible",
  },
  {
    namePattern: /\b(capsule|softgel)\b/i,
    overrideCategories: ["CBD"],
    category: "Pill",
    subCategory: "Capsule",
  },
  {
    namePattern: /\b(tablet)\b/i,
    overrideCategories: ["CBD"],
    category: "Pill",
    subCategory: "Tablet",
  },
  {
    namePattern: /\b(topical|cream|balm|salve|lotion|patch)\b/i,
    overrideCategories: ["CBD"],
    category: "Topical",
  },
  {
    namePattern: /\b(cartridge|cart|vape|vaporizer)\b/i,
    overrideCategories: ["CBD"],
    category: "Cartridge",
  },
];

// ── Subcategory Name Rules (per-category) ───────────────────────────────────

interface SubCategoryNameRule {
  keywords: RegExp;
  excludeKeywords?: RegExp;
  subCategory: string;
}

const SUBCATEGORY_NAME_RULES: Record<string, SubCategoryNameRule[]> = {
  Beverage: [
    { keywords: /coffee/i, subCategory: "Coffee" },
    { keywords: /elixir/i, subCategory: "Elixir" },
    { keywords: /juice/i, subCategory: "Juice" },
    { keywords: /seltzer/i, subCategory: "Seltzer" },
    { keywords: /shot/i, subCategory: "Shot" },
    { keywords: /soda/i, subCategory: "Soda" },
    { keywords: /\btea\b/i, subCategory: "Tea" },
    { keywords: /tonic|tonik/i, subCategory: "Tonic" },
    { keywords: /water/i, subCategory: "Water" },
    { keywords: /\b(mix|powder)\b/i, subCategory: "Dissolvable" },
  ],
  Cartridge: [
    { keywords: /\b(pod|reload)\b/i, subCategory: "Pod" },
    {
      keywords: /disp|ready[\s-]?to[\s-]?use|\brtu\b|all[\s-]?in[\s-]?one|\baio\b|all-in-one/i,
      subCategory: "Ready To Use",
    },
    { keywords: /diamond/i, subCategory: "Diamond" },
  ],
  CBD: [
    { keywords: /capsule/i, subCategory: "Pill" },
    { keywords: /cream/i, subCategory: "Topical" },
    { keywords: /\boil\b/i, subCategory: "Oil" },
    { keywords: /tincture/i, subCategory: "Tincture" },
  ],
  Edible: [
    { keywords: /gumm/i, subCategory: "Gummy" },
    { keywords: /chew/i, subCategory: "Chew" },
    { keywords: /lozenge/i, subCategory: "Lozenge" },
    { keywords: /cookie/i, excludeKeywords: /bar/i, subCategory: "Cookie" },
    { keywords: /brownie|krisp|baked/i, subCategory: "Baked Good" },
    { keywords: /chocolate/i, subCategory: "Chocolate" },
    { keywords: /mints/i, subCategory: "Mints" },
  ],
  Extract: [
    { keywords: /crystalline/i, subCategory: "Crystalline" },
    { keywords: /cured[\s-]?resin/i, subCategory: "Cured Resin" },
    { keywords: /distillate/i, subCategory: "Distillate" },
    { keywords: /hash[\s-]?rosin/i, subCategory: "Hash Rosin" },
    { keywords: /water[\s-]?hash/i, subCategory: "Water Hash" },
    { keywords: /live[\s-]?resin[\s-]?badder|live[\s-]?badder/i, subCategory: "Live Resin Badder" },
    { keywords: /live[\s-]?resin[\s-]?budder|live[\s-]?budder/i, subCategory: "Live Resin Budder" },
    { keywords: /live[\s-]?resin[\s-]?sugar|live[\s-]?sugar/i, subCategory: "Live Resin Sugar" },
    { keywords: /moon[\s-]?rock/i, subCategory: "Moon Rocks" },
    { keywords: /(?=.*rosin)(?=.*budder)/i, subCategory: "Rosin Budder" },
    { keywords: /\brso\b/i, subCategory: "RSO" },
    { keywords: /thc[\s-]?a\b/i, subCategory: "THC-A" },
    { keywords: /diamond/i, subCategory: "Diamonds" },
    { keywords: /rosin/i, subCategory: "Live Rosin" },
    { keywords: /crumble/i, subCategory: "Crumble" },
    { keywords: /sauce/i, subCategory: "Sauce" },
    { keywords: /shatter/i, subCategory: "Shatter" },
    { keywords: /hash/i, subCategory: "Hash" },
    { keywords: /live[\s-]?resin/i, subCategory: "Live Resin" },
    { keywords: /isolate/i, subCategory: "Isolate" },
    { keywords: /\boil\b/i, subCategory: "Oil" },
    { keywords: /jelly/i, subCategory: "Jelly" },
    { keywords: /badder/i, subCategory: "Badder" },
    { keywords: /budder/i, subCategory: "Budder" },
    { keywords: /sugar/i, subCategory: "Sugar" },
    { keywords: /wax/i, subCategory: "Wax" },
  ],
  Flower: [
    { keywords: /bulk/i, subCategory: "Bulk Flower" },
    { keywords: /infused|coated|dusted|glazed/i, subCategory: "Infused Flower" },
    { keywords: /smalls?|popcorn/i, subCategory: "Pre-Pack Smalls" },
  ],
  Merch: [
    { keywords: /battery/i, subCategory: "Battery" },
    { keywords: /bong|water[\s-]?pipe|beaker/i, subCategory: "Bong" },
    { keywords: /\bhat\b/i, subCategory: "Hat" },
    { keywords: /hoodie/i, subCategory: "Hoodie" },
    { keywords: /lighter|torch/i, subCategory: "Lighter" },
    { keywords: /\srig\b/i, subCategory: "Dab Rig" },
    { keywords: /pipe/i, subCategory: "Pipe" },
    { keywords: /paper|cone/i, subCategory: "Rolling Papers" },
    { keywords: /sweatshirt|sweater/i, subCategory: "Sweatshirt" },
    { keywords: /shirt/i, subCategory: "T Shirt" },
    { keywords: /vaporizer/i, subCategory: "Vaporizer" },
  ],
  Misc: [{ keywords: /suppository/i, subCategory: "Suppository" }],
  Pill: [
    { keywords: /capsule/i, subCategory: "Capsule" },
    { keywords: /tab/i, subCategory: "Tablet" },
  ],
  Plant: [
    { keywords: /seed/i, subCategory: "Seeds" },
    { keywords: /clone/i, subCategory: "Clone" },
  ],
  Preroll: [{ keywords: /infused|hash|jeeter|diamond/i, subCategory: "Infused" }],
  Tincture: [
    { keywords: /spray/i, subCategory: "Spray" },
    { keywords: /syrup/i, subCategory: "Syrup" },
  ],
  Topical: [
    { keywords: /balm/i, subCategory: "Balm" },
    { keywords: /cream|creme|compound/i, subCategory: "Cream" },
    { keywords: /lotion/i, subCategory: "Lotion" },
    { keywords: /patch/i, subCategory: "Patch" },
    { keywords: /spray/i, subCategory: "Spray" },
    { keywords: /salve|liniment/i, subCategory: "Salve" },
    { keywords: /\boil\b/i, subCategory: "Oil" },
    { keywords: /gel/i, subCategory: "Gel" },
  ],
};

/** Category-specific default subcategories */
const CATEGORY_DEFAULT_SUBCATEGORY: Record<string, string> = {
  Cartridge: "510 Thread",
  Flower: "Pre-Pack",
  Preroll: "Flower",
  Tincture: "Dropper",
};

// ── Resolution Helpers ───────────────────────────────────────────────────────

const PRODUCT_CATEGORIES_SET = new Set(PRODUCT_CATEGORIES as readonly string[]);

/** Returns true when the resolution is weak */
function isWeakResolution(cat: string): boolean {
  if (!cat) return true;
  if (!PRODUCT_CATEGORIES_SET.has(cat)) return true;
  if (cat === "Misc") return true;
  return false;
}

export function getDefaultSubCategory(category: string): string {
  if (CATEGORY_DEFAULT_SUBCATEGORY[category]) return CATEGORY_DEFAULT_SUBCATEGORY[category];
  const subs = PRODUCT_SUBCATEGORIES[category] ?? [];
  return subs.find((s) => s.includes("General")) ?? subs[0] ?? "";
}

/** Resolve subcategory from product name keywords */
export function resolveSubCategoryFromName(category: string, productName: string): string | null {
  const rules = SUBCATEGORY_NAME_RULES[category];
  if (!rules || !productName) return null;
  for (const rule of rules) {
    if (
      rule.keywords.test(productName) &&
      (!rule.excludeKeywords || !rule.excludeKeywords.test(productName))
    ) {
      return rule.subCategory;
    }
  }
  return null;
}

/** Try to find the best subcategory match within a known category */
function internalResolveSubCategory(input: string, category: string): string {
  if (!input) return getDefaultSubCategory(category);
  const subs = PRODUCT_SUBCATEGORIES[category] ?? [];
  const lower = input.toLowerCase().trim();

  // Exact match
  for (const sub of subs) {
    if (sub.toLowerCase() === lower) return sub;
  }

  // Substring match (longest first)
  const sortedSubs = [...subs].sort((a, b) => b.length - a.length);
  for (const sub of sortedSubs) {
    if (lower.includes(sub.toLowerCase())) return sub;
  }

  // Keyword rules for subcategory-level hints
  for (const rule of KEYWORD_RULES) {
    if (rule.category === category && rule.subCategory && rule.keywords.test(input)) {
      return rule.subCategory;
    }
  }

  return getDefaultSubCategory(category);
}

// ── Core Resolution Logic ────────────────────────────────────────────────────

function tryResolve(
  categoryVal: string,
  subCategoryVal: string,
  externalCategoryVal: string,
  productNameHint?: string,
): { category: string; subCategory: string } | null {
  const combined = [categoryVal, subCategoryVal, externalCategoryVal, productNameHint]
    .filter(Boolean)
    .join(" ");

  if (!combined) return null;

  // 0. Check excludes
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(categoryVal)) return { category: EXCLUDED_CATEGORY, subCategory: "" };
  }

  // 1. Exact match against category names
  for (const cat of PRODUCT_CATEGORIES) {
    if (cat.toLowerCase() === categoryVal.toLowerCase().trim()) {
      const sub = internalResolveSubCategory(
        subCategoryVal || externalCategoryVal || categoryVal,
        cat,
      );
      return { category: cat, subCategory: sub };
    }
  }

  // 2. Check if values match a subcategory name exactly
  for (const val of [subCategoryVal, categoryVal, externalCategoryVal]) {
    if (!val) continue;
    const lower = val.toLowerCase().trim();
    const matches: { category: string; subCategory: string }[] = [];
    for (const cat of PRODUCT_CATEGORIES) {
      const subs = PRODUCT_SUBCATEGORIES[cat] ?? [];
      for (const sub of subs) {
        if (sub.toLowerCase() === lower) {
          matches.push({ category: cat, subCategory: sub });
        }
      }
    }
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      for (const match of matches) {
        if (SUBCATEGORY_CATEGORY_PRIORITY[match.subCategory] === match.category) {
          return match;
        }
      }
      const context = [categoryVal, subCategoryVal, externalCategoryVal, productNameHint]
        .filter(Boolean)
        .join(" ");
      for (const rule of KEYWORD_RULES) {
        if (rule.keywords.test(context)) {
          const match = matches.find((m) => m.category === rule.category);
          if (match) return match;
        }
      }
      return matches[0];
    }
  }

  // 2.5. Keyword rules on individual category fields first
  for (const val of [categoryVal, subCategoryVal, externalCategoryVal]) {
    if (!val) continue;
    for (const rule of KEYWORD_RULES) {
      if (rule.keywords.test(val)) {
        const sub = rule.subCategory ?? internalResolveSubCategory(combined, rule.category);
        return { category: rule.category, subCategory: sub };
      }
    }
  }

  // 3. Keyword rules on combined text
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.test(combined)) {
      const sub = rule.subCategory ?? internalResolveSubCategory(combined, rule.category);
      return { category: rule.category, subCategory: sub };
    }
  }

  return null;
}

// ── Name Override ────────────────────────────────────────────────────────────

export function applyNameOverride(
  currentCategory: string,
  currentSubCategory: string,
  productName: string,
): { category: string; subCategory: string } {
  if (!productName || currentCategory === EXCLUDED_CATEGORY) {
    return { category: currentCategory, subCategory: currentSubCategory };
  }

  // Strong overrides
  for (const override of STRONG_NAME_OVERRIDES) {
    if (
      override.overrideCategories.includes(currentCategory) &&
      override.namePattern.test(productName)
    ) {
      const sub =
        override.subCategory ??
        resolveSubCategoryFromName(override.category, productName) ??
        getDefaultSubCategory(override.category);
      return { category: override.category, subCategory: sub };
    }
  }

  // Post-resolution fixes based on product name context

  // CBD category products with THC content → reclassify based on name
  // (e.g., "CBD Gummy 100mg THC" should be Edible, not CBD)
  if (currentCategory === "CBD" && /\bthc\b/i.test(productName)) {
    for (const rule of NAME_OVERRIDE_RULES) {
      if (rule.keywords.test(productName)) {
        const newSub =
          rule.subCategory ??
          resolveSubCategoryFromName(rule.category, productName) ??
          getDefaultSubCategory(rule.category);
        return { category: rule.category, subCategory: newSub };
      }
    }
    // Fallback: use keyword rules
    for (const rule of KEYWORD_RULES) {
      if (rule.category !== "CBD" && rule.keywords.test(productName)) {
        const newSub =
          rule.subCategory ??
          resolveSubCategoryFromName(rule.category, productName) ??
          getDefaultSubCategory(rule.category);
        return { category: rule.category, subCategory: newSub };
      }
    }
  }

  // Infused merch → Misc: rolling papers, wraps, cones with THC/infused
  if (
    currentCategory === "Merch" &&
    /\b(infused|thc|cannabis)\b/i.test(productName) &&
    /\b(papers?|wraps?|cones?|rolling|blunt\s*wraps?)\b/i.test(productName)
  ) {
    return { category: "Misc", subCategory: "Misc - General" };
  }

  // Only apply weak overrides when current resolution is weak
  if (!isWeakResolution(currentCategory)) {
    return { category: currentCategory, subCategory: currentSubCategory };
  }

  for (const rule of NAME_OVERRIDE_RULES) {
    if (rule.keywords.test(productName)) {
      const newCategory = rule.category;
      const newSubCategory =
        rule.subCategory ??
        resolveSubCategoryFromName(newCategory, productName) ??
        getDefaultSubCategory(newCategory);
      return { category: newCategory, subCategory: newSubCategory };
    }
  }

  return { category: currentCategory, subCategory: currentSubCategory };
}

// ── Merch Size Extraction ────────────────────────────────────────────────────

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

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a source category to a Treez CategoryResolution with full cascade.
 * Uses category field, externalCategory, and productName for keyword matching.
 * Falls back to Misc when nothing matches.
 */
export function resolveCategory(
  categoryField: string,
  externalCategory: string,
  productName: string,
): CategoryResolution {
  const result = tryResolve(categoryField, "", externalCategory, productName);

  let cat: string;
  let sub: string;

  if (result) {
    cat = result.category;
    sub = result.subCategory;
  } else {
    cat = "Misc";
    sub = getDefaultSubCategory("Misc");
  }

  // Apply name override
  const overridden = applyNameOverride(cat, sub, productName);
  cat = overridden.category;
  sub = overridden.subCategory;

  // Derive uom and merchSize from category
  const uom = UOM_BY_CATEGORY[cat] ?? "each";
  const merchSize = cat === "Merch" ? extractMerchSize(productName) : "";

  return { category: cat, subCategory: sub, uom, merchSize };
}

/**
 * Resolve subcategory from product name for a known category.
 * Uses per-category name rules, then falls back to default subcategory.
 */
export function resolveSubCategory(category: string, productName: string): string {
  const fromName = resolveSubCategoryFromName(category, productName);
  if (fromName) return fromName;
  return internalResolveSubCategory(productName, category);
}

/**
 * Enhanced category resolution with extended fallback context.
 * Used by the transformer when standard resolution is weak.
 */
export function enhancedCategoryResolve(
  rawCategory: string,
  rawSubCategory: string,
  rawExternalCategory: string,
  productName: string,
  extraContext: string,
): { category: string; subCategory: string } {
  const standard = tryResolve(rawCategory, rawSubCategory, rawExternalCategory, productName);
  if (standard && !isWeakResolution(standard.category)) return standard;

  const searchText = [productName, extraContext].filter(Boolean).join(" ");
  if (!searchText) return standard ?? { category: rawCategory || "", subCategory: "" };

  // Fallback A -- keyword rules on extended text
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.test(searchText)) {
      const sub = rule.subCategory ?? internalResolveSubCategory(searchText, rule.category);
      return { category: rule.category, subCategory: sub };
    }
  }

  // Fallback B -- subcategory name rules scan
  for (const [cat, rules] of Object.entries(SUBCATEGORY_NAME_RULES)) {
    for (const rule of rules) {
      if (
        rule.keywords.test(searchText) &&
        (!rule.excludeKeywords || !rule.excludeKeywords.test(searchText))
      ) {
        return { category: cat, subCategory: rule.subCategory };
      }
    }
  }

  return standard ?? { category: rawCategory || "", subCategory: "" };
}

// ── Batch Category Resolution ────────────────────────────────────────────────

export interface CategoryInput {
  category: string;
  subCategory: string;
  externalCategory: string;
}

export function categoryKey(input: CategoryInput): string {
  return `${input.category}||${input.subCategory}||${input.externalCategory}`;
}
