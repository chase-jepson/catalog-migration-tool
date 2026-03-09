# Phase 1: Extension Shell - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

WXT-based Chrome extension skeleton that detects the Treez import page, authenticates via session tokens, and presents the wizard UI framework in a side panel. This phase delivers the shell only — wizard steps are empty placeholders filled in Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### UI Surface
- Side panel (not popup) — docked to the right, full height, more room for data tables
- Side panel only available on the import page (`/treez-admin/import/home`), not across the whole Treez app

### Button Injection
- Content script injects on the Treez import page only: `https://app.treez.io/treez-admin/import/home` (and sandbox/dev equivalents)
- Two buttons: "Migrate Catalog" and "Migrate Inventory" (separate wizards, not a combined flow)
- Buttons appear to the right of the existing "Launch Import Wizard" button
- Must detect environment from URL: `app.treez.io`, `app.sandbox.treez.io`, `app.dev.treez.io`

### Wizard Design
- 4-step wizard (same as v1): Upload → Map → Review → Import
- Each migration type (catalog/inventory) uses its own 4-step wizard instance
- Step navigation with progress indicator
- Steps are empty placeholders in this phase — just the shell and navigation

### Auth Flow
- Read Treez session token from `tz-tokens` in localStorage (same approach as v1)
- Service worker handles token refresh (check JWT exp claim, use refresh_token)
- No separate login — piggyback on existing Treez session

### Claude's Discretion
- Side panel width and styling
- Step indicator visual design (stepper, progress bar, tabs)
- Icon design for extension
- WXT project structure and configuration details

</decisions>

<specifics>
## Specific Ideas

- v1 content script at `projects/chrome-extension/src/content/inject-button.ts` has proven button injection pattern — adapt for new page target
- v1 service worker at `projects/chrome-extension/src/background/service-worker.ts` has working token refresh logic — port to WXT
- Research recommends WXT over CRXJS for the extension framework (CRXJS maintenance concerns)
- npm workspaces monorepo structure (shared types between extension and future backend)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `chrome-extension/src/content/inject-button.ts`: Button injection pattern for Treez pages — needs URL target change
- `chrome-extension/src/background/service-worker.ts`: Token refresh, CORS proxy, S3 upload handling
- `chrome-extension/src/popup/App.tsx`: 4-step wizard state machine pattern
- `chrome-extension/manifest.json`: MV3 manifest with host_permissions for Treez domains

### Established Patterns
- Token read from `tz-tokens` localStorage key
- Environment detection from URL hostname
- Message passing between content script ↔ service worker for API calls

### Integration Points
- Content script injects into Treez import page DOM
- Side panel opens when user clicks injected button
- Service worker acts as thin relay for CORS-restricted API calls

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-extension-shell*
*Context gathered: 2026-03-09*
