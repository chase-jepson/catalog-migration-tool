# Phase 3: Transform, Validate, and Import - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete catalog migration pipeline — uploaded and mapped data is normalized (categories, weights, classifications), validated against Treez import schema, presented in a Review step for error fixing, then converted to 6 Treez import CSVs and uploaded to S3 with progress tracking. This phase delivers the Review and Import steps of the wizard.

</domain>

<decisions>
## Implementation Decisions

### Review Step UX
- Errors grouped by error type/field: e.g., "Category: 47 rows", "Weight: 12 rows"
- Each group expandable to see affected rows
- Batch fix controls: dropdown of valid values for enum fields (category, classification, status), text input for free-text fields
- Before/after columns for transformed fields — show "Original" and "Treez Value" side by side so user can verify normalization
- Two error severity levels: **errors** (blocking, must fix) and **warnings** (non-blocking, e.g., missing optional fields)
- Cannot proceed to Import with unresolved errors, but warnings can be skipped
- Import button shows "Import with N warnings" when warnings exist
- Re-validate button after fixes — user fixes, re-validates, repeat until clean

### Import Step Flow
- Per-file progress list: vertical list of all 6 import files with status icons (pending → uploading → processing → done/failed)
- Current file shows progress bar with ETA
- Auto-download ZIP of generated CSVs before starting S3 upload (temporary safety net — mark code as temporary for future removal)
- 6 files uploaded sequentially: Brands → Attributes → Products → Variants → Attribute Joins → Images
- Adaptive polling based on row count: <1000 rows → poll every 5 seconds; ≥1000 rows → poll every 15 seconds
- 60-minute timeout (same as v1)
- Success state: checkmarks for all 6 files, total row count imported, buttons for "Start New Migration" and "Download CSVs Again"

### Transformation Rules
- Port v1's 40+ category keyword rules as-is (battle-tested in production)
- Category normalization: regex-based keyword matching against combined source category fields, with name-based fallback
- Subcategory resolution: per-category keyword matching against product name
- Classification normalization: case-insensitive matching — 'SATIVA' → 'Sativa', 'hybrid' → 'Hybrid', plus abbreviations (I/S, S/I, CBD)
- Weight normalization: convert to category-expected UoM (grams for flower, mg for edibles, 'each' for merch)

### Error Recovery
- On file upload/processing failure: stop import sequence immediately, show which file failed and why
- Retry from failed file: keep already-completed files' status, offer "Retry from [File Name]" button
- FINISHED_WITH_FAILURES (partial success): show file as "Completed with warnings", display failed row count, continue to next file, summarize all failures at end
- Cancel import: "Cancel Import" button with confirmation dialog — "Files already uploaded cannot be undone. Cancel remaining files?"

### Claude's Discretion
- Weight parsing strategy for unparseable values (flag as error vs best-guess with common mappings like "eighth" → 3.5g)
- Price tier resolution timing (Phase 3 via Treez API or defer to Phase 4)
- Exact layout/spacing of error groups in side panel
- ETA calculation algorithm
- ZIP generation library choice

</decisions>

<specifics>
## Specific Ideas

- v1 categoryMapper.ts has 880 lines of battle-tested keyword rules covering all 14 Treez product categories — port directly
- v1 transformer.ts has complete deriveRows and buildOutputCSVs logic for all 6 import file types — port and adapt
- v1 validator.ts has schema validation for all required fields — port to v2
- v1 fileUploader.ts has proven S3 presigned URL upload + polling pattern — port to v2
- v1 ReviewStep.tsx has grouped error UI with batch edit — reference for v2 component design
- v1 ConfirmTransform.tsx has per-file import progress tracking — reference for ImportStep
- Auto-download ZIP is temporary — add code comment marking for future removal when backend handles imports directly

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets (v2)
- `components/wizard/WizardShell.tsx`: Steps 2 and 3 (Review, Import) currently render StepPlaceholder — plug in new components
- `lib/types.ts`: ParsedFile, FieldMapping types — extend with DerivedRow, ValidationResult, ImportProgress
- `lib/constants.ts`: Already has PRODUCT_CATEGORIES (14), PRODUCT_SUBCATEGORIES, UOM_BY_CATEGORY, VALID_CLASSIFICATIONS, OUTPUT_FILE_LABELS
- `lib/mapping-engine.ts`: getMappingsByGroup, applyPOSDefaults — Review step uses mapping results
- `lib/migration-store.ts`: chrome.storage.local persistence — extend for Review/Import state
- `entrypoints/background/auth.ts`: Auth token for Treez API calls (S3 presigned URLs, import polling)

### V1 Assets to Port
- `chrome-extension/src/lib/categoryMapper.ts`: 880 lines — 40+ keyword rules, subcategory resolution, name overrides
- `chrome-extension/src/lib/transformer.ts`: 1015 lines — deriveRows, weight/classification normalization, buildOutputCSVs (6 files)
- `chrome-extension/src/lib/validator.ts`: 150 lines — schema validation per field
- `chrome-extension/src/lib/fileUploader.ts`: 215 lines — S3 upload via presigned URLs + import polling
- `chrome-extension/src/lib/priceTierResolver.ts`: 92 lines — Treez API tier matching
- `chrome-extension/src/components/ReviewStep.tsx`: 605 lines — grouped error UI + batch edit
- `chrome-extension/src/components/ConfirmTransform.tsx`: 330 lines — per-file import progress

### Established Patterns
- Service worker relays CORS-restricted API calls (S3 upload, Treez API)
- Message passing: content script ↔ service worker via chrome.runtime.sendMessage
- Debounced chrome.storage.local persistence (500ms)
- canProceed gating on WizardShell footer navigation

### Integration Points
- WizardShell step 2 → ReviewStep (receives parsed files + mappings from state)
- WizardShell step 3 → ImportStep (receives validated/transformed data from ReviewStep)
- Background service worker needs new message handlers: S3 upload, import status polling, price tier API
- lib/messaging.ts needs new protocol entries for API calls

</code_context>

<deferred>
## Deferred Ideas

- ENH-01 (bulk error resolution — apply fix to all rows with same error type) — v2 enhancement (partially addressed by batch fix controls)
- ENH-03 (pre-import dry run summary) — v2 enhancement
- ENH-06 (price tier resolution via Treez API) — may be included in Phase 3 at Claude's discretion, otherwise Phase 4
- ENH-08 (image URL migration from source POS CDNs) — v2 enhancement

</deferred>

---

*Phase: 03-transform-validate-and-import*
*Context gathered: 2026-03-09*
