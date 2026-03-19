import { useCallback, useState } from "react";
import type {
  ParsedFile,
  POSDetectionResult,
  StoreInfo,
  InventoryFileAssignment,
  InventoryFileRole,
} from "../../lib/types";
import { validateFile, parseFile, getSheetNames } from "../../lib/parser";
import { detectPOS } from "../../lib/pos-detection";
import { formatFileSize } from "../../lib/parser";
import { FileDropZone } from "../upload/FileDropZone";
import { SheetSelector, getDefaultSheet } from "../upload/SheetSelector";
import { INVENTORY_FILE_ROLES } from "../../lib/inventory-constants";

type ParsingStatus = "idle" | "parsing" | "done" | "error";

interface InventoryUploadStepProps {
  onCanProceed: (canProceed: boolean) => void;
  parsedFiles: ParsedFile[];
  onParsedFilesChange: (files: ParsedFile[]) => void;
  fileAssignments: InventoryFileAssignment[];
  onFileAssignmentsChange: (assignments: InventoryFileAssignment[]) => void;
  selectedPOS: string;
  onSelectedPOSChange: (pos: string) => void;
  detectedPOS: POSDetectionResult | null;
  onDetectedPOSChange: (result: POSDetectionResult) => void;
  selectedStore: StoreInfo | null;
  dispensaryLicense: string;
  onDispensaryLicenseChange: (license: string) => void;
}

interface PendingSheet {
  file: File;
  sheets: string[];
  selectedSheet: string;
}

const MAX_FILES = 5;

/**
 * Auto-detect file role from filename and headers.
 */
function autoDetectRole(file: ParsedFile): InventoryFileRole | null {
  const name = file.fileName.toLowerCase();
  const headers = new Set(file.headers.map((h) => h.toLowerCase()));

  // Filename heuristics
  if (name.includes("adjustment")) return "adjustments";
  if (name.includes("receipt")) return "receipts";
  if (name.includes("vendor")) return "vendors";
  if (name.includes("inventory")) return "inventory";
  if (name.includes("catalog")) return "catalog_export";

  // Header heuristics
  if (headers.has("external package id") && headers.has("receive date")) return "receipts";
  if (headers.has("vendor name") && headers.has("vendor code")) return "vendors";
  if (headers.has("product key") && headers.has("product category")) return "catalog_export";

  return null;
}

export function InventoryUploadStep({
  onCanProceed,
  parsedFiles,
  onParsedFilesChange,
  fileAssignments,
  onFileAssignmentsChange,
  selectedPOS,
  onSelectedPOSChange,
  detectedPOS,
  onDetectedPOSChange,
  selectedStore,
  dispensaryLicense,
  onDispensaryLicenseChange,
}: InventoryUploadStepProps) {
  const [status, setStatus] = useState<ParsingStatus>(parsedFiles.length > 0 ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pendingSheet, setPendingSheet] = useState<PendingSheet | null>(null);

  const computeCanProceed = useCallback(
    (
      assignments: InventoryFileAssignment[],
      pos: string,
      store: StoreInfo | null,
      license: string,
    ) => {
      const hasInventoryFile = assignments.some((a) => a.role === "inventory");
      return hasInventoryFile && pos !== "" && store !== null && license.trim() !== "";
    },
    [],
  );

  const updateCanProceed = useCallback(
    (assignments: InventoryFileAssignment[], pos: string, license: string) => {
      onCanProceed(computeCanProceed(assignments, pos, selectedStore, license));
    },
    [onCanProceed, computeCanProceed, selectedStore],
  );

  const runDetection = useCallback(
    (files: ParsedFile[], assignments: InventoryFileAssignment[], license: string) => {
      const result = detectPOS(files);
      onDetectedPOSChange(result);
      if (result.detected && !selectedPOS) {
        onSelectedPOSChange(result.detected);
      }
      const effectivePOS = result.detected || selectedPOS;
      onCanProceed(computeCanProceed(assignments, effectivePOS, selectedStore, license));
    },
    [
      onDetectedPOSChange,
      onSelectedPOSChange,
      onCanProceed,
      selectedPOS,
      selectedStore,
      computeCanProceed,
    ],
  );

  const handleFilesSelected = useCallback(
    async (rawFiles: File[]) => {
      setError(null);

      // Check file limit
      if (parsedFiles.length + rawFiles.length > MAX_FILES) {
        setError(
          `Maximum ${MAX_FILES} files allowed. You have ${parsedFiles.length} file(s) already.`,
        );
        return;
      }

      for (const file of rawFiles) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(`${file.name}: ${validationError}`);
          return;
        }
      }

      // Check for multi-sheet XLSX
      if (rawFiles.length === 1) {
        const file = rawFiles[0];
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "xlsx" || ext === "xls") {
          const sheets = await getSheetNames(file);
          if (sheets.length > 1) {
            const defaultSheet = getDefaultSheet(sheets);
            setPendingSheet({ file, sheets, selectedSheet: defaultSheet });
            return;
          }
        }
      }

      await parseFiles(rawFiles);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsedFiles],
  );

  const parseFiles = useCallback(
    async (rawFiles: File[], sheetName?: string) => {
      setStatus("parsing");
      setProgress({ current: 0, total: rawFiles.length });

      try {
        const newParsed: ParsedFile[] = [];
        for (let i = 0; i < rawFiles.length; i++) {
          setProgress({ current: i + 1, total: rawFiles.length });
          const parsed = await parseFile(rawFiles[i], sheetName);
          newParsed.push(parsed);
        }

        const allFiles = [...parsedFiles, ...newParsed];
        onParsedFilesChange(allFiles);

        // Auto-detect roles for new files
        const newAssignments = [...fileAssignments];
        for (const file of newParsed) {
          const detectedRole = autoDetectRole(file);
          if (detectedRole) {
            newAssignments.push({ file, role: detectedRole });
          } else {
            // Default to inventory if no other detection
            newAssignments.push({ file, role: "inventory" });
          }
        }
        onFileAssignmentsChange(newAssignments);

        setStatus("done");
        setPendingSheet(null);
        runDetection(allFiles, newAssignments, dispensaryLicense);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to parse file(s)");
      }
    },
    [
      parsedFiles,
      onParsedFilesChange,
      fileAssignments,
      onFileAssignmentsChange,
      runDetection,
      dispensaryLicense,
    ],
  );

  const handleSheetConfirm = useCallback(() => {
    if (!pendingSheet) return;
    parseFiles([pendingSheet.file], pendingSheet.selectedSheet);
  }, [pendingSheet, parseFiles]);

  const handleRemoveFile = useCallback(
    (fileName: string) => {
      const updated = parsedFiles.filter((f) => f.fileName !== fileName);
      const updatedAssignments = fileAssignments.filter((a) => a.file.fileName !== fileName);
      onParsedFilesChange(updated);
      onFileAssignmentsChange(updatedAssignments);
      if (updated.length === 0) {
        setStatus("idle");
        onCanProceed(false);
        onDetectedPOSChange({ detected: null, confidence: 0, disagreement: false });
      } else {
        runDetection(updated, updatedAssignments, dispensaryLicense);
      }
    },
    [
      parsedFiles,
      fileAssignments,
      onParsedFilesChange,
      onFileAssignmentsChange,
      onCanProceed,
      onDetectedPOSChange,
      runDetection,
      dispensaryLicense,
    ],
  );

  const handleRoleChange = useCallback(
    (fileName: string, newRole: InventoryFileRole) => {
      const updated = fileAssignments.map((a) =>
        a.file.fileName === fileName ? { ...a, role: newRole } : a,
      );
      onFileAssignmentsChange(updated);
      updateCanProceed(updated, selectedPOS, dispensaryLicense);
    },
    [fileAssignments, onFileAssignmentsChange, updateCanProceed, selectedPOS, dispensaryLicense],
  );

  const handlePOSChange = useCallback(
    (pos: string) => {
      onSelectedPOSChange(pos);
      onCanProceed(computeCanProceed(fileAssignments, pos, selectedStore, dispensaryLicense));
    },
    [
      fileAssignments,
      selectedStore,
      dispensaryLicense,
      onSelectedPOSChange,
      onCanProceed,
      computeCanProceed,
    ],
  );

  const handleLicenseChange = useCallback(
    (license: string) => {
      onDispensaryLicenseChange(license);
      updateCanProceed(fileAssignments, selectedPOS, license);
    },
    [onDispensaryLicenseChange, fileAssignments, selectedPOS, updateCanProceed],
  );

  // Role assignment status
  const assignedRoles = new Set(fileAssignments.map((a) => a.role));

  // Duplicate role detection: find roles assigned to multiple files
  const roleCounts = new Map<InventoryFileRole, string[]>();
  for (const a of fileAssignments) {
    const list = roleCounts.get(a.role) ?? [];
    list.push(a.file.fileName);
    roleCounts.set(a.role, list);
  }

  return (
    <div className="w-full space-y-4 p-4">
      <div>
        <h2 className="text-sm font-medium text-gray-900">Upload Inventory Files</h2>
        <p className="mt-1 text-xs text-gray-500">
          Upload up to {MAX_FILES} POS export files (CSV or XLSX). Assign a role to each file.
        </p>
      </div>

      {/* Store gate warning */}
      {!selectedStore && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-700">
            Please select a store above before uploading files.
          </p>
        </div>
      )}

      {/* Drop zone */}
      {parsedFiles.length < MAX_FILES && (
        <FileDropZone
          onFilesSelected={handleFilesSelected}
          disabled={status === "parsing" || !selectedStore}
        />
      )}

      {/* Parsing progress */}
      {status === "parsing" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-treez-primary border-t-transparent" />
            <span className="text-sm text-gray-600">
              Parsing file {progress.current} of {progress.total}...
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-treez-primary transition-all"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Sheet selector for multi-sheet XLSX */}
      {pendingSheet && (
        <div className="space-y-2">
          <SheetSelector
            sheets={pendingSheet.sheets}
            selected={pendingSheet.selectedSheet}
            onSelect={(sheet) => setPendingSheet({ ...pendingSheet, selectedSheet: sheet })}
          />
          <button
            type="button"
            onClick={handleSheetConfirm}
            className="btn-treez -primary -sm"
          >
            Parse selected sheet
          </button>
        </div>
      )}

      {/* File cards with role assignment */}
      {parsedFiles.length > 0 && status === "done" && (
        <div className="space-y-3">
          {parsedFiles.map((file, idx) => {
            const assignment = fileAssignments.find((a) => a.file.fileName === file.fileName);
            const currentRole = assignment?.role ?? "inventory";
            const duplicateFiles = roleCounts.get(currentRole) ?? [];
            const hasDuplicate = duplicateFiles.length > 1;
            const otherFileName = hasDuplicate
              ? duplicateFiles.find((n) => n !== file.fileName)
              : null;

            return (
              <div
                key={file.fileName}
                className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  {/* File info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{file.fileName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      <span>{formatFileSize(file.fileSize)}</span>
                      <span>{file.rowCount.toLocaleString()} rows</span>
                      <span>{file.headers.length} columns</span>
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(file.fileName)}
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

                {/* Role dropdown */}
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600">File role</label>
                  <select
                    value={currentRole}
                    onChange={(e) =>
                      handleRoleChange(file.fileName, e.target.value as InventoryFileRole)
                    }
                    className="treez-select mt-1"
                  >
                    {INVENTORY_FILE_ROLES.map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.label}
                        {r.required ? " (required)" : ""}
                      </option>
                    ))}
                  </select>
                  {autoDetectRole(file) === currentRole && (
                    <p className="mt-0.5 text-xs text-treez-primary">(auto-detected)</p>
                  )}
                  {hasDuplicate && otherFileName && (
                    <p className="mt-0.5 text-xs text-amber-600">
                      This role is already assigned to {otherFileName}
                    </p>
                  )}
                </div>

                {/* POS detection -- show on first card only */}
                {idx === 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      {selectedPOS ? (
                        <span className="text-gray-600">
                          POS: <span className="font-medium text-gray-900">{selectedPOS}</span>
                        </span>
                      ) : (
                        <span className="text-amber-600">POS not detected</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Role status summary */}
      {fileAssignments.length > 0 && status === "done" && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-medium text-gray-700">Role Status</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {INVENTORY_FILE_ROLES.map((roleDef) => {
              const isAssigned = assignedRoles.has(roleDef.role);
              const isMissing = roleDef.required && !isAssigned;
              return (
                <span
                  key={roleDef.role}
                  className={`inline-flex items-center gap-1 text-xs ${
                    isAssigned ? "text-green-700" : isMissing ? "text-red-600" : "text-gray-400"
                  }`}
                >
                  {isAssigned ? (
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : isMissing ? (
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="inline-block h-3.5 w-3.5 text-center leading-3">--</span>
                  )}
                  {roleDef.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Dispensary License */}
      {selectedStore && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Dispensary License Number
          </label>
          <input
            type="text"
            value={dispensaryLicense}
            onChange={(e) => handleLicenseChange(e.target.value)}
            placeholder="e.g., C12-0000331-LIC"
            className="treez-input"
          />
          <p className="text-xs text-gray-500">
            Required. This license number will be included in every row of the import.
          </p>
        </div>
      )}
    </div>
  );
}
