/**
 * Generate an interactive HTML review page from flagged-summary.json.
 * Groups all flagged rows by error pattern (collapsible sections).
 * Users can edit category/subCategory/classification, add notes, and export.
 */
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = "/Users/chase/projects/catalog-migration-tool/dev/output";
const allData = JSON.parse(
  fs.readFileSync(path.join(OUTPUT_DIR, "flagged-summary.json"), "utf-8"),
) as any[];

// Collect ALL flagged rows across all files
interface FlatRow {
  posName: string;
  fileName: string;
  rowIndex: number;
  reasons: string[];
  original: Record<string, string>;
  derived: Record<string, any>;
  headers: string[];
}

const allRows: FlatRow[] = [];
for (const pos of allData) {
  for (const row of pos.flaggedRows) {
    allRows.push({
      posName: pos.posName,
      fileName: pos.fileName,
      rowIndex: row.rowIndex,
      reasons: row.reasons,
      original: row.original,
      derived: row.derived,
      headers: pos.headers,
    });
  }
}

// Group rows by error pattern (normalize numbers and quoted strings)
function patternize(reason: string): string {
  return reason.replace(/"[^"]*"/g, '"..."').replace(/\d+\.?\d*/g, "N");
}

const groupMap: Record<string, { pattern: string; example: string; rows: FlatRow[] }> = {};
for (const row of allRows) {
  for (const reason of row.reasons) {
    const pattern = patternize(reason);
    if (!groupMap[pattern]) {
      groupMap[pattern] = { pattern, example: reason, rows: [] };
    }
    groupMap[pattern].rows.push(row);
  }
}

// Sort groups by count descending
const groups = Object.values(groupMap).sort((a, b) => b.rows.length - a.rows.length);

// Deduplicate rows within groups (same row can appear once per group)
for (const g of groups) {
  const seen = new Set<string>();
  g.rows = g.rows.filter((r) => {
    const key = `${r.posName}__${r.rowIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Enum values for dropdowns
const PRODUCT_CATEGORIES = [
  "Beverage", "CBD", "Cartridge", "Edible", "Extract", "Flower",
  "Merch", "Misc", "Non-Inv", "Pill", "Plant", "Preroll", "Tincture", "Topical",
];

const PRODUCT_SUBCATEGORIES: Record<string, string[]> = {
  Beverage: ["Beer", "Beverage - General", "Coffee", "Dissolvable", "Elixir", "Juice", "Other", "Seltzer", "Shot", "Soda", "Tea", "Tonic", "Water"],
  CBD: ["Beverage", "CBD - General", "Cartridge", "Edible", "Extract", "Oil", "Pill", "Tincture", "Topical"],
  Cartridge: ["510 Thread", "All In One", "CCELL", "Cartridge - General", "Cured Resin", "Diamond", "Distillate", "Full Spectrum", "Hash", "Live Resin", "Other", "Pax", "Pax Pod", "Pod", "Ready To Use", "Rosin"],
  Edible: ["Baked Good", "Butter", "Capsule", "Chew", "Chocolate", "Cookie", "Edible - General", "Gum", "Gummy", "Hard Candy", "Honey", "Lozenge", "Mints", "Oil", "Other", "Savory", "Sublingual", "Sublingual Tablet", "Tablingual"],
  Extract: ["Badder", "Bubble Hash", "Budder", "Bulk Extract", "Caviar", "Crumble", "Crystalline", "Cured Resin", "Diamonds", "Distillate", "Dry Sift", "Extract - General", "Flower Rosin", "Full Spectrum Oil", "Hash", "Hash Rosin", "Ice Water Hash", "Isolate", "Jam", "Jelly", "Kief", "Live Resin", "Live Resin Badder", "Live Resin Budder", "Live Resin Sauce", "Live Resin Sugar", "Live Rosin", "Moon Rocks", "Oil", "Other", "Powder Hash", "RSO", "Rosin", "Rosin Budder", "Rosin Sauce", "Sauce", "Shatter", "Sift Rosin", "Sugar", "THC-A", "Temple Ball", "Temple Ball Hash", "Water Hash", "Wax"],
  Flower: ["Bulk Flower", "Flower - General", "Infused Flower", "Kief", "Pre-Ground", "Pre-Pack", "Pre-Pack Shake", "Pre-Pack Smalls", "Shake", "Strain Specific Shake"],
  Merch: ["Accessory", "Apparel", "Battery", "Beverage", "Bong", "Book", "Dab Rig", "Gift Card", "Grinder", "Hat", "Hoodie", "Lighter", "Merch - General", "Other", "Pipe", "Rolling Papers", "Snack", "Sweatshirt", "T Shirt", "Vaporizer"],
  Misc: ["Bath", "Liquid", "Misc - General", "Other", "Solid", "Suppository"],
  "Non-Inv": ["Fee", "Gift Card", "Membership", "Non-Inv - General", "Other"],
  Pill: ["Capsule", "Chewable", "Other", "Pill - General", "Tablet"],
  Plant: ["Clone", "Fresh Whole Plant", "Plant - General", "Seeds", "Teen"],
  Preroll: ["Blunt", "Flower", "Infused", "Infused Blunt", "Preroll - General", "Shake"],
  Tincture: ["Dropper", "Other", "Sauce", "Spray", "Syrup", "Tincture", "Tincture - General"],
  Topical: ["Balm", "Cosmetic", "Cream", "Gel", "Lotion", "Lubricant", "Oil", "Other", "Patch", "Roll-On", "Salve", "Spray", "Topical - General"],
};

const VALID_CLASSIFICATIONS = ["", "Sativa", "Indica", "Hybrid", "I/S", "S/I", "CBD"];

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const DERIVED_FIELDS = [
  "productName", "brand", "category", "subCategory", "classification",
  "uom", "amount", "weightInGrams", "merchSize", "basePrice",
  "thc", "cbd", "status", "strain", "extractionMethod", "unitCount", "skuBarcode",
];

const DERIVED_LABELS: Record<string, string> = {
  productName: "Product Name", brand: "Brand", category: "Product Category",
  subCategory: "Product Sub Category", classification: "Classification",
  uom: "UoM", amount: "Amount", weightInGrams: "Total Flower Weight",
  merchSize: "Merchandise Size", basePrice: "Base Price", thc: "Total mg THC",
  cbd: "Total mg CBD", status: "Status", strain: "Strain",
  extractionMethod: "Extraction Method", unitCount: "Unit Count", skuBarcode: "SKU Barcode",
};

const EDITABLE_DROPDOWN_FIELDS = new Set(["category", "subCategory", "classification"]);
const EDITABLE_TEXT_FIELDS = new Set(["amount", "uom", "thc", "cbd"]);

// Stats
const totalFiles = allData.length;
const totalRows = allData.reduce((s: number, r: any) => s + r.totalRows, 0);
const totalFlagged = allRows.length;
const uniquePatterns = groups.length;

// Build per-POS stats
const posStats: Record<string, { files: number; rows: number; flagged: number }> = {};
for (const pos of allData) {
  const posKey = pos.posName.split(" - ")[0];
  if (!posStats[posKey]) posStats[posKey] = { files: 0, rows: 0, flagged: 0 };
  posStats[posKey].files++;
  posStats[posKey].rows += pos.totalRows;
  posStats[posKey].flagged += pos.flaggedCount;
}

function renderRowCard(row: FlatRow, groupIdx: number): string {
  const rowKey = `${row.posName}__${row.rowIndex}`;
  const productName = esc(row.derived.productName || "(no name)");
  const posLabel = esc(row.posName);

  let card = `<div class="row-card" data-row-key="${esc(rowKey)}" data-group="${groupIdx}">
    <div class="row-header" onclick="toggleRow(this)">
      <span class="row-id">${posLabel} — Row ${row.rowIndex + 1}</span>
      <span class="product-name">${productName}</span>
      <div class="reasons">${row.reasons.map((r: string) => `<span class="reason">${esc(r)}</span>`).join("")}</div>
    </div>
    <div class="row-body">
      <div class="comparison">
        <div class="col-header original">Original (${posLabel})</div>
        <div class="col-header transformed">Transformed (Treez) &mdash; editable</div>
        <div class="col-content"><table>`;

  // Original columns (non-empty only)
  for (const h of row.headers) {
    const val = row.original[h] ?? "";
    if (val.trim() === "") continue;
    card += `<tr><th>${esc(h)}</th><td>${esc(val)}</td></tr>`;
  }

  card += `</table></div><div class="col-content"><table>`;

  // Transformed fields
  for (const key of DERIVED_FIELDS) {
    const val = String(row.derived[key] ?? "");
    const label = DERIVED_LABELS[key] || key;
    const isEmpty = val === "" || val === "0" || val === "undefined";
    const isHighlighted = row.reasons.some((r: string) =>
      r.toLowerCase().includes(key.toLowerCase()) || r.toLowerCase().includes(label.toLowerCase()),
    );

    if (EDITABLE_DROPDOWN_FIELDS.has(key)) {
      let options: string[] = [];
      if (key === "category") options = PRODUCT_CATEGORIES;
      else if (key === "subCategory") options = PRODUCT_SUBCATEGORIES[row.derived.category] || [];
      else if (key === "classification") options = VALID_CLASSIFICATIONS;

      card += `<tr><th>${esc(label)}</th><td class="${isHighlighted ? "highlight" : ""}">`;
      card += `<select data-field="${key}" data-row-key="${esc(rowKey)}" data-original="${esc(val)}" onchange="onFieldEdit(this, '${esc(rowKey)}')">`;
      card += `<option value="">(empty)</option>`;
      for (const opt of options) {
        card += `<option value="${esc(opt)}"${opt === val ? " selected" : ""}>${esc(opt)}</option>`;
      }
      if (val && !options.includes(val)) {
        card += `<option value="${esc(val)}" selected>${esc(val)} (current)</option>`;
      }
      card += `</select></td></tr>`;
    } else if (EDITABLE_TEXT_FIELDS.has(key)) {
      card += `<tr><th>${esc(label)}</th><td class="${isHighlighted ? "highlight" : ""}">`;
      card += `<input type="text" value="${esc(val)}" data-field="${key}" data-row-key="${esc(rowKey)}" data-original="${esc(val)}" onchange="onFieldEdit(this, '${esc(rowKey)}')" />`;
      card += `</td></tr>`;
    } else {
      card += `<tr><th>${esc(label)}</th><td class="${isEmpty ? "empty" : ""}${isHighlighted ? " highlight" : ""}">${isEmpty ? "(empty)" : esc(val)}</td></tr>`;
    }
  }

  card += `</table></div></div>
      <div class="notes-section">
        <div class="notes-label">Notes</div>
        <textarea data-row-key="${esc(rowKey)}" placeholder="Add notes about this row..." onchange="onNotesEdit(this, '${esc(rowKey)}')"></textarea>
      </div>
      <div class="row-actions">
        <button class="btn-correct" data-row-key="${esc(rowKey)}" onclick="markReviewed(this, '${esc(rowKey)}')">Mark as Reviewed</button>
      </div>
    </div>
  </div>`;

  return card;
}

let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Catalog Migration Review — Grouped by Error</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
  .header { background: #1a4007; color: white; padding: 16px 24px; position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 18px; font-weight: 600; }
  .header .subtitle { font-size: 13px; opacity: 0.8; margin-top: 4px; }
  .header-actions { display: flex; gap: 8px; align-items: center; }
  .header-actions button { background: white; color: #1a4007; border: none; padding: 6px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; }
  .header-actions button:hover { background: #dbf5b3; }
  .header-actions .save-count { font-size: 11px; color: rgba(255,255,255,0.7); }

  .stats-bar { display: flex; gap: 16px; padding: 16px 24px; flex-wrap: wrap; }
  .stat { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px 16px; flex: 1; min-width: 120px; }
  .stat .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat .value { font-size: 22px; font-weight: 600; color: #1a4007; margin-top: 2px; }

  .toolbar { display: flex; gap: 8px; padding: 0 24px 16px; flex-wrap: wrap; align-items: center; }
  .toolbar button { font-size: 12px; color: #1a4007; cursor: pointer; border: 1px solid #1a4007; background: white; padding: 4px 12px; border-radius: 6px; }
  .toolbar button:hover { background: #f0f7e8; }
  .filter-group { display: flex; gap: 4px; align-items: center; font-size: 12px; color: #666; }
  .filter-group select { font-size: 12px; padding: 3px 8px; border: 1px solid #ccc; border-radius: 4px; }

  .content { padding: 0 24px 24px; }

  .error-group { background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
  .error-group-header { padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; cursor: pointer; gap: 12px; user-select: none; }
  .error-group-header:hover { background: #f0f0f0; }
  .error-group-header .chevron { font-size: 12px; color: #999; transition: transform 0.2s; flex-shrink: 0; }
  .error-group-header.open .chevron { transform: rotate(90deg); }
  .error-group-header .pattern-text { font-size: 13px; font-weight: 500; color: #333; flex: 1; }
  .error-group-header .group-count { background: #fff3cd; color: #856404; font-size: 12px; padding: 2px 10px; border-radius: 10px; border: 1px solid #ffc107; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
  .error-group-header .pos-tags { display: flex; gap: 4px; flex-wrap: wrap; flex-shrink: 0; }
  .error-group-header .pos-tag { font-size: 10px; padding: 1px 6px; border-radius: 3px; background: #e8e8e8; color: #555; }
  .error-group-body { display: none; padding: 8px; }
  .error-group-body.open { display: block; }

  .row-card { background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
  .row-card.has-edits { border-color: #1a4007; border-width: 2px; }
  .row-card.reviewed { border-color: #4caf50; }
  .row-header { padding: 10px 16px; background: #fafafa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; cursor: pointer; gap: 8px; }
  .row-header:hover { background: #f0f0f0; }
  .row-header .row-id { font-size: 11px; font-weight: 600; color: #888; white-space: nowrap; }
  .row-header .product-name { font-size: 13px; color: #333; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .reasons { display: flex; flex-wrap: wrap; gap: 4px; flex-shrink: 0; }
  .reason { background: #fff3cd; color: #856404; font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid #ffc107; white-space: nowrap; }
  .row-body { display: none; }
  .row-body.open { display: block; }
  .comparison { display: grid; grid-template-columns: 1fr 1fr; }
  .col-header { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 16px; border-bottom: 1px solid #eee; }
  .col-header.original { background: #f8f9fa; color: #666; }
  .col-header.transformed { background: #e8f7d0; color: #1a4007; }
  .col-content { padding: 8px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td, th { padding: 4px 8px; text-align: left; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  th { font-weight: 500; color: #888; width: 130px; white-space: nowrap; }
  td { color: #333; word-break: break-word; max-width: 300px; }
  td.empty { color: #ccc; font-style: italic; }
  td.highlight { background: #fff3cd; }
  select, input[type="text"] { font-size: 12px; padding: 2px 6px; border: 1px solid #ccc; border-radius: 4px; background: #fffff0; width: 100%; max-width: 200px; }
  select:focus, input[type="text"]:focus { border-color: #1a4007; outline: none; }
  select.edited, input.edited { border-color: #1a4007; background: #f0ffe0; font-weight: 500; }
  .notes-section { padding: 12px 16px; border-top: 1px solid #eee; background: #fafafa; }
  .notes-section textarea { width: 100%; min-height: 48px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; font-family: inherit; resize: vertical; }
  .notes-section textarea:focus { border-color: #1a4007; outline: none; }
  .notes-section .notes-label { font-size: 11px; font-weight: 600; color: #888; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .row-actions { padding: 8px 16px; border-top: 1px solid #eee; display: flex; gap: 8px; justify-content: flex-end; }
  .row-actions button { padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; }
  .btn-correct { background: #e8f7d0; color: #1a4007; border: 1px solid #1a4007; }
  .btn-correct:hover { background: #d4edb8; }
  .btn-correct.marked { background: #1a4007; color: white; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: #1a4007; color: white; padding: 10px 20px; border-radius: 8px; font-size: 13px; z-index: 200; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
  .toast.show { display: block; animation: fadein 0.3s; }
  @keyframes fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Catalog Migration Review</h1>
    <div class="subtitle">${totalFlagged} flagged rows across ${totalFiles} files &mdash; ${uniquePatterns} error patterns</div>
  </div>
  <div class="header-actions">
    <span class="save-count" id="saveCount"></span>
    <button onclick="exportCorrections()">Export Corrections</button>
    <button onclick="saveAll()">Save All</button>
  </div>
</div>

<div class="stats-bar">
  <div class="stat"><div class="label">Total Files</div><div class="value">${totalFiles}</div></div>
  <div class="stat"><div class="label">Total Rows</div><div class="value">${totalRows.toLocaleString()}</div></div>
  <div class="stat"><div class="label">Flagged Rows</div><div class="value">${totalFlagged}</div></div>
  <div class="stat"><div class="label">Error Patterns</div><div class="value">${uniquePatterns}</div></div>
  <div class="stat"><div class="label">Reviewed</div><div class="value" id="reviewed-total">0</div></div>
</div>

<div class="toolbar">
  <button onclick="expandAllGroups()">Expand All Groups</button>
  <button onclick="collapseAllGroups()">Collapse All Groups</button>
  <div class="filter-group">
    <label>Filter POS:</label>
    <select id="posFilter" onchange="applyFilters()">
      <option value="all">All</option>
${Object.keys(posStats).sort().map((p) => `      <option value="${esc(p)}">${esc(p)} (${posStats[p].flagged})</option>`).join("\n")}
    </select>
  </div>
  <div class="filter-group">
    <label>Status:</label>
    <select id="statusFilter" onchange="applyFilters()">
      <option value="all">All</option>
      <option value="unreviewed">Unreviewed</option>
      <option value="reviewed">Reviewed</option>
      <option value="edited">Has Edits</option>
    </select>
  </div>
</div>

<div class="content">
`;

// Render each error group
for (let gi = 0; gi < groups.length; gi++) {
  const g = groups[gi];
  // Compute POS breakdown for this group
  const posBreakdown: Record<string, number> = {};
  for (const r of g.rows) {
    const pos = r.posName.split(" - ")[0];
    posBreakdown[pos] = (posBreakdown[pos] || 0) + 1;
  }
  const posTags = Object.entries(posBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([p, c]) => `<span class="pos-tag">${esc(p)} (${c})</span>`)
    .join("");

  html += `<div class="error-group" data-group-idx="${gi}">
  <div class="error-group-header" onclick="toggleGroup(this)">
    <span class="chevron">&#9654;</span>
    <span class="pattern-text">${esc(g.example)}</span>
    <div class="pos-tags">${posTags}</div>
    <span class="group-count">${g.rows.length}</span>
  </div>
  <div class="error-group-body">
`;

  for (let ri = 0; ri < g.rows.length; ri++) {
    html += renderRowCard(g.rows[ri], gi);
  }

  html += `  </div>
</div>
`;
}

html += `</div>

<div class="toast" id="toast"></div>
<script>
const SUBCATEGORIES = ${JSON.stringify(PRODUCT_SUBCATEGORIES)};

// State: stored in localStorage
const STORAGE_KEY = 'catalog-review-corrections';
const BUILD_KEY = 'catalog-review-build';
const BUILD_ID = '${Date.now()}';
if (localStorage.getItem(BUILD_KEY) !== BUILD_ID) {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(BUILD_KEY, BUILD_ID);
}
let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

// Restore state on load
window.addEventListener('DOMContentLoaded', () => {
  for (const [rowKey, rowState] of Object.entries(state)) {
    const cards = document.querySelectorAll(\`[data-row-key="\${rowKey}"]\`);
    cards.forEach(card => {
      if (!card.classList.contains('row-card')) return;
      const rs = rowState;
      if (rs.edits) {
        for (const [field, value] of Object.entries(rs.edits)) {
          const el = card.querySelector(\`[data-field="\${field}"][data-row-key="\${rowKey}"]\`);
          if (el) {
            el.value = value;
            if (el.dataset.original !== value) el.classList.add('edited');
          }
        }
        card.classList.add('has-edits');
      }
      if (rs.notes) {
        const ta = card.querySelector(\`textarea[data-row-key="\${rowKey}"]\`);
        if (ta) ta.value = rs.notes;
      }
      if (rs.reviewed) {
        card.classList.add('reviewed');
        const btn = card.querySelector(\`.btn-correct[data-row-key="\${rowKey}"]\`);
        if (btn) { btn.classList.add('marked'); btn.textContent = 'Reviewed'; }
      }
    });
  }
  updateCounts();
});

function getRowState(rowKey) {
  if (!state[rowKey]) state[rowKey] = {};
  return state[rowKey];
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateCounts();
}

function onFieldEdit(el, rowKey) {
  const rs = getRowState(rowKey);
  if (!rs.edits) rs.edits = {};
  rs.edits[el.dataset.field] = el.value;

  if (el.dataset.original !== el.value) {
    el.classList.add('edited');
  } else {
    el.classList.remove('edited');
  }

  if (el.dataset.field === 'category') {
    const card = el.closest('.row-card');
    const subSelect = card.querySelector('[data-field="subCategory"]');
    if (subSelect) {
      const subs = SUBCATEGORIES[el.value] || [];
      const currentSub = subSelect.value;
      subSelect.innerHTML = '<option value="">(empty)</option>' +
        subs.map(s => \`<option value="\${s}"\${s === currentSub ? ' selected' : ''}>\${s}</option>\`).join('');
    }
  }

  const card = el.closest('.row-card');
  const hasAnyEdit = card.querySelectorAll('.edited').length > 0;
  card.classList.toggle('has-edits', hasAnyEdit);
  persist();
}

function onNotesEdit(el, rowKey) {
  const rs = getRowState(rowKey);
  rs.notes = el.value;
  persist();
}

function markReviewed(btn, rowKey) {
  const rs = getRowState(rowKey);
  rs.reviewed = !rs.reviewed;
  btn.classList.toggle('marked', rs.reviewed);
  btn.textContent = rs.reviewed ? 'Reviewed' : 'Mark as Reviewed';
  btn.closest('.row-card').classList.toggle('reviewed', rs.reviewed);
  persist();
}

function toggleRow(header) {
  header.nextElementSibling.classList.toggle('open');
}

function toggleGroup(header) {
  header.classList.toggle('open');
  header.nextElementSibling.classList.toggle('open');
}

function expandAllGroups() {
  document.querySelectorAll('.error-group-header').forEach(h => {
    h.classList.add('open');
    h.nextElementSibling.classList.add('open');
  });
}

function collapseAllGroups() {
  document.querySelectorAll('.error-group-header').forEach(h => {
    h.classList.remove('open');
    h.nextElementSibling.classList.remove('open');
  });
}

function applyFilters() {
  const posFilter = document.getElementById('posFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;

  document.querySelectorAll('.error-group').forEach(group => {
    let visibleRows = 0;
    group.querySelectorAll('.row-card').forEach(card => {
      const key = card.dataset.rowKey;
      const rs = state[key] || {};
      const pos = key.split(' - ')[0];
      let show = true;

      if (posFilter !== 'all' && pos !== posFilter) show = false;
      if (statusFilter === 'unreviewed' && rs.reviewed) show = false;
      if (statusFilter === 'reviewed' && !rs.reviewed) show = false;
      if (statusFilter === 'edited' && !(rs.edits && Object.keys(rs.edits).length > 0)) show = false;

      card.style.display = show ? '' : 'none';
      if (show) visibleRows++;
    });
    group.style.display = visibleRows > 0 ? '' : 'none';
  });
}

function updateCounts() {
  let reviewed = 0;
  for (const rs of Object.values(state)) {
    if (rs.reviewed) reviewed++;
  }
  document.getElementById('reviewed-total').textContent = reviewed;
  const totalEdits = Object.values(state).filter(rs => rs.edits || rs.notes).length;
  document.getElementById('saveCount').textContent = totalEdits + ' rows with edits/notes';
}

function saveAll() {
  persist();
  showToast('Saved to browser storage');
}

function exportCorrections() {
  const corrections = {};
  for (const [key, rs] of Object.entries(state)) {
    if ((rs.edits && Object.keys(rs.edits).length > 0) || rs.notes || rs.reviewed) {
      corrections[key] = rs;
    }
  }
  const blob = new Blob([JSON.stringify(corrections, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'catalog-review-corrections.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported ' + Object.keys(corrections).length + ' corrections');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
</script>
</body>
</html>`;

const outputPath = path.join(OUTPUT_DIR, "review.html");
fs.writeFileSync(outputPath, html);
console.log(`Review page written to: ${outputPath}`);
console.log(`Total flagged rows: ${totalFlagged}`);
console.log(`Error pattern groups: ${uniquePatterns}`);
