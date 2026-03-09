---
phase: 01-extension-shell
verified: 2026-03-09T19:56:00Z
status: gaps_found
score: 4/4 truths verified, 1 test issue
re_verification: false
gaps:
  - truth: "All unit tests pass"
    status: failed
    reason: "2 content script tests fail because App.tsx uses raw chrome.runtime.sendMessage instead of the mocked sendMessage wrapper, and chrome is not defined in the jsdom test environment"
    artifacts:
      - path: "tests/content-script.test.ts"
        issue: "Tests mock lib/messaging sendMessage, but App.tsx switched to raw chrome.runtime.sendMessage for user gesture preservation. Tests for click handlers throw ReferenceError: chrome is not defined."
      - path: "entrypoints/import-page.content/App.tsx"
        issue: "Uses chrome.runtime.sendMessage directly (correct for production) but tests were written against the old sendMessage import which is no longer used in click handlers"
    missing:
      - "Add globalThis.chrome mock (with chrome.runtime.sendMessage) to vitest setup or test file so content script click handler tests can execute"
      - "Update test assertions to verify chrome.runtime.sendMessage calls instead of the @webext-core/messaging sendMessage"
---

# Phase 1: Extension Shell Verification Report

**Phase Goal:** A working Chrome extension skeleton that detects Treez pages, authenticates via session tokens, and presents the wizard UI framework
**Verified:** 2026-03-09T19:56:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Extension injects a "Migrate Products" button on the Treez Catalog module page | VERIFIED | `entrypoints/import-page.content/App.tsx` renders "Migrate Catalog" and "Migrate Inventory" buttons. Content script matches all 3 Treez import page URLs. Built manifest.json includes content_scripts entry. |
| 2 | Extension reads the Treez session token and the user does not need to log in separately | VERIFIED | `entrypoints/background/auth.ts` exports `getValidToken` which reads `tz-tokens` from page localStorage via `chrome.scripting.executeScript`. Background script registers `onMessage('getAuthToken')` handler. JWT decode, expiry check (60s buffer), and refresh-in-progress guard all implemented. |
| 3 | Extension works on production, sandbox, and dev Treez environments without reconfiguration | VERIFIED | `lib/env.ts` detects all 3 environments. `lib/constants.ts` has URL patterns for all 3. Manifest includes host_permissions for all 3 app domains + API domains. Content script matches all 3. 8 env detection tests pass. |
| 4 | Wizard UI shell renders with step navigation (steps are empty placeholders at this point) | VERIFIED | `components/wizard/WizardShell.tsx` renders 4 steps (Upload, Map, Review, Import) with Back/Next navigation. `StepIndicator.tsx` shows visual progress. `StepPlaceholder.tsx` shows placeholder content. Back disabled on step 0, Next disabled on step 3. Side panel reads wizardType from chrome.storage.session. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `wxt.config.ts` | WXT config with Chrome-only, React, Tailwind 4, side panel manifest hook | VERIFIED | Contains `defineConfig`, `extensionApi: 'chrome'`, `tailwindcss()` plugin, manifest hook deletes `side_panel` |
| `lib/env.ts` | Environment detection from URL hostname | VERIFIED | Exports `detectEnvironment`, `getApiBaseUrl`, `TreezEnv` type. 27 lines, substantive. |
| `lib/constants.ts` | Treez URL patterns, step labels, environment config | VERIFIED | Exports `IMPORT_PAGE_PATTERNS`, `STEP_LABELS`, `TREEZ_HOSTS`, `IMPORT_PATH` |
| `lib/messaging.ts` | Type-safe messaging protocol | VERIFIED | Exports `sendMessage`, `onMessage` from `defineExtensionMessaging<ProtocolMap>()` |
| `vitest.config.ts` | Test runner configuration | VERIFIED | Uses jsdom, includes tests/**/*.test.ts and .tsx |
| `tests/env.test.ts` | Environment detection tests | VERIFIED | 38 lines, 8 tests covering all env detection behaviors |
| `entrypoints/background/index.ts` | Background script with side panel control and message handlers | VERIFIED | Uses `defineBackground`, `sidePanel.setOptions`, `tabs.onUpdated`, `webNavigation.onHistoryStateUpdated`, `onMessage('getAuthToken')`, raw `chrome.runtime.onMessage` for openSidePanel |
| `entrypoints/background/auth.ts` | JWT decode, expiry check, token refresh | VERIFIED | 148 lines. Exports `decodeJwtPayload`, `isTokenExpired`, `getValidToken`. Refresh-in-progress guard implemented. |
| `entrypoints/import-page.content/index.tsx` | Content script with button injection | VERIFIED | Uses `defineContentScript`, `createIntegratedUi`, MutationObserver for SPA-safe mounting, mount guard |
| `entrypoints/import-page.content/App.tsx` | React component with migration buttons | VERIFIED | Renders "Migrate Catalog" and "Migrate Inventory" buttons with inline styles, click handlers send messages |
| `entrypoints/sidepanel/App.tsx` | Root side panel component | VERIFIED | Reads wizardType from chrome.storage.session, listens for changes, renders WizardShell |
| `components/wizard/WizardShell.tsx` | 4-step wizard container | VERIFIED | Exports `WizardShell`, uses STEP_LABELS, renders StepIndicator and StepPlaceholder, Back/Next navigation |
| `components/wizard/StepIndicator.tsx` | Visual step progress indicator | VERIFIED | Exports `StepIndicator`, shows current/completed/future step states with SVG checkmarks |
| `components/wizard/StepPlaceholder.tsx` | Empty placeholder for future content | VERIFIED | Exports `StepPlaceholder`, renders step name with "Coming in Phase 2" |
| `tests/auth.test.ts` | Token decode and expiry tests | VERIFIED | 87 lines, 11 tests for JWT decode and expiry |
| `tests/content-script.test.ts` | Button injection DOM tests | PARTIAL | 48 lines, 4 tests. 2 render tests pass, 2 click handler tests FAIL (chrome not defined) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/messaging.ts` | `@webext-core/messaging` | `defineExtensionMessaging` | WIRED | Import and call present |
| `wxt.config.ts` | `@tailwindcss/vite` | vite plugins | WIRED | `tailwindcss()` in plugins array |
| `entrypoints/import-page.content/App.tsx` | `entrypoints/background/index.ts` | `chrome.runtime.sendMessage` | WIRED | App sends `{ type: 'openSidePanel', data: { wizardType } }`, background handles via `chrome.runtime.onMessage` |
| `entrypoints/background/index.ts` | `entrypoints/background/auth.ts` | `getValidToken` import | WIRED | Import and usage in getAuthToken handler |
| `entrypoints/background/index.ts` | `lib/messaging.ts` | `onMessage` handler registration | WIRED | `onMessage('getAuthToken', ...)` registered |
| `entrypoints/background/index.ts` | `chrome.sidePanel.setOptions` | tabs.onUpdated listener | WIRED | Called in `updateSidePanelForTab` |
| `entrypoints/sidepanel/App.tsx` | `chrome.storage.session` | reads wizardType | WIRED | `chrome.storage.session.get('wizardType')` on mount + `onChanged` listener |
| `components/wizard/WizardShell.tsx` | `StepIndicator.tsx` | renders with current step | WIRED | `<StepIndicator steps={[...STEP_LABELS]} current={currentStep} />` |
| `components/wizard/WizardShell.tsx` | `StepPlaceholder.tsx` | renders placeholder | WIRED | `<StepPlaceholder stepName={STEP_LABELS[currentStep]} />` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXT-01 | 01-02, 01-03 | Chrome extension injects "Migrate Products" button on Treez Catalog module pages | SATISFIED | Content script injects "Migrate Catalog" and "Migrate Inventory" buttons on import pages. Manifest has content_scripts entry matching all 3 environments. |
| EXT-02 | 01-02 | Extension authenticates using Treez session tokens (no separate login) | SATISFIED | auth.ts reads tz-tokens from localStorage via scripting API, decodes JWT, checks expiry, refreshes with concurrency guard. Background handles getAuthToken messages. |
| EXT-03 | 01-01, 01-02 | Extension works across Treez environments (production, sandbox, dev) | SATISFIED | env.ts detects all 3 environments. Constants include URL patterns for all 3. Manifest has host_permissions for all 3. 8 passing tests confirm. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/wizard/StepPlaceholder.tsx` | 10 | "Coming in Phase 2" placeholder text | Info | Intentional -- steps are designed to be placeholders per phase goal |
| `entrypoints/background/auth.ts` | 81 | "NOTE: The exact OAuth endpoint and payload may need verification in Phase 2+" | Info | Acknowledged uncertainty in OAuth refresh endpoint -- acceptable for Phase 1 |
| `tests/content-script.test.ts` | 33-47 | Tests mock sendMessage but App uses chrome.runtime.sendMessage | Warning | 2 tests fail due to mismatch between test setup and actual implementation |

### Human Verification Required

### 1. Button Injection on Live Treez Page

**Test:** Load extension in Chrome, navigate to a Treez import page (any environment), verify buttons appear next to "Launch Import Wizard"
**Expected:** "Migrate Catalog" and "Migrate Inventory" buttons render inline, styled as teal/blue buttons
**Why human:** Content script injects into live Treez DOM which cannot be simulated in tests

### 2. Side Panel Opens on Button Click

**Test:** Click "Migrate Catalog" button, then click "Migrate Inventory" button
**Expected:** Side panel opens showing correct wizard type title. Clicking the other button while panel is open switches the wizard type.
**Why human:** chrome.sidePanel.open requires user gesture in real browser; cannot test in jsdom

### 3. Wizard Step Navigation

**Test:** In the open side panel, click Next through all 4 steps, then Back through all steps
**Expected:** Step indicator updates, placeholder content changes per step. Back disabled on step 1, Next disabled on step 4.
**Why human:** Visual rendering and interaction flow

### 4. Side Panel Restriction

**Test:** Navigate away from import page to another Treez page, attempt to open side panel
**Expected:** Side panel is not available (action click does nothing or shows default)
**Why human:** Side panel availability is per-tab browser behavior

### Gaps Summary

The phase goal is achieved -- the extension skeleton is complete with page detection, auth infrastructure, button injection, and wizard UI. All 4 success criteria from the roadmap are verified in the codebase.

There is one non-blocking gap: **2 content script tests fail** because the `App.tsx` component was correctly changed from using the `sendMessage` wrapper (from `@webext-core/messaging`) to raw `chrome.runtime.sendMessage` to preserve user gesture context for `sidePanel.open()`. However, the tests still mock the old `sendMessage` import and do not provide a `chrome` global, causing `ReferenceError: chrome is not defined` when click handlers fire.

**Test results: 21/23 pass, 2 fail**
- `tests/env.test.ts` -- 8/8 pass
- `tests/auth.test.ts` -- 11/11 pass
- `tests/content-script.test.ts` -- 2/4 pass (render tests pass, click handler tests fail)

**Build: passes** -- extension compiles to valid Chrome MV3 extension (431 KB total)

The fix is straightforward: add a `globalThis.chrome` mock with `runtime.sendMessage` as a `vi.fn()` and update assertions to check `chrome.runtime.sendMessage` calls instead of the messaging wrapper.

---

_Verified: 2026-03-09T19:56:00Z_
_Verifier: Claude (gsd-verifier)_
