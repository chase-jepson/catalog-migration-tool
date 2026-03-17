import { useState } from "react";
import type { ErrorGroup } from "../../lib/types";
import { ErrorBatchRow } from "./ErrorBatchRow";

interface ErrorGroupListProps {
  groups: ErrorGroup[];
  onFix: (rowIndices: number[], field: string, newValue: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  category: "Category",
  subCategory: "Sub-Category",
  classification: "Classification",
  status: "Status",
  uom: "UoM",
  merchSize: "Merch Size",
  productName: "Product Name",
  productId: "Product ID",
  amount: "Amount",
  basePrice: "Price",
  description: "Description",
  strain: "Strain",
  thc: "THC",
  cbd: "CBD",
};

export function ErrorGroupList({ groups, onFix }: ErrorGroupListProps) {
  const [collapsedFields, setCollapsedFields] = useState<Set<string>>(new Set());

  // Sort: errors before warnings, then by row count descending
  const sorted = [...groups].sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "error" ? -1 : 1;
    }
    return b.rows.length - a.rows.length;
  });

  const toggleField = (key: string) => {
    setCollapsedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-2">
      {sorted.map((group) => {
        const groupKey = `${group.field}|${group.message}`;
        const isCollapsed = collapsedFields.has(groupKey);
        const label = FIELD_LABELS[group.field] ?? group.field;
        const badgeColor =
          group.severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";

        return (
          <div key={groupKey} className="rounded-lg border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => toggleField(groupKey)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}
                >
                  {group.severity === "error" ? "Error" : "Warning"}
                </span>
                <span>
                  {label}: {group.rows.length} row{group.rows.length !== 1 ? "s" : ""}
                </span>
              </span>
              <span className="text-gray-400 text-xs">{isCollapsed ? "+" : "\u2212"}</span>
            </button>

            {!isCollapsed && (
              <div className="border-t border-gray-100">
                <ErrorBatchRow group={group} onFix={onFix} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
