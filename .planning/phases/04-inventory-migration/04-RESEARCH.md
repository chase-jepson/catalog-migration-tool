# Phase 4: Inventory Migration - Research

**Researched:** 2026-03-09
**Domain:** Per-store inventory migration via Chrome extension wizard
**Confidence:** HIGH

## Summary

Phase 4 adds inventory migration capability to the existing catalog migration Chrome extension. The architecture is well-constrained: inventory uses the same 4-step wizard pattern (Upload, Map, Review, Import) with a persistent store selector above the wizard. The core novelty is (1) fetching stores from the Treez MSO API, (2) matching inventory rows to existing Treez variants via POS reference IDs, and (3) generating a single inventory CSV instead of the 6-file catalog output.

The existing codebase provides strong patterns to follow. The `WizardShell` already accepts `wizardType: 'catalog' | 'inventory'` and the content script already wires "Migrate Inventory" button. The work is primarily creating inventory-specific component variants (`InventoryUploadStep`, `InventoryMappingStep`, `InventoryReviewStep`, `InventoryImportStep`), new inventory constants/field definitions, an inventory transformer, inventory validator, and inventory CSV generator. The store API integration requires a new message type in the messaging protocol and a new handler in the background service worker.

**Primary recommendation:** Follow the established component pattern exactly -- create parallel inventory components, keep catalog components untouched, and wire them via `wizardType` branching in `WizardShell.renderStep()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Store selection is a persistent header/banner above the 4-step wizard (not a separate step)
- Store list fetched from Treez API: `POST api.mso.treez.io/organization/v1/organizations/{orgId}/entities/details` with body `{"entityIds": [...]}`
- Organization ID and entity IDs extracted from JWT token claims (`orgId`, `entityIds`)
- Changing the selected store mid-migration resets the entire wizard (with confirmation dialog)
- Store selection must be made before proceeding past Upload step
- Catalog migration must be completed first -- products must already exist in Treez
- Inventory rows matched to Treez variants using POS reference ID stored during catalog migration
- Unmatched rows flagged as warnings and skipped on import (do not block migration)
- Target fields: quantity on hand, cost/wholesale price, room/location within store
- Single inventory CSV output (not 6-file structure)
- Separate inventory-specific components: InventoryUploadStep, InventoryMappingStep, InventoryReviewStep, InventoryImportStep
- WizardShell switches component set based on `wizardType` prop
- Existing catalog components remain untouched -- no branching logic added
- One migration at a time (catalog or inventory, not both simultaneously)
- Shared (reuse as-is): File parser (`lib/parser.ts`), POS detection (`lib/pos-detection.ts`)
- New for inventory: mapping field definitions, mapping engine config, transformation rules, CSV generator, validation schema

### Claude's Discretion
- Store selector visual design (dropdown, radio buttons, cards)
- Inventory mapping group categories and labels
- Inventory validation error grouping approach
- How to surface the "catalog must be done first" prerequisite to users
- Single-file import progress UX (simpler than catalog's 6-file progress list)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INV-01 | User can select a specific store for inventory import (inventory is per-store) | Store API integration via background service worker, JWT claims for orgId/entityIds, store selector UI component |
| INV-02 | Tool imports inventory quantities mapped to Treez product IDs | POS reference ID matching, inventory field mapping, inventory transformer, single-file CSV generator |
| INV-03 | Tool imports cost/wholesale price data per store | Cost/wholesale price field in mapping definitions, included in inventory CSV output alongside quantity |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.1.0 | UI components | Already in use, inventory components follow same patterns |
| WXT | 0.20.18 | Chrome extension framework | Project framework, provides defineBackground, content scripts |
| @webext-core/messaging | 1.4.0 | Typed extension messaging | Already used for auth, S3 upload; add `fetchStores` message |
| Tailwind CSS | 4.1.4 | Styling | Already in use, teal-600 primary color established |
| SheetJS (xlsx) | 0.18.5 | File parsing | Reused via `lib/parser.ts` for inventory CSV/XLSX |
| Vitest | 4.0.18 | Testing | Established test infrastructure |

### No New Dependencies Required

Inventory migration requires zero new npm packages. All functionality can be built with existing dependencies:
- File parsing: `lib/parser.ts` (SheetJS) -- reuse as-is
- POS detection: `lib/pos-detection.ts` -- reuse as-is
- CSV serialization: `lib/csv-generator.ts` (`arrayToCSV`) -- reuse the function
- S3 upload: `lib/file-uploader.ts` -- reuse `buildUploadPayload`
- Import polling: `lib/import-poller.ts` -- reuse as-is
- ZIP generation: NOT needed (single CSV, not 6-file bundle)

## Architecture Patterns

### Recommended Project Structure
```
components/
  inventory/
    StoreSelector.tsx          # Persistent store picker above wizard
    InventoryUploadStep.tsx     # Upload + POS detection (reuses FileDropZone, FileSummaryCard)
    InventoryMappingStep.tsx    # Inventory-specific field mapping
    InventoryReviewStep.tsx     # Validation display + inline fixes
    InventoryImportStep.tsx     # Single-file generate + upload + poll
lib/
  inventory-constants.ts       # INVENTORY_MAPPING_FIELDS, INVENTORY_POS_DEFAULTS, INVENTORY_MAPPING_GROUPS
  inventory-transformer.ts     # deriveInventoryRows() -- maps source to inventory derived rows
  inventory-validator.ts       # validateInventoryRows() -- quantity/cost validation
  inventory-csv-generator.ts   # buildInventoryCSV() -- single CSV output
  store-api.ts                 # fetchStores() helper, JWT claim parsing
  types.ts                     # Extended with InventoryDerivedRow, InventoryMappingGroup, etc.
  messaging.ts                 # Extended ProtocolMap with fetchStores
  migration-store.ts           # Extended with inventory-specific state shape
entrypoints/
  background/index.ts          # New fetchStores message handler
tests/
  inventory-transformer.test.ts
  inventory-validator.test.ts
  inventory-csv-generator.test.ts
  store-api.test.ts
```

### Pattern 1: WizardShell Branch by wizardType
**What:** WizardShell.renderStep() gains an inventory branch that renders inventory components
**When to use:** When wizardType === 'inventory'
**Example:**
```typescript
// In WizardShell.tsx renderStep()
if (wizardType === 'inventory') {
  switch (currentStep) {
    case 0:
      return <InventoryUploadStep ... />;
    case 1:
      return <InventoryMappingStep ... />;
    case 2:
      return <InventoryReviewStep ... />;
    case 3:
      return <InventoryImportStep ... />;
  }
}
// Existing catalog switch (unchanged)
switch (currentStep) { ... }
```

### Pattern 2: Store Selector as Persistent Banner
**What:** Store selector rendered above the wizard steps, not inside any step
**When to use:** Only when wizardType === 'inventory'
**Example:**
```typescript
// In WizardShell.tsx, between header and main content
{wizardType === 'inventory' && (
  <StoreSelector
    selectedStore={selectedStore}
    onStoreChange={handleStoreChange}
  />
)}
```
**Key behavior:** Changing store resets all wizard state (with confirmation dialog if currentStep > 0).

### Pattern 3: Inventory-Specific State Shape
**What:** WizardShell needs additional state for inventory mode
**When to use:** Store selection, inventory-specific derived rows
**State additions:**
```typescript
// New state in WizardShell (only used when wizardType === 'inventory')
const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null);
const [inventoryDerivedRows, setInventoryDerivedRows] = useState<InventoryDerivedRow[]>([]);
```

### Pattern 4: Background Message Handler for Store API
**What:** Service worker fetches store list from Treez MSO API (CORS-restricted)
**When to use:** When side panel needs store data
**Example:**
```typescript
// In messaging.ts ProtocolMap
fetchStores(data: {
  apiBaseUrl: string;
  token: string;
  orgId: string;
  entityIds: string[];
}): StoreInfo[];

// In background/index.ts
onMessage('fetchStores', async (message) => {
  const { apiBaseUrl, token, orgId, entityIds } = message.data;
  const res = await fetch(
    `https://api.mso.treez.io/organization/v1/organizations/${orgId}/entities/details`,
    {
      method: 'POST',
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entityIds }),
    }
  );
  if (!res.ok) throw new Error(`Store fetch failed (${res.status})`);
  return res.json();
});
```

### Pattern 5: JWT Claim Extraction
**What:** Extract orgId and entityIds from the JWT access token
**When to use:** Before calling store API
**Example:**
```typescript
// In lib/store-api.ts
import { decodeJwtPayload } from '../entrypoints/background/auth';

export function extractStoreClaimsFromToken(token: string): {
  orgId: string;
  entityIds: string[];
} | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    orgId: payload.orgId as string,
    entityIds: payload.entityIds as string[],
  };
}
```
Note: `decodeJwtPayload` is already exported from `entrypoints/background/auth.ts`.

### Pattern 6: Inventory Mapping Fields (Simpler Than Catalog)
**What:** Inventory has far fewer fields than catalog
**Expected fields:**
```typescript
export type InventoryMappingGroup = 'Product Matching' | 'Inventory Data' | 'Location';

export const INVENTORY_MAPPING_FIELDS: MappingFieldDef[] = [
  // Product Matching
  { key: 'productIdentifier', label: 'Product ID / SKU', description: 'POS product identifier to match against Treez reference ID', group: 'Product Matching', required: true },
  { key: 'productName', label: 'Product Name', description: 'Product name (for display/reference only)', group: 'Product Matching' },

  // Inventory Data
  { key: 'quantityOnHand', label: 'Quantity on Hand', description: 'Current stock count', group: 'Inventory Data', required: true },
  { key: 'cost', label: 'Cost / Wholesale Price', description: 'Per-unit cost the retailer paid', group: 'Inventory Data' },

  // Location
  { key: 'room', label: 'Room / Location', description: 'Where inventory is stored within the store', group: 'Location' },
];
```

### Pattern 7: Single-File Import (Simpler Than Catalog)
**What:** Inventory generates one CSV and uploads it as a single file
**Key difference from catalog:** No 6-file sequence, no file list UI, no ZIP download. Just generate -> upload -> poll.
**Treez API object type:** Likely `INVENTORY_IMPORT` or similar (needs verification during implementation -- check Treez file-management API documentation).

### Anti-Patterns to Avoid
- **Adding inventory logic to catalog components:** Each component set is independent. Never add `if (wizardType === 'inventory')` inside UploadStep, MappingStep, etc.
- **Making store API calls from the side panel directly:** CORS restrictions require routing through the background service worker, just like S3 uploads.
- **Persisting full inventory state alongside catalog state:** Use a separate storage key (e.g., `inventoryMigrationState`) or add a `wizardType` discriminator to `PersistedMigrationState`.
- **Blocking import on unmatched rows:** Per user decision, unmatched rows are warnings, not errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV/XLSX parsing | Custom parser | `lib/parser.ts` (SheetJS) | Already handles all edge cases, tested |
| POS detection | New detection logic | `lib/pos-detection.ts` | Same POS systems, same header patterns |
| CSV serialization | String concatenation | `arrayToCSV()` from `lib/csv-generator.ts` | RFC 4180 compliant, handles quoting |
| S3 upload pipeline | Custom upload flow | `buildUploadPayload()` + messaging | Proven pattern with error handling |
| Import polling | Custom polling | `lib/import-poller.ts` utilities | Adaptive intervals, ETA calculation |
| JWT decoding | Manual base64 | `decodeJwtPayload()` from auth.ts | Already handles malformed tokens |
| Token management | Re-implement auth | `getAuthToken` message | Handles refresh, expiry, concurrency guard |

**Key insight:** ~60% of inventory migration code is shared with catalog. The remaining 40% is inventory-specific field definitions, transformer, validator, and CSV generator -- all following established patterns.

## Common Pitfalls

### Pitfall 1: Store API URL Mismatch Across Environments
**What goes wrong:** Using the wrong base URL for store API in sandbox/dev environments
**Why it happens:** The store API is at `api.mso.treez.io` which may have different subdomains per environment
**How to avoid:** Map store API URLs using the same `TreezEnv` pattern as `getApiBaseUrl()` in `lib/env.ts`. Verify endpoints for production, sandbox, and dev.
**Warning signs:** 404 or CORS errors when fetching stores in non-production environments

### Pitfall 2: JWT Claims Not Available in All Tokens
**What goes wrong:** `orgId` or `entityIds` claims missing from the JWT
**Why it happens:** Different token types (access vs id) or different OAuth clients may include different claims
**How to avoid:** Check both the access token and the id token (if available) for claims. Fall back gracefully with a user-friendly error message.
**Warning signs:** `null` or `undefined` when extracting claims

### Pitfall 3: Product Matching Failures
**What goes wrong:** Inventory rows don't match any Treez variant because reference IDs weren't set during catalog migration
**Why it happens:** Catalog migration may have been incomplete, or POS product IDs in inventory export use a different format than catalog export
**How to avoid:** Display a clear summary of matched vs unmatched rows. Show the reference ID that was attempted for unmatched rows. Warn users if match rate is very low (e.g., < 50%).
**Warning signs:** High percentage of unmatched rows in the Review step

### Pitfall 4: Migration State Collision Between Catalog and Inventory
**What goes wrong:** Saving inventory state overwrites catalog state or vice versa
**Why it happens:** Both use the same `migrationState` key in chrome.storage.local
**How to avoid:** Use separate storage keys: `catalogMigrationState` and `inventoryMigrationState`. Or add a `wizardType` discriminator field.
**Warning signs:** Switching between catalog and inventory mode loses previous wizard progress

### Pitfall 5: Store Selector Reset Race Condition
**What goes wrong:** User changes store while a mapping or validation operation is in progress
**Why it happens:** Store change triggers full wizard reset, but async operations may still be running
**How to avoid:** Show confirmation dialog before store change. Disable store selector during import phase. Use an AbortController pattern if needed.
**Warning signs:** Stale data from previous store appearing after store change

### Pitfall 6: Inventory Import Object Type Unknown
**What goes wrong:** Using wrong `objectType` when requesting presigned URL for inventory CSV
**Why it happens:** The Treez file-management API expects a specific objectType string for inventory imports, which differs from catalog types
**How to avoid:** Verify the correct objectType with Treez documentation or API exploration. It may be `INVENTORY_IMPORT` or similar.
**Warning signs:** 400 or 422 errors from presigned URL endpoint

## Code Examples

### Store Info Type
```typescript
// In lib/types.ts
export interface StoreInfo {
  entityId: string;
  name: string;
  // Additional fields from API response as needed
}
```

### Inventory Derived Row
```typescript
// In lib/types.ts
export interface InventoryDerivedRow {
  matched: boolean;           // Whether POS reference ID matched a Treez variant
  posProductId: string;       // Original POS product identifier
  productName: string;        // Display name (from source file)
  treezVariantId?: string;    // Matched Treez variant ID (if matched)
  quantityOnHand: number;     // Stock count
  cost: string;               // Wholesale price per unit
  room: string;               // Storage location within store
  excluded: boolean;          // User excluded or auto-excluded
}
```

### Inventory CSV Generator
```typescript
// In lib/inventory-csv-generator.ts
import { arrayToCSV } from './csv-generator';
import type { InventoryDerivedRow } from './types';

export function buildInventoryCSV(
  rows: InventoryDerivedRow[],
  storeEntityId: string,
): string[][] {
  // Header row -- exact columns TBD based on Treez inventory import spec
  const header = [
    'TreezVariantId',       // or ReferenceId
    'EntityId',             // Store ID
    'QuantityOnHand',
    'Cost',
    'Room',
  ];

  const dataRows = rows
    .filter((r) => !r.excluded && r.matched)
    .map((r) => [
      r.treezVariantId ?? '',
      storeEntityId,
      r.quantityOnHand.toString(),
      r.cost,
      r.room,
    ]);

  return [header, ...dataRows];
}
```

### Inventory Validator
```typescript
// In lib/inventory-validator.ts
import type { InventoryDerivedRow, RowValidationError, ValidationResult } from './types';

export function validateInventoryRows(rows: InventoryDerivedRow[]): ValidationResult {
  const errors: RowValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.excluded) continue;

    // Unmatched row -- warning, not error
    if (!row.matched) {
      errors.push({
        rowIndex: i,
        field: 'posProductId',
        currentValue: row.posProductId,
        message: `No matching Treez variant found for POS ID "${row.posProductId}"`,
        fixType: 'text',
        severity: 'warning',
      });
    }

    // Quantity validation -- required, must be >= 0
    if (row.matched && (isNaN(row.quantityOnHand) || row.quantityOnHand < 0)) {
      errors.push({
        rowIndex: i,
        field: 'quantityOnHand',
        currentValue: String(row.quantityOnHand),
        message: 'Quantity must be a non-negative number',
        fixType: 'text',
        severity: 'error',
      });
    }

    // Cost validation -- if provided, must be >= 0
    if (row.cost && (isNaN(parseFloat(row.cost)) || parseFloat(row.cost) < 0)) {
      errors.push({
        rowIndex: i,
        field: 'cost',
        currentValue: row.cost,
        message: 'Cost must be a non-negative number',
        fixType: 'text',
        severity: 'error',
      });
    }
  }

  const errorRowIndices = new Set<number>();
  let errorCount = 0;
  let warningCount = 0;

  for (const err of errors) {
    if (err.severity === 'error') {
      errorRowIndices.add(err.rowIndex);
      errorCount++;
    } else {
      warningCount++;
    }
  }

  const nonExcluded = rows.filter((r) => !r.excluded);
  const validCount = nonExcluded.length - errorRowIndices.size;

  return { validCount, errorCount, warningCount, errors };
}
```

### Persisted Inventory State
```typescript
// In lib/types.ts
export interface PersistedInventoryState {
  parsedFiles: ParsedFile[];
  mergedHeaders: string[];
  selectedPOS: string;
  selectedStore: StoreInfo | null;
  mappings: FieldMapping[];
  fixes: RowFix[];
  currentStep: number;
  updatedAt: string;
  importProgress?: ImportProgress;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single storage key for all state | Discriminated or separate keys per wizard type | Phase 4 | Prevents state collision between catalog and inventory |
| 6-file upload sequence | Single-file upload for inventory | Phase 4 | Simpler import UX, no ZIP, no file list |
| No store context | Store-scoped operations via JWT claims | Phase 4 | Enables per-store inventory management |

## Open Questions

1. **Treez Inventory Import CSV Format**
   - What we know: Inventory is a single CSV, fields include quantity, cost, room, and a variant identifier
   - What's unclear: Exact column headers and ordering expected by Treez import pipeline. What objectType string to use for presigned URL. Whether the variant is identified by TreezVariantId or by ReferenceId.
   - Recommendation: User indicated they will provide detailed mapping logic and Treez inventory import CSV format during planning/research. This must be resolved before implementation begins. Use placeholder headers that can be updated.

2. **Store API Response Shape**
   - What we know: API is `POST api.mso.treez.io/organization/v1/organizations/{orgId}/entities/details` with body `{"entityIds": [...]}`
   - What's unclear: Exact response JSON structure -- specifically which fields contain store name, entity ID, address, etc.
   - Recommendation: Implement with a minimal `StoreInfo` interface (`entityId`, `name`) and extend as needed once response is inspected.

3. **Store API URL per Environment**
   - What we know: Production uses `api.mso.treez.io`
   - What's unclear: Whether sandbox/dev use different subdomains (e.g., `api.mso.sandbox.treez.io`)
   - Recommendation: Add store API URL mapping to `lib/env.ts` alongside existing `getApiBaseUrl()`.

4. **Product Matching Mechanism**
   - What we know: Catalog migration stores POS product ID as a reference ID on the Treez variant. Inventory matches using this reference ID.
   - What's unclear: Whether matching happens client-side (fetch all variants for org, then match) or via a Treez API search endpoint. For large catalogs (10k+ variants), client-side matching could be slow.
   - Recommendation: Start with client-side matching if a "list variants" API exists. If no such API, the matching may need to happen server-side or the reference ID lookup must be done per-row.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | Store API fetch via JWT claims | unit | `pnpm vitest run tests/store-api.test.ts -x` | Wave 0 |
| INV-01 | Store selector component renders stores | unit | `pnpm vitest run tests/store-selector.test.tsx -x` | Wave 0 |
| INV-02 | Inventory transformer maps fields and matches products | unit | `pnpm vitest run tests/inventory-transformer.test.ts -x` | Wave 0 |
| INV-02 | Inventory CSV generator produces correct output | unit | `pnpm vitest run tests/inventory-csv-generator.test.ts -x` | Wave 0 |
| INV-03 | Cost/price field mapped and included in CSV output | unit | `pnpm vitest run tests/inventory-csv-generator.test.ts -x` | Wave 0 |
| INV-02/03 | Inventory validator catches invalid quantity/cost | unit | `pnpm vitest run tests/inventory-validator.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/store-api.test.ts` -- covers INV-01 (JWT claim extraction, store API call)
- [ ] `tests/inventory-transformer.test.ts` -- covers INV-02 (field mapping, product matching)
- [ ] `tests/inventory-validator.test.ts` -- covers INV-02, INV-03 (quantity/cost validation)
- [ ] `tests/inventory-csv-generator.test.ts` -- covers INV-02, INV-03 (CSV output format)

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `lib/types.ts`, `lib/messaging.ts`, `lib/constants.ts`, `lib/csv-generator.ts`, `lib/transformer.ts`, `lib/validator.ts`, `lib/mapping-engine.ts`, `lib/migration-store.ts`, `lib/file-uploader.ts`, `lib/import-poller.ts`
- Existing components: `components/wizard/WizardShell.tsx`, `components/import/ImportStep.tsx`
- Background service worker: `entrypoints/background/index.ts`, `entrypoints/background/auth.ts`
- Content script: `entrypoints/import-page.content/App.tsx`
- Side panel: `entrypoints/sidepanel/App.tsx`
- Phase 4 CONTEXT.md: User decisions on store API, matching logic, wizard reuse strategy

### Secondary (MEDIUM confidence)
- Treez store API endpoint: `POST api.mso.treez.io/organization/v1/organizations/{orgId}/entities/details` -- from user-provided context, not independently verified
- JWT claims (`orgId`, `entityIds`) -- from user-provided context

### Tertiary (LOW confidence)
- Treez inventory import CSV format -- user stated they will provide during planning/research; exact columns unknown
- Treez import objectType for inventory -- assumed `INVENTORY_IMPORT` but unverified
- Store API URLs for sandbox/dev environments -- only production URL provided

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all reuse of existing libraries
- Architecture: HIGH -- patterns directly derived from working catalog implementation
- Pitfalls: HIGH -- identified from direct codebase analysis of existing patterns
- Inventory CSV format: LOW -- depends on user-provided Treez spec not yet available
- Store API response shape: MEDIUM -- endpoint known but response structure unverified

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, no external library changes expected)
