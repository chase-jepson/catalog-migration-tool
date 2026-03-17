import type { InventoryDerivedRow } from "./types";
import { INVENTORY_OUTPUT_COLUMNS } from "./inventory-constants";

// Re-export for convenience
export { INVENTORY_OUTPUT_COLUMNS };

/**
 * Map an InventoryDerivedRow field to its output column name.
 * This is the canonical mapping from row property to column header.
 */
const FIELD_TO_COLUMN: Record<string, keyof InventoryDerivedRow> = {
  TreezVariantId: "treezVariantId",
  VariantReferenceId: "variantReferenceId",
  "Dispensary License": "dispensaryLicense",
  "Invoice ID": "invoiceId",
  "Invoice Created Date": "invoiceCreatedDate",
  "Manifest Number": "manifestNumber",
  TraceTreezId: "traceTreezId",
  "Inventory Barcode(s)": "inventoryBarcodes",
  "Original Unit Count": "originalUnitCount",
  Units: "units",
  "Unit Cost": "unitCost",
  "Harvest Date": "harvestDate",
  "Expiration Date": "expirationDate",
  "Packaged Date": "packagedDate",
  "Customer Type": "customerType",
  "THC Amount": "thcAmount",
  "THC UoM": "thcUom",
  "CBD Amount": "cbdAmount",
  "CBD UoM": "cbdUom",
  "Location Path": "locationPath",
  "Location Inventory Type": "locationInventoryType",
  "Location Is Sellable": "locationIsSellable",
  "Location Default Receiving Location": "locationDefaultReceivingLocation",
  "Distributor Name": "distributorName",
  "Distributor DBA": "distributorDBA",
  "Distributor Address": "distributorAddress",
  "Distributor Phone Number": "distributorPhoneNumber",
  "Distributor Email": "distributorEmail",
  "Distributor Type": "distributorType",
  "Distributor Default Payment Term": "distributorDefaultPaymentTerm",
  "Distributor Lead Time": "distributorLeadTime",
  "Distributor Delivery Days": "distributorDeliveryDays",
  "Distributor Preferred Payment Method": "distributorPreferredPaymentMethod",
  "Distributor License 1 Type": "distributorLicense1Type",
  "Distributor License 1 Number": "distributorLicense1Number",
  "Distributor License 1 Expiration Date": "distributorLicense1ExpirationDate",
  "Distributor License 2 Type": "distributorLicense2Type",
  "Distributor License 2 Number": "distributorLicense2Number",
  "Distributor License 2 Expiration Date": "distributorLicense2ExpirationDate",
  "Distributor License 3 Type": "distributorLicense3Type",
  "Distributor License 3 Number": "distributorLicense3Number",
  "Distributor License 3 Expiration Date": "distributorLicense3ExpirationDate",
  "Distributor Representative 1 Name": "distributorRep1Name",
  "Distributor Representative 1 Phone Number": "distributorRep1Phone",
  "Distributor Representative 1 Email": "distributorRep1Email",
  "Distributor Representative 1 Role": "distributorRep1Role",
  "Distributor Representative 1 Notes": "distributorRep1Notes",
  "Distributor Representative 2 Name": "distributorRep2Name",
  "Distributor Representative 2 Phone Number": "distributorRep2Phone",
  "Distributor Representative 2 Email": "distributorRep2Email",
  "Distributor Representative 2 Role": "distributorRep2Role",
  "Distributor Representative 2 Notes": "distributorRep2Notes",
  "Distributor Representative 3 Name": "distributorRep3Name",
  "Distributor Representative 3 Phone Number": "distributorRep3Phone",
  "Distributor Representative 3 Email": "distributorRep3Email",
  "Distributor Representative 3 Role": "distributorRep3Role",
  "Distributor Representative 3 Notes": "distributorRep3Notes",
};

/**
 * Build inventory import CSV as a 2D string array.
 *
 * Only includes rows where excluded === false.
 * Returns string[][] suitable for passing to arrayToCSV().
 */
export function buildInventoryCSV(rows: InventoryDerivedRow[]): string[][] {
  const header = [...INVENTORY_OUTPUT_COLUMNS];

  const dataRows = rows
    .filter((r) => !r.excluded)
    .map((row) =>
      INVENTORY_OUTPUT_COLUMNS.map((colName) => {
        const fieldKey = FIELD_TO_COLUMN[colName];
        if (!fieldKey) return "";
        const val = row[fieldKey];
        if (val === undefined || val === null) return "";
        return String(val);
      }),
    );

  return [header, ...dataRows];
}

/**
 * Serialize a 2D string array to a CSV string.
 * Handles quoting of cells containing commas, quotes, or newlines.
 */
export function serializeCSV(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const escaped = cell.replace(/"/g, '""');
          return /[,"\n\r]/.test(cell) ? `"${escaped}"` : cell;
        })
        .join(","),
    )
    .join("\n");
}
