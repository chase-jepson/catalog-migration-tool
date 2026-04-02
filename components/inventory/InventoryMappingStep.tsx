import { useCallback, useEffect, useState } from "react";
import { INVENTORY_ROLE_FIELDS } from "../../lib/inventory-constants";
import type { PerRoleMappings } from "../../lib/inventory-transformer";
import type { InventoryFileAssignment, InventoryFileRole } from "../../lib/types";

interface InventoryMappingStepProps {
  fileAssignments: InventoryFileAssignment[];
  perRoleMappings: PerRoleMappings;
  onPerRoleMappingsChange: (mappings: PerRoleMappings) => void;
  selectedPOS: string;
  onCanProceed: (can: boolean) => void;
}

/** Section definitions — drive the UI ordering and labels */
const SECTIONS: {
  role: InventoryFileRole;
  title: string;
  description: string;
}[] = [
  {
    role: "inventory",
    title: "Inventory Information",
    description: "Core inventory data — SKU, quantities, location, potency, and dates.",
  },
  {
    role: "receipts",
    title: "Invoice Information",
    description: "Receipt history — used to reconstruct invoices and compute unit costs.",
  },
  {
    role: "vendors",
    title: "Distributor Information",
    description:
      "Vendor details and licenses. Duplicate vendors are auto-merged and license codes split into up to 3 slots.",
  },
  {
    role: "adjustments",
    title: "Adjustment Information",
    description:
      "Quantity and cost adjustments by package — combined with receipts for package totals.",
  },
  {
    role: "catalog_export",
    title: "Catalog Information",
    description: "Post-migration Treez catalog — used to detect Merch category for TraceTreezId.",
  },
];

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
  const [expandedSections, setExpandedSections] = useState<Set<InventoryFileRole>>(
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

  const toggleSection = useCallback((role: InventoryFileRole) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }, []);

  // Build a set of assigned roles for quick lookup
  const assignedRoleSet = new Set(fileAssignments.map((a) => a.role));

  // Only show sections that have assigned files
  const activeSections = SECTIONS.filter((s) => assignedRoleSet.has(s.role));

  return (
    <div className="flex w-full flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-medium text-gray-900">Map Columns</h2>
        <p className="mt-1 text-xs text-gray-500">
          Map your source columns to the fields used in the import CSV.
          {selectedPOS && (
            <span className="text-treez-primary"> POS defaults applied for {selectedPOS}.</span>
          )}
        </p>
      </div>

      {activeSections.map((section) => {
        const { role, title, description } = section;
        const assignment = fileAssignments.find((a) => a.role === role);
        if (!assignment) return null;

        const fieldDefs = INVENTORY_ROLE_FIELDS[role] ?? [];
        const roleMappings = perRoleMappings[role] ?? [];
        const isExpanded = expandedSections.has(role);
        const headers = assignment.file.headers;

        // Count mapped vs total required
        const requiredFields = fieldDefs.filter((f) => f.required);
        const mappedRequired = requiredFields.filter((f) =>
          roleMappings.some((m) => m.fieldKey === f.key && m.sourceHeader !== null),
        ).length;

        return (
          <div key={role} className="rounded-lg border border-gray-200 bg-white shadow-sm">
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleSection(role)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{title}</p>
                <p className="mt-0.5 text-xs text-gray-400">Source: {assignment.file.fileName}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs ${
                    mappedRequired === requiredFields.length
                      ? "text-treez-primary"
                      : "text-amber-600"
                  }`}
                >
                  {mappedRequired}/{requiredFields.length} required
                </span>
                <svg
                  className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Field mappings */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                {/* Section description */}
                <p className="text-xs text-gray-500">{description}</p>

                {fieldDefs.map((def) => {
                  const mapping = roleMappings.find((m) => m.fieldKey === def.key);
                  const currentValue = mapping?.sourceHeader ?? "";

                  return (
                    <div key={def.key}>
                      <label className="mb-1 flex items-baseline gap-1 text-xs font-medium text-gray-700">
                        <span>{def.label}</span>
                        {def.required && <span className="text-red-500">*</span>}
                      </label>
                      <select
                        value={currentValue}
                        onChange={(e) =>
                          handleMappingChange(
                            role,
                            def.key,
                            e.target.value === "" ? null : e.target.value,
                          )
                        }
                        className="treez-select"
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

      {activeSections.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-700">
            No files have been assigned roles. Go back to the Upload step and assign at least an
            Inventory file.
          </p>
        </div>
      )}
    </div>
  );
}
