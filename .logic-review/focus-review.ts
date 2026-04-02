import type { CatalogReviewData, CatalogReviewRow } from "./review-types";
import { normalizeFeedbackName, type ReviewFeedbackPayload } from "./feedback";

export interface FocusReviewOptions {
  similarNameLimit?: number;
  lowConfidenceLimit?: number;
  nearbyRowWindow?: number;
}

const DEFAULT_OPTIONS: Required<FocusReviewOptions> = {
  similarNameLimit: 50,
  lowConfidenceLimit: 40,
  nearbyRowWindow: 2,
};

export function buildFocusedReviewData(
  data: CatalogReviewData,
  feedback: ReviewFeedbackPayload,
  options: FocusReviewOptions = {},
): CatalogReviewData {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const rowsById = new Map(data.rows.map((row) => [row.id, row]));
  const selected = new Map<string, CatalogReviewRow>();

  const feedbackIds = new Set(feedback.notes.map((note) => note.rowId));
  const feedbackNames = new Set(
    feedback.notes.map((note) => normalizeFeedbackName(note.productName)).filter(Boolean),
  );

  for (const rowId of feedbackIds) {
    const row = rowsById.get(rowId);
    if (row) selected.set(row.id, row);
  }

  for (const row of data.rows) {
    if (feedbackNames.has(normalizeFeedbackName(row.derived.productName))) {
      selected.set(row.id, row);
    }
  }

  for (const note of feedback.notes) {
    const row = rowsById.get(note.rowId);
    if (!row) continue;

    const sameFileRows = data.rows.filter((candidate) => candidate.source.fileId === row.source.fileId);
    const minIndex = Math.max(0, row.source.rowIndex - resolved.nearbyRowWindow);
    const maxIndex = row.source.rowIndex + resolved.nearbyRowWindow;
    for (const candidate of sameFileRows) {
      if (candidate.source.rowIndex >= minIndex && candidate.source.rowIndex <= maxIndex) {
        selected.set(candidate.id, candidate);
      }
    }
  }

  let similarCount = 0;
  for (const row of data.rows) {
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

  let lowConfidenceCount = 0;
  for (const row of data.rows) {
    if (selected.has(row.id)) continue;
    selected.set(row.id, row);
    lowConfidenceCount += 1;
    if (lowConfidenceCount >= resolved.lowConfidenceLimit) break;
  }

  return {
    ...data,
    rows: [...selected.values()].sort((left, right) => left.confidence.score - right.confidence.score),
  };
}
