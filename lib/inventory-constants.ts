import type { FieldMapping, InventoryFileRole, InventoryMappingGroup, MappingFieldDef } from './types';

// ── Inventory Mapping Groups ────────────────────────────────────────────────

export const INVENTORY_MAPPING_GROUPS: InventoryMappingGroup[] = [
  'Product Matching',
  'Inventory Data',
  'Location',
  'Cannabis Details',
  'Customer Type',
  'Dates',
  'Distributor',
  'Invoice',
  'Product Info',
];

// ── File Roles ──────────────────────────────────────────────────────────────

export const INVENTORY_FILE_ROLES: { role: InventoryFileRole; label: string; required: boolean; description: string }[] = [
  { role: 'inventory', label: 'Inventory Export', required: true, description: 'Current inventory with SKU, quantities, THC/CBD, rooms' },
  { role: 'receipts', label: 'Receipt Report', required: false, description: 'Invoice/receipt history with receive dates, costs, vendors' },
  { role: 'vendors', label: 'Vendors Export', required: false, description: 'Vendor/distributor details with addresses and license numbers' },
  { role: 'adjustments', label: 'Inventory Adjustments', required: false, description: 'Quantity/cost adjustments by package ID' },
  { role: 'catalog_export', label: 'Treez Catalog Export', required: false, description: 'Post-migration catalog with Product Key and Product Category' },
];

// ── Per-Role Mapping Fields ─────────────────────────────────────────────────

export const INVENTORY_ROLE_FIELDS: Record<InventoryFileRole, MappingFieldDef[]> = {
  inventory: [
    { key: 'inv_sku', label: 'Product SKU', group: 'Product Matching', required: true, description: 'POS product identifier' },
    { key: 'inv_product', label: 'Product Name', group: 'Product Matching', description: 'Product name for reference' },
    { key: 'inv_externalPackageId', label: 'External Package ID', group: 'Product Matching', required: true, description: 'Package/batch ID for join with receipts' },
    { key: 'inv_room', label: 'Room', group: 'Location', description: 'Storage location within store' },
    { key: 'inv_available', label: 'Available', group: 'Inventory Data', description: 'Available quantity' },
    { key: 'inv_quantityIncAllocated', label: 'Quantity (including allocated)', group: 'Inventory Data', required: true, description: 'Total quantity including allocated' },
    { key: 'inv_cost', label: 'Cost', group: 'Inventory Data', description: 'Unit cost from inventory' },
    { key: 'inv_thc', label: 'THC', group: 'Cannabis Details', description: 'THC content (e.g., "23.5 %", "150 mg")' },
    { key: 'inv_cbd', label: 'CBD', group: 'Cannabis Details', description: 'CBD content' },
    { key: 'inv_availableFor', label: 'Available for', group: 'Customer Type', description: 'Customer type eligibility' },
    { key: 'inv_expirationDate', label: 'Expiration date', group: 'Dates', description: 'Product expiration date' },
    { key: 'inv_packagingDate', label: 'Packaging date', group: 'Dates', description: 'Package date' },
    { key: 'inv_harvestDate', label: 'Harvest date', group: 'Dates', description: 'Harvest date' },
    { key: 'inv_category', label: 'Category', group: 'Product Info', description: 'Product category (for Merch detection)' },
  ],
  receipts: [
    { key: 'rcpt_productSKU', label: 'Product SKU', group: 'Product Matching', required: true, description: 'SKU to match with inventory' },
    { key: 'rcpt_externalPackageId', label: 'External Package ID', group: 'Product Matching', required: true, description: 'Package ID for joins' },
    { key: 'rcpt_receiveDate', label: 'Receive Date', group: 'Dates', required: true, description: 'When package was received' },
    { key: 'rcpt_quantity', label: 'Quantity', group: 'Inventory Data', required: true, description: 'Received quantity' },
    { key: 'rcpt_totalCost', label: 'Total Cost', group: 'Inventory Data', description: 'Total cost of receipt line' },
    { key: 'rcpt_unitCost', label: 'Unit Cost', group: 'Inventory Data', description: 'Per-unit cost' },
    { key: 'rcpt_vendorName', label: 'Vendor Name', group: 'Distributor', required: true, description: 'Vendor/distributor name' },
    { key: 'rcpt_orderTitle', label: 'Order Title', group: 'Invoice', description: 'Order title (Invoice ID extracted from this)' },
  ],
  vendors: [
    { key: 'vnd_vendorName', label: 'Vendor name', group: 'Distributor', required: true, description: 'Vendor name for join' },
    { key: 'vnd_vendorCode', label: 'Vendor code', group: 'Distributor', description: 'Primary license number' },
    { key: 'vnd_vendorCode1', label: 'Vendor code (1)', group: 'Distributor', description: 'Second license number' },
    { key: 'vnd_vendorCode2', label: 'Vendor code (2)', group: 'Distributor', description: 'Third license number' },
    { key: 'vnd_abbreviation', label: 'Abbreviation', group: 'Distributor', description: 'DBA / abbreviation' },
    { key: 'vnd_address', label: 'Address', group: 'Distributor', description: 'Street address' },
    { key: 'vnd_city', label: 'City', group: 'Distributor', description: 'City' },
    { key: 'vnd_state', label: 'State', group: 'Distributor', description: 'State' },
    { key: 'vnd_postalCode', label: 'Postal code', group: 'Distributor', description: 'ZIP/postal code' },
    { key: 'vnd_contactPhone', label: 'Contact phone', group: 'Distributor', description: 'Phone number' },
    { key: 'vnd_contactEmail', label: 'Contact email', group: 'Distributor', description: 'Email address' },
  ],
  adjustments: [
    { key: 'adj_externalPackageId', label: 'External Package ID (SerialNumber)', group: 'Product Matching', required: true, description: 'Package ID matching receipts' },
    { key: 'adj_quantity', label: 'qty', group: 'Inventory Data', required: true, description: 'Adjustment quantity' },
    { key: 'adj_cost', label: 'Cost', group: 'Inventory Data', description: 'Adjustment cost' },
  ],
  catalog_export: [
    { key: 'cat_productKey', label: 'Product Key', group: 'Product Matching', required: true, description: 'Product Key for join with inventory SKU' },
    { key: 'cat_productCategory', label: 'Product Category', group: 'Product Info', required: true, description: 'Category (used for Merch detection)' },
  ],
};

// ── Flat mapping fields (all roles combined) ────────────────────────────────

export const INVENTORY_MAPPING_FIELDS: MappingFieldDef[] = Object.values(INVENTORY_ROLE_FIELDS).flat();

// ── POS-specific Default Column Mappings (per role) ─────────────────────────

export const INVENTORY_ROLE_POS_DEFAULTS: Record<string, Partial<Record<InventoryFileRole, Record<string, string>>>> = {
  Dutchie: {
    inventory: {
      inv_sku: 'SKU', inv_product: 'Product', inv_externalPackageId: 'External package ID',
      inv_room: 'Room', inv_available: 'Available', inv_quantityIncAllocated: 'Quantity (including allocated)',
      inv_cost: 'Cost', inv_thc: 'THC', inv_cbd: 'CBD', inv_availableFor: 'Available for',
      inv_expirationDate: 'Expiration date', inv_packagingDate: 'Packaging date', inv_harvestDate: 'Harvest date',
      inv_category: 'Category',
    },
    receipts: {
      rcpt_productSKU: 'Product SKU', rcpt_externalPackageId: 'External Package ID',
      rcpt_receiveDate: 'Receive Date', rcpt_quantity: 'Quantity', rcpt_totalCost: 'Total Cost',
      rcpt_unitCost: 'Unit Cost', rcpt_vendorName: 'Vendor Name', rcpt_orderTitle: 'Order Title',
    },
    vendors: {
      vnd_vendorName: 'Vendor name', vnd_vendorCode: 'Vendor code', vnd_vendorCode1: 'Vendor code (1)',
      vnd_vendorCode2: 'Vendor code (2)', vnd_abbreviation: 'Abbreviation', vnd_address: 'Address',
      vnd_city: 'City', vnd_state: 'State', vnd_postalCode: 'Postal code',
      vnd_contactPhone: 'Contact phone', vnd_contactEmail: 'Contact email',
    },
    adjustments: {
      adj_externalPackageId: 'SerialNumber', adj_quantity: 'qty', adj_cost: 'Cost',
    },
    catalog_export: {
      cat_productKey: 'Product Key', cat_productCategory: 'Product Category',
    },
  },
};

// ── Legacy POS Defaults (backwards compat) ──────────────────────────────────

export const INVENTORY_POS_DEFAULTS: Record<string, Record<string, string>> = {
  Dutchie: {
    productIdentifier: 'SKU',
    productName: 'Product',
    quantityOnHand: 'Quantity',
    cost: 'Cost',
  },
};

// ── Room-to-Location Path Mapping ───────────────────────────────────────────

export const ROOM_TO_LOCATION_PATH: Record<string, string> = {
  'Sales Floor': 'Front of House, Sales Floor',
  'Back Stock': 'Back of House, Back Stock',
  'Budtender Vault': 'Back of House, Budtender Vault',
  'Promo': 'Back of House, Promo',
  'Display': 'Back of House, Display',
  'Waste': 'Quarantine',
};

// ── Output Column Order (56 columns) ────────────────────────────────────────

export const INVENTORY_OUTPUT_COLUMNS: string[] = [
  'TreezVariantId', 'VariantReferenceId', 'Dispensary License', 'Invoice ID',
  'Invoice Created Date', 'Manifest Number', 'TraceTreezId', 'Inventory Barcode(s)',
  'Original Unit Count', 'Units', 'Unit Cost', 'Harvest Date', 'Expiration Date',
  'Packaged Date', 'Customer Type', 'THC Amount', 'THC UoM', 'CBD Amount', 'CBD UoM',
  'Location Path', 'Location Inventory Type', 'Location Is Sellable',
  'Location Default Receiving Location',
  'Distributor Name', 'Distributor DBA', 'Distributor Address',
  'Distributor Phone Number', 'Distributor Email', 'Distributor Type',
  'Distributor Default Payment Term', 'Distributor Lead Time',
  'Distributor Delivery Days', 'Distributor Preferred Payment Method',
  'Distributor License 1 Type', 'Distributor License 1 Number',
  'Distributor License 1 Expiration Date',
  'Distributor License 2 Type', 'Distributor License 2 Number',
  'Distributor License 2 Expiration Date',
  'Distributor License 3 Type', 'Distributor License 3 Number',
  'Distributor License 3 Expiration Date',
  'Distributor Representative 1 Name', 'Distributor Representative 1 Phone',
  'Distributor Representative 1 Email', 'Distributor Representative 1 Role',
  'Distributor Representative 1 Notes',
  'Distributor Representative 2 Name', 'Distributor Representative 2 Phone',
  'Distributor Representative 2 Email', 'Distributor Representative 2 Role',
  'Distributor Representative 2 Notes',
  'Distributor Representative 3 Name', 'Distributor Representative 3 Phone',
  'Distributor Representative 3 Email', 'Distributor Representative 3 Role',
  'Distributor Representative 3 Notes',
];

// ── Empty Inventory Mappings ────────────────────────────────────────────────

export function createEmptyInventoryMappings(): FieldMapping[] {
  return INVENTORY_MAPPING_FIELDS.map((f) => ({
    fieldKey: f.key,
    label: f.label,
    sourceHeader: null,
  }));
}

/** Create empty mappings for a specific file role */
export function createEmptyRoleMappings(role: InventoryFileRole): FieldMapping[] {
  return (INVENTORY_ROLE_FIELDS[role] ?? []).map((f) => ({
    fieldKey: f.key,
    label: f.label,
    sourceHeader: null,
  }));
}
