# Catalog Logic Feedback Plan

Generated from `/Users/chase/Downloads/catalog-logic-review-notes.json`

## Batch Summary

- Exported at: 2026-04-02T17:58:06.968Z
- Reviewed notes: 9
- Valid import categories reference: Beverage, CBD, Cartridge, Edible, Extract, Flower, Merch, Misc, Non-Inv, Pill, Plant, Preroll, Tincture, Topical
- Data-skill reminder: use the import enum as the source of truth; remap blank or invalid outputs into allowed Treez categories instead of inventing new categories.

## Immediate Work

1. Preserve the valid Treez category set and eliminate blank/invalid category outputs.
2. Tighten merch/accessory heuristics for wraps, bags, and rollers.
3. Add CBD bias for hemp products without THC evidence.
4. Improve drops classification fallback.
5. Strengthen flower amount/UOM extraction for name-based weights like `3.5`.
6. Separate THC branding from real potency evidence.

## Theme Breakdown

### Merch rules

- Affected reviewed rows: 4
- Distinct products: 4

Examples:
- `file-44:6641` Lemonade - Terp Infused Wrap w/ Glass Tip: This product is infused with terpenes not THC. This should be in Merch. Lemonade is the flavor, so it was correct to disregard that information and not place it in Beverage.
- `file-35:1587` 2019 Mercedes S Class Coupe: Other is not an acceptable import Product Category. Our options are Beverage, Cartridge, CBD, Edible, Extract, Flower, Merch, Misc, Pill, Preroll, Tincture, Topical. This is a hard rule, we can never create a new category. This product belongs in Merch.
- `file-35:2188` RAW | 70mm 2-Way Roller | Skinny & Regualr: Other is not an acceptable import Product Category. Our options are Beverage, Cartridge, CBD, Edible, Extract, Flower, Merch, Misc, Pill, Preroll, Tincture, Topical. This is a hard rule, we can never create a new category. This product belongs in Merch. RAW generally makes Merch products. it's not a hard rule, but it's a safe bet to put them in Merch when the product doesn't contain THC.
- `file-19:4222` Paper Shopping Bag THC: Product Category should've been Merch. This product is a paper bag with a THC logo on it. It is in the Exit Bags category so we know it goes into Merch

### CBD rules

- Affected reviewed rows: 3
- Distinct products: 1

Examples:
- `file-43:451` Love Plus Hemp Skincare: Hemp in the product name usually means the product belongs in CBD, especially when it doesn't have THC content.
- `file-43:452` Love Plus Hemp Skincare: Hemp in the product name usually means the product belongs in CBD, especially when it doesn't have THC content.
- `file-43:453` Love Plus Hemp Skincare: Hemp in the product name usually means the product belongs in CBD, especially when it doesn't have THC content.

### Flower amount extraction

- Affected reviewed rows: 1
- Distinct products: 1

Examples:
- `file-33:1570` BULK - Cannatonic 3.5 CBD: Category should be Flower, Amount should be 3.5, uom should be Grams.

### Drops / ingestible rules

- Affected reviewed rows: 1
- Distinct products: 1

Examples:
- `file-43:1341` ZZ INV Dream Drops: Category can never be blank. Drops are usually either Tincture or Edible category
