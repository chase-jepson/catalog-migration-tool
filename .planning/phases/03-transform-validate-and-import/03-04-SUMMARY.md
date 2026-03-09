---
phase: 03-transform-validate-and-import
plan: 04
subsystem: ui, api
tags: [chrome-extension, s3-upload, import, polling, progress-tracking, csv, zip]

# Dependency graph
requires:
  - phase: 03-transform-validate-and-import/03-02
    provides: CSV generator (buildOutputCSVs, generateZip, arrayToCSV)
  - phase: 03-transform-validate-and-import/03-03
    provides: ReviewStep with validated DerivedRow[] and RowFix[]
  - phase: 01-extension-shell
    provides: Background service worker messaging, auth token retrieval
provides:
  - ImportStep UI with sequential S3 upload, adaptive polling, per-file progress
  - Messaging protocol extensions (getPresignedUrl, uploadToS3, fetchImportReport)
  - Background handlers for file-management API relay (CORS-safe)
  - File uploader module (buildUploadPayload, getUploadSequence, uploadFile)
  - Import poller module (calculateETA, getAdaptiveInterval, pollImportStatus)
  - Complete end-to-end wizard flow: Upload -> Map -> Review -> Import
affects: [04-backend-persistence]

# Tech tracking
tech-stack:
  added: [file-saver]
  patterns: [adaptive-polling, sequential-upload, background-api-relay]

key-files:
  created:
    - lib/file-uploader.ts
    - lib/import-poller.ts
    - components/import/ImportStep.tsx
    - components/import/ImportFileList.tsx
    - components/import/ImportProgress.tsx
    - tests/file-uploader.test.ts
    - tests/import-poller.test.ts
  modified:
    - lib/types.ts
    - lib/messaging.ts
    - entrypoints/background/index.ts
    - components/wizard/WizardShell.tsx

key-decisions:
  - "Background getAuthToken handler falls back to querying active tab when sender.tab is unavailable (side panel context)"
  - "Side panel resets wizard on tab refresh via chrome.storage.session signaling"
  - "ImportStep disables Generate button when derivedRows is empty to prevent invalid state"

patterns-established:
  - "Background API relay: side panel sends message, background fetches with auth token, returns result (avoids CORS)"
  - "Adaptive polling: 5s interval for <1000 rows, 15s for >=1000 rows"
  - "Tab refresh detection: background writes to chrome.storage.session, side panel listens and resets"

requirements-completed: [IMP-02, IMP-03]

# Metrics
duration: ~30min (across multiple sessions with checkpoint)
completed: 2026-03-09
---

# Phase 3 Plan 4: ImportStep Summary

**Sequential S3 upload with adaptive polling, per-file progress tracking, ZIP download, and error recovery -- completing the end-to-end catalog migration pipeline**

## Performance

- **Duration:** ~30min (across multiple sessions with human-verify checkpoint)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 11

## Accomplishments
- Extended messaging protocol with getPresignedUrl, uploadToS3, and fetchImportReport message types
- Built file-uploader module with payload construction, upload sequencing (Brands -> Images), and empty file skipping
- Built import-poller module with adaptive intervals (5s/<1000 rows, 15s/>=1000 rows) and human-readable ETA calculation
- Added background service worker handlers that relay API calls through the extension (CORS-safe)
- Built ImportStep UI with pre-import ZIP download, sequential upload, per-file status icons, progress bar, and ETA
- Error recovery: stops on failure, shows which file failed, offers retry-from-failed-file
- Success state with checkmarks, row counts, Start New Migration and Download CSVs Again buttons
- Wired ImportStep into WizardShell as step 3, completing the full 4-step wizard flow
- Fixed auth token retrieval from side panel context (no sender.tab) and added tab refresh reset

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing tests + messaging protocol + file-uploader + import-poller + background handlers** - `0281e59` (test), `0535c32` (feat)
2. **Task 2: ImportStep UI with per-file progress, ZIP download, and WizardShell wiring** - `76d3a20` (feat)
3. **Task 3: Human verification of ImportStep flow** - approved (checkpoint, no commit)

**Bugfix:** `fa79bf3` (fix) - Auth token retrieval from side panel, tab refresh reset, empty derivedRows guard

## Files Created/Modified
- `lib/file-uploader.ts` - S3 upload payload construction and sequential upload orchestration
- `lib/import-poller.ts` - Import status polling with adaptive intervals and ETA calculation
- `components/import/ImportStep.tsx` - Main import step: ZIP download, sequential upload, polling, error recovery, success state
- `components/import/ImportFileList.tsx` - Vertical list of 6 import files with status icons
- `components/import/ImportProgress.tsx` - Progress bar with ETA for current file
- `tests/file-uploader.test.ts` - Tests for payload construction, upload sequence, empty file skipping
- `tests/import-poller.test.ts` - Tests for ETA calculation, adaptive intervals, terminal status
- `lib/types.ts` - Added FileStatus, ImportObjectType, ImportFileState, ImportProgress, ImportJob types
- `lib/messaging.ts` - Extended ProtocolMap with getPresignedUrl, uploadToS3, fetchImportReport
- `entrypoints/background/index.ts` - Added message handlers for file-management API relay
- `components/wizard/WizardShell.tsx` - Wired ImportStep as step 3, hid footer on import step

## Decisions Made
- Background getAuthToken handler falls back to querying active tab when sender.tab is unavailable (side panel has no sender.tab)
- Side panel resets wizard on tab refresh via chrome.storage.session signaling from background
- ImportStep disables Generate button when derivedRows is empty to prevent generating empty CSVs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed auth token retrieval from side panel context**
- **Found during:** Task 2 / checkpoint testing
- **Issue:** Background getAuthToken handler relied on sender.tab which is null when called from side panel
- **Fix:** Added fallback to query the active tab when sender.tab is unavailable
- **Files modified:** entrypoints/background/index.ts
- **Committed in:** fa79bf3

**2. [Rule 1 - Bug] Added tab refresh reset for side panel**
- **Found during:** Checkpoint testing
- **Issue:** Side panel did not reset wizard state when the user navigated away from the Treez page
- **Fix:** Background signals side panel via chrome.storage.session on tab refresh; side panel listens and resets
- **Files modified:** entrypoints/background/index.ts, components/wizard/WizardShell.tsx
- **Committed in:** fa79bf3

**3. [Rule 2 - Missing Critical] Disabled Generate button when derivedRows is empty**
- **Found during:** Checkpoint testing
- **Issue:** Generate button could be clicked with no data, leading to empty CSV generation
- **Fix:** Added disabled state check on derivedRows length
- **Files modified:** components/import/ImportStep.tsx
- **Committed in:** fa79bf3

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All fixes necessary for correct operation in side panel context. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 is now complete -- the tool is functionally equivalent to v1
- Full wizard flow operational: Upload -> Map -> Review -> Import
- Ready for Phase 4: Backend Persistence (saved mappings, durable migration state)
- Known future work: ZIP download marked as TEMPORARY (Phase 4 will handle imports server-side)

---
*Phase: 03-transform-validate-and-import*
*Completed: 2026-03-09*

## Self-Check: PASSED

- All 11 files verified present on disk
- All 4 commits verified in git history (0281e59, 0535c32, 76d3a20, fa79bf3)
