import type {
  ParsedFile,
  FieldMapping,
  InventoryDerivedRow,
  RowFix,
} from './types';
import { mergeFiles } from './parser';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a lookup: fieldKey -> sourceHeader */
function buildFieldMap(
  mappings: FieldMapping[],
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const m of mappings) {
    map[m.fieldKey] = m.sourceHeader;
  }
  return map;
}

/** Get a source value from a row using the field map */
function getVal(
  row: Record<string, string>,
  fieldMap: Record<string, string | null>,
  fieldKey: string,
): string {
  const col = fieldMap[fieldKey];
  if (!col) return '';
  return (row[col] ?? '').trim();
}

/** Parse a quantity string into a number. Returns NaN for unparseable values. */
export function parseQuantity(val: string): number {
  if (val === '') return 0;
  const num = Number(val);
  return num;
}

/** Strip leading $ and whitespace from cost string. */
export function parseCost(val: string): string {
  if (!val) return '';
  return val.replace(/^\s*\$?\s*/, '').trim();
}

// ── Main Functions ───────────────────────────────────────────────────────────

/**
 * Transform parsed files into inventory derived rows using field mappings.
 * productLookup maps POS product IDs to Treez variant IDs.
 */
export function deriveInventoryRows(
  parsedFiles: ParsedFile[],
  mappings: FieldMapping[],
  productLookup: Record<string, string>,
): InventoryDerivedRow[] {
  const merged = mergeFiles(parsedFiles);
  const fieldMap = buildFieldMap(mappings);

  return merged.rows.map((row) => {
    const posProductId = getVal(row, fieldMap, 'productIdentifier');
    const productName = getVal(row, fieldMap, 'productName');
    const rawQuantity = getVal(row, fieldMap, 'quantityOnHand');
    const rawCost = getVal(row, fieldMap, 'cost');
    const room = getVal(row, fieldMap, 'room');

    const treezVariantId = productLookup[posProductId];
    const matched = treezVariantId !== undefined;

    return {
      matched,
      posProductId,
      productName,
      treezVariantId: matched ? treezVariantId : undefined,
      quantityOnHand: parseQuantity(rawQuantity),
      cost: parseCost(rawCost),
      room,
      excluded: false,
    };
  });
}

/**
 * Apply row fixes to inventory derived rows.
 * Returns a new array with fixes applied.
 */
export function applyInventoryFixes(
  rows: InventoryDerivedRow[],
  fixes: RowFix[],
): InventoryDerivedRow[] {
  if (fixes.length === 0) return rows;

  const result = rows.map((r) => ({ ...r }));

  for (const fix of fixes) {
    if (fix.rowIndex < 0 || fix.rowIndex >= result.length) continue;
    const row = result[fix.rowIndex];

    switch (fix.field) {
      case 'quantityOnHand':
        row.quantityOnHand = parseQuantity(fix.newValue);
        break;
      case 'cost':
        row.cost = parseCost(fix.newValue);
        break;
      case 'room':
        row.room = fix.newValue;
        break;
      case 'excluded':
        row.excluded = fix.newValue === 'true';
        break;
      default:
        // For string fields, assign directly
        (row as Record<string, unknown>)[fix.field] = fix.newValue;
    }
  }

  return result;
}
