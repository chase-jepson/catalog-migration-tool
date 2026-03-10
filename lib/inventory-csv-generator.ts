import type { InventoryDerivedRow } from './types';

/**
 * Build inventory import CSV as a 2D string array.
 *
 * Only includes rows that are both matched AND non-excluded.
 * The EntityId column is filled with the provided storeEntityId.
 *
 * Returns string[][] suitable for passing to arrayToCSV() or buildUploadPayload().
 */
export function buildInventoryCSV(
  rows: InventoryDerivedRow[],
  storeEntityId: string,
): string[][] {
  const header = [
    'TreezVariantId',
    'EntityId',
    'QuantityOnHand',
    'Cost',
    'Room',
  ];

  const dataRows = rows
    .filter((r) => r.matched && !r.excluded)
    .map((r) => [
      r.treezVariantId ?? '',
      storeEntityId,
      String(r.quantityOnHand),
      r.cost,
      r.room,
    ]);

  return [header, ...dataRows];
}
