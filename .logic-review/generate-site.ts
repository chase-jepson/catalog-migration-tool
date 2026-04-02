import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_CATEGORIES } from "../lib/constants";
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
      id: row.id,
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
    buildId: data.generatedAt.replace(/[^a-zA-Z0-9]/g, "-"),
    notesStorageKey: `catalog-logic-review-notes:${data.generatedAt}`,
    generatedAt: data.generatedAt,
    inputRoot: data.inputRoot,
    totalRows: rows.length,
    totalPages,
    pageSize,
    filesById,
    categoryOptions: [...PRODUCT_CATEGORIES],
    uomOptions: ["", "each", "grams", "milligrams", "ounces", "kilograms", "pounds"],
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
      flex-wrap: wrap;
      align-items: center;
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
    }
    button, input, select, textarea {
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
    input, select, textarea {
      width: 100%;
      border-radius: 16px;
      border: 1px solid var(--border);
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
    }
    input[type="search"] {
      background: rgba(255, 255, 255, 0.88);
    }
    textarea {
      min-height: 104px;
      resize: vertical;
      line-height: 1.4;
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
    .pane-body {
      padding: 12px;
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
    .reasons, .stack {
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
    .source-signals {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .signal {
      padding: 8px 10px;
      border-radius: 999px;
      background: #edf4e2;
      border: 1px solid rgba(35, 69, 27, 0.12);
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
      font-size: 12px;
    }
    .notes {
      border: 1px solid rgba(35, 69, 27, 0.12);
      border-radius: 18px;
      padding: 14px;
      background: rgba(255, 255, 255, 0.72);
    }
    .notes-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 10px;
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
    }
    .notes-head h3 {
      margin: 0;
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .notes-status {
      color: var(--muted);
      font-size: 12px;
    }
    details {
      border: 1px solid rgba(35, 69, 27, 0.12);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.72);
      overflow: hidden;
    }
    summary {
      list-style: none;
      cursor: pointer;
      padding: 14px;
      font-family: "Avenir Next", "Helvetica Neue", sans-serif;
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: #eef3e7;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    details table {
      background: var(--surface-strong);
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
      .notes-head {
        align-items: start;
        flex-direction: column;
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
      <button id="download-notes">Download Notes JSON</button>
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
    const downloadNotesButton = document.getElementById("download-notes");
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

    function loadSavedNotes() {
      try {
        const parsed = JSON.parse(localStorage.getItem(manifest.notesStorageKey) || "{}");
        return Object.fromEntries(
          Object.entries(parsed).map(([rowId, value]) => {
            if (typeof value === "string") return [rowId, { note: value }];
            return [rowId, value];
          }),
        );
      } catch {
        return {};
      }
    }

    let savedNotes = loadSavedNotes();

    function persistNotes() {
      localStorage.setItem(manifest.notesStorageKey, JSON.stringify(savedNotes));
    }

    function updateNotesSummary() {
      const count = Object.values(savedNotes)
        .filter((value) => {
          return (
            String(value.note || "").trim() !== "" ||
            String(value.evidence || "").trim() !== "" ||
            String(value.expectedCategory || "").trim() !== "" ||
            String(value.expectedAmount || "").trim() !== "" ||
            String(value.expectedUom || "").trim() !== "" ||
            String(value.expectedThcPresence || "").trim() !== "" ||
            (value.issueTypes || []).length > 0
          );
        })
        .length;
      downloadNotesButton.textContent = count ? "Download Notes JSON (" + count + ")" : "Download Notes JSON";
    }

    function renderTable(entries) {
      return entries
        .map(([key, value]) => "<tr><th>" + escapeHtml(key) + "</th><td>" + escapeHtml(value === "" ? "(empty)" : value) + "</td></tr>")
        .join("");
    }

    function buildSelect(options, selectedValue, attributes) {
      return "<select " + attributes + ">" +
        options.map((option) => {
          const selected = option === selectedValue ? " selected" : "";
          const label = option === "" ? "(unset)" : option;
          return "<option value=\\"" + escapeHtml(option) + "\\"" + selected + ">" + escapeHtml(label) + "</option>";
        }).join("") +
      "</select>";
    }

    function buildCheckboxes(options, selectedValues, rowId) {
      return options.map((option) => {
        const checked = selectedValues.includes(option) ? " checked" : "";
        return "<label class=\\"signal\\"><input type=\\"checkbox\\" data-issue-type=\\"" + escapeHtml(rowId) + "\\" value=\\"" + escapeHtml(option) + "\\"" + checked + "> " + escapeHtml(option) + "</label>";
      }).join("");
    }

    function findSourceSignals(originalRow) {
      const signals = [];
      for (const [key, value] of Object.entries(originalRow)) {
        const haystack = (key + " " + value).toLowerCase();
        if (/(^|\\b)(thc|cbd|cannabinoid|potency|terp|infused)(\\b|$)/.test(haystack)) {
          signals.push(key + ": " + value);
        }
      }
      return signals;
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
              ...Object.entries(row.originalRow).flatMap(([key, value]) => [key, value]),
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
          const sourceSignals = findSourceSignals(row.originalRow);
          const noteEntry = savedNotes[row.id] || {};
          const note = noteEntry.note || "";
          const allSourceEntries = Object.entries(row.originalRow);

          return "<section class=\\"card\\">" +
            "<div class=\\"card-top\\">" +
              "<div>" +
                "<h2>" + escapeHtml(row.derived.productName || "(unnamed product)") + "</h2>" +
                "<div class=\\"meta\\">" +
                  "<span>" + escapeHtml(fileMeta.posFolder) + " / " + escapeHtml(fileMeta.fileName) + "</span>" +
                  "<span>Row " + escapeHtml(row.rowIndex + 1) + "</span>" +
                  "<span>Review ID " + escapeHtml(row.id) + "</span>" +
                  "<span>POS " + escapeHtml(fileMeta.detectedPOS) + " (" + escapeHtml(Math.round(fileMeta.detectedPOSConfidence * 100)) + "%)</span>" +
                "</div>" +
              "</div>" +
              "<div class=\\"score\\">Confidence<strong>" + escapeHtml(row.confidence.score) + "</strong></div>" +
            "</div>" +
            "<div class=\\"stack\\">" +
              "<div class=\\"source-signals\\">" +
                (sourceSignals.length
                  ? sourceSignals.map((signal) => "<span class=\\"signal\\">Source signal: " + escapeHtml(signal) + "</span>").join("")
                  : '<span class="signal">No THC/CBD/potency signal found in source row</span>') +
              "</div>" +
            "</div>" +
            "<div class=\\"columns\\">" +
              "<section class=\\"pane\\"><h3>Original Key Row Data</h3><table>" + renderTable(allSourceEntries.slice(0, 12)) + "</table></section>" +
              "<section class=\\"pane\\"><h3>Transformed</h3><table>" + renderTable(Object.entries(row.derived)) + "</table></section>" +
            "</div>" +
            "<details>" +
              "<summary>All Source Fields (" + escapeHtml(allSourceEntries.length) + ")</summary>" +
              "<table>" + renderTable(allSourceEntries) + "</table>" +
            "</details>" +
            "<section class=\\"notes\\">" +
              "<div class=\\"notes-head\\">" +
                "<h3>Reviewer Feedback</h3>" +
                "<span class=\\"notes-status\\" data-note-status=\\"" + escapeHtml(row.id) + "\\">Autosaved locally for this run</span>" +
              "</div>" +
              "<div class=\\"stack\\">" +
                "<div class=\\"columns\\">" +
                  "<section class=\\"pane\\"><h3>Expected Category</h3><div class=\\"pane-body\\">" +
                    buildSelect(["", ...manifest.categoryOptions], noteEntry.expectedCategory || "", "data-expected-category=\\"" + escapeHtml(row.id) + "\\"") +
                  "</div></section>" +
                  "<section class=\\"pane\\"><h3>Expected THC Presence</h3><div class=\\"pane-body\\">" +
                    buildSelect(["", "yes", "no", "unknown"], noteEntry.expectedThcPresence || "", "data-expected-thc-presence=\\"" + escapeHtml(row.id) + "\\"") +
                  "</div></section>" +
                "</div>" +
                "<div class=\\"columns\\">" +
                  "<section class=\\"pane\\"><h3>Expected Amount</h3><div class=\\"pane-body\\"><input data-expected-amount=\\"" + escapeHtml(row.id) + "\\" value=\\"" + escapeHtml(noteEntry.expectedAmount || "") + "\\" placeholder=\\"e.g. 3.5\\" /></div></section>" +
                  "<section class=\\"pane\\"><h3>Expected UOM</h3><div class=\\"pane-body\\">" +
                    buildSelect(manifest.uomOptions, noteEntry.expectedUom || "", "data-expected-uom=\\"" + escapeHtml(row.id) + "\\"") +
                  "</div></section>" +
                "</div>" +
                "<section class=\\"notes\\">" +
                  "<div class=\\"notes-head\\"><h3>Issue Types</h3></div>" +
                  "<div class=\\"source-signals\\">" +
                    buildCheckboxes(["category", "amount", "uom", "thc", "classification", "other"], noteEntry.issueTypes || [], row.id) +
                  "</div>" +
                "</section>" +
                "<div class=\\"columns\\">" +
                  "<section class=\\"pane\\"><h3>Evidence</h3><div class=\\"pane-body\\"><textarea data-evidence-id=\\"" + escapeHtml(row.id) + "\\" placeholder=\\"Point to the source-row evidence that justifies the correction.\\">" + escapeHtml(noteEntry.evidence || "") + "</textarea></div></section>" +
                  "<section class=\\"pane\\"><h3>Reviewer Note</h3><div class=\\"pane-body\\"><textarea data-note-id=\\"" + escapeHtml(row.id) + "\\" placeholder=\\"Add review notes here. These notes are saved locally and can be exported as JSON for logic updates.\\">" + escapeHtml(note) + "</textarea></div></section>" +
                "</div>" +
              "</div>" +
            "</section>" +
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

    function bindNoteInputs() {
      const collectIssueTypes = (noteId) =>
        [...results.querySelectorAll('[data-issue-type="' + noteId + '"]:checked')].map((input) => input.value);

      const saveNoteEntry = (noteId) => {
        const row = currentRows.find((candidate) => candidate.id === noteId);
        const fileMeta = row ? manifest.filesById[row.fileId] : null;
        const noteValue = results.querySelector('[data-note-id="' + noteId + '"]')?.value ?? "";
        const evidenceValue = results.querySelector('[data-evidence-id="' + noteId + '"]')?.value ?? "";
        const expectedCategory = results.querySelector('[data-expected-category="' + noteId + '"]')?.value ?? "";
        const expectedAmount = results.querySelector('[data-expected-amount="' + noteId + '"]')?.value ?? "";
        const expectedUom = results.querySelector('[data-expected-uom="' + noteId + '"]')?.value ?? "";
        const expectedThcPresence =
          results.querySelector('[data-expected-thc-presence="' + noteId + '"]')?.value ?? "";
        const issueTypes = collectIssueTypes(noteId);

        if (
          !noteValue.trim() &&
          !evidenceValue.trim() &&
          !expectedCategory &&
          !expectedAmount.trim() &&
          !expectedUom &&
          !expectedThcPresence &&
          issueTypes.length === 0
        ) {
          delete savedNotes[noteId];
        } else {
          savedNotes[noteId] = {
            note: noteValue,
            evidence: evidenceValue,
            expectedCategory,
            expectedAmount: expectedAmount.trim(),
            expectedUom,
            expectedThcPresence,
            issueTypes,
            fileName: fileMeta ? fileMeta.fileName : null,
            rowIndex: row ? row.rowIndex + 1 : null,
            productName: row ? row.derived.productName || null : null,
            originalRow: row ? row.originalRow : null,
            transformedRow: row ? row.derived : null,
            confidenceReasons: row ? row.confidence.reasons : null,
          };
        }

        persistNotes();
        updateNotesSummary();

        const status = results.querySelector('[data-note-status="' + noteId + '"]');
        if (status) {
          status.textContent = savedNotes[noteId] ? "Saved locally for this run" : "Autosaved locally for this run";
        }
      };

      const bindBySelector = (selector, attributeName) => {
        results.querySelectorAll(selector).forEach((input) => {
          const noteId = input.getAttribute(attributeName);
          input.addEventListener("input", () => saveNoteEntry(noteId));
          input.addEventListener("change", () => saveNoteEntry(noteId));
        });
      };

      bindBySelector("[data-note-id]", "data-note-id");
      bindBySelector("[data-evidence-id]", "data-evidence-id");
      bindBySelector("[data-expected-category]", "data-expected-category");
      bindBySelector("[data-expected-amount]", "data-expected-amount");
      bindBySelector("[data-expected-uom]", "data-expected-uom");
      bindBySelector("[data-expected-thc-presence]", "data-expected-thc-presence");
      bindBySelector("[data-issue-type]", "data-issue-type");
    }

    function downloadNotes() {
      const noteEntries = Object.entries(savedNotes)
        .filter(([, noteEntry]) => {
          return (
            String(noteEntry.note || "").trim() !== "" ||
            String(noteEntry.evidence || "").trim() !== "" ||
            String(noteEntry.expectedCategory || "").trim() !== "" ||
            String(noteEntry.expectedAmount || "").trim() !== "" ||
            String(noteEntry.expectedUom || "").trim() !== "" ||
            String(noteEntry.expectedThcPresence || "").trim() !== "" ||
            (noteEntry.issueTypes || []).length > 0
          );
        })
        .map(([rowId, noteEntry]) => ({
          rowId,
          note: noteEntry.note ?? "",
          fileName: noteEntry.fileName ?? null,
          rowIndex: noteEntry.rowIndex ?? null,
          productName: noteEntry.productName ?? null,
          expectedCategory: noteEntry.expectedCategory ?? null,
          expectedAmount: noteEntry.expectedAmount ?? null,
          expectedUom: noteEntry.expectedUom ?? null,
          expectedThcPresence: noteEntry.expectedThcPresence ?? null,
          issueTypes: noteEntry.issueTypes ?? [],
          evidence: noteEntry.evidence ?? null,
          originalRow: noteEntry.originalRow ?? null,
          transformedRow: noteEntry.transformedRow ?? null,
          confidenceReasons: noteEntry.confidenceReasons ?? null,
        }));

      const payload = {
        exportedAt: new Date().toISOString(),
        buildId: manifest.buildId,
        notesStorageKey: manifest.notesStorageKey,
        totalNotes: noteEntries.length,
        notes: noteEntries,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "catalog-logic-review-notes.json";
      link.click();
      URL.revokeObjectURL(url);
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
      bindNoteInputs();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    prevButton.addEventListener("click", () => {
      if (currentPage > 1) setPage(currentPage - 1);
    });
    nextButton.addEventListener("click", () => {
      if (currentPage < manifest.totalPages) setPage(currentPage + 1);
    });
    search.addEventListener("input", () => {
      renderRows(search.value);
      bindNoteInputs();
    });
    downloadNotesButton.addEventListener("click", downloadNotes);

    updateNotesSummary();
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
