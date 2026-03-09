---
phase: 03-transform-validate-and-import
plan: 02
subsystem: validation, csv-generation
tags: [vitest, tdd, jszip, csv, validation, treez-import]

requires:
  - phase: 03-transform-validate-and-import/01
    provides: DerivedRow type, constants (PRODUCT_CATEGORIES, VALID_CLASSIFICATIONS, etc.)
provides:
  - validateDerivedRows with error/warning severity distinction
  - groupErrors for ReviewStep error clustering
  - buildOutputCSVs generating 6 Treez import CSV file types
  - arrayToCSV with RFC 4180 escaping
  - generateZip for ZIP bundling via JSZip
affects: [03-transform-validate-and-import/03, 03-transform-validate-and-import/04]

tech-stack:
  added: [jszip, file-saver, "@types/file-saver"]
  patterns: [TDD red-green for pure logic modules, error/warning severity separation]

key-files:
  created:
    - lib/validator.ts
    - lib/csv-generator.ts
    - tests/validator.test.ts
    - tests/csv-generator.test.ts
  modified:
    - lib/types.ts

key-decisions:
  - "Error severity: required fields (productName, category, subCategory, status, uom, amount, basePrice) produce blocking errors; optional fields (description, strain, classification when empty, thc, cbd) produce warnings"
  - "Classification validation: non-empty invalid value is an error; empty value is a warning"
  - "arrayToCSV uses custom RFC 4180 serializer instead of SheetJS (lighter dependency for pure string[][] to CSV)"
  - "Brand deduplication in CSV generator is case-insensitive, keeping first-seen casing"

patterns-established:
  - "Error/warning severity: errors block import, warnings are informational"
  - "ErrorGroup clustering: group by field+message, sort by affected row count descending"
  - "OutputCSVs interface: 6 string[][] arrays matching Treez import pipeline format"

requirements-completed: [VAL-01, VAL-02, IMP-01]

duration: 4min
completed: 2026-03-09
---

# Phase 3 Plan 02: Validator and CSV Generator Summary

**Row validation with error/warning severity, error grouping for ReviewStep, and 6-file Treez import CSV generation with JSZip bundling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T20:12:01Z
- **Completed:** 2026-03-09T20:16:26Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Validator with two severity levels: errors block import, warnings are informational
- Error grouping clusters issues by field+message for efficient bulk-fix UI in ReviewStep
- CSV generator produces all 6 Treez import files (brands, attributes, products, variants, attribute joins, images)
- ZIP generation bundles CSVs via JSZip for single-file download
- 29 total unit tests passing across both modules

## Task Commits

Each task was committed atomically (TDD red then green):

1. **Task 1: Port validator** - `13a95e8` (test: failing tests), `08ae0d7` (feat: implementation)
2. **Task 2: Build CSV generator** - `7c9b863` (test: failing tests), `c890638` (feat: implementation)

_TDD tasks have two commits each: RED (failing tests) then GREEN (implementation)_

## Files Created/Modified
- `lib/validator.ts` - validateDerivedRows and groupErrors (255 lines)
- `lib/csv-generator.ts` - buildOutputCSVs, arrayToCSV, generateZip (338 lines)
- `tests/validator.test.ts` - 17 tests for validation logic (211 lines)
- `tests/csv-generator.test.ts` - 12 tests for CSV generation and ZIP (193 lines)
- `lib/types.ts` - Added RowValidationError (with severity), ValidationResult, ErrorGroup, OutputCSVs

## Decisions Made
- Used custom RFC 4180 CSV serializer instead of SheetJS sheet_to_csv (lighter, no dependency on xlsx for pure string output)
- Classification empty = warning (not error), but invalid non-empty = error with dropdown
- Brand dedup in CSV generator uses case-insensitive first-seen-wins strategy (simpler than v1's frequency-based approach for this standalone module)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest v4 does not support -x flag**
- **Found during:** Task 1 (TDD RED)
- **Issue:** Plan specified `npx vitest run -x` but vitest v4 removed the `-x` shorthand
- **Fix:** Used `--bail 1` flag instead
- **Verification:** Tests run successfully with `--bail 1`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor CLI flag difference. No scope creep.

## Issues Encountered
None beyond the vitest flag change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Validator and CSV generator are ready for ReviewStep UI (Plan 03) and ImportStep UI (Plan 04)
- Both modules are pure logic with no UI dependencies, testable in isolation

---
*Phase: 03-transform-validate-and-import*
*Completed: 2026-03-09*
