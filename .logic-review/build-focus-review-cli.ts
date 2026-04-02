import { execFileSync } from "node:child_process";
import { rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadReviewFeedback } from "./feedback";
import { buildFocusedReviewData } from "./focus-review";
import { generateCatalogReviewSite } from "./generate-site";
import { buildCatalogReviewData } from "./run-review";

const DEFAULT_EXCLUDED_POS = ["Blaze"];
const DEFAULT_PREFERRED_POS = ["Dutchie", "Flowhub", "Cova"];

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
  const args = process.argv.slice(2);
  const openInChrome = !args.includes("--no-open");
  const positionalArgs = args.filter((arg) => arg !== "--no-open");
  const feedbackPath = positionalArgs[0];
  if (!feedbackPath) {
    throw new Error("Usage: build-focus-review-cli.ts <notes-json-path> [input-root] [output-root]");
  }

  const inputRoot = positionalArgs[1] ?? resolveDefaultInputRoot();
  const outputRoot = positionalArgs[2] ?? resolve(".logic-review/output");

  const data = await buildCatalogReviewData({
    inputRoot,
    outputRoot,
    originalRowMode: "full",
  });
  const feedback = loadReviewFeedback(feedbackPath);
  const focusedData = buildFocusedReviewData(data, feedback, {
    excludedPOS: DEFAULT_EXCLUDED_POS,
    preferredPOS: DEFAULT_PREFERRED_POS,
  });

  rmSync(resolve(outputRoot, "review-data.json"), { force: true });
  rmSync(resolve(outputRoot, "review-data.js"), { force: true });
  const { outputPath } = generateCatalogReviewSite(focusedData, { outputRoot });

  console.log(`Wrote focused review site to ${outputPath}`);

  if (openInChrome) {
    openSiteInChrome(outputPath);
    console.log("Opened focused review site in Google Chrome");
  }
}

function openSiteInChrome(outputPath: string) {
  const fileUrl = pathToFileURL(outputPath).href;
  if (process.platform === "darwin") {
    execFileSync("osascript", [
      "-e",
      `tell application "Google Chrome"
activate
open location "${fileUrl}"
end tell`,
    ]);
    return;
  }

  execFileSync("open", ["-a", "Google Chrome", outputPath]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
