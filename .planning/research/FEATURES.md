# Feature Research

**Domain:** Cannabis POS Data Migration Tool (Chrome Extension + Backend)
**Researched:** 2026-03-09
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unusable for real migrations.

#### File Handling & POS Detection

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CSV/XLSX file upload | Every migration starts with an export file; these are the universal formats all POS systems support for export | LOW | PapaParse + XLSX libraries handle parsing. Support drag-and-drop and file picker. |
| Auto-detect POS system from file structure | Users should not need to tell the tool what they already know implicitly from the file they uploaded; reduces friction and errors | MEDIUM | Match column headers against known POS signatures (Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova). Fall back to manual selection for unknown formats. |
| Multiple file upload per migration | Some POS systems export catalog data across multiple files (e.g., products + categories + pricing as separate CSVs) | LOW | Need clear UI for associating files to data types. |
| Large file handling (10k+ rows) | Multi-location dispensaries can have thousands of SKUs; tool must not choke on real-world file sizes | MEDIUM | Stream parsing, chunked processing, progress indicators. Chrome extension memory limits are a real constraint. |

#### Column Mapping

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Smart auto-mapping of columns | After POS detection, most columns should map automatically; manual mapping of 50+ columns is a dealbreaker | MEDIUM | Use POS-specific mapping templates. Fuzzy match on column names for unknown POS systems. |
| Manual mapping override | Auto-mapping will never be 100% correct; users need to fix mistakes without starting over | LOW | Dropdown per source column to select target Treez field. Show unmapped columns prominently. |
| Saved mappings per org/POS combo | Dispensaries with multiple stores do repeated migrations; re-doing mapping each time is unacceptable | LOW | Persist to backend. Key by organization + POS system identifier. |
| Mapping preview with sample data | Users need to verify mappings are correct before committing; showing 3-5 sample rows alongside the mapping gives confidence | LOW | Show source value -> mapped target value for first few rows. |

#### Data Transformation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Category normalization | Every POS uses different category taxonomies (e.g., "Flower" vs "Dried Flower" vs "Cannabis Flower"); Treez has a fixed set | MEDIUM | Maintain lookup tables per POS. Allow manual override for unmapped categories. |
| Weight/unit standardization | POS systems use inconsistent units (g, oz, mg, each, pk); Treez expects specific formats | MEDIUM | Parse numeric + unit, convert to Treez-expected format. Handle edge cases like "3.5g" vs "3.5 grams" vs "1/8 oz". |
| Price tier resolution | Treez has a specific pricing tier structure; source pricing must map to existing tiers or create new ones | HIGH | Requires API call to Treez to fetch existing price tiers. Must handle recreational vs medical pricing. |
| Brand normalization | Brand names vary wildly across POS systems (abbreviations, spacing, capitalization); need to match to existing Treez brands or flag new ones | MEDIUM | Fuzzy matching against existing Treez brands via API. Show confidence scores for matches. |
| Classification mapping | Cannabis product classifications (Indica/Sativa/Hybrid/CBD) need normalization | LOW | Simple lookup table with common variations. |

#### Validation & Error Handling

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Row-level validation with specific error messages | Users need to know exactly what is wrong and where; "import failed" with no detail is useless | MEDIUM | Validate required fields, data types, format constraints, referential integrity per row. |
| Grouped error display | Errors should be grouped by type (e.g., "15 rows missing category", "3 rows with invalid weight") not listed individually when there are hundreds | MEDIUM | Group by error type with expand/collapse. Show affected row count per error type. |
| Inline error fixing | Users should fix errors in the tool, not download a CSV, fix in Excel, and re-upload | HIGH | Editable cells in the validation review. Both per-row and bulk fix (e.g., set all blank categories to "Flower"). |
| Required field checking | Treez import pipeline rejects rows missing required fields; catch these before upload, not after | LOW | Check against Treez import schema. Mark required vs optional fields clearly. |
| Duplicate detection | Source files often contain duplicate products or variants; importing duplicates creates catalog mess | MEDIUM | Match on product name + brand + weight/size combination. Let user choose merge strategy. |

#### Import Execution

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Generate Treez-formatted import CSVs | The entire point of the tool: produce files the existing Treez import pipeline can consume | HIGH | Generate separate CSVs for brands, attributes, products, variants, attribute joins, images per Treez import spec. |
| Upload to S3 via presigned URLs | Treez import pipeline reads from S3; tool must deliver files there | MEDIUM | Fetch presigned URL from Treez API, upload generated CSV, handle retry on failure. |
| Import progress tracking | Users need to know the import is working and approximately when it will finish; staring at a spinner for 10+ minutes causes anxiety | MEDIUM | Track which files have been uploaded, show ETA. Poll Treez import status if API available. |

#### Inventory Migration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Store selection for inventory | Inventory is per-store while catalog is per-org; the tool must let users pick which store they are importing inventory for | LOW | Fetch store list from Treez API. Single-select per migration run. |
| Inventory quantity import | The core inventory data: product-to-quantity mappings per store | MEDIUM | Map source product identifiers to Treez product IDs (requires catalog to be imported first). Handle unit-of-measure differences. |
| Cost/wholesale price import | Inventory often includes cost data that is store-specific; this is critical for margin calculations | LOW | Map to Treez cost fields. Validate numeric format. |

#### State Persistence & Session Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Server-side migration state | Migrations take hours across multiple sessions; losing progress because a browser tab closed is unacceptable | HIGH | Backend service storing full migration state: uploaded files, mappings, validation results, import status. |
| Resume interrupted migrations | Browser crashes, user leaves for lunch, comes back next day; the migration should be exactly where they left it | MEDIUM | Load state from backend on extension open. Show migration list with status for each. |
| Source file storage | Treez team needs access to original files for debugging failed imports; source files must persist beyond the browser session | MEDIUM | Upload source files to backend/S3 on initial upload step. Link to migration record. |

### Differentiators (Competitive Advantage)

Features that set this tool apart from "just hand your CSVs to the Treez onboarding team and wait."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Self-service migration (no Treez engineering needed) | Currently migrations require Treez staff time and back-and-forth emails with CSVs. Self-service saves Treez labor costs and unblocks dispensaries from waiting on Treez team availability. | HIGH | This is the core product value. The entire wizard UX enables this. |
| Admin dashboard for Treez team | Treez staff can monitor all in-flight migrations across all organizations: see status, errors, bottlenecks without asking the dispensary for screenshots | HIGH | Separate admin view. Filter by org, status, POS type. Drill into individual migration details. |
| Wizard-guided UX (upload -> map -> validate -> review -> import) | Step-by-step flow reduces cognitive load vs "here is a spreadsheet template, figure it out." Each step has clear completion criteria. | MEDIUM | Linear wizard with back/forward navigation. Step completion indicators. Prevent advancing with unresolved errors. |
| Bulk error resolution | Instead of fixing errors one row at a time, apply a fix to all rows with the same error (e.g., "Set all 47 unmapped categories to 'Flower'") | MEDIUM | Group-level actions on validation errors. "Apply to all similar" button. Dramatically reduces time for large catalogs. |
| Image URL migration | Migrate product images by URL reference from source POS; most manual migration processes skip images entirely | MEDIUM | Extract image URLs from source data, include in Treez image import CSV. Handle broken URLs gracefully. |
| Org-level mapping templates | When a multi-store chain migrates, the mapping done for store 1 should auto-apply to stores 2-N. Saves hours of repeated work. | LOW | Already planned as "saved mappings per org/POS combo." Differentiation is in making this seamless and automatic. |
| Pre-import dry run summary | Show exactly what will be created in Treez before actually importing: "Will create 245 products, 12 brands, 8 categories, 892 variants." Gives confidence before a potentially irreversible action. | MEDIUM | Aggregate transformed data into summary counts by entity type. Show alongside a "Confirm Import" action. |
| Migration history and audit trail | Track who ran what migration, when, with what results. Useful for compliance (cannabis is heavily regulated) and debugging. | LOW | Log all migration actions with timestamps, user identity, and outcomes in backend. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Direct POS API integration | "Why not just pull data directly from Dutchie/Blaze via their API instead of making me export a CSV?" | Each POS API is different, requires API keys/auth the dispensary may not have, APIs change without notice, and adds 6 POS-specific integrations to maintain. CSV/XLSX is the universal denominator every POS supports. | Keep CSV/XLSX upload. Invest in better auto-detection and smarter mapping instead. The export step is a one-time cost; maintaining 6+ API integrations is ongoing. |
| Real-time two-way sync | "Keep my old POS and Treez in sync during the transition period" | Massively increases scope, requires handling conflict resolution, and creates data consistency nightmares. This is an integration product, not a migration tool. | Clean cutover approach: export from old POS on migration day, import into Treez, go live on Treez. Treez handles deduplication on its end. |
| Rollback/undo of completed imports | "Let me undo the import if something went wrong" | Treez import pipeline is append-oriented. Implementing rollback means tracking every created entity and deleting them, which interacts poorly with METRC compliance systems and any transactions that may have already occurred against imported products. | Pre-import validation and dry run summary prevent bad imports. For edge cases, Treez support can manually clean up. The tool should make it hard to import bad data, not easy to undo. |
| Transaction/sales history migration | "Bring over our historical sales data too" | Sales history has completely different schemas across POS systems, is massive in volume, and Treez reporting is built around Treez-native transactions. Imported historical data would not integrate with Treez analytics. | Side-by-side reporting: keep access to old POS for historical reports. Export summary reports from old POS as reference documents (not structured data imports). |
| Customer data migration | "Migrate our customer/patient records too" | Customer data involves PII, HIPAA considerations for medical patients, loyalty program complexities, and is a separate domain from catalog/inventory. Scope creep risk is enormous. | Separate customer migration tool or manual process through Treez onboarding team. Keep this tool focused on catalog + inventory. |
| Mobile/tablet support | "Our managers use iPads on the floor" | Chrome Extension APIs are desktop Chrome only. Building a separate mobile app doubles the codebase for a tool that is used a handful of times per store, not daily. | Desktop-only Chrome extension. Migrations are an office/back-room task, not a floor task. |
| Custom POS template builder | "Let users define their own POS mapping templates for POS systems we don't support yet" | Exposes too much internal complexity to end users. Mapping templates require understanding of Treez import schema, which users should not need to know. | "Other/Generic" POS option with column-by-column manual mapping. Treez team can add new POS templates to the tool when new source POS systems are encountered. |

## Feature Dependencies

```
[File Upload & POS Detection]
    |
    v
[Column Mapping (auto + manual)]
    |   \
    |    \--> [Saved Mappings] (enhances, not required)
    |
    v
[Data Transformation (categories, weights, prices, brands)]
    |       \
    |        \--> [Price Tier Resolution] --requires--> [Treez API Auth]
    |
    v
[Validation & Error Handling]
    |       \
    |        \--> [Bulk Error Resolution] (enhances)
    |        \--> [Duplicate Detection] (enhances)
    |
    v
[Pre-Import Dry Run Summary]
    |
    v
[Generate Treez Import CSVs]
    |
    v
[Upload to S3 + Progress Tracking]


[Backend State Persistence] --enables--> [Resume Migrations]
                            --enables--> [Admin Dashboard]
                            --enables--> [Migration History]
                            --enables--> [Source File Storage]

[Catalog Migration] --must precede--> [Inventory Migration]
    (products/brands/categories          (quantities/costs reference
     must exist in Treez first)           Treez product IDs)

[Treez API Auth] --required by--> [Price Tier Resolution]
                 --required by--> [Store List Fetch]
                 --required by--> [Brand Matching]
                 --required by--> [Presigned URL Generation]

[Admin Dashboard] --conflicts with--> [Chrome Extension Only]
    (Dashboard should be a web app, not embedded in the extension)
```

### Dependency Notes

- **Column Mapping requires POS Detection:** Auto-mapping templates are keyed by POS system. Without detection, mapping falls back to fully manual.
- **Price Tier Resolution requires Treez API Auth:** Must call Treez pricing API to fetch existing tiers. Auth comes from Treez session token in the browser.
- **Inventory Migration requires Catalog Migration:** You cannot import inventory quantities for products that do not yet exist in Treez. Catalog import must be confirmed complete before inventory migration begins.
- **Admin Dashboard conflicts with Chrome Extension Only:** The admin dashboard is for Treez internal staff monitoring all orgs. It should be a standalone web app or integrated into the Treez admin panel, not part of the Chrome extension. Plan as a separate deliverable.
- **Bulk Error Resolution enhances Validation:** Validation works without bulk resolution (users fix one-by-one), but bulk resolution is what makes validation tolerable for large catalogs (1000+ products).

## MVP Definition

### Launch With (v1 - Internal Treez Team Use)

Minimum viable product for Treez onboarding team to use instead of manual CSV wrangling.

- [ ] CSV/XLSX file upload with POS auto-detection (Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova) -- core entry point
- [ ] Smart column mapping with auto-mapping + manual override -- eliminates the most tedious manual step
- [ ] Data transformation: category, weight, brand, classification normalization -- produces Treez-compatible data
- [ ] Row-level validation with grouped errors -- catches problems before import
- [ ] Per-row error fixing in the UI -- minimum viable error correction
- [ ] Generate Treez-formatted import CSVs (brands, attributes, products, variants, attribute joins) -- the deliverable
- [ ] Upload to S3 via presigned URLs -- delivers to Treez import pipeline
- [ ] Backend state persistence + source file storage -- migrations survive browser closes
- [ ] Treez session token auth (piggyback on existing Treez login) -- no separate auth needed

### Add After Validation (v1.x - Before Dispensary Self-Service)

Features to add once the Treez team has used the tool for several successful migrations.

- [ ] Inventory migration wizard (store selection, quantity/cost import) -- add once catalog flow is proven solid
- [ ] Saved column mappings per org/POS combo -- add once team reports doing repeated migrations for same chain
- [ ] Bulk error resolution ("apply fix to all similar") -- add once validation proves useful but tedious for large files
- [ ] Pre-import dry run summary -- add once team wants more confidence before clicking import
- [ ] Import progress tracking with ETA -- add once imports are working reliably
- [ ] Image URL migration -- add once core product data flow is stable
- [ ] Resume interrupted migrations -- add once backend persistence is working

### Future Consideration (v2+ - Self-Service & Admin)

Features to defer until the tool is proven for internal use and ready for dispensary-facing deployment.

- [ ] Admin dashboard for Treez team -- defer until there are enough migrations to warrant monitoring; build as web app, not in extension
- [ ] Migration history and audit trail -- defer until compliance or debugging needs justify it
- [ ] Duplicate detection with merge strategies -- defer until real-world data reveals how common duplicates are
- [ ] Price tier creation (not just resolution) -- defer until the create-tier API is available and understood
- [ ] Generic "Other" POS support with fully manual mapping -- defer until demand from non-supported POS systems emerges

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CSV/XLSX upload + POS detection | HIGH | LOW | P1 |
| Smart column auto-mapping | HIGH | MEDIUM | P1 |
| Manual mapping override | HIGH | LOW | P1 |
| Category normalization | HIGH | MEDIUM | P1 |
| Weight/unit standardization | HIGH | MEDIUM | P1 |
| Brand normalization | HIGH | MEDIUM | P1 |
| Row-level validation + grouped errors | HIGH | MEDIUM | P1 |
| Per-row error fixing | HIGH | HIGH | P1 |
| Generate Treez import CSVs | HIGH | HIGH | P1 |
| S3 upload via presigned URLs | HIGH | MEDIUM | P1 |
| Backend state persistence | HIGH | HIGH | P1 |
| Source file storage | MEDIUM | MEDIUM | P1 |
| Treez API auth (session token) | HIGH | LOW | P1 |
| Price tier resolution | HIGH | HIGH | P1 |
| Store selection for inventory | HIGH | LOW | P2 |
| Inventory quantity import | HIGH | MEDIUM | P2 |
| Inventory cost import | MEDIUM | LOW | P2 |
| Saved mappings per org/POS | MEDIUM | LOW | P2 |
| Bulk error resolution | HIGH | MEDIUM | P2 |
| Pre-import dry run summary | MEDIUM | MEDIUM | P2 |
| Import progress tracking | MEDIUM | MEDIUM | P2 |
| Image URL migration | MEDIUM | MEDIUM | P2 |
| Resume interrupted migrations | MEDIUM | LOW | P2 |
| Classification mapping | LOW | LOW | P2 |
| Admin dashboard | MEDIUM | HIGH | P3 |
| Migration history/audit trail | LOW | LOW | P3 |
| Duplicate detection | MEDIUM | MEDIUM | P3 |
| Generic "Other" POS support | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for internal launch (Treez team use)
- P2: Should have for dispensary self-service release
- P3: Nice to have, build when justified by usage patterns

## Competitor Feature Analysis

This tool does not have direct competitors -- it is an internal tool for Treez onboarding. However, the "competitors" are the current manual process and general-purpose data import tools.

| Feature | Manual Process (Current) | Generic CSV Importers (Flatfile/Dromo) | This Tool (Target) |
|---------|--------------------------|---------------------------------------|---------------------|
| POS-aware auto-mapping | None -- Treez staff manually maps columns in spreadsheets | None -- generic column matching, no POS awareness | Built-in POS signatures for 6 cannabis POS systems |
| Cannabis-specific transforms | Manual -- staff knows the normalization rules and applies them in Excel | None -- no domain knowledge | Automated category, weight, brand normalization with cannabis-specific rules |
| Treez import format generation | Manual -- staff builds import CSVs by hand following Treez spec | Not applicable | Automated generation of all 6+ Treez import CSV types |
| Validation against Treez schema | Manual -- errors discovered after import attempt, then fixed and re-tried | Generic type checking only | Pre-import validation against Treez-specific rules including API-based checks (price tiers, brands) |
| State persistence | Email chains with CSV attachments | SaaS -- cloud hosted | Backend service with full migration state |
| Cost to Treez | Hours of engineering/onboarding staff time per migration | $200-500k+/year SaaS licensing | One-time build cost, then self-service |
| Self-service capable | No -- requires Treez staff | Possibly, but no cannabis/Treez domain knowledge | Yes -- wizard guides dispensary staff through entire process |

## Sources

- [Treez POS Migration Page](https://www.treez.io/migrate-your-pos) -- Treez's current migration offering and promises
- [Cova: Switching Dispensary POS Guide](https://www.covasoftware.com/blog/switching-dispensary-pos-how-to-plan-and-execute-a-seamless-pos-migration) -- Cannabis POS migration challenges
- [Blaze: What to Expect When Switching POS](https://www.blaze.me/blog/dispensary-tips/what-to-expect-when-switching-to-a-new-cannabis-pos-system/) -- Competitor migration process
- [Dutchie: Switching Cannabis POS Systems](https://business.dutchie.com/content-hub/article/switching-cannabis-pos-systems-a-guide-for-dispensaries) -- Competitor migration process
- [DataFlowMapper: Mastering Data Validation](https://dataflowmapper.com/blog/mastering-data-validation-imports) -- Validation best practices
- [CSVBox Features](https://csvbox.io/features) -- Embedded CSV importer feature patterns
- [Dromo vs Flatfile vs OneSchema](https://dromo.io/blog/dromo-vs-flatfile-vs-oneschema-a-comprehensive-comparison) -- CSV import tool landscape
- [Tillpoint: POS Migration Best Practices](https://www.tillpoint.com/best-practices-for-pos-system-data-migration/) -- General POS migration patterns
- [Lightspeed: Migrating Inventory](https://retail-support.lightspeedhq.com/hc/en-us/articles/360036153334-Migrating-inventory-from-your-previous-POS) -- Inventory migration patterns

---
*Feature research for: Cannabis POS Data Migration Tool*
*Researched: 2026-03-09*
