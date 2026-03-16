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

## Download & Install

1. Download the latest ZIP from the [Releases page](https://gitlab.com/chase_jepson/catalog-migration-tool-v2/-/releases)
2. Unzip the downloaded file
3. Open `chrome://extensions/` in Chrome and enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the unzipped folder
5. Navigate to `app.treez.io/treez-admin/import/home` -- you should see **Migrate Catalog** and **Migrate Inventory** buttons
6. Click either button and follow the wizard: Upload your file > Map columns > Review & fix errors > Import

> **Note:** You must be logged into Treez in the same browser. The extension uses your existing session -- no separate login needed.

## Build from Source

If you prefer to build from source (or want to contribute):

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

Then load `.output/chrome-mv3/` as an unpacked extension (same steps 3-4 above).

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
