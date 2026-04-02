import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogReviewData } from "./review-types";

export interface GenerateCatalogReviewSiteOptions {
  outputRoot: string;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 250;

export function generateCatalogReviewSite(
  data: CatalogReviewData,
  { outputRoot, pageSize = DEFAULT_PAGE_SIZE }: GenerateCatalogReviewSiteOptions,
) {
  mkdirSync(outputRoot, { recursive: true });
  const pagesRoot = join(outputRoot, "pages");
  rmSync(join(outputRoot, "review-data.js"), { force: true });
  rmSync(pagesRoot, { recursive: true, force: true });
  mkdirSync(pagesRoot, { recursive: true });

  const rows = [...data.rows].sort((left, right) => left.confidence.score - right.confidence.score);
  const filesById = Object.fromEntries(
    data.files.map((file) => [
      file.id,
      {
        fileName: file.fileName,
        filePath: file.filePath,
        posFolder: file.posFolder,
        detectedPOS: file.detectedPOS,
        detectedPOSConfidence: file.detectedPOSConfidence,
      },
    ]),
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize).map((row) => ({
      fileId: row.source.fileId,
      rowIndex: row.source.rowIndex,
      originalRow: row.source.originalRow,
      derived: row.derived,
      validation: row.validation,
      confidence: row.confidence,
    }));
    const pageNumber = pageIndex + 1;
    const pagePath = join(pagesRoot, `page-${String(pageNumber).padStart(4, "0")}.js`);
    writeFileSync(
      pagePath,
      `window.CATALOG_REVIEW_PAGES = window.CATALOG_REVIEW_PAGES || {}; window.CATALOG_REVIEW_PAGES[${pageNumber}] = ${JSON.stringify(pageRows)};`,
    );
  }

  const manifest = {
    generatedAt: data.generatedAt,
    inputRoot: data.inputRoot,
    totalRows: rows.length,
    totalPages,
    pageSize,
    filesById,
  };
  writeFileSync(
    join(outputRoot, "manifest.js"),
    `window.CATALOG_REVIEW_MANIFEST = ${JSON.stringify(manifest)};`,
  );

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Catalog Logic Review</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f3ee;
      --surface: #fffdf8;
      --surface-strong: #ffffff;
      --text: #1d2614;
      --muted: #5e6853;
      --border: #d8ddcf;
      --accent: #23451b;
      --accent-soft: #dce8cf;
      --danger: #8b1e24;
      --shadow: 0 16px 40px rgba(25, 35, 16, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
      background:
        radial-gradient(circle at top left, rgba(133, 161, 93, 0.18), transparent 28%),
        linear-gradient(180deg, #f8f7f1 0%, var(--bg) 100%);
      color: var(--text);
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(14px);
      background: rgba(244, 243, 238, 0.92);
      border-bottom: 1px solid rgba(29, 38, 20, 0.08);
      padding: 20px 24px 16px;
    }
    .header-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
    }
    h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3.4rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
    }
    .lede {
      margin: 8px 0 0;
      color: var(--muted);
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-auto-flow: column;
      gap: 12px;
      justify-content: end;
    }
    .pill {
      padding: 10px 14px;
      border-radius: 999px;
      background: var(--surface-strong);
      border: 1px solid var(--border);
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
      font-size: 12px;
      color: var(--muted);
      box-shadow: var(--shadow);
    }
    .controls {
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 18px 24px 0;
      align-items: center;
    }
    .page-controls {
      display: flex;
      gap: 10px;
      align-items: center;
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
    }
    button, input {
      font: inherit;
    }
    button {
      border: 1px solid var(--border);
      background: var(--surface-strong);
      color: var(--text);
      border-radius: 999px;
      padding: 10px 14px;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    input[type="search"] {
      width: 100%;
      border-radius: 16px;
      border: 1px solid var(--border);
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.88);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
    }
    main {
      padding: 20px 24px 40px;
      display: grid;
      gap: 16px;
    }
    .card {
      background: rgba(255, 253, 248, 0.94);
      border: 1px solid rgba(35, 69, 27, 0.12);
      border-radius: 24px;
      padding: 20px;
      box-shadow: var(--shadow);
    }
    .card-top {
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      margin-bottom: 14px;
    }
    .card h2 {
      margin: 0;
      font-size: 1.4rem;
      line-height: 1.1;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      color: var(--muted);
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
      font-size: 12px;
    }
    .score {
      min-width: 98px;
      text-align: center;
      padding: 12px 14px;
      border-radius: 20px;
      background: linear-gradient(180deg, #fff7ef 0%, #f3d7bf 100%);
      color: var(--danger);
      border: 1px solid rgba(139, 30, 36, 0.14);
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
      font-size: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .score strong {
      display: block;
      font-size: 1.65rem;
      letter-spacing: -0.04em;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .pane {
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      background: var(--surface-strong);
    }
    .pane h3 {
      margin: 0;
      padding: 12px 14px;
      background: var(--accent-soft);
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      vertical-align: top;
      padding: 8px 10px;
      border-bottom: 1px solid #edf0e8;
    }
    th {
      width: 34%;
      color: var(--muted);
      font-weight: 600;
    }
    .reasons {
      margin-top: 14px;
      display: grid;
      gap: 8px;
    }
    .reason {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 14px;
      background: #f8f2ea;
      border: 1px solid rgba(139, 30, 36, 0.08);
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
      font-size: 13px;
    }
    .empty {
      padding: 32px;
      border-radius: 20px;
      border: 1px dashed var(--border);
      text-align: center;
      color: var(--muted);
      background: rgba(255,255,255,0.6);
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
    }
    @media (max-width: 900px) {
      .header-grid, .controls, .card-top, .columns {
        grid-template-columns: 1fr;
      }
      .summary {
        grid-auto-flow: row;
        justify-content: start;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-grid">
      <div>
        <h1>Catalog Logic Review</h1>
        <p class="lede">Products are globally sorted by ascending confidence so category and amount interpretation risks surface first.</p>
      </div>
      <div class="summary">
        <div class="pill" id="summary-total"></div>
        <div class="pill" id="summary-page"></div>
      </div>
    </div>
  </header>
  <section class="controls">
    <input id="search" type="search" placeholder="Filter within the current page by file, product, category, or reason" />
    <div class="page-controls">
      <button id="prev">Previous</button>
      <span id="page-indicator"></span>
      <button id="next">Next</button>
    </div>
  </section>
  <main id="results"></main>
  <script src="./manifest.js"></script>
  <script>
    const manifest = window.CATALOG_REVIEW_MANIFEST;
    window.CATALOG_REVIEW_PAGES = window.CATALOG_REVIEW_PAGES || {};

    const results = document.getElementById("results");
    const search = document.getElementById("search");
    const prevButton = document.getElementById("prev");
    const nextButton = document.getElementById("next");
    const pageIndicator = document.getElementById("page-indicator");
    const summaryTotal = document.getElementById("summary-total");
    const summaryPage = document.getElementById("summary-page");

    let currentPage = 1;
    let currentRows = [];

    summaryTotal.textContent = manifest.totalRows + " products";

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function renderTable(entries) {
      return entries
        .map(([key, value]) => "<tr><th>" + escapeHtml(key) + "</th><td>" + escapeHtml(value === "" ? "(empty)" : value) + "</td></tr>")
        .join("");
    }

    function renderRows(filterText) {
      const query = filterText.trim().toLowerCase();
      const filtered = query
        ? currentRows.filter((row) => {
            const fileMeta = manifest.filesById[row.fileId];
            const haystack = [
              fileMeta.fileName,
              fileMeta.posFolder,
              row.derived.productName || "",
              row.derived.category || "",
              row.derived.subCategory || "",
              ...row.confidence.reasons.map((reason) => reason.message),
            ].join(" ").toLowerCase();
            return haystack.includes(query);
          })
        : currentRows;

      if (!filtered.length) {
        results.innerHTML = '<div class="empty">No rows match this filter on the current page.</div>';
        return;
      }

      results.innerHTML = filtered
        .map((row) => {
          const fileMeta = manifest.filesById[row.fileId];
          return "<section class=\\"card\\">" +
            "<div class=\\"card-top\\">" +
              "<div>" +
                "<h2>" + escapeHtml(row.derived.productName || "(unnamed product)") + "</h2>" +
                "<div class=\\"meta\\">" +
                  "<span>" + escapeHtml(fileMeta.posFolder) + " / " + escapeHtml(fileMeta.fileName) + "</span>" +
                  "<span>Row " + escapeHtml(row.rowIndex + 1) + "</span>" +
                  "<span>POS " + escapeHtml(fileMeta.detectedPOS) + " (" + escapeHtml(Math.round(fileMeta.detectedPOSConfidence * 100)) + "%)</span>" +
                "</div>" +
              "</div>" +
              "<div class=\\"score\\">Confidence<strong>" + escapeHtml(row.confidence.score) + "</strong></div>" +
            "</div>" +
            "<div class=\\"columns\\">" +
              "<section class=\\"pane\\"><h3>Original</h3><table>" + renderTable(Object.entries(row.originalRow)) + "</table></section>" +
              "<section class=\\"pane\\"><h3>Transformed</h3><table>" + renderTable(Object.entries(row.derived)) + "</table></section>" +
            "</div>" +
            "<div class=\\"reasons\\">" +
              (row.confidence.reasons.length
                ? row.confidence.reasons.map((reason) => "<div class=\\"reason\\"><span>" + escapeHtml(reason.message) + "</span><strong>-" + escapeHtml(reason.deduction) + "</strong></div>").join("")
                : '<div class="reason"><span>No deductions</span><strong>-0</strong></div>') +
            "</div>" +
          "</section>";
        })
        .join("");
    }

    function updateControls() {
      pageIndicator.textContent = "Page " + currentPage + " of " + manifest.totalPages;
      summaryPage.textContent = "Rows " + (((currentPage - 1) * manifest.pageSize) + 1) + "-" + Math.min(currentPage * manifest.pageSize, manifest.totalRows);
      prevButton.disabled = currentPage <= 1;
      nextButton.disabled = currentPage >= manifest.totalPages;
    }

    function loadPage(pageNumber) {
      const existing = window.CATALOG_REVIEW_PAGES[pageNumber];
      if (existing) {
        return Promise.resolve(existing);
      }

      return new Promise((resolvePage, rejectPage) => {
        const script = document.createElement("script");
        script.src = "./pages/page-" + String(pageNumber).padStart(4, "0") + ".js";
        script.onload = () => resolvePage(window.CATALOG_REVIEW_PAGES[pageNumber] || []);
        script.onerror = rejectPage;
        document.body.appendChild(script);
      });
    }

    async function setPage(pageNumber) {
      currentPage = pageNumber;
      currentRows = await loadPage(pageNumber);
      updateControls();
      renderRows(search.value);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    prevButton.addEventListener("click", () => {
      if (currentPage > 1) setPage(currentPage - 1);
    });
    nextButton.addEventListener("click", () => {
      if (currentPage < manifest.totalPages) setPage(currentPage + 1);
    });
    search.addEventListener("input", () => renderRows(search.value));

    setPage(1);
  </script>
</body>
</html>`;

  const outputPath = join(outputRoot, "index.html");
  writeFileSync(outputPath, html);
  return { html, outputPath };
}

export function main() {
  const outputRoot = process.argv[2] ?? resolve(".logic-review/output");
  const dataPath = join(outputRoot, "review-data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8")) as CatalogReviewData;
  const { outputPath } = generateCatalogReviewSite(data, { outputRoot });
  console.log(`Wrote review site to ${outputPath}`);
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
