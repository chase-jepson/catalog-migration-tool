import { useCallback, useRef, useState } from "react";

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function FileDropZone({ onFilesSelected, disabled }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [disabled, onFilesSelected],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        onFilesSelected(files);
      }
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFilesSelected],
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`flex items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors ${
        isDragOver ? "border-treez-accent-muted0 bg-treez-accent-muted" : "border-gray-300 bg-white"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {/* File icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
        <svg
          className="h-5 w-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="btn-treez -primary -sm"
          >
            Choose file
          </button>
          <span className="text-sm text-gray-500">or drag and drop</span>
        </div>
        <p className="text-xs text-gray-400">CSV, XLSX up to 100MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
