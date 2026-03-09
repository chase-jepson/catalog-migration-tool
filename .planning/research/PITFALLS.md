# Domain Pitfalls

**Domain:** Chrome Extension POS Data Migration Tool (Cannabis Retail)
**Researched:** 2026-03-09

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Service Worker Termination Kills Long-Running Migrations

**What goes wrong:** MV3 service workers terminate after 30 seconds of inactivity or 5 minutes of continuous processing. A migration processing 50K+ rows silently dies mid-operation, leaving data in a corrupt partial state. Users see no error -- the extension just stops working.

**Why it happens:** Developers treat the service worker like a persistent background page (MV2 mental model). They put file parsing, transformation, or API upload logic in the service worker assuming it stays alive.

**Consequences:** Partial imports into Treez with no rollback. Silent data loss. Users re-run imports creating duplicates. Debugging is extremely difficult because the service worker disappears along with its console state.

**Prevention:**
- Never put long-running processing in the service worker. All heavy lifting (parsing, transformation, validation) must happen in the content script or an offscreen document.
- The service worker should only relay messages and manage chrome.storage operations.
- For operations that must survive the service worker lifecycle, persist progress checkpoints to chrome.storage.session or the backend, so work can resume after a restart.
- Use the offscreen API (Chrome 109+) for CPU-intensive tasks that need DOM access or long runtimes.

**Detection:** Service worker disappears from chrome://extensions during active migration. Migration progress stalls without error. Console logs vanish.

**Phase relevance:** Must be addressed in Phase 1 (core architecture). Getting this wrong means rewriting the entire processing pipeline later.

**Confidence:** HIGH -- well-documented Chrome limitation, confirmed by [Chrome developer docs](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

---

### Pitfall 2: XLSX Files Over 50MB Crash the Browser Tab

**What goes wrong:** SheetJS (the `xlsx` library) loads the entire file into memory to parse it because XLSX is a ZIP format requiring full buffering. A 100MB+ XLSX file from a dispensary with years of product history causes an out-of-memory crash in the browser tab, killing the extension's content script.

**Why it happens:** CSV streaming (via PapaParse) works fine for large files, so developers assume XLSX will scale similarly. It does not. XLSX parsing is fundamentally non-streamable in the browser because ZIP metadata sits at the end of the file.

**Consequences:** Browser tab crashes. User loses any unsaved mapping progress. Repeated crashes erode trust in the tool. Some POS systems (Dutchie, Blaze) export large XLSX files by default.

**Prevention:**
- Detect file size before parsing. For XLSX files over 30MB, prompt the user to export as CSV instead (every POS system supports CSV export).
- If XLSX must be supported for large files, parse in a Web Worker using SheetJS dense mode (`{dense: true}`) to reduce memory overhead.
- Set a hard file size limit (e.g., 100MB) with a clear error message suggesting CSV conversion.
- For the backend (v2), accept file uploads server-side and parse there where memory is more plentiful and controllable.

**Detection:** Test with real-world export files from each supported POS system. The largest files come from dispensaries with 3+ years of history and multiple product variants.

**Phase relevance:** Phase 1 (file upload/parsing). File size guardrails must be in place before users encounter this.

**Confidence:** HIGH -- confirmed by [SheetJS issue #1295](https://github.com/SheetJS/sheetjs/issues/1295) and multiple GitHub issues documenting browser crashes with files over 50MB.

---

### Pitfall 3: CORS Restrictions Block Treez API Calls from Content Scripts

**What goes wrong:** In MV3, content scripts are subject to the same CORS restrictions as the host page. Developers put Treez API calls (pricing tiers, presigned URLs, import status) directly in the content script and get blocked by CORS. The v1 extension may have worked around this, but the architecture breaks silently in production when Treez API endpoints don't return the right CORS headers.

**Why it happens:** Content scripts used to have elevated network access in MV2. In MV3, cross-origin fetches from content scripts are restricted. Developers forget to route API calls through the service worker, which does have CORS bypass via `host_permissions`.

**Consequences:** API calls fail silently or throw CORS errors. Migration wizard hangs at the pricing tier lookup or S3 upload step. Difficult to debug because CORS errors look different in extension context vs normal web page.

**Prevention:**
- All API calls (Treez API, S3 presigned URL uploads) must go through the service worker via `chrome.runtime.sendMessage`.
- Declare all Treez API domains in `host_permissions` in manifest.json: `"https://api.treez.io/*"`, `"https://*.sandbox.treez.io/*"`, `"https://*.dev.treez.io/*"`.
- Build a message-passing API layer early that abstracts where the fetch actually happens (service worker) from where results are consumed (content script).
- Test against all three Treez environments (prod, sandbox, dev) -- each may have different CORS behavior.

**Detection:** API calls work in dev but fail in production. CORS errors in the browser console on the Treez app page.

**Phase relevance:** Phase 1 (architecture). The message-passing API layer is foundational.

**Confidence:** HIGH -- confirmed by [Chrome security documentation](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/).

---

### Pitfall 4: Data Transformation Errors Produce Silent Bad Imports

**What goes wrong:** Category mapping, weight conversion, and price normalization produce incorrect but plausible-looking data. A "1/8 oz" becomes "0.125 oz" in the source but the Treez import expects "3.5g". A Dutchie category "Edibles > Gummies" maps to the wrong Treez product type. The import succeeds but populates the catalog with wrong data that takes weeks to discover and clean up.

**Why it happens:** Each POS system has its own taxonomy, units, and conventions. Developers test with one or two POS exports and assume mappings generalize. Cannabis-specific data has domain-specific gotchas: THC/CBD percentages vs mg amounts, pre-tax vs post-tax prices, weight units (oz fractions vs grams), strain type naming variations.

**Consequences:** Dispensary catalog has wrong categories, wrong weights, wrong prices. Compliance data (THC/CBD values) is wrong, which has regulatory consequences. Fixing requires manual correction of potentially thousands of products. Destroys user trust in the tool.

**Prevention:**
- Build a comprehensive validation step that runs after transformation, before generating import CSVs. Show users a summary: "X products mapped to Category Y, Z products have weight in grams, etc."
- Create POS-specific test fixtures using real export files (anonymized) from each supported POS.
- Never silently coerce values. If a weight can't be confidently converted, flag it for user review.
- Maintain a known-values lookup for cannabis-specific conversions (weight equivalences, standard category taxonomies).
- Add row-level confidence scores to transformations so users see what was auto-mapped vs what needs review.

**Detection:** Compare import CSV output against source data for a sample of rows after each transformation rule change. Automated regression tests against known POS export formats.

**Phase relevance:** Phase 2 (data transformation). This is the core value of the tool and must be meticulously tested.

**Confidence:** HIGH -- domain-specific knowledge validated by [cannabis POS migration guides](https://www.covasoftware.com/blog/switching-dispensary-pos-how-to-plan-and-execute-a-seamless-pos-migration).

---

### Pitfall 5: Global Variables Lost on Service Worker Restart

**What goes wrong:** Migration state (current step, column mappings, transformation progress, validation errors) is stored in JavaScript variables in the service worker. Service worker restarts (which happen frequently and unpredictably) wipe all state. User refreshes the page or switches tabs, comes back, and all progress is gone.

**Why it happens:** This is the single most common MV3 migration bug. In MV2, the persistent background page kept state in memory indefinitely. Developers carry this assumption into MV3.

**Consequences:** Users lose mapping configurations they spent 30+ minutes setting up. Migration progress resets. Users give up on self-service migration and file support tickets.

**Prevention:**
- The v2 architecture already plans for backend state persistence -- this is the right call. Ensure it's implemented from day one, not retrofitted.
- Use `chrome.storage.session` for ephemeral UI state (current wizard step, scroll position) as a fast local cache.
- Use the backend API for durable state (column mappings, validation results, transformation configs).
- Never store state only in the service worker's memory. Treat the service worker as stateless.

**Detection:** Manually kill the service worker from chrome://extensions during each wizard step. If any data is lost, state persistence is incomplete.

**Phase relevance:** Phase 1 (architecture). State management strategy is foundational.

**Confidence:** HIGH -- confirmed by [Chrome developer documentation](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers).

## Moderate Pitfalls

### Pitfall 6: PapaParse Web Worker + Streaming Don't Work Together

**What goes wrong:** Developers enable both `worker: true` and `step` callback in PapaParse configuration, expecting chunked streaming in a web worker. PapaParse's pause/resume doesn't work with web workers, causing the entire file to be read into memory despite the streaming configuration.

**Prevention:**
- Choose one strategy: streaming with step callback (main thread) for memory control, or web worker for UI responsiveness. Don't combine both.
- For large CSV files (>20MB), use streaming on the main thread with `chunk` callback and process in batches of 1000 rows. Show a progress indicator.
- For moderate files (<20MB), web worker is fine since the file fits in memory.
- With the v2 backend, consider uploading the file first and parsing server-side for files over a size threshold.

**Phase relevance:** Phase 1 (file parsing). Must decide parsing strategy before building the upload flow.

**Confidence:** HIGH -- confirmed by [PapaParse documentation](https://www.papaparse.com/faq).

---

### Pitfall 7: Treez Auth Token Expiration During Long Migrations

**What goes wrong:** The extension grabs the Treez session token from localStorage on the Treez app page. During a long migration (uploading many files, running validation), the token expires. Subsequent API calls fail with 401 errors. The extension doesn't handle this gracefully -- it either crashes or produces incomplete imports.

**Prevention:**
- Check token validity before each API call batch, not just at migration start.
- Implement token refresh: re-read from Treez localStorage (the Treez app refreshes its own tokens) and retry failed requests.
- Warn users if the Treez app tab is closed (token source disappears).
- Consider a health-check ping to Treez API at regular intervals during active migration to detect expired tokens early.

**Phase relevance:** Phase 2 (API integration). Token management should be built into the API layer.

**Confidence:** MEDIUM -- based on standard OAuth/session token patterns; Treez-specific token lifetime not confirmed.

---

### Pitfall 8: Column Auto-Detection Produces Overconfident Wrong Mappings

**What goes wrong:** Auto-detection maps a "Description" column to "Product Name" because both contain text strings. Or maps "Price" to "Cost" because both contain dollar amounts. User trusts the auto-mapping, clicks through, and imports with wrong column assignments.

**Prevention:**
- Auto-detection should show confidence levels for each mapping (High/Medium/Low).
- Low-confidence mappings should be visually distinct (yellow highlight, question mark) and require explicit user confirmation.
- Use POS-specific header templates. When POS is auto-detected, use the known column names for that POS to increase mapping accuracy.
- Always show a preview of 5-10 sample rows for each mapped column so users can visually verify.
- Store confirmed mappings per org/POS combination (the project already plans this) and use them as the primary mapping source for repeat migrations.

**Phase relevance:** Phase 2 (mapping UI). Critical UX decision that affects data quality.

**Confidence:** HIGH -- this is a known problem in every data import tool.

---

### Pitfall 9: chrome.storage.local Quota Exhaustion

**What goes wrong:** The extension stores parsed file data, mapping configurations, validation results, and transformation state in `chrome.storage.local`. The default 10MB limit is hit quickly with a large migration. Storage operations fail silently or throw runtime errors.

**Prevention:**
- Request `unlimitedStorage` permission in the manifest if using chrome.storage.local for file data.
- Better: don't store parsed file data in chrome.storage at all. With the v2 backend, upload source files to the server. Chrome.storage should only hold lightweight state (current step, user preferences, cached mappings).
- Monitor storage usage and warn before hitting limits.

**Phase relevance:** Phase 1 (architecture). Storage strategy decision.

**Confidence:** HIGH -- confirmed by [Chrome storage API docs](https://developer.chrome.com/docs/extensions/reference/api/storage). Default limit is 10MB.

---

### Pitfall 10: CRXJS Build Issues with Content Script Worlds

**What goes wrong:** CRXJS has a known bug where content scripts with `"world": "MAIN"` fail because `chrome.runtime.getURL` is not available in the MAIN world. If the extension needs to access Treez page localStorage (for auth tokens), it needs MAIN world access, but CRXJS breaks this.

**Prevention:**
- Access Treez localStorage from MAIN world via a small inline script injected by the content script, not through CRXJS's content script configuration.
- Test the build output, not just the dev server. CRXJS HMR mode and production builds behave differently.
- Pin CRXJS to a known-working version and test upgrades carefully.
- Have a fallback plan: if CRXJS becomes unmaintained or too buggy, the extension can be built with plain Vite + manual manifest configuration.

**Phase relevance:** Phase 1 (build setup). Verify CRXJS works for the required use cases before committing to it.

**Confidence:** MEDIUM -- confirmed issue exists ([CRXJS #695](https://github.com/crxjs/chrome-extension-tools/issues/695)) but may not affect this project depending on architecture choices.

## Minor Pitfalls

### Pitfall 11: CSV Encoding and Delimiter Variations

**What goes wrong:** POS exports use different encodings (UTF-8, UTF-16, Windows-1252) and delimiters (comma, tab, semicolon). PapaParse auto-detection usually handles this, but edge cases (BOM markers, quoted fields with embedded newlines) cause rows to shift or data to merge.

**Prevention:** Always detect encoding before parsing. PapaParse handles most cases, but test with exports from each POS system. Show a preview of the first 10 rows so users catch parsing issues before proceeding.

**Phase relevance:** Phase 1 (file parsing).

---

### Pitfall 12: Duplicate Product Detection is Harder Than Expected

**What goes wrong:** Source data has the same product listed multiple times with slightly different names ("Blue Dream 1g", "Blue Dream - 1 gram", "BLUE DREAM 1G"). Naive deduplication misses these. Treez import creates duplicate products that clutter the catalog.

**Prevention:** Implement fuzzy matching for product names. Normalize names (lowercase, strip whitespace, expand abbreviations) before comparison. Show potential duplicates to the user for confirmation rather than auto-deduplicating.

**Phase relevance:** Phase 2 (transformation/validation).

---

### Pitfall 13: Presigned URL Expiration During Multi-File Upload

**What goes wrong:** The tool generates Treez import CSVs (brands, attributes, products, variants, attribute joins, images -- up to 6 files) and gets presigned S3 URLs for each. If the user pauses or validation takes time between file generations, presigned URLs expire before upload.

**Prevention:** Request presigned URLs just before upload, not at the start of CSV generation. Implement retry logic: if upload fails with 403, request a fresh presigned URL and retry once.

**Phase relevance:** Phase 3 (import/upload).

---

### Pitfall 14: Environment-Specific Behavior Differences

**What goes wrong:** The extension works on `app.sandbox.treez.io` during development but breaks on `app.treez.io` in production. API endpoints, CORS headers, or Treez page DOM structure differ between environments.

**Prevention:** Test against all three environments (dev, sandbox, prod) regularly. Use environment detection to configure API base URLs. Don't hardcode any environment-specific values.

**Phase relevance:** All phases. Set up multi-environment testing in Phase 1.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Build setup & architecture | Service worker used for heavy processing (#1); CRXJS world issues (#10) | Keep service worker thin; test CRXJS early |
| File upload & parsing | XLSX memory crash (#2); PapaParse worker+streaming conflict (#6); encoding issues (#11) | Size limits on XLSX; choose one parsing strategy; test with real POS exports |
| Data transformation & mapping | Silent bad mappings (#4, #8); duplicates (#12) | Confidence scores on mappings; comprehensive validation step; POS-specific fixtures |
| API integration | CORS from content scripts (#3); token expiration (#7) | Message-passing API layer; token refresh logic |
| State management | Global variables lost (#5); storage quota (#9) | Backend persistence from day one; lightweight chrome.storage usage |
| Import & upload | Presigned URL expiration (#13); environment differences (#14) | Just-in-time URL requests; multi-environment CI |

## Sources

- [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- service worker timeout rules
- [Chrome Extension CORS Changes](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/) -- content script fetch restrictions
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) -- quota limits
- [Longer Extension Service Worker Lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes) -- keep-alive strategies
- [SheetJS Large File Issues](https://github.com/SheetJS/sheetjs/issues/1295) -- browser crash reports
- [PapaParse FAQ](https://www.papaparse.com/faq) -- streaming vs worker limitations
- [CRXJS MAIN World Issue](https://github.com/crxjs/chrome-extension-tools/issues/695) -- content script world bug
- [Cannabis POS Migration Guide (Cova)](https://www.covasoftware.com/blog/switching-dispensary-pos-how-to-plan-and-execute-a-seamless-pos-migration) -- domain-specific migration challenges
