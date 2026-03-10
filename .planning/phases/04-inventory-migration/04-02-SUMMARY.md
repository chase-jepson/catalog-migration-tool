---
phase: 04-inventory-migration
plan: 02
subsystem: etl
tags: [etl, csv, inventory, join, transformer, validator, tdd]

# Dependency graph
requires:
  - phase: 04-inventory-migration
    provides: Inventory types, mapping constants, store API, state persistence (04-01)
  - phase: 03-transform-validate-and-import
    provides: ParsedFile, FieldMapping, arrayToCSV, validation patterns
provides:
  - Full ETL pipeline (phases A-E) for 4-file inventory join into 56-column CSV
  - Pure ETL helpers (groupBy, sumByGroup, leftJoin, fullJoin, formatDateToISO, splitPotency)
  - Per-role mapping field definitions with Dutchie POS defaults
  - 56-column validator with error/warning severity
  - CSV generator with exact column order mapping
affects: [04-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-phase ETL with pure functions, full/left join chain, active invoice ID filter, graceful degradation for missing files]

key-files:
  created:
    - lib/inventory-etl-helpers.ts
    - tests/inventory-etl-helpers.test.ts
  modified:
    - lib/types.ts
    - lib/inventory-constants.ts
    - lib/inventory-transformer.ts
    - lib/inventory-validator.ts
    - lib/inventory-csv-generator.ts
    - tests/inventory-transformer.test.ts
    - tests/inventory-validator.test.ts
    - tests/inventory-csv-generator.test.ts

key-decisions:
  - "Unmatched rows produce warnings not errors, allowing import to proceed with partial matches"
  - "buildInventoryCSV returns string[][] for caller to serialize, consistent with catalog pattern"
  - "DistributorInfo interface with 34 fields covers all 32 distributor output columns plus type/name"
  - "Active invoice filter uses 3-phase approach: overlap detection, invoice ID collection, full pull"

patterns-established:
  - "ETL helpers are pure functions with no side effects, independently testable"
  - "Per-role field mappings keyed by InventoryFileRole for multi-file upload"
  - "FIELD_TO_COLUMN mapping in CSV generator decouples row properties from output headers"

requirements-completed: [INV-02, INV-03]

# Metrics
duration: 8min
completed: 2026-03-10
---

# Phase 4 Plan 2: Inventory ETL Pipeline Summary

**Full ETL pipeline joining 4 input files (inventory, receipts, vendors, adjustments) into 56-column Treez inventory import CSV with pure helper functions and TDD**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-10T05:14:58Z
- **Completed:** 2026-03-10T05:23:15Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- 12 pure ETL helper functions (groupBy, sumByGroup, leftJoin, fullJoin, formatDateToISO, splitPotency, extractInvoiceId, deriveCustomerType, deriveLocationPath, and 3 location sub-derivers)
- Full ETL pipeline implementing phases A-E from INVENTORY-ETL-SPEC.md: receipt summing with adjustments, vendor distributor enrichment (32 columns), inventory field derivation, full+left join chain, final enrichment with Merch logic
- Active Invoice ID filter correctly identifies invoices overlapping with current inventory
- Pipeline gracefully degrades when optional files are missing
- 56-column validator catches format/completeness issues with error vs warning severity
- CSV generator produces exact column order via FIELD_TO_COLUMN mapping
- 92 inventory tests + 273 total suite tests all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, constants, and ETL helper functions** - `1bfc503` (feat)
2. **Task 2: Full ETL pipeline transformer, validator, and CSV generator** - `6f81435` (feat)

## Files Created/Modified
- `lib/types.ts` - Expanded InventoryDerivedRow to 56-column interface, added InventoryFileRole/Assignment types, expanded MappingGroup
- `lib/inventory-constants.ts` - Per-role mapping fields, Dutchie POS defaults, ROOM_TO_LOCATION_PATH, INVENTORY_OUTPUT_COLUMNS
- `lib/inventory-etl-helpers.ts` - 12 pure ETL utility functions
- `lib/inventory-transformer.ts` - Complete rewrite: processReceipts, processVendors, processInventory, joinChain, finalEnrichment, runInventoryETL
- `lib/inventory-validator.ts` - Complete rewrite for 56-column validation with hasReceipts option
- `lib/inventory-csv-generator.ts` - Complete rewrite with FIELD_TO_COLUMN mapping for exact column order
- `tests/inventory-etl-helpers.test.ts` - 49 tests for all helper functions
- `tests/inventory-transformer.test.ts` - 26 tests covering phases A-E and integration
- `tests/inventory-validator.test.ts` - 11 tests for 56-column validation rules
- `tests/inventory-csv-generator.test.ts` - 6 tests for column order and filtering

## Decisions Made
- Unmatched rows produce warnings not errors, allowing import to proceed with partial data
- buildInventoryCSV returns string[][] (no storeEntityId param), consistent with catalog pattern
- Active invoice filter uses 3-phase approach: find overlapping packages, collect their invoice IDs, pull all rows for those invoices
- DistributorType hardcoded to "Non-Arms Length" per spec
- License expiration generated as today + 2 years for non-empty license numbers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MappingGroup type missing new inventory groups**
- **Found during:** Task 1
- **Issue:** MappingGroup union type did not include 'Customer Type', 'Dates', 'Distributor', 'Invoice' groups needed by per-role field definitions
- **Fix:** Added the 4 missing group literals to MappingGroup union in types.ts
- **Files modified:** lib/types.ts
- **Verification:** TypeScript compiles without errors for inventory-constants.ts
- **Committed in:** 1bfc503 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial type expansion. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full ETL pipeline ready for UI integration in 04-03
- runInventoryETL function accepts ETLInput + PerRoleMappings + dispensaryLicense
- Per-role mapping fields ready for multi-file mapping UI
- INVENTORY_FILE_ROLES defines required/optional files for upload UI
- buildInventoryCSV ready for import step

---
*Phase: 04-inventory-migration*
*Completed: 2026-03-10*
