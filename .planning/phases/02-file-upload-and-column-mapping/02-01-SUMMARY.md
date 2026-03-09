---
phase: 02-file-upload-and-column-mapping
plan: 01
subsystem: parsing, detection, mapping
tags: [xlsx, csv, pos-detection, column-mapping, sheetjs, tdd]

requires:
  - phase: 01-extension-shell
    provides: WXT project scaffold, WizardShell, existing lib/constants.ts
provides:
  - ParsedFile, FieldMapping, MappingFieldDef, MappingGroup, POSDetectionResult types
  - File parser (CSV/XLSX) with validateFile, parseFile, mergeFiles, getSheetNames
  - POS detection with scorePOS, detectPOS (6 POS systems, multi-file majority vote)
  - Mapping engine with applyPOSDefaults, updateMapping, clearAllMappings, getUnmappedRequired, getMappingsByGroup, getSampleValue
  - 24 mapping field definitions with group and required properties
  - 6 POS default templates (Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova)
  - Phase 3 readiness constants (PRODUCT_CATEGORIES, PRODUCT_SUBCATEGORIES, UOM_BY_CATEGORY, VALID_CLASSIFICATIONS)
  - 6 POS fixture CSVs for testing
affects: [02-02, 02-03, 03-data-transformation]

tech-stack:
  added: [xlsx 0.18.5]
  patterns: [TDD with Vitest, immutable mapping updates, POS header-signature scoring]

key-files:
  created:
    - lib/types.ts
    - lib/parser.ts
    - lib/pos-detection.ts
    - lib/mapping-engine.ts
    - tests/parser.test.ts
    - tests/pos-detection.test.ts
    - tests/mapping-engine.test.ts
    - tests/constants.test.ts
    - tests/fixtures/dutchie-sample.csv
    - tests/fixtures/blaze-sample.csv
    - tests/fixtures/flowhub-sample.csv
    - tests/fixtures/indicaonline-sample.csv
    - tests/fixtures/meadow-sample.csv
    - tests/fixtures/cova-sample.csv
  modified:
    - lib/constants.ts
    - wxt.config.ts
    - package.json

key-decisions:
  - "Unified SheetJS parser for both CSV and XLSX -- no PapaParse needed"
  - "Main-thread parsing (no Web Worker) -- 10k rows parses in <50ms, no UI freeze concern"
  - "variantIdentifier placed in Display & Media group as hidden field"
  - "unlimitedStorage permission added for chrome.storage.local large file persistence"

patterns-established:
  - "POS detection: score headers against POS_DEFAULTS, threshold >= 3 matches AND > 40%"
  - "Immutable mapping updates: updateMapping returns new array, never mutates"
  - "Hidden fields filtered from getMappingsByGroup but still present in applyPOSDefaults"
  - "TDD: write failing tests first, then implement, verify all pass"

requirements-completed: [FILE-01, FILE-02, FILE-03, FILE-04, MAP-01]

duration: 5min
completed: 2026-03-09
---

# Phase 2 Plan 1: Core Data Types, Parser, POS Detection, and Mapping Engine Summary

**SheetJS-based CSV/XLSX parser with 6-POS auto-detection via header scoring and grouped column mapping engine with 77 passing tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T18:42:46Z
- **Completed:** 2026-03-09T18:48:04Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Created typed foundation for all Phase 2 UI components (ParsedFile, FieldMapping, MappingFieldDef, MappingGroup, POSDetectionResult)
- Ported and enhanced all v1 constants: 24 mapping fields with groups/required, 6 POS default templates, createEmptyMappings
- Built file parser handling CSV and XLSX with detectHeaderRow (Blaze edge case), multi-sheet selection, and 10k+ row support
- Implemented POS auto-detection with multi-file majority vote and disagreement tracking
- Created mapping engine with immutable updates, required-field validation, group-based UI helpers, and sample value extraction
- 77 total tests passing (40 new + 37 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, constants, and test fixtures** - `66dfe6c` (feat)
2. **Task 2: File parser, POS detection, and mapping engine with tests** - `636ce33` (feat)

## Files Created/Modified
- `lib/types.ts` - Shared types for ParsedFile, FieldMapping, MappingFieldDef, MappingGroup, POSDetectionResult, PersistedMigrationState
- `lib/constants.ts` - Extended with POS_SYSTEMS, MAPPING_FIELDS (24 fields), POS_DEFAULTS (6 templates), MAPPING_GROUPS, Phase 3 constants
- `lib/parser.ts` - validateFile, parseFile, getSheetNames, mergeFiles, formatFileSize, detectHeaderRow
- `lib/pos-detection.ts` - scorePOS, detectPOS with multi-file majority vote
- `lib/mapping-engine.ts` - applyPOSDefaults, updateMapping, clearAllMappings, getUnmappedRequired, getMappingsByGroup, getSampleValue
- `tests/constants.test.ts` - 14 tests for constants and types
- `tests/parser.test.ts` - 15 tests for file parsing including 10k-row stress test
- `tests/pos-detection.test.ts` - 11 tests for POS detection including all 6 fixtures
- `tests/mapping-engine.test.ts` - 14 tests for mapping engine
- `tests/fixtures/*.csv` - 6 POS-specific fixture CSVs with realistic cannabis product data
- `wxt.config.ts` - Added unlimitedStorage permission
- `package.json` - Added xlsx dependency

## Decisions Made
- Used SheetJS (xlsx) as unified parser for both CSV and XLSX -- eliminates need for PapaParse
- Main-thread parsing chosen over Web Worker since 10k rows parsed in <50ms (well under 200ms threshold)
- variantIdentifier placed in Display & Media group as hidden field (not visible in mapping UI but auto-mapped for Flowhub)
- Added unlimitedStorage permission to support persisting large parsed datasets in chrome.storage.local

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All library modules ready for Upload step UI (Plan 02) and Mapping step UI (Plan 03)
- Every UI component can import from lib/types.ts, lib/parser.ts, lib/pos-detection.ts, lib/mapping-engine.ts
- 6 POS fixture CSVs available for integration testing
- Phase 3 readiness constants (categories, subcategories, UOM, classifications) already ported

---
*Phase: 02-file-upload-and-column-mapping*
*Completed: 2026-03-09*
