import * as XLSX from "xlsx";
import type { ParsedFile } from "./types";
import { MAX_FILE_SIZE } from "./constants";

export function createParsedFileId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureParsedFileId(file: ParsedFile): ParsedFile {
  if (file.id) return file;
  return { ...file, id: createParsedFileId() };
}

export function ensureParsedFileIds(files: ParsedFile[]): ParsedFile[] {
  return files.map(ensureParsedFileId);
}

/**
 * Validate a file for acceptable extension and size.
 * Returns an error string or null if valid.
 */
export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
    return "Only CSV and XLSX files are supported.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File size exceeds 100MB limit.";
  }
  return null;
}

/**
 * Detect whether the first row is a title/report header rather than column headers.
 * Heuristic: if row 1 has far fewer non-empty cells than row 2, it's a title row.
 * Handles Blaze exports that start with "Product Export - date range".
 */
export function detectHeaderRow(sheet: XLSX.WorkSheet): number {
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (aoa.length < 2) return 0;

  // Scan the first 20 rows to find the real header row.
  // The header row is the first row with many filled cells (>= 4)
  // and no cells that look like dates/timestamps or "Export Date:" style metadata.
  const maxScan = Math.min(20, aoa.length);

  // First pass: find the row with the most non-empty cells
  let bestRow = 0;
  let bestFilled = 0;
  for (let i = 0; i < maxScan; i++) {
    const filled = aoa[i].filter((c) => c !== "").length;
    if (filled > bestFilled) {
      bestFilled = filled;
      bestRow = i;
    }
  }

  // If the best row has significantly more columns than row 0, skip to it
  const row0Filled = aoa[0].filter((c) => c !== "").length;
  if (bestRow > 0 && bestFilled >= 4 && bestFilled > row0Filled * 2) {
    return bestRow;
  }

  // Fallback: if row 0 has very few cells and row 1 has more, skip row 0
  if (row0Filled <= 3 && aoa.length > 1) {
    const row1Filled = aoa[1].filter((c) => c !== "").length;
    if (row1Filled >= row0Filled * 3) {
      return 1;
    }
  }

  return 0;
}

/** Preferred sheet names -- if present, use instead of the first sheet */
const PREFERRED_SHEETS = ["Product Options"];

/**
 * Parse a CSV or XLSX file into a ParsedFile structure.
 * For multi-sheet XLSX, pass sheetName to select a specific sheet.
 */
export async function parseFile(file: File, sheetName?: string): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  // Determine which sheet to parse
  let targetSheet: string;
  if (sheetName) {
    targetSheet = sheetName;
  } else {
    const preferredSheet = workbook.SheetNames.find((name) => PREFERRED_SHEETS.includes(name));
    targetSheet = preferredSheet ?? workbook.SheetNames[0];
  }

  const sheet = workbook.Sheets[targetSheet];

  const headerRow = detectHeaderRow(sheet);

  // If we need to skip rows, adjust the sheet range
  if (headerRow > 0) {
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
    range.s.r = headerRow;
    sheet["!ref"] = XLSX.utils.encode_range(range);
  }

  const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });

  const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

  return {
    id: createParsedFileId(),
    fileName: file.name,
    fileSize: file.size,
    headers,
    rows: jsonData,
    rowCount: jsonData.length,
    previewRows: jsonData.slice(0, 10),
  };
}

/**
 * Get sheet names from an XLSX file (for multi-sheet selection UI).
 */
export async function getSheetNames(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  return workbook.SheetNames;
}

/**
 * Merge multiple parsed files into a single ParsedFile.
 * Unions all column headers and adds a "Source File" virtual column.
 * Missing values are filled with empty string.
 */
export function mergeFiles(files: ParsedFile[]): ParsedFile {
  const normalizedFiles = ensureParsedFileIds(files);
  // Collect all unique headers across files
  const allHeaders = new Set<string>();
  for (const f of normalizedFiles) {
    f.headers.forEach((h) => allHeaders.add(h));
  }

  // Add virtual "Source File" column first
  const headers = ["Source File", ...allHeaders];

  // Merge rows, filling missing columns with ''
  const rows: Record<string, string>[] = [];
  for (const f of normalizedFiles) {
    for (const row of f.rows) {
      const merged: Record<string, string> = { "Source File": f.fileName };
      for (const h of allHeaders) {
        merged[h] = row[h] ?? "";
      }
      rows.push(merged);
    }
  }

  return {
    id: createParsedFileId(),
    fileName: normalizedFiles.map((f) => f.fileName).join(", "),
    fileSize: normalizedFiles.reduce((sum, f) => sum + f.fileSize, 0),
    headers,
    rows,
    rowCount: rows.length,
    previewRows: rows.slice(0, 10),
  };
}

/**
 * Format byte count to human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
