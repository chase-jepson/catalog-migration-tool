import { useState } from "react";
import type { ParsedFile, FieldMapping } from "../../lib/types";

interface DataPreviewProps {
  mergedFile: ParsedFile;
  mappings: FieldMapping[];
  onColumnClick: (header: string) => void;
}

const PREVIEW_ROW_COUNT = 8;

export function DataPreview({ mergedFile, mappings, onColumnClick }: DataPreviewProps) {
  const [open, setOpen] = useState(false);

  const mappedHeaders = new Set(mappings.filter((m) => m.sourceHeader).map((m) => m.sourceHeader!));

  const rows = mergedFile.previewRows.slice(0, PREVIEW_ROW_COUNT);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2"
      >
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-semibold text-gray-700">Preview Data</span>
        <span className="text-xs text-gray-400">
          ({mergedFile.headers.length} columns, {mergedFile.rowCount} rows)
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-gray-100 px-1 pb-2">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {mergedFile.headers.map((header) => {
                  const isMapped = mappedHeaders.has(header);
                  return (
                    <th
                      key={header}
                      onClick={() => onColumnClick(header)}
                      className={`cursor-pointer whitespace-nowrap px-2 py-1.5 text-left text-xs font-medium ${
                        isMapped ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-gray-50">
                  {mergedFile.headers.map((header) => (
                    <td
                      key={header}
                      className="max-w-[10rem] truncate whitespace-nowrap bg-white px-2 py-1 text-xs text-gray-700"
                    >
                      {row[header] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
