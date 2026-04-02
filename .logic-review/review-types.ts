import type { DerivedRow, RowValidationError } from "../lib/types";

export interface CatalogReviewReason {
  code: string;
  message: string;
  deduction: number;
}

export interface CatalogReviewConfidence {
  score: number;
  categoryConfidence: number;
  amountConfidence: number;
  thcConfidence: number;
  uomConfidence: number;
  reasons: CatalogReviewReason[];
}

export interface CatalogReviewFileSummary {
  id: string;
  posFolder: string;
  fileName: string;
  filePath: string;
  detectedPOS: string;
  detectedPOSConfidence: number;
  totalRows: number;
}

export interface CatalogReviewRow {
  id: string;
  source: {
    fileId: string;
    filePath: string;
    fileName: string;
    posFolder: string;
    detectedPOS: string;
    detectedPOSConfidence: number;
    rowIndex: number;
    originalRow: Record<string, string>;
  };
  derived: Partial<DerivedRow>;
  validation: {
    errors: RowValidationError[];
    warnings: RowValidationError[];
  };
  confidence: CatalogReviewConfidence;
}

export interface CatalogReviewData {
  generatedAt: string;
  inputRoot: string;
  files: CatalogReviewFileSummary[];
  rows: CatalogReviewRow[];
}
