import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ParsedFile,
  FieldMapping,
  DerivedRow,
  RowFix,
  ValidationResult,
  RowValidationError,
} from '../../lib/types';
import { deriveRows, applyFixes } from '../../lib/transformer';
import { validateDerivedRows } from '../../lib/validator';
import { mergeFiles } from '../../lib/parser';
import { PRODUCT_SUBCATEGORIES } from '../../lib/constants';
import { getDefaultSubCategory } from '../../lib/category-mapper';

// ── Error grouping ────────────────────────────────────────────────────────

interface ErrorGroup {
  field: string;
  label: string;
  batches: ErrorBatch[];
}

interface ErrorBatch {
  currentValue: string;
  rowIndices: number[];
  errors: RowValidationError[];
}

const FIELD_LABELS: Record<string, string> = {
  category: 'Category',
  subCategory: 'Sub-Category',
  classification: 'Classification',
  status: 'Status',
  uom: 'UoM',
  merchSize: 'Merch Size',
  productName: 'Product Name',
  productId: 'Product ID',
  amount: 'Amount',
  basePrice: 'Price',
  description: 'Description',
  strain: 'Strain',
  thc: 'THC',
  cbd: 'CBD',
};

/** Fields that need per-row editing (values differ per product) */
const PER_ROW_FIELDS = new Set(['amount', 'productName', 'productId', 'basePrice', 'thc']);

function shortUom(uom: string | undefined): string {
  if (!uom) return '—';
  if (uom === 'milligrams') return 'mg';
  if (uom === 'grams') return 'g';
  return uom;
}

function groupErrors(errors: RowValidationError[]): ErrorGroup[] {
  const byField = new Map<string, RowValidationError[]>();
  for (const err of errors) {
    if (!byField.has(err.field)) byField.set(err.field, []);
    byField.get(err.field)!.push(err);
  }

  const groups: ErrorGroup[] = [];
  for (const [field, fieldErrors] of byField) {
    const byValue = new Map<string, RowValidationError[]>();
    for (const err of fieldErrors) {
      const key = err.currentValue || '(empty)';
      if (!byValue.has(key)) byValue.set(key, []);
      byValue.get(key)!.push(err);
    }

    const batches: ErrorBatch[] = [];
    for (const [currentValue, batchErrors] of byValue) {
      batches.push({
        currentValue,
        rowIndices: batchErrors.map((e) => e.rowIndex),
        errors: batchErrors,
      });
    }
    batches.sort((a, b) => b.rowIndices.length - a.rowIndices.length);

    groups.push({ field, label: FIELD_LABELS[field] ?? field, batches });
  }

  groups.sort((a, b) => {
    const aCount = a.batches.reduce((sum, bt) => sum + bt.rowIndices.length, 0);
    const bCount = b.batches.reduce((sum, bt) => sum + bt.rowIndices.length, 0);
    return bCount - aCount;
  });

  return groups;
}

// ── Component ─────────────────────────────────────────────────────────────

interface ReviewStepProps {
  parsedFiles: ParsedFile[];
  mappings: FieldMapping[];
  onCanProceed: (can: boolean) => void;
  onDerivedRowsChange: (rows: DerivedRow[]) => void;
  onFixesChange: (fixes: RowFix[]) => void;
  fixes: RowFix[];
}

export function ReviewStep({
  parsedFiles,
  mappings,
  onCanProceed,
  onDerivedRowsChange,
  onFixesChange,
  fixes: externalFixes,
}: ReviewStepProps) {
  const [status, setStatus] = useState<'processing' | 'ready' | 'reviewing'>('processing');
  const [derivedRows, setDerivedRows] = useState<DerivedRow[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  // Local fix state: Record<"rowIndex:field", value>
  const [fixes, setFixes] = useState<Record<string, string>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const mergedFile = useMemo(() => mergeFiles(parsedFiles), [parsedFiles]);

  const groups = useMemo(
    () => (validation ? groupErrors(validation.errors) : []),
    [validation],
  );

  const filteredGroups = activeFilter
    ? groups.filter((g) => g.field === activeFilter)
    : groups;

  const sortedPerRowIndices = (rowIndices: number[]): number[] =>
    [...rowIndices].sort((a, b) => {
      const ra = derivedRows[a];
      const rb = derivedRows[b];
      const cat = (ra?.category ?? '').localeCompare(rb?.category ?? '');
      if (cat !== 0) return cat;
      const brand = (ra?.brand ?? '').localeCompare(rb?.brand ?? '');
      if (brand !== 0) return brand;
      return (ra?.productName ?? '').localeCompare(rb?.productName ?? '');
    });

  const setFix = (rowIndices: number[], field: string, value: string) => {
    setFixes((prev) => {
      const next = { ...prev };
      for (const idx of rowIndices) {
        next[`${idx}:${field}`] = value;
        if (field === 'category') {
          next[`${idx}:subCategory`] = getDefaultSubCategory(value);
        }
      }
      return next;
    });
  };

  const getFix = (rowIndices: number[], field: string): string => {
    const first = fixes[`${rowIndices[0]}:${field}`];
    if (!first) return '';
    for (const idx of rowIndices) {
      if (fixes[`${idx}:${field}`] !== first) return '';
    }
    return first;
  };

  const toggleGroup = (field: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const fixedCount = useMemo(() => {
    if (!validation) return 0;
    const fixedRowFields = new Set<string>();
    for (const [key, value] of Object.entries(fixes)) {
      if (value) fixedRowFields.add(key);
    }
    let count = 0;
    for (const err of validation.errors) {
      if (fixedRowFields.has(`${err.rowIndex}:${err.field}`)) count++;
    }
    return count;
  }, [fixes, validation]);

  // ── Transform + validate pipeline ──────────────────────────────────────

  const runPipeline = useCallback(
    (rowFixes: RowFix[]) => {
      setStatus('processing');

      requestAnimationFrame(() => {
        const result = deriveRows(mergedFile.rows, mappings);
        const fixed =
          rowFixes.length > 0
            ? applyFixes(result.derivedRows, rowFixes)
            : result.derivedRows;

        const validationResult = validateDerivedRows(fixed);

        setDerivedRows(fixed);
        setValidation(validationResult);
        onDerivedRowsChange(fixed);

        const hasErrors = validationResult.errorCount > 0;
        onCanProceed(!hasErrors);

        setStatus(hasErrors ? 'reviewing' : 'ready');
      });
    },
    [mergedFile, mappings, onCanProceed, onDerivedRowsChange],
  );

  // Initial run on mount
  useEffect(() => {
    runPipeline(externalFixes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply Fixes handler ────────────────────────────────────────────────

  const handleApplyFixes = () => {
    if (!derivedRows.length) return;

    const rowFixes: RowFix[] = [];
    for (const [key, value] of Object.entries(fixes)) {
      if (!value) continue;
      const [rowIndexStr, field] = key.split(':');
      rowFixes.push({ rowIndex: parseInt(rowIndexStr, 10), field, newValue: value });
    }

    // Merge with existing external fixes
    const allFixes = [...externalFixes, ...rowFixes];
    onFixesChange(allFixes);
    setFixes({});
    runPipeline(allFixes);
  };

  // ── Skip Invalid handler ───────────────────────────────────────────────

  const handleSkipInvalid = () => {
    if (!derivedRows.length || !validation) return;

    const invalidIndices = new Set(validation.errors.map((e) => e.rowIndex));
    const updated = derivedRows.map((row, i) =>
      invalidIndices.has(i) ? { ...row, excluded: true } : row,
    );

    setDerivedRows(updated);
    onDerivedRowsChange(updated);
    setValidation(null);
    setFixes({});
    onCanProceed(true);
    setStatus('ready');
  };

  // ── Processing spinner ─────────────────────────────────────────────────

  if (status === 'processing') {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-treez-accent border-t-transparent" />
        <span className="text-sm text-gray-600">
          Transforming {mergedFile.rowCount.toLocaleString()} rows...
        </span>
      </div>
    );
  }

  const hasErrors = status === 'reviewing' && validation && validation.errors.length > 0;
  const skippedCount = validation ? new Set(validation.errors.map((e) => e.rowIndex)).size : 0;

  return (
    <div className="flex w-full flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-gray-800">Review</h2>
        {validation && hasErrors && (
          <>
            <p className="text-sm text-gray-700 mt-1">
              {skippedCount} product{skippedCount !== 1 ? 's' : ''} need corrections
            </p>
            <p className="text-xs text-gray-500">
              {validation.validCount.toLocaleString()} valid &middot; {fixedCount}/{validation.errors.length} issues fixed
            </p>
            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {groups.map((g) => {
                const count = g.batches.reduce((sum, b) => sum + b.rowIndices.length, 0);
                const isActive = activeFilter === g.field;
                return (
                  <button
                    key={g.field}
                    type="button"
                    onClick={() => setActiveFilter(isActive ? null : g.field)}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                      isActive
                        ? 'bg-treez-accent/30 border-treez-primary/30 text-treez-primary'
                        : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g.label} &times;{count}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {status === 'ready' && validation && validation.errors.length === 0 && (
          <div className="p-3 mt-2 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              All {validation.validCount.toLocaleString()} rows valid
            </p>
          </div>
        )}
        {status === 'ready' && !validation && (
          <div className="p-3 mt-2 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              {derivedRows.filter((r) => !r.excluded).length.toLocaleString()} rows ready
              {derivedRows.some((r) => r.excluded) && (
                <span className="text-gray-500">
                  {' '}&middot; {derivedRows.filter((r) => r.excluded).length} skipped
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-4 pb-2 space-y-3">
        {/* Error groups */}
        {hasErrors && (
          <div className="space-y-2">
            {filteredGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.field);
              const totalCount = group.batches.reduce((sum, b) => sum + b.rowIndices.length, 0);
              const isPerRow = PER_ROW_FIELDS.has(group.field);

              return (
                <div key={group.field} className="border border-gray-200 rounded-lg">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.field)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <span>{group.label} Issues ({totalCount})</span>
                    <span className="text-gray-400 text-xs">{isCollapsed ? '+' : '\u2212'}</span>
                  </button>

                  {!isCollapsed && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {group.batches.map((batch) => {
                        const fixValue = getFix(batch.rowIndices, group.field);
                        const sampleError = batch.errors[0];

                        let dropdownOptions = sampleError.dropdownOptions;
                        if (group.field === 'subCategory') {
                          const catFix = fixes[`${batch.rowIndices[0]}:category`];
                          if (catFix) {
                            dropdownOptions = PRODUCT_SUBCATEGORIES[catFix] ?? [];
                          }
                        }

                        return (
                          <div key={batch.currentValue} className="px-3 py-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">
                                <span className="font-medium text-red-600">"{batch.currentValue}"</span>
                                {' '}
                                <span className="text-gray-400">
                                  ({batch.rowIndices.length} row{batch.rowIndices.length !== 1 ? 's' : ''})
                                </span>
                              </span>
                            </div>

                            {isPerRow ? (
                              <div className="mt-1 border border-gray-200 rounded overflow-auto max-h-[60vh]">
                                <table className="w-full text-xs border-collapse">
                                  <thead className="sticky top-0 z-10">
                                    <tr className="bg-gray-50">
                                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-2 py-1 border-b border-gray-200 bg-gray-50">Category</th>
                                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-2 py-1 border-b border-gray-200 bg-gray-50">Brand</th>
                                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-2 py-1 border-b border-gray-200 bg-gray-50">Product</th>
                                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-2 py-1 border-b border-gray-200 bg-gray-50 w-[80px]">{group.label}</th>
                                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide px-2 py-1 border-b border-gray-200 bg-gray-50">UoM</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedPerRowIndices(batch.rowIndices).map((rowIdx, i) => {
                                      const row = derivedRows[rowIdx];
                                      const rowFix = fixes[`${rowIdx}:${group.field}`] ?? '';
                                      return (
                                        <tr key={rowIdx} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                          <td className="px-2 py-1 border-b border-gray-100 text-gray-600 whitespace-nowrap">
                                            {row?.category || '\u2014'}
                                          </td>
                                          <td className="px-2 py-1 border-b border-gray-100 text-gray-600 max-w-[100px]">
                                            <div className="relative group/brand">
                                              <span className="block truncate">{row?.brand || '\u2014'}</span>
                                              {row?.brand && (
                                                <div className="hidden group-hover/brand:block absolute left-0 bottom-full mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                                                  {row.brand}
                                                </div>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-2 py-1 border-b border-gray-100 text-gray-700 max-w-[180px]">
                                            <div className="relative group/product">
                                              <span className="block truncate">{row?.productName || '\u2014'}</span>
                                              {row?.productName && (
                                                <div className="hidden group-hover/product:block absolute left-0 bottom-full mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                                                  {row.productName}
                                                </div>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-1 py-1 border-b border-gray-100 w-[80px]">
                                            <input
                                              type="text"
                                              value={rowFix}
                                              onChange={(e) => setFix([rowIdx], group.field, e.target.value)}
                                              placeholder="..."
                                              className="w-full text-xs border border-gray-300 rounded px-1.5 py-0.5
                                                focus:outline-none focus:ring-1 focus:ring-treez-accent focus:border-treez-accent"
                                            />
                                          </td>
                                          <td className="px-2 py-1 border-b border-gray-100 text-gray-500 whitespace-nowrap">
                                            {shortUom(row?.uom)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-xs">&rarr;</span>
                                {sampleError.fixType === 'dropdown' && dropdownOptions ? (
                                  <select
                                    value={fixValue}
                                    onChange={(e) => setFix(batch.rowIndices, group.field, e.target.value)}
                                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1
                                      focus:outline-none focus:ring-1 focus:ring-treez-accent focus:border-treez-accent"
                                  >
                                    <option value="">Select...</option>
                                    {dropdownOptions.map((opt) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={fixValue}
                                    onChange={(e) => setFix(batch.rowIndices, group.field, e.target.value)}
                                    placeholder="Enter value..."
                                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1
                                      focus:outline-none focus:ring-1 focus:ring-treez-accent focus:border-treez-accent"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {hasErrors && (
        <div className="flex justify-end items-center gap-2 px-4 py-3 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSkipInvalid}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg
              hover:bg-gray-50 transition-colors"
          >
            Skip {skippedCount} Invalid
          </button>
          <button
            type="button"
            onClick={handleApplyFixes}
            disabled={fixedCount === 0}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              fixedCount > 0
                ? 'bg-treez-primary text-white hover:bg-treez-primary-light'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Apply Fixes{fixedCount > 0 ? ` (${fixedCount})` : ''}
          </button>
        </div>
      )}
    </div>
  );
}
