import { useCallback, useEffect, useRef, useState } from 'react';
import { MappingGroup } from '../mapping/MappingGroup';
import { MappingToolbar } from '../mapping/MappingToolbar';
import { DataPreview } from '../mapping/DataPreview';
import {
  INVENTORY_MAPPING_FIELDS,
  INVENTORY_MAPPING_GROUPS,
  INVENTORY_POS_DEFAULTS,
} from '../../lib/inventory-constants';
import {
  clearAllMappings,
  updateMapping,
} from '../../lib/mapping-engine';
import type { FieldMapping, ParsedFile, MappingGroup as MappingGroupType } from '../../lib/types';

interface InventoryMappingStepProps {
  mappings: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
  mergedFile: ParsedFile;
  selectedPOS: string;
  onCanProceed: (canProceed: boolean) => void;
}

/**
 * Apply inventory-specific POS defaults.
 * Creates field mappings pre-populated with POS-specific default source headers.
 */
function applyInventoryPOSDefaults(posName: string): FieldMapping[] {
  const defaults = INVENTORY_POS_DEFAULTS[posName];

  return INVENTORY_MAPPING_FIELDS.map((field) => ({
    fieldKey: field.key,
    label: field.label,
    sourceHeader: defaults?.[field.key] ?? null,
  }));
}

/**
 * Get field keys of required inventory fields that are not yet mapped.
 */
function getUnmappedRequiredInventory(mappings: FieldMapping[]): string[] {
  const requiredKeys = new Set(
    INVENTORY_MAPPING_FIELDS.filter((f) => f.required).map((f) => f.key),
  );

  return mappings
    .filter((m) => requiredKeys.has(m.fieldKey) && m.sourceHeader === null)
    .map((m) => m.fieldKey);
}

/**
 * Group inventory mappings by their MappingGroup.
 */
function getInventoryMappingsByGroup(
  mappings: FieldMapping[],
): Record<MappingGroupType, FieldMapping[]> {
  const fieldDefs = new Map(INVENTORY_MAPPING_FIELDS.map((f) => [f.key, f]));

  // Initialize all groups (including catalog groups for type safety)
  const result: Record<MappingGroupType, FieldMapping[]> = {
    'Product Info': [],
    'Cannabis Details': [],
    'Pricing': [],
    'Attributes': [],
    'Display & Media': [],
    'Product Matching': [],
    'Inventory Data': [],
    'Location': [],
  };

  for (const mapping of mappings) {
    const def = fieldDefs.get(mapping.fieldKey);
    if (!def || def.hidden) continue;
    result[def.group].push(mapping);
  }

  return result;
}

export function InventoryMappingStep({
  mappings,
  onMappingsChange,
  mergedFile,
  selectedPOS,
  onCanProceed,
}: InventoryMappingStepProps) {
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update canProceed whenever mappings change
  useEffect(() => {
    onCanProceed(getUnmappedRequiredInventory(mappings).length === 0);
  }, [mappings, onCanProceed]);

  const handleMappingChange = useCallback(
    (fieldKey: string, sourceHeader: string | null) => {
      onMappingsChange(updateMapping(mappings, fieldKey, sourceHeader));
    },
    [mappings, onMappingsChange],
  );

  const handleClearAll = useCallback(() => {
    onMappingsChange(clearAllMappings(mappings));
  }, [mappings, onMappingsChange]);

  const handleResetToAuto = useCallback(() => {
    onMappingsChange(applyInventoryPOSDefaults(selectedPOS));
  }, [selectedPOS, onMappingsChange]);

  const handleColumnClick = useCallback(
    (header: string) => {
      const mapping = mappings.find((m) => m.sourceHeader === header);
      if (!mapping) return;

      setHighlightedField(mapping.fieldKey);
      document
        .getElementById(`mapping-row-${mapping.fieldKey}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedField(null);
      }, 2000);
    },
    [mappings],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const grouped = getInventoryMappingsByGroup(mappings);

  return (
    <div className="flex w-full flex-col gap-3 p-4">
      {/* Toolbar */}
      <MappingToolbar
        onClearAll={handleClearAll}
        onResetToAuto={handleResetToAuto}
        posName={selectedPOS}
      />

      {/* Mapping groups -- only render inventory groups */}
      {INVENTORY_MAPPING_GROUPS.map((groupName) => (
        <MappingGroup
          key={groupName}
          groupName={groupName}
          mappings={grouped[groupName]}
          sourceColumns={mergedFile.headers}
          rows={mergedFile.previewRows}
          onMappingChange={handleMappingChange}
          highlightedField={highlightedField ?? undefined}
        />
      ))}

      {/* Data preview */}
      <DataPreview
        mergedFile={mergedFile}
        mappings={mappings}
        onColumnClick={handleColumnClick}
      />
    </div>
  );
}
