import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  InventoryDerivedRow,
  InventoryFileAssignment,
  RowFix,
  ValidationResult,
  StoreInfo,
} from '../../lib/types';
import type { PerRoleMappings, ETLInput } from '../../lib/inventory-transformer';
import { runInventoryETL } from '../../lib/inventory-transformer';
import { validateInventoryRows, groupInventoryErrors } from '../../lib/inventory-validator';
import { ErrorGroupList } from '../review/ErrorGroupList';

interface InventoryReviewStepProps {
  fileAssignments: InventoryFileAssignment[];
  perRoleMappings: PerRoleMappings;
  dispensaryLicense: string;
  onCanProceed: (can: boolean) => void;
  onDerivedRowsChange: (rows: InventoryDerivedRow[]) => void;
  onWarningCountChange?: (count: number) => void;
  fixes: RowFix[];
  onFixesChange: (fixes: RowFix[]) => void;
  selectedStore: StoreInfo | null;
}

type Status = 'processing' | 'ready' | 'reviewing';

/**
 * Build ETLInput from file assignments.
 */
function buildETLInput(assignments: InventoryFileAssignment[]): ETLInput | null {
  const inventoryAssign = assignments.find((a) => a.role === 'inventory');
  if (!inventoryAssign) return null;

  return {
    inventoryFile: inventoryAssign.file,
    receiptsFile: assignments.find((a) => a.role === 'receipts')?.file,
    vendorsFile: assignments.find((a) => a.role === 'vendors')?.file,
    adjustmentsFile: assignments.find((a) => a.role === 'adjustments')?.file,
    catalogFile: assignments.find((a) => a.role === 'catalog_export')?.file,
  };
}

/**
 * Apply row-level fixes to derived rows.
 */
function applyFixes(
  rows: InventoryDerivedRow[],
  fixes: RowFix[],
): InventoryDerivedRow[] {
  if (fixes.length === 0) return rows;
  const fixMap = new Map<string, string>();
  for (const fix of fixes) {
    fixMap.set(`${fix.rowIndex}|${fix.field}`, fix.newValue);
  }
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

const PREVIEW_COLUMNS: { key: keyof InventoryDerivedRow; label: string }[] = [
  { key: 'variantReferenceId', label: 'VariantRefId' },
  { key: 'invoiceId', label: 'InvoiceId' },
  { key: 'units', label: 'Units' },
  { key: 'unitCost', label: 'UnitCost' },
  { key: 'locationPath', label: 'LocationPath' },
  { key: 'distributorName', label: 'Distributor' },
];

export function InventoryReviewStep({
  fileAssignments,
  perRoleMappings,
  dispensaryLicense,
  onCanProceed,
  onDerivedRowsChange,
  onWarningCountChange,
  fixes,
  onFixesChange,
  selectedStore,
}: InventoryReviewStepProps) {
  const [status, setStatus] = useState<Status>('processing');
  const [derivedRows, setDerivedRows] = useState<InventoryDerivedRow[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const hasReceipts = useMemo(
    () => fileAssignments.some((a) => a.role === 'receipts'),
    [fileAssignments],
  );

  const groups = useMemo(() => {
    if (!validation) return [];
    return groupInventoryErrors(validation.errors);
  }, [validation]);

  const errorGroups = useMemo(() => groups.filter((g) => g.severity === 'error'), [groups]);
  const warningGroups = useMemo(() => groups.filter((g) => g.severity === 'warning'), [groups]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const active = derivedRows.filter((r) => !r.excluded);
    const rolesUsed = Array.from(new Set(fileAssignments.map((a) => a.role)));
    const uniqueInvoices = new Set(active.map((r) => r.invoiceId).filter(Boolean));
    const enrichedDistributors = active.filter((r) => r.distributorName !== '').length;

    return {
      totalRows: active.length,
      rolesUsed,
      invoiceCount: uniqueInvoices.size,
      distributorEnriched: enrichedDistributors,
    };
  }, [derivedRows, fileAssignments]);

  // ── Run ETL + validate pipeline ───────────────────────────────────────────
  const runPipeline = useCallback(
    (currentFixes: RowFix[]) => {
      setStatus('processing');

      requestAnimationFrame(() => {
        const etlInput = buildETLInput(fileAssignments);
        if (!etlInput) {
          setStatus('ready');
          onCanProceed(false);
          return;
        }

        const rows = runInventoryETL(etlInput, perRoleMappings, dispensaryLicense);
        const fixed = currentFixes.length > 0 ? applyFixes(rows, currentFixes) : rows;
        const validationResult = validateInventoryRows(fixed, { hasReceipts });

        setDerivedRows(fixed);
        setValidation(validationResult);
        onDerivedRowsChange(fixed);

        const hasErrors = validationResult.errorCount > 0;
        onCanProceed(!hasErrors);
        onWarningCountChange?.(validationResult.warningCount);

        setStatus(hasErrors ? 'reviewing' : 'ready');
      });
    },
    [fileAssignments, perRoleMappings, dispensaryLicense, hasReceipts, onCanProceed, onDerivedRowsChange, onWarningCountChange],
  );

  // ── Initial run on mount ──────────────────────────────────────────────────
  useEffect(() => {
    runPipeline(fixes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fix handler ───────────────────────────────────────────────────────────
  const handleFix = useCallback(
    (rowIndices: number[], field: string, newValue: string) => {
      const newFixes = [...fixes];
      for (const rowIndex of rowIndices) {
        const existingIdx = newFixes.findIndex(
          (f) => f.rowIndex === rowIndex && f.field === field,
        );
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
  if (status === 'processing') {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
        <span className="text-sm text-gray-600">
          Running ETL pipeline...
        </span>
      </div>
    );
  }

  // Preview rows (first 10)
  const previewRows = derivedRows.filter((r) => !r.excluded).slice(0, 10);

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      {/* Summary header */}
      <div>
        <h2 className="text-base font-semibold text-gray-800">Inventory Review</h2>
        {selectedStore && (
          <p className="text-xs text-gray-500">
            Store: {selectedStore.name}
          </p>
        )}
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
            {summaryStats.rolesUsed
              .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
              .join(' + ')}
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
        <div className={`rounded-lg border p-3 ${
          validation.errorCount > 0
            ? 'border-red-200 bg-red-50'
            : validation.warningCount > 0
              ? 'border-amber-200 bg-amber-50'
              : 'border-green-200 bg-green-50'
        }`}>
          <p className="text-sm">
            <span className={validation.errorCount > 0 ? 'text-red-700' : 'text-green-700'}>
              {validation.validCount.toLocaleString()} valid
            </span>
            {validation.errorCount > 0 && (
              <span className="text-red-600">
                {' \u00b7 '}{validation.errorCount} error{validation.errorCount !== 1 ? 's' : ''}
              </span>
            )}
            {validation.warningCount > 0 && (
              <span className="text-amber-600">
                {' \u00b7 '}{validation.warningCount} warning{validation.warningCount !== 1 ? 's' : ''}
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
      {status === 'reviewing' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRevalidate}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Re-validate
          </button>
        </div>
      )}

      {/* Data preview */}
      {previewRows.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Data Preview (first {previewRows.length} rows)
          </h3>
          <div className="overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {PREVIEW_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-600"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {PREVIEW_COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className="max-w-[120px] truncate whitespace-nowrap px-3 py-1.5 text-gray-700"
                        title={String(row[col.key] ?? '')}
                      >
                        {String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
