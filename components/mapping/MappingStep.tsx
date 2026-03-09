import { useCallback, useEffect, useRef, useState } from 'react';
import { MappingGroup } from './MappingGroup';
import { MappingToolbar } from './MappingToolbar';
import { DataPreview } from './DataPreview';
import { MAPPING_GROUPS } from '../../lib/constants';
import {
  applyPOSDefaults,
  clearAllMappings,
  getMappingsByGroup,
  getUnmappedRequired,
  updateMapping,
} from '../../lib/mapping-engine';
import type { FieldMapping, ParsedFile } from '../../lib/types';

interface MappingStepProps {
  mappings: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
  mergedFile: ParsedFile;
  selectedPOS: string;
  onCanProceed: (canProceed: boolean) => void;
}

export function MappingStep({
  mappings,
  onMappingsChange,
  mergedFile,
  selectedPOS,
  onCanProceed,
}: MappingStepProps) {
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update canProceed whenever mappings change
  useEffect(() => {
    onCanProceed(getUnmappedRequired(mappings).length === 0);
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
    onMappingsChange(applyPOSDefaults(selectedPOS));
  }, [selectedPOS, onMappingsChange]);

  const handleColumnClick = useCallback(
    (header: string) => {
      // Find which field maps to this header
      const mapping = mappings.find((m) => m.sourceHeader === header);
      if (!mapping) return;

      setHighlightedField(mapping.fieldKey);
      document
        .getElementById(`mapping-row-${mapping.fieldKey}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Clear highlight after 2 seconds
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

  const grouped = getMappingsByGroup(mappings);

  return (
    <div className="flex w-full flex-col gap-3 p-4">
      {/* Toolbar */}
      <MappingToolbar
        onClearAll={handleClearAll}
        onResetToAuto={handleResetToAuto}
        posName={selectedPOS}
      />

      {/* Mapping groups */}
      {MAPPING_GROUPS.map((groupName) => (
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
