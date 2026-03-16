# Inventory Migration ETL Specification

**Created:** 2026-03-09
**Source:** Dutchie Parabola pipeline (most complete POS case)
**Status:** Spec captured, needs replanning

## Overview

The inventory import is NOT a simple quantity-per-product pass-through. It reconstructs **complete invoices** in Treez with full distributor, location, compliance, and potency data. The output is a **56-column CSV** produced by joining 4 input files.

## Input Files (Dutchie)

### 1. Inventory Export (CSV)
- **File:** `2026-02-11-Inventory.csv` (~1,681 rows)
- **Key columns:** SKU, Product, Package ID, External package ID, Room, Available, Cost, Category, THC, CBD, Expiration date, Packaging date, Harvest date, Available for, Quantity (including allocated), Vendor
- **Header row:** Row 1

### 2. Inventory Receipt Report (XLSX)
- **File:** `Inventory Receipt Report - Detail *.xlsx` (~18,213 rows)
- **Key columns:** Location Name, Product SKU, Product Name, External Package ID, Receive Date, Quantity, Unit Cost, Vendor Name, Order Title, Order Id
- **Header row:** Row 5 (rows 1-4 are metadata: Export Date, From Date, To Date, Location)
- **This is the invoice/receipt data** — one row per package received

### 3. Vendors Export (CSV)
- **File:** `2026-02-06-Vendors.csv` (~261 rows)
- **Key columns:** Vendor ID, Vendor name, Vendor code, Address, City, State, Postal code, Contact name, Contact email, Contact phone, Vendor type ID
- **Header row:** Row 1

### 4. Inventory Adjustments (XLSX) — joins into receipt report pipeline
- **File:** `Inventory Adjustments - Adjust *.xlsx` (~7,932 rows)
- **Key columns:** Location, TransactionDate, Action, Product, Category, BatchID, SerialNumber, Cost, qty, reason
- **Header row:** Row 5 (rows 1-4 are metadata)
- **Role:** Summed by External Package ID, stacked with receipt totals, and re-summed to produce corrected Quantity/Total Cost per package (which feeds into Unit Cost calculation)

## Output Format

**56-column CSV** — `CS Tool - Inventory Import.csv` (~3,472 data rows)

### Output Columns (exact order)
```
1.  TreezVariantId            — empty (filled by Treez on import)
2.  VariantReferenceId        — "V-{Product SKU}"
3.  Dispensary License         — hardcoded per dispensary (e.g., "C12-0000331-LIC")
4.  Invoice ID                — "{extracted from Order Title} - {Receive Date} - {Distributor Name}"
5.  Invoice Created Date      — Receive Date (reformatted yyyy-MM-dd)
6.  Manifest Number           — empty
7.  TraceTreezId              — External Package ID (or "{External Package ID}-{Row Number}" for Merch)
8.  Inventory Barcode(s)      — External Package ID (empty for Merch)
9.  Original Unit Count       — Quantity from receipt
10. Units                     — Quantity (including allocated) from inventory; blank → 0
11. Unit Cost                 — from receipt report
12. Harvest Date              — from inventory export (reformatted yyyy-MM-dd)
13. Expiration Date           — from inventory export (reformatted yyyy-MM-dd)
14. Packaged Date             — from inventory export (reformatted yyyy-MM-dd)
15. Customer Type             — derived: "ADULT" if Available for contains "All enabled customer types" or "Adult" or blank; else "MEDICAL"
16. THC Amount                — split from THC column (numeric part); cleaned of "mg/g", "0.00 mg", "0.00 %"
17. THC UoM                   — split from THC column (unit part: "%", "mg")
18. CBD Amount                — split from CBD column (numeric part); same cleaning
19. CBD UoM                   — split from CBD column (unit part)
20. Location Path             — derived from Room: Sales Floor → "Front of House, Sales Floor"; Back Stock/Budtender Vault/Promo/Display → "Back of House, {Room}"; Waste → "Quarantine"; else empty
21. Location Inventory Type   — "Medical" if Customer Type = "Medical"; else "All Types"
22. Location Is Sellable      — "TRUE" if Location Path contains "Front of House"; else "FALSE"
23. Location Default Receiving Location — "TRUE" if Location Path = "Back of House, Back Stock"; else "FALSE"
24-55. Distributor fields (32 columns):
    24. Distributor Name
    25. Distributor DBA
    26. Distributor Address
    27. Distributor Phone Number
    28. Distributor Email
    29. Distributor Type
    30. Distributor Default Payment Term
    31. Distributor Lead Time
    32. Distributor Delivery Days
    33. Distributor Preferred Payment Method
    34-36. Distributor License 1 (Type, Number, Expiration Date)
    37-39. Distributor License 2 (Type, Number, Expiration Date)
    40-42. Distributor License 3 (Type, Number, Expiration Date)
    43-47. Distributor Representative 1 (Name, Phone, Email, Role, Notes)
    48-52. Distributor Representative 2 (Name, Phone, Email, Role, Notes)
    53-57. Distributor Representative 3 (Name, Phone, Email, Role, Notes)
```

## ETL Pipeline (Join Chain)

### Phase A: Invoice/Receipt Processing

**Two parallel sub-pipelines that merge:**

**A1: Corrected totals (receipts + adjustments)**
1. **Parse Receipt Report** — skip metadata rows (1-4), headers at row 5
2. **Edit columns (Receipt subset)** — keep: Product SKU, External Package ID, Receive Date, Quantity, Total Cost, Vendor Name, Order Title
3. **Sum by group (Receipts)** — group by [Product SKU, Receive Date, External Package ID, Vendor Name, Order Title] → sum Quantity, Total Cost
4. **Parse Adjustments** — skip metadata rows (1-4), headers at row 5
5. **Sum by group (Adjustments)** — group by External Package ID → sum Quantity, Total Cost
6. **Stack tables** — append adjustment totals onto receipt totals
7. **Sum by group (Invoice Quantity + Adjustments)** — re-sum by External Package ID → combined Quantity, Total Cost

**A2: Descriptive invoice rows**
1. **Edit columns (Invoice Info)** — from Receipt Report, keep descriptive fields: External Package ID, Receive Date, Vendor Name, Order Title, Product SKU

**A3: Merge and enrich**
1. **Combine tables** — LEFT join: Invoice Info (left, descriptive) + Combined Totals (right, corrected Quantity/Total Cost) on External Package ID
2. **Calculate Unit Cost** — `round(Total Cost / Quantity, 2)`
3. **Extract Invoice ID** — from Order Title, extract everything after the last " - ". If blank, use full Order Title as Invoice ID.
4. **Build Invoice ID - Date** — concatenate: `"{Invoice ID} - {Receive Date} - {Distributor Name}"` (Distributor Name = Vendor Name, renamed in Edit columns)
5. **Active Invoice ID filter** (two-phase):
    - **Phase 1:** Find overlap between invoice External Package IDs and inventory External package IDs (exact match, case-sensitive) → extract unique Invoice IDs
    - **Phase 2:** Pull ALL invoice rows for those active Invoice IDs (even packages not currently in inventory)
    - **Phase 3:** Filter out rows where Quantity = 0

### Phase B: Vendor/Distributor Processing
1. **Parse Vendors CSV**
2. **Build Distributor Address** — concatenate: Address, City, State, Postal code
3. **Distributor Info (text merge)** — create all 32 distributor columns in one step:
   - **Mapped from Dutchie:**
     - Vendor name → Distributor Name
     - Abbreviation → Distributor DBA
     - Contact phone → Distributor Phone Number
     - Contact email → Distributor Email
     - Vendor code / Vendor code (1) / Vendor code (2) → Distributor License 1/2/3 Number
     - Built Address → Distributor Address
   - **Constants:**
     - Distributor Type → "Non-Arms Length"
     - Payment terms, lead time, delivery days, preferred payment method → empty
     - All 3 representative blocks (name/phone/email/role/notes × 3) → empty
4. **License Type enrichment** (3 If/Else steps):
   - If License 1 Number is not blank → License 1 Type = "Adult" (same for 2, 3)
5. **License Expiration enrichment**:
   - Generate "Today + 2 Years" date, format as yyyy-MM-dd
   - If License 1/2/3 Number exists → set corresponding Expiration Date to that value
6. **Edit columns (Distributor Data)** — select and order the final 32 distributor columns for the join

### Phase C: Inventory Processing
1. **Parse Inventory CSV**
2. **Clean THC/CBD** — find & replace: remove "mg/g" (substring), replace "0.00 mg" and "0.00 %" with empty
3. **Split THC** — split on space → THC (amount), THC (1) (UoM)
4. **Split CBD** — split on space → CBD (amount), CBD (1) (UoM)
5. **Derive Customer Type** — from "Available for" column:
   - Contains "All enabled customer types" or "Adult" → "ADULT"
   - Blank → "ADULT"
   - Else → "MEDICAL"
6. **Derive Location Path** — from "Room" column:
   - "Sales Floor" → "Front of House, Sales Floor"
   - "Back Stock", "Budtender Vault", "Promo", "Display" → "Back of House, {Room}"
   - "Waste" → "Quarantine"
   - Else → empty
7. **Derive Location Is Sellable** — "TRUE" if Location Path contains "Front of House", else "FALSE"
8. **Derive Location Default Receiving Location** — "TRUE" if Location Path = "Back of House, Back Stock", else "FALSE"
9. **Derive Location Inventory Type** — "Medical" if Customer Type = "Medical", else "All Types"
10. **Edit columns (Inventory Data)** — keep and rename:
    - Location Path, Location Is Sellable, Location Default Receiving Location
    - THC → THC Amount, THC (1) → THC UoM
    - CBD → CBD Amount, CBD (1) → CBD UoM
    - External package ID
    - Quantity (including allocated) → Units
    - Expiration date, Packaging date, Harvest date
    - Customer Type, Location Inventory Type

### Phase D: Join Chain
1. **Inv + Invoice** (FULL join on External Package ID)
2. **Inv + Distro Info** (LEFT join on Distributor Name)
3. **Inv + Catalog** (LEFT join on Product SKU = Product Key) — catalog table contributes **only Product Category** (used for Merch logic in TraceTreezId and Barcodes). Edit columns (Catalog Data) strips all other catalog fields before this join.

### Phase E: Final Enrichment
1. **Blank Units → 0** — replace empty Units with "0"
2. **Row Numbers** — partition by External Package ID, ascending, start at 1
3. **TraceTreezId** — if Category = "Merch": `"{External Package ID}-{Row Number}"`; else: External Package ID
4. **Inventory Barcodes** — if Category = "Merch": empty; else: External Package ID
5. **Format Dates** — convert all dates to yyyy-MM-dd:
   - Receive Date: from MM/dd/yyyy
   - Expiration date, Harvest date, Packaging date: from M/d/yyyy
6. **Add text columns**:
   - TreezVariantId: empty
   - VariantReferenceId: "V-{Product SKU}"
   - Dispensary License: hardcoded (user-provided per dispensary)
   - Invoice Created Date: copy of Receive Date
   - Manifest Number: empty
   - Original Unit Count: copy of Quantity
7. **Final column reorder** — 56 columns in exact order (see Output Columns above)

## POS Variability

- **Dutchie (this spec):** Most complete — 4 input files, full invoice reconstruction
- **Other POS systems:** May only provide inventory export + vendor export (no receipt/invoice data)
- **Tool must gracefully degrade:** When receipt data is unavailable, invoice-related output columns are empty
- **Each POS has different column names** — mapping step handles this per POS

## Key Design Implications

### Multi-file Upload
- UI must support uploading **multiple files** (up to 4 for Dutchie)
- Each file has a specific role (inventory, receipts, vendors, catalog)
- User needs to identify which file is which (or auto-detect from headers)

### XLSX Support with Metadata Rows
- Dutchie XLSX files have 4 metadata rows before the header row
- Parser needs to handle header-row offset (skip to row 5)

### Dispensary License
- User-provided text input in the UI
- Not derivable from export files or Treez account

### Distributor Fields
- Many of the 32 distributor columns will be null for most vendors
- Vendors CAN add license/rep data to their export if they choose
- UI should not require these fields

### Catalog Export (for join)
- This is a **Treez catalog export CSV** (post-catalog-migration data), uploaded by the user
- After Edit columns (Catalog Data), only 2 columns remain: **Product Key** and **Product Category**
- Product Key is the join key (matched to Product SKU from inventory/invoice data)
- Product Category is the only contributed field — used for Merch detection in TraceTreezId and Barcodes
- VariantReferenceId (`V-{Product SKU}`) is derived from the inventory/invoice Product SKU, not from the catalog join
- **Future:** Replace uploaded CSV with Treez catalog API lookup (variantId by variantReferenceId, which is the old POS product identifier)

### What 04-01 Already Handles (keep)
- Store API types and fetch logic
- Messaging protocol extensions (fetchStores)
- Inventory persistence store (needs expanded state shape)
- Basic type definitions (need significant expansion)

### What 04-02 Built (throwaway)
- 5-field inventory-constants.ts → needs 56-field rewrite
- Simple inventory-transformer.ts → needs full ETL pipeline
- Simple inventory-validator.ts → needs rewrite for new data shape
- Simple inventory-csv-generator.ts → needs complete rewrite for 56 columns

### What 04-03 Planned (needs update)
- Single-file upload UI → multi-file upload UI
- Simple mapping step → multi-file mapping with file role identification
- Simple review → complex review with join results, match summary
- Single-file import → same (output is still one CSV)

## Sample Data Reference

Files at: `~/Downloads/CS Import Tool/Exports/`
- `2026-02-11-Inventory.csv` (1,681 rows, 66 columns)
- `Inventory Receipt Report - Detail 2_4_2020-2_11_2026.xlsx` (18,213 rows, 25 columns)
- `2026-02-06-Vendors.csv` (261 rows, 14 columns)
- `Inventory Adjustments - Adjust 2_4_2020-2_11_2026.xlsx` (7,932 rows, 17 columns)

Final output: `~/Downloads/CS Import Tool/CS Tool - Inventory Import.csv` (3,472 rows, 56 columns)
