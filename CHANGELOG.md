# Changelog

All notable changes to the Catalog Migration Tool will be documented in this file.

## [0.2.1] - 2026-03-16

### Added

- MIT license
- CI/CD pipeline (`.gitlab-ci.yml`) — runs tests and builds on every MR and push to main, auto-creates releases on version tags
- Merge request template with review checklist
- Contributing guide (`CONTRIBUTING.md`)
- TypeScript type checking (`pnpm typecheck`) in CI build pipeline
- Cross-platform `pnpm-lock.yaml` (macOS + Linux) via `.npmrc`
- `@types/chrome` for extension API type safety
- Node.js `>=20` engine requirement in `package.json`
- Git tag `v0.0.1` for initial release

### Fixed

- TypeScript errors: missing `PortalValidationIssue` type, implicit `any` on import job polling
- README download link now points to Releases page (version-agnostic)
- README prerequisite updated from Node 18+ to Node 20+

### Removed

- `.planning/` directory (development artifacts, not needed in repo)

## [0.0.1] - 2026-03-16

### Added

- Chrome extension shell with Treez page detection and session token authentication
- Support for production, sandbox, and dev Treez environments
- CSV/XLSX file upload with drag-and-drop and file picker
- Auto-detection of POS system from column headers (Dutchie, Blaze, Flowhub, IndicaOnline, Meadow, Cova)
- Smart column mapping with POS-specific templates and manual override
- Data transformation: category normalization, weight standardization, classification mapping
- Row-level validation with grouped errors and inline fix controls
- Treez-formatted CSV generation (brands, attributes, products, variants, attribute joins, images)
- S3 upload via presigned URLs with progress tracking
- Inventory migration: store selection, multi-file ETL pipeline (inventory, receipts, vendors, adjustments, catalog export)
- 56-column inventory CSV generation with invoice reconstruction and distributor enrichment
- State persistence via chrome.storage.local
- In-extension "Report an issue" link

### Known Limitations

- Extension-only (no backend persistence) -- migrations don't survive browser close
- Column mappings are not saved between sessions
- Chrome only (Manifest V3)
