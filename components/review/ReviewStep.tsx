import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ParsedFile,
  FieldMapping,
  DerivedRow,
  RowFix,
  ValidationResult,
  ErrorGroup,
} from '../../lib/types';
import { deriveRows, applyFixes } from '../../lib/transformer';
import { validateDerivedRows, groupErrors } from '../../lib/validator';
import { mergeFiles } from '../../lib/parser';
import { TransformPreview } from './TransformPreview';
import { ErrorGroupList } from './ErrorGroupList';

interface ReviewStepProps {
  parsedFiles: ParsedFile[];
  mappings: FieldMapping[];
  onCanProceed: (can: boolean) => void;
  onDerivedRowsChange: (rows: DerivedRow[]) => void;
  onFixesChange: (fixes: RowFix[]) => void;
  onWarningCountChange?: (count: number) => void;
  fixes: RowFix[];
}

type Status = 'processing' | 'ready' | 'reviewing';

/** Build a lookup: fieldKey -> sourceHeader */
function buildFieldMap(mappings: FieldMapping[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const m of mappings) {
    map[m.fieldKey] = m.sourceHeader;
  }
  return map;
}

export function ReviewStep({
  parsedFiles,
  mappings,
  onCanProceed,
  onDerivedRowsChange,
  onFixesChange,
  onWarningCountChange,
  fixes,
}: ReviewStepProps) {
  const [status, setStatus] = useState<Status>('processing');
  const [derivedRows, setDerivedRows] = useState<DerivedRow[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const mergedFile = useMemo(() => mergeFiles(parsedFiles), [parsedFiles]);
  const fieldMap = useMemo(() => buildFieldMap(mappings), [mappings]);

  const groups: ErrorGroup[] = useMemo(() => {
    if (!validation) return [];
    return groupErrors(validation.errors);
  }, [validation]);

  const errorGroups = useMemo(() => groups.filter((g) => g.severity === 'error'), [groups]);
  const warningGroups = useMemo(() => groups.filter((g) => g.severity === 'warning'), [groups]);

  // ── Run transform + validate pipeline ──────────────────────────────────
  const runPipeline = useCallback(
    (currentFixes: RowFix[]) => {
      setStatus('processing');

      // Use requestAnimationFrame to allow spinner to render
      requestAnimationFrame(() => {
        const result = deriveRows(mergedFile.rows, mappings);
        const fixed =
          currentFixes.length > 0
            ? applyFixes(result.derivedRows, currentFixes)
            : result.derivedRows;

        const validationResult = validateDerivedRows(fixed);

        setDerivedRows(fixed);
        setValidation(validationResult);
        onDerivedRowsChange(fixed);

        const hasErrors = validationResult.errorCount > 0;
        onCanProceed(!hasErrors);
        onWarningCountChange?.(validationResult.warningCount);

        setStatus(hasErrors ? 'reviewing' : 'ready');
      });
    },
    [mergedFile, mappings, onCanProceed, onDerivedRowsChange, onWarningCountChange],
  );

  // ── Initial run on mount ───────────────────────────────────────────────
  useEffect(() => {
    runPipeline(fixes);
    // Only run on mount -- fixes changes are handled by re-validate button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fix handler ────────────────────────────────────────────────────────
  const handleFix = useCallback(
    (rowIndices: number[], field: string, newValue: string) => {
      const newFixes = [...fixes];
      for (const rowIndex of rowIndices) {
        // Remove existing fix for this row+field
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

  // ── Processing spinner ─────────────────────────────────────────────────
  if (status === 'processing') {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
        <span className="text-sm text-gray-600">
          Transforming {mergedFile.rowCount.toLocaleString()} rows...
        </span>
      </div>
    );
  }

  // ── Ready / Reviewing ──────────────────────────────────────────────────
  return (
    <div className="flex w-full flex-col gap-4 p-4">
      {/* Summary header */}
      <div>
        <h2 className="text-base font-semibold text-gray-800">Review</h2>
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

      {/* All valid banner */}
      {status === 'ready' && validation && validation.errorCount === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">
            All {validation.validCount.toLocaleString()} rows are valid
            {validation.warningCount > 0 && (
              <span className="text-amber-600">
                {' '}({validation.warningCount} warning{validation.warningCount !== 1 ? 's' : ''} -- non-blocking)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Transform preview (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span className="text-xs text-gray-400">{showPreview ? '\u25BC' : '\u25B6'}</span>
          Transform Preview
        </button>
        {showPreview && (
          <div className="mt-2">
            <TransformPreview
              derivedRows={derivedRows}
              sourceRows={mergedFile.rows}
              fieldMap={fieldMap}
            />
          </div>
        )}
      </div>

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
