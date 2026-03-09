import { describe, it, expect } from 'vitest';
import {
  applyPOSDefaults,
  updateMapping,
  clearAllMappings,
  getUnmappedRequired,
  getMappingsByGroup,
  getSampleValue,
} from '../lib/mapping-engine';
import { POS_SYSTEMS, POS_DEFAULTS, MAPPING_FIELDS } from '../lib/constants';

describe('applyPOSDefaults', () => {
  it('returns mappings with Dutchie-specific sourceHeaders', () => {
    const mappings = applyPOSDefaults('Dutchie');
    expect(mappings).toHaveLength(24);

    const productName = mappings.find((m) => m.fieldKey === 'productName');
    expect(productName?.sourceHeader).toBe('Product');

    const brand = mappings.find((m) => m.fieldKey === 'brand');
    expect(brand?.sourceHeader).toBe('Brand');

    const sku = mappings.find((m) => m.fieldKey === 'productIdentifier');
    expect(sku?.sourceHeader).toBe('SKU');
  });

  it('returns correct mappings for each POS system', () => {
    for (const pos of POS_SYSTEMS) {
      const mappings = applyPOSDefaults(pos);
      expect(mappings).toHaveLength(24);

      // Spot-check: productName should be mapped for every POS
      const productName = mappings.find((m) => m.fieldKey === 'productName');
      expect(productName?.sourceHeader).toBe(POS_DEFAULTS[pos]['productName']);
    }
  });

  it('returns empty mappings for "Other"', () => {
    const mappings = applyPOSDefaults('Other');
    expect(mappings).toHaveLength(24);
    for (const m of mappings) {
      expect(m.sourceHeader).toBeNull();
    }
  });

  it('returns empty mappings for unknown POS', () => {
    const mappings = applyPOSDefaults('UnknownPOS');
    expect(mappings).toHaveLength(24);
    for (const m of mappings) {
      expect(m.sourceHeader).toBeNull();
    }
  });
});

describe('updateMapping', () => {
  it('updates a single mapping immutably', () => {
    const original = applyPOSDefaults('Dutchie');
    const updated = updateMapping(original, 'productName', 'Custom Column');

    // Original should not be changed
    const origName = original.find((m) => m.fieldKey === 'productName');
    expect(origName?.sourceHeader).toBe('Product');

    // Updated should have new value
    const updName = updated.find((m) => m.fieldKey === 'productName');
    expect(updName?.sourceHeader).toBe('Custom Column');
  });

  it('can set a mapping to null', () => {
    const original = applyPOSDefaults('Dutchie');
    const updated = updateMapping(original, 'productName', null);
    const name = updated.find((m) => m.fieldKey === 'productName');
    expect(name?.sourceHeader).toBeNull();
  });
});

describe('clearAllMappings', () => {
  it('sets all sourceHeaders to null', () => {
    const mappings = applyPOSDefaults('Dutchie');
    const cleared = clearAllMappings(mappings);
    for (const m of cleared) {
      expect(m.sourceHeader).toBeNull();
    }
  });
});

describe('getUnmappedRequired', () => {
  it('returns unmapped required field keys', () => {
    const mappings = applyPOSDefaults('Other'); // all null
    const unmapped = getUnmappedRequired(mappings);
    expect(unmapped).toContain('productName');
    expect(unmapped).toContain('productCategory');
  });

  it('returns empty array when all required fields are mapped', () => {
    const mappings = applyPOSDefaults('Dutchie'); // productName and productCategory mapped
    const unmapped = getUnmappedRequired(mappings);
    expect(unmapped).toHaveLength(0);
  });
});

describe('getMappingsByGroup', () => {
  it('groups mappings correctly', () => {
    const mappings = applyPOSDefaults('Dutchie');
    const grouped = getMappingsByGroup(mappings);

    expect(grouped['Product Info']).toBeDefined();
    expect(grouped['Cannabis Details']).toBeDefined();
    expect(grouped['Pricing']).toBeDefined();
    expect(grouped['Attributes']).toBeDefined();
    expect(grouped['Display & Media']).toBeDefined();

    // Product Info should contain productName
    const productInfoKeys = grouped['Product Info'].map((m) => m.fieldKey);
    expect(productInfoKeys).toContain('productName');
    expect(productInfoKeys).toContain('brand');
  });

  it('filters out hidden fields', () => {
    const mappings = applyPOSDefaults('Dutchie');
    const grouped = getMappingsByGroup(mappings);

    // Flatten all grouped field keys
    const allKeys = Object.values(grouped).flatMap((group) => group.map((m) => m.fieldKey));

    // Hidden fields should not appear
    const hiddenFields = MAPPING_FIELDS.filter((f) => f.hidden).map((f) => f.key);
    for (const key of hiddenFields) {
      expect(allKeys).not.toContain(key);
    }
  });
});

describe('getSampleValue', () => {
  it('returns first non-empty value for a header', () => {
    const rows = [
      { Name: '', Price: '10' },
      { Name: 'Product A', Price: '20' },
      { Name: 'Product B', Price: '30' },
    ];
    expect(getSampleValue(rows, 'Name')).toBe('Product A');
    expect(getSampleValue(rows, 'Price')).toBe('10');
  });

  it('returns empty string when no values exist', () => {
    const rows = [{ Name: '' }, { Name: '' }];
    expect(getSampleValue(rows, 'Name')).toBe('');
  });

  it('returns empty string for non-existent header', () => {
    const rows = [{ Name: 'A' }];
    expect(getSampleValue(rows, 'Missing')).toBe('');
  });
});
