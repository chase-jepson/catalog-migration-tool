# Roadmap: Catalog Migration Tool v2

## Overview

This roadmap delivers a Chrome extension and backend service for migrating cannabis retailer data from competing POS systems into Treez. The work progresses from extension foundation through the complete catalog migration pipeline (upload, map, transform, validate, import), then adds backend persistence for durable state, and finally extends the proven catalog flow to inventory migration. Each phase delivers a coherent, testable capability -- after Phase 3, the tool is functionally equivalent to v1; Phases 4 and 5 add the v2 differentiators.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Extension Shell** - WXT-based Chrome extension with page detection, auth flow, and wizard scaffold
- [ ] **Phase 2: File Upload and Column Mapping** - CSV/XLSX upload with POS auto-detection and smart column mapping
- [ ] **Phase 3: Transform, Validate, and Import** - Data normalization, row validation, Treez CSV generation, and S3 upload
- [ ] **Phase 4: Backend Persistence** - Hono + SQLite backend for migration state, file storage, and saved mappings
- [ ] **Phase 5: Inventory Migration** - Store selection, inventory-specific transformation, and inventory import

## Phase Details

### Phase 1: Extension Shell
**Goal**: A working Chrome extension skeleton that detects Treez pages, authenticates via session tokens, and presents the wizard UI framework
**Depends on**: Nothing (first phase)
**Requirements**: EXT-01, EXT-02, EXT-03
**Success Criteria** (what must be TRUE):
  1. Extension injects a "Migrate Products" button on the Treez Catalog module page
  2. Extension reads the Treez session token and the user does not need to log in separately
  3. Extension works on production, sandbox, and dev Treez environments without reconfiguration
  4. Wizard UI shell renders with step navigation (steps are empty placeholders at this point)
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- WXT project scaffold, shared libs, test infrastructure
- [x] 01-02-PLAN.md -- Background script (auth + side panel) and content script (button injection)
- [x] 01-03-PLAN.md -- Side panel wizard UI with step navigation and human verification

### Phase 2: File Upload and Column Mapping
**Goal**: Users can upload their POS export files and get intelligent column mappings that translate source fields to Treez fields
**Depends on**: Phase 1
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, MAP-01, MAP-02
**Success Criteria** (what must be TRUE):
  1. User can upload a CSV or XLSX file via drag-and-drop or file picker and see parsed row data
  2. Tool correctly identifies the source POS system from column headers (Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova)
  3. User can manually select a POS system when auto-detection is wrong or returns "Unknown"
  4. Column mappings auto-populate from POS-specific templates and the user can override any mapping via dropdown
  5. A 10,000+ row file uploads and parses without crashing or freezing the extension
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Core types, constants, file parser, POS detection, and mapping engine (TDD)
- [ ] 02-02-PLAN.md -- Upload step UI with file drop zone, parsing, POS detection, and WizardShell integration
- [ ] 02-03-PLAN.md -- Map step UI with grouped mappings, data preview, and human verification

### Phase 3: Transform, Validate, and Import
**Goal**: The complete catalog migration pipeline -- uploaded data is normalized, validated, converted to Treez import CSVs, and uploaded to S3
**Depends on**: Phase 2
**Requirements**: XFRM-01, XFRM-02, XFRM-03, VAL-01, VAL-02, VAL-03, IMP-01, IMP-02, IMP-03
**Success Criteria** (what must be TRUE):
  1. Source categories, weights, and classifications are normalized to Treez-expected formats (user sees transformed values in review)
  2. Each row is validated against the Treez import schema and specific error messages are shown per failing field
  3. Errors are grouped by type with affected row counts so the user can prioritize fixes
  4. User can fix validation errors inline in the review UI and re-validate
  5. Tool generates the full set of Treez import CSVs (brands, attributes, products, variants, attribute joins, images) and uploads them to S3 with progress and ETA display
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD
- [ ] 03-04: TBD

### Phase 4: Backend Persistence
**Goal**: Migrations persist server-side so users can resume interrupted sessions and mappings are saved for reuse
**Depends on**: Phase 3
**Requirements**: BACK-01, BACK-02, BACK-03, MAP-03
**Success Criteria** (what must be TRUE):
  1. User can close the browser mid-migration, reopen it, and resume from the exact step they left off
  2. Uploaded source files are stored on the backend and can be retrieved for debugging or re-processing
  3. Column mappings are saved per organization/POS combination and auto-loaded on subsequent uploads with the same combo
  4. Backend API authenticates requests using Treez session tokens (no separate auth)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Inventory Migration
**Goal**: Users can migrate per-store inventory data (quantities, costs) using the same wizard pattern proven for catalog migration
**Depends on**: Phase 3, Phase 4
**Requirements**: INV-01, INV-02, INV-03
**Success Criteria** (what must be TRUE):
  1. User can select a specific store from their Treez organization before starting inventory import
  2. Tool maps and imports inventory quantities tied to Treez product IDs
  3. Tool maps and imports cost/wholesale price data scoped to the selected store
  4. Inventory migration uses the same wizard flow (upload, map, validate, import) as catalog migration
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Extension Shell | 3/3 | Complete | 2026-03-09 |
| 2. File Upload and Column Mapping | 2/3 | In Progress|  |
| 3. Transform, Validate, and Import | 0/4 | Not started | - |
| 4. Backend Persistence | 0/3 | Not started | - |
| 5. Inventory Migration | 0/3 | Not started | - |
