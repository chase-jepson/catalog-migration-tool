import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildInventoryCSV,
  serializeCSV,
  INVENTORY_OUTPUT_COLUMNS,
} from "../../lib/inventory-csv-generator";
import { sendMessage } from "../../lib/messaging";
import { buildUploadPayload } from "../../lib/file-uploader";
import {
  getAdaptiveInterval,
  isTerminalStatus,
  MAX_POLL_DURATION_MS,
} from "../../lib/import-poller";
import { detectEnvironment, getApiBaseUrl } from "../../lib/env";
import type { InventoryDerivedRow, PortalReindexResult, StoreInfo } from "../../lib/types";

interface InventoryImportStepProps {
  derivedRows: InventoryDerivedRow[];
  selectedStore: StoreInfo | null;
  dispensaryLicense: string;
  portalJobId: string | null;
  portalStoreId: string | null;
  onDone?: () => void;
  onStartNew: () => void;
}

type Phase =
  | "pre-import"
  | "generating"
  | "uploading"
  | "processing"
  | "success"
  | "completed-with-failures"
  | "failed"
  | "error"
  | "rolling-back"
  | "rolled-back";
type ReindexPhase = "idle" | "credentials" | "reindexing" | "done" | "error";

export function InventoryImportStep({
  derivedRows,
  selectedStore,
  dispensaryLicense,
  portalJobId,
  portalStoreId,
  onDone,
  onStartNew,
}: InventoryImportStepProps) {
  const [phase, setPhase] = useState<Phase>("pre-import");
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [rollbackResult, setRollbackResult] = useState<Record<string, number> | null>(null);
  const [totalImported, setTotalImported] = useState(0);

  // Reindex state
  const [reindexPhase, setReindexPhase] = useState<ReindexPhase>("idle");
  const [reindexUsername, setReindexUsername] = useState("");
  const [reindexPassword, setReindexPassword] = useState("");
  const [reindexResult, setReindexResult] = useState<PortalReindexResult | null>(null);
  const [reindexError, setReindexError] = useState("");

  const cancelledRef = useRef(false);

  // Warn user before closing during import
  useEffect(() => {
    if (phase !== "uploading" && phase !== "processing") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const activeRows = useMemo(() => derivedRows.filter((r) => !r.excluded), [derivedRows]);

  // Determine which file roles contributed to this data
  const rolesUsed = useMemo(() => {
    const roles: string[] = ["Inventory"];
    if (activeRows.some((r) => r.invoiceId !== "")) roles.push("Receipts");
    if (activeRows.some((r) => r.distributorName !== "")) roles.push("Vendors");
    return roles;
  }, [activeRows]);

  // ── Get Token and URL ─────────────────────────────────────────────────────
  const getTokenAndUrl = useCallback(async () => {
    let tabUrl: string;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabUrl = tab?.url ?? "";
    } catch {
      tabUrl = window.location.href;
    }
    const env = detectEnvironment(tabUrl);
    if (!env) throw new Error("Could not detect Treez environment from current page");

    const apiBaseUrl = getApiBaseUrl(env);
    const { token } = await sendMessage("getAuthToken", { appUrl: tabUrl });
    if (!token)
      throw new Error("No auth token available. Please refresh the Treez page and try again.");

    return { apiBaseUrl, token };
  }, []);

  // ── Run Import ────────────────────────────────────────────────────────────
  const handleStartImport = useCallback(async () => {
    if (!selectedStore) return;

    cancelledRef.current = false;
    setErrorMessage("");
    setProgressPercent(0);

    try {
      // Step 1: Generate CSV
      setPhase("generating");
      setStatusMessage("Generating 56-column inventory CSV...");

      const csvData = buildInventoryCSV(derivedRows);
      const dataRowCount = csvData.length - 1; // subtract header

      if (dataRowCount === 0) {
        setErrorMessage("No rows to import. All rows were excluded.");
        setPhase("error");
        return;
      }

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const fileName = `CS Tool - Inventory Import - ${selectedStore.name} - ${ts}.csv`;

      // Step 2: Upload
      setPhase("uploading");
      setStatusMessage("Uploading to Treez...");
      setProgressPercent(25);

      const { apiBaseUrl, token } = await getTokenAndUrl();
      const { csvContent, contentLength } = buildUploadPayload(csvData, fileName);

      if (cancelledRef.current) return;

      const { presignedUrl } = await sendMessage("getPresignedUrl", {
        apiBaseUrl,
        token,
        params: {
          name: fileName,
          contentLength,
          objectType: "INVENTORY_IMPORT",
          objectId: "INVENTORY_IMPORT",
        },
      });

      if (cancelledRef.current) return;

      const uploadResult = await sendMessage("uploadToS3", {
        presignedUrl,
        csvContent,
        contentLength,
      });

      if (!uploadResult.ok) {
        throw new Error(uploadResult.error ?? "S3 upload failed");
      }

      setProgressPercent(50);

      // Step 3: Poll for completion
      setPhase("processing");
      setStatusMessage("Processing import...");

      const interval = getAdaptiveInterval(dataRowCount);
      const pollStart = Date.now();
      let jobId: string | null = null;

      while (true) {
        if (cancelledRef.current) break;
        if (Date.now() - pollStart > MAX_POLL_DURATION_MS) {
          throw new Error("Import timed out after 60 minutes");
        }

        await new Promise((resolve) => setTimeout(resolve, interval));

        const { apiBaseUrl: pollApiUrl, token: pollToken } = await getTokenAndUrl();
        const jobs = await sendMessage("fetchImportReport", {
          apiBaseUrl: pollApiUrl,
          token: pollToken,
        });

        const job: any = jobId
          ? jobs.find((j: any) => j.id === jobId)
          : jobs.find((j: any) => j.name === fileName);

        if (job) {
          if (!jobId) jobId = job.id;

          // Update progress
          const jobProgress =
            job.totalRows && job.totalRows > 0 ? job.countProcessed / job.totalRows : 0;
          setProgressPercent(50 + Math.round(jobProgress * 50));
          setStatusMessage(
            `Processing: ${job.countProcessed}/${job.totalRows ?? dataRowCount} rows`,
          );

          // Check for terminal status
          const allProcessed =
            job.totalRows != null && job.totalRows > 0 && job.countProcessed >= job.totalRows;

          if (isTerminalStatus(job.status) || allProcessed) {
            if (job.status === "FINISHED" || allProcessed) {
              setTotalImported(job.countProcessed);
              setProgressPercent(100);
              setPhase("success");
              onDone?.();
              return;
            } else if (job.status === "FINISHED_WITH_FAILURES") {
              setTotalImported(job.countProcessed - job.countError);
              setErrorMessage(`${job.countError ?? 0} rows failed during import.`);
              setProgressPercent(100);
              setPhase("completed-with-failures");
              onDone?.();
              return;
            } else {
              throw new Error(`Import stopped: ${job.status} (${job.countError} errors)`);
            }
          }
        }
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setErrorMessage(err instanceof Error ? err.message : "Import failed");
        setPhase("error");
      }
    }
  }, [derivedRows, selectedStore, getTokenAndUrl]);

  // ── Portal Cancel (discard validated job) ─────────────────────────────────────
  const handlePortalCancel = useCallback(async () => {
    if (!portalJobId) return;
    try {
      await sendMessage("portalCancel", { jobId: portalJobId });
      setErrorMessage("Job cancelled. You can start a new migration.");
      setPhase("error");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Cancel failed");
      setPhase("error");
    }
  }, [portalJobId]);

  // ── Portal Execute (uses validated job) ─────────────────────────────────────
  const handlePortalExecute = useCallback(async () => {
    if (!portalJobId) return;
    cancelledRef.current = false;
    setErrorMessage("");
    setProgressPercent(0);

    try {
      setPhase("uploading");
      setStatusMessage("Executing import via portal...");
      setProgressPercent(10);

      await sendMessage("portalExecute", { jobId: portalJobId });
      setProgressPercent(25);

      // Poll for completion
      setPhase("processing");
      setStatusMessage("Processing import...");
      const pollStart = Date.now();

      while (true) {
        if (cancelledRef.current) break;
        if (Date.now() - pollStart > MAX_POLL_DURATION_MS) {
          throw new Error("Import timed out after 60 minutes");
        }
        await new Promise((r) => setTimeout(r, 5000));

        const job = await sendMessage("portalGetJob", { jobId: portalJobId });

        const processed = job.processed_invoices ?? 0;
        const total = job.total_invoices ?? 1;
        setProgressPercent(25 + Math.round((processed / total) * 75));
        setStatusMessage(`Processing: ${processed}/${total} invoices`);

        if (["COMPLETED", "FAILED", "ROLLED_BACK"].includes(job.status)) {
          setTotalImported(job.succeeded_rows ?? 0);
          setProgressPercent(100);
          if (job.status === "COMPLETED") {
            setPhase("success");
            onDone?.();
          } else if (job.status === "FAILED") {
            setErrorMessage(
              `Import failed: ${job.error_summary ?? "Unknown error"}. ${job.succeeded_rows ?? 0} rows succeeded, ${job.failed_rows ?? 0} failed.`,
            );
            setPhase("failed");
          } else if (job.status === "ROLLED_BACK") {
            setRollbackResult(null);
            setErrorMessage("");
            setPhase("rolled-back");
            onDone?.();
          }
          return;
        }
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setErrorMessage(err instanceof Error ? err.message : "Portal import failed");
        setPhase("error");
      }
    }
  }, [portalJobId, onDone]);

  // ── Portal Rollback ─────────────────────────────────────────────────────────
  const handleRollback = useCallback(async () => {
    if (!portalJobId) return;
    setPhase("rolling-back");
    setStatusMessage("Rolling back import...");

    try {
      const result = await sendMessage("portalRollback", { jobId: portalJobId });
      setRollbackResult(result.deleted_counts);
      setPhase("rolled-back");
      onDone?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Rollback failed");
      setPhase("error");
    }
  }, [portalJobId, onDone]);

  // ── Reindex OpenSearch ────────────────────────────────────────────────────────
  const handleReindex = useCallback(async () => {
    if (!portalStoreId || !reindexUsername || !reindexPassword) return;
    setReindexPhase("reindexing");
    setReindexError("");

    try {
      const result = await sendMessage("portalReindex", {
        storeId: portalStoreId,
        username: reindexUsername,
        password: reindexPassword,
      });
      setReindexResult(result);
      setReindexPhase("done");
    } catch (err) {
      setReindexError(err instanceof Error ? err.message : "Reindex failed");
      setReindexPhase("error");
    }
  }, [portalStoreId, reindexUsername, reindexPassword]);

  // ── Download CSV ────────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    const csvData = buildInventoryCSV(derivedRows);
    const csvString = serializeCSV(csvData);

    const storeName = selectedStore?.name ?? "inventory";
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const fileName = `CS Tool - Inventory Import - ${storeName} - ${ts}.csv`;

    const blob = new Blob([csvString], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [derivedRows, selectedStore]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full flex-col p-4">
      {/* Header */}
      <h2 className="mb-3 text-sm font-medium text-gray-900">
        {phase === "success" || phase === "completed-with-failures" || phase === "rolled-back"
          ? "Import Complete"
          : phase === "failed"
            ? "Import Failed"
            : "Import Inventory to Treez"}
      </h2>

      {selectedStore && <p className="mb-3 text-xs text-gray-500">Store: {selectedStore.name}</p>}

      {/* Warning during upload/processing */}
      {(phase === "uploading" || phase === "processing") && (
        <div className="mb-3 flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-amber-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-amber-800">
            Do not close this window until import finishes.
          </span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 space-y-3 overflow-auto">
        {/* Pre-import state */}
        {phase === "pre-import" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Generate and upload the 56-column inventory CSV to Treez.
            </p>

            <div className="rounded border border-gray-200 bg-white p-3 space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{activeRows.length.toLocaleString()}</span> rows ready
                for import
              </p>
              <p className="text-xs text-gray-500">
                {INVENTORY_OUTPUT_COLUMNS.length} columns | {rolesUsed.join(" + ")}
              </p>
              {dispensaryLicense && (
                <p className="text-xs text-gray-500">License: {dispensaryLicense}</p>
              )}
            </div>

            {activeRows.length === 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-600">No rows to import. All rows were excluded.</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={activeRows.length === 0}
                className="btn-treez -outline flex-1"
              >
                Download
              </button>
              <button
                type="button"
                onClick={portalJobId ? handlePortalExecute : handleStartImport}
                disabled={activeRows.length === 0}
                className="btn-treez -primary flex-1"
              >
                Import
              </button>
            </div>

            {portalJobId && (
              <button
                type="button"
                onClick={handlePortalCancel}
                className="w-full font-[Roboto,sans-serif] text-xs text-gray-500 hover:text-red-600"
              >
                Cancel validated job
              </button>
            )}
          </div>
        )}

        {/* Generating / Uploading / Processing -- single progress bar */}
        {(phase === "generating" || phase === "uploading" || phase === "processing") && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-treez-primary border-t-transparent" />
              <span className="text-sm text-gray-700">{statusMessage}</span>
            </div>

            <div className="h-2 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-treez-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-center text-xs text-gray-500">{progressPercent}% complete</p>
          </div>
        )}

        {/* Done state */}
        {(phase === "success" || phase === "completed-with-failures") && (
          <div className="space-y-3">
            <div
              className={`rounded border px-3 py-2 text-center ${
                phase === "success"
                  ? "border-green-200 bg-green-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  phase === "success" ? "text-green-800" : "text-amber-800"
                }`}
              >
                {phase === "success"
                  ? "Inventory import completed successfully"
                  : "Inventory import completed with failures"}
              </p>
              {totalImported > 0 && (
                <p className={`text-xs ${phase === "success" ? "text-green-600" : "text-amber-700"}`}>
                  {totalImported.toLocaleString()} rows imported
                </p>
              )}
              {phase === "completed-with-failures" && errorMessage && (
                <p className="mt-1 text-xs text-amber-700">{errorMessage}</p>
              )}
            </div>

            {/* OpenSearch Reindex Section */}
            {portalStoreId && reindexPhase !== "done" && (
              <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2">
                <p className="text-xs font-medium text-gray-800">Reindex OpenSearch</p>
                <p className="text-xs text-gray-600">
                  Trigger an OpenSearch reindex so imported inventory appears in Treez.
                </p>

                {(reindexPhase === "idle" ||
                  reindexPhase === "credentials" ||
                  reindexPhase === "error") && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setReindexPhase("credentials");
                      handleReindex();
                    }}
                    className="space-y-2"
                  >
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      autoComplete="username"
                      value={reindexUsername}
                      onChange={(e) => setReindexUsername(e.target.value)}
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
                    />
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      autoComplete="current-password"
                      value={reindexPassword}
                      onChange={(e) => setReindexPassword(e.target.value)}
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
                    />
                    {reindexPhase === "error" && (
                      <p className="text-xs text-red-600">{reindexError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={!reindexUsername || !reindexPassword}
                      className="btn-treez -primary -sm w-full"
                    >
                      Reindex
                    </button>
                  </form>
                )}

                {reindexPhase === "reindexing" && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                    <span className="text-xs text-gray-600">Reindexing OpenSearch...</span>
                  </div>
                )}
              </div>
            )}

            {/* Reindex success */}
            {reindexPhase === "done" && reindexResult && (
              <div className="rounded border border-green-200 bg-green-50 px-3 py-2">
                <p className="text-xs font-medium text-green-800">OpenSearch reindex complete</p>
                <p className="text-xs text-green-600">
                  {reindexResult.successful_uploads} successful, {reindexResult.failed_uploads}{" "}
                  failed out of {reindexResult.total} total
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onStartNew}
                className="btn-treez -primary flex-1"
              >
                Start New Migration
              </button>
              {portalJobId && (
                <button
                  type="button"
                  onClick={handleRollback}
                  className="btn-treez -danger flex-1"
                >
                  Rollback Import
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="space-y-3">
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-800">Inventory import failed</p>
              <p className="mt-1 text-sm text-red-700">{errorMessage}</p>
              {totalImported > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  {totalImported.toLocaleString()} rows were imported before failure
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onStartNew}
                className="btn-treez -secondary flex-1"
              >
                Start New Migration
              </button>
              {portalJobId && (
                <button
                  type="button"
                  onClick={handleRollback}
                  className="btn-treez -danger flex-1"
                >
                  Rollback Import
                </button>
              )}
            </div>
          </div>
        )}

        {/* Rolling back */}
        {phase === "rolling-back" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            <span className="text-sm text-gray-700">{statusMessage}</span>
          </div>
        )}

        {/* Rolled back */}
        {phase === "rolled-back" && (
          <div className="space-y-3">
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-center">
              <p className="text-sm font-medium text-amber-800">Import rolled back successfully</p>
              {rollbackResult && (
                <div className="mt-1 text-xs text-amber-700">
                  {Object.entries(rollbackResult).map(([table, count]) => (
                    <span key={table} className="mr-3">
                      {table}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onStartNew}
              className="btn-treez -primary w-full"
            >
              Start New Migration
            </button>
          </div>
        )}

        {/* Error state */}
        {phase === "error" && (
          <div className="space-y-3">
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStartImport}
                className="btn-treez -primary flex-1"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onStartNew}
                className="btn-treez -secondary flex-1"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
