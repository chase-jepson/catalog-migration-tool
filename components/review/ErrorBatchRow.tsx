import { useState } from "react";
import type { ErrorGroup } from "../../lib/types";

interface ErrorBatchRowProps {
  group: ErrorGroup;
  onFix: (rowIndices: number[], field: string, newValue: string) => void;
}

export function ErrorBatchRow({ group, onFix }: ErrorBatchRowProps) {
  const [fixValue, setFixValue] = useState("");
  const rowIndices = group.rows.map((r) => r.rowIndex);
  const sampleValue = group.rows[0]?.currentValue ?? "";

  const handleApply = () => {
    if (!fixValue) return;
    onFix(rowIndices, group.field, fixValue);
    setFixValue("");
  };

  return (
    <div className="px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          <span
            className={`font-medium ${group.severity === "error" ? "text-red-600" : "text-amber-600"}`}
          >
            &quot;{sampleValue || "(empty)"}&quot;
          </span>{" "}
          <span className="text-gray-400">
            ({group.rows.length} row{group.rows.length !== 1 ? "s" : ""})
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xs">&rarr;</span>
        {group.fixType === "dropdown" && group.dropdownOptions ? (
          <select
            value={fixValue}
            onChange={(e) => setFixValue(e.target.value)}
            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-treez-accent focus:border-treez-accent"
          >
            <option value="">Select...</option>
            {group.dropdownOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={fixValue}
            onChange={(e) => setFixValue(e.target.value)}
            placeholder="Enter value..."
            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-treez-accent focus:border-treez-accent"
          />
        )}
        <button
          type="button"
          disabled={!fixValue}
          onClick={handleApply}
          className="whitespace-nowrap rounded bg-treez-primary px-2 py-1 text-xs font-medium text-white hover:bg-treez-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply to all {group.rows.length} rows
        </button>
      </div>
    </div>
  );
}
