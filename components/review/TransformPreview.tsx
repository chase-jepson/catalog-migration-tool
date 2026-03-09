import { useState } from 'react';
import type { DerivedRow } from '../../lib/types';

interface TransformPreviewProps {
  derivedRows: DerivedRow[];
  sourceRows: Record<string, string>[];
  fieldMap: Record<string, string | null>;
}

/** Fields to show in the before/after preview */
const PREVIEW_FIELDS: { key: keyof DerivedRow; label: string; sourceKey: string }[] = [
  { key: 'category', label: 'Category', sourceKey: 'productCategory' },
  { key: 'subCategory', label: 'Sub-Category', sourceKey: 'productSubCategory' },
  { key: 'classification', label: 'Classification', sourceKey: 'classification' },
  { key: 'uom', label: 'UoM', sourceKey: 'weight' },
  { key: 'amount', label: 'Amount', sourceKey: 'weight' },
];

const INITIAL_ROWS = 20;

export function TransformPreview({ derivedRows, sourceRows, fieldMap }: TransformPreviewProps) {
  const [showAll, setShowAll] = useState(false);

  const nonExcluded = derivedRows
    .map((row, i) => ({ row, index: i }))
    .filter(({ row }) => !row.excluded);

  const displayRows = showAll ? nonExcluded : nonExcluded.slice(0, INITIAL_ROWS);
  const hasMore = nonExcluded.length > INITIAL_ROWS;

  function getSourceValue(rowIndex: number, sourceKey: string): string {
    const col = fieldMap[sourceKey];
    if (!col || !sourceRows[rowIndex]) return '';
    return sourceRows[rowIndex][col] ?? '';
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-gray-400 border-b border-gray-200">
                Product
              </th>
              {PREVIEW_FIELDS.map((f) => (
                <th
                  key={f.key}
                  className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-gray-400 border-b border-gray-200"
                >
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ row, index }, i) => (
              <tr key={index} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-2 py-1 border-b border-gray-100 text-gray-700 max-w-[120px]">
                  <span className="block truncate">{row.productName || '--'}</span>
                </td>
                {PREVIEW_FIELDS.map((f) => {
                  const original = getSourceValue(index, f.sourceKey);
                  const derived = String(row[f.key] ?? '');
                  const changed = original !== derived && original !== '';
                  return (
                    <td key={f.key} className="px-2 py-1 border-b border-gray-100">
                      {changed ? (
                        <div className="space-y-0.5">
                          <div className="text-gray-400 line-through">{original || '--'}</div>
                          <div className="text-teal-700 font-medium">{derived || '--'}</div>
                        </div>
                      ) : (
                        <span className="text-gray-600">{derived || '--'}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full border-t border-gray-200 py-1.5 text-xs text-teal-600 hover:bg-gray-50"
        >
          Show all {nonExcluded.length} rows
        </button>
      )}

      {showAll && hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full border-t border-gray-200 py-1.5 text-xs text-teal-600 hover:bg-gray-50"
        >
          Show first {INITIAL_ROWS} rows
        </button>
      )}
    </div>
  );
}
