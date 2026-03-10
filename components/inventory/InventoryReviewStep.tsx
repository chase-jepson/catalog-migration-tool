import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ParsedFile,
  FieldMapping,
  InventoryDerivedRow,
  RowFix,
  ValidationResult,
  StoreInfo,
} from '../../lib/types';
import { deriveInventoryRows, applyInventoryFixes } from '../../lib/inventory-transformer';
import { validateInventoryRows, groupInventoryErrors } from '../../lib/inventory-validator';
import { ErrorGroupList } from '../review/ErrorGroupList';

interface InventoryReviewStepProps {
  parsedFiles: ParsedFile[];
  mappings: FieldMapping[];
  onCanProceed: (can: boolean) => void;
  onDerivedRowsChange: (rows: InventoryDerivedRow[]) => void;
  onFixesChange: (fixes: RowFix[]) => void;
  onWarningCountChange?: (count: number) => void;
  fixes: RowFix[];
  selectedStore: StoreInfo | null;
}

type Status = 'processing' | 'ready' | 'reviewing';

export function InventoryReviewStep({
  parsedFiles,
  mappings,
  onCanProceed,
  onDerivedRowsChange,
  onFixesChange,
  onWarningCountChange,
  fixes,
  selectedStore,
}: InventoryReviewStepProps) {
  const [status, setStatus] = useState<Status>('processing');
  const [derivedRows, setDerivedRows] = useState<InventoryDerivedRow[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // For now, productLookup is empty -- all rows will be unmatched.
  // The product matching mechanism (fetching variant reference IDs from Treez) is an open question.
  const productLookup = useMemo(() => ({}), []);

  const groups = useMemo(() => {
    if (!validation) return [];
    return groupInventoryErrors(validation.errors);
  }, [validation]);

  const errorGroups = useMemo(() => groups.filter((g) => g.severity === 'error'), [groups]);
  const warningGroups = useMemo(() => groups.filter((g) => g.severity === 'warning'), [groups]);

  // ── Run transform + validate pipeline ──────────────────────────────────
  const runPipeline = useCallback(
    (currentFixes: RowFix[]) => {
      setStatus('processing');

      requestAnimationFrame(() => {
        const rows = deriveInventoryRows(parsedFiles, mappings, productLookup);
        const fixed =
          currentFixes.length > 0
            ? applyInventoryFixes(rows, currentFixes)
            : rows;

        const validationResult = validateInventoryRows(fixed);

        setDerivedRows(fixed);
        setValidation(validationResult);
        onDerivedRowsChange(fixed);

        const hasErrors = validationResult.errorCount > 0;
        onCanProceed(!hasErrors);
        onWarningCountChange?.(validationResult.warningCount);

        setStatus(hasErrors ? 'reviewing' : 'ready');
      });
    },
    [parsedFiles, mappings, productLookup, onCanProceed, onDerivedRowsChange, onWarningCountChange],
  );

  // ── Initial run on mount ───────────────────────────────────────────────
  useEffect(() => {
    runPipeline(fixes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fix handler ────────────────────────────────────────────────────────
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

  // ── Re-validate handler ────────────────────────────────────────────────
  const handleRevalidate = useCallback(() => {
    runPipeline(fixes);
  }, [fixes, runPipeline]);

  // ── Match summary ─────────────────────────────────────────────────────
  const matchSummary = useMemo(() => {
    const active = derivedRows.filter((r) => !r.excluded);
    const matched = active.filter((r) => r.matched).length;
    return { matched, total: active.length };
  }, [derivedRows]);

  // ── Processing spinner ─────────────────────────────────────────────────
  if (status === 'processing') {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
        <span className="text-sm text-gray-600">
          Transforming inventory data...
        </span>
      </div>
    );
  }

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
        {validation && (
          <p className="mt-1 text-sm text-gray-600">
            {validation.validCount.toLocaleString()} valid rows
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
        )}
      </div>

      {/* Match summary banner */}
      <div
        className={`rounded-lg border p-3 ${
          matchSummary.matched === 0
            ? 'border-amber-200 bg-amber-50'
            : matchSummary.matched === matchSummary.total
              ? 'border-green-200 bg-green-50'
              : 'border-blue-200 bg-blue-50'
        }`}
      >
        <p
          className={`text-sm font-medium ${
            matchSummary.matched === 0
              ? 'text-amber-800'
              : matchSummary.matched === matchSummary.total
                ? 'text-green-800'
                : 'text-blue-800'
          }`}
        >
          {matchSummary.matched} of {matchSummary.total} rows matched to Treez products
        </p>
        {matchSummary.matched === 0 && (
          <p className="mt-1 text-xs text-amber-600">
            No products could be matched. This is expected if the product lookup is not yet configured.
            Unmatched rows will be skipped during import.
          </p>
        )}
        {matchSummary.matched > 0 && matchSummary.matched < matchSummary.total && (
          <p className="mt-1 text-xs text-blue-600">
            Unmatched rows will be skipped during import. Only matched rows will be included.
          </p>
        )}
      </div>

      {/* All valid banner */}
      {status === 'ready' && validation && validation.errorCount === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">
            No blocking errors found
            {validation.warningCount > 0 && (
              <span className="text-amber-600">
                {' '}({validation.warningCount} warning{validation.warningCount !== 1 ? 's' : ''} -- non-blocking)
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
          <ErrorGroupList groups={errorGroups} onFix={handleFix} />
        </div>
      )}

      {/* Warning groups */}
      {warningGroups.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-amber-700">
            Warnings ({warningGroups.reduce((sum, g) => sum + g.rows.length, 0)} rows)
          </h3>
          <ErrorGroupList groups={warningGroups} onFix={handleFix} />
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
    </div>
  );
}
