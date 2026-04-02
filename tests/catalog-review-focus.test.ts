import { describe, expect, it } from "vitest";
import { buildFocusedReviewData } from "../.logic-review/focus-review";
import type { CatalogReviewData } from "../.logic-review/review-types";
import type { ReviewFeedbackPayload } from "../.logic-review/feedback";

describe("buildFocusedReviewData", () => {
  it("keeps reviewed rows, same-name rows, and low-confidence extras", () => {
    const data: CatalogReviewData = {
      generatedAt: "2026-04-02T00:00:00.000Z",
      inputRoot: "/tmp/input",
      files: [
        {
          id: "file-1",
          posFolder: "Square",
          fileName: "a.csv",
          filePath: "/tmp/input/a.csv",
          detectedPOS: "Square",
          detectedPOSConfidence: 0.9,
          totalRows: 4,
        },
      ],
      rows: [
        {
          id: "file-1:0",
          source: {
            fileId: "file-1",
            filePath: "/tmp/input/a.csv",
            fileName: "a.csv",
            posFolder: "Square",
            detectedPOS: "Square",
            detectedPOSConfidence: 0.9,
            rowIndex: 0,
            originalRow: { Name: "Love Plus Hemp Skincare" },
          },
          derived: { productName: "Love Plus Hemp Skincare", category: "Misc" },
          validation: { errors: [], warnings: [] },
          confidence: {
            score: 10,
            categoryConfidence: 0.2,
            amountConfidence: 1,
            thcConfidence: 1,
            uomConfidence: 1,
            reasons: [],
          },
        },
        {
          id: "file-1:1",
          source: {
            fileId: "file-1",
            filePath: "/tmp/input/a.csv",
            fileName: "a.csv",
            posFolder: "Square",
            detectedPOS: "Square",
            detectedPOSConfidence: 0.9,
            rowIndex: 1,
            originalRow: { Name: "Love Plus Hemp Skincare" },
          },
          derived: { productName: "Love Plus Hemp Skincare", category: "CBD" },
          validation: { errors: [], warnings: [] },
          confidence: {
            score: 20,
            categoryConfidence: 0.8,
            amountConfidence: 1,
            thcConfidence: 1,
            uomConfidence: 1,
            reasons: [],
          },
        },
        {
          id: "file-1:2",
          source: {
            fileId: "file-1",
            filePath: "/tmp/input/a.csv",
            fileName: "a.csv",
            posFolder: "Square",
            detectedPOS: "Square",
            detectedPOSConfidence: 0.9,
            rowIndex: 2,
            originalRow: { Name: "Fallback row" },
          },
          derived: { productName: "Fallback row", category: "Flower" },
          validation: { errors: [], warnings: [] },
          confidence: {
            score: 30,
            categoryConfidence: 1,
            amountConfidence: 1,
            thcConfidence: 1,
            uomConfidence: 1,
            reasons: [],
          },
        },
        {
          id: "file-1:3",
          source: {
            fileId: "file-1",
            filePath: "/tmp/input/a.csv",
            fileName: "a.csv",
            posFolder: "Square",
            detectedPOS: "Square",
            detectedPOSConfidence: 0.9,
            rowIndex: 3,
            originalRow: { Name: "High confidence row" },
          },
          derived: { productName: "High confidence row", category: "Flower" },
          validation: { errors: [], warnings: [] },
          confidence: {
            score: 99,
            categoryConfidence: 1,
            amountConfidence: 1,
            thcConfidence: 1,
            uomConfidence: 1,
            reasons: [],
          },
        },
      ],
    };

    const feedback: ReviewFeedbackPayload = {
      exportedAt: "2026-04-02T00:00:00.000Z",
      totalNotes: 1,
      notes: [
        {
          rowId: "file-1:0",
          note: "Hemp should be CBD",
          fileName: "a.csv",
          rowIndex: 1,
          productName: "Love Plus Hemp Skincare",
        },
      ],
    };

    const focused = buildFocusedReviewData(data, feedback, {
      lowConfidenceLimit: 1,
      similarNameLimit: 2,
      nearbyRowWindow: 0,
    });

    expect(focused.rows.map((row) => row.id)).toEqual(["file-1:0", "file-1:1", "file-1:2"]);
  });
});
