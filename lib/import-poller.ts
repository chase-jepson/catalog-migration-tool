/**
 * Import polling utilities: ETA calculation, adaptive intervals, status detection.
 */

const TERMINAL_STATUSES = new Set([
  "FINISHED",
  "FINISHED_WITH_FAILURES",
  "FINISHED_AND_STOPPED_EARLY",
]);

/**
 * Calculate estimated time remaining for the import process.
 *
 * @param startTime - Unix timestamp (ms) when import started
 * @param completedFiles - Number of files fully completed
 * @param totalFiles - Total number of files to import
 * @param currentFileProgress - Progress of current file (0-1)
 * @returns Human-readable ETA string
 */
export function calculateETA(
  startTime: number,
  completedFiles: number,
  totalFiles: number,
  currentFileProgress: number,
): string {
  const effectiveCompleted = completedFiles + currentFileProgress;

  if (effectiveCompleted <= 0) return "Calculating...";

  const elapsed = Date.now() - startTime;
  const msPerFile = elapsed / effectiveCompleted;
  const remaining = totalFiles - effectiveCompleted;
  const remainingMs = remaining * msPerFile;

  const totalSec = Math.ceil(remainingMs / 1000);
  if (totalSec <= 0) return "Almost done...";

  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  if (minutes > 0) {
    return `~${minutes}m ${seconds}s remaining`;
  }
  return `~${seconds}s remaining`;
}

/**
 * Get the polling interval based on total row count.
 * Smaller datasets poll more frequently for faster feedback.
 *
 * @param totalRows - Total number of rows across all files
 * @returns Polling interval in milliseconds
 */
export function getAdaptiveInterval(totalRows: number): number {
  return totalRows < 1000 ? 5000 : 15000;
}

/**
 * Check if an import job status is terminal (complete or failed).
 */
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Maximum polling duration per file (60 minutes) */
export const MAX_POLL_DURATION_MS = 60 * 60 * 1000;
