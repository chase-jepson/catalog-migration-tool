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
