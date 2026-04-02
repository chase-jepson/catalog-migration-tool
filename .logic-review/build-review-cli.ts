import { execFileSync } from "node:child_process";
import { rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
  const args = process.argv.slice(2);
  const openInChrome = !args.includes("--no-open");
  const positionalArgs = args.filter((arg) => arg !== "--no-open");
  const inputRoot = positionalArgs[0] ?? resolveDefaultInputRoot();
  const outputRoot = positionalArgs[1] ?? resolve(".logic-review/output");

  const data = await buildCatalogReviewData({
    inputRoot,
    outputRoot,
    originalRowMode: "full",
  });
  rmSync(resolve(outputRoot, "review-data.json"), { force: true });
  rmSync(resolve(outputRoot, "review-data.js"), { force: true });
  const { outputPath } = generateCatalogReviewSite(data, { outputRoot });

  console.log(`Wrote review site to ${outputPath}`);

  if (openInChrome) {
    openSiteInChrome(outputPath);
    console.log("Opened review site in Google Chrome");
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
