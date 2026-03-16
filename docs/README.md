# Catalog Migration Tool -- Documentation

Welcome to the Catalog Migration Tool wiki. This extension helps you migrate product catalog and inventory data from any POS system into Treez.

## Guides

| Guide | Description |
|-------|-------------|
| [Installation](installation.md) | Prerequisites, building, loading the extension |
| [Catalog Migration](catalog-migration.md) | Step-by-step catalog migration walkthrough |
| [Inventory Migration](inventory-migration.md) | Step-by-step inventory migration walkthrough |
| [Supported POS Systems](supported-pos-systems.md) | Per-POS export instructions and auto-mapping details |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |
| [Reporting Issues](reporting-issues.md) | How to file bug reports and feature requests |

## How It Works

The tool operates as a Chrome extension that injects itself into the Treez import page. It authenticates using your existing Treez session -- no separate login required.

Both catalog and inventory migrations follow the same four-step wizard:

1. **Upload** -- Drop your POS export file(s). The tool auto-detects your POS system.
2. **Map** -- Review column mappings between your source data and Treez fields. Adjust as needed.
3. **Review** -- Validate your data. Fix errors inline before importing.
4. **Import** -- Generate Treez-formatted CSVs and upload to S3 for processing.

## Quick Links

- [Source code](https://gitlab.com/chase_jepson/catalog-migration-tool-v2)
- [Report a bug](https://gitlab.com/chase_jepson/catalog-migration-tool-v2/-/issues/new?issuable_template=Bug%20Report)
- [Request a feature](https://gitlab.com/chase_jepson/catalog-migration-tool-v2/-/issues/new?issuable_template=Feature%20Request)
