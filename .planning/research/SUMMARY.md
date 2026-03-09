# Project Research Summary

**Project:** Catalog Migration Tool v2
**Domain:** Chrome Extension + Backend POS Data Migration (Cannabis Retail)
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

The Catalog Migration Tool v2 is a Chrome extension paired with a lightweight backend service that guides cannabis dispensaries through migrating product catalog and inventory data from competing POS systems (Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova) into Treez. Experts build this type of tool as a wizard-driven client with domain-specific transformation logic, because the core challenge is not generic data import -- it is cannabis-specific normalization (category taxonomies, weight unit conversions, THC/CBD formatting, price tier mapping) that varies per source POS system. A working v1 Chrome extension already exists and proves the migration flow; v2 is a rewrite that adds server-side state persistence, source file storage, and an admin dashboard while migrating from CRXJS to WXT as the extension framework.

The recommended approach is a monorepo (npm workspaces) with three packages: a WXT-based Chrome extension (React 19, TypeScript, Tailwind CSS 4), a Hono backend with SQLite (via Drizzle ORM) for state persistence, and a shared types package. The extension handles all heavy computation client-side (file parsing, transformation, validation) while the backend acts as a thin persistence and file storage layer. This keeps the architecture simple -- SQLite means zero infrastructure dependencies, Hono is a 12KB TypeScript-native framework, and all processing stays in the browser where it belongs for an internal tool. The backend enables three things the v1 lacks: migrations that survive browser closes, source file storage for debugging, and an admin dashboard for the Treez team.

The primary risks are MV3 service worker termination killing long-running operations (mitigated by keeping the service worker thin and doing all processing in the popup UI), silent data transformation errors producing bad imports (mitigated by comprehensive validation with confidence scores and user-visible previews), and XLSX memory crashes for large files (mitigated by file size limits and CSV conversion prompts). All three risks are well-understood with clear prevention strategies documented in the pitfalls research.

## Key Findings

### Recommended Stack

The stack keeps proven v1 technologies (React 19, TypeScript, Tailwind CSS 4, Vite, PapaParse, SheetJS, JSZip) and upgrades the extension framework from CRXJS to WXT while adding a new backend layer. See [STACK.md](./STACK.md) for full rationale.

**Core technologies:**
- **WXT** (^0.20.18): Chrome extension framework -- replaces CRXJS which nearly got archived in 2025; WXT has stronger momentum, smaller bundles, and is the ecosystem consensus for new projects
- **Hono** (^4.12.5): Backend HTTP framework -- 12KB, TypeScript-first, 3x faster than Express; right-sized for an internal tool with ~10 API routes
- **SQLite + Drizzle ORM**: Database -- zero infrastructure (no DB server), single-file backups, type-safe queries; Drizzle supports driver swap to PostgreSQL later if needed
- **React 19 + TypeScript + Tailwind CSS 4**: Frontend -- carried from v1, team knows it, all current versions
- **npm workspaces**: Monorepo -- zero-dependency, sufficient for a 2-3 package repo

**Note:** The architecture research references PostgreSQL and CRXJS in some diagrams. The stack research supersedes those references -- use SQLite and WXT.

### Expected Features

See [FEATURES.md](./FEATURES.md) for the complete prioritized feature matrix.

**Must have (P1 -- internal Treez team launch):**
- CSV/XLSX upload with auto-POS detection (6 POS systems)
- Smart column auto-mapping with manual override
- Data transformation: category, weight, brand, classification, price tier normalization
- Row-level validation with grouped errors and inline fixing
- Treez import CSV generation (brands, attributes, products, variants, attribute joins, images)
- S3 upload via presigned URLs
- Backend state persistence and source file storage
- Treez session token authentication

**Should have (P2 -- before dispensary self-service):**
- Inventory migration (store selection, quantity/cost import)
- Saved column mappings per org/POS combo
- Bulk error resolution
- Pre-import dry run summary
- Import progress tracking
- Image URL migration

**Defer (P3 -- build when justified by usage):**
- Admin dashboard (build as separate web app, not in extension)
- Migration history and audit trail
- Duplicate detection with merge strategies
- Generic "Other" POS support

**Anti-features (do not build):**
- Direct POS API integrations (maintain 6+ APIs vs universal CSV/XLSX)
- Real-time two-way sync (integration product, not migration tool)
- Rollback of completed imports (focus on preventing bad imports instead)
- Customer data migration (separate domain, PII/HIPAA concerns)

### Architecture Approach

The system follows a client-server pattern where the Chrome extension is a rich client handling all file parsing, data transformation, and validation locally, while the backend is a thin persistence layer for migration state, source files, and saved mappings. The extension communicates with the backend via REST API and with Treez APIs via the background service worker (for CORS bypass). See [ARCHITECTURE.md](./ARCHITECTURE.md) for diagrams and data flow.

**Major components:**
1. **Content Script** -- detects Treez product-control pages, injects migration button, reads auth tokens from Treez localStorage
2. **Background Service Worker** -- thin proxy for S3 uploads (CORS bypass) and token refresh; must remain stateless
3. **Popup UI (React)** -- wizard flow with all business logic: upload, POS detection, mapping, transformation, validation, CSV generation
4. **Backend Migration API** -- CRUD for migration sessions, step state, saved mappings (Hono + SQLite)
5. **Backend File Storage API** -- source file upload/retrieval, presigned URL generation for Treez S3

**Key patterns:**
- Service worker as thin proxy (no business logic -- MV3 terminates after 30s idle)
- Backend as state machine (migration status transitions persisted server-side)
- Popup iframe for style isolation from Treez host page
- Auth tokens flow from Treez localStorage -> content script -> popup via postMessage

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for the full list of 14 pitfalls with prevention strategies.

1. **MV3 service worker termination** -- Never put long-running processing in the service worker. All parsing, transformation, and validation must happen in the popup UI. The service worker handles only message routing, token refresh, and CORS proxy.
2. **XLSX memory crashes for large files** -- SheetJS loads entire files into memory. Set a 30MB XLSX size limit with a prompt to export as CSV instead. Use Web Worker with dense mode for files that must be XLSX.
3. **Silent data transformation errors** -- Category, weight, and price normalization can produce plausible but wrong data. Mitigate with comprehensive validation after transformation, confidence scores on auto-mappings, and sample row previews.
4. **CORS blocks on Treez API calls** -- Content scripts in MV3 cannot make cross-origin requests. All API calls must route through the service worker. Declare all Treez domains in `host_permissions`.
5. **State loss on service worker restart** -- Never store migration state in service worker memory. Use backend API for durable state, `chrome.storage.session` for ephemeral UI state only.

## Implications for Roadmap

Based on combined research, the project should be structured in 6 phases. The dependency chain is clear: extension shell -> core pipeline -> backend -> integration -> admin/inventory.

### Phase 1: Extension Shell and Project Scaffolding
**Rationale:** Everything depends on a working extension skeleton. WXT migration from CRXJS happens here -- pay this cost upfront before building features on top.
**Delivers:** Monorepo structure, WXT-based extension with content script (page detection, button injection, auth token reading), service worker (message routing skeleton), popup shell (React wizard stepper), and the auth token flow working end-to-end.
**Addresses:** Project scaffolding, MV3 architecture foundations
**Avoids:** Service worker termination pitfall (#1), CORS pitfall (#3), state loss pitfall (#5) -- all addressed by architectural decisions made in this phase
**Research flag:** Standard patterns. WXT has good migration docs and the v1 provides proven patterns for content script injection and auth flow.

### Phase 2: Core Migration Pipeline (Extension-Only)
**Rationale:** This is the core product value. Building it extension-only first (like v1) means the migration flow can be tested and validated independently of the backend. If the backend slips, the extension still works.
**Delivers:** Complete catalog migration flow: file upload/parsing, POS auto-detection, column mapping (auto + manual), data transformation (categories, weights, brands, prices), validation with error display and inline fixing, Treez import CSV generation, S3 upload via service worker.
**Addresses:** All P1 features except backend persistence
**Avoids:** XLSX memory crash (#2), PapaParse streaming issues (#6), silent transformation errors (#4), overconfident auto-mapping (#8)
**Research flag:** NEEDS RESEARCH. Data transformation rules are cannabis-domain-specific and POS-specific. Will need real export files from each POS system as test fixtures. The v1 source code is the primary reference.

### Phase 3: Backend Service
**Rationale:** Backend is the foundation for state persistence, admin dashboard, and saved mappings. Build it in parallel with or after Phase 2, but it must be ready before Phase 4 integration.
**Delivers:** Hono API server with SQLite database, migration CRUD endpoints, file upload/storage endpoints, saved mappings endpoints, Treez JWT auth middleware.
**Addresses:** Server-side migration state, source file storage, saved mappings persistence
**Avoids:** chrome.storage.local quota exhaustion (#9) by moving persistence to server
**Research flag:** Standard patterns. Hono + Drizzle + SQLite is straightforward CRUD. The API surface is small (~10 routes).

### Phase 4: Extension-Backend Integration
**Rationale:** Connects the working extension (Phase 2) to the working backend (Phase 3). This is where migrations become durable across browser sessions.
**Delivers:** Auto-save migration state to backend on each wizard step, session recovery on popup reopen, source file upload to backend on step 1, mapping persistence to backend, import status reporting to backend.
**Addresses:** Resume interrupted migrations, cross-session persistence
**Avoids:** State loss on browser close (the core v1 limitation being fixed)
**Research flag:** Standard patterns. REST API integration from Chrome extensions is well-documented. The main consideration is graceful degradation if the backend is unreachable.

### Phase 5: Inventory Migration
**Rationale:** Extends the proven catalog migration pattern to inventory data. Same wizard, same pipeline architecture, different data model. Lower risk because patterns are established.
**Delivers:** Store selection step, inventory-specific transformation rules (quantity, cost mapping), inventory-specific validation, inventory output CSV generation.
**Addresses:** Inventory migration features (P2), store selection
**Avoids:** Building inventory before catalog flow is proven
**Research flag:** NEEDS RESEARCH. Inventory-to-Treez mapping has different rules than catalog. Need to understand Treez inventory import format and per-store scoping.

### Phase 6: Admin Dashboard and Polish
**Rationale:** Admin dashboard is a consumer of backend data and only makes sense once there are real migrations to monitor. Build last.
**Delivers:** Web-based admin dashboard (separate from extension), migration list with filters, migration detail view with errors, aggregate stats, bulk error resolution, pre-import dry run summary, import progress tracking.
**Addresses:** Admin dashboard (P3), plus P2 polish features (bulk error resolution, dry run, progress tracking)
**Avoids:** Building monitoring before there is anything to monitor
**Research flag:** Standard patterns. Admin CRUD dashboard is well-understood. Could be a simple React SPA served by the Hono backend.

### Phase Ordering Rationale

- **Phases 1-2 first** because the extension is the product. A working extension without a backend is useful (v1 proves this). A backend without an extension is useless.
- **Phase 3 can overlap with Phase 2** if resources allow. The backend has no dependency on extension code -- only on the shared types package.
- **Phase 4 is the integration bridge** and must follow both 2 and 3.
- **Phases 5 and 6 are independent** and can be built in either order or in parallel. Inventory migration (Phase 5) is recommended before admin dashboard (Phase 6) because it delivers direct user value.
- **Catalog must complete before inventory** (Treez requires products to exist before inventory quantities can reference them).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Core Pipeline):** Cannabis-specific transformation rules are domain-heavy. Need real POS export fixtures from Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, and Cova. The v1 source code is the primary reference but should be validated against current POS export formats.
- **Phase 5 (Inventory Migration):** Treez inventory import format and per-store scoping rules need investigation. Different data model than catalog.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Extension Shell):** WXT docs + v1 patterns cover this well.
- **Phase 3 (Backend Service):** Standard CRUD API with Hono + Drizzle + SQLite.
- **Phase 4 (Integration):** REST API wiring between extension and backend.
- **Phase 6 (Admin Dashboard):** Standard admin CRUD interface.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry or existing v1 package.json. WXT recommendation backed by multiple 2025-2026 framework comparisons. |
| Features | HIGH | Grounded in existing v1 functionality, cannabis POS migration guides, and data import tool patterns. Feature prioritization is clear. |
| Architecture | HIGH | Client-server pattern with thin service worker is well-documented for MV3. Proven by v1 extension patterns. One discrepancy: architecture doc references PostgreSQL/CRXJS but stack doc correctly recommends SQLite/WXT. |
| Pitfalls | HIGH | All critical pitfalls verified against Chrome developer documentation and library-specific issues. Domain-specific pitfalls validated by cannabis industry migration guides. |

**Overall confidence:** HIGH

### Gaps to Address

- **Treez auth token lifetime:** Exact token expiration timing not confirmed. Need to test during Phase 1 to determine refresh strategy.
- **Treez inventory import format:** Not fully documented in research. Needs investigation before Phase 5 planning.
- **better-sqlite3 and Vitest exact versions:** Verified as current libraries but specific version numbers not independently confirmed against npm. Low risk -- pin on install.
- **Local filesystem vs S3 for backend file storage:** Stack recommends local filesystem for simplicity. If deployment requires multiple backend instances or high availability, this decision needs revisiting. Flag for Phase 3 planning.
- **Admin dashboard deployment model:** Should it be served by the Hono backend, a separate SPA, or integrated into Treez admin? Decision deferred to Phase 6 planning.
- **Architecture doc inconsistencies:** ARCHITECTURE.md references PostgreSQL and CRXJS in diagrams and build order. These should be read as "database" and "extension framework" generically -- use SQLite and WXT per STACK.md recommendations.

## Sources

### Primary (HIGH confidence)
- [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- MV3 termination rules
- [Chrome Extension CORS Changes](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/) -- content script fetch restrictions
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) -- quota limits
- [WXT Official Site](https://wxt.dev/) -- extension framework docs and migration guide
- [Hono Official Site](https://hono.dev/) -- backend framework
- [Drizzle ORM SQLite Docs](https://orm.drizzle.team/docs/get-started-sqlite) -- ORM setup
- Existing v1 extension source code (`projects/chrome-extension/`) -- proven patterns

### Secondary (MEDIUM confidence)
- [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) -- WXT vs CRXJS comparison
- [Hono vs Fastify Comparison](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/) -- performance benchmarks
- [Cannabis POS Migration Guide (Cova)](https://www.covasoftware.com/blog/switching-dispensary-pos-how-to-plan-and-execute-a-seamless-pos-migration) -- domain challenges
- [Treez POS Migration Page](https://www.treez.io/migrate-your-pos) -- current migration offering

### Tertiary (LOW confidence)
- [SheetJS Large File Issues #1295](https://github.com/SheetJS/sheetjs/issues/1295) -- memory crash reports (issue-level, not official docs)
- [CRXJS MAIN World Issue #695](https://github.com/crxjs/chrome-extension-tools/issues/695) -- relevant only if CRXJS were chosen (it was not)

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
