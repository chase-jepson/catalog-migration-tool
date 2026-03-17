# Catalog Migration Tool — Roadmap to v1

**Goal**: Replace the current manual migration process (Parabola + spreadsheets + CSV uploads) with a single Chrome extension that handles the entire catalog migration end-to-end — from POS export to live Treez products.

**Current version**: 0.3.1
**Target**: v1.0 — used in all catalog migrations as the primary method

---

## Version History

### 0.1 — Foundation
- WXT Chrome extension scaffold (Manifest V3, React 19, Tailwind v4)
- Shadow DOM drawer UI embedded in Treez app
- File upload + POS auto-detection (9 systems)
- Column mapping with POS-specific defaults
- Basic transformation pipeline (category resolution, weight parsing)
- CSV generation (brands, attributes, products, variants, attribute joins, images)
- S3 upload + import polling

### 0.2 — Inventory Migration
- Multi-file ETL pipeline (inventory, receipts, vendors, adjustments)
- 56-column CSV output matching Treez inventory import spec
- Cross-file joins with null-byte key separator
- Portal API integration for validate → execute → poll → rollback
- 130 inventory tests

### 0.3 — Catalog Transformation Accuracy *(current)*
- Production reference data integration (407 orgs, 6.3M products)
  - Brand → category fallback (507 brands, ≥95% confidence)
  - Brand → subcategory fallback (4,513 mappings, ≥80% confidence)
  - Strain → classification fallback (427 strains, ≥90% confidence)
  - Brand normalization (4,349 variant → canonical mappings)
- 40+ transformation rules from real export review
- Local ETL runner + interactive HTML review page for iterating
- 558 tests across 21 test files

---

## Upcoming Milestones

### 0.4 — Transformation Accuracy Complete
**Goal**: All 9 POS systems produce accurate output with minimal flagged rows.

- [ ] Review remaining ~624 flagged rows across 44 export files
- [ ] Fix transformation bugs identified during review
- [ ] Integrate amount validation data (common amounts by category+subcategory) for flagging outliers
- [ ] Handle edge cases: multi-variant products, composite SKUs, unit-of-measure conflicts
- [ ] Target: <100 flagged rows across all 44 test files (from 1,736 at start)
- [ ] Full regression test coverage for all new rules

**Acceptance criteria**:
- <100 flagged rows AND <5% error rate on validation across all 9 POS systems
- Every new transformation rule has dedicated test coverage

**Done when**: A migration expert can upload any of the 9 POS exports and the output requires minimal manual corrections.

---

### 0.5 — Smart Header Mapping
**Goal**: The mapping step is just for custom adjustments — 90%+ of columns auto-map correctly.

- [ ] Fuzzy header matching (e.g., "Net Weight" → weight, "Strain Species" → classification)
- [ ] Confidence scoring — auto-accept high confidence, prompt user for ambiguous matches
- [ ] Header synonym dictionary built from real export files across all 9 POS systems
- [ ] Support for multi-header detection (e.g., Flowhub exports with 175 columns)
- [ ] Save/load mapping profiles per POS system
- [ ] UI shows auto-mapped fields as pre-filled with visual indicator of confidence level

**Acceptance criteria**:
- ≥90% of columns auto-mapped correctly across a test set of 20+ real exports, measured by field-level accuracy

**Done when**: A user uploads a CSV and sees correct mappings pre-filled without needing to touch the mapping step for standard exports.

---

### 0.6 — In-App Review + Skipped Products Report
**Goal**: Dedicated review page inside the extension where users can inspect, edit, and approve products before import, plus clear visibility into what was skipped and why.

#### Review Page (MVP scope)
- [ ] Table view of flagged/suspicious products with inline editing
- [ ] Filter/sort by category, subcategory, brand, flag type
- [ ] Mark rows as reviewed/approved
- [ ] Exclude individual products from import
- [ ] Attribute mapping review (flavors, effects, tags)
- [ ] Export corrections as JSON (for feeding back into transformation logic)

#### Skipped Products Report
- [ ] "Skipped" tab showing all excluded products with skip reasons
- [ ] Summary statistics: X skipped out of Y total, grouped by reason
- [ ] Option to "force include" borderline skips
- [ ] Downloadable CSV of skipped products with original row data + reason + suggested action

#### Deferred to fast-follow
- Bulk edit operations (select multiple rows, change category/subcategory)
- Side panel product detail view
- Undo/redo for edits

**Acceptance criteria**:
- Migration expert completes review of a 5,000-product catalog in under 30 minutes using only the in-app review
- Every skipped product has a visible reason; no products silently disappear

**Done when**: A migration expert can review, correct, and approve an entire catalog inside the extension without touching a spreadsheet, and has a clear audit trail of skipped products.

---

### 0.7 — Core API Import
**Goal**: Products are created/updated in Treez directly via PMS API — no CSV handoff.

- [ ] PMS API client for product CRUD (create, update, read)
- [ ] Brand creation — auto-create brands that don't exist in target org
- [ ] Attribute creation — auto-create attributes/attribute joins
- [ ] Map transformed rows to PMS API payloads
- [ ] Batch processing with configurable batch size
- [ ] Progress bar with per-product status (created / updated / failed / skipped)
- [ ] **Dry run mode**: preview what will be created/changed before committing
- [ ] Error handling: retry failed products, surface actionable error messages
- [ ] Transaction log: what was created/updated, timestamped

**Rollback strategy** (define before building):
- [ ] Document what "rollback" means for direct API writes (delete created products? revert field changes?)
- [ ] Decide: soft rollback (mark inactive) vs hard rollback (delete) vs no automated rollback (manual cleanup from transaction log)

**Acceptance criteria**:
- 100% of non-excluded products exist in PMS with correct category, subcategory, brand, amount, and pricing after import — verified by re-fetching and diffing
- Dry run mode shows exact create/update counts without writing to PMS

**Done when**: Migration expert uploads a POS export and products appear in Treez — no CSV downloads, no manual uploads, no portal involvement.

---

### 0.8 — Image Migration
**Goal**: Product images from the source POS are migrated to Treez alongside catalog data.

- [ ] Extract image URLs from source exports (Dutchie, Flowhub, Cova include image columns)
- [ ] Download images via background script (handles CORS)
- [ ] Upload to Treez image storage (S3 via presigned URLs or PMS API)
- [ ] Map images to variants in the import payload
- [ ] Handle: missing images, broken URLs, duplicate images, rate limiting
- [ ] Progress indicator for image download/upload (can be slow for large catalogs)
- [ ] Fallback: generate image manifest CSV for manual upload if automated path fails

**Done when**: Products arrive in Treez with their images attached — no separate image migration step needed.

---

### 0.9 — Error Recovery + Progress Tracking
**Goal**: Robust handling of large imports and partial failures.

- [ ] Resume interrupted imports from last successful product
- [ ] Partial import state saved to chrome.storage
- [ ] Detailed error report: which products failed, why, with retry option
- [ ] Performance: handle 15,000+ product catalogs without timeout or memory issues
- [ ] Import history: list of past imports with status, product count, timestamp

**Done when**: A 15,000 product import that fails at product 8,000 can be resumed from where it stopped, and the user has a clear report of what succeeded and what failed.

---

### 0.9.x — Internal Testing
**Goal**: Validate the tool against real migrations before going live.

- [ ] Run 10+ real catalog migrations side-by-side with current Parabola process
- [ ] Compare output: product count, field accuracy, category mapping, pricing
- [ ] Document any discrepancies and fix
- [ ] Time comparison: extension vs current manual process
- [ ] Get sign-off from 2+ migration experts that output is production-ready
- [ ] Test with catalogs of varying sizes (100 products → 15,000 products)
- [ ] Test all 9 POS systems with real client data

**Done when**: Every test migration produces identical or better results than the current process, and migration experts are confident using it.

---

### v1.0 — Production Release
**Goal**: Used in all catalog migrations as the primary migration method.

- [ ] Published to Chrome Web Store (unlisted) for team distribution
- [ ] Auto-updates on new releases
- [ ] User documentation for migration experts
- [ ] Runbook: how to handle edge cases, common issues, escalation path
- [ ] Monitoring: track success/failure rates, flag rate, import times

---

## Post-v1 (v2+)

- **Delta detection / re-sync** — Compare transformed data against existing PMS data, only import/update products that changed. Supports both timestamp-based filtering and full diff by product key/SKU.
- **Inventory migration v2** — Same level of accuracy and API import for inventory
- **Price tier creation** — Auto-create price tiers in Treez from source pricing columns
- **Per-store entity pricing** — Import store-specific price overrides for multi-location orgs
- **Bulk edit in review** — Multi-select rows, bulk category/subcategory changes, undo/redo
- **Audit dashboard** — Historical view of all migrations run through the tool
