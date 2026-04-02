import { useState } from "react";
import { formatFileSize } from "../../lib/parser";
import { POS_SYSTEMS } from "../../lib/constants";
import type { ParsedFile, POSDetectionResult } from "../../lib/types";

interface FileSummaryCardProps {
  file: ParsedFile;
  detectedPOS: POSDetectionResult | null;
  selectedPOS: string;
  onSelectedPOSChange: (pos: string) => void;
  onRemoveFile: (fileId: string) => void;
  showPOS?: boolean;
}

const POS_OPTIONS = [...POS_SYSTEMS, "Other"] as const;

export function FileSummaryCard({
  file,
  detectedPOS,
  selectedPOS,
  onSelectedPOSChange,
  onRemoveFile,
  showPOS = false,
}: FileSummaryCardProps) {
  const [showPOSDropdown, setShowPOSDropdown] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* File icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-treez-accent-muted">
            <svg
              className="h-5 w-5 text-treez-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          {/* File info */}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{file.fileName}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
              <span>{formatFileSize(file.fileSize)}</span>
              <span>{file.rowCount.toLocaleString()} rows</span>
              <span>{file.headers.length} columns</span>
            </div>
          </div>
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={() => onRemoveFile(file.id ?? file.fileName)}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Remove file"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* POS detection (shown only on the first/main card) */}
      {showPOS && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 text-sm">
            {selectedPOS ? (
              <>
                <span className="text-gray-600">
                  POS: <span className="font-medium text-gray-900">{selectedPOS}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPOSDropdown(!showPOSDropdown)}
                  className="text-treez-primary hover:text-treez-primary"
                >
                  Change
                </button>
              </>
            ) : (
              <>
                <span className="text-amber-600">POS not detected</span>
                <button
                  type="button"
                  onClick={() => setShowPOSDropdown(!showPOSDropdown)}
                  className="text-treez-primary hover:text-treez-primary"
                >
                  Select
                </button>
              </>
            )}
          </div>

          {detectedPOS?.disagreement && (
            <p className="mt-1 text-xs text-amber-600">Files suggest different POS systems</p>
          )}

          {showPOSDropdown && (
            <select
              value={selectedPOS}
              onChange={(e) => {
                onSelectedPOSChange(e.target.value);
                setShowPOSDropdown(false);
              }}
              className="treez-select mt-2"
            >
              <option value="">-- Select POS --</option>
              {POS_OPTIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
