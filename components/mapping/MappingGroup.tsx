import { useState } from "react";
import { MappingRow } from "./MappingRow";
import { getSampleValue } from "../../lib/mapping-engine";
import { MAPPING_FIELDS } from "../../lib/constants";
import type { FieldMapping, MappingGroup as MappingGroupType } from "../../lib/types";

interface MappingGroupProps {
  groupName: MappingGroupType;
  mappings: FieldMapping[];
  sourceColumns: string[];
  rows: Record<string, string>[];
  onMappingChange: (fieldKey: string, sourceHeader: string | null) => void;
  highlightedField?: string;
}

export function MappingGroup({
  groupName,
  mappings,
  sourceColumns,
  rows,
  onMappingChange,
  highlightedField,
}: MappingGroupProps) {
  const fieldDefs = new Map(MAPPING_FIELDS.map((f) => [f.key, f]));

  const requiredKeys = new Set(
    mappings.filter((m) => fieldDefs.get(m.fieldKey)?.required).map((m) => m.fieldKey),
  );

  const unmappedRequired = mappings.filter((m) => requiredKeys.has(m.fieldKey) && !m.sourceHeader);

  const hasUnmapped = unmappedRequired.length > 0;
  const [open, setOpen] = useState(hasUnmapped);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-gray-700">{groupName}</span>
        </div>

        {hasUnmapped ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            {unmappedRequired.length} unmapped
          </span>
        ) : (
          <svg
            className="h-4 w-4 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Rows */}
      {open && (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {mappings.map((m) => {
            const def = fieldDefs.get(m.fieldKey);
            return (
              <MappingRow
                key={m.fieldKey}
                fieldKey={m.fieldKey}
                label={m.label}
                description={def?.description ?? ""}
                required={!!def?.required}
                sourceHeader={m.sourceHeader}
                sourceColumns={sourceColumns}
                sampleValue={m.sourceHeader ? getSampleValue(rows, m.sourceHeader) : ""}
                onMappingChange={onMappingChange}
                highlighted={highlightedField === m.fieldKey}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
