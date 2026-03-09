# Catalog Migration Tool v2

## What This Is

A Chrome extension and backend service that guides cannabis retailers through migrating their product catalog and inventory data from any point-of-sale system into Treez. It lives inside the Treez Catalog module, supports the full migration lifecycle (upload → map → validate → import), persists migration state server-side, and includes an admin dashboard for the Treez team to monitor migrations across organizations.

## Core Value

Users can self-service their entire POS migration — catalog and inventory — without needing Treez engineering support.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Chrome extension with wizard UI for catalog migration (upload → map → review → import)
- [ ] Chrome extension with wizard UI for inventory migration (same flow + store selection)
- [ ] Auto-detect POS system from uploaded CSV/XLSX files
- [ ] Smart column mapping with auto-detection and manual override
- [ ] Data transformation: normalize categories, classifications, weights, prices, brands
- [ ] Validation with grouped errors and bulk/per-row fix capabilities
- [ ] Price tier resolution against Treez API
- [ ] Generate Treez-formatted import CSVs and upload to S3 via presigned URLs
- [ ] Backend service for persisting migration state across sessions
- [ ] Backend file storage for uploaded source files
- [ ] Store selection for inventory migration (inventory is per-store, catalog is shared)
- [ ] Inventory-specific transformation logic
- [ ] Admin dashboard for Treez team to monitor all migrations, statuses, and errors
- [ ] Saved column mappings per org/POS combo
- [ ] Import progress tracking with ETA

### Out of Scope

- Real-time inventory sync (two-way) — this is import-only migration tooling
- Mobile app — Chrome extension only
- Non-Chrome browsers — Chrome extension APIs required
- Custom POS integrations via API — CSV/XLSX upload only
- Rollback/undo of completed imports — Treez handles deduplication

## Context

- **Existing v1:** A working Chrome extension exists at `projects/chrome-extension/` with the full catalog migration flow implemented (React 19, Vite, CRXJS, Tailwind, TypeScript). This v2 is a rewrite that improves upon v1 and adds inventory migration + backend.
- **v1 stack:** React 19 + TypeScript + Vite + CRXJS + Tailwind CSS 4 + PapaParse + XLSX + JSZip + FileSaver
- **v1 POS support:** Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova (+ generic "Other")
- **v1 has no backend** — uses chrome.storage.local for mapping persistence only
- **Treez APIs used:** Auth token from Treez localStorage, pricing tiers API, presigned URL API for S3 upload
- **Environments:** Production (app.treez.io), Sandbox (app.sandbox.treez.io), Dev (app.dev.treez.io)
- **Treez import pipeline:** CSVs uploaded to S3 are processed asynchronously by existing Treez import infrastructure
- **Rollout plan:** Treez team uses the tool internally first, then opens it for dispensary self-service

## Constraints

- **Platform**: Chrome Extension (Manifest V3) — must work within Chrome extension security model
- **Integration**: Must use Treez session tokens from the app — no separate auth
- **Import format**: Must generate CSVs compatible with existing Treez import pipeline (brands, attributes, products, variants, attribute joins, images)
- **Data source**: Generic CSV/XLSX uploads — no direct POS API integrations
- **Inventory scope**: Inventory is per-store; catalog is per-organization

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rewrite v1 rather than extend | Add backend, improve architecture, incorporate lessons learned | — Pending |
| Backend service for state persistence | Migrations must survive browser closes, be accessible by Treez team | — Pending |
| Server-side file storage | Source files need to persist for debugging and re-processing | — Pending |
| Same wizard pattern for inventory | Consistent UX, proven flow from catalog migration | — Pending |
| Auto-detect + manual mapping | Smarter defaults reduce manual work, manual override handles edge cases | — Pending |

---
*Last updated: 2026-03-09 after initialization*
