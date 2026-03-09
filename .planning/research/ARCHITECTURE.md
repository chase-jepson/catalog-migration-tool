# Architecture Patterns

**Domain:** Chrome Extension + Backend POS Migration Tool
**Researched:** 2026-03-09

## Recommended Architecture

The system follows a **client-server pattern** where the Chrome extension acts as a rich client and a backend API service manages persistence, file storage, and admin functionality. The extension handles user interaction, file parsing, data transformation, and validation locally. The backend handles migration state persistence, source file storage, saved mappings, and admin dashboard data.

### High-Level System Diagram

```
+------------------------------------------------------------------+
|  Chrome Extension (Manifest V3)                                  |
|                                                                  |
|  +------------------+    +-------------------+                   |
|  | Content Script   |    | Background        |                   |
|  | (inject-button)  |    | Service Worker    |                   |
|  |                  |    |                   |                   |
|  | - Detects Treez  |    | - Auth token      |                   |
|  |   product-control|    |   refresh         |                   |
|  | - Injects FAB    |    | - S3 upload proxy |                   |
|  | - Reads auth     |    |   (CORS bypass)   |                   |
|  |   from LS        |    | - Message router  |                   |
|  | - Opens popup    |    |                   |                   |
|  +--------+---------+    +--------+----------+                   |
|           |                       |                              |
|           |  iframe               |  chrome.runtime.sendMessage  |
|           v                       |                              |
|  +--------+------------------------------------------+           |
|  | Popup UI (React)                                  |           |
|  |                                                   |           |
|  | Upload -> Mapping -> Review/Validate -> Import    |           |
|  |                                                   |           |
|  | - File parsing (PapaParse, XLSX)                  |           |
|  | - POS auto-detection                              |           |
|  | - Column mapping (auto + manual)                  |           |
|  | - Data transformation                             |           |
|  | - Validation + error fixing                       |           |
|  | - Output CSV generation                           |           |
|  +--------+------------------------------------------+           |
+-----------|------------------------------------------------------+
            |
            | REST API (fetch)
            v
+------------------------------------------------------------------+
|  Backend Service                                                 |
|                                                                  |
|  +-------------------+  +-------------------+  +---------------+ |
|  | Migration API     |  | File Storage API  |  | Admin API     | |
|  |                   |  |                   |  |               | |
|  | - Create/update   |  | - Upload source   |  | - List all    | |
|  |   migration       |  |   files           |  |   migrations  | |
|  | - Get migration   |  | - Retrieve files  |  | - Filter/     | |
|  |   state           |  | - Presigned URLs  |  |   search      | |
|  | - Save mappings   |  |   for S3          |  | - Org stats   | |
|  | - Update step     |  |                   |  | - Error logs  | |
|  +--------+----------+  +--------+----------+  +-------+-------+ |
|           |                      |                      |        |
|           v                      v                      v        |
|  +-------------------+  +-------------------+  +---------------+ |
|  | PostgreSQL        |  | S3 / Object Store |  | Admin SPA     | |
|  | (migration state, |  | (source files,    |  | (React app)   | |
|  |  mappings, logs)  |  |  generated CSVs)  |  |               | |
|  +-------------------+  +-------------------+  +---------------+ |
+------------------------------------------------------------------+
            |
            | Presigned URL upload
            v
+------------------------------------------------------------------+
|  Treez Infrastructure (existing)                                 |
|                                                                  |
|  - File Management API (presigned URL generation)                |
|  - S3 import bucket (existing Treez import pipeline)             |
|  - Import Service (async CSV processing)                         |
|  - Pricing API (price tier resolution)                           |
+------------------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Content Script** | Detect Treez product-control pages, inject migration button, read auth tokens from Treez localStorage, open popup panel as iframe | Popup (iframe postMessage), Service Worker (chrome.runtime), Treez DOM |
| **Background Service Worker** | Proxy S3 uploads (CORS bypass), refresh expired auth tokens, route messages between components | Content Script (chrome.runtime.onMessage), Treez auth endpoint (fetch), S3 (fetch PUT) |
| **Popup UI (React)** | Wizard flow: upload, POS detection, column mapping, transformation, validation, error fixing, output generation, import triggering | Service Worker (chrome.runtime.sendMessage), Backend API (fetch), Content Script (postMessage for auth) |
| **Backend - Migration API** | CRUD for migration sessions, step state persistence, saved column mappings per org/POS | PostgreSQL, called by Popup UI |
| **Backend - File Storage API** | Store uploaded source files (CSV/XLSX), serve them back for reprocessing | S3/Object Store, called by Popup UI |
| **Backend - Admin API** | List migrations across all orgs, filter by status/org/date, error aggregation | PostgreSQL, called by Admin Dashboard |
| **Admin Dashboard** | Web UI for Treez team to monitor migrations, view errors, debug issues | Backend Admin API |

### Data Flow

The migration lifecycle moves data through these stages:

```
1. UPLOAD
   User drops CSV/XLSX into popup
   -> File parsed client-side (PapaParse/XLSX)
   -> Source file uploaded to Backend File Storage
   -> Migration record created in Backend (status: UPLOADED)
   -> POS auto-detected from headers/data patterns

2. MAPPING
   User maps source columns to Treez fields
   -> Auto-mapping applied from POS defaults or saved mappings
   -> User adjusts mappings manually
   -> Mappings saved to Backend (per org/POS)
   -> Migration updated (status: MAPPED)

3. REVIEW / VALIDATE
   Mapped data transformed using POS-specific rules
   -> Categories normalized, weights converted, prices formatted
   -> Price tiers resolved against Treez Pricing API
   -> Validation runs: required fields, enum values, data types
   -> Errors grouped and displayed
   -> User fixes errors inline (dropdowns, text edits)
   -> Migration updated (status: VALIDATED)

4. IMPORT
   Validated data split into Treez import CSVs:
     brands.csv, attributes.csv, products.csv, variants.csv,
     attribute_joins.csv, images.csv, prices.csv
   -> Each CSV: get presigned URL from Treez File Management API
   -> Upload CSV to S3 via Service Worker (CORS bypass)
   -> Treez import pipeline processes asynchronously
   -> Poll Treez Import Report API for completion
   -> Migration updated (status: IMPORTING -> COMPLETE/FAILED)
```

### Where State Lives at Each Stage

| Stage | Extension State | Backend State | Treez State |
|-------|----------------|---------------|-------------|
| **Upload** | Parsed file in React state (memory) | Source file in S3, migration record in DB | -- |
| **Mapping** | Current mappings in React state | Saved mappings in DB, migration step updated | -- |
| **Review** | Derived/transformed rows in React state | Migration step updated | Price tiers fetched from Pricing API |
| **Validate** | Validation errors + fixes in React state | Migration step updated, error summary in DB | -- |
| **Import** | Upload progress in React state | Migration status updated per CSV file | CSVs in S3, import jobs processing |
| **Complete** | Reset for next migration | Final status, error counts, timestamps | Import results in Treez system |
| **Session Recovery** | Hydrate from Backend on popup reopen | Full migration state persisted | -- |

## Patterns to Follow

### Pattern 1: Service Worker as Thin Proxy

The background service worker should do the minimum: proxy requests that need CORS bypass (S3 uploads) and handle token refresh. All business logic (parsing, transformation, validation) stays in the popup UI.

**Why:** MV3 service workers are ephemeral -- they spin down after ~30 seconds of inactivity. Putting business logic there means losing state. The popup has a stable lifecycle while open.

**What:**
```typescript
// service-worker.ts -- keep it thin
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'UPLOAD_TO_S3') {
    fetch(message.presignedUrl, { method: 'PUT', body: message.body })
      .then(res => sendResponse({ ok: res.ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // async response
  }

  if (message.type === 'REFRESH_TOKEN') {
    refreshAccessToken(message.tokens)
      .then(fresh => sendResponse({ tokens: fresh }))
      .catch(() => sendResponse({ tokens: null }));
    return true;
  }
});
```

### Pattern 2: Backend as State Machine

Model each migration as a state machine in the backend. The extension drives transitions, the backend persists them.

**Why:** Migrations must survive browser closes. The backend is the source of truth for "where is this migration?" The extension hydrates from backend state on reopen.

**What:**
```typescript
// Migration states
type MigrationStatus =
  | 'CREATED'
  | 'FILE_UPLOADED'
  | 'MAPPING_COMPLETE'
  | 'VALIDATED'
  | 'IMPORTING'
  | 'IMPORT_COMPLETE'
  | 'IMPORT_FAILED'
  | 'CANCELLED';

// Each transition updates the backend
await api.updateMigration(migrationId, {
  status: 'MAPPING_COMPLETE',
  mappings: currentMappings,
  posSystem: selectedPOS,
});
```

### Pattern 3: Content Script as Entry Point Only

The content script detects the correct page, injects the button, extracts auth context (org name, app URL, tokens), and opens the popup. It should not contain business logic.

**Why:** Content scripts run in the page's context and are vulnerable to page navigation killing them. Keep them minimal and stateless.

### Pattern 4: Popup Iframe for Isolation

The v1 pattern of rendering the popup inside an iframe (injected by the content script) is correct. This isolates extension styles/JS from the host page and gives the popup a clean React rendering context.

**Why:** Direct DOM injection into Treez's page would conflict with their React/MUI app. The iframe provides a clean boundary.

### Pattern 5: Auth Token Flow

Auth tokens come from Treez's localStorage (set by their app). The content script reads them and passes them to the popup via postMessage. The service worker can refresh expired tokens against the Treez auth endpoint.

**What:**
```
Treez App (localStorage: tz-tokens)
  -> Content Script reads on inject + every 30s
  -> Popup requests via postMessage to parent frame
  -> Service Worker refreshes if expired (using refresh_token)
  -> Backend API calls use token in Authorization header
```

**Critical detail:** The popup runs as an extension page (chrome-extension:// URL) inside an iframe. It cannot directly access the host page's localStorage. It must get tokens from the content script via postMessage or chrome.runtime messaging.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Heavy Service Worker

**What:** Putting parsing, transformation, or validation logic in the service worker.
**Why bad:** MV3 service workers terminate after ~30 seconds of idle. Long-running operations get killed. State is lost on restart. No DOM access for complex operations.
**Instead:** Keep all computation in the popup UI. The service worker handles only message routing, token refresh, and CORS proxy.

### Anti-Pattern 2: chrome.storage.local as Primary Database

**What:** Storing migration state, mappings, and file data in chrome.storage.local.
**Why bad:** Limited to ~5MB. Not accessible to admin dashboard. Lost if extension is uninstalled. Cannot be queried across orgs. The v1 does this for mappings and it works for a single-user tool, but v2 needs server-side persistence.
**Instead:** Use chrome.storage.local only as a local cache / offline fallback. Backend DB is the source of truth.

### Anti-Pattern 3: Sending Entire Files Through Message Passing

**What:** Sending full CSV/XLSX file contents through chrome.runtime.sendMessage between popup and service worker.
**Why bad:** Message size limits, serialization overhead, memory pressure. Large files (10MB+) can cause crashes.
**Instead:** Parse files in the popup where they were selected. Only send small payloads (presigned URLs, CSV strings per output file) through messaging. Upload source files directly from the popup to the backend.

### Anti-Pattern 4: Polling Without Backend State

**What:** Relying solely on polling the Treez Import Report API from the extension to track import progress.
**Why bad:** If the user closes the browser during import, progress tracking is lost. No way for admin to see import status.
**Instead:** The backend should track import status. The extension reports progress to the backend. The backend can independently poll Treez if needed (or receive webhooks).

### Anti-Pattern 5: Shared Mutable State Between Components

**What:** Using global variables or shared references between content script, popup, and service worker.
**Why bad:** Each runs in a separate execution context. Global state in the service worker is lost on restart.
**Instead:** Use message passing for cross-component communication. Use React state in popup. Use backend API for persistent state.

## Extension-Backend Communication

### API Design

The backend exposes a REST API. The popup calls it directly via fetch (no CORS issues since extension pages can make cross-origin requests without restriction in MV3).

```
POST   /api/migrations                    Create migration
GET    /api/migrations/:id                Get migration state
PATCH  /api/migrations/:id                Update migration (step, status, mappings)
GET    /api/migrations/:id/files          List source files
POST   /api/migrations/:id/files          Upload source file
GET    /api/mappings/:orgId/:posSystem    Get saved mappings
PUT    /api/mappings/:orgId/:posSystem    Save mappings

# Admin endpoints
GET    /api/admin/migrations              List all migrations (paginated, filterable)
GET    /api/admin/migrations/:id          Migration detail with full error log
GET    /api/admin/stats                   Aggregate stats (counts by status, org, POS)
```

### Authentication

The extension authenticates to the backend using the same Treez JWT token. The backend validates the token against Treez's auth infrastructure (verify signature or call Treez token introspection endpoint). This avoids introducing a separate auth system.

For admin endpoints, the backend checks for Treez internal roles/permissions in the JWT claims.

## Suggested Build Order

Build order is driven by dependencies. Each layer builds on the previous.

```
Phase 1: Extension Foundation
  - Project scaffolding (Vite + CRXJS + React + TypeScript + Tailwind)
  - Manifest V3 configuration
  - Content script: page detection + button injection
  - Service worker: message handler skeleton
  - Popup: basic shell with routing/stepper
  - Auth flow: content script reads tokens, popup receives them
  WHY FIRST: Everything else depends on the extension shell working.

Phase 2: Core Migration Pipeline (Extension-only)
  - File upload + parsing (PapaParse, XLSX)
  - POS auto-detection
  - Column mapping (auto-detect + manual)
  - Data transformation engine
  - Validation engine
  - Output CSV generation
  - S3 upload via service worker
  - Import polling
  WHY SECOND: This is the core product. Can work standalone (like v1)
  without a backend. Proves the migration flow works.

Phase 3: Backend Service
  - API scaffolding (Node.js + Express/Fastify)
  - PostgreSQL schema: migrations, mappings, files
  - Migration CRUD endpoints
  - File upload/storage endpoints
  - Saved mappings endpoints
  - Auth middleware (Treez JWT validation)
  WHY THIRD: Backend adds persistence and admin capabilities on top
  of a working migration flow. Extension should work without backend
  (graceful degradation) during development.

Phase 4: Extension-Backend Integration
  - Wire popup to save/restore migration state from backend
  - Session recovery on popup reopen
  - Source file upload to backend on step 1
  - Mapping persistence to backend
  - Import status reporting to backend
  WHY FOURTH: Integration layer connecting phases 2 and 3.

Phase 5: Admin Dashboard
  - Admin SPA (can be a separate route in the backend or standalone)
  - Migration list with filters (org, status, date, POS)
  - Migration detail view (steps, errors, files)
  - Aggregate stats
  WHY FIFTH: Admin dashboard is a consumer of backend data. Needs
  backend to be fully functional first.

Phase 6: Inventory Migration
  - Store selection step in wizard
  - Inventory-specific transformation rules
  - Inventory-specific validation
  - Inventory output CSV generation
  WHY LAST: Extends the catalog migration pattern. Same wizard,
  same pipeline, different data model. Lowest risk because the
  pattern is proven by catalog migration.
```

### Dependency Graph

```
Extension Shell (Phase 1)
    |
    v
Core Pipeline (Phase 2) -----> Backend Service (Phase 3)
    |                               |
    +-------------------------------+
    |
    v
Extension-Backend Integration (Phase 4)
    |
    +--> Admin Dashboard (Phase 5)
    |
    +--> Inventory Migration (Phase 6)
```

Phases 5 and 6 are independent of each other and can be built in parallel.

## Scalability Considerations

| Concern | Current Scale (internal tool) | At 100 orgs | At 1000 orgs |
|---------|------------------------------|-------------|--------------|
| File parsing | Client-side, instant | Client-side, no server load | Client-side, no server load |
| Migration state | PostgreSQL, trivial | PostgreSQL, trivial | PostgreSQL with indexes, still trivial |
| Source file storage | S3, pennies | S3, dollars | S3, tens of dollars |
| Admin dashboard queries | Simple queries | Add pagination + filters | Add caching, consider read replicas |
| Concurrent migrations | Unlikely | Possible, no conflicts (per-org isolation) | Need rate limiting on Treez API calls |

The architecture scales well because the heavy lifting (parsing, transformation, validation) happens client-side in the extension. The backend is a thin persistence layer. The bottleneck at scale is the Treez import pipeline, which is outside our control.

## Sources

- [Chrome Extensions Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) - Official Chrome docs on MV3 architecture
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - Official docs on service worker behavior
- [Migrate to a Service Worker](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) - Official migration guide with persistence patterns
- [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) - CRXJS vs alternatives comparison
- [CRXJS Architecture](https://deepwiki.com/crxjs/chrome-extension-tools) - CRXJS component architecture patterns
- [S3 Presigned URL Patterns](https://fourtheorem.com/the-illustrated-guide-to-s3-pre-signed-urls/) - Presigned URL upload architecture
- Existing v1 extension source code at `projects/chrome-extension/` - Proven patterns for content script injection, auth flow, S3 upload proxy, and wizard UI
