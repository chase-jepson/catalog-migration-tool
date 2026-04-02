import type {
  FieldMapping,
  InventoryFileRole,
  MappingFieldDef,
} from "./types";

// ── Inventory Mapping Groups ────────────────────────────────────────────────

// ── File Roles ──────────────────────────────────────────────────────────────

export const INVENTORY_FILE_ROLES: {
  role: InventoryFileRole;
  label: string;
  required: boolean;
  description: string;
}[] = [
  {
    role: "inventory",
    label: "Inventory Export",
    required: true,
    description: "Current inventory with SKU, quantities, THC/CBD, rooms",
  },
  {
    role: "receipts",
    label: "Receipt Report",
    required: false,
    description: "Invoice/receipt history with receive dates, costs, vendors",
  },
  {
    role: "vendors",
    label: "Vendors Export",
    required: false,
    description: "Vendor/distributor details with addresses and license numbers",
  },
  {
    role: "adjustments",
    label: "Inventory Adjustments",
    required: false,
    description: "Quantity/cost adjustments by package ID",
  },
  {
    role: "catalog_export",
    label: "Treez Catalog Export",
    required: false,
    description: "Post-migration catalog with Product Key and Product Category",
  },
];

// ── Per-Role Mapping Fields ─────────────────────────────────────────────────

export const INVENTORY_ROLE_FIELDS: Record<InventoryFileRole, MappingFieldDef[]> = {
  inventory: [
    {
      key: "inv_sku",
      label: "VariantReferenceId (SKU)",
      group: "Product Matching",
      required: true,
      description: "POS product SKU — becomes V-{SKU} in output",
    },
    {
      key: "inv_product",
      label: "Product Name",
      group: "Product Matching",
      description: "Product name (reference only, not in final CSV)",
    },
    {
      key: "inv_externalPackageId",
      label: "TraceTreezId / Barcode (Package ID)",
      group: "Product Matching",
      required: true,
      description: "External Package ID — becomes TraceTreezId and Inventory Barcode(s)",
    },
    {
      key: "inv_room",
      label: "Location Path (Room)",
      group: "Location",
      description: "Room name — mapped to Location Path, Is Sellable, Default Receiving",
    },
    {
      key: "inv_quantityIncAllocated",
      label: "Units",
      group: "Inventory Data",
      required: true,
      description: "Total quantity including allocated → Units column",
    },
    {
      key: "inv_cost",
      label: "Unit Cost (fallback)",
      group: "Inventory Data",
      description: "Inventory cost — used when no receipt data",
    },
    {
      key: "inv_thc",
      label: "THC Amount / UoM",
      group: "Cannabis Details",
      description: "THC content — auto-split into THC Amount + THC UoM",
    },
    {
      key: "inv_cbd",
      label: "CBD Amount / UoM",
      group: "Cannabis Details",
      description: "CBD content — auto-split into CBD Amount + CBD UoM",
    },
    {
      key: "inv_availableFor",
      label: "Customer Type",
      group: "Customer Type",
      description: "Eligibility — mapped to Customer Type + Location Inventory Type",
    },
    {
      key: "inv_expirationDate",
      label: "Expiration Date",
      group: "Dates",
      description: "Product expiration date",
    },
    {
      key: "inv_packagingDate",
      label: "Packaged Date",
      group: "Dates",
      description: "Package date",
    },
    { key: "inv_harvestDate", label: "Harvest Date", group: "Dates", description: "Harvest date" },
    {
      key: "inv_category",
      label: "Category",
      group: "Product Info",
      description: "Product category — used for Merch detection (TraceTreezId format)",
    },
  ],
  receipts: [
    {
      key: "rcpt_productSKU",
      label: "Product SKU",
      group: "Product Matching",
      required: true,
      description: "SKU to match with inventory",
    },
    {
      key: "rcpt_externalPackageId",
      label: "External Package ID",
      group: "Product Matching",
      required: true,
      description: "Package ID — used to join with inventory",
    },
    {
      key: "rcpt_receiveDate",
      label: "Invoice Created Date",
      group: "Dates",
      required: true,
      description: "Receive Date → Invoice Created Date in output",
    },
    {
      key: "rcpt_quantity",
      label: "Original Unit Count",
      group: "Inventory Data",
      required: true,
      description: "Received quantity → Original Unit Count",
    },
    {
      key: "rcpt_totalCost",
      label: "Total Cost",
      group: "Inventory Data",
      description: "Total cost — used with quantity to compute Unit Cost",
    },
    {
      key: "rcpt_unitCost",
      label: "Unit Cost",
      group: "Inventory Data",
      description: "Per-unit cost (or computed from Total Cost / Quantity)",
    },
    {
      key: "rcpt_vendorName",
      label: "Distributor Name",
      group: "Distributor",
      required: true,
      description: "Vendor Name → Distributor Name; used to join with vendor data",
    },
    {
      key: "rcpt_orderTitle",
      label: "Invoice ID (Order Title)",
      group: "Invoice",
      description: "Order Title — Invoice ID is extracted from this",
    },
  ],
  vendors: [
    {
      key: "vnd_vendorName",
      label: "Distributor Name",
      group: "Distributor",
      required: true,
      description: "Vendor name — used to join with receipt data",
    },
    {
      key: "vnd_vendorCode",
      label: "Distributor License Number",
      group: "Distributor",
      description: "License code — duplicates auto-merged, split into License 1/2/3",
    },
    {
      key: "vnd_abbreviation",
      label: "Distributor DBA",
      group: "Distributor",
      description: "Abbreviation / DBA name",
    },
    {
      key: "vnd_address",
      label: "Distributor Address (Street)",
      group: "Distributor",
      description: "Street address — combined with City, State, ZIP",
    },
    {
      key: "vnd_city",
      label: "Distributor Address (City)",
      group: "Distributor",
      description: "City",
    },
    {
      key: "vnd_state",
      label: "Distributor Address (State)",
      group: "Distributor",
      description: "State",
    },
    {
      key: "vnd_postalCode",
      label: "Distributor Address (ZIP)",
      group: "Distributor",
      description: "ZIP/postal code",
    },
    {
      key: "vnd_contactPhone",
      label: "Distributor Phone Number",
      group: "Distributor",
      description: "Contact phone number",
    },
    {
      key: "vnd_contactEmail",
      label: "Distributor Email",
      group: "Distributor",
      description: "Contact email address",
    },
  ],
  adjustments: [
    {
      key: "adj_externalPackageId",
      label: "External Package ID",
      group: "Product Matching",
      required: true,
      description: "SerialNumber — package ID matching receipts",
    },
    {
      key: "adj_quantity",
      label: "Quantity",
      group: "Inventory Data",
      required: true,
      description: "Adjustment quantity — stacked with receipts",
    },
    {
      key: "adj_cost",
      label: "Total Cost",
      group: "Inventory Data",
      description: "Adjustment cost — stacked with receipt costs",
    },
  ],
  catalog_export: [
    {
      key: "cat_productKey",
      label: "Product Key",
      group: "Product Matching",
      required: true,
      description: "Product Key — joined with inventory SKU",
    },
    {
      key: "cat_productCategory",
      label: "Product Category",
      group: "Product Info",
      required: true,
      description: "Category — used for Merch detection (TraceTreezId format)",
    },
  ],
};

// ── Flat mapping fields (all roles combined) ────────────────────────────────

export const INVENTORY_MAPPING_FIELDS: MappingFieldDef[] =
  Object.values(INVENTORY_ROLE_FIELDS).flat();

// ── POS-specific Default Column Mappings (per role) ─────────────────────────

export const INVENTORY_ROLE_POS_DEFAULTS: Record<
  string,
  Partial<Record<InventoryFileRole, Record<string, string>>>
> = {
  Dutchie: {
    inventory: {
      inv_sku: "SKU",
      inv_product: "Product",
      inv_externalPackageId: "External package ID",
      inv_room: "Room",
      inv_quantityIncAllocated: "Quantity (including allocated)",
      inv_cost: "Cost",
      inv_thc: "THC",
      inv_cbd: "CBD",
      inv_availableFor: "Available for",
      inv_expirationDate: "Expiration date",
      inv_packagingDate: "Packaging date",
      inv_harvestDate: "Harvest date",
      inv_category: "Category",
    },
    receipts: {
      rcpt_productSKU: "Product SKU",
      rcpt_externalPackageId: "External Package ID",
      rcpt_receiveDate: "Receive Date",
      rcpt_quantity: "Quantity",
      rcpt_totalCost: "Total Cost",
      rcpt_unitCost: "Unit Cost",
      rcpt_vendorName: "Vendor Name",
      rcpt_orderTitle: "Order Title",
    },
    vendors: {
      vnd_vendorName: "Vendor name",
      vnd_vendorCode: "Vendor code",
      vnd_abbreviation: "Abbreviation",
      vnd_address: "Address",
      vnd_city: "City",
      vnd_state: "State",
      vnd_postalCode: "Postal code",
      vnd_contactPhone: "Contact phone",
      vnd_contactEmail: "Contact email",
    },
    adjustments: {
      adj_externalPackageId: "SerialNumber",
      adj_quantity: "qty",
      adj_cost: "Cost",
    },
    catalog_export: {
      cat_productKey: "ImportVariantReferenceId",
      cat_productCategory: "Product Category",
    },
  },
};

// ── Legacy POS Defaults (backwards compat) ──────────────────────────────────

export const INVENTORY_POS_DEFAULTS: Record<string, Record<string, string>> = {
  Dutchie: {
    productIdentifier: "SKU",
    productName: "Product",
    quantityOnHand: "Quantity",
    cost: "Cost",
  },
};

// ── Room-to-Location Path Mapping ───────────────────────────────────────────

export const ROOM_TO_LOCATION_PATH: Record<string, string> = {
  "Sales Floor": "Front of House, Sales Floor",
  "Back Stock": "Back of House, Back Stock",
  "Budtender Vault": "Back of House, Budtender Vault",
  Promo: "Back of House, Promo",
  Display: "Back of House, Display",
  Waste: "Quarantine",
};

// ── Output Column Order (56 columns) ────────────────────────────────────────

export const INVENTORY_OUTPUT_COLUMNS: string[] = [
  "TreezVariantId",
  "VariantReferenceId",
  "Dispensary License",
  "Invoice ID",
  "Invoice Created Date",
  "Manifest Number",
  "TraceTreezId",
  "Inventory Barcode(s)",
  "Original Unit Count",
  "Units",
  "Unit Cost",
  "Harvest Date",
  "Expiration Date",
  "Packaged Date",
  "Customer Type",
  "THC Amount",
  "THC UoM",
  "CBD Amount",
  "CBD UoM",
  "Location Path",
  "Location Inventory Type",
  "Location Is Sellable",
  "Location Default Receiving Location",
  "Distributor Name",
  "Distributor DBA",
  "Distributor Address",
  "Distributor Phone Number",
  "Distributor Email",
  "Distributor Type",
  "Distributor Default Payment Term",
  "Distributor Lead Time",
  "Distributor Delivery Days",
  "Distributor Preferred Payment Method",
  "Distributor License 1 Type",
  "Distributor License 1 Number",
  "Distributor License 1 Expiration Date",
  "Distributor License 2 Type",
  "Distributor License 2 Number",
  "Distributor License 2 Expiration Date",
  "Distributor License 3 Type",
  "Distributor License 3 Number",
  "Distributor License 3 Expiration Date",
  "Distributor Representative 1 Name",
  "Distributor Representative 1 Phone Number",
  "Distributor Representative 1 Email",
  "Distributor Representative 1 Role",
  "Distributor Representative 1 Notes",
  "Distributor Representative 2 Name",
  "Distributor Representative 2 Phone Number",
  "Distributor Representative 2 Email",
  "Distributor Representative 2 Role",
  "Distributor Representative 2 Notes",
  "Distributor Representative 3 Name",
  "Distributor Representative 3 Phone Number",
  "Distributor Representative 3 Email",
  "Distributor Representative 3 Role",
  "Distributor Representative 3 Notes",
];

// ── Empty Inventory Mappings ────────────────────────────────────────────────

export function createEmptyInventoryMappings(): FieldMapping[] {
  return INVENTORY_MAPPING_FIELDS.map((f) => ({
    fieldKey: f.key,
    label: f.label,
    sourceHeader: null,
  }));
}
