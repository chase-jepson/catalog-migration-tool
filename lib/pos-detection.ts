import type { ParsedFile, POSDetectionResult } from "./types";
import { POS_SYSTEMS, POS_DEFAULTS } from "./constants";

/**
 * Score how well a POS system's default mappings match the given file headers.
 * Returns { matched, total } where matched is the count of default columns
 * found in headers and total is the number of default columns for that POS.
 */
export function scorePOS(pos: string, headers: Set<string>): { matched: number; total: number } {
  const defaults = POS_DEFAULTS[pos];
  if (!defaults) return { matched: 0, total: 0 };

  const cols = Object.values(defaults);
  const matched = cols.filter((col) => headers.has(col)).length;
  return { matched, total: cols.length };
}

/**
 * Auto-detect the POS system from parsed file headers.
 * Uses threshold of >= 3 matches AND > 40% match rate.
 * For multiple files, uses majority vote across per-file detections.
 */
export function detectPOS(files: ParsedFile[]): POSDetectionResult {
  const votes: Record<string, number> = {};

  for (const file of files) {
    const headerSet = new Set(file.headers);
    let bestPOS: string | null = null;
    let bestScore = 0;

    for (const pos of POS_SYSTEMS) {
      const { matched, total } = scorePOS(pos, headerSet);
      if (matched >= 3 && matched / total > 0.4 && matched > bestScore) {
        bestScore = matched;
        bestPOS = pos;
      }
    }

    if (bestPOS) {
      votes[bestPOS] = (votes[bestPOS] ?? 0) + 1;
    }
  }

  const entries = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return { detected: null, confidence: 0, disagreement: false };
  }

  return {
    detected: entries[0][0],
    confidence: entries[0][1] / files.length,
    disagreement: entries.length > 1,
  };
}
