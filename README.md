# Catalog Migration Tool

A Chrome extension that guides cannabis retailers through migrating product catalog and inventory data from any point-of-sale system into [Treez](https://www.treez.io). It lives inside the Treez Catalog module and supports the full migration lifecycle: **Upload > Map > Review > Import**.

## Who is this for?

- **Treez team members** onboarding new dispensaries
- **Dispensary operators** self-servicing their POS migration into Treez

## Supported POS Systems

Auto-detection and smart column mapping for:

| POS System | Auto-detect | Column Mapping |
|------------|:-----------:|:--------------:|
| Dutchie | Yes | Yes |
| Blaze | Yes | Yes |
| Flowhub | Yes | Yes |
| IndicaOnline | Yes | Yes |
| Meadow | Yes | Yes |
| Cova | Yes | Yes |
| Other / Manual | -- | Manual mapping |

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or npm)
- Google Chrome

### Install & Build

```bash
git clone https://gitlab.com/chase_jepson/catalog-migration-tool-v2.git
cd catalog-migration-tool-v2
pnpm install
pnpm build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3/` directory from the build output

### Use

1. Navigate to the Treez import page (`app.treez.io/treez-admin/import/home`)
2. Click **Migrate Catalog** or **Migrate Inventory**
3. Follow the wizard: Upload your file > Map columns > Review & fix errors > Import

## Migration Types

### Catalog Migration

Migrates products, brands, categories, attributes, and pricing. Generates 6 Treez-compatible CSV files (brands, attributes, products, variants, attribute joins, images) and uploads them to S3.

### Inventory Migration

Migrates per-store inventory quantities with invoice reconstruction. Supports up to 5 input files (inventory, receipts, vendors, adjustments, catalog export) joined into a single 56-column Treez inventory CSV.

## Documentation

See the [full documentation](docs/README.md) for detailed guides:

- [Installation](docs/installation.md)
- [Catalog Migration Guide](docs/catalog-migration.md)
- [Inventory Migration Guide](docs/inventory-migration.md)
- [Supported POS Systems](docs/supported-pos-systems.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Reporting Issues](docs/reporting-issues.md)

## Reporting Issues

Found a bug or have a feature request? [Open an issue](https://gitlab.com/chase_jepson/catalog-migration-tool-v2/-/issues/new).

- [Bug Report template](https://gitlab.com/chase_jepson/catalog-migration-tool-v2/-/issues/new?issuable_template=Bug%20Report)
- [Feature Request template](https://gitlab.com/chase_jepson/catalog-migration-tool-v2/-/issues/new?issuable_template=Feature%20Request)

## Development

```bash
pnpm dev        # Dev server with hot reload
pnpm test       # Run tests
pnpm test:watch # Watch mode
pnpm build      # Production build
pnpm zip        # Generate installable ZIP
```

## Tech Stack

- [WXT](https://wxt.dev) (Chrome Extension framework, Manifest V3)
- React 19 + TypeScript
- Tailwind CSS 4
- SheetJS (XLSX parsing)
- JSZip + FileSaver (CSV bundling)
- Vitest (testing)
