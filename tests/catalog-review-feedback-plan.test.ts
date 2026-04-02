import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateFeedbackPlanMarkdown,
  writeFeedbackPlan,
} from "../.logic-review/generate-feedback-plan";

describe("generateFeedbackPlanMarkdown", () => {
  it("groups notes into actionable themes", () => {
    const root = mkdtempSync(join(tmpdir(), "catalog-feedback-plan-"));
    const feedbackPath = join(root, "notes.json");
    writeFileSync(
      feedbackPath,
      JSON.stringify({
        exportedAt: "2026-04-02T00:00:00.000Z",
        totalNotes: 2,
        notes: [
          {
            rowId: "file-1:1",
            note: "This belongs in Merch not Other.",
            fileName: "a.csv",
            rowIndex: 2,
            productName: "RAW Roller",
          },
          {
            rowId: "file-1:2",
            note: "Hemp without THC should be CBD.",
            fileName: "a.csv",
            rowIndex: 3,
            productName: "Hemp Skincare",
          },
        ],
      }),
    );

    const markdown = generateFeedbackPlanMarkdown(feedbackPath);
    expect(markdown).toContain("Merch rules");
    expect(markdown).toContain("CBD rules");
    expect(markdown).toContain("Valid import categories reference");
  });

  it("writes feedback-plan.md to the output directory", () => {
    const root = mkdtempSync(join(tmpdir(), "catalog-feedback-plan-"));
    const feedbackPath = join(root, "notes.json");
    writeFileSync(
      feedbackPath,
      JSON.stringify({ exportedAt: "2026-04-02T00:00:00.000Z", totalNotes: 0, notes: [] }),
    );

    const outputPath = writeFeedbackPlan(feedbackPath, root);
    expect(outputPath).toBe(join(root, "feedback-plan.md"));
    expect(readFileSync(outputPath, "utf-8")).toContain("Catalog Logic Feedback Plan");
  });
});
