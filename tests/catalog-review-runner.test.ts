import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCatalogReviewData, writeCatalogReviewData } from "../.logic-review/run-review";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

describe("buildCatalogReviewData", () => {
  it("discovers exports, transforms rows, and sorts review rows by ascending confidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "catalog-review-runner-"));
    const inputRoot = join(root, "exports", "catalog", "Dutchie");
    const outputRoot = join(root, "output");
    mkdirSync(inputRoot, { recursive: true });
    mkdirSync(outputRoot, { recursive: true });

    writeFileSync(join(inputRoot, "dutchie-export.csv"), fixture("dutchie-sample.csv"));

    const reviewData = await buildCatalogReviewData({
      inputRoot: join(root, "exports", "catalog"),
      outputRoot,
    });

    expect(reviewData.files).toHaveLength(1);
    expect(reviewData.rows.length).toBeGreaterThan(0);
    expect(reviewData.rows[0].confidence.score).toBeLessThanOrEqual(
      reviewData.rows.at(-1)?.confidence.score ?? 100,
    );
    expect(reviewData.rows[0].source.filePath).toContain("dutchie-export.csv");
    expect(reviewData.rows[0].derived.productName).toBeTruthy();
  });

  it("writes review-data.json to the requested output directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "catalog-review-runner-"));
    const inputRoot = join(root, "exports", "catalog", "Dutchie");
    const outputRoot = join(root, "output");
    mkdirSync(inputRoot, { recursive: true });
    mkdirSync(outputRoot, { recursive: true });

    writeFileSync(join(inputRoot, "dutchie-export.csv"), fixture("dutchie-sample.csv"));

    const reviewData = await buildCatalogReviewData({
      inputRoot: join(root, "exports", "catalog"),
      outputRoot,
    });
    const outputPath = writeCatalogReviewData(reviewData, outputRoot);

    expect(outputPath).toBe(join(outputRoot, "review-data.json"));
    expect(readFileSync(outputPath, "utf-8")).toContain("\"rows\"");
  });
});
