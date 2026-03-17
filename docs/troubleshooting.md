# Troubleshooting

## Authentication Issues

### "No auth token available"

**Cause:** The extension couldn't find your Treez session token.

**Fix:**

1. Make sure you're logged into Treez in the same browser
2. Refresh the Treez page
3. Try logging out and back into Treez
4. Re-open the migration wizard

### "Could not extract store claims from token"

**Cause:** Your Treez session token is missing expected fields (usually happens with very old sessions).

**Fix:**

1. Log out of Treez completely
2. Clear your browser cache for the Treez domain
3. Log back in and try again

---

## File Upload Issues

### "File too large"

**Cause:** The file exceeds the 100 MB limit.

**Fix:**

- Split your export into smaller files (e.g., by category or date range)
- Remove unnecessary columns before uploading
- If CSV, check for extra whitespace or embedded images inflating file size

### File parses with 0 rows

**Cause:** The tool couldn't find data rows in your file.

**Fix:**

- Ensure the first row contains column headers
- Check that data starts on the second row (no blank rows between headers and data)
- For XLSX files, make sure you selected the correct sheet
- Open the file in a text editor to verify it's not corrupted

### POS auto-detection shows "Unknown"

**Cause:** Column headers don't match any known POS system.

**Fix:**

- This is normal for less common POS exports or custom column names
- Manually select your POS system from the dropdown, or choose "Other"
- Mapping will need manual adjustment in the Map step

---

## Mapping Issues

### Required field can't be mapped

**Cause:** Your source file doesn't have a column that matches the required Treez field.

**Fix:**

- Check if the data exists under a different column name
- Some POS systems combine fields (e.g., name and weight in one column) -- you may need to pre-process your file
- For Weight: if your products are sold by "each" (merch, plants), you can map any column and the tool will handle unit conversion

### Auto-mapped column is wrong

**Cause:** Column header matches a POS template but the data is different.

**Fix:**

- Click the dropdown and select the correct source column
- Manual overrides persist through the mapping step

---

## Validation Errors

### "Missing required field: productName"

**Fix:** Go back to the Map step and ensure Product Name is mapped to a source column that has data in every row.

### "Invalid category"

**Cause:** A source category couldn't be normalized to a Treez category.

**Fix:**

- Click the error group to see affected rows
- Edit the category value inline to one of the valid Treez categories
- Common categories: Flower, Cartridge, Edible, Extract, Preroll, Tincture, Topical, Beverage, CBD, Pill, Plant, Merch, Misc, Non-Inv

### "Invalid weight format"

**Cause:** Weight value couldn't be parsed (e.g., "varies", "N/A", empty).

**Fix:**

- Edit the value inline to a numeric weight (e.g., "1.0", "0.5", "500")
- The tool accepts grams, milligrams, and ounces and converts automatically

### Large number of warnings

**Note:** Warnings don't block import. They flag data that may need attention but won't cause import failures. Review them, but you can proceed with warnings present.

---

## Import Issues

### "Upload failed" for one or more files

**Cause:** The presigned URL request or S3 upload failed.

**Fix:**

1. Check your internet connection
2. Ensure your Treez session hasn't expired (refresh the Treez page)
3. Try the import step again -- the tool retries failed uploads

### Import succeeds but products don't appear in Treez

**Cause:** The Treez import pipeline processes files asynchronously. Processing can take several minutes for large catalogs.

**Fix:**

- Wait 5-10 minutes and check the Treez import status page
- For very large imports (10k+ products), processing may take longer
- If products still don't appear after 30 minutes, check the Treez admin import logs or contact Treez support

---

## Extension Issues

### Buttons don't appear on the Treez page

**Fix:**

1. Verify the extension is enabled in `chrome://extensions/`
2. Make sure you're on the correct page: `app.treez.io/treez-admin/import/home`
3. Try refreshing the page
4. Check if another extension is blocking content script injection

### Wizard drawer doesn't open

**Fix:**

1. Check the Chrome DevTools console for errors (right-click > Inspect > Console)
2. Try disabling other extensions that modify page layout
3. Reload the extension from `chrome://extensions/`

---

## Still stuck?

[Report a bug](https://gitlab.com/chase_jepson/catalog-migration-tool-v2/-/issues/new?issuable_template=Bug%20Report) with:

- What you were trying to do
- What happened instead
- Screenshots of any error messages
- The browser console output (if available)
