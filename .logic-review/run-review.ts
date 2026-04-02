import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFile } from "../lib/parser";
import { detectPOS } from "../lib/pos-detection";
import { applyPOSDefaults, updateMapping } from "../lib/mapping-engine";
import { deriveRows } from "../lib/transformer";
import { validateDerivedRows } from "../lib/validator";
import { scoreCatalogReviewRow } from "../lib/catalog-review-score";
import type { CatalogReviewData, CatalogReviewFileSummary, CatalogReviewRow } from "./review-types";
import type { FieldMapping } from "../lib/types";

export interface BuildCatalogReviewDataOptions {
  inputRoot: string;
  outputRoot: string;
}

function makeFile(filePath: string): File {
  const buffer = readFileSync(filePath);
  const name = basename(filePath);
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

function discoverExportFiles(root: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry.startsWith(".")) continue;
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      results.push(...discoverExportFiles(entryPath));
      continue;
    }

    const ext = extname(entry).toLowerCase();
    if (ext === ".csv" || ext === ".xlsx" || ext === ".xls") {
      results.push(entryPath);
    }
  }
  return results.sort();
}

function manualMappings(
  posFolder: string,
  headers: string[],
): { posName: string; mappings: FieldMapping[] } | null {
  const headerSet = new Set(headers.map((header) => header.toLowerCase()));

  if (posFolder === "Greenbits" || headerSet.has("green bits id")) {
    let mappings = applyPOSDefaults("Other");
    mappings = updateMapping(mappings, "productIdentifier", "Green Bits ID");
    mappings = updateMapping(mappings, "productName", "Name");
    mappings = updateMapping(mappings, "brand", "Brand");
    mappings = updateMapping(mappings, "productCategory", "Product Type");
    mappings = updateMapping(mappings, "productSubCategory", "Concentrate Type");
    mappings = updateMapping(mappings, "externalCategory", "Flower Type");
    mappings = updateMapping(mappings, "status", "Status");
    mappings = updateMapping(mappings, "strain", "Strain");
    mappings = updateMapping(mappings, "weight", "Weight");
    mappings = updateMapping(mappings, "basePrice", "Sell Price");
    mappings = updateMapping(mappings, "description", "Description");
    mappings = updateMapping(mappings, "thc", "THC %");
    mappings = updateMapping(mappings, "cbd", "CBD %");
    mappings = updateMapping(mappings, "tags", "Tags");
    return { posName: "Greenbits", mappings };
  }

  if (posFolder === "Square" || headerSet.has("token")) {
    let mappings = applyPOSDefaults("Other");
    mappings = updateMapping(mappings, "productIdentifier", "Token");
    mappings = updateMapping(mappings, "productName", "Item Name");
    mappings = updateMapping(mappings, "productCategory", "Category");
    mappings = updateMapping(mappings, "weight", "Variation Name");
    mappings = updateMapping(mappings, "basePrice", "Price");
    mappings = updateMapping(mappings, "description", "Description");
    mappings = updateMapping(mappings, "variantIdentifier", "Variation Name");
    return { posName: "Square", mappings };
  }

  if (posFolder === "Sweed" || headerSet.has("units in variant")) {
    let mappings = applyPOSDefaults("Other");
    mappings = updateMapping(mappings, "productName", "Product Name");
    mappings = updateMapping(mappings, "brand", "Brand");
    mappings = updateMapping(mappings, "productCategory", "Category");
    mappings = updateMapping(mappings, "productSubCategory", "Subcategory");
    mappings = updateMapping(mappings, "externalCategory", "Product Type");
    mappings = updateMapping(mappings, "weight", "Unit Size");
    mappings = updateMapping(mappings, "basePrice", "Selling Price");
    mappings = updateMapping(mappings, "variantIdentifier", "SKU");
    mappings = updateMapping(
      mappings,
      "menuTitle",
      "Display Name (Brand + Product + Product Type + Variant)",
    );
    return { posName: "Sweed", mappings };
  }

  return null;
}

function buildCatalogReviewRows(
  fileSummary: CatalogReviewFileSummary,
  parsedRows: Record<string, string>[],
  derivedRows: ReturnType<typeof deriveRows>["derivedRows"],
  mappings: FieldMapping[],
) {
  const validation = validateDerivedRows(derivedRows);
  const rows: CatalogReviewRow[] = derivedRows.map((derivedRow, rowIndex) => {
    const rowErrors = validation.errors.filter((error) => error.rowIndex === rowIndex);
    const confidence = scoreCatalogReviewRow({
      originalRow: parsedRows[rowIndex] ?? {},
      derivedRow,
      mappings,
      validationErrors: rowErrors,
      detectedPOSConfidence: fileSummary.detectedPOSConfidence,
    });

    return {
      id: `${fileSummary.id}:${rowIndex}`,
      source: {
        fileId: fileSummary.id,
        filePath: fileSummary.filePath,
        fileName: fileSummary.fileName,
        posFolder: fileSummary.posFolder,
        detectedPOS: fileSummary.detectedPOS,
        detectedPOSConfidence: fileSummary.detectedPOSConfidence,
        rowIndex,
        originalRow: buildOriginalReviewRow(parsedRows[rowIndex] ?? {}, mappings),
      },
      derived: {
        productName: derivedRow.productName,
        brand: derivedRow.brand,
        category: derivedRow.category,
        subCategory: derivedRow.subCategory,
        classification: derivedRow.classification,
        uom: derivedRow.uom,
        amount: derivedRow.amount,
        thc: derivedRow.thc,
        cbd: derivedRow.cbd,
        basePrice: derivedRow.basePrice,
      },
      validation: {
        errors: rowErrors.filter((error) => error.severity === "error"),
        warnings: rowErrors.filter((error) => error.severity === "warning"),
      },
      confidence,
    };
  });

  rows.sort((left, right) => left.confidence.score - right.confidence.score);
  return rows;
}

function buildOriginalReviewRow(
  originalRow: Record<string, string>,
  mappings: FieldMapping[],
): Record<string, string> {
  const priorityFieldKeys = new Set([
    "productIdentifier",
    "variantIdentifier",
    "productName",
    "brand",
    "productCategory",
    "productSubCategory",
    "externalCategory",
    "classification",
    "weight",
    "thc",
    "cbd",
    "basePrice",
    "priceType",
  ]);
  const selectedHeaders = new Set(
    mappings
      .filter((mapping) => priorityFieldKeys.has(mapping.fieldKey))
      .map((mapping) => mapping.sourceHeader)
      .filter((header): header is string => Boolean(header)),
  );

  const result: Record<string, string> = {};

  for (const header of selectedHeaders) {
    const value = originalRow[header];
    if (value && value.trim() !== "") {
      result[header] = truncateValue(value);
    }
  }

  if (Object.keys(result).length >= 6) {
    return result;
  }

  for (const [key, value] of Object.entries(originalRow)) {
    if (value.trim() === "" || result[key]) continue;
    result[key] = truncateValue(value);
    if (Object.keys(result).length >= 8) break;
  }

  return result;
}

function truncateValue(value: string, maxLength = 240): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

export async function buildCatalogReviewData({
  inputRoot,
  outputRoot,
}: BuildCatalogReviewDataOptions): Promise<CatalogReviewData> {
  mkdirSync(outputRoot, { recursive: true });
  const discoveredFiles = discoverExportFiles(inputRoot);
  const files: CatalogReviewFileSummary[] = [];
  const rows: CatalogReviewRow[] = [];

  for (const filePath of discoveredFiles) {
    const parsed = await parseFile(makeFile(filePath));
    const relPath = relative(inputRoot, filePath);
    const [posFolder = "Unknown"] = relPath.split(/[\\/]/);
    const manual = manualMappings(posFolder, parsed.headers);

    const detection = manual
      ? {
          detectedPOS: manual.posName,
          detectedPOSConfidence: 1,
          mappings: manual.mappings,
        }
      : (() => {
          const detected = detectPOS([parsed]);
          const detectedPOS = detected.detected || "Other";
          return {
            detectedPOS,
            detectedPOSConfidence: detected.confidence,
            mappings: applyPOSDefaults(detectedPOS),
          };
        })();

    const derived = deriveRows(parsed.rows, detection.mappings).derivedRows;
    const fileSummary: CatalogReviewFileSummary = {
      id: `file-${files.length + 1}`,
      posFolder,
      fileName: basename(filePath),
      filePath,
      detectedPOS: detection.detectedPOS,
      detectedPOSConfidence: detection.detectedPOSConfidence,
      totalRows: parsed.rowCount,
    };

    files.push(fileSummary);
    rows.push(...buildCatalogReviewRows(fileSummary, parsed.rows, derived, detection.mappings));
  }

  rows.sort((left, right) => left.confidence.score - right.confidence.score);

  return {
    generatedAt: new Date().toISOString(),
    inputRoot: resolve(inputRoot),
    files,
    rows,
  };
}

export function writeCatalogReviewData(data: CatalogReviewData, outputRoot: string): string {
  mkdirSync(outputRoot, { recursive: true });
  const outputPath = join(outputRoot, "review-data.json");
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  return outputPath;
}

export async function main() {
  const inputRoot = process.argv[2] ?? resolveDefaultInputRoot();
  const outputRoot = process.argv[3] ?? resolve(".logic-review/output");

  const data = await buildCatalogReviewData({ inputRoot, outputRoot });
  const outputPath = writeCatalogReviewData(data, outputRoot);
  console.log(`Wrote review data for ${data.files.length} files to ${outputPath}`);
}

function resolveDefaultInputRoot(): string {
  const candidates = [
    resolve(".test-data/exports/catalog"),
    resolve("../../.test-data/exports/catalog"),
  ];

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return candidates[0];
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
