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
  | 'Display & Media'
  | 'Product Matching'
  | 'Inventory Data'
  | 'Location'
  | 'Customer Type'
  | 'Dates'
  | 'Distributor'
  | 'Invoice';

export type InventoryMappingGroup =
  | 'Product Matching'
  | 'Inventory Data'
  | 'Location'
  | 'Cannabis Details'
  | 'Customer Type'
  | 'Dates'
  | 'Distributor'
  | 'Invoice'
  | 'Product Info';

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

export interface ImportProgress {
  status: 'idle' | 'uploading' | 'complete' | 'error';
  message?: string;
}

export interface PersistedMigrationState {
  parsedFiles: ParsedFile[];
  mergedHeaders: string[];
  selectedPOS: string;
  mappings: FieldMapping[];
  fixes: RowFix[];
  currentStep: number;
  updatedAt: string;
  importProgress?: ImportProgress;
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

// ── Phase 3: Import Types ─────────────────────────────────────────────────

export type FileStatus = 'pending' | 'uploading' | 'processing' | 'done' | 'failed' | 'done_with_warnings';
export type ImportObjectType = 'brands' | 'attributes' | 'products' | 'variants' | 'attributeJoins' | 'images';

export interface ImportFileState {
  key: ImportObjectType;
  label: string;
  status: FileStatus;
  rowCount: number;
  processedCount: number;
  errorCount: number;
  error?: string;
}

export interface DetailedImportProgress {
  files: ImportFileState[];
  startTime: number;
  currentFileIndex: number;
  completed: boolean;
  cancelled: boolean;
}

export interface ImportJob {
  id: string;
  name: string;
  status: string;
  finishedAt: string | null;
  totalRows: number | null;
  countProcessed: number;
  countError: number;
}

export const OUTPUT_FILE_ORDER: ImportObjectType[] = [
  'brands', 'attributes', 'products', 'variants', 'attributeJoins', 'images',
];

export const OUTPUT_FILE_LABELS: Record<ImportObjectType, string> = {
  brands: 'Brands',
  attributes: 'Attributes',
  products: 'Products',
  variants: 'Variants',
  attributeJoins: 'Attribute Joins',
  images: 'Images',
};

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

// ── Phase 4: Inventory Types ────────────────────────────────────────────────

export interface StoreInfo {
  entityId: string;
  name: string;
}

/** File roles for multi-file inventory upload */
export type InventoryFileRole = 'inventory' | 'receipts' | 'vendors' | 'adjustments' | 'catalog_export';

export interface InventoryFileAssignment {
  file: ParsedFile;
  role: InventoryFileRole;
}

/** Full 56-column derived row for inventory import */
export interface InventoryDerivedRow {
  // Identity
  treezVariantId: string;
  variantReferenceId: string;
  dispensaryLicense: string;
  // Invoice
  invoiceId: string;
  invoiceCreatedDate: string;
  manifestNumber: string;
  // Trace
  traceTreezId: string;
  inventoryBarcodes: string;
  // Quantities
  originalUnitCount: string;
  units: string;
  unitCost: string;
  // Dates
  harvestDate: string;
  expirationDate: string;
  packagedDate: string;
  // Customer / Location
  customerType: string;
  thcAmount: string;
  thcUom: string;
  cbdAmount: string;
  cbdUom: string;
  locationPath: string;
  locationInventoryType: string;
  locationIsSellable: string;
  locationDefaultReceivingLocation: string;
  // Distributor (32 columns)
  distributorName: string;
  distributorDBA: string;
  distributorAddress: string;
  distributorPhoneNumber: string;
  distributorEmail: string;
  distributorType: string;
  distributorDefaultPaymentTerm: string;
  distributorLeadTime: string;
  distributorDeliveryDays: string;
  distributorPreferredPaymentMethod: string;
  distributorLicense1Type: string;
  distributorLicense1Number: string;
  distributorLicense1ExpirationDate: string;
  distributorLicense2Type: string;
  distributorLicense2Number: string;
  distributorLicense2ExpirationDate: string;
  distributorLicense3Type: string;
  distributorLicense3Number: string;
  distributorLicense3ExpirationDate: string;
  distributorRep1Name: string;
  distributorRep1Phone: string;
  distributorRep1Email: string;
  distributorRep1Role: string;
  distributorRep1Notes: string;
  distributorRep2Name: string;
  distributorRep2Phone: string;
  distributorRep2Email: string;
  distributorRep2Role: string;
  distributorRep2Notes: string;
  distributorRep3Name: string;
  distributorRep3Phone: string;
  distributorRep3Email: string;
  distributorRep3Role: string;
  distributorRep3Notes: string;
  // Internal tracking (not output columns)
  productSKU: string;
  externalPackageId: string;
  productCategory: string;
  excluded: boolean;
  _rowNumber?: number;
}

export interface PersistedInventoryState {
  parsedFiles: ParsedFile[];
  mergedHeaders: string[];
  selectedPOS: string;
  selectedStore: StoreInfo | null;
  mappings: FieldMapping[];
  fixes: RowFix[];
  currentStep: number;
  updatedAt: string;
  importProgress?: ImportProgress;
  fileAssignments: InventoryFileAssignment[];
  dispensaryLicense: string;
}
