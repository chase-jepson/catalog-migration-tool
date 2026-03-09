interface MappingRowProps {
  fieldKey: string;
  label: string;
  description: string;
  required: boolean;
  sourceHeader: string | null;
  sourceColumns: string[];
  sampleValue: string;
  onMappingChange: (fieldKey: string, sourceHeader: string | null) => void;
  highlighted?: boolean;
}

export function MappingRow({
  fieldKey,
  label,
  description,
  required,
  sourceHeader,
  sourceColumns,
  sampleValue,
  onMappingChange,
  highlighted,
}: MappingRowProps) {
  const unmapped = required && !sourceHeader;

  return (
    <div
      id={`mapping-row-${fieldKey}`}
      className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 transition-colors duration-300 ${
        highlighted ? 'bg-teal-50 border-teal-300' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Target field */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          {required && (
            <span className="text-[10px] font-semibold uppercase text-red-500">
              req
            </span>
          )}
        </div>
        <p className="truncate text-xs text-gray-400">{description}</p>
      </div>

      {/* Source column dropdown + sample */}
      <div className="flex flex-col items-end gap-1">
        <select
          value={sourceHeader ?? ''}
          onChange={(e) =>
            onMappingChange(fieldKey, e.target.value || null)
          }
          className={`w-44 rounded border px-2 py-1 text-sm ${
            unmapped
              ? 'ring-2 ring-red-400 border-red-300'
              : 'border-gray-300'
          }`}
        >
          <option value="">-- Select column --</option>
          {sourceColumns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
        {sourceHeader && sampleValue && (
          <span className="max-w-[11rem] truncate text-xs text-gray-400">
            e.g. {sampleValue}
          </span>
        )}
      </div>
    </div>
  );
}
