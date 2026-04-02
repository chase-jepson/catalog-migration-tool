# Catalog Migration Tool

Chrome extension (Manifest V3) that guides cannabis retailers through migrating product catalog and inventory data from any POS into Treez. Full lifecycle: Upload → Map → Review → Import.

Auto-detects Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, and Cova. Manual mapping for all others.

## Stack

- **Framework:** WXT 0.20.18 (Vite-based, Manifest V3)
- **UI:** React 19, Tailwind CSS v4 (custom Treez design tokens)
- **Language:** TypeScript 5.8+ (strict mode)
- **Package Manager:** pnpm (required by WXT)
- **Testing:** Vitest 4 with jsdom (610 tests across 26 files, including 1 integration suite that is skipped without local fixtures)
- **File Parsing:** SheetJS (xlsx) for CSV/XLSX
- **Messaging:** @webext-core/messaging (typed IPC)

## Project Structure

Single-package extension (not a monorepo):

- `entrypoints/background/` — Service worker, API proxy, OAuth token lifecycle
- `entrypoints/import-page.content/` — Injects "Migrate Catalog"/"Migrate Inventory" buttons
- `entrypoints/wizard-drawer.content/` — Shadow DOM drawer shell
- `components/` — React wizard steps (upload, mapping, review, import, inventory)
- `lib/` — Core ETL logic (transformer, validator, csv-generator, pos-detection, category-mapper)
- `tests/` — Vitest suites with real POS export fixtures
- `docs/` — User-facing documentation

### Key Files

- `lib/types.ts` — All TypeScript interfaces
- `lib/constants.ts` — POS systems, mapping fields, product categories
- `lib/transformer.ts` — Catalog data transformation pipeline
- `lib/validator.ts` — Row-level validation rules (error vs warning severity)
- `lib/csv-generator.ts` — Build 6 output CSVs (RFC 4180 compliant)
- `lib/pos-detection.ts` — Scoring-based POS auto-detection
- `lib/category-mapper.ts` — 100+ keyword rules for category/subcategory resolution
- `lib/inventory-transformer.ts` — Multi-file ETL join orchestration
- `lib/inventory-etl-helpers.ts` — groupBy, sumByGroup, leftJoin, fullJoin utilities
- `components/WizardShell.tsx` — Main state container (all wizard state via useState)
- `entrypoints/background/auth.ts` — OAuth token handling with refresh-race guard

## Architecture

- **Background script as API proxy** — all fetch calls to Treez APIs, S3, and customer-success portal route through the service worker.
- **Shadow DOM drawer** — style isolation from Treez app. Custom Treez design tokens defined in `wizard-drawer.content/style.css`.
- **Typed messaging protocol** — compile-time safety for all background ↔ content script communication (`lib/messaging.ts`).
- **No external state library** — linear wizard flow with single state container in WizardShell. chrome.storage.local for persistence (debounced 500ms).

### Catalog Pipeline

```
Upload CSV/XLSX → Detect POS → Map Columns → Validate → Transform → Generate 6 CSVs → Upload to S3
```

Output CSVs: brands, attributes, products, variants, attribute joins, images.

### Inventory Pipeline

```
Upload up to 5 files → Per-role mapping → ETL joins → Validate → Generate 56-column CSV → Upload
```

File roles: Inventory (required), Receipts, Vendors, Adjustments, Catalog Export (optional).

ETL uses composable helpers: `groupBy`, `sumByGroup`, `leftJoin`, `fullJoin`. Group key separator is `\0` to avoid collisions with pipe-separated names.

## Formatting & Style

**These differ from BOH standard — intentional for WXT ecosystem:**

- 2-space indent (not 4)
- Double quotes (not single)
- 100-char line width
- Trailing commas: all
- Semicolons: yes

Enforced by `.prettierrc` and `eslint.config.js`. Don't "fix" these to match BOH.

## Commands

```bash
pnpm dev          # Dev server with hot reload
pnpm build        # Production build → .output/chrome-mv3/
pnpm zip          # Generate installable ZIP
pnpm test         # Run tests once
pnpm test:watch   # Watch mode
pnpm typecheck    # TypeScript check
pnpm lint         # ESLint
pnpm lint:fix     # Auto-fix
pnpm format       # Prettier
```

## Testing

- 610 tests across 26 files (`595` passing + `15` skipped in the default local run)
- Real POS export fixtures in `tests/fixtures/`
- Key suites: transformer, validator, csv-generator, pos-detection, category-mapper
- `inventory-integration.test.ts` — full ETL pipeline (skipped in CI without fixtures)
- Always run `pnpm test` after modifying transform/validation/CSV logic

## Key Patterns

- Named exports, `interface` over `type` for object shapes
- Validation returns `ValidationResult` with severity tiers: "error" (blocking) vs "warning" (non-blocking)
- Category mapping is keyword-rule-based and order-dependent (more specific rules first)
- POS detection uses scoring algorithm: ≥3 matches AND >40% match rate
- Transformation functions are pure — no side effects, deterministic
- `@typescript-eslint/no-explicit-any` is OFF — intentional at API boundaries
- Refresh-in-progress guard prevents OAuth race conditions

## Adding a New POS System

1. Add detection patterns to `lib/pos-detection.ts`
2. Add default column mappings to `POS_DEFAULTS` in `lib/constants.ts`
3. Add POS name to `POS_SYSTEMS` in `lib/constants.ts`
4. Write tests with sample export CSV fixture
5. Optionally add keyword mapping overrides in `lib/mapping-engine.ts`

## Environments

- Production: `api.treez.io`, `oauth.treez.io`
- Sandbox: `api.sandbox.treez.io` (shared OAuth with prod)
- Dev: `api-dev.treez.io`, `oauth-dev.treez.io`

Environment detected from tab hostname via `lib/env.ts`.
