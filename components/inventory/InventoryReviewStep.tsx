import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  InventoryDerivedRow,
  InventoryFileAssignment,
  PortalAuthState,
  PortalStore,
  PortalValidationResult,
  RowFix,
  RowValidationError,
  ValidationResult,
  StoreInfo,
} from "../../lib/types";
import type { PerRoleMappings, ETLInput } from "../../lib/inventory-transformer";
import { runInventoryETL } from "../../lib/inventory-transformer";
import {
  validateInventoryRows,
  validateCrossRow,
  groupInventoryErrors,
  mapPortalIssuesToErrors,
} from "../../lib/inventory-validator";
import { buildInventoryCSV, serializeCSV } from "../../lib/inventory-csv-generator";
import { sendMessage } from "../../lib/messaging";
import { getPortalAuth } from "../../lib/portal-auth";
import { ErrorGroupList } from "../review/ErrorGroupList";
import { PortalLoginForm } from "./PortalLoginForm";
import { buildInventoryETLInput } from "../../lib/inventory-file-assignments";

interface InventoryReviewStepProps {
  fileAssignments: InventoryFileAssignment[];
  perRoleMappings: PerRoleMappings;
  dispensaryLicense: string;
  onCanProceed: (can: boolean) => void;
  onDerivedRowsChange: (rows: InventoryDerivedRow[]) => void;
  onWarningCountChange?: (count: number) => void;
  onPortalJobId?: (jobId: string | null) => void;
  onPortalStoreId?: (storeId: string | null) => void;
  fixes: RowFix[];
  onFixesChange: (fixes: RowFix[]) => void;
  selectedStore: StoreInfo | null;
}

type Status =
  | "processing"
  | "ready"
  | "reviewing"
  | "portal-login"
  | "portal-validating"
  | "portal-done";

/**
 * Apply row-level fixes to derived rows.
 */
function applyFixes(rows: InventoryDerivedRow[], fixes: RowFix[]): InventoryDerivedRow[] {
  if (fixes.length === 0) return rows;
  return rows.map((row, i) => {
    let updated = row;
    for (const fix of fixes) {
      if (fix.rowIndex === i && fix.field in row) {
        updated = { ...updated, [fix.field]: fix.newValue };
      }
    }
    return updated;
  });
}

export function InventoryReviewStep({
  fileAssignments,
  perRoleMappings,
  dispensaryLicense,
  onCanProceed,
  onDerivedRowsChange,
  onWarningCountChange,
  onPortalJobId,
  onPortalStoreId,
  fixes,
  onFixesChange,
  selectedStore,
}: InventoryReviewStepProps) {
  const [status, setStatus] = useState<Status>("processing");
  const [derivedRows, setDerivedRows] = useState<InventoryDerivedRow[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [portalAuth, setPortalAuth] = useState<PortalAuthState | null>(null);
  const [portalResult, setPortalResult] = useState<PortalValidationResult | null>(null);
  const [portalErrors, setPortalErrors] = useState<RowValidationError[]>([]);
  const [portalError, setPortalError] = useState("");
  const [portalSkipped, setPortalSkipped] = useState(false);

  const groups = useMemo(() => {
    if (!validation) return [];
    return groupInventoryErrors(validation.errors);
  }, [validation]);

  const errorGroups = useMemo(() => groups.filter((g) => g.severity === "error"), [groups]);
  const warningGroups = useMemo(() => groups.filter((g) => g.severity === "warning"), [groups]);

  // Portal error groups
  const portalErrorGroups = useMemo(() => {
    if (portalErrors.length === 0) return { errors: [], warnings: [] };
    const grouped = groupInventoryErrors(portalErrors);
    return {
      errors: grouped.filter((g) => g.severity === "error"),
      warnings: grouped.filter((g) => g.severity === "warning"),
    };
  }, [portalErrors]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const active = derivedRows.filter((r) => !r.excluded);
    const rolesUsed = Array.from(new Set(fileAssignments.map((a) => a.role)));
    const uniqueInvoices = new Set(active.map((r) => r.invoiceId).filter(Boolean));
    const enrichedDistributors = active.filter((r) => r.distributorName !== "").length;

    return {
      totalRows: active.length,
      rolesUsed,
      invoiceCount: uniqueInvoices.size,
      distributorEnriched: enrichedDistributors,
    };
  }, [derivedRows, fileAssignments]);

  const hasReceipts = useMemo(
    () => fileAssignments.some((a) => a.role === "receipts"),
    [fileAssignments],
  );

  // ── Run ETL + validate pipeline ───────────────────────────────────────────
  const runPipeline = useCallback(
    (currentFixes: RowFix[]) => {
      setStatus("processing");
      setPortalResult(null);
      setPortalErrors([]);
      setPortalError("");
      setPortalSkipped(false);

      requestAnimationFrame(() => {
        const etlInputResult = buildInventoryETLInput(fileAssignments);
        if (!etlInputResult.ok) {
          setPortalError(etlInputResult.reason);
          setStatus("reviewing");
          onCanProceed(false);
          return;
        }

        const rows = runInventoryETL(etlInputResult.input, perRoleMappings, dispensaryLicense);
        const fixed = currentFixes.length > 0 ? applyFixes(rows, currentFixes) : rows;

        // Layer 1: per-field validation
        const layer1 = validateInventoryRows(fixed);

        // Layer 2: cross-row validation
        const crossRowErrors = validateCrossRow(fixed);

        // Merge all errors
        const allErrors = [...layer1.errors, ...crossRowErrors];
        const errorCount = allErrors.filter((e) => e.severity === "error").length;
        const warningCount = allErrors.filter((e) => e.severity === "warning").length;
        const rowsWithErrors = new Set(
          allErrors.filter((e) => e.severity === "error").map((e) => e.rowIndex),
        ).size;
        const activeRows = fixed.filter((r) => !r.excluded).length;

        const validationResult: ValidationResult = {
          validCount: activeRows - rowsWithErrors,
          errorCount,
          warningCount,
          errors: allErrors,
        };

        setDerivedRows(fixed);
        setValidation(validationResult);
        onDerivedRowsChange(fixed);
        onWarningCountChange?.(warningCount);

        const hasErrors = errorCount > 0;
        onCanProceed(!hasErrors);
        setStatus(hasErrors ? "reviewing" : "ready");
      });
    },
    [
      fileAssignments,
      perRoleMappings,
      dispensaryLicense,
      onCanProceed,
      onDerivedRowsChange,
      onWarningCountChange,
    ],
  );

  // ── Initial run on mount ──────────────────────────────────────────────────
  useEffect(() => {
    runPipeline(fixes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Portal validation flow ─────────────────────────────────────────────────
  const runPortalValidation = useCallback(
    async (auth: PortalAuthState) => {
      setStatus("portal-validating");
      setPortalError("");
      setPortalErrors([]);

      try {
        // Step 1: Generate CSV content
        const csvData = buildInventoryCSV(derivedRows);
        const csvContent = serializeCSV(csvData);
        const fileName = `validation-${Date.now()}.csv`;

        // Step 2: Fetch portal stores to find matching store ID
        const portalStores = await sendMessage("portalFetchStores", {
          portalToken: auth.token,
        });

        // Match by store name (case-insensitive)
        const storeName = selectedStore?.name?.toLowerCase() ?? "";
        const matchedStore = portalStores.find(
          (s: PortalStore) =>
            s.name.toLowerCase() === storeName || s.store_id === selectedStore?.entityId,
        );

        if (!matchedStore) {
          setPortalError(
            `Could not find store "${selectedStore?.name}" in the portal. ` +
              `Available: ${portalStores.map((s: PortalStore) => s.name).join(", ")}`,
          );
          setStatus("ready");
          onCanProceed(true); // Allow proceeding despite portal mismatch
          return;
        }

        // Step 3: Send to portal for validation
        const result = await sendMessage("portalValidate", {
          portalToken: auth.token,
          csvContent,
          storeId: matchedStore.id,
          fileName,
        });

        setPortalResult(result);
        onPortalJobId?.(result.job_id);
        onPortalStoreId?.(matchedStore.id);

        // Step 4: Map portal issues to local format
        const mappedErrors = mapPortalIssuesToErrors(result.issues);
        setPortalErrors(mappedErrors);

        const portalHasErrors = mappedErrors.some((e) => e.severity === "error");
        onCanProceed(!portalHasErrors);
        setStatus("portal-done");
      } catch (err) {
        setPortalError(err instanceof Error ? err.message : "Portal validation failed");
        setStatus("ready");
        onCanProceed(true); // Allow proceeding if portal is unreachable
      }
    },
    [derivedRows, selectedStore, onCanProceed],
  );

  // ── Auto-trigger portal validation when local passes ───────────────────────
  useEffect(() => {
    if (status !== "ready" || portalSkipped || portalResult) return;
    if (validation && validation.errorCount === 0) {
      // Check for existing auth
      getPortalAuth().then((auth) => {
        if (auth) {
          setPortalAuth(auth);
          runPortalValidation(auth);
        } else {
          setStatus("portal-login");
          onCanProceed(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handlePortalAuthenticated = useCallback(
    (auth: PortalAuthState) => {
      setPortalAuth(auth);
      runPortalValidation(auth);
    },
    [runPortalValidation],
  );

  const handleSkipPortal = useCallback(() => {
    setPortalSkipped(true);
    setStatus("ready");
    onCanProceed(true);
  }, [onCanProceed]);

  const handleRetryPortal = useCallback(() => {
    if (portalAuth) {
      runPortalValidation(portalAuth);
    } else {
      setStatus("portal-login");
      onCanProceed(false);
    }
  }, [portalAuth, runPortalValidation, onCanProceed]);

  // ── Fix handler ───────────────────────────────────────────────────────────
  const handleFix = useCallback(
    (rowIndices: number[], field: string, newValue: string) => {
      const newFixes = [...fixes];
      for (const rowIndex of rowIndices) {
        const existingIdx = newFixes.findIndex((f) => f.rowIndex === rowIndex && f.field === field);
        if (existingIdx >= 0) {
          newFixes.splice(existingIdx, 1);
        }
        newFixes.push({ rowIndex, field, newValue });
      }
      onFixesChange(newFixes);
    },
    [fixes, onFixesChange],
  );

  // ── Re-validate handler ───────────────────────────────────────────────────
  const handleRevalidate = useCallback(() => {
    runPipeline(fixes);
  }, [fixes, runPipeline]);

  // ── Processing spinner ────────────────────────────────────────────────────
  if (status === "processing") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-treez-accent border-t-transparent" />
        <span className="text-sm text-gray-600">Running ETL pipeline...</span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      {/* Summary header */}
      <div>
        <h2 className="text-sm font-medium text-gray-900">Inventory Review</h2>
        {selectedStore && <p className="text-xs text-gray-500">Store: {selectedStore.name}</p>}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Output Rows</p>
          <p className="text-lg font-semibold text-gray-900">
            {summaryStats.totalRows.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Files Used</p>
          <p className="text-sm font-medium text-gray-900">
            {summaryStats.rolesUsed.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(" + ")}
          </p>
        </div>
        {hasReceipts && (
          <>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">Invoices Reconstructed</p>
              <p className="text-lg font-semibold text-gray-900">
                {summaryStats.invoiceCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">Distributors Enriched</p>
              <p className="text-lg font-semibold text-gray-900">
                {summaryStats.distributorEnriched.toLocaleString()}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Validation summary */}
      {validation && (
        <div
          className={`rounded-lg border p-3 ${
            validation.errorCount > 0
              ? "border-red-200 bg-red-50"
              : validation.warningCount > 0
                ? "border-amber-200 bg-amber-50"
                : "border-green-200 bg-green-50"
          }`}
        >
          <p className="text-sm">
            {validation.errorCount > 0 ? (
              <span className="text-red-600">
                {validation.errorCount} error{validation.errorCount !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-green-700">Local validation passed</span>
            )}
            {validation.warningCount > 0 && (
              <span className="text-amber-600">
                {" \u00b7 "}
                {validation.warningCount} warning{validation.warningCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Error groups */}
      {errorGroups.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-red-700">
            Errors ({errorGroups.reduce((sum, g) => sum + g.rows.length, 0)} rows)
          </h3>
          <ErrorGroupList groups={errorGroups as any} onFix={handleFix} />
        </div>
      )}

      {/* Warning groups */}
      {warningGroups.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-amber-700">
            Warnings ({warningGroups.reduce((sum, g) => sum + g.rows.length, 0)} rows)
          </h3>
          <ErrorGroupList groups={warningGroups as any} onFix={handleFix} />
        </div>
      )}

      {/* Re-validate button */}
      {status === "reviewing" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRevalidate}
            className="btn-treez -primary"
          >
            Re-validate
          </button>
        </div>
      )}

      {/* ── Portal Validation Section ──────────────────────────────────────── */}

      {/* Portal login form */}
      {status === "portal-login" && (
        <div className="space-y-2">
          <PortalLoginForm onAuthenticated={handlePortalAuthenticated} />
          <button
            type="button"
            onClick={handleSkipPortal}
            className="w-full text-center text-xs text-gray-500 underline hover:text-gray-700"
          >
            Skip Validation
          </button>
        </div>
      )}

      {/* Portal validating spinner */}
      {status === "portal-validating" && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-green-200 bg-green-50 py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <span className="text-sm text-green-700">Running validation (PMS + TraceTreez)...</span>
        </div>
      )}

      {/* Portal error (non-fatal) */}
      {portalError && (
        <div className="space-y-2">
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">{portalError}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRetryPortal}
              className="text-xs text-[#1a4007] underline hover:text-[#0f1709]"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={handleSkipPortal}
              className="text-xs text-gray-500 underline hover:text-gray-700"
            >
              Skip Validation
            </button>
          </div>
        </div>
      )}

      {/* Portal skipped warning */}
      {portalSkipped && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-700">
            Validation skipped. Server-side checks (PMS product resolution, TraceTreez lookup) will
            not be performed.
          </p>
        </div>
      )}

      {/* Portal validation results */}
      {status === "portal-done" && portalResult && (
        <div className="space-y-3">
          {/* Resolution stats */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="mb-1 text-xs font-medium text-green-800">Validation</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-green-700">
              <span>PMS Resolved: {portalResult.resolution.pms_resolved}</span>
              <span>PMS Unresolved: {portalResult.resolution.pms_unresolved}</span>
              <span>TraceTreez Resolved: {portalResult.resolution.tracetreez_resolved}</span>
              <span>TraceTreez Unresolved: {portalResult.resolution.tracetreez_unresolved}</span>
            </div>
          </div>

          {/* Portal errors */}
          {portalErrorGroups.errors.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-red-700">
                Errors ({portalErrorGroups.errors.reduce((sum, g) => sum + g.rows.length, 0)}{" "}
                issues)
              </h3>
              <ErrorGroupList groups={portalErrorGroups.errors as any} onFix={handleFix} />
            </div>
          )}

          {/* Portal warnings */}
          {portalErrorGroups.warnings.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-amber-700">
                Warnings ({portalErrorGroups.warnings.reduce((sum, g) => sum + g.rows.length, 0)}{" "}
                issues)
              </h3>
              <ErrorGroupList groups={portalErrorGroups.warnings as any} onFix={handleFix} />
            </div>
          )}

          {/* Portal passed */}
          {portalErrorGroups.errors.length === 0 && (
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2">
              <p className="text-sm text-green-700">Validation passed</p>
            </div>
          )}
        </div>
      )}

      {/* Authenticated indicator */}
      {portalAuth && status !== "portal-login" && (
        <p className="text-xs text-gray-400">{portalAuth.email}</p>
      )}
    </div>
  );
}
