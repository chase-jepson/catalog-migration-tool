import { readFileSync } from "node:fs";

export interface ReviewFeedbackNote {
  rowId: string;
  note: string;
  fileName: string | null;
  rowIndex: number | null;
  productName: string | null;
  expectedCategory?: string | null;
  expectedAmount?: string | null;
  expectedUom?: string | null;
  expectedThcPresence?: string | null;
  issueTypes?: string[] | null;
  evidence?: string | null;
}

export interface ReviewFeedbackPayload {
  exportedAt: string;
  totalNotes: number;
  notes: ReviewFeedbackNote[];
}

export function loadReviewFeedback(feedbackPath: string): ReviewFeedbackPayload {
  return JSON.parse(readFileSync(feedbackPath, "utf-8")) as ReviewFeedbackPayload;
}

export function normalizeFeedbackName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}
