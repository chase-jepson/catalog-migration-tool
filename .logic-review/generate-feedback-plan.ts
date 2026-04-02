import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadReviewFeedback, type ReviewFeedbackNote } from "./feedback";
import { PRODUCT_CATEGORIES } from "../lib/constants";

function classifyTheme(note: ReviewFeedbackNote): string {
  const text = note.note.toLowerCase();
  if (text.includes("merch")) return "Merch rules";
  if (text.includes("hemp") || text.includes("cbd")) return "CBD rules";
  if (text.includes("drops") || text.includes("tincture") || text.includes("edible")) {
    return "Drops / ingestible rules";
  }
  if (text.includes("3.5") || text.includes("grams") || text.includes("flower")) {
    return "Flower amount extraction";
  }
  if (text.includes("thc")) return "THC evidence rules";
  if (text.includes("category")) return "Category constraints";
  return "General review fixes";
}

function formatThemeSection(theme: string, notes: ReviewFeedbackNote[]): string {
  const lines = [`### ${theme}`, ""];
  const uniqueProducts = new Set(notes.map((note) => note.productName ?? note.rowId));
  lines.push(`- Affected reviewed rows: ${notes.length}`);
  lines.push(`- Distinct products: ${uniqueProducts.size}`);
  lines.push("");
  lines.push("Examples:");
  for (const note of notes.slice(0, 5)) {
    lines.push(
      `- \`${note.rowId}\` ${note.productName ?? "(unknown product)"}: ${note.note}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function generateFeedbackPlanMarkdown(feedbackPath: string): string {
  const feedback = loadReviewFeedback(feedbackPath);
  const grouped = new Map<string, ReviewFeedbackNote[]>();
  for (const note of feedback.notes) {
    const theme = classifyTheme(note);
    grouped.set(theme, [...(grouped.get(theme) ?? []), note]);
  }

  const sections = [...grouped.entries()]
    .sort((left, right) => right[1].length - left[1].length)
    .map(([theme, notes]) => formatThemeSection(theme, notes))
    .join("\n");

  return `# Catalog Logic Feedback Plan

Generated from \`${feedbackPath}\`

## Batch Summary

- Exported at: ${feedback.exportedAt}
- Reviewed notes: ${feedback.totalNotes}
- Valid import categories reference: ${PRODUCT_CATEGORIES.join(", ")}
- Data-skill reminder: use the import enum as the source of truth; remap blank or invalid outputs into allowed Treez categories instead of inventing new categories.

## Immediate Work

1. Preserve the valid Treez category set and eliminate blank/invalid category outputs.
2. Tighten merch/accessory heuristics for wraps, bags, and rollers.
3. Add CBD bias for hemp products without THC evidence.
4. Improve drops classification fallback.
5. Strengthen flower amount/UOM extraction for name-based weights like \`3.5\`.
6. Separate THC branding from real potency evidence.

## Theme Breakdown

${sections}`.trim() + "\n";
}

export function writeFeedbackPlan(feedbackPath: string, outputRoot: string): string {
  mkdirSync(outputRoot, { recursive: true });
  const outputPath = join(outputRoot, "feedback-plan.md");
  writeFileSync(outputPath, generateFeedbackPlanMarkdown(feedbackPath));
  return outputPath;
}

export function main() {
  const feedbackPath = process.argv[2];
  if (!feedbackPath) {
    throw new Error("Usage: generate-feedback-plan-cli.ts <notes-json-path> [output-root]");
  }
  const outputRoot = process.argv[3] ?? resolve(".logic-review");
  const outputPath = writeFeedbackPlan(feedbackPath, outputRoot);
  console.log(`Wrote feedback plan to ${outputPath}`);
}
