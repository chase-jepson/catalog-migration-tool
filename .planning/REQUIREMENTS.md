# Requirements: Catalog Migration Tool v2

**Defined:** 2026-03-09
**Core Value:** Users can self-service their entire POS migration -- catalog and inventory -- without needing Treez engineering support.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### File Handling

- [x] **FILE-01**: User can upload CSV or XLSX files via drag-and-drop or file picker
- [x] **FILE-02**: Tool auto-detects POS system from file column headers (Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova)
- [x] **FILE-03**: User can manually select POS system if auto-detection fails
- [x] **FILE-04**: Tool handles large files (10k+ rows) without crashing or freezing

### Column Mapping

- [x] **MAP-01**: Tool auto-maps source columns to Treez fields using POS-specific templates
- [x] **MAP-02**: User can manually override any column mapping via dropdown
- ~~**MAP-03**: Column mappings are saved per org/POS combo and reused on subsequent uploads~~ → v2

### Data Transformation

- [x] **XFRM-01**: Tool normalizes source categories to Treez category taxonomy
- [x] **XFRM-02**: Tool standardizes weight/unit values (g, mg, oz, each) to Treez-expected formats
- [x] **XFRM-03**: Tool normalizes classification values (Indica, Sativa, Hybrid, I/S, S/I, CBD)

### Validation

- [x] **VAL-01**: Tool validates each row against Treez import schema and shows specific error messages
- [x] **VAL-02**: Errors are grouped by type with affected row counts
- [x] **VAL-03**: User can fix errors inline per-row in the review UI

### Import

- [x] **IMP-01**: Tool generates Treez-formatted import CSVs (brands, attributes, products, variants, attribute joins, images)
- [x] **IMP-02**: Tool uploads generated CSVs to S3 via presigned URLs from Treez API
- [x] **IMP-03**: Tool tracks upload and import progress with ETA display

### ~~Backend Persistence~~ (Moved to v2)

- ~~**BACK-01**: Backend service persists full migration state~~ → v2
- ~~**BACK-02**: User can resume an interrupted migration from where they left off~~ → v2
- ~~**BACK-03**: Backend stores uploaded source files for debugging and re-processing~~ → v2

### Inventory Migration

- [ ] **INV-01**: User can select a specific store for inventory import (inventory is per-store)
- [ ] **INV-02**: Tool imports inventory quantities mapped to Treez product IDs
- [ ] **INV-03**: Tool imports cost/wholesale price data per store

### Extension Infrastructure

- [x] **EXT-01**: Chrome extension injects "Migrate Products" button on Treez Catalog module pages
- [x] **EXT-02**: Extension authenticates using Treez session tokens (no separate login)
- [x] **EXT-03**: Extension works across Treez environments (production, sandbox, dev)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Backend Persistence

- **BACK-01**: Backend service persists full migration state (step, mappings, validation results, import status)
- **BACK-02**: User can resume an interrupted migration from where they left off
- **BACK-03**: Backend stores uploaded source files for debugging and re-processing
- **MAP-03**: Column mappings are saved per org/POS combo and reused on subsequent uploads

### Admin & Monitoring

- **ADMIN-01**: Treez team can view all in-flight migrations across organizations in a web dashboard
- **ADMIN-02**: Dashboard shows migration status, errors, and bottlenecks per org
- **ADMIN-03**: Migration history and audit trail with timestamps and user identity

### Enhanced Features

- **ENH-01**: Bulk error resolution -- apply fix to all rows with same error type
- **ENH-02**: Duplicate detection with merge strategies
- **ENH-03**: Pre-import dry run summary showing entity counts before import
- **ENH-04**: Multiple file upload per migration (for POS systems that split exports)
- **ENH-05**: Brand normalization with fuzzy matching against existing Treez brands
- **ENH-06**: Price tier resolution via Treez API
- **ENH-07**: Mapping preview with sample data alongside mapping UI
- **ENH-08**: Image URL migration from source POS CDNs

## Out of Scope

| Feature | Reason |
|---------|--------|
| Direct POS API integration | CSV/XLSX is universal; maintaining 6+ API integrations is ongoing cost |
| Real-time two-way sync | Integration product, not migration tool; massive scope increase |
| Rollback/undo of imports | Treez pipeline is append-oriented; conflicts with METRC compliance |
| Transaction/sales history migration | Different schemas, massive volume, doesn't integrate with Treez analytics |
| Customer/patient data migration | PII/HIPAA concerns, separate domain, scope creep risk |
| Mobile/tablet support | Chrome Extension is desktop-only; migrations are back-office tasks |
| Custom POS template builder | Exposes too much complexity; use "Other" with manual mapping instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXT-01 | Phase 1 | Complete |
| EXT-02 | Phase 1 | Complete |
| EXT-03 | Phase 1 | Complete |
| FILE-01 | Phase 2 | Complete |
| FILE-02 | Phase 2 | Complete |
| FILE-03 | Phase 2 | Complete |
| FILE-04 | Phase 2 | Complete |
| MAP-01 | Phase 2 | Complete |
| MAP-02 | Phase 2 | Complete |
| XFRM-01 | Phase 3 | Complete |
| XFRM-02 | Phase 3 | Complete |
| XFRM-03 | Phase 3 | Complete |
| VAL-01 | Phase 3 | Complete |
| VAL-02 | Phase 3 | Complete |
| VAL-03 | Phase 3 | Complete |
| IMP-01 | Phase 3 | Complete |
| IMP-02 | Phase 3 | Complete |
| IMP-03 | Phase 3 | Complete |
| BACK-01 | v2 | Deferred |
| BACK-02 | v2 | Deferred |
| BACK-03 | v2 | Deferred |
| MAP-03 | v2 | Deferred |
| INV-01 | Phase 4 | Pending |
| INV-02 | Phase 4 | Pending |
| INV-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 21 total (4 deferred to v2: BACK-01/02/03, MAP-03)
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
