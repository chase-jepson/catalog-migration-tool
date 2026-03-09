// ── Parsed File ─────────────────────────────────────────────────────────────

export interface ParsedFile {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  previewRows: Record<string, string>[];
  /** Tracks origin when multiple files are merged */
  sourceFileName?: string;
}

// ── Field Mapping ───────────────────────────────────────────────────────────

export interface FieldMapping {
  fieldKey: string;
  label: string;
  sourceHeader: string | null;
}

// ── Mapping Field Definitions ───────────────────────────────────────────────

export type MappingGroup =
  | 'Product Info'
  | 'Cannabis Details'
  | 'Pricing'
  | 'Attributes'
  | 'Display & Media';

export interface MappingFieldDef {
  key: string;
  label: string;
  description: string;
  /** If true, this field is auto-mapped from POS defaults but hidden from the mapping UI */
  hidden?: boolean;
  /** UI grouping category */
  group: MappingGroup;
  /** If true, must be mapped before proceeding to Review */
  required?: boolean;
}

// ── POS Detection ───────────────────────────────────────────────────────────

export interface POSDetectionResult {
  detected: string | null;
  confidence: number;
  disagreement: boolean;
}

// ── Persisted Migration State ───────────────────────────────────────────────

export interface PersistedMigrationState {
  parsedFiles: ParsedFile[];
  mergedHeaders: string[];
  selectedPOS: string;
  mappings: FieldMapping[];
  currentStep: number;
  updatedAt: string;
}

// ── Phase 3: Derived Row ────────────────────────────────────────────────────

import type { ProductCategory } from './constants';

export interface DerivedRow {
  excluded: boolean;
  productId: string;
  productName: string;
  brand: string;
  category: string;
  subCategory: string;
  status: string;
  strain: string;
  classification: string;
  extractionMethod: string;
  uom: string;
  amount: number;
  weightInGrams: number;
  unitCount: string;
  merchSize: string;
  skuBarcode: string;
  basePrice: string;
  description: string;
  menuTitle: string;
  hideFromMenu: string;
  totalFlowerWeight: string;
  totalConcentrateWeight: string;
  thc: string;
  cbd: string;
  tags: string;
  effects: string;
  flavor: string;
  ingredients: string;
  imageFilename: string;
  priceTier: string;
}

// ── Phase 3: Category Resolution ────────────────────────────────────────────

export interface CategoryResolution {
  category: string;
  subCategory: string;
  uom: string;
  merchSize: string;
}

// ── Phase 3: Row Fix ────────────────────────────────────────────────────────

export interface RowFix {
  rowIndex: number;
  field: string;
  newValue: string;
}

// ── Phase 3: Validation Types ─────────────────────────────────────────────

export interface RowValidationError {
  rowIndex: number;
  field: string;
  currentValue: string;
  message: string;
  fixType: 'dropdown' | 'text';
  dropdownOptions?: string[];
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  validCount: number;
  errorCount: number;
  warningCount: number;
  errors: RowValidationError[];
}

export interface ErrorGroup {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  fixType: 'dropdown' | 'text';
  dropdownOptions?: string[];
  rows: { rowIndex: number; currentValue: string }[];
}

// ── Phase 3: Output CSVs ─────────────────────────────────────────────────

export interface OutputCSVs {
  brands: string[][];
  attributes: string[][];
  products: string[][];
  variants: string[][];
  attributeJoins: string[][];
  images: string[][];
}

// ── Phase 3: Transform Result ───────────────────────────────────────────────

export interface TransformResult {
  derivedRows: DerivedRow[];
  categoryResolutions: Map<string, CategoryResolution>;
}
