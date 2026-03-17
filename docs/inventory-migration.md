# Inventory Migration Guide

This guide walks you through migrating per-store inventory data from another POS system into Treez. Inventory migration is more complex than catalog migration because it involves multiple input files and per-store data.

## Before You Start

1. **Complete your catalog migration first.** Inventory records reference products that must already exist in Treez.
2. **Export your inventory data** from your current POS. You may need multiple files:
   - **Inventory file** (required) -- current stock quantities per product
   - **Receipts file** (optional) -- purchase/receiving history for invoice reconstruction
   - **Vendors file** (optional) -- distributor/vendor information for enrichment
   - **Adjustments file** (optional) -- inventory adjustment history
   - **Catalog export from Treez** (optional) -- for product ID matching
3. **Log into Treez** and navigate to the import page.

## Step 1: Upload

1. Click the **Migrate Inventory** button on the Treez import page.
2. **Select a store** from the dropdown at the top. Inventory is per-store in Treez, so you must choose which store to import into.
3. Upload your files and **assign roles** to each file:
   - `inventory` -- your main inventory/stock file
   - `receipts` -- purchase order or receiving records
   - `vendors` -- vendor/distributor list
   - `adjustments` -- inventory adjustment records
   - `catalog_export` -- Treez catalog export for product matching
4. Only the `inventory` file is required. Other files enhance the output with invoice reconstruction, distributor data, and quantity corrections.
5. Enter your **dispensary license number** (used in the import CSV).
6. Select or confirm your **POS system** for auto-mapping.

Click **Next** when all files are uploaded and assigned.

## Step 2: Map

Column mapping works per file role. Each uploaded file gets its own mapping section.

1. **Inventory file mappings** cover quantity, cost, product identifiers
2. **Receipt file mappings** cover invoice numbers, quantities received, dates
3. **Vendor file mappings** cover distributor name, license, contact info (32 columns)
4. **Adjustment file mappings** cover adjustment quantities and reasons

Auto-mapping applies POS-specific defaults for each role. Override any mapping using the dropdown.

Click **Next** when all required fields across all roles are mapped.

## Step 3: Review

The ETL pipeline processes your files:

1. **Join** -- Inventory records are enriched with receipt, vendor, and adjustment data by matching on product identifiers
2. **Invoice reconstruction** -- Receipt quantities are combined with adjustment quantities to produce corrected totals
3. **Distributor enrichment** -- Vendor data populates 32 distributor-related columns
4. **Validation** -- Each row is checked against the 56-column Treez inventory schema
5. **Graceful degradation** -- Missing optional files simply leave those columns empty

Review errors and fix them inline, just like catalog migration.

Click **Next** when validation passes.

## Step 4: Import

The tool generates a single **56-column inventory CSV** and uploads it to S3. The Treez import pipeline processes it for the selected store.

## Key Differences from Catalog Migration

| Aspect        | Catalog           | Inventory                                 |
| ------------- | ----------------- | ----------------------------------------- |
| Scope         | Organization-wide | Per-store                                 |
| Input files   | 1 file            | Up to 5 files                             |
| Output files  | 6 CSVs            | 1 CSV (56 columns)                        |
| Prerequisites | None              | Catalog must exist in Treez               |
| Invoice data  | N/A               | Reconstructed from receipts + adjustments |

## Tips

- **Start with one store**: Migrate inventory for a single store first to verify the process, then repeat for other stores
- **Include receipts if possible**: Invoice reconstruction produces much better data than inventory quantities alone
- **Vendor file is optional but valuable**: Distributor enrichment fills in 32 columns that would otherwise be empty
- **Check product matching**: The review step shows which products matched to Treez catalog entries and which didn't
