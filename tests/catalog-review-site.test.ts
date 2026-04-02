import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CatalogReviewData } from "../.logic-review/review-types";
import { generateCatalogReviewSite } from "../.logic-review/generate-site";

describe("generateCatalogReviewSite", () => {
  it("renders original values, transformed values, and confidence metadata in score order", () => {
    const outputRoot = mkdtempSync(join(tmpdir(), "catalog-review-site-"));
    mkdirSync(outputRoot, { recursive: true });

    const data: CatalogReviewData = {
      generatedAt: "2026-04-02T00:00:00.000Z",
      inputRoot: "/tmp/input",
      files: [
        {
          id: "file-1",
          posFolder: "Dutchie",
          fileName: "export.csv",
          filePath: "/tmp/input/Dutchie/export.csv",
          detectedPOS: "Dutchie",
          detectedPOSConfidence: 0.95,
          totalRows: 2,
        },
      ],
      rows: [
        {
          id: "row-low",
          source: {
            fileId: "file-1",
            filePath: "/tmp/input/Dutchie/export.csv",
            fileName: "export.csv",
            posFolder: "Dutchie",
            detectedPOS: "Dutchie",
            detectedPOSConfidence: 0.95,
            rowIndex: 0,
            originalRow: {
              Product: "Low Confidence Item",
              Potency: "THC 100mg",
              Category: "Edible",
            },
          },
          derived: {
            productName: "Low Confidence Item",
            category: "Misc",
            subCategory: "Misc - General",
            uom: "grams",
            amount: 0,
          },
          validation: { errors: [], warnings: [] },
          confidence: {
            score: 42,
            categoryConfidence: 0.2,
            amountConfidence: 0.3,
            thcConfidence: 0.9,
            uomConfidence: 0.8,
            reasons: [{ code: "weak-category", message: "Category resolved to Misc", deduction: 35 }],
          },
        },
        {
          id: "row-high",
          source: {
            fileId: "file-1",
            filePath: "/tmp/input/Dutchie/export.csv",
            fileName: "export.csv",
            posFolder: "Dutchie",
            detectedPOS: "Dutchie",
            detectedPOSConfidence: 0.95,
            rowIndex: 1,
            originalRow: { Product: "High Confidence Item", Category: "Flower" },
          },
          derived: {
            productName: "High Confidence Item",
            category: "Flower",
            subCategory: "Flower - General",
            uom: "grams",
            amount: 3.5,
          },
          validation: { errors: [], warnings: [] },
          confidence: {
            score: 95,
            categoryConfidence: 0.95,
            amountConfidence: 0.95,
            thcConfidence: 0.95,
            uomConfidence: 0.95,
            reasons: [],
          },
        },
      ],
    };

    const { html, outputPath } = generateCatalogReviewSite(data, { outputRoot });
    const manifest = readFileSync(join(outputRoot, "manifest.js"), "utf-8");
    const page = readFileSync(join(outputRoot, "pages", "page-0001.js"), "utf-8");

    expect(html).toContain("Confidence");
    expect(html).toContain("manifest.js");
    expect(html).toContain("page-");
    expect(html).toContain("Download Notes JSON");
    expect(html).toContain("All Source Fields");
    expect(html).toContain("Reviewer Notes");
    expect(manifest).toContain("filesById");
    expect(page.indexOf("Low Confidence Item")).toBeLessThan(page.indexOf("High Confidence Item"));
    expect(page).toContain("Category resolved to Misc");
    expect(page).toContain("Low Confidence Item");
    expect(page).toContain("High Confidence Item");
    expect(page).toContain("THC 100mg");
    expect(outputPath).toBe(join(outputRoot, "index.html"));
  });
});
