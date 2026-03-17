# Architecture

This is a **Chrome extension** (Manifest V3) built with [WXT](https://wxt.dev), React 19, and Tailwind CSS v4. It runs inside the Treez web app (`app.treez.io`) and guides users through migrating catalog and inventory data from other POS systems into Treez.

## How It Differs from Other BOH Projects

This project is a browser extension, not a Lambda service or Single-SPA MFE. Some conventions intentionally differ from the rest of the back-of-house ecosystem:

| Convention | BOH Standard | This Project | Reason |
|---|---|---|---|
| Package manager | Yarn | pnpm | Required by WXT framework |
| Test framework | Jest | Vitest | Native Vite integration, zero-config |
| Styling | Emotion + MUI | Tailwind CSS v4 | No MUI available in extension context |
| State management | React Query + Context | useState + chrome.storage | No server state to cache |
| Build tool | Webpack 5 | Vite (via WXT) | WXT uses Vite for extension builds |
| Indentation | 4 spaces | 2 spaces | WXT/Vite ecosystem convention |
| Quotes | Single | Double | Consistent with WXT scaffolding |

These are enforced by ESLint + Prettier (see `.prettierrc` and `eslint.config.js`).

## Extension Structure

```
Content Scripts (UI)                    Background Script (API proxy)
========================               ===========================
import-page.content/                    background/
  Injects "Migrate Catalog"              Handles all API calls (CORS bypass)
  and "Migrate Inventory"                Token management (OAuth refresh)
  buttons into the Treez                 S3 upload proxying
  import page                            Portal API proxying

wizard-drawer.content/
  Shadow DOM drawer overlay
  that hosts the full wizard UI
  (WizardShell + all step components)
```

### Entrypoints

- **`background/`** -- Service worker. Handles all `fetch()` calls to Treez APIs, S3, and the customer-success portal. Content scripts can't make cross-origin requests directly, so the background script acts as an API proxy via typed messages.

- **`import-page.content/`** -- Content script injected on Treez import pages. Uses a `MutationObserver` to detect the "Launch Import Wizard" button and injects "Migrate Catalog" / "Migrate Inventory" buttons next to it.

- **`wizard-drawer.content/`** -- Content script that renders the wizard UI inside a Shadow DOM drawer. Shadow DOM isolates our styles from the Treez app's styles (and vice versa). The drawer slides in from the right when triggered.

### Communication Flow

```
User clicks "Migrate Catalog"
    |
    v
import-page.content dispatches CustomEvent('cmt:open-wizard')
    |
    v
wizard-drawer.content listens, calls showDrawer('catalog')
    |
    v
DrawerApp renders WizardShell with wizard steps
    |
    v
When a step needs an API call (auth, upload, import status):
    WizardShell -> sendMessage('getAuthToken', {...})
                   sendMessage('uploadToS3', {...})
                   sendMessage('fetchImportReport', {...})
    |
    v
background/index.ts onMessage handlers execute fetch() and return results
```

The message protocol is fully typed in `lib/messaging.ts` using `@webext-core/messaging`.

## State Management

- **Wizard state**: `WizardShell.tsx` owns all wizard state via `useState` hooks. State flows down to step components via props.
- **Persistence**: `chrome.storage.local` stores migration progress (survives page reloads but not browser close). Debounced at 500ms.
- **Session storage**: `chrome.storage.session` stores the active wizard type and portal auth tokens (cleared on browser close).
- **No Redux/Zustand**: The wizard is a linear flow with a single state container. External state libraries would add complexity without benefit.

## Catalog Migration Pipeline

```
Upload CSV/XLSX -> Detect POS -> Map Columns -> Validate -> Transform -> Generate 6 CSVs -> Upload to S3
```

1. **Upload** (`components/upload/`): File parsing via SheetJS. Auto-detects POS system from column headers.
2. **Mapping** (`components/mapping/`): Maps source columns to Treez fields. POS-specific defaults pre-fill mappings.
3. **Review** (`components/review/`): Row-level validation with inline fix controls. Grouped error display.
4. **Import** (`components/import/`): Generates 6 Treez-compatible CSVs (brands, attributes, products, variants, attribute joins, images), zips them, uploads via S3 presigned URLs, and polls for completion.

Key files: `lib/transformer.ts`, `lib/validator.ts`, `lib/csv-generator.ts`, `lib/category-mapper.ts`

## Inventory Migration Pipeline

```
Upload up to 5 files -> Per-role mapping -> ETL joins -> Validate -> Generate 56-column CSV -> Upload
```

More complex than catalog because it joins data from multiple source files:

1. **Upload** (`components/inventory/InventoryUploadStep.tsx`): Accepts up to 5 files with role assignment (Inventory, Receipts, Vendors, Adjustments, Catalog Export).
2. **Mapping** (`components/inventory/InventoryMappingStep.tsx`): Per-role column mapping. Each file role has its own required/optional fields.
3. **Review** (`components/inventory/InventoryReviewStep.tsx`): 3-layer validation (field-level, row-level, cross-row). Portal validation via customer-success API.
4. **Import** (`components/inventory/InventoryImportStep.tsx`): Generates a single 56-column CSV. Can import via S3 (catalog path) or via portal (validate -> execute -> poll -> rollback).

Key files: `lib/inventory-transformer.ts`, `lib/inventory-etl-helpers.ts`, `lib/inventory-validator.ts`, `lib/inventory-csv-generator.ts`

### ETL Details

The inventory ETL pipeline in `lib/inventory-transformer.ts` joins data using:

- **`groupBy(items, keyFn)`** -- Groups rows by a composite key. Uses `\0` (null byte) as the key separator to avoid collisions with pipe-separated vendor names.
- **`sumByGroup(items, keyFn, sumFields)`** -- Aggregates numeric fields (Units, UnitCost) within groups.
- **`leftJoin` / `fullJoin`** -- Joins inventory rows with receipt, vendor, and adjustment data.

The output is a 56-column CSV matching the Treez inventory import spec, with fields for product info, invoice details, distributor data (3 licenses, 3 reps), and location configuration.

## Testing

- **Framework**: Vitest with jsdom environment
- **Location**: All tests in `tests/` directory
- **Coverage**: 434 unit tests across 19 test files
- **Integration tests**: `tests/inventory-integration.test.ts` runs the full ETL pipeline against real Dutchie export files (skipped in CI -- requires fixture files not committed to repo)

Run tests: `pnpm test` | Watch mode: `pnpm test:watch`

## Styling

Tailwind CSS v4 with custom Treez design tokens defined in `entrypoints/wizard-drawer.content/style.css`:

```css
@theme {
  --color-treez-primary: #1a4007;
  --color-treez-accent: #dbf5b3;
  --color-treez-text: #0f1709;
  /* ... */
}
```

Some components use inline styles for precise pixel matching with the Treez app's MUI design (drawer border-radius, button styling, z-index layering).

## Adding a New POS System

1. Add detection patterns to `lib/pos-detection.ts`
2. Add default column mappings to `lib/mapping-engine.ts`
3. Add the POS name to `POS_SYSTEMS` in `lib/constants.ts`
4. Tests in `tests/pos-detection.test.ts` and `tests/mapping-engine.test.ts`
