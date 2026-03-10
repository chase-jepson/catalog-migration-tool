import { useCallback, useEffect, useState } from 'react';
import {
  INVENTORY_ROLE_FIELDS,
  INVENTORY_FILE_ROLES,
} from '../../lib/inventory-constants';
import type { PerRoleMappings } from '../../lib/inventory-transformer';
import type {
  FieldMapping,
  InventoryFileAssignment,
  InventoryFileRole,
} from '../../lib/types';

interface InventoryMappingStepProps {
  fileAssignments: InventoryFileAssignment[];
  perRoleMappings: PerRoleMappings;
  onPerRoleMappingsChange: (mappings: PerRoleMappings) => void;
  selectedPOS: string;
  onCanProceed: (can: boolean) => void;
}

/**
 * Check if all required fields for each assigned role have mappings.
 */
function allRequiredMapped(
  assignments: InventoryFileAssignment[],
  perRoleMappings: PerRoleMappings,
): boolean {
  const assignedRoles = new Set(assignments.map((a) => a.role));

  for (const role of assignedRoles) {
    const fieldDefs = INVENTORY_ROLE_FIELDS[role] ?? [];
    const roleMappings = perRoleMappings[role] ?? [];
    const mappedKeys = new Set(
      roleMappings.filter((m) => m.sourceHeader !== null).map((m) => m.fieldKey),
    );

    for (const def of fieldDefs) {
      if (def.required && !mappedKeys.has(def.key)) {
        return false;
      }
    }
  }

  return true;
}

export function InventoryMappingStep({
  fileAssignments,
  perRoleMappings,
  onPerRoleMappingsChange,
  selectedPOS,
  onCanProceed,
}: InventoryMappingStepProps) {
  const [expandedRoles, setExpandedRoles] = useState<Set<InventoryFileRole>>(
    () => new Set(fileAssignments.map((a) => a.role)),
  );

  // Update canProceed whenever mappings or assignments change
  useEffect(() => {
    onCanProceed(allRequiredMapped(fileAssignments, perRoleMappings));
  }, [fileAssignments, perRoleMappings, onCanProceed]);

  const handleMappingChange = useCallback(
    (role: InventoryFileRole, fieldKey: string, sourceHeader: string | null) => {
      const updated = { ...perRoleMappings };
      updated[role] = (updated[role] ?? []).map((m) =>
        m.fieldKey === fieldKey ? { ...m, sourceHeader } : m,
      );
      onPerRoleMappingsChange(updated);
    },
    [perRoleMappings, onPerRoleMappingsChange],
  );

  const toggleRole = useCallback((role: InventoryFileRole) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }, []);

  // Only show roles that have assigned files
  const assignedRoles = fileAssignments.map((a) => a.role);
  const uniqueRoles = Array.from(new Set(assignedRoles));

  return (
    <div className="flex w-full flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-medium text-gray-900">Map Columns</h2>
        <p className="mt-1 text-xs text-gray-500">
          Map columns from each uploaded file to the expected fields.
          {selectedPOS && (
            <span className="text-teal-600"> POS defaults applied for {selectedPOS}.</span>
          )}
        </p>
      </div>

      {uniqueRoles.map((role) => {
        const assignment = fileAssignments.find((a) => a.role === role);
        if (!assignment) return null;

        const roleDef = INVENTORY_FILE_ROLES.find((r) => r.role === role);
        const fieldDefs = INVENTORY_ROLE_FIELDS[role] ?? [];
        const roleMappings = perRoleMappings[role] ?? [];
        const isExpanded = expandedRoles.has(role);
        const headers = assignment.file.headers;

        // Count mapped vs total required
        const requiredFields = fieldDefs.filter((f) => f.required);
        const mappedRequired = requiredFields.filter((f) =>
          roleMappings.some((m) => m.fieldKey === f.key && m.sourceHeader !== null),
        ).length;

        return (
          <div
            key={role}
            className="rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => toggleRole(role)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {roleDef?.label ?? role}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {assignment.file.fileName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${
                  mappedRequired === requiredFields.length
                    ? 'text-green-600'
                    : 'text-amber-600'
                }`}>
                  {mappedRequired}/{requiredFields.length} required
                </span>
                <svg
                  className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Field mappings */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                {fieldDefs.map((def) => {
                  const mapping = roleMappings.find((m) => m.fieldKey === def.key);
                  const currentValue = mapping?.sourceHeader ?? '';

                  return (
                    <div key={def.key}>
                      <label className="mb-1 flex items-baseline gap-1 text-xs font-medium text-gray-700">
                        <span>{def.label}</span>
                        {def.required && (
                          <span className="text-red-500">(required)</span>
                        )}
                      </label>
                      <select
                        value={currentValue}
                        onChange={(e) =>
                          handleMappingChange(
                            role,
                            def.key,
                            e.target.value === '' ? null : e.target.value,
                          )
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="">-- Not mapped --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      {def.description && (
                        <p className="mt-0.5 text-xs text-gray-400">{def.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {uniqueRoles.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-700">
            No files have been assigned roles. Go back to the Upload step and assign at least an Inventory file.
          </p>
        </div>
      )}
    </div>
  );
}
