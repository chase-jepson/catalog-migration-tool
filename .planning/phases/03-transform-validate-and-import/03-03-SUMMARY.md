---
phase: 03-transform-validate-and-import
plan: 03
subsystem: ui
tags: [react, chrome-extension, validation-ui, error-grouping, batch-fix]

# Dependency graph
requires:
  - phase: 03-01
    provides: "deriveRows, applyFixes transformer functions"
  - phase: 03-02
    provides: "validateDerivedRows, groupErrors validator functions"
provides:
  - "ReviewStep component with transform preview, grouped errors, and batch fix controls"
  - "WizardShell step 2 rendering ReviewStep with fixes persistence"
  - "ErrorGroupList and ErrorBatchRow for grouped error display and inline corrections"
affects: [03-04-import-step]

# Tech tracking
tech-stack:
  added: []
  patterns: [batch-fix-controls, error-grouping-by-field, re-validate-cycle]

key-files:
  created:
    - components/review/ReviewStep.tsx
    - components/review/ErrorGroupList.tsx
    - components/review/ErrorBatchRow.tsx
    - components/review/TransformPreview.tsx
  modified:
    - components/wizard/WizardShell.tsx
    - lib/types.ts

key-decisions:
  - "RowFix[] persisted to chrome.storage.local, not full DerivedRow[] (lightweight persistence)"
  - "Batch fix controls: dropdown for enum fields, text input for free-text fields"
  - "Re-validate cycle: applyFixes then validateDerivedRows after user corrections"

patterns-established:
  - "Error grouping by field/severity with expandable row details"
  - "Batch fix pattern: select value once, apply to all N affected rows"
  - "Transform preview: Original vs Treez Value columns for key fields"

requirements-completed: [VAL-03]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 3 Plan 03: ReviewStep UI Summary

**ReviewStep with transform preview, grouped validation errors, batch fix controls, and re-validate cycle wired into WizardShell step 2**

## Performance

- **Duration:** 4 min (continuation from checkpoint approval)
- **Started:** 2026-03-09T20:31:10Z
- **Completed:** 2026-03-09T20:35:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 6

## Accomplishments
- ReviewStep renders transform preview showing Original vs Treez Value for category, weight, classification fields
- Errors grouped by type/field with red badges for errors, amber for warnings, expandable to see affected rows
- Batch fix controls: dropdown for enum fields (e.g., 14 Treez categories), text input for free-text fields
- Re-validate button re-runs applyFixes + validateDerivedRows after user corrections
- Cannot proceed to Import step with unresolved blocking errors; warnings show "Import with N warnings"
- Fixes persist to chrome.storage.local as lightweight RowFix[] and restore on panel reopen

## Task Commits

Each task was committed atomically:

1. **Task 1: Build ReviewStep component with error groups, fix controls, and transform preview** - `cb13b51` (feat)
2. **Task 2: Wire ReviewStep into WizardShell and extend persistence** - `38bd5bb` (feat)
3. **Task 3: Human verification of ReviewStep flow** - approved (checkpoint, no commit)

## Files Created/Modified
- `components/review/ReviewStep.tsx` - Main review step container orchestrating transform, validate, fix cycle
- `components/review/ErrorGroupList.tsx` - Grouped error display with expand/collapse and severity badges
- `components/review/ErrorBatchRow.tsx` - Individual error batch with dropdown/text fix controls and "Apply to all" button
- `components/review/TransformPreview.tsx` - Before/after table for transformed field values
- `components/wizard/WizardShell.tsx` - Added ReviewStep rendering at step 2 with fixes state and persistence
- `lib/types.ts` - Extended PersistedMigrationState with fixes and importProgress fields

## Decisions Made
- RowFix[] persisted to chrome.storage.local instead of full DerivedRow[] (per research anti-pattern guidance)
- Batch fix controls: dropdown for enum fields, text input for free-text fields (per user decision)
- Re-validate cycle pattern: applyFixes then validateDerivedRows after user corrections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ReviewStep complete, ready for Plan 04 (Import step)
- WizardShell case 3 remains as StepPlaceholder for Plan 04 to replace
- DerivedRow[] available in WizardShell state for import step consumption
- RowFix[] persisted and restorable for session continuity

## Self-Check: PASSED

All 6 files verified present. Both task commits (cb13b51, 38bd5bb) verified in git history.

---
*Phase: 03-transform-validate-and-import*
*Completed: 2026-03-09*
