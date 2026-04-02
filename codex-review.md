# Catalog Migration Tool Review

Date: 2026-04-01

## Scope

This review covers the extension source, configs, tests, docs, and dev utilities in this folder. I focused on runtime correctness, extension/platform risks, inventory and catalog import reliability, state persistence, and maintainability. I did not audit `node_modules`, `.output`, or generated WXT artifacts.

## Verification Run

- `pnpm test`
  - Result: 25 test files passed, 1 skipped
  - Result: 595 tests passed, 15 skipped, 0 failed
- `pnpm typecheck`
  - Result: passed
- `pnpm lint`
  - Result: 0 errors, 38 warnings

## Executive Summary

The extension is in much better shape than a typical side-project extension: tests are broad, typecheck passes, and the ETL surface area is well covered. The biggest remaining problems are in inventory import orchestration rather than raw transformation logic:

1. Portal and environment wiring is inconsistent enough to break inventory flows in some environments.
2. Resume/persistence is incomplete for the later wizard steps, so “resume” can strand users in an import step with no importable data.
3. Inventory file-role handling allows ambiguous input and then silently drops files.
4. One portal failure path currently renders as a successful import.

Those are the items I would fix first before doing cleanup or polish.

## Findings

### P1. Portal API host permissions and environment URLs are out of sync with the code

**Evidence**

- `wxt.config.ts:18-31` grants host permissions for Treez APIs and S3, but does not include `https://customer-success.mso.treez.io/*`.
- `entrypoints/background/index.ts:136-280` makes portal login, validation, execute, rollback, cancel, and reindex requests against `https://customer-success.mso.treez.io`.
- `lib/env.ts:29-37` returns `https://api.dev.treez.io` for `getMsoApiBaseUrl("dev")`, while the manifest only allows `https://api-mso-dev.treez.io/*`.

**Impact**

- All portal-backed inventory flows are at risk because the background service worker is fetching a host that the manifest does not declare.
- Dev inventory store lookup is also at risk because the runtime URL and the declared host permission do not match.
- This is the kind of issue unit tests will not catch, but users will hit immediately in the browser.

**Recommended fix**

- Add explicit host permissions for the customer-success portal.
- Reconcile `getMsoApiBaseUrl()` with the actual permitted origins for sandbox and dev.
- Add a small manifest/runtime contract test that asserts every runtime API origin is covered by manifest host permissions.

**Plan-mode task shape**

- Update manifest host permissions.
- Normalize `lib/env.ts` URLs.
- Add tests for `getMsoApiBaseUrl()` and a manifest-origin consistency check.
- Smoke-test inventory login/store fetch/portal validate in each supported environment.

### P1. Resume flow does not persist enough state to restore the wizard safely

**Evidence**

- `components/wizard/WizardShell.tsx:164-210` restores only parsed files, mappings, fixes, current step, and a few inventory fields.
- `lib/types.ts:76-85` and `lib/types.ts:419-432` do not persist derived rows, detected POS, portal job/store IDs, import status, or completion state.
- `components/wizard/WizardShell.tsx:422-430` passes `inventoryDerivedRows`, `portalJobId`, and `portalStoreId` into `InventoryImportStep`, but none of those are restored.
- `components/wizard/WizardShell.tsx:463-471` passes `derivedRows` into `ImportStep`, but catalog derived rows are also not restored.

**Impact**

- Resuming directly into step 3 can reopen the import screen with no derived rows and no active portal job context.
- The UI says “resume previous migration,” but the restored state is only partial; later-step resumes are effectively broken.
- This is especially risky for interrupted imports, because the user believes the extension preserved enough context to continue.

**Recommended fix**

- Decide whether resume should support only pre-review steps or the full flow.
- If full-flow resume is desired, persist and restore:
  - `derivedRows`
  - `inventoryDerivedRows`
  - `detectedPOS`
  - `portalJobId`
  - `portalStoreId`
  - import phase/completion state
- If full-flow resume is not desired, block resume for later steps and restart from the last recomputable step instead of restoring into a broken state.

**Plan-mode task shape**

- Expand persisted state types.
- Add explicit restoration logic in `WizardShell`.
- Add regression tests for resume into Mapping, Review, and Import for both catalog and inventory flows.
- Define UX for interrupted import jobs.

### P1. Inventory upload allows duplicate file roles, but the ETL silently uses only the first file for each role

**Evidence**

- `components/inventory/InventoryUploadStep.tsx:178-189` auto-adds assignments without enforcing uniqueness.
- `components/inventory/InventoryUploadStep.tsx:277-366` detects duplicate roles only for warning text in the UI.
- `components/inventory/InventoryReviewStep.tsx:52-62` builds ETL input with `find(...)`, meaning only the first matching file for each role is used.

**Impact**

- If two uploaded files are both marked `inventory`, `receipts`, `vendors`, etc., only one is used and the others are silently ignored.
- This is a data-loss class bug, not just a UX nit: the user can believe multiple files are participating in the import when they are not.

**Recommended fix**

- Enforce role uniqueness in step 1 rather than warning about it.
- Either:
  - prevent duplicate assignments entirely, or
  - explicitly support multi-file-per-role merging and make that behavior deterministic and visible.
- Block “Next” while required role assignment is ambiguous.

**Plan-mode task shape**

- Update role assignment logic and validation.
- Decide whether duplicate roles should be rejected or merged.
- Add unit tests around `buildETLInput()` and step gating.
- Add UI messaging for ambiguous assignments.

### P1. Portal-import failure is rendered as a success state

**Evidence**

- `components/inventory/InventoryImportStep.tsx:288-299` sets `phase` to `"done"` even when portal job status is `"FAILED"`.
- `components/inventory/InventoryImportStep.tsx:489-500` renders a green “Inventory import completed successfully” banner for every `"done"` state.
- The error message for the failed portal import is stored, but the red error panel is only rendered in `phase === "error"` at `components/inventory/InventoryImportStep.tsx:627-630`.

**Impact**

- A failed portal job can end on a success banner with a row count, which is the worst possible UX for an import tool.
- Users can walk away believing the import succeeded when the backend explicitly reported failure.

**Recommended fix**

- Split terminal states into at least:
  - success
  - completed-with-failures
  - failed
- Render failure messaging and available remediation actions based on the real terminal state.
- Keep rollback/reindex affordances aligned with the actual status.

**Plan-mode task shape**

- Refactor `phase`/terminal status model.
- Update terminal-state UI in `InventoryImportStep`.
- Add tests for `COMPLETED`, `FAILED`, and `ROLLED_BACK` portal polling results.

### P2. File identity is based only on `fileName`, which breaks duplicate-name handling

**Evidence**

- `components/upload/UploadStep.tsx:120-132` removes files by `fileName`.
- `components/inventory/InventoryUploadStep.tsx:214-244` removes files and updates roles by `fileName`.
- `components/inventory/InventoryUploadStep.tsx:360-370` also uses `file.fileName` as the React list key and lookup key.

**Impact**

- If two files with the same name are uploaded from different folders, removing one removes both.
- Role reassignment can apply to every file sharing the same name.
- Duplicate React keys can also produce unstable rendering behavior.

**Recommended fix**

- Introduce a stable per-upload ID in `ParsedFile` or wrap parsed files in an upload-session object.
- Use that ID for remove, role assignment, rendering keys, and persistence.

**Plan-mode task shape**

- Add unique upload IDs.
- Update all UI event handlers and persisted state to use IDs instead of names.
- Add tests for same-name uploads in both catalog and inventory flows.

### P2. Session storage is globally exposed to untrusted contexts while also holding portal auth

**Evidence**

- `entrypoints/background/index.ts:5-8` sets `chrome.storage.session` access level to `TRUSTED_AND_UNTRUSTED_CONTEXTS`.
- `lib/portal-auth.ts:1-33` stores the portal auth payload, including bearer token and expiry, in `chrome.storage.session`.

**Impact**

- This broadens the blast radius of sensitive session data unnecessarily.
- Even if current content scripts are trusted, the storage policy is wider than it needs to be for a token-bearing value.

**Recommended fix**

- Do not expose all session storage to untrusted contexts by default.
- Either:
  - keep portal auth in background memory/session-only messaging, or
  - isolate token-bearing state from any storage that must be shared with content scripts.
- Audit which session keys truly need content-script access.

**Plan-mode task shape**

- Inventory session keys and consumers.
- Move portal auth behind background-only helpers.
- Narrow or remove `setAccessLevel(...)`.
- Add tests or assertions around token access paths.

### P3. Catalog import logic is duplicated in two separate execution paths

**Evidence**

- `components/import/ImportStep.tsx:95-263` defines `runImport`.
- `components/import/ImportStep.tsx:268-409` re-implements almost the same upload/poll/import loop inside `handleStartImport`.

**Impact**

- The initial import path and retry path can diverge silently over time.
- This already makes the component harder to reason about and increases the chance that a future fix lands in one path but not the other.

**Recommended fix**

- Collapse the import execution into a single orchestration function used by both first-run and retry.
- Keep ZIP generation separate if needed, but avoid duplicating the upload/poll lifecycle.

**Plan-mode task shape**

- Extract one shared execution path.
- Add tests for first-run and retry behavior.
- Verify ETA/progress/file-state behavior remains consistent across both entry points.

### P3. Completion UX is inconsistent: inventory flow has no footer completion action

**Evidence**

- `components/wizard/WizardShell.tsx:75` tracks a single `importDone` flag.
- `components/wizard/WizardShell.tsx:463-471` only catalog import sets `onDone={() => setImportDone(true)}`.
- `components/wizard/WizardShell.tsx:620-648` shows the footer `Done` button only when `importDone` is true.
- `components/wizard/WizardShell.tsx:424-430` does not pass any completion callback into `InventoryImportStep`.

**Impact**

- Catalog users get an explicit close/finish affordance.
- Inventory users finish on the last step with no matching footer action and must use the drawer close icon or “Start New.”

**Recommended fix**

- Normalize completion semantics across catalog and inventory.
- Either let `InventoryImportStep` report completion to `WizardShell`, or move completion actions fully into the step component.

**Plan-mode task shape**

- Define a shared completion contract for both flows.
- Add a completion callback for inventory or rework footer ownership.
- Add a UI regression test for final-step actions.

## Secondary Health Issues

These are not the first fixes I would ship, but they should be planned after the high-impact work above.

### Tooling and code health

- `pnpm lint` currently reports 45 warnings.
- The warning mix is mostly unused imports/vars, but there are also hook-dependency and `set-state-in-effect` warnings worth triaging.
- Several files suppress `react-hooks/exhaustive-deps`, especially in wizard review/upload flows. Those need a deliberate pass instead of growing by attrition.

### Documentation drift

- `ARCHITECTURE.md:121`, `AGENTS.md:13`, and `AGENTS.md:96` still say “434 tests across 19 files.”
- Current verified result is 594 total tests with 579 passing and 15 skipped.
- `docs/ROADMAP.md` also cites a different count.

### Review-document drift

- `docs/review-2026-03-24.md` still exists and contains findings that have since been fixed alongside findings that still appear relevant.
- Once the current fixes land, it would be worth either superseding older review docs or making it explicit which one is authoritative.

## Suggested Fix Order

1. Fix manifest/runtime origin mismatches and portal host permissions.
2. Fix inventory terminal-state UX so failed imports cannot render as success.
3. Redesign resume/persistence boundaries and implement a tested restore model.
4. Enforce unique inventory file-role assignment or implement explicit multi-file merge behavior.
5. Replace `fileName` identity with stable upload IDs.
6. Harden portal-token storage/access.
7. Deduplicate catalog import orchestration.
8. Clean up lint warnings and stale docs after the behavioral fixes land.

## Good News

- Tests are broad and already catch a lot of ETL regressions.
- Type safety is solid enough that the biggest remaining problems are mostly orchestration and platform-integration issues, not pervasive type or transformation chaos.
- The codebase is small enough that the action plan can be concrete and finite rather than open-ended.
