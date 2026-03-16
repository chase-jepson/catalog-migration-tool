# Catalog Migration Guide

This guide walks you through migrating your product catalog from another POS system into Treez.

## Before You Start

1. **Export your catalog** from your current POS system as a CSV or XLSX file. See [Supported POS Systems](supported-pos-systems.md) for export instructions per POS.
2. **Log into Treez** in the same Chrome browser where the extension is installed.
3. Navigate to the **Treez import page** (e.g., `app.treez.io/treez-admin/import/home`).

## Step 1: Upload

1. Click the **Migrate Catalog** button on the Treez import page.
2. A wizard drawer opens on the right side of the screen.
3. **Drag and drop** your CSV or XLSX file onto the drop zone, or click to browse.
4. The tool parses your file and attempts to **auto-detect your POS system** from the column headers.
5. If auto-detection is wrong or shows "Unknown", use the dropdown to **manually select** your POS system.
6. If your file has multiple sheets (XLSX), select the sheet containing your product data.

**What the tool checks:**
- File format is CSV or XLSX
- File size is under 100 MB
- Column headers are present in the first row

Click **Next** when your file is parsed and POS system is selected.

## Step 2: Map

The mapping step shows your source columns on the left and Treez target fields on the right.

1. **Auto-mapped fields** are pre-populated based on your POS system. These are highlighted and ready to go.
2. **Unmapped fields** show "-- Select column --". Use the dropdown to pick the correct source column.
3. **Required fields** are marked and must be mapped before proceeding:
   - Product Name
   - Product Category
   - Weight / Amount
   - Price

**Tips:**
- Fields are grouped by category: Product Info, Cannabis Details, Pricing, Attributes, Display & Media
- You can search the column dropdown by typing
- If your source doesn't have a particular field, leave it unmapped -- the tool handles missing optional fields gracefully

Click **Next** when all required fields are mapped.

## Step 3: Review

The review step transforms and validates every row of your data.

1. **Transformation** happens automatically:
   - Source categories are normalized to Treez categories (e.g., "Vape Cartridge" becomes "Cartridge")
   - Weights are standardized (e.g., "500mg" becomes "0.5" in grams for applicable categories)
   - Classifications are normalized (e.g., "indica dominant" becomes "Indica")

2. **Validation errors** are grouped by type with affected row counts:
   - **Errors** (red) must be fixed before import
   - **Warnings** (yellow) are informational -- import can proceed

3. **Fixing errors:**
   - Click on an error group to see affected rows
   - Edit values inline in the table
   - Fixed rows are re-validated automatically

Click **Next** when all errors are resolved (or only warnings remain).

## Step 4: Import

The import step generates your Treez-compatible files and uploads them.

1. The tool generates **6 CSV files**:
   - `brands.csv` -- Brand definitions
   - `attributes.csv` -- Attribute definitions
   - `products.csv` -- Product records
   - `variants.csv` -- Variant records with pricing
   - `attribute_joins.csv` -- Product-attribute associations
   - `images.csv` -- Image URL references

2. Files are **uploaded to S3** via presigned URLs from the Treez API.

3. **Progress tracking** shows:
   - Per-file upload status
   - Overall import progress with ETA
   - Any upload errors

4. Once complete, you can **download a ZIP** of all generated CSVs for your records.

5. Click **Start New Migration** to begin another migration, or **Done** to close the wizard.

## After Import

The uploaded CSVs are processed asynchronously by the Treez import pipeline. Processing time depends on the number of products. You can check import status in the Treez admin UI.

## Tips for Best Results

- **Clean your data first**: Remove duplicate rows, fix obvious typos in product names
- **Check your categories**: Review the category mapping in the Review step -- incorrect categories cause the most import issues
- **Start with a small test**: Try a file with 10-20 products first to verify mappings before importing your full catalog
- **Use Sandbox first**: Test in the sandbox environment before importing to production
