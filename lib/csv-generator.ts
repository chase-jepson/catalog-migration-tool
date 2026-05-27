import JSZip from "jszip";
import type { DerivedRow, OutputCSVs } from "./types";
import { EACH_UOM_CATEGORIES } from "./constants";

// ── Attribute Helpers ────────────────────────────────────────────────────────

/** Filter out junk data: long strings, sentences, disclaimers */
function isValidAttribute(val: string): boolean {
  if (val.length > 80) return false;
  if ((val.match(/\s+/g) ?? []).length > 8) return false;
  if (/[.!?]{2,}/.test(val)) return false;
  if (/https?:\/\//.test(val)) return false;
  return true;
}

/** Split, clean, dedupe attribute values */
function cleanAttributeValues(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of raw.split(",")) {
    const cleaned = v.trim().replace(/\.$/, "");
    if (!cleaned || !isValidAttribute(cleaned)) continue;
    const lower = cleaned.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(cleaned);
  }
  return result;
}

/** Format amount: >= 0.0001, rounded to 4 decimal places */
function formatAmount(val: number): string {
  if (!val || val < 0.0001) return "";
  const rounded = Math.round(val * 10000) / 10000;
  return rounded.toString();
}

// ── CSV Serialization ────────────────────────────────────────────────────────

/**
 * Convert a 2D string array to a CSV string per RFC 4180.
 * Fields containing commas, quotes, or newlines are quoted;
 * embedded quotes are doubled.
 */
export function arrayToCSV(data: string[][]): string {
  return data
    .map((row) =>
      row
        .map((cell) => {
          if (
            cell.includes(",") ||
            cell.includes('"') ||
            cell.includes("\n") ||
            cell.includes("\r")
          ) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(","),
    )
    .join("\n");
}

// ── Build Output CSVs ────────────────────────────────────────────────────────

/**
 * Build the 6 output CSV arrays from derived rows.
 * Only includes rows where excluded === false.
 * Ported from v1 transformer.ts buildOutputCSVs.
 */
export function buildOutputCSVs(derived: DerivedRow[], selectedPOS?: string): OutputCSVs {
  // ── 1. Brands ──────────────────────────────────────────────────────────
  const brandSet = new Map<string, string>(); // lowercase -> winning casing
  for (const d of derived) {
    if (d.excluded || !d.brand) continue;
    const lower = d.brand.toLowerCase();
    if (!brandSet.has(lower)) {
      brandSet.set(lower, d.brand);
    }
  }
  const sortedBrands = [...brandSet.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const brandsOutput: string[][] = [
    ["Name", "Description", "Website", "ImageUrl"],
    ...sortedBrands.map((b) => [b, "", "", ""]),
  ];

  // ── 2. Attributes ──────────────────────────────────────────────────────
  const attrSet = new Map<string, string>(); // "name|category" -> category

  for (const d of derived) {
    if (d.excluded) continue;
    for (const tag of cleanAttributeValues(d.tags)) {
      attrSet.set(`${tag}|Internal Tags`, "Internal Tags");
    }
    for (const eff of cleanAttributeValues(d.effects)) {
      attrSet.set(`${eff}|Effects`, "Effects");
    }
    for (const f of cleanAttributeValues(d.flavor)) {
      attrSet.set(`${f}|Flavor`, "Flavor");
    }
    for (const ing of cleanAttributeValues(d.ingredients)) {
      attrSet.set(`${ing}|Ingredients`, "Ingredients");
    }
  }

  const attributesOutput: string[][] = [["Name", "Category"]];
  const sortedAttrs = [...attrSet.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, category] of sortedAttrs) {
    const name = key.split("|")[0];
    attributesOutput.push([name, category]);
  }

  // ── 3. Products ────────────────────────────────────────────────────────
  const seenProducts = new Set<string>();
  const productsOutput: string[][] = [
    [
      "ImportProductReferenceId",
      "TreezProductId",
      "Brand",
      "Product Name",
      "Product Category",
      "Product Sub Category",
      "Status",
      "Strain",
      "Extraction Method",
      "Classification",
      "Import Tier Reference Id",
      "PriceTierId",
      "ReferenceSource1",
      "ReferenceId1",
      "ReferenceSource2",
      "ReferenceId2",
      "ReferenceSource3",
      "ReferenceId3",
    ],
  ];

  for (const d of derived) {
    if (d.excluded) continue;
    if (!d.productId || seenProducts.has(d.productId)) continue;
    seenProducts.add(d.productId);

    productsOutput.push([
      d.productId,
      "", // TreezProductId
      d.brand,
      d.productName,
      d.category,
      d.subCategory,
      d.status,
      d.strain,
      d.extractionMethod,
      d.classification,
      "", // Import Tier Reference Id
      "", // PriceTierId
      "", // ReferenceSource1
      "", // ReferenceId1
      "", // ReferenceSource2
      "", // ReferenceId2
      "", // ReferenceSource3
      "", // ReferenceId3
    ]);
  }

  // ── 4. Variants ────────────────────────────────────────────────────────
  const variantsOutput: string[][] = [
    [
      "ImportProductReferenceId",
      "TreezProductId",
      "ImportVariantReferenceId",
      "TreezVariantId",
      "Name",
      "Label Printer",
      "UoM",
      "Liquid Volume UoM",
      "Amount",
      "Liquid Volume Amount",
      "Unit Count",
      "Merchandise Size",
      "SKU Barcode",
      "Status",
      "Base Price",
      "Description",
      "Menu Title",
      "Total Flower Weight",
      "Total Concentrate Weight",
      "Hide From Menu",
      "Use Custom SKU Name",
      "Total mg THC",
      "THC Per Dose",
      "Total mg CBD",
      "CBD Per Dose",
      "Doses",
      "Net Weight",
      "Net Weight UOM",
      "Extraction Method",
      "ReferenceSource1",
      "ReferenceId1",
      "ReferenceSource2",
      "ReferenceId2",
      "ReferenceSource3",
      "ReferenceId3",
    ],
  ];

  const seenVariants = new Set<string>();
  for (const d of derived) {
    if (d.excluded) continue;
    if (!d.skuBarcode) continue;
    if (seenVariants.has(d.skuBarcode)) continue;
    seenVariants.add(d.skuBarcode);

    variantsOutput.push([
      d.productId,
      "", // TreezProductId
      d.skuBarcode,
      "", // TreezVariantId
      d.productName,
      "", // Label Printer
      d.category === "Non-Inv" ? "each" : EACH_UOM_CATEGORIES.has(d.category) ? "" : d.uom,
      "", // Liquid Volume UoM
      d.category === "Non-Inv"
        ? "1"
        : EACH_UOM_CATEGORIES.has(d.category)
          ? ""
          : formatAmount(d.amount),
      "", // Liquid Volume Amount
      d.unitCount,
      d.merchSize,
      d.skuBarcode,
      d.status,
      d.basePrice,
      d.description,
      d.menuTitle,
      d.totalFlowerWeight,
      d.totalConcentrateWeight,
      d.hideFromMenu,
      "", // Use Custom SKU Name
      d.thc,
      "", // THC Per Dose
      d.cbd,
      "", // CBD Per Dose
      "", // Doses
      "", // Net Weight
      "", // Net Weight UOM
      d.extractionMethod,
      "", // ReferenceSource1
      "", // ReferenceId1
      "", // ReferenceSource2
      "", // ReferenceId2
      "", // ReferenceSource3
      "", // ReferenceId3
    ]);
  }

  // ── 5. Attribute Joins ─────────────────────────────────────────────────
  const attrJoinsOutput: string[][] = [
    [
      "ImportProductReferenceId",
      "TreezProductId",
      "Ingredients",
      "Aroma",
      "Internal Tags",
      "General",
      "Flavor",
      "Effects",
    ],
  ];

  const seenJoinProducts = new Set<string>();
  for (const d of derived) {
    if (d.excluded) continue;
    if (!d.productId || seenJoinProducts.has(d.productId)) continue;
    if (!d.tags && !d.effects && !d.flavor && !d.ingredients) continue;
    const cleanedIngredients = cleanAttributeValues(d.ingredients).join(", ");
    const cleanedTags = cleanAttributeValues(d.tags).join(", ");
    const cleanedEffects = cleanAttributeValues(d.effects).join(", ");
    const cleanedFlavor = cleanAttributeValues(d.flavor).join(", ");
    if (!cleanedIngredients && !cleanedTags && !cleanedEffects && !cleanedFlavor) continue;
    seenJoinProducts.add(d.productId);
    attrJoinsOutput.push([
      d.productId,
      "", // TreezProductId
      cleanedIngredients,
      "", // Aroma
      cleanedTags,
      "", // General
      cleanedFlavor,
      cleanedEffects,
    ]);
  }

  // ── 6. Images ──────────────────────────────────────────────────────────
  const imagesOutput: string[][] = [
    ["ImportVariantReferenceId", "TreezVariantId", "ImageUrl", "Name", "Order", "Description"],
  ];

  const imageOrderMap = new Map<string, number>();
  for (const d of derived) {
    if (d.excluded) continue;
    if (!d.skuBarcode || !d.imageFilename) continue;

    const currentOrder = (imageOrderMap.get(d.skuBarcode) ?? 0) + 1;
    imageOrderMap.set(d.skuBarcode, currentOrder);

    let imageUrl = d.imageFilename;
    if (!imageUrl.startsWith("http") && selectedPOS === "Dutchie") {
      imageUrl = `https://leaflogixmedia.blob.core.windows.net/product-image/${imageUrl}`;
    }

    imagesOutput.push([d.skuBarcode, "", imageUrl, "", currentOrder.toString(), ""]);
  }

  // ── 7. Skipped Products Report ───────────────────────────────────────────
  const skippedOutput: string[][] = [
    ["Row #", "Product Name", "SKU", "Category (Source)", "Reason"],
  ];
  for (let i = 0; i < derived.length; i++) {
    const d = derived[i];
    if (!d.excluded) continue;
    skippedOutput.push([
      (i + 2).toString(), // +2: 1-indexed + header row
      d.productName || "(empty)",
      d.skuBarcode || "(empty)",
      d.category === "__EXCLUDE__" ? "(excluded)" : d.category || "(none)",
      d.excludeReason || "Unknown",
    ]);
  }

  return {
    brands: brandsOutput,
    attributes: attributesOutput,
    products: productsOutput,
    variants: variantsOutput,
    attributeJoins: attrJoinsOutput,
    images: imagesOutput,
    skippedReport: skippedOutput,
  };
}

// ── ZIP Generation ──────────────────────────────────────────────────────────

const OUTPUT_FILE_LABELS: Record<keyof OutputCSVs, string> = {
  brands: "01 - Brands",
  attributes: "02 - Attributes",
  products: "04 - Products",
  variants: "05 - Variants",
  attributeJoins: "06 - Attribute Joins",
  images: "07 - Images",
  skippedReport: "08 - Skipped Products",
};

/**
 * Generate a ZIP Blob containing all 6 CSV files.
 */
export async function generateZip(csvs: OutputCSVs): Promise<Blob> {
  const zip = new JSZip();

  for (const [key, label] of Object.entries(OUTPUT_FILE_LABELS)) {
    const data = csvs[key as keyof OutputCSVs];
    zip.file(`${label}.csv`, arrayToCSV(data));
  }

  return zip.generateAsync({ type: "blob" });
}
