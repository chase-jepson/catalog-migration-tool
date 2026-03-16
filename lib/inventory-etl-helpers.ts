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

interface SummedRow {
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
        const val = Number(String(row[field]).replace(/,/g, ''));
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
 * For each left row with N matching right rows, produces N output rows.
 * Unmatched sides get empty-string fields.
 */
export function fullJoin<L extends Record<string, any>, R extends Record<string, any>>(
  left: L[],
  right: R[],
  leftKeyFn: (item: L) => string,
  rightKeyFn: (item: R) => string,
): Record<string, any>[] {
  const result: Record<string, any>[] = [];

  // Build right index: key -> all matching rows
  const rightIndex = groupBy(right, rightKeyFn);
  const matchedRightKeys = new Set<string>();

  const leftFieldNames = left.length > 0 ? Object.keys(left[0]) : [];
  const rightFieldNames = right.length > 0 ? Object.keys(right[0]) : [];

  // Left side: produce one row per matching right row, or one row with empty right fields
  for (const l of left) {
    const key = leftKeyFn(l);
    const matchedRights = rightIndex.get(key);
    if (matchedRights && matchedRights.length > 0) {
      matchedRightKeys.add(key);
      for (const r of matchedRights) {
        result.push({ ...l, ...r });
      }
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

  // Right-only rows (keys that had no left match)
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
 * Convert various date formats to "yyyy-MM-dd".
 * Supported formats:
 *   - "M/d/yyyy" or "MM/dd/yyyy"
 *   - "yyyy-MM-dd" (already ISO, returned as-is)
 *   - "MMM d, yyyy" (e.g., "Jan 15, 2024")
 *   - "MM-dd-yyyy"
 *   - Excel serial date strings (5-digit numbers like "45678")
 * Returns empty string for empty, null, or undefined input.
 */
export function formatDateToISO(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // Already ISO: yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // M/d/yyyy or MM/dd/yyyy
  const slashMatch4 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch4) {
    const month = slashMatch4[1].padStart(2, '0');
    const day = slashMatch4[2].padStart(2, '0');
    const year = slashMatch4[3];
    return `${year}-${month}-${day}`;
  }

  // M/d/yy (2-digit year — assume 2000s)
  const slashMatch2 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashMatch2) {
    const month = slashMatch2[1].padStart(2, '0');
    const day = slashMatch2[2].padStart(2, '0');
    const year = `20${slashMatch2[3]}`;
    return `${year}-${month}-${day}`;
  }

  // MM-dd-yyyy
  const dashMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    const month = dashMatch[1];
    const day = dashMatch[2];
    const year = dashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // MMM d, yyyy (e.g., "Jan 15, 2024")
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04',
    may: '05', jun: '06', jul: '07', aug: '08',
    sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const namedMatch = trimmed.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (namedMatch) {
    const monthNum = monthNames[namedMatch[1].toLowerCase()];
    if (monthNum) {
      const day = namedMatch[2].padStart(2, '0');
      const year = namedMatch[3];
      return `${year}-${monthNum}-${day}`;
    }
  }

  // Excel serial date (5-digit number)
  if (/^\d{5}$/.test(trimmed)) {
    const serial = parseInt(trimmed, 10);
    // Excel epoch is Jan 0, 1900 (Dec 31, 1899). Serial 1 = Jan 1, 1900.
    // Excel incorrectly treats 1900 as a leap year, so serials > 59 are off by 1 day.
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + serial * 86400000;
    const date = new Date(ms);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return trimmed; // Return as-is if no format matches
}

// ── splitPotency ────────────────────────────────────────────────────────────

/**
 * Split a potency string like "23.5 %" into { amount, uom }.
 * Cleans "0.00 mg" / "0.00 %" to empty. Removes "mg/g" substring first.
 */
export function splitPotency(raw: string | null | undefined): { amount: string; uom: string } {
  const empty = { amount: '', uom: '' };
  if (!raw) return empty;

  // Strip "mg/g" substring (not a usable unit) then continue parsing
  const hadMgPerG = /mg\/g/i.test(raw);
  let cleaned = raw.replace(/mg\/g/gi, '').trim();
  if (!cleaned) return empty;

  // Split on space
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) {
    // Single value with no unit — if mg/g was the only unit, value is unusable
    if (hadMgPerG) return empty;
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
 * Extract the invoice ID from an order title.
 * Strategy: if the last segment (after final " - ") is numeric, use it.
 * Otherwise, use the first segment (before first " - ").
 * If no " - " is present, returns the full string.
 */
export function extractInvoiceId(orderTitle: string): string {
  if (!orderTitle) return '';

  const lastDashIndex = orderTitle.lastIndexOf(' - ');
  if (lastDashIndex === -1) return orderTitle;

  const lastPart = orderTitle.substring(lastDashIndex + 3).trim();
  // If last part is numeric (common Dutchie format: "VendorName - 0009730729")
  if (/^\d+$/.test(lastPart)) return lastPart;

  // Otherwise use first part (format: "0010255782 - Stick.e.vape - Tradecraft Farms")
  const firstDashIndex = orderTitle.indexOf(' - ');
  const firstPart = orderTitle.substring(0, firstDashIndex).trim();
  if (/^\d+$/.test(firstPart)) return firstPart;

  // Fallback: return last part (original behavior)
  return lastPart;
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
