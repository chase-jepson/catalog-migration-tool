# Phase 3: Transform, Validate, and Import - Research

**Researched:** 2026-03-09
**Domain:** Data transformation pipeline, schema validation, CSV generation, S3 file upload, Chrome extension messaging
**Confidence:** HIGH

## Summary

Phase 3 ports the v1 catalog migration pipeline (categoryMapper, transformer, validator, fileUploader, outputGenerator) into the v2 WXT-based extension, then builds ReviewStep and ImportStep UI components to replace the current StepPlaceholder components in WizardShell. The v1 code is battle-tested in production and totals ~2,900 lines across 7 files -- the porting strategy is adapt-not-rewrite, updating imports and integration points while preserving the proven transformation logic.

The core work divides into three layers: (1) Pure logic -- category mapping, transformation, validation, CSV generation -- which can be ported with minimal changes and thoroughly unit tested; (2) API integration -- presigned URL upload, import polling, auth token relay -- which requires new background message handlers and messaging protocol entries; (3) UI components -- ReviewStep with grouped error display and batch fixes, ImportStep with per-file progress tracking -- which plug into the existing WizardShell step routing.

**Primary recommendation:** Port v1 logic files first with comprehensive unit tests, then build messaging/background handlers, then UI components. The transformation and validation logic is pure functions with zero side effects -- ideal for TDD. The UI components depend on the logic layer and messaging layer being in place.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Errors grouped by error type/field: e.g., "Category: 47 rows", "Weight: 12 rows"
- Each group expandable to see affected rows
- Batch fix controls: dropdown of valid values for enum fields (category, classification, status), text input for free-text fields
- Before/after columns for transformed fields -- show "Original" and "Treez Value" side by side so user can verify normalization
- Two error severity levels: **errors** (blocking, must fix) and **warnings** (non-blocking, e.g., missing optional fields)
- Cannot proceed to Import with unresolved errors, but warnings can be skipped
- Import button shows "Import with N warnings" when warnings exist
- Re-validate button after fixes -- user fixes, re-validates, repeat until clean
- Per-file progress list: vertical list of all 6 import files with status icons (pending -> uploading -> processing -> done/failed)
- Current file shows progress bar with ETA
- Auto-download ZIP of generated CSVs before starting S3 upload (temporary safety net -- mark code as temporary for future removal)
- 6 files uploaded sequentially: Brands -> Attributes -> Products -> Variants -> Attribute Joins -> Images
- Adaptive polling based on row count: <1000 rows -> poll every 5 seconds; >=1000 rows -> poll every 15 seconds
- 60-minute timeout (same as v1)
- Success state: checkmarks for all 6 files, total row count imported, buttons for "Start New Migration" and "Download CSVs Again"
- Port v1's 40+ category keyword rules as-is (battle-tested in production)
- Category normalization: regex-based keyword matching against combined source category fields, with name-based fallback
- Subcategory resolution: per-category keyword matching against product name
- Classification normalization: case-insensitive matching
- Weight normalization: convert to category-expected UoM (grams for flower, mg for edibles, 'each' for merch)
- On file upload/processing failure: stop import sequence immediately, show which file failed and why
- Retry from failed file: keep already-completed files' status, offer "Retry from [File Name]" button
- FINISHED_WITH_FAILURES (partial success): show file as "Completed with warnings", display failed row count, continue to next file, summarize all failures at end
- Cancel import: "Cancel Import" button with confirmation dialog

### Claude's Discretion
- Weight parsing strategy for unparseable values (flag as error vs best-guess with common mappings like "eighth" -> 3.5g)
- Price tier resolution timing (Phase 3 via Treez API or defer to Phase 4)
- Exact layout/spacing of error groups in side panel
- ETA calculation algorithm
- ZIP generation library choice

### Deferred Ideas (OUT OF SCOPE)
- ENH-01 (bulk error resolution -- apply fix to all rows with same error type) -- partially addressed by batch fix controls
- ENH-03 (pre-import dry run summary) -- v2 enhancement
- ENH-06 (price tier resolution via Treez API) -- may be included at Claude's discretion, otherwise Phase 4
- ENH-08 (image URL migration from source POS CDNs) -- v2 enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| XFRM-01 | Tool normalizes source categories to Treez category taxonomy | Port v1 `categoryMapper.ts` (880 lines) with 40+ keyword rules, subcategory resolution, name overrides, enhanced resolution. Already has `PRODUCT_CATEGORIES` and `PRODUCT_SUBCATEGORIES` in v2 constants. |
| XFRM-02 | Tool standardizes weight/unit values to Treez-expected formats | Port v1 `transformer.ts` weight parsing (`parseWeight`, `convertAmount`, `getWeightInGrams`, `extractGramsFromName`). V2 already has `UOM_BY_CATEGORY` and `EACH_UOM_CATEGORIES` constants. |
| XFRM-03 | Tool normalizes classification values | Port v1 `normalizeClassification()` from transformer.ts. V2 already has `VALID_CLASSIFICATIONS` constant. |
| VAL-01 | Tool validates each row against Treez import schema and shows specific error messages | Port v1 `validator.ts` (150 lines) -- `validateDerivedRows()` checks category, subCategory, classification, status, uom, amount, merchSize. Add error/warning severity distinction. |
| VAL-02 | Errors are grouped by type with affected row counts | Port v1 `groupErrors()` pattern from ReviewStep.tsx -- groups by field, then by currentValue within field, sorted by affected row count descending. |
| VAL-03 | User can fix errors inline per-row in the review UI | Port v1 `applyFixes()` from transformer.ts with cascade logic (category change -> subCategory, uom, merchSize update). Build dropdown/text fix controls per error batch. |
| IMP-01 | Tool generates Treez-formatted import CSVs (6 files) | Port v1 `buildOutputCSVs()` from transformer.ts (250 lines) + `generateAndDownloadZip()` from outputGenerator.ts. Need JSZip + file-saver or equivalent for ZIP download. |
| IMP-02 | Tool uploads generated CSVs to S3 via presigned URLs from Treez API | Port v1 `fileUploader.ts` (215 lines) -- presigned URL request, S3 upload via background worker, sequential file upload. Need new message handlers in background script. |
| IMP-03 | Tool tracks upload and import progress with ETA display | Port v1 `pollImportCompletion()` pattern with adaptive polling intervals. Build ImportStep UI with per-file status icons and progress bar. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.1.0 | UI components | Already used for all wizard steps |
| TypeScript | ^5.8.3 | Type safety | Already in project |
| WXT | ^0.20.18 | Chrome extension framework | Already scaffolded, provides `defineBackground` |
| @webext-core/messaging | ^1.4.0 | Typed extension messaging | Already used for `getAuthToken` and `openSidePanel` |
| Tailwind CSS | ^4.1.4 | Styling | Already used for all components |
| xlsx (SheetJS) | ^0.18.5 | CSV generation (unparse) | Already in project, replaces PapaParse for CSV output |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jszip | ^3.10 | ZIP file generation | Auto-download safety net ZIP before S3 upload |
| file-saver | ^2.0 | Trigger browser download | Save generated ZIP to user's downloads |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSZip | fflate | fflate is faster/smaller but JSZip is battle-tested in v1, simpler API |
| file-saver | URL.createObjectURL + anchor click | file-saver handles edge cases (Safari, large files) |
| PapaParse (v1) | SheetJS xlsx.utils.sheet_to_csv | SheetJS already in project for parsing; can also unparse to CSV |

**Recommendation on CSV generation:** SheetJS (`xlsx`) is already in the project and has `XLSX.utils.aoa_to_sheet` + `XLSX.utils.sheet_to_csv` for converting 2D arrays to CSV strings. However, the v1 code uses `Papa.unparse()` which is simpler for this use case (just 2D array -> CSV string). Since SheetJS is already installed, use `XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(data))` to avoid adding PapaParse as a dependency. Alternatively, a simple custom CSV serializer (20 lines) handles the quoting rules needed.

**Installation:**
```bash
npm install jszip file-saver && npm install -D @types/file-saver
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
  category-mapper.ts      # Port of v1 categoryMapper.ts (880 lines)
  transformer.ts           # Port of v1 transformer.ts (deriveRows, applyFixes, buildOutputCSVs)
  validator.ts             # Port of v1 validator.ts (validateDerivedRows) + warning support
  csv-generator.ts         # CSV serialization + ZIP generation (replaces v1 outputGenerator.ts)
  file-uploader.ts         # S3 presigned URL upload logic (pure functions, no chrome.* calls)
  import-poller.ts         # Import status polling logic (pure functions)
  types.ts                 # Extended with DerivedRow, ValidationResult, TransformResult, etc.
  constants.ts             # Extended with MERCHANDISE_SIZES, DUTCHIE_IMAGE_BASE_URL, OUTPUT_FILE_LABELS, etc.
  messaging.ts             # Extended ProtocolMap with S3 upload + import polling messages
components/
  review/
    ReviewStep.tsx          # Main review step container
    ErrorGroupList.tsx      # Grouped error display with expand/collapse
    ErrorBatchRow.tsx       # Individual error batch with fix controls
    TransformPreview.tsx    # Before/after column preview for transformed fields
  import/
    ImportStep.tsx          # Main import step container
    ImportFileList.tsx      # Vertical file list with status icons
    ImportProgress.tsx      # Progress bar with ETA for current file
entrypoints/
  background/
    index.ts               # Extended with S3 upload + import polling message handlers
```

### Pattern 1: Pure Logic Separation
**What:** All transformation, validation, and CSV generation logic lives in pure functions with no side effects (no chrome.* APIs, no fetch calls). API calls go through the messaging layer.
**When to use:** Always -- this is the established v2 pattern.
**Example:**
```typescript
// lib/transformer.ts -- pure function, no side effects
export function deriveRows(
  rows: Record<string, string>[],
  mappings: FieldMapping[],
  categoryResolutions?: Map<string, CategoryResolution>,
): DerivedRow[] { /* ... */ }

// lib/file-uploader.ts -- pure upload logic
export function buildUploadPayload(
  csvData: string[][],
  fileName: string,
  objectType: ImportObjectType,
): { csvContent: string; contentLength: number } { /* ... */ }
```

### Pattern 2: Background Message Relay for CORS
**What:** Content script / side panel cannot make cross-origin API calls directly. All API calls (S3 upload, presigned URL, import polling) go through the background service worker via chrome.runtime.sendMessage.
**When to use:** Any Treez API or S3 API call.
**Example:**
```typescript
// lib/messaging.ts -- extend protocol
interface ProtocolMap {
  getAuthToken(data: { appUrl: string }): { token: string | null };
  openSidePanel(data: { tabId: number; wizardType: 'catalog' | 'inventory' }): void;
  getPresignedUrl(data: { apiBaseUrl: string; params: PresignedUrlParams }): PresignedUrlResponse;
  uploadToS3(data: { presignedUrl: string; csvContent: string }): { ok: boolean; error?: string };
  fetchImportReport(data: { apiBaseUrl: string }): ImportJob[];
}
```

### Pattern 3: State Flow Through WizardShell
**What:** ReviewStep receives parsed files + mappings from WizardShell state. It produces DerivedRow[] + ValidationResult which flows to ImportStep. WizardShell manages the handoff.
**When to use:** Step transitions in the wizard.
**Example:**
```typescript
// WizardShell state additions
const [derivedRows, setDerivedRows] = useState<DerivedRow[]>([]);
const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
const [transformResult, setTransformResult] = useState<TransformResult | null>(null);

// Step 2 (Review) → produces derivedRows + validationResult
// Step 3 (Import) → receives derivedRows, builds CSVs, uploads
```

### Pattern 4: Debounced Persistence (existing)
**What:** State changes are persisted to chrome.storage.local with 500ms debounce.
**When to use:** Extend PersistedMigrationState to include derivedRows, validationResult, and import progress.
**Caveat:** DerivedRow[] can be large (10k+ rows). Consider storing only the essential state (fixes applied, import progress) rather than the full derived rows array, since rows can be re-derived from parsedFiles + mappings.

### Anti-Patterns to Avoid
- **Storing derived rows in chrome.storage.local:** 10k DerivedRow objects can be 10MB+. Store the fixes (RowFix[]) instead and re-derive on restore.
- **Making API calls from side panel directly:** CORS will block them. Always relay through background service worker.
- **Blocking the UI thread with large transforms:** deriveRows on 10k rows is fast (<100ms in v1), but buildOutputCSVs can be slower. Use a loading spinner but keep on main thread (Web Workers add complexity for marginal gain).
- **Polling from the side panel:** If the side panel closes during import, polling stops. Consider whether the background worker should own the polling lifecycle. For v1 parity, side-panel polling is acceptable since v1 does this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Category keyword matching | Custom NLP/ML classifier | v1's regex keyword rules (40+ patterns) | Battle-tested with real POS data, handles edge cases |
| CSV serialization | Manual string concatenation with quoting | SheetJS or simple CSV serializer | Proper escaping of commas, quotes, newlines in field values |
| ZIP generation | Manual ZIP format construction | JSZip | ZIP format is complex (compression, CRC, headers) |
| File download trigger | Manual blob URL management | file-saver | Handles browser quirks (Safari, memory cleanup) |
| Weight unit conversion | Ad-hoc parsing per POS | v1's parseWeight + convertAmount | Handles g, mg, oz, grams, milligrams with fallback |
| Classification normalization | Fuzzy matching library | v1's normalizeClassification | Exact list of 6 values + abbreviation patterns |

**Key insight:** The entire transformation pipeline is a direct port from v1. The rules are production-validated against real POS exports from 6 different systems. Building new rules or "improving" the matching would risk breaking working migrations.

## Common Pitfalls

### Pitfall 1: CORS Blocking API Calls from Side Panel
**What goes wrong:** fetch() to api.treez.io or S3 presigned URLs fails with CORS error.
**Why it happens:** Side panel runs in extension context but shares web page CORS restrictions for cross-origin requests.
**How to avoid:** Route ALL external API calls through the background service worker using the messaging protocol. The background worker has `credentials: 'omit'` and full network access.
**Warning signs:** Network errors with "blocked by CORS policy" in console.

### Pitfall 2: Lost User Gesture for Side Panel Operations
**What goes wrong:** chrome.sidePanel.open() fails because the user gesture chain was broken.
**Why it happens:** Any await/then before chrome.sidePanel.open() breaks the gesture context.
**How to avoid:** This is already handled in v2's background script. Don't add awaits before sidePanel operations.

### Pitfall 3: Large State in chrome.storage.local
**What goes wrong:** Persisting 10k DerivedRow objects causes storage quota errors or slow save/restore.
**Why it happens:** Each DerivedRow has ~25 string fields. 10k rows = ~10MB serialized.
**How to avoid:** Store RowFix[] (user corrections) and import progress state. Re-derive rows from parsedFiles + mappings on restore.
**Warning signs:** Slow step transitions, storage quota errors in console.

### Pitfall 4: Import Polling Token Expiry
**What goes wrong:** Import polling fails after 30+ minutes because the auth token expired.
**Why it happens:** Treez access tokens expire (typically 1 hour). Long imports can outlast the token.
**How to avoid:** Re-acquire the token on each poll iteration via getAuthToken (which handles refresh). The v1 code already does this in pollImportCompletion.
**Warning signs:** 401 errors during polling after initial upload succeeds.

### Pitfall 5: Side Panel Closure During Import
**What goes wrong:** User closes the side panel while S3 upload or polling is in progress.
**Why it happens:** Side panel React component unmounts, clearing all state and stopping polling.
**How to avoid:** For v1 parity, add a beforeunload warning. For robustness, persist import progress state so reopening the panel can show "import in progress" and resume polling.
**Warning signs:** User reports "import seemed to stop" after closing the panel.

### Pitfall 6: CSV Quoting Issues
**What goes wrong:** Fields containing commas, quotes, or newlines break the CSV structure.
**Why it happens:** Naive string joining without proper RFC 4180 quoting.
**How to avoid:** Use SheetJS or PapaParse for CSV serialization. If hand-rolling: wrap fields containing commas/quotes/newlines in double quotes, escape internal double quotes by doubling them.

### Pitfall 7: Sequential Upload Order Matters
**What goes wrong:** Products reference brands that haven't been imported yet, causing import failures.
**Why it happens:** Treez import pipeline has foreign key dependencies between file types.
**How to avoid:** Upload in strict order: Brands -> Attributes -> Products -> Variants -> Attribute Joins -> Images. Wait for each file's import to complete (terminal status) before uploading the next.

## Code Examples

### CSV Serialization without PapaParse
```typescript
// Using SheetJS (already in project) for CSV generation
import * as XLSX from 'xlsx';

function arrayToCSV(data: string[][]): string {
  const ws = XLSX.utils.aoa_to_sheet(data);
  return XLSX.utils.sheet_to_csv(ws);
}
```

### Extending the Messaging Protocol
```typescript
// lib/messaging.ts
import { defineExtensionMessaging } from '@webext-core/messaging';

interface PresignedUrlParams {
  name: string;
  contentLength: number;
  objectType: string;
  objectId: string;
}

interface ImportJob {
  id: string;
  name: string;
  status: string;
  finishedAt: string | null;
  totalRows: number | null;
  countProcessed: number;
  countError: number;
}

interface ProtocolMap {
  getAuthToken(data: { appUrl: string }): { token: string | null };
  openSidePanel(data: { tabId: number; wizardType: 'catalog' | 'inventory' }): void;
  getPresignedUrl(data: {
    apiBaseUrl: string;
    token: string;
    params: PresignedUrlParams;
  }): { fileId: string; presignedUrl: string };
  uploadToS3(data: {
    presignedUrl: string;
    csvContent: string;
  }): { ok: boolean; error?: string };
  fetchImportReport(data: {
    apiBaseUrl: string;
    token: string;
  }): ImportJob[];
}
```

### Error/Warning Severity in Validation
```typescript
// Extend RowValidationError with severity
export interface RowValidationError {
  rowIndex: number;
  field: string;
  currentValue: string;
  message: string;
  fixType: 'dropdown' | 'text';
  dropdownOptions?: string[];
  severity: 'error' | 'warning';  // NEW: errors block, warnings don't
}

// Extend ValidationResult
export interface ValidationResult {
  validCount: number;
  errorCount: number;     // blocking errors
  warningCount: number;   // non-blocking warnings
  errors: RowValidationError[];  // includes both errors and warnings
}
```

### ETA Calculation
```typescript
// Simple moving average ETA
function calculateETA(
  startTime: number,
  completedFiles: number,
  totalFiles: number,
  currentFileProgress: number, // 0-1
): string {
  const elapsed = Date.now() - startTime;
  const effectiveCompleted = completedFiles + currentFileProgress;
  if (effectiveCompleted <= 0) return 'Calculating...';
  const msPerUnit = elapsed / effectiveCompleted;
  const remaining = (totalFiles - effectiveCompleted) * msPerUnit;
  if (remaining < 60_000) return 'Less than 1 minute';
  const minutes = Math.ceil(remaining / 60_000);
  return `~${minutes} minute${minutes === 1 ? '' : 's'}`;
}
```

### Import File Status Types
```typescript
type FileStatus = 'pending' | 'uploading' | 'processing' | 'done' | 'failed' | 'done_with_warnings';

interface ImportFileState {
  key: string;
  label: string;
  status: FileStatus;
  rowCount: number;
  processedCount: number;
  errorCount: number;
  error?: string;
}
```

## State of the Art

| Old Approach (v1) | Current Approach (v2) | Impact |
|--------------------|-----------------------|--------|
| PapaParse for CSV unparse | SheetJS (already in project) or inline serializer | One fewer dependency |
| CRXJS for extension | WXT framework | Different entry point patterns, defineBackground |
| Raw chrome.runtime.sendMessage | @webext-core/messaging typed protocol | Type-safe message passing, need to extend ProtocolMap |
| Props drilling through popup | Props drilling through WizardShell | Same pattern, side panel instead of popup |
| chrome.storage.local (flat) | chrome.storage.local with debounced persistence | Same approach, already established |

**Deprecated/outdated:**
- v1 uses `getAuthToken` via raw chrome.runtime.sendMessage -- v2 uses typed messaging via `@webext-core/messaging`
- v1 uses `deriveApiBaseUrl` with production mapping to `api.mso.treez.io` -- v2's `getApiBaseUrl` in env.ts maps differently (verify which is correct for file-management and import APIs)

## Open Questions

1. **API Base URL Discrepancy**
   - What we know: v1 maps production to `api.mso.treez.io`, v2's env.ts maps to `api.treez.io`
   - What's unclear: Which is correct for the file-management presigned URL API and import report API?
   - Recommendation: Use v1's `api.mso.treez.io` for production since it's battle-tested. May need to update env.ts or add a separate API URL resolver for import-specific endpoints.

2. **Price Tier Resolution Timing**
   - What we know: v1 resolves price tiers in ReviewStep via Treez API call. CONTEXT.md marks this as Claude's discretion.
   - What's unclear: Whether the Treez API is reliably available from the extension context.
   - Recommendation: **Defer to Phase 4.** Price tier resolution adds API complexity (fetch tiers, match names, handle unresolved). The core migration works without it (empty tier columns). Phase 4 adds backend which can handle this more robustly.

3. **Weight Parsing for Unparseable Values**
   - What we know: v1's parseWeight handles "Xg", "Xmg", "Xoz", plain numbers. Common weight terms like "eighth" (3.5g), "quarter" (7g) are NOT handled.
   - Recommendation: **Flag as error.** Add common weight mappings as a future enhancement. The v1 approach of flagging unknown weights as errors (amount = 0, caught by validator) is safer than guessing. This matches the v1 behavior users are accustomed to.

4. **ZIP Download Library**
   - Recommendation: **Use JSZip + file-saver.** Same as v1, proven to work in Chrome extension context. Alternatives (fflate) optimize for bundle size but JSZip is already validated for this use case.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XFRM-01 | Category normalization (40+ keyword rules, subcategory resolution, name overrides) | unit | `npx vitest run tests/category-mapper.test.ts -x` | No -- Wave 0 |
| XFRM-02 | Weight/unit standardization (g, mg, oz, each, conversion between units) | unit | `npx vitest run tests/transformer.test.ts -x` | No -- Wave 0 |
| XFRM-03 | Classification normalization (Sativa, Indica, Hybrid, I/S, S/I, CBD) | unit | `npx vitest run tests/transformer.test.ts -x` | No -- Wave 0 |
| VAL-01 | Row validation against Treez schema (category, subCategory, status, amount, etc.) | unit | `npx vitest run tests/validator.test.ts -x` | No -- Wave 0 |
| VAL-02 | Error grouping by type with affected row counts | unit | `npx vitest run tests/validator.test.ts -x` | No -- Wave 0 |
| VAL-03 | Fix application with cascade logic (category change -> subCategory, uom update) | unit | `npx vitest run tests/transformer.test.ts -x` | No -- Wave 0 |
| IMP-01 | CSV generation for all 6 file types (brands, attributes, products, variants, attr joins, images) | unit | `npx vitest run tests/csv-generator.test.ts -x` | No -- Wave 0 |
| IMP-02 | S3 presigned URL upload flow (payload construction, message protocol) | unit | `npx vitest run tests/file-uploader.test.ts -x` | No -- Wave 0 |
| IMP-03 | Import progress tracking (polling, ETA calculation, adaptive intervals) | unit | `npx vitest run tests/import-poller.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/category-mapper.test.ts` -- covers XFRM-01 (category/subcategory resolution, keyword rules, name overrides)
- [ ] `tests/transformer.test.ts` -- covers XFRM-02, XFRM-03, VAL-03 (deriveRows, weight parsing, classification, applyFixes)
- [ ] `tests/validator.test.ts` -- covers VAL-01, VAL-02 (validateDerivedRows, error grouping, error/warning severity)
- [ ] `tests/csv-generator.test.ts` -- covers IMP-01 (buildOutputCSVs, CSV serialization, ZIP generation)
- [ ] `tests/file-uploader.test.ts` -- covers IMP-02 (upload payload construction, presigned URL flow)
- [ ] `tests/import-poller.test.ts` -- covers IMP-03 (polling logic, ETA calculation, adaptive intervals)

## Sources

### Primary (HIGH confidence)
- v1 source code at `/Users/chase/projects/chrome-extension/src/lib/` -- categoryMapper.ts (656 lines), transformer.ts (1015 lines), validator.ts (150 lines), fileUploader.ts (215 lines), priceTierResolver.ts (92 lines), outputGenerator.ts (60 lines)
- v1 types at `/Users/chase/projects/chrome-extension/src/types/index.ts` -- DerivedRow, TransformResult, ValidationResult, RowFix, PriceTierResolution
- v1 components at `/Users/chase/projects/chrome-extension/src/components/` -- ReviewStep.tsx (605 lines), ConfirmTransform.tsx (330 lines)
- v2 existing codebase -- types.ts, constants.ts, messaging.ts, migration-store.ts, WizardShell.tsx, background/index.ts

### Secondary (MEDIUM confidence)
- SheetJS documentation for CSV generation capabilities
- JSZip API for ZIP generation in browser context
- @webext-core/messaging for typed protocol extension

### Tertiary (LOW confidence)
- API base URL for production (api.treez.io vs api.mso.treez.io) -- needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries are either already in the project or directly ported from production v1
- Architecture: HIGH -- clear layering (pure logic -> messaging -> UI) follows established v2 patterns
- Pitfalls: HIGH -- documented from v1 production experience and v2 Phase 1-2 learnings
- API integration: MEDIUM -- production API base URL needs verification; import polling patterns are proven but auth token handling across 60-min imports needs attention

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain -- cannabis POS data formats and Treez import pipeline change infrequently)
