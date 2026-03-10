# Phase 4: Inventory Migration - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-store inventory migration using the same 4-step wizard pattern as catalog migration. Users select a store, upload their POS inventory export, map columns, review/validate, and import a single inventory CSV to Treez. Requires catalog migration to have been run first (products must exist in Treez with POS reference IDs on variants).

</domain>

<decisions>
## Implementation Decisions

### Store Selection Flow
- Persistent header/banner above the 4-step wizard (not a separate step)
- Store list fetched from Treez API: `GET api.mso.treez.io/organization/v1/organizations/{orgId}/entities/details`
- Organization ID and entity IDs extracted from the JWT token claims (`orgId`, `entityIds`)
- Request body sends `entityIds` array from token; response returns store names/details
- Changing the selected store mid-migration resets the entire wizard (with confirmation dialog)
- Store selection must be made before proceeding past Upload step

### Product ID Matching
- Catalog migration must be completed first — products must already exist in Treez
- During catalog migration, the original POS product identifier is stored as a reference ID on the Treez variant
- Inventory rows are matched to Treez variants using this POS reference ID
- Unmatched rows (no reference ID match) are flagged as warnings and skipped on import — they do not block the migration
- Detailed matching logic and upload specifications to be provided by user during planning/research

### Inventory Target Fields
- Quantity on hand (stock count per variant at selected store)
- Cost / wholesale price (per-unit cost the retailer paid)
- Room / location within store (where inventory is stored)
- Single inventory CSV output (not the 6-file structure used for catalog)
- Transformation/normalization rules to be specified by user during planning/research

### Wizard Reuse Strategy
- Separate inventory-specific components: InventoryUploadStep, InventoryMappingStep, InventoryReviewStep, InventoryImportStep
- WizardShell switches which component set to render based on `wizardType` prop
- Existing catalog components remain untouched — no branching logic added
- One migration at a time (catalog or inventory, not both simultaneously)

### Shared vs New Modules
- **Shared (reuse as-is):** File parser (`lib/parser.ts`), POS detection (`lib/pos-detection.ts`)
- **New for inventory:** Mapping field definitions, mapping engine config, transformation rules, CSV generator, validation schema
- Inventory-specific constants (field definitions, POS defaults for inventory columns)

### Claude's Discretion
- Store selector visual design (dropdown, radio buttons, cards)
- Inventory mapping group categories and labels
- Inventory validation error grouping approach
- How to surface the "catalog must be done first" prerequisite to users
- Single-file import progress UX (simpler than catalog's 6-file progress list)

</decisions>

<specifics>
## Specific Ideas

- Treez store API: `POST api.mso.treez.io/organization/v1/organizations/{orgId}/entities/details` with body `{"entityIds": [...]}` — JWT contains `orgId` and `entityIds` claims
- POS reference ID on variant is the key link between catalog and inventory data
- User will provide detailed mapping logic and Treez inventory import CSV format during planning/research phase
- Inventory is simpler than catalog: single CSV, fewer fields, less transformation — but matching logic is the novel complexity

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/wizard/WizardShell.tsx`: Already accepts `wizardType: 'catalog' | 'inventory'` — needs to switch rendered components based on type
- `components/wizard/StepIndicator.tsx`: Reusable for inventory's 4-step flow
- `lib/parser.ts`: File parsing (CSV/XLSX via SheetJS) — identical for inventory files
- `lib/pos-detection.ts`: POS auto-detection from headers — same detection logic applies to inventory exports
- `lib/migration-store.ts`: chrome.storage.local persistence — may need inventory-specific state shape
- `entrypoints/background/auth.ts`: Token management — needed for store API calls
- `lib/messaging.ts`: Extension messaging protocol — needs new message types for store API

### Established Patterns
- Service worker relays CORS-restricted API calls (used for S3 upload, will use for store API)
- Debounced chrome.storage.local persistence at 500ms
- `canProceed` gating on WizardShell footer navigation
- teal-600 primary color, gray-50 content background

### Integration Points
- `WizardShell.renderStep()` needs inventory branch (currently renders catalog components only)
- `lib/messaging.ts` ProtocolMap needs new `fetchStores` message type
- `entrypoints/background/index.ts` needs new message handler for store API
- Content script buttons already wired: "Migrate Inventory" sends `wizardType: 'inventory'`
- `PersistedMigrationState` type may need inventory-specific variant or a `wizardType` discriminator

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-inventory-migration*
*Context gathered: 2026-03-09*
