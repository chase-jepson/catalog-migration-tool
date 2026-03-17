/**
 * Generate an interactive HTML review page from flagged-summary.json.
 * Users can edit category/subCategory/classification, add notes, and save.
 */
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = "/Users/chase/projects/catalog-migration-tool/dev/output";
const allData = JSON.parse(
  fs.readFileSync(path.join(OUTPUT_DIR, "flagged-summary.json"), "utf-8"),
) as any[];

// Pick top 2 files per POS system by flagged count
const byPOS: Record<string, any[]> = {};
for (const entry of allData) {
  const pos = entry.posName.split(" - ")[0]; // "Blaze - Blaze" → "Blaze"
  if (!byPOS[pos]) byPOS[pos] = [];
  byPOS[pos].push(entry);
}
const data: any[] = [];
for (const entries of Object.values(byPOS)) {
  entries.sort((a: any, b: any) => b.flaggedCount - a.flaggedCount);
  const top2 = entries.slice(0, 2).filter((e: any) => e.flaggedCount > 0);
  data.push(...top2);
}
data.sort((a: any, b: any) => b.flaggedCount - a.flaggedCount);

// Import enum values for dropdowns
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

// Labels match the actual Treez import CSV column names
const DERIVED_LABELS: Record<string, string> = {
  productName: "Product Name", brand: "Brand", category: "Product Category",
  subCategory: "Product Sub Category", classification: "Classification",
  uom: "UoM", amount: "Amount", weightInGrams: "Total Flower Weight",
  merchSize: "Merchandise Size", basePrice: "Base Price", thc: "Total mg THC",
  cbd: "Total mg CBD", status: "Status", strain: "Strain",
  extractionMethod: "Extraction Method", unitCount: "Unit Count", skuBarcode: "SKU Barcode",
};

// Editable fields get dropdowns or text inputs
const EDITABLE_DROPDOWN_FIELDS = new Set(["category", "subCategory", "classification"]);
const EDITABLE_TEXT_FIELDS = new Set(["amount", "uom", "thc", "cbd"]);

let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Catalog Migration Review</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
  .header { background: #1a4007; color: white; padding: 16px 24px; position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 18px; font-weight: 600; }
  .header .subtitle { font-size: 13px; opacity: 0.8; margin-top: 4px; }
  .header-actions { display: flex; gap: 8px; }
  .header-actions button { background: white; color: #1a4007; border: none; padding: 6px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; }
  .header-actions button:hover { background: #dbf5b3; }
  .header-actions .save-count { font-size: 11px; opacity: 0.7; }
  .tabs { display: flex; gap: 0; background: #f0f0f0; border-bottom: 1px solid #ddd; position: sticky; top: 56px; z-index: 99; flex-wrap: wrap; }
  .tab { padding: 10px 20px; cursor: pointer; font-size: 13px; font-weight: 500; border: none; background: none; border-bottom: 2px solid transparent; color: #666; }
  .tab:hover { background: #e8e8e8; }
  .tab.active { color: #1a4007; border-bottom-color: #1a4007; background: white; }
  .tab .count { background: #e0e0e0; border-radius: 10px; padding: 1px 7px; font-size: 11px; margin-left: 6px; }
  .tab.active .count { background: #dbf5b3; color: #1a4007; }
  .pos-section { display: none; padding: 16px 24px; }
  .pos-section.active { display: block; }
  .stats { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .stat { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px 16px; flex: 1; min-width: 100px; }
  .stat .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat .value { font-size: 22px; font-weight: 600; color: #1a4007; margin-top: 2px; }
  .row-card { background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
  .row-card.has-edits { border-color: #1a4007; border-width: 2px; }
  .row-card.reviewed { border-color: #4caf50; }
  .row-header { padding: 10px 16px; background: #fafafa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; cursor: pointer; gap: 8px; }
  .row-header:hover { background: #f0f0f0; }
  .row-header .row-id { font-size: 12px; font-weight: 600; color: #555; white-space: nowrap; }
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
  .toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .toolbar button { font-size: 12px; color: #1a4007; cursor: pointer; border: 1px solid #1a4007; background: white; padding: 4px 12px; border-radius: 6px; }
  .toolbar button:hover { background: #f0f7e8; }
  .filter-group { display: flex; gap: 4px; align-items: center; font-size: 12px; color: #666; }
  .filter-group select { font-size: 12px; padding: 3px 8px; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: #1a4007; color: white; padding: 10px 20px; border-radius: 8px; font-size: 13px; z-index: 200; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
  .toast.show { display: block; animation: fadein 0.3s; }
  @keyframes fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Catalog Migration Review</h1>
    <div class="subtitle">${data.reduce((s: any, r: any) => s + r.flaggedCount, 0)} flagged rows across ${data.length} POS systems</div>
  </div>
  <div class="header-actions">
    <button onclick="exportCorrections()">Export Corrections</button>
    <button onclick="saveAll()">Save All</button>
    <span class="save-count" id="saveCount"></span>
  </div>
</div>
<div class="tabs">
`;

for (const pos of data) {
  html += `  <button class="tab" data-pos="${esc(pos.posName)}">${esc(pos.posName)}<span class="count">${pos.flaggedCount}</span></button>\n`;
}
html += `</div>\n`;

for (const pos of data) {
  html += `<div class="pos-section" data-pos="${esc(pos.posName)}">
  <div class="stats">
    <div class="stat"><div class="label">Total Rows</div><div class="value">${pos.totalRows.toLocaleString()}</div></div>
    <div class="stat"><div class="label">Flagged</div><div class="value">${pos.flaggedCount}</div></div>
    <div class="stat"><div class="label">Reviewed</div><div class="value" id="reviewed-${esc(pos.posName)}">0</div></div>
  </div>
  <div class="toolbar">
    <button onclick="toggleAll('${esc(pos.posName)}')">Expand / Collapse All</button>
    <div class="filter-group">
      <label>Filter:</label>
      <select onchange="filterRows('${esc(pos.posName)}', this.value)">
        <option value="all">All</option>
        <option value="unreviewed">Unreviewed</option>
        <option value="reviewed">Reviewed</option>
        <option value="edited">Has Edits</option>
      </select>
    </div>
  </div>
`;

  for (const row of pos.flaggedRows) {
    const rowKey = `${pos.posName}__${row.rowIndex}`;
    const productName = esc(row.derived.productName || "(no name)");

    html += `  <div class="row-card" data-row-key="${esc(rowKey)}" data-pos="${esc(pos.posName)}">
    <div class="row-header" onclick="toggleRow(this)">
      <span class="row-id">Row ${row.rowIndex + 1}</span>
      <span class="product-name">${productName}</span>
      <div class="reasons">${row.reasons.map((r: string) => `<span class="reason">${esc(r)}</span>`).join("")}</div>
    </div>
    <div class="row-body">
      <div class="comparison">
        <div class="col-header original">Original (${esc(pos.posName)})</div>
        <div class="col-header transformed">Transformed (Treez) &mdash; editable</div>
        <div class="col-content"><table>`;

    // Original columns (non-empty only)
    const origHeaders = pos.headers as string[];
    for (const h of origHeaders) {
      const val = row.original[h] ?? "";
      if (val.trim() === "") continue;
      html += `<tr><th>${esc(h)}</th><td>${esc(val)}</td></tr>`;
    }

    html += `</table></div><div class="col-content"><table>`;

    // Transformed fields — some editable
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

        html += `<tr><th>${esc(label)}</th><td class="${isHighlighted ? "highlight" : ""}">`;
        html += `<select data-field="${key}" data-row-key="${esc(rowKey)}" data-original="${esc(val)}" onchange="onFieldEdit(this, '${esc(rowKey)}')">`;
        html += `<option value="">(empty)</option>`;
        for (const opt of options) {
          html += `<option value="${esc(opt)}"${opt === val ? " selected" : ""}>${esc(opt)}</option>`;
        }
        // If current value isn't in options, add it
        if (val && !options.includes(val)) {
          html += `<option value="${esc(val)}" selected>${esc(val)} (current)</option>`;
        }
        html += `</select></td></tr>`;
      } else if (EDITABLE_TEXT_FIELDS.has(key)) {
        html += `<tr><th>${esc(label)}</th><td class="${isHighlighted ? "highlight" : ""}">`;
        html += `<input type="text" value="${esc(val)}" data-field="${key}" data-row-key="${esc(rowKey)}" data-original="${esc(val)}" onchange="onFieldEdit(this, '${esc(rowKey)}')" />`;
        html += `</td></tr>`;
      } else {
        html += `<tr><th>${esc(label)}</th><td class="${isEmpty ? "empty" : ""}${isHighlighted ? " highlight" : ""}">${isEmpty ? "(empty)" : esc(val)}</td></tr>`;
      }
    }

    html += `</table></div></div>
      <div class="notes-section">
        <div class="notes-label">Notes</div>
        <textarea data-row-key="${esc(rowKey)}" placeholder="Add notes about this row..." onchange="onNotesEdit(this, '${esc(rowKey)}')"></textarea>
      </div>
      <div class="row-actions">
        <button class="btn-correct" data-row-key="${esc(rowKey)}" onclick="markReviewed(this, '${esc(rowKey)}')">Mark as Reviewed</button>
      </div>
    </div>
  </div>
`;
  }

  html += `</div>\n`;
}

html += `
<div class="toast" id="toast"></div>
<script>
const SUBCATEGORIES = ${JSON.stringify(PRODUCT_SUBCATEGORIES)};

// State: stored in localStorage
const STORAGE_KEY = 'catalog-review-corrections';
let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

// Restore state on load
window.addEventListener('DOMContentLoaded', () => {
  // Restore edits, notes, reviewed status
  for (const [rowKey, rowState] of Object.entries(state)) {
    const card = document.querySelector(\`[data-row-key="\${rowKey}"]\`);
    if (!card) continue;
    const rs = rowState;
    // Restore field edits
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
    // Restore notes
    if (rs.notes) {
      const ta = card.querySelector(\`textarea[data-row-key="\${rowKey}"]\`);
      if (ta) ta.value = rs.notes;
    }
    // Restore reviewed
    if (rs.reviewed) {
      card.classList.add('reviewed');
      const btn = card.querySelector(\`.btn-correct[data-row-key="\${rowKey}"]\`);
      if (btn) { btn.classList.add('marked'); btn.textContent = 'Reviewed'; }
    }
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

  // Visual feedback
  if (el.dataset.original !== el.value) {
    el.classList.add('edited');
  } else {
    el.classList.remove('edited');
  }

  // Update subcategory options when category changes
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

  // Mark card as having edits
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

function toggleAll(posName) {
  const section = document.querySelector(\`.pos-section[data-pos="\${posName}"]\`);
  const bodies = section.querySelectorAll('.row-body');
  const allOpen = [...bodies].every(b => b.classList.contains('open'));
  bodies.forEach(b => allOpen ? b.classList.remove('open') : b.classList.add('open'));
}

function filterRows(posName, filter) {
  const section = document.querySelector(\`.pos-section[data-pos="\${posName}"]\`);
  section.querySelectorAll('.row-card').forEach(card => {
    const key = card.dataset.rowKey;
    const rs = state[key] || {};
    let show = true;
    if (filter === 'unreviewed') show = !rs.reviewed;
    else if (filter === 'reviewed') show = !!rs.reviewed;
    else if (filter === 'edited') show = !!rs.edits && Object.keys(rs.edits).length > 0;
    card.style.display = show ? '' : 'none';
  });
}

function updateCounts() {
  const byPos = {};
  for (const [key, rs] of Object.entries(state)) {
    const pos = key.split('__')[0];
    if (!byPos[pos]) byPos[pos] = 0;
    if (rs.reviewed) byPos[pos]++;
  }
  for (const [pos, count] of Object.entries(byPos)) {
    const el = document.getElementById('reviewed-' + pos);
    if (el) el.textContent = count;
  }
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

// Tab switching
const tabs = document.querySelectorAll('.tab');
const sections = document.querySelectorAll('.pos-section');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(\`.pos-section[data-pos="\${tab.dataset.pos}"]\`).classList.add('active');
  });
});
if (tabs[0]) tabs[0].click();
</script>
</body>
</html>`;

const outputPath = path.join(OUTPUT_DIR, "review.html");
fs.writeFileSync(outputPath, html);
console.log(`Review page written to: ${outputPath}`);
console.log(`Total flagged rows: ${data.reduce((s: any, r: any) => s + r.flaggedCount, 0)}`);
