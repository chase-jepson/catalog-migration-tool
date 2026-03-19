interface SheetSelectorProps {
  sheets: string[];
  selected: string;
  onSelect: (sheet: string) => void;
}

/**
 * Dropdown selector for XLSX files with multiple sheets.
 * Defaults to "Product Options" sheet if available (v1 heuristic).
 */
export function SheetSelector({ sheets, selected, onSelect }: SheetSelectorProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <label className="mb-1 block text-xs font-medium text-gray-600">Select sheet</label>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="treez-select"
      >
        {sheets.map((sheet) => (
          <option key={sheet} value={sheet}>
            {sheet}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Determine the default sheet to select.
 * Prefers "Product Options" if available (Dutchie XLSX pattern).
 */
export function getDefaultSheet(sheets: string[]): string {
  const preferred = sheets.find((s) => s === "Product Options");
  return preferred ?? sheets[0];
}
