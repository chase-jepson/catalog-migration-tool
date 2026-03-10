import { ROOM_TO_LOCATION_PATH } from './inventory-constants';

// ── groupBy ─────────────────────────────────────────────────────────────────

/** Group an array of objects by a key function. Returns a Map of key -> items. */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

// ── sumByGroup ──────────────────────────────────────────────────────────────

export interface SummedRow {
  _groupKey: string;
  [field: string]: string | number;
}

/**
 * Group rows by key function and sum specified numeric fields per group.
 * Non-numeric values in sum fields are treated as 0.
 * Returns one row per group with _groupKey and summed fields.
 */
export function sumByGroup<T extends Record<string, any>>(
  items: T[],
  keyFn: (item: T) => string,
  sumFields: string[],
): SummedRow[] {
  const groups = groupBy(items, keyFn);
  const result: SummedRow[] = [];

  for (const [key, rows] of groups) {
    const summed: SummedRow = { _groupKey: key };
    for (const field of sumFields) {
      let total = 0;
      for (const row of rows) {
        const val = Number(row[field]);
        if (!Number.isNaN(val)) {
          total += val;
        }
      }
      summed[field] = total;
    }
    result.push(summed);
  }

  return result;
}

// ── leftJoin ────────────────────────────────────────────────────────────────

/**
 * Left join two arrays of objects. Unmatched left rows get empty-string right fields.
 * For duplicate right keys, the first match wins.
 */
export function leftJoin<L extends Record<string, any>, R extends Record<string, any>>(
  left: L[],
  right: R[],
  leftKeyFn: (item: L) => string,
  rightKeyFn: (item: R) => string,
): Record<string, any>[] {
  // Build index from right side: key -> first matching row
  const rightIndex = new Map<string, R>();
  const rightKeys = new Set<string>();
  for (const r of right) {
    const key = rightKeyFn(r);
    if (!rightIndex.has(key)) {
      rightIndex.set(key, r);
    }
    rightKeys.add(key);
  }

  // Determine all right-side field names for empty fill
  const rightFieldNames = right.length > 0 ? Object.keys(right[0]) : [];

  return left.map((l) => {
    const key = leftKeyFn(l);
    const matchedRight = rightIndex.get(key);
    if (matchedRight) {
      return { ...l, ...matchedRight };
    }
    // Unmatched: fill right fields with empty strings
    const emptyRight: Record<string, string> = {};
    for (const field of rightFieldNames) {
      if (!(field in l)) {
        emptyRight[field] = '';
      }
    }
    return { ...l, ...emptyRight };
  });
}

// ── fullJoin ────────────────────────────────────────────────────────────────

/**
 * Full outer join two arrays of objects. Rows from both sides included.
 * Unmatched sides get empty-string fields.
 */
export function fullJoin<L extends Record<string, any>, R extends Record<string, any>>(
  left: L[],
  right: R[],
  leftKeyFn: (item: L) => string,
  rightKeyFn: (item: R) => string,
): Record<string, any>[] {
  const result: Record<string, any>[] = [];

  // Build right index
  const rightIndex = new Map<string, R>();
  const matchedRightKeys = new Set<string>();
  for (const r of right) {
    const key = rightKeyFn(r);
    if (!rightIndex.has(key)) {
      rightIndex.set(key, r);
    }
  }

  const leftFieldNames = left.length > 0 ? Object.keys(left[0]) : [];
  const rightFieldNames = right.length > 0 ? Object.keys(right[0]) : [];

  // Left side: match or fill empty right
  for (const l of left) {
    const key = leftKeyFn(l);
    const matchedRight = rightIndex.get(key);
    if (matchedRight) {
      matchedRightKeys.add(key);
      result.push({ ...l, ...matchedRight });
    } else {
      const emptyRight: Record<string, string> = {};
      for (const field of rightFieldNames) {
        if (!(field in l)) {
          emptyRight[field] = '';
        }
      }
      result.push({ ...l, ...emptyRight });
    }
  }

  // Right-only rows
  for (const r of right) {
    const key = rightKeyFn(r);
    if (!matchedRightKeys.has(key)) {
      matchedRightKeys.add(key); // avoid duplicates from right side
      const emptyLeft: Record<string, string> = {};
      for (const field of leftFieldNames) {
        if (!(field in r)) {
          emptyLeft[field] = '';
        }
      }
      result.push({ ...emptyLeft, ...r });
    }
  }

  return result;
}

// ── formatDateToISO ─────────────────────────────────────────────────────────

/**
 * Convert "MM/dd/yyyy" or "M/d/yyyy" to "yyyy-MM-dd".
 * Returns empty string for empty, null, or undefined input.
 */
export function formatDateToISO(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return trimmed; // Return as-is if format doesn't match

  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  const year = match[3];

  return `${year}-${month}-${day}`;
}

// ── splitPotency ────────────────────────────────────────────────────────────

/**
 * Split a potency string like "23.5 %" into { amount, uom }.
 * Cleans "0.00 mg" / "0.00 %" to empty. Removes "mg/g" substring first.
 */
export function splitPotency(raw: string | null | undefined): { amount: string; uom: string } {
  const empty = { amount: '', uom: '' };
  if (!raw) return empty;

  // Remove mg/g substring
  let cleaned = raw.replace(/mg\/g/g, '').trim();
  if (!cleaned) return empty;

  // Split on space
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) {
    // Single value with no unit
    const amount = parts[0];
    if (amount === '0.00' || amount === '0') return empty;
    return { amount, uom: '' };
  }

  const amount = parts[0];
  const uom = parts[1];

  // Clean "0.00 mg" and "0.00 %" to empty
  if (amount === '0.00' || amount === '0') {
    return empty;
  }

  return { amount, uom };
}

// ── extractInvoiceId ────────────────────────────────────────────────────────

/**
 * Extract text after the last " - " from an order title.
 * If no " - " is present, returns the full string.
 */
export function extractInvoiceId(orderTitle: string): string {
  if (!orderTitle) return '';

  const lastDashIndex = orderTitle.lastIndexOf(' - ');
  if (lastDashIndex === -1) return orderTitle;

  return orderTitle.substring(lastDashIndex + 3);
}

// ── deriveCustomerType ──────────────────────────────────────────────────────

/**
 * Derive customer type from "Available for" column.
 * "All enabled customer types" or "Adult" or blank -> "ADULT"; else "MEDICAL"
 */
export function deriveCustomerType(availableFor: string): string {
  if (!availableFor || availableFor.trim() === '') return 'ADULT';
  const lower = availableFor.toLowerCase();
  if (lower.includes('all enabled customer types') || lower === 'adult') return 'ADULT';
  return 'MEDICAL';
}

// ── deriveLocationPath ──────────────────────────────────────────────────────

/**
 * Map room names to Treez location paths per spec.
 */
export function deriveLocationPath(room: string): string {
  if (!room) return '';
  return ROOM_TO_LOCATION_PATH[room] ?? '';
}

// ── deriveLocationIsSellable ────────────────────────────────────────────────

/**
 * "TRUE" if Location Path contains "Front of House"; else "FALSE"
 */
export function deriveLocationIsSellable(locationPath: string): string {
  return locationPath.includes('Front of House') ? 'TRUE' : 'FALSE';
}

// ── deriveLocationDefaultReceiving ──────────────────────────────────────────

/**
 * "TRUE" if Location Path equals "Back of House, Back Stock"; else "FALSE"
 */
export function deriveLocationDefaultReceiving(locationPath: string): string {
  return locationPath === 'Back of House, Back Stock' ? 'TRUE' : 'FALSE';
}

// ── deriveLocationInventoryType ─────────────────────────────────────────────

/**
 * "Medical" if customerType = "MEDICAL"; else "All Types"
 */
export function deriveLocationInventoryType(customerType: string): string {
  return customerType === 'MEDICAL' ? 'Medical' : 'All Types';
}
