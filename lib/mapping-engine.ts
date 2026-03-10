import type { FieldMapping, MappingGroup } from './types';
import { MAPPING_FIELDS, POS_DEFAULTS } from './constants';

/**
 * Create field mappings pre-populated with POS-specific default source headers.
 * For "Other" or unknown POS, returns empty (null) mappings.
 */
export function applyPOSDefaults(posName: string): FieldMapping[] {
  const defaults = POS_DEFAULTS[posName];

  return MAPPING_FIELDS.map((field) => ({
    fieldKey: field.key,
    label: field.label,
    sourceHeader: defaults?.[field.key] ?? null,
  }));
}

/**
 * Immutably update a single mapping's sourceHeader by fieldKey.
 */
export function updateMapping(
  mappings: FieldMapping[],
  fieldKey: string,
  sourceHeader: string | null,
): FieldMapping[] {
  return mappings.map((m) =>
    m.fieldKey === fieldKey ? { ...m, sourceHeader } : m,
  );
}

/**
 * Clear all mappings by setting every sourceHeader to null.
 */
export function clearAllMappings(mappings: FieldMapping[]): FieldMapping[] {
  return mappings.map((m) => ({ ...m, sourceHeader: null }));
}

/**
 * Get field keys of required fields that are not yet mapped.
 */
export function getUnmappedRequired(mappings: FieldMapping[]): string[] {
  const requiredKeys = new Set(
    MAPPING_FIELDS.filter((f) => f.required).map((f) => f.key),
  );

  return mappings
    .filter((m) => requiredKeys.has(m.fieldKey) && m.sourceHeader === null)
    .map((m) => m.fieldKey);
}

/**
 * Group mappings by their MappingGroup, excluding hidden fields.
 */
export function getMappingsByGroup(
  mappings: FieldMapping[],
): Record<MappingGroup, FieldMapping[]> {
  const fieldDefs = new Map(MAPPING_FIELDS.map((f) => [f.key, f]));

  const result: Record<MappingGroup, FieldMapping[]> = {
    'Product Info': [],
    'Cannabis Details': [],
    'Pricing': [],
    'Attributes': [],
    'Display & Media': [],
    'Product Matching': [],
    'Inventory Data': [],
    'Location': [],
    'Customer Type': [],
    'Dates': [],
    'Distributor': [],
    'Invoice': [],
  };

  for (const mapping of mappings) {
    const def = fieldDefs.get(mapping.fieldKey);
    if (!def || def.hidden) continue;
    result[def.group].push(mapping);
  }

  return result;
}

/**
 * Get the first non-empty value for a given header from a set of rows.
 * Useful for showing sample data in the mapping UI.
 */
export function getSampleValue(
  rows: Record<string, string>[],
  header: string,
): string {
  for (const row of rows) {
    const val = row[header];
    if (val !== undefined && val !== '') return val;
  }
  return '';
}
