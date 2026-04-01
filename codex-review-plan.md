# Codex Review Remediation Plan

## Summary

Use a phased implementation so we fix the highest-risk runtime issues first, verify each checkpoint, and avoid mixing correctness work with cleanup. The plan covers all findings from `codex-review.md`, including the secondary cleanup phase.

Default decisions locked in:
- Sequence work in phases, with verification gates between phases.
- Include lint/doc cleanup as the final phase, not mixed into the runtime fixes.
- Treat resume behavior as a product decision to make explicit in code: either fully restorable or intentionally recomputed from the last safe step, with no partial/broken resumes.

## Implementation Changes

### Phase 1: Environment and import-correctness blockers

- Reconcile manifest host permissions with all real runtime fetch targets.
  - Add portal host permissions for `customer-success.mso.treez.io`.
  - Align `lib/env.ts` MSO/dev URLs with the manifest and actual environments.
  - Add a lightweight test or assertion that runtime API origins are covered by manifest permissions.

- Fix inventory terminal-state handling so failed portal imports cannot render as success.
  - Replace the current overloaded `"done"` state with explicit terminal states for success, failure, and completed-with-failures.
  - Update `InventoryImportStep` rendering so banner color, copy, actions, and rollback/reindex visibility match the real backend outcome.
  - Ensure portal polling paths for `COMPLETED`, `FAILED`, and `ROLLED_BACK` are each handled distinctly.

- Normalize completion behavior between catalog and inventory flows.
  - Add a shared completion contract between the import step and `WizardShell`.
  - Ensure inventory imports can surface a real completion signal so the shell footer can show a consistent final action, or move close/start-new ownership fully into the step component.
  - Keep close/start-new behavior decision-complete and identical across both flows.

### Phase 2: Resume-state redesign and restoration

- Redesign persisted wizard state so resume is safe and explicit.
  - Decide the supported restore boundary:
    - Preferred: support resume through Mapping and Review directly, and restore Import only when the required derived/job state is also persisted.
    - Fallback: if full import-step resume is not supportable, downgrade restore targets to the last recomputable step instead of restoring broken state.
  - Extend persisted state types to include the minimum required fields for the chosen boundary:
    - detected POS
    - derived rows
    - inventory derived rows
    - portal job/store IDs when relevant
    - import completion/phase state if import-step resume is supported

- Update `WizardShell` restore logic to match the new persistence contract.
  - Restore only valid, self-consistent snapshots.
  - Refuse or downgrade incomplete later-step restores.
  - Reset orphaned import context on "Start Fresh" and store change.

- Add resume-specific acceptance rules.
  - Catalog: resume from Mapping, Review, and post-review import entry without missing data.
  - Inventory: resume from Upload/Mapping/Review safely, and only resume import when all required import context exists.

### Phase 3: Inventory file-role and file-identity hardening

- Replace `fileName`-based identity with stable per-upload IDs.
  - Add an ID to the parsed/uploaded file model or wrap files in a session object.
  - Use that ID for remove, lookup, role assignment, React keys, and persistence.
  - Preserve displayed filenames for UX only.

- Enforce deterministic inventory role assignment.
  - Remove the current "warn but continue" behavior for duplicate roles.
  - Preferred approach: require one file per role and block progress while a required role is duplicated.
  - If multi-file-per-role support is later desired, treat it as a separate feature with explicit merge semantics rather than implicit first-file wins.

- Make ETL input construction strict.
  - `buildETLInput` should operate on already-validated assignments, not silently pick the first matching file.
  - Surface assignment errors before ETL runs.

### Phase 4: Session/token boundary hardening

- Reduce exposure of session storage.
  - Remove or narrow `chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })` unless a specific shared key truly requires it.
  - Separate sensitive portal auth from any state that content scripts must read.
  - Prefer background-owned auth access through messaging/helpers rather than storing bearer tokens in broadly exposed session storage.

- Document the storage model in code.
  - Make clear which keys are background-only, which are resumable UI state, and which are intentionally shared.

### Phase 5: Catalog import orchestration cleanup

- Collapse duplicated catalog import execution paths into one shared orchestration flow.
  - Keep ZIP generation as a setup step if needed, but use one upload/poll/state-management path for both initial import and retry.
  - Preserve existing visible behavior for file ordering, progress, and retry semantics while removing logic duplication.

- Re-verify shell/import-step interaction after refactor.
  - Confirm completion callbacks, retry paths, error banners, and totals still behave correctly.

### Phase 6: Cleanup and documentation closeout

- Reduce lint warnings to a deliberate baseline.
  - Clean unused imports/vars.
  - Resolve or intentionally document hook-dependency warnings and `set-state-in-effect` warnings.
  - Remove stale `eslint-disable` comments where no longer needed.

- Update stale docs and repo instructions.
  - Refresh test-count references in docs and repo guidance.
  - Make `codex-review.md` the current review source of truth and avoid conflicting historical guidance.

## Public Interfaces and Type Changes

- Persisted wizard-state interfaces will change to carry explicit resume-safe data for the chosen restore boundary.
- Parsed/uploaded file identity will change from filename-derived behavior to stable upload IDs.
- Import-step phase/status models will become more explicit, especially for inventory terminal states.
- No external/public API changes are expected outside the extension internals, but internal messaging/state contracts should be treated as first-class interfaces and updated consistently.

## Test Plan

- Manifest/environment coverage
  - `getMsoApiBaseUrl()` matches real supported origins.
  - Runtime fetch origins are represented in manifest host permissions.

- Inventory import state handling
  - Portal polling returns `COMPLETED`, `FAILED`, and `ROLLED_BACK` and UI renders the correct terminal state for each.
  - Inventory final-step completion actions are visible and correct.

- Resume behavior
  - Catalog resume from Mapping, Review, and import entry behaves according to the chosen restore policy.
  - Inventory resume from Upload, Mapping, Review, and import entry behaves according to the chosen restore policy.
  - "Start Fresh" fully clears resumable state.

- File identity and role assignment
  - Two files with the same filename can coexist without cross-removal or mis-assignment.
  - Duplicate inventory roles block progression or are otherwise explicitly rejected.
  - ETL input uses the validated file-role map deterministically.

- Session/token boundaries
  - Portal auth is no longer readable through over-broad shared storage.
  - Background/message flows still support login, validate, execute, rollback, and reindex.

- Catalog orchestration refactor
  - First import and retry use the same underlying execution path.
  - Progress, failure, retry, and completion totals still match current expected behavior.

- Cleanup
  - `pnpm test`, `pnpm typecheck`, and `pnpm lint` all pass with the intended post-cleanup baseline.

## Assumptions and Defaults

- The implementation should preserve current user-facing workflows unless a finding requires behavior change for correctness.
- Resume should never restore the user into a step that lacks the state needed to function.
- Duplicate inventory roles should be rejected in this remediation plan rather than implicitly merged.
- Cleanup work is included, but only after the behavioral/runtime phases are verified.
- This file is the implementation handoff artifact for the remediation work.
