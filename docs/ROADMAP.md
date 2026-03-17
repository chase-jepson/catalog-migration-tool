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
- CSV generation (brands, products, variants, attributes, images)
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

**Done when**: A user uploads a CSV and sees correct mappings pre-filled without needing to touch the mapping step for standard exports.

---

### 0.6 — In-App Product Review Page
**Goal**: Dedicated review page inside the extension where users can inspect, edit, and approve products before import.

- [ ] Table view of all transformed products with inline editing
- [ ] Filter/sort by category, subcategory, brand, flagged status
- [ ] Bulk edit operations (select multiple rows, change category/subcategory)
- [ ] Flag system: auto-flagged (suspicious values) + manual flags (user marks for review)
- [ ] Side panel product detail view (all fields, original source row, transformation notes)
- [ ] Mark rows as reviewed/approved
- [ ] Exclude individual products from import
- [ ] Undo/redo for edits
- [ ] Export corrections as JSON (for feeding back into transformation logic)

**Done when**: A migration expert can review, correct, and approve an entire catalog inside the extension without touching a spreadsheet.

---

### 0.7 — Skipped Products Report
**Goal**: Clear visibility into what didn't make it into the import and why.

- [ ] Downloadable CSV of all skipped/excluded products with columns:
  - Original row data
  - Skip reason (missing required field, excluded category, payment fee, etc.)
  - Suggested action (add weight, check category, etc.)
- [ ] Summary statistics: X skipped out of Y total, grouped by reason
- [ ] In-app banner showing skip count with link to download report
- [ ] Option to "force include" borderline skips from the review page (0.6)

**Done when**: After every migration, the team has a clear audit trail of what was skipped and why — no products silently disappear.

---

### 0.8 — Image Migration
**Goal**: Product images from the source POS are migrated to Treez alongside catalog data.

- [ ] Extract image URLs from source exports (Dutchie, Flowhub, Cova include image columns)
- [ ] Download images from source URLs
- [ ] Upload to Treez image storage (S3 via presigned URLs)
- [ ] Map images to products in the import payload
- [ ] Handle: missing images, broken URLs, duplicate images, rate limiting
- [ ] Progress indicator for image download/upload (can be slow for large catalogs)
- [ ] Fallback: generate image manifest CSV for manual upload if automated path fails

**Done when**: Products arrive in Treez with their images attached — no separate image migration step needed.

---

### 0.9 — Direct API Import
**Goal**: Products are created/updated in Treez directly via PMS API — no CSV handoff.

#### 0.9.1 — Core API Integration
- [ ] PMS API client for product CRUD (create, update, read)
- [ ] Map transformed rows to PMS API payloads
- [ ] Batch processing with configurable batch size
- [ ] Progress bar with per-product status (created / updated / failed / skipped)
- [ ] Error handling: retry failed products, surface actionable error messages
- [ ] Transaction log: what was created/updated, with rollback reference

#### 0.9.2 — Delta Detection (Re-sync)
- [ ] Pull existing products from PMS for the target org
- [ ] Normalize both sides (transformed source data vs existing PMS data)
- [ ] Compute diff: new products, changed products, unchanged products
- [ ] **Source has timestamps**: filter to rows modified since last sync date
- [ ] **Source has no timestamps**: full diff by product key/SKU/barcode
- [ ] UI shows diff summary: "42 new, 18 changed, 1,204 unchanged"
- [ ] User confirms which changes to apply before import executes
- [ ] Support incremental re-syncs (client sends updated export, we only push changes)

#### 0.9.3 — Error Recovery
- [ ] Resume interrupted imports from last successful product
- [ ] Partial import state saved to chrome.storage
- [ ] Detailed error report: which products failed, why, with retry option

**Done when**: Migration expert uploads a POS export and products appear in Treez — no CSV downloads, no manual uploads, no portal involvement. Re-running with an updated export only touches what changed.

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

- **Inventory migration improvements** — Same level of accuracy and API import for inventory
- **Collections migration** — If needed in the future
- **Multi-location support** — Split products across locations during import
- **Price tier creation** — Auto-create price tiers in Treez from source pricing columns
- **Audit dashboard** — Historical view of all migrations run through the tool
