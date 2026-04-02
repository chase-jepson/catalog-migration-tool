import { rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { buildCatalogReviewData } from "./run-review";
import { generateCatalogReviewSite } from "./generate-site";

function resolveDefaultInputRoot(): string {
  const candidates = [
    resolve(".test-data/exports/catalog"),
    resolve("../../.test-data/exports/catalog"),
  ];

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return candidates[0];
}

async function main() {
  const inputRoot = process.argv[2] ?? resolveDefaultInputRoot();
  const outputRoot = process.argv[3] ?? resolve(".logic-review/output");

  const data = await buildCatalogReviewData({ inputRoot, outputRoot });
  rmSync(resolve(outputRoot, "review-data.json"), { force: true });
  rmSync(resolve(outputRoot, "review-data.js"), { force: true });
  const { outputPath } = generateCatalogReviewSite(data, { outputRoot });

  console.log(`Wrote review site to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
