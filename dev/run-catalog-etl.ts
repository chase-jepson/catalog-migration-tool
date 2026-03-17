/**
 * Local ETL runner v2: processes ALL catalog exports from the folder structure,
 * transforms them, generates output CSVs, and writes flagged-summary.json.
 */
import * as fs from "fs";
import * as path from "path";
import { parseFile } from "../lib/parser";
import { detectPOS } from "../lib/pos-detection";
import { applyPOSDefaults, updateMapping } from "../lib/mapping-engine";
import { deriveRows } from "../lib/transformer";
import { validateDerivedRows } from "../lib/validator";
import { buildOutputCSVs, arrayToCSV } from "../lib/csv-generator";
import type { ParsedFile, FieldMapping, DerivedRow } from "../lib/types";

// ── File shim ───────────────────────────────────────────────────────────────

function makeFile(filePath: string): File {
  const buffer = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return {
    name,
    size: buffer.length,
    type: "",
    lastModified: 0,
    webkitRelativePath: "",
    arrayBuffer: () => Promise.resolve(ab),
    text: () => Promise.resolve(buffer.toString("utf-8")),
    slice: () => new Blob(),
    stream: () => new ReadableStream(),
    bytes: () => Promise.resolve(new Uint8Array(ab)),
  } as File;
}

// ── Manual mappings for unsupported POS systems ─────────────────────────────

function manualMappings(
  posFolder: string,
  headers: string[],
): { posName: string; mappings: FieldMapping[] } | null {
  const headerSet = new Set(headers.map((h) => h.toLowerCase()));

  // Greenbits
  if (posFolder === "Greenbits" || headerSet.has("green bits id")) {
    let m = applyPOSDefaults("Other");
    m = updateMapping(m, "productIdentifier", "Green Bits ID");
    m = updateMapping(m, "productName", "Name");
    m = updateMapping(m, "brand", "Brand");
    m = updateMapping(m, "productCategory", "Product Type");
    m = updateMapping(m, "productSubCategory", "Concentrate Type");
    m = updateMapping(m, "externalCategory", "Flower Type");
    m = updateMapping(m, "status", "Status");
    m = updateMapping(m, "strain", "Strain");
    m = updateMapping(m, "weight", "Weight");
    m = updateMapping(m, "basePrice", "Sell Price");
    m = updateMapping(m, "description", "Description");
    m = updateMapping(m, "thc", "THC %");
    m = updateMapping(m, "cbd", "CBD %");
    m = updateMapping(m, "tags", "Tags");
    return { posName: "Greenbits", mappings: m };
  }

  // Square
  if (posFolder === "Square" || headerSet.has("token")) {
    let m = applyPOSDefaults("Other");
    m = updateMapping(m, "productIdentifier", "Token");
    m = updateMapping(m, "productName", "Item Name");
    m = updateMapping(m, "productCategory", "Category");
    m = updateMapping(m, "weight", "Variation Name"); // often contains weight info in name
    m = updateMapping(m, "basePrice", "Price");
    m = updateMapping(m, "description", "Description");
    m = updateMapping(m, "variantIdentifier", "Variation Name");
    return { posName: "Square", mappings: m };
  }

  // Sweed
  if (posFolder === "Sweed" || headerSet.has("units in variant")) {
    let m = applyPOSDefaults("Other");
    m = updateMapping(m, "productName", "Product Name");
    m = updateMapping(m, "brand", "Brand");
    m = updateMapping(m, "productCategory", "Category");
    m = updateMapping(m, "productSubCategory", "Subcategory");
    m = updateMapping(m, "externalCategory", "Product Type");
    m = updateMapping(m, "weight", "Unit Size");
    m = updateMapping(m, "basePrice", "Selling Price");
    m = updateMapping(m, "variantIdentifier", "SKU");
    m = updateMapping(m, "menuTitle", "Display Name (Brand + Product + Product Type + Variant)");
    return { posName: "Sweed", mappings: m };
  }

  return null;
}

// ── Flagging logic ──────────────────────────────────────────────────────────

interface FlaggedRow {
  rowIndex: number;
  originalRow: Record<string, string>;
  derivedRow: DerivedRow;
  reasons: string[];
}

function flagSuspiciousRows(
  parsed: ParsedFile,
  derived: DerivedRow[],
  mappings: FieldMapping[],
): FlaggedRow[] {
  const flagged: FlaggedRow[] = [];
  const fieldToSource: Record<string, string> = {};
  for (const m of mappings) {
    if (m.sourceHeader) fieldToSource[m.fieldKey] = m.sourceHeader;
  }

  for (let i = 0; i < derived.length; i++) {
    const d = derived[i];
    const orig = parsed.rows[i];
    if (!orig) continue;
    const reasons: string[] = [];
    const nameLower = (d.productName || "").toLowerCase();

    // 1. Category empty or "Other"
    if (!d.category || d.category === "Other") {
      const srcCat = fieldToSource["productCategory"] ? orig[fieldToSource["productCategory"]] : "";
      reasons.push(`Category resolved to "${d.category || "(empty)"}" from source "${srcCat}"`);
    }

    // 2. SubCategory empty when category exists
    if (d.category && d.category !== "Other" && !d.subCategory) {
      reasons.push(`SubCategory is empty for category "${d.category}"`);
    }

    // 3. Classification vs product name
    if (d.classification) {
      if (d.classification === "Sativa" && nameLower.includes("indica") && !nameLower.includes("sativa")) {
        reasons.push(`Classification "${d.classification}" but product name contains "indica"`);
      }
      if (d.classification === "Indica" && nameLower.includes("sativa") && !nameLower.includes("indica")) {
        reasons.push(`Classification "${d.classification}" but product name contains "sativa"`);
      }
    }

    // 4. Weight/Amount issues
    if (d.amount === 0 && d.category !== "Accessories" && d.category !== "Other" && d.category !== "Merch" && d.category !== "Non-Inv") {
      const srcWeight = fieldToSource["weight"] ? orig[fieldToSource["weight"]] : "";
      if (srcWeight && srcWeight !== "0" && srcWeight !== "") {
        reasons.push(`Amount is 0 but source had weight "${srcWeight}"`);
      }
    }
    if (d.amount > 50000) {
      reasons.push(`Amount ${d.amount} seems unusually large`);
    }

    // 5. UOM vs category
    if (d.category === "Flower" && d.uom !== "grams" && d.uom !== "" && d.amount > 0) {
      reasons.push(`Flower product with UOM "${d.uom}" (expected grams)`);
    }
    if (d.category === "Edible" && d.uom === "grams" && d.amount > 0) {
      reasons.push(`Edible product with UOM "grams" (expected "each" or "milligrams")`);
    }

    // 6. THC/CBD source vs output — skip when UOM is grams (THC is always blank for gram products)
    const zeroish = new Set(["0", "0.0", "0.00", "0%", "0.0%", "0.00%", "N/A", "n/a", "NA", "", "None", "none"]);
    const srcTHC = fieldToSource["thc"] ? orig[fieldToSource["thc"]] : "";
    const srcCBD = fieldToSource["cbd"] ? orig[fieldToSource["cbd"]] : "";
    if (d.uom !== "grams" && srcTHC && !zeroish.has(srcTHC.trim()) && parseFloat(srcTHC.replace(/[^0-9.]/g, "")) > 0.5 && !d.thc) {
      reasons.push(`Source THC "${srcTHC}" but output THC is empty`);
    }
    if (d.uom !== "grams" && srcCBD && !zeroish.has(srcCBD.trim()) && parseFloat(srcCBD.replace(/[^0-9.]/g, "")) > 0.5 && !d.cbd) {
      reasons.push(`Source CBD "${srcCBD}" but output CBD is empty`);
    }

    // 7. Price lost
    const srcPrice = fieldToSource["basePrice"] ? orig[fieldToSource["basePrice"]] : "";
    if (srcPrice && parseFloat(srcPrice.replace(/[$,]/g, "")) > 0 && (!d.basePrice || d.basePrice === "0")) {
      reasons.push(`Source price "${srcPrice}" but output basePrice is "${d.basePrice}"`);
    }

    // 8. Brand lost — ignore placeholder values
    const brandPlaceholders = new Set(["n/a", "na", "none", "-", "--", "unknown", "other", "generic", "no brand", "unbranded"]);
    const srcBrand = fieldToSource["brand"] ? orig[fieldToSource["brand"]] : "";
    if (srcBrand && srcBrand.trim() !== "" && !brandPlaceholders.has(srcBrand.trim().toLowerCase()) && !d.brand) {
      reasons.push(`Source brand "${srcBrand}" but output brand is empty`);
    }

    // 9. Product name empty
    if (!d.productName || d.productName.trim() === "") {
      reasons.push(`Product name is empty`);
    }

    // 10. Category-specific weight checks
    if (d.category === "Flower" && d.amount > 0 && d.amount < 0.5) {
      reasons.push(`Flower with weight ${d.amount}g seems very small`);
    }
    if (d.category === "Extract" && d.amount > 100) {
      reasons.push(`Extract with weight ${d.amount} seems very large`);
    }
    if (d.category === "Edible" && d.amount > 5000) {
      reasons.push(`Edible with amount ${d.amount} seems very large`);
    }

    // 11. Status non-standard
    if (d.status && !["active", "inactive", "draft"].includes(d.status.toLowerCase())) {
      reasons.push(`Status "${d.status}" is non-standard`);
    }

    // 12. Classification empty — only flag when source actually contains a classification keyword
    if (!d.classification && ["Flower", "Extract", "Preroll", "Cartridge"].includes(d.category)) {
      const srcClass = fieldToSource["classification"] ? orig[fieldToSource["classification"]] : "";
      const classKeywords = /\b(sativa|indica|hybrid|hbrid|i\/s|s\/i|cbd)\b|\[H\]|\[S\]|\[I\]/i;
      if (srcClass && srcClass.trim() && classKeywords.test(srcClass)) {
        reasons.push(`Classification empty but source had "${srcClass}"`);
      }
    }

    if (reasons.length > 0) {
      flagged.push({ rowIndex: i, originalRow: orig, derivedRow: d, reasons });
    }
  }
  return flagged;
}

// ── Sampling ────────────────────────────────────────────────────────────────

function sampleFlags(allFlagged: FlaggedRow[]): FlaggedRow[] {
  const MAX_PER_PATTERN = 15;
  const reasonPatterns: Record<string, FlaggedRow[]> = {};
  for (const f of allFlagged) {
    for (const r of f.reasons) {
      const pattern = r.replace(/"[^"]*"/g, '"..."').replace(/\d+\.?\d*/g, "N");
      if (!reasonPatterns[pattern]) reasonPatterns[pattern] = [];
      reasonPatterns[pattern].push(f);
    }
  }

  const seenRows = new Set<number>();
  const result: FlaggedRow[] = [];

  for (const [, rows] of Object.entries(reasonPatterns)) {
    if (rows.length < 50) {
      for (const r of rows) {
        if (!seenRows.has(r.rowIndex)) { seenRows.add(r.rowIndex); result.push(r); }
      }
    }
  }
  for (const [, rows] of Object.entries(reasonPatterns)) {
    if (rows.length >= 50) {
      const step = Math.max(1, Math.floor(rows.length / MAX_PER_PATTERN));
      let added = 0;
      for (let j = 0; j < rows.length && added < MAX_PER_PATTERN; j += step) {
        if (!seenRows.has(rows[j].rowIndex)) { seenRows.add(rows[j].rowIndex); result.push(rows[j]); added++; }
      }
    }
  }
  return result;
}

// ── Main ────────────────────────────────────────────────────────────────────

const INPUT_DIR = "/Users/chase/Downloads/Catalog Migration Tool/Exports/Catalog";
const OUTPUT_DIR = "/Users/chase/projects/catalog-migration-tool/dev/output";
const FILE_FILTER = process.argv[2] ? path.resolve(process.argv[2]) : "";

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const summaryData: any[] = [];

  // Iterate through POS folders
  const posFolders = FILE_FILTER
    ? [path.basename(path.dirname(FILE_FILTER))]
    : fs.readdirSync(INPUT_DIR).filter((f) => {
        const fp = path.join(INPUT_DIR, f);
        return fs.statSync(fp).isDirectory() && !f.startsWith(".");
      });

  for (const posFolder of posFolders) {
    const folderPath = FILE_FILTER ? path.dirname(FILE_FILTER) : path.join(INPUT_DIR, posFolder);
    const files = FILE_FILTER
      ? [path.basename(FILE_FILTER)]
      : fs.readdirSync(folderPath).filter((f) => {
          const ext = path.extname(f).toLowerCase();
          return (ext === ".csv" || ext === ".xlsx" || ext === ".xls") && !f.startsWith(".");
        });

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Processing: ${posFolder}/${file}`);
      console.log(`${"=".repeat(60)}`);

      try {
        // 1. Parse
        const fileObj = makeFile(filePath);
        const parsed = await parseFile(fileObj);
        console.log(`  Rows: ${parsed.rowCount}, Columns: ${parsed.headers.length}`);
        if (parsed.rowCount === 0) { console.log("  SKIPPED: no data rows"); continue; }

        // 2. Detect POS or use manual mappings
        const manual = manualMappings(posFolder, parsed.headers);
        let posName: string;
        let mappings: FieldMapping[];

        if (manual) {
          posName = manual.posName;
          mappings = manual.mappings;
          console.log(`  POS: ${posName} (manual mapping)`);
        } else {
          const posResult = detectPOS([parsed]);
          posName = posResult.detected || "Other";
          mappings = applyPOSDefaults(posName);
          console.log(`  POS: ${posName} (confidence: ${(posResult.confidence * 100).toFixed(0)}%)`);
        }

        const mapped = mappings.filter((m) => m.sourceHeader !== null);
        console.log(`  Mapped fields: ${mapped.length}/${mappings.length}`);

        // 3. Transform
        const { derivedRows } = deriveRows(parsed.rows, mappings);
        console.log(`  Derived rows: ${derivedRows.length}`);

        // 4. Validate
        const validation = validateDerivedRows(derivedRows);
        console.log(`  Valid: ${validation.validCount}, Errors: ${validation.errorCount}, Warnings: ${validation.warningCount}`);

        // 5. Generate CSVs
        const csvs = buildOutputCSVs(derivedRows, posName);
        const posDir = path.join(OUTPUT_DIR, posFolder.replace(/\s+/g, "_"), file.replace(/\.[^.]+$/, ""));
        fs.mkdirSync(posDir, { recursive: true });
        for (const [key, data] of Object.entries(csvs)) {
          fs.writeFileSync(path.join(posDir, `${key}.csv`), arrayToCSV(data as string[][]));
        }

        // 6. Flag and sample
        const allFlagged = flagSuspiciousRows(parsed, derivedRows, mappings);
        const flaggedRows = sampleFlags(allFlagged);
        console.log(`  Raw flagged: ${allFlagged.length} → Sampled: ${flaggedRows.length}`);

        // Use a composite label for the tab
        const label = `${posFolder} - ${file.replace(/\.[^.]+$/, "")}`;

        summaryData.push({
          posName: label,
          fileName: `${posFolder}/${file}`,
          totalRows: parsed.rowCount,
          derivedCount: derivedRows.length,
          flaggedCount: flaggedRows.length,
          errorCount: validation.errorCount,
          warningCount: validation.warningCount,
          headers: parsed.headers,
          flaggedRows: flaggedRows.map((f) => ({
            rowIndex: f.rowIndex,
            reasons: f.reasons,
            original: f.originalRow,
            derived: {
              productName: f.derivedRow.productName,
              brand: f.derivedRow.brand,
              category: f.derivedRow.category,
              subCategory: f.derivedRow.subCategory,
              classification: f.derivedRow.classification,
              uom: f.derivedRow.uom,
              amount: f.derivedRow.amount,
              weightInGrams: f.derivedRow.weightInGrams,
              merchSize: f.derivedRow.merchSize,
              basePrice: f.derivedRow.basePrice,
              thc: f.derivedRow.thc,
              cbd: f.derivedRow.cbd,
              status: f.derivedRow.status,
              strain: f.derivedRow.strain,
              unitCount: f.derivedRow.unitCount,
              skuBarcode: f.derivedRow.skuBarcode,
              extractionMethod: f.derivedRow.extractionMethod,
              hideFromMenu: f.derivedRow.hideFromMenu,
            },
          })),
        });
      } catch (err) {
        console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "flagged-summary.json"), JSON.stringify(summaryData, null, 2));
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total files processed: ${summaryData.length}`);
  console.log(`Total flagged: ${summaryData.reduce((s, r) => s + r.flaggedCount, 0)}`);
  for (const r of summaryData) {
    console.log(`  ${r.posName}: ${r.totalRows} rows → ${r.flaggedCount} flagged`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
