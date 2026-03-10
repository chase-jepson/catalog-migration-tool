import type { FieldMapping, InventoryMappingGroup, MappingFieldDef } from './types';

// ── Inventory Mapping Groups ────────────────────────────────────────────────

export const INVENTORY_MAPPING_GROUPS: InventoryMappingGroup[] = [
  'Product Matching',
  'Inventory Data',
  'Location',
];

// ── Inventory Mapping Fields ────────────────────────────────────────────────

export const INVENTORY_MAPPING_FIELDS: MappingFieldDef[] = [
  // Product Matching
  {
    key: 'productIdentifier',
    label: 'Product ID / SKU',
    description: 'POS product identifier to match against Treez reference ID',
    group: 'Product Matching',
    required: true,
  },
  {
    key: 'productName',
    label: 'Product Name',
    description: 'For display/reference only',
    group: 'Product Matching',
  },
  // Inventory Data
  {
    key: 'quantityOnHand',
    label: 'Quantity on Hand',
    description: 'Current stock count',
    group: 'Inventory Data',
    required: true,
  },
  {
    key: 'cost',
    label: 'Cost / Wholesale Price',
    description: 'Per-unit cost',
    group: 'Inventory Data',
  },
  // Location
  {
    key: 'room',
    label: 'Room / Location',
    description: 'Where inventory is stored within the store',
    group: 'Location',
  },
];

// ── POS-specific Default Column Mappings for Inventory ──────────────────────

export const INVENTORY_POS_DEFAULTS: Record<string, Record<string, string>> = {
  Dutchie: {
    productIdentifier: 'SKU',
    productName: 'Product',
    quantityOnHand: 'Quantity',
    cost: 'Cost',
  },
  Blaze: {
    productIdentifier: 'Product ID',
    productName: 'Item',
    quantityOnHand: 'Quantity On Hand',
    cost: 'Unit Cost',
  },
  Flowhub: {
    productIdentifier: 'Product Id',
    productName: 'Product Name',
    quantityOnHand: 'Quantity',
    cost: 'Cost',
  },
  IndicaOnline: {
    productIdentifier: 'Product ID',
    productName: 'Product Name',
    quantityOnHand: 'Quantity',
    cost: 'Cost Per Unit',
  },
  Meadow: {
    productIdentifier: 'ID',
    productName: 'Product Name',
    quantityOnHand: 'Quantity',
    cost: 'Cost',
  },
  Cova: {
    productIdentifier: 'Manufacturer SKU',
    productName: 'Model Name *',
    quantityOnHand: 'Quantity on Hand',
    cost: 'Cost',
  },
};

// ── Empty Inventory Mappings ────────────────────────────────────────────────

export function createEmptyInventoryMappings(): FieldMapping[] {
  return INVENTORY_MAPPING_FIELDS.map((f) => ({
    fieldKey: f.key,
    label: f.label,
    sourceHeader: null,
  }));
}
