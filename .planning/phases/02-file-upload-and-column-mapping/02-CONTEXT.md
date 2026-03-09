# Phase 2: File Upload and Column Mapping - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can upload one or more POS export files (CSV/XLSX), the tool auto-detects which POS system the data comes from, and presents an intelligent column mapping UI that translates source fields to Treez fields. Users can override any mapping. This phase delivers the Upload and Map steps of the wizard — validation, transformation, and import are separate phases.

</domain>

<decisions>
## Implementation Decisions

### File Upload UX
- Compact card at top of Upload step with file icon and "Choose file" button, drag-and-drop as secondary
- Multi-select in file picker — users may need to upload multiple CSVs (e.g., active + inactive products)
- Accept CSV and XLSX; for XLSX with multiple sheets, show a sheet selector
- Progress bar with row count ("Parsing row X of Y...") for large file feedback
- After parse: file summary card showing file name, size, row count, detected columns
- "Change file" link on summary card allows re-upload without restarting wizard
- Different column structures OK across multiple files — union all columns, fill missing with empty
- Track source file origin: virtual "Source File" column so users see which file each row came from in Review step

### File Validation Errors
- Claude's discretion on error presentation (inline vs toast)

### Parsing Performance
- Claude's discretion on approach (Web Worker vs chunked main thread) — must handle 10k+ rows without freezing

### Data Persistence
- Persist parsed data in chrome.storage.local so reopening the side panel resumes where user left off
- Backend persistence comes in Phase 4

### POS System Detection
- Auto-detect POS system immediately after file parsing, show result on file summary card
- Header signature matching: score each POS by counting matching column headers against known defaults (v1 approach: ≥3 matches AND >40% match rate)
- Display as simple label: "Detected: Dutchie" with a "Change" link
- "Change" opens a dropdown: Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova, Other
- One POS per migration — all files must be from same POS
- Multi-file detection: majority vote across files; show note if files disagree
- "Other" proceeds with best-effort mapping (column name similarity) + "Clear all mappings" button

### Column Mapping Layout
- Hybrid approach: Treez target fields grouped by category (Product Info, Attributes, Pricing, Cannabis Details, etc.)
- Each row: target field label → source column dropdown with sample value preview from CSV data
- Auto-mapped fields pre-selected from POS-specific templates (v1's POS_DEFAULTS pattern)
- Unmapped required fields: red outline on dropdown + count badge on group header ("2 unmapped")
- Cannot proceed to Review until all required fields are mapped
- Toolbar: "Clear all" (removes everything) and "Reset to auto" (re-applies POS template defaults)

### Data Preview
- Collapsible "Preview Data" section at bottom of Map step only
- Horizontally scrollable table (Claude decides row count)
- Column headers color-coded: green tint for mapped, yellow/gray for unmapped
- Clicking a column header in preview scrolls to and highlights the corresponding mapping row above

### Claude's Discretion
- Upload error presentation style (inline error vs toast)
- Parsing approach (Web Worker vs chunked main thread)
- Preview row count
- Side panel width and spacing details
- Exact group names for mapping categories
- Collapsible section animation/behavior

</decisions>

<specifics>
## Specific Ideas

- v1 HeaderMapping component pattern (target-field-centric list with dropdowns) is proven — iterate on it with grouping and sample previews
- v1 POS_DEFAULTS from `chrome-extension/src/lib/constants.ts` has working mapping templates for all 6 POS systems — port to v2
- v1 detection algorithm (score by header match count) works well — keep the ≥3 matches AND >40% threshold
- v1 MAPPING_FIELDS defines 24 target fields with hidden/visible flags — reuse field definitions
- v1 mappingStore.ts stores per `org::posName` key — same pattern useful for Phase 4 backend persistence

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/wizard/WizardShell.tsx`: Step navigation shell with Back/Next — Upload and Map steps plug into StepPlaceholder
- `components/wizard/StepIndicator.tsx`: Progress indicator for 4-step wizard
- `lib/constants.ts`: STEP_LABELS ['Upload', 'Map', 'Review', 'Import'] already defined
- `lib/messaging.ts`: Extension messaging protocol — may need new message types for file operations
- `entrypoints/background/auth.ts`: Auth token management for future API calls

### V1 Assets to Port
- `chrome-extension/src/lib/constants.ts`: MAPPING_FIELDS (24 fields), POS_DEFAULTS (6 POS templates), POS auto-detection scoring
- `chrome-extension/src/components/HeaderMapping.tsx`: Mapping UI component pattern
- `chrome-extension/src/components/UploadStep.tsx`: File upload + POS detection logic
- `chrome-extension/src/lib/mappingStore.ts`: Chrome storage mapping persistence
- `chrome-extension/src/lib/categoryMapper.ts`: Category mapping rules (needed in Phase 3)

### Established Patterns
- React + Tailwind CSS in side panel
- teal-600 primary color, gray-50 content background
- chrome.storage.session for wizard type, chrome.storage.local for persistent data
- WXT framework with entrypoints structure

### Integration Points
- StepPlaceholder.tsx is the slot where Upload and Map step components will render
- WizardShell manages step navigation — new steps need to signal "can proceed" to enable Next button
- Background service worker may need to handle file reading if content security policies restrict side panel

</code_context>

<deferred>
## Deferred Ideas

- MAP-03 (saved mappings per org/POS combo) — Phase 4 (requires backend persistence)
- Mapping preview with sample data alongside mapping UI (ENH-07) — v2 enhancement
- Multiple file upload per migration (ENH-04) — partially addressed here (multi-select), full version in v2

</deferred>

---

*Phase: 02-file-upload-and-column-mapping*
*Context gathered: 2026-03-09*
