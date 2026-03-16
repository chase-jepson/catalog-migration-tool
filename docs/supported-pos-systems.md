# Supported POS Systems

The tool auto-detects your POS system from column headers and applies system-specific default mappings. Below are details for each supported system.

## Dutchie

**Export format:** CSV or XLSX from Dutchie admin panel

**Auto-mapped columns:**

| Treez Field | Dutchie Column |
|------------|----------------|
| Product ID / SKU | SKU |
| Product Name | Product |
| Brand | Brand |
| Category | Category |
| External Category | External category |
| Status | Is retired |
| Strain | Strain |
| Classification | Strain Type |
| Weight | Product grams |
| Price | Price |
| Description | Alternate description |
| Menu Title | Online title |
| Available Online | Is available online |
| Image | Image URL |
| Tags | Tags |
| Flavor | Flavor |
| Ingredients | Ingredients |
| THC | THC content |
| CBD | CBD content |

**Notes:** Dutchie has the most complete auto-mapping coverage. The "Is retired" column maps to product status -- retired products are imported as inactive.

---

## Blaze

**Export format:** CSV from Blaze admin

**Auto-mapped columns:**

| Treez Field | Blaze Column |
|------------|--------------|
| Product ID / SKU | Product ID |
| Product Name | Item |
| Brand | Brand |
| Category | Category |
| Subcategory | Cannabis Type |
| Status | Active |
| Strain | Genetics |
| Classification | Type |
| Weight | Custom Weight Measurement |
| Price | Unit Price |
| Description | Description |
| Available Online | Available Online |
| Image | Image 1 |
| Tags | Tag |
| THC | Custom Weight Measurement |
| CBD | CBD % |

**Notes:** Blaze uses "Custom Weight Measurement" for both weight and THC -- you may need to manually adjust the THC mapping if your export has a separate THC column.

---

## Flowhub

**Export format:** CSV from Flowhub reporting

**Auto-mapped columns:**

| Treez Field | Flowhub Column |
|------------|----------------|
| Product ID / SKU | Product Id |
| Product Name | Product Name |
| Brand | Brand |
| Category | Category |
| Subcategory | Product Type |
| External Category | Variant Type |
| Weight | Weight / Volume |
| Price | Price |
| Description | Description |
| Variant ID | Variant Id |
| Price Tier | Price Profile |
| Price Type | Price Type |

**Notes:** Flowhub exports include variant-level data. The tool handles product/variant deduplication during transformation.

---

## IndicaOnline

**Export format:** CSV from IndicaOnline admin

**Auto-mapped columns:**

| Treez Field | IndicaOnline Column |
|------------|---------------------|
| Product ID / SKU | Product ID |
| Product Name | Product Name |
| Brand | Brand |
| Category | Parent Category |
| Subcategory | Sub-category (L2) |
| External Category | Sub-category (L3) |
| Strain | Strain Type |
| Classification | Strain Type |
| Weight | Net Weight |
| Price | Price per Unit |
| Tags | Tags |

**Notes:** IndicaOnline has a three-level category hierarchy (Parent > L2 > L3). The tool uses all three levels for category resolution.

---

## Meadow

**Export format:** CSV from Meadow admin

**Auto-mapped columns:**

| Treez Field | Meadow Column |
|------------|---------------|
| Product ID / SKU | ID |
| Product Name | Product Name |
| Brand | Brand |
| Category | Primary Category |
| Subcategory | Sub Categories |
| Status | Active |
| Strain | Strain Type |
| Classification | Strain Type |
| Weight | Cannabis Content |
| Price | Price |
| Description | Description |
| Available Online | Menu Status Online |
| THC | THC Content |
| CBD | CBD Content |

**Notes:** Meadow's "Cannabis Content" field contains weight data in mixed formats (e.g., "0.5g", "500mg"). The tool normalizes these during transformation.

---

## Cova

**Export format:** CSV or XLSX from Cova POS

**Auto-mapped columns:**

| Treez Field | Cova Column |
|------------|-------------|
| Product ID / SKU | Manufacturer SKU |
| Product Name | Model Name * |
| Brand | Brands |
| Category | Classification * |
| External Category | Reporting Category |
| Status | Product Status |
| Strain | Strain |
| Classification | Short Description |
| Weight | Net Weight |
| Price | Price |
| Description | Long Description |
| Image | Hero Shot URI |
| THC | THC Content |
| CBD | CBD % |

**Notes:** Cova uses "Classification *" for product category (not cannabis classification). The tool maps this correctly. Cannabis classification is derived from the "Short Description" field.

---

## Other / Manual Mapping

If your POS system isn't listed above, select **"Other"** during the upload step. No auto-mapping is applied -- you'll need to manually map each column in the Map step.

**Tips for manual mapping:**
- Start with the required fields: Product Name, Category, Weight, Price
- Use the column dropdown search to find your source columns quickly
- Preview your data in the mapping step to verify correctness
