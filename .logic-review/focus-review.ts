import type { CatalogReviewData, CatalogReviewRow } from "./review-types";
import { normalizeFeedbackName, type ReviewFeedbackPayload } from "./feedback";

export interface FocusReviewOptions {
  similarNameLimit?: number;
  lowConfidenceLimit?: number;
  nearbyRowWindow?: number;
  excludedPOS?: string[];
  preferredPOS?: string[];
}

const DEFAULT_OPTIONS: Required<FocusReviewOptions> = {
  similarNameLimit: 50,
  lowConfidenceLimit: 40,
  nearbyRowWindow: 2,
  excludedPOS: [],
  preferredPOS: [],
};

function normalizePOS(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function buildFocusedReviewData(
  data: CatalogReviewData,
  feedback: ReviewFeedbackPayload,
  options: FocusReviewOptions = {},
): CatalogReviewData {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const excludedPOS = new Set(resolved.excludedPOS.map(normalizePOS).filter(Boolean));
  const preferredPOS = new Set(resolved.preferredPOS.map(normalizePOS).filter(Boolean));
  const allowedRows = data.rows.filter((row) => {
    const detectedPOS = normalizePOS(row.source.detectedPOS);
    const posFolder = normalizePOS(row.source.posFolder);
    return !excludedPOS.has(detectedPOS) && !excludedPOS.has(posFolder);
  });
  const rowsById = new Map(allowedRows.map((row) => [row.id, row]));
  const selected = new Map<string, CatalogReviewRow>();

  const feedbackIds = new Set(feedback.notes.map((note) => note.rowId));
  const feedbackNames = new Set(
    feedback.notes.map((note) => normalizeFeedbackName(note.productName)).filter(Boolean),
  );

  for (const rowId of feedbackIds) {
    const row = rowsById.get(rowId);
    if (row) selected.set(row.id, row);
  }

  for (const row of allowedRows) {
    if (feedbackNames.has(normalizeFeedbackName(row.derived.productName))) {
      selected.set(row.id, row);
    }
  }

  for (const note of feedback.notes) {
    const row = rowsById.get(note.rowId);
    if (!row) continue;

    const sameFileRows = allowedRows.filter((candidate) => candidate.source.fileId === row.source.fileId);
    const minIndex = Math.max(0, row.source.rowIndex - resolved.nearbyRowWindow);
    const maxIndex = row.source.rowIndex + resolved.nearbyRowWindow;
    for (const candidate of sameFileRows) {
      if (candidate.source.rowIndex >= minIndex && candidate.source.rowIndex <= maxIndex) {
        selected.set(candidate.id, candidate);
      }
    }
  }

  let similarCount = 0;
  for (const row of allowedRows) {
    if (selected.has(row.id)) continue;
    if (
      feedback.notes.some(
        (note) =>
          row.confidence.reasons.some((reason) =>
            note.note.toLowerCase().includes(reason.code.replace(/-/g, " ")),
          ) || row.derived.category === note.expectedCategory,
      )
    ) {
      selected.set(row.id, row);
      similarCount += 1;
      if (similarCount >= resolved.similarNameLimit) break;
    }
  }

  const preferredRows = allowedRows.filter((row) => {
    const detectedPOS = normalizePOS(row.source.detectedPOS);
    const posFolder = normalizePOS(row.source.posFolder);
    return preferredPOS.size === 0 || preferredPOS.has(detectedPOS) || preferredPOS.has(posFolder);
  });

  let lowConfidenceCount = 0;
  for (const row of [...preferredRows, ...allowedRows]) {
    if (selected.has(row.id)) continue;
    selected.set(row.id, row);
    lowConfidenceCount += 1;
    if (lowConfidenceCount >= resolved.lowConfidenceLimit) break;
  }

  const selectedRows = [...selected.values()].sort(
    (left, right) => left.confidence.score - right.confidence.score,
  );
  const selectedFileIds = new Set(selectedRows.map((row) => row.source.fileId));

  return {
    ...data,
    files: data.files.filter((file) => selectedFileIds.has(file.id)),
    rows: selectedRows,
  };
}
