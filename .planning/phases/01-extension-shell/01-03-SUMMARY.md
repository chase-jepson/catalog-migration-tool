---
phase: 01-extension-shell
plan: 03
subsystem: ui
tags: [react, chrome-extension, side-panel, wizard, tailwind-css-4, chrome-storage]

# Dependency graph
requires:
  - phase: 01-extension-shell/01-01
    provides: "WXT scaffold, shared constants (STEP_LABELS), messaging types"
  - phase: 01-extension-shell/01-02
    provides: "Background script storing wizardType in session storage, content script injecting buttons"
provides:
  - "Side panel wizard shell with 4-step navigation"
  - "StepIndicator component for visual step progress"
  - "StepPlaceholder components ready for Phase 2+ content"
  - "Complete extension shell: button click -> side panel -> wizard UI"
affects: [02-file-upload-and-column-mapping]

# Tech tracking
tech-stack:
  added: []
  patterns: [chrome-storage-session-for-wizard-type, step-based-wizard-navigation, mount-guard-for-content-script-idempotency]

key-files:
  created:
    - components/wizard/WizardShell.tsx
    - components/wizard/StepIndicator.tsx
    - components/wizard/StepPlaceholder.tsx
    - entrypoints/sidepanel/App.tsx
  modified:
    - entrypoints/sidepanel/main.tsx
    - entrypoints/import-page.content/index.tsx
    - entrypoints/import-page.content/App.tsx
    - entrypoints/background/index.ts

key-decisions:
  - "Used raw chrome.runtime.sendMessage instead of WXT messaging wrapper to preserve user gesture context for sidePanel.open"
  - "Added mount guard in content script to prevent duplicate button injection on SPA navigation"
  - "Used data-testid attribute for button anchor selector instead of fragile DOM class selectors"

patterns-established:
  - "Wizard state: chrome.storage.session stores wizardType, side panel reads on mount and listens for changes"
  - "Content script idempotency: check for existing elements before injecting to handle SPA re-renders"
  - "Side panel reads wizard context from storage, not from message passing (avoids timing issues)"

requirements-completed: [EXT-01]

# Metrics
duration: ~15min (across two sessions with human verification)
completed: 2026-03-09
---

# Phase 1 Plan 3: Side Panel Wizard UI Summary

**4-step wizard shell in Chrome side panel with step indicator, navigation controls, and storage-based wizard type routing**

## Performance

- **Duration:** ~15 min (across two sessions including human verification)
- **Started:** 2026-03-09
- **Completed:** 2026-03-09
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 8

## Accomplishments
- Side panel renders correct wizard type (catalog/inventory) based on which button was clicked
- 4-step wizard with visual step indicator (Upload, Map, Review, Import) and Back/Next navigation
- Complete end-to-end extension flow working: page detection -> button injection -> side panel open -> wizard UI
- Fixed content script reliability (mount guard, proper button selectors, raw chrome messaging for user gesture preservation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wizard shell components and side panel wiring** - `b1aa1c4` (feat)
2. **Task 2: Fix button injection and side panel opening** - `d378e31` (fix)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `components/wizard/WizardShell.tsx` - 4-step wizard container with Back/Next navigation and title per wizard type
- `components/wizard/StepIndicator.tsx` - Horizontal step progress indicator with current/completed/future states
- `components/wizard/StepPlaceholder.tsx` - Placeholder component for each step (to be replaced in Phase 2+)
- `entrypoints/sidepanel/App.tsx` - Root side panel component, reads wizardType from chrome.storage.session
- `entrypoints/sidepanel/main.tsx` - React entry point for side panel (simplified)
- `entrypoints/import-page.content/index.tsx` - Content script with mount guard and fixed button injection
- `entrypoints/import-page.content/App.tsx` - Button component with data-testid anchor selector
- `entrypoints/background/index.ts` - Background script with raw chrome.runtime messaging for side panel

## Decisions Made
- Used raw `chrome.runtime.sendMessage` instead of WXT's typed messaging wrapper because the WXT wrapper broke user gesture context needed for `chrome.sidePanel.open()`. The Chrome API requires the call to happen in the synchronous call stack of a user gesture handler.
- Added a mount guard (`document.querySelector('[data-testid="import-wizard-button"]')`) in the content script to prevent duplicate button injection when the SPA re-renders or navigates within the import page.
- Used `data-testid` attribute as the anchor selector for injecting buttons, making it resilient to Treez UI class name changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed button anchor selector**
- **Found during:** Task 2 (human verification)
- **Issue:** Button injection was targeting a DOM element that didn't match the actual Treez import page structure
- **Fix:** Changed to use `data-testid="import-wizard-button"` as the injection anchor
- **Files modified:** entrypoints/import-page.content/index.tsx, entrypoints/import-page.content/App.tsx
- **Verification:** Buttons appear correctly on import page, no duplicates
- **Committed in:** d378e31

**2. [Rule 1 - Bug] Fixed side panel not opening on button click**
- **Found during:** Task 2 (human verification)
- **Issue:** WXT's typed messaging wrapper broke the user gesture context chain, causing `chrome.sidePanel.open()` to fail silently
- **Fix:** Replaced WXT messaging with raw `chrome.runtime.sendMessage` to preserve the synchronous user gesture call stack
- **Files modified:** entrypoints/import-page.content/App.tsx, entrypoints/background/index.ts
- **Verification:** Clicking either button now reliably opens the side panel
- **Committed in:** d378e31

**3. [Rule 1 - Bug] Added mount guard for duplicate button prevention**
- **Found during:** Task 2 (human verification)
- **Issue:** SPA navigation within Treez caused content script to re-inject buttons, creating duplicates
- **Fix:** Added element existence check before injection
- **Files modified:** entrypoints/import-page.content/index.tsx
- **Verification:** Navigating within import pages does not create duplicate buttons
- **Committed in:** d378e31

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes were necessary for the extension to function correctly. Discovered during human verification checkpoint as intended.

## Issues Encountered
- WXT's typed messaging abstraction (`defineExtensionMessaging`) does not preserve user gesture context across the async boundary, which Chrome requires for `sidePanel.open()`. This is a known limitation when the Chrome API needs synchronous access to the user gesture. Resolved by using raw Chrome messaging API.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extension shell is complete: buttons inject, side panel opens, wizard renders with navigation
- Phase 2 will replace StepPlaceholder components with real Upload and Map step content
- The wizard shell (WizardShell.tsx) is designed to accept real step components via a simple swap of StepPlaceholder
- All three entrypoints (background, content script, side panel) build and load correctly in Chrome

## Self-Check: PASSED

All key files verified present. All task commits verified in git log.

---
*Phase: 01-extension-shell*
*Completed: 2026-03-09*
