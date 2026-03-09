---
phase: 01-extension-shell
plan: 02
subsystem: extension
tags: [chrome-extension, background-script, content-script, jwt, auth, react, wxt, messaging]

# Dependency graph
requires:
  - phase: 01-extension-shell/01
    provides: WXT project, messaging protocol, constants, env detection
provides:
  - Background script with side panel enable/disable per tab URL
  - JWT decode, expiry check, and token refresh with concurrency guard
  - Content script that injects Migrate Catalog and Migrate Inventory buttons
  - Message handlers for getAuthToken and openSidePanel
affects: [01-extension-shell, 02-catalog-pipeline]

# Tech tracking
tech-stack:
  added: ["@testing-library/react@10.4", "@testing-library/jest-dom", "@vitejs/plugin-react@5.1"]
  patterns: [TDD with React Testing Library, MutationObserver for SPA-safe DOM injection, refresh-in-progress guard for token concurrency, inline styles for content script UI]

key-files:
  created: [entrypoints/background/index.ts, entrypoints/background/auth.ts, entrypoints/import-page.content/index.tsx, entrypoints/import-page.content/App.tsx, tests/auth.test.ts, tests/content-script.test.ts]
  modified: [wxt.config.ts, vitest.config.ts, package.json]

key-decisions:
  - "Content script sends tabId: 0 placeholder; background resolves real tabId from sender.tab.id"
  - "Inline styles for injected buttons (Tailwind classes unavailable in content script context)"
  - "Added @vitejs/plugin-react for JSX transform in Vitest (WXT auto-imports not available in test)"
  - "webNavigation.onHistoryStateUpdated listener for SPA navigation detection"

patterns-established:
  - "Token refresh concurrency guard via module-level Promise variable"
  - "MutationObserver + timeout fallback for SPA-safe content script mounting"
  - "TDD flow with React Testing Library for component testing"

requirements-completed: [EXT-01, EXT-02, EXT-03]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 1 Plan 2: Background and Content Scripts Summary

**Background script with JWT auth/refresh, per-tab side panel control, and content script injecting Migrate Catalog/Inventory buttons on Treez import pages**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T16:56:54Z
- **Completed:** 2026-03-09T17:00:25Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Background script enables side panel only on Treez import page tabs via URL pattern matching
- Auth module decodes JWTs, detects expiry with 60s buffer, refreshes tokens with concurrency guard
- Content script injects two styled buttons on import pages with SPA-safe MutationObserver mounting
- Button clicks send typed messages to background to open side panel with wizard type
- 23 total tests passing across 3 test files (11 auth + 4 content script + 8 env)
- Extension builds successfully with content_scripts and background entries in manifest

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing auth tests** - `ee917fc` (test)
2. **Task 1 GREEN: Auth module and background script** - `30774fd` (feat)
3. **Task 2 RED: Failing content script tests** - `5bddd26` (test)
4. **Task 2 GREEN: Content script with button injection** - `1bd9608` (feat)

_TDD flow: each task has separate RED and GREEN commits._

## Files Created/Modified
- `entrypoints/background/index.ts` - Background script with side panel control, SPA nav detection, message handlers
- `entrypoints/background/auth.ts` - JWT decode, expiry check, token refresh with concurrency guard
- `entrypoints/import-page.content/index.tsx` - Content script with MutationObserver for SPA-safe button injection
- `entrypoints/import-page.content/App.tsx` - React component rendering Migrate Catalog and Migrate Inventory buttons
- `tests/auth.test.ts` - 11 tests for decodeJwtPayload and isTokenExpired
- `tests/content-script.test.ts` - 4 tests for button rendering and click message handlers
- `wxt.config.ts` - Added webNavigation permission
- `vitest.config.ts` - Added @vitejs/plugin-react for JSX transform
- `package.json` - Added testing-library and vite-react plugin deps

## Decisions Made
- Content script sends tabId: 0 as placeholder; background script resolves actual tabId from `message.sender.tab.id` (content scripts lack access to their own tabId)
- Used inline styles for injected buttons because Tailwind CSS classes are not available in content script context (no shadow DOM, no Tailwind build for content scripts)
- Added `@vitejs/plugin-react` to vitest.config.ts because WXT's auto-import for React JSX doesn't apply during Vitest execution
- Dual navigation listeners: `tabs.onUpdated` for standard navigation + `webNavigation.onHistoryStateUpdated` for SPA client-side routing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @vitejs/plugin-react for JSX in Vitest**
- **Found during:** Task 2 (content script TDD GREEN)
- **Issue:** JSX in App.tsx compiled by WXT at build time but not by Vitest -- "React is not defined" error
- **Fix:** Installed @vitejs/plugin-react and added to vitest.config.ts plugins
- **Files modified:** vitest.config.ts, package.json
- **Verification:** All content script tests pass
- **Committed in:** 1bd9608

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for test execution. No scope creep.

## Issues Encountered
None beyond the JSX transform issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both core extension entrypoints (background + content script) are operational
- Ready for Plan 03 (side panel wizard shell UI)
- Messaging protocol wired end-to-end: buttons -> background -> side panel
- Auth token handling ready for API calls in Phase 2+

---
*Phase: 01-extension-shell*
*Completed: 2026-03-09*

## Self-Check: PASSED

All 6 created files verified on disk. All 4 commit hashes verified in git log.
