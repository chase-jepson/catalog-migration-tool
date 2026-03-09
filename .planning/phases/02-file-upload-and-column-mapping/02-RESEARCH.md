# Phase 2: File Upload and Column Mapping - Research

**Researched:** 2026-03-09
**Domain:** File parsing, POS detection, column mapping UI, Chrome extension storage
**Confidence:** HIGH

## Summary

Phase 2 builds the Upload and Map steps of the wizard. The core technical challenges are: (1) parsing CSV/XLSX files including multi-file upload with column union, (2) auto-detecting POS systems from column headers, (3) presenting a grouped column mapping UI with sample previews, and (4) persisting parsed data in chrome.storage.local for session resumption. The v1 codebase provides proven patterns for all of these -- POS detection scoring, mapping field definitions, per-POS default templates, and storage persistence -- that should be ported and enhanced rather than rebuilt.

The biggest performance concern is parsing 10k+ row files without freezing the side panel UI. The v1 approach parses synchronously on the main thread using SheetJS `xlsx`, which works but blocks the UI during parsing. For v2, a Web Worker or chunked approach is recommended. Since the side panel is a normal web page context, standard Web Worker APIs are available. The simplest approach is an inline worker (blob URL) that receives an ArrayBuffer and returns parsed JSON.

**Primary recommendation:** Port v1's POS_DEFAULTS, MAPPING_FIELDS, parser, and detection logic. Use SheetJS `xlsx` for both CSV and XLSX (unified parser). Add a Web Worker wrapper for non-blocking parsing. Persist parsed data in chrome.storage.local with "unlimitedStorage" permission.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Compact card at top of Upload step with file icon and "Choose file" button, drag-and-drop as secondary
- Multi-select in file picker -- users may need to upload multiple CSVs (e.g., active + inactive products)
- Accept CSV and XLSX; for XLSX with multiple sheets, show a sheet selector
- Progress bar with row count ("Parsing row X of Y...") for large file feedback
- After parse: file summary card showing file name, size, row count, detected columns
- "Change file" link on summary card allows re-upload without restarting wizard
- Different column structures OK across multiple files -- union all columns, fill missing with empty
- Track source file origin: virtual "Source File" column so users see which file each row came from in Review step
- Auto-detect POS system immediately after file parsing, show result on file summary card
- Header signature matching: score each POS by counting matching column headers against known defaults (v1 approach: >=3 matches AND >40% match rate)
- Display as simple label: "Detected: Dutchie" with a "Change" link
- "Change" opens a dropdown: Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova, Other
- One POS per migration -- all files must be from same POS
- Multi-file detection: majority vote across files; show note if files disagree
- "Other" proceeds with best-effort mapping (column name similarity) + "Clear all mappings" button
- Hybrid approach: Treez target fields grouped by category (Product Info, Attributes, Pricing, Cannabis Details, etc.)
- Each row: target field label -> source column dropdown with sample value preview from CSV data
- Auto-mapped fields pre-selected from POS-specific templates (v1's POS_DEFAULTS pattern)
- Unmapped required fields: red outline on dropdown + count badge on group header ("2 unmapped")
- Cannot proceed to Review until all required fields are mapped
- Toolbar: "Clear all" (removes everything) and "Reset to auto" (re-applies POS template defaults)
- Collapsible "Preview Data" section at bottom of Map step only
- Horizontally scrollable table, column headers color-coded: green tint for mapped, yellow/gray for unmapped
- Clicking a column header in preview scrolls to and highlights the corresponding mapping row above
- Persist parsed data in chrome.storage.local so reopening the side panel resumes where user left off

### Claude's Discretion
- Upload error presentation style (inline error vs toast)
- Parsing approach (Web Worker vs chunked main thread)
- Preview row count
- Side panel width and spacing details
- Exact group names for mapping categories
- Collapsible section animation/behavior

### Deferred Ideas (OUT OF SCOPE)
- MAP-03 (saved mappings per org/POS combo) -- Phase 4 (requires backend persistence)
- Mapping preview with sample data alongside mapping UI (ENH-07) -- v2 enhancement
- Multiple file upload per migration (ENH-04) -- partially addressed here (multi-select), full version in v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILE-01 | User can upload CSV or XLSX files via drag-and-drop or file picker | SheetJS `xlsx` handles both formats; v1 parser.ts has working implementation; drag-and-drop + file input pattern from v1 UploadStep |
| FILE-02 | Tool auto-detects POS system from file column headers | v1 `scorePOS()` function with >=3 matches AND >40% threshold; POS_DEFAULTS keys define header signatures |
| FILE-03 | User can manually select POS system if auto-detection fails | Dropdown with POS_SYSTEMS list + "Other" option; v1 has working pattern |
| FILE-04 | Tool handles large files (10k+ rows) without crashing or freezing | Web Worker for parsing + progress callback; "unlimitedStorage" permission for chrome.storage.local |
| MAP-01 | Tool auto-maps source columns to Treez fields using POS-specific templates | POS_DEFAULTS from v1 constants.ts provides 6 POS templates; MAPPING_FIELDS defines 24 target fields |
| MAP-02 | User can manually override any column mapping via dropdown | v1 HeaderMapping component pattern; enhanced with grouping and sample previews per CONTEXT decisions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xlsx (SheetJS CE) | ^0.18.5 | Parse CSV and XLSX files | Unified parser for both formats; proven in v1; handles edge cases (title rows, multi-sheet, encoding) |
| react | ^19.1.0 | UI components | Already installed in project |
| tailwindcss | ^4.1.4 | Styling | Already installed; teal-600 primary established in Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | SheetJS handles CSV natively -- PapaParse is unnecessary when xlsx is already a dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| xlsx for CSV | PapaParse | PapaParse is faster for pure CSV, but xlsx handles both CSV and XLSX -- single parser is simpler |
| Custom Web Worker | @koale/useworker | Tiny library but adds dependency for what is ~30 lines of inline worker code |

**Installation:**
```bash
pnpm add xlsx
```

Note: `xlsx` is the only new dependency. The v1 also used PapaParse but SheetJS handles CSV parsing natively via `XLSX.read()`, so a single library covers both formats.

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── types.ts              # Shared types (ParsedFile, FieldMapping, etc.)
├── constants.ts          # Extended with MAPPING_FIELDS, POS_DEFAULTS, POS_SYSTEMS
├── parser.ts             # File parsing (SheetJS wrapper)
├── parser.worker.ts      # Web Worker for non-blocking parse (or inline)
├── pos-detection.ts      # POS auto-detection scoring logic
├── mapping-store.ts      # chrome.storage.local persistence for mappings + parsed data
├── messaging.ts          # Extended with new message types if needed
components/
├── wizard/
│   ├── WizardShell.tsx   # Modified: render step components instead of StepPlaceholder
│   ├── StepIndicator.tsx # Unchanged
│   └── StepPlaceholder.tsx # Still used for Review/Import steps
├── upload/
│   ├── UploadStep.tsx    # File upload + POS detection (wizard step 0)
│   ├── FileDropZone.tsx  # Drag-and-drop + file picker compact card
│   ├── FileSummaryCard.tsx # Post-upload file info display
│   └── SheetSelector.tsx  # XLSX multi-sheet selector modal/dropdown
└── mapping/
    ├── MappingStep.tsx    # Column mapping (wizard step 1)
    ├── MappingGroup.tsx   # Collapsible group of mapping rows
    ├── MappingRow.tsx     # Single target field -> source column dropdown
    ├── MappingToolbar.tsx # Clear all / Reset to auto buttons
    └── DataPreview.tsx    # Collapsible preview table at bottom
```

### Pattern 1: Web Worker for File Parsing
**What:** Parse files in a Web Worker to avoid blocking the side panel UI
**When to use:** Always for file parsing (FILE-04 requirement)
**Example:**
```typescript
// lib/parser.ts - Main thread API
export function parseFileInWorker(
  file: File,
  onProgress?: (parsed: number, total: number) => void
): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    // Create inline worker from blob URL
    const workerCode = `
      importScripts('${chrome.runtime.getURL("xlsx.full.min.js")}');
      self.onmessage = function(e) {
        const { buffer, fileName, fileSize } = e.data;
        const workbook = XLSX.read(buffer, { type: 'array' });
        // ... parse logic ...
        self.postMessage({ type: 'complete', result });
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    file.arrayBuffer().then(buffer => {
      worker.postMessage({ buffer, fileName: file.name, fileSize: file.size }, [buffer]);
    });

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress?.(e.data.parsed, e.data.total);
      if (e.data.type === 'complete') { resolve(e.data.result); worker.terminate(); }
    };
    worker.onerror = (e) => { reject(new Error(e.message)); worker.terminate(); };
  });
}
```

**Alternative (simpler, recommended for v2 initial):** Parse on main thread with `requestIdleCallback` chunking or just use `await` with SheetJS -- SheetJS parses 10k rows in <500ms typically. The Web Worker adds complexity; chunked main-thread with a progress indicator may suffice. Test with a 10k+ row file first.

### Pattern 2: Multi-File Column Union
**What:** When multiple files are uploaded, union all column headers and fill missing values with empty strings
**When to use:** Multi-file upload scenario
**Example:**
```typescript
function mergeFiles(files: ParsedFile[]): ParsedFile {
  // Collect all unique headers across files
  const allHeaders = new Set<string>();
  for (const f of files) f.headers.forEach(h => allHeaders.add(h));

  // Add virtual "Source File" column
  const headers = ['Source File', ...allHeaders];

  // Merge rows, filling missing columns with ''
  const rows: Record<string, string>[] = [];
  for (const f of files) {
    for (const row of f.rows) {
      const merged: Record<string, string> = { 'Source File': f.fileName };
      for (const h of allHeaders) merged[h] = row[h] ?? '';
      rows.push(merged);
    }
  }

  return {
    fileName: files.map(f => f.fileName).join(', '),
    fileSize: files.reduce((sum, f) => sum + f.fileSize, 0),
    headers,
    rows,
    rowCount: rows.length,
    previewRows: rows.slice(0, 10),
  };
}
```

### Pattern 3: POS Detection with Majority Vote
**What:** Score each POS against file headers; for multi-file, use majority vote
**When to use:** After file parsing, before mapping
**Example:**
```typescript
// Direct port from v1 with multi-file extension
function scorePOS(pos: string, headers: Set<string>): { matched: number; total: number } {
  const defaults = POS_DEFAULTS[pos];
  if (!defaults) return { matched: 0, total: 0 };
  const cols = Object.values(defaults);
  const matched = cols.filter(col => headers.has(col)).length;
  return { matched, total: cols.length };
}

function detectPOS(files: ParsedFile[]): { detected: string | null; confidence: number; disagreement: boolean } {
  const votes: Record<string, number> = {};

  for (const file of files) {
    const headerSet = new Set(file.headers);
    let bestPOS: string | null = null;
    let bestScore = 0;

    for (const pos of POS_SYSTEMS) {
      const { matched, total } = scorePOS(pos, headerSet);
      if (matched >= 3 && matched / total > 0.4 && matched > bestScore) {
        bestScore = matched;
        bestPOS = pos;
      }
    }
    if (bestPOS) votes[bestPOS] = (votes[bestPOS] ?? 0) + 1;
  }

  const entries = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return { detected: null, confidence: 0, disagreement: false };

  return {
    detected: entries[0][0],
    confidence: entries[0][1] / files.length,
    disagreement: entries.length > 1,
  };
}
```

### Pattern 4: Mapping Field Grouping
**What:** Group MAPPING_FIELDS into categories for the mapping UI
**When to use:** MappingStep component rendering
**Example:**
```typescript
// Extend MappingFieldDef with group and required flag
export interface MappingFieldDef {
  key: string;
  label: string;
  description: string;
  hidden?: boolean;
  group: MappingGroup;
  required?: boolean;
}

export type MappingGroup =
  | 'Product Info'
  | 'Cannabis Details'
  | 'Pricing'
  | 'Attributes'
  | 'Display & Media';

// Group the existing 24 fields:
// Product Info: productIdentifier, productName, brand, productCategory, productSubCategory, status, description
// Cannabis Details: strain, classification, weight, thc, cbd
// Pricing: basePrice, priceTier, priceType
// Attributes: tags, effects, flavor, ingredients
// Display & Media: menuTitle, availableOnline, imageFilename, externalCategory
// Hidden (auto-mapped only): variantIdentifier
```

### Pattern 5: WizardShell Step Rendering
**What:** Replace StepPlaceholder with actual step components, with canProceed gating
**When to use:** WizardShell modification
**Example:**
```typescript
// WizardShell manages shared state and passes to step components
interface WizardState {
  parsedFiles: ParsedFile[];
  mergedFile: ParsedFile | null;
  detectedPOS: string | null;
  selectedPOS: string;
  mappings: FieldMapping[];
  canProceed: boolean;
}

// Step components call onCanProceedChange(true/false) to enable/disable Next
// Upload step: canProceed when files parsed + POS selected
// Map step: canProceed when all required fields mapped
```

### Anti-Patterns to Avoid
- **Storing raw File objects in state:** File objects are not serializable. Store parsed data (rows as plain objects), not the File reference.
- **Parsing in useEffect:** File parsing is a one-time action triggered by user upload, not a side effect of state change. Use event handlers.
- **Monolithic step component:** v1's UploadStep mixed file upload, POS detection, and saved mapping check in one 300-line component. Split into focused sub-components.
- **String-based mapping keys without validation:** Always type mapping field keys as a union type, not bare `string`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV/XLSX parsing | Custom CSV parser | SheetJS `xlsx` | Encoding, delimiters, quoted fields, date formats, multi-sheet -- enormous edge case surface |
| Title row detection | Simple "skip first row" flag | v1's `detectHeaderRow()` heuristic | Blaze exports have title rows; heuristic handles this automatically |
| File size formatting | Custom byte formatter | v1's `formatFileSize()` utility | Trivial but tested |
| Drag-and-drop | Custom DnD from scratch | HTML5 native drag events (onDrop/onDragOver) | v1 pattern works; no library needed |
| Horizontal scroll table | Custom scroll container | CSS `overflow-x: auto` on a `<div>` wrapping `<table>` | Browser handles it natively |

**Key insight:** The v1 codebase has working, tested implementations for every core feature in this phase. Port and enhance, don't rewrite from scratch.

## Common Pitfalls

### Pitfall 1: chrome.storage.local Size Limits
**What goes wrong:** Storing 10k+ rows of parsed data exceeds the 10MB default quota
**Why it happens:** chrome.storage.local defaults to 10MB; a 10k-row file with 20+ columns can easily exceed this when JSON-stringified
**How to avoid:** Add `"unlimitedStorage"` permission to manifest.json. This removes the quota limit entirely.
**Warning signs:** `chrome.runtime.lastError` on storage.set calls; data silently not persisting

### Pitfall 2: ArrayBuffer Transfer vs Copy
**What goes wrong:** Sending large ArrayBuffers to Web Workers copies the data, doubling memory usage
**Why it happens:** Default `postMessage` copies data
**How to avoid:** Use transferable objects: `worker.postMessage({ buffer }, [buffer])` -- the second argument transfers ownership instead of copying
**Warning signs:** Memory spikes during file upload

### Pitfall 3: SheetJS Bundle Size in Chrome Extension
**What goes wrong:** `xlsx` full bundle is ~1MB, inflating extension size
**Why it happens:** SheetJS includes codepage support, ODS, etc.
**How to avoid:** Use `xlsx/dist/xlsx.mini.min.js` (the mini build) if you only need XLSX/CSV reading. Or use tree-shaking with the ESM import (`import * as XLSX from 'xlsx'`). With Vite/WXT bundling, tree-shaking should work automatically.
**Warning signs:** Extension zip exceeding 2MB

### Pitfall 4: Multi-File Upload Order and State
**What goes wrong:** Users upload files one at a time, but the UI needs to handle accumulation
**Why it happens:** HTML `<input multiple>` gives all files at once, but drag-and-drop can be one-at-a-time
**How to avoid:** Maintain a `files: ParsedFile[]` array in state. Each new upload appends. Show a file list with individual remove buttons. Re-merge columns after any add/remove.
**Warning signs:** Second file replacing first file's data

### Pitfall 5: XLSX Sheet Selection
**What goes wrong:** XLSX files with multiple sheets -- wrong sheet parsed silently
**Why it happens:** v1 auto-selects first sheet or preferred sheet name; user may need a different one
**How to avoid:** Per CONTEXT decision: show a sheet selector when XLSX has multiple sheets. List sheet names, let user pick. Default to first sheet or preferred sheet (v1's "Product Options" heuristic).
**Warning signs:** Headers don't match expected POS format because wrong sheet was parsed

### Pitfall 6: Column Name Conflicts Across Files
**What goes wrong:** Two files with same column name but different data semantics
**Why it happens:** User uploads active products CSV and inactive products CSV from same POS -- same headers, no conflict. But if they upload from different exports, column names could clash.
**How to avoid:** Per CONTEXT decision, one POS per migration. Same POS means same column schema. The "Source File" virtual column disambiguates row origin. True column conflicts are unlikely given the constraint.
**Warning signs:** N/A -- the one-POS constraint prevents this

## Code Examples

### V1 Constants to Port (verified from v1 source)
```typescript
// Source: /Users/chase/projects/chrome-extension/src/lib/constants.ts
// Port these directly:
// - POS_SYSTEMS: ['Blaze', 'Cova', 'Dutchie', 'Flowhub', 'IndicaOnline', 'Meadow']
// - MAPPING_FIELDS: 24 field definitions with key, label, description, hidden flag
// - POS_DEFAULTS: 6 POS-specific mapping templates (Dutchie has 19 mappings, Flowhub has 12, etc.)
// - createEmptyMappings(): creates FieldMapping[] from MAPPING_FIELDS
// - MAX_FILE_SIZE: 100MB
//
// Enhance with:
// - group property on MappingFieldDef (Product Info, Cannabis Details, Pricing, Attributes, Display & Media)
// - required property on MappingFieldDef (productName, productCategory are required minimum)
```

### V1 Parser to Port (verified from v1 source)
```typescript
// Source: /Users/chase/projects/chrome-extension/src/lib/parser.ts
// Port these functions:
// - validateFile(file: File): string | null  -- checks extension + size
// - detectHeaderRow(sheet): number  -- handles Blaze title-row edge case
// - parseFile(file: File): Promise<ParsedFile>  -- SheetJS read + JSON conversion
// - formatFileSize(bytes: number): string  -- human-readable file size
//
// Enhance with:
// - Multi-file support (return ParsedFile per file, merge separately)
// - Sheet selection for multi-sheet XLSX
// - Web Worker wrapper (optional, per Claude's discretion)
// - Progress callback for large files
```

### V1 POS Detection to Port (verified from v1 source)
```typescript
// Source: /Users/chase/projects/chrome-extension/src/components/UploadStep.tsx
// The scorePOS function:
function scorePOS(pos: string, headers: Set<string>): [number, number] {
  const defaults = POS_DEFAULTS[pos];
  if (!defaults) return [0, 0];
  const cols = Object.values(defaults);
  const matched = cols.filter((col) => headers.has(col)).length;
  return [matched, cols.length];
}
// Threshold: matched >= 3 AND matched/total > 0.4
// Enhancement: extract to lib/pos-detection.ts, add multi-file majority vote
```

### Storage Persistence Pattern
```typescript
// Source: v1 mappingStore.ts pattern, adapted for v2
const MIGRATION_STATE_KEY = 'migrationState';

interface PersistedMigrationState {
  parsedFiles: ParsedFile[];       // All uploaded files
  mergedHeaders: string[];         // Union of all headers
  selectedPOS: string;             // User's POS selection
  mappings: FieldMapping[];        // Current column mappings
  currentStep: number;             // Wizard step index
  updatedAt: string;               // ISO timestamp
}

export async function saveMigrationState(state: PersistedMigrationState): Promise<void> {
  await chrome.storage.local.set({ [MIGRATION_STATE_KEY]: state });
}

export async function loadMigrationState(): Promise<PersistedMigrationState | null> {
  const result = await chrome.storage.local.get(MIGRATION_STATE_KEY);
  return result[MIGRATION_STATE_KEY] ?? null;
}
```

### Manifest Permission Update
```json
// wxt.config.ts manifest addition
{
  "permissions": ["sidePanel", "storage", "unlimitedStorage"]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PapaParse + SheetJS dual parser | SheetJS only (handles CSV natively) | Always available | One less dependency, simpler code |
| Sync main-thread parse | Web Worker or async chunked | Standard practice | Non-blocking UI for large files |
| Flat mapping list | Grouped mapping with categories | v2 enhancement | Better UX for 24+ fields |
| Single file upload | Multi-file with column union | v2 enhancement | Handles split POS exports |

**Deprecated/outdated:**
- PapaParse: Not needed when xlsx handles CSV. v1 used both but xlsx alone is sufficient.
- CRXJS: v1 used CRXJS for extension bundling; v2 uses WXT framework (already set up in Phase 1)

## Open Questions

1. **Web Worker vs Main Thread Performance**
   - What we know: SheetJS typically parses 10k rows in <500ms on modern hardware
   - What's unclear: Whether side panel's rendering context has performance constraints that make this slower
   - Recommendation: Start with main-thread async parse. If testing shows UI freeze >200ms on 10k rows, add Web Worker. Per Claude's discretion.

2. **chrome.storage.local with 10k+ rows**
   - What we know: With "unlimitedStorage" permission, there's no quota. Serialization/deserialization of 10k records as JSON could be slow.
   - What's unclear: Actual performance of chrome.storage.local.set/get with 5-10MB payloads
   - Recommendation: Store parsed data. If performance is poor, consider only storing headers + file reference and re-parsing on resume (files could be cached as blobs).

3. **"Other" POS Best-Effort Mapping**
   - What we know: CONTEXT says "column name similarity" for Other POS
   - What's unclear: How sophisticated the fuzzy matching should be
   - Recommendation: Simple case-insensitive substring match (e.g., source header "Product Name" matches target field "productName"). No external fuzzy matching library needed for v1.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-01 | parseFile returns correct headers and rows for CSV and XLSX | unit | `pnpm vitest run tests/parser.test.ts -t "parseFile"` | No -- Wave 0 |
| FILE-01 | validateFile rejects non-CSV/XLSX and oversized files | unit | `pnpm vitest run tests/parser.test.ts -t "validateFile"` | No -- Wave 0 |
| FILE-02 | detectPOS returns correct POS for each known system's headers | unit | `pnpm vitest run tests/pos-detection.test.ts -t "detectPOS"` | No -- Wave 0 |
| FILE-02 | detectPOS returns null when no POS matches threshold | unit | `pnpm vitest run tests/pos-detection.test.ts -t "no match"` | No -- Wave 0 |
| FILE-03 | Manual POS selection overrides auto-detection | unit | `pnpm vitest run tests/pos-detection.test.ts -t "manual"` | No -- Wave 0 |
| FILE-04 | Parser handles 10k+ rows without error | unit | `pnpm vitest run tests/parser.test.ts -t "large file"` | No -- Wave 0 |
| MAP-01 | applyPOSDefaults maps correct source headers for each POS | unit | `pnpm vitest run tests/mapping.test.ts -t "POS defaults"` | No -- Wave 0 |
| MAP-02 | Manual mapping override replaces auto-mapped value | unit | `pnpm vitest run tests/mapping.test.ts -t "override"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/parser.test.ts` -- covers FILE-01, FILE-04
- [ ] `tests/pos-detection.test.ts` -- covers FILE-02, FILE-03
- [ ] `tests/mapping.test.ts` -- covers MAP-01, MAP-02
- [ ] `tests/fixtures/` -- sample CSV/XLSX files for each POS (small, 5-10 rows each)

## Sources

### Primary (HIGH confidence)
- v1 source code at `/Users/chase/projects/chrome-extension/src/` -- constants.ts, parser.ts, UploadStep.tsx, HeaderMapping.tsx, mappingStore.ts, types/index.ts
- v2 existing codebase at `/Users/chase/projects/catalog-migration-tool/` -- WizardShell.tsx, StepPlaceholder.tsx, constants.ts, messaging.ts, package.json
- [Chrome storage API docs](https://developer.chrome.com/docs/extensions/reference/api/storage) -- 10MB default, unlimitedStorage permission

### Secondary (MEDIUM confidence)
- [SheetJS Web Worker docs](https://docs.sheetjs.com/docs/demos/bigdata/worker/) -- Worker pattern for large files
- [SheetJS Chrome Extension docs](https://docs.sheetjs.com/docs/demos/extensions/chromium/) -- Extension-specific guidance
- [PapaParse vs SheetJS comparison](https://npmtrends.com/csv-parse-vs-exceljs-vs-node-xlsx-vs-papaparse-vs-xlsx) -- PapaParse faster for CSV-only but xlsx handles both formats

### Tertiary (LOW confidence)
- Web Worker hook libraries (@koale/useworker, react-hooks-worker) -- checked but not recommended; inline worker pattern is simpler for this use case

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - v1 uses same library (xlsx), proven in production
- Architecture: HIGH - v1 patterns exist and work; enhancements are well-scoped
- Pitfalls: HIGH - v1 development surfaced these issues (title rows, storage limits, sheet selection)
- Validation: MEDIUM - test fixtures for each POS need to be created; may need real export samples

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, v1 patterns unlikely to change)
