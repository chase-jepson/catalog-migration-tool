interface MappingToolbarProps {
  onClearAll: () => void;
  onResetToAuto: () => void;
  posName: string;
}

export function MappingToolbar({
  onClearAll,
  onResetToAuto,
  posName,
}: MappingToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClearAll}
        className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        Clear all
      </button>
      <button
        type="button"
        onClick={onResetToAuto}
        className="rounded border border-treez-accent bg-white px-3 py-1 text-xs font-medium text-treez-primary hover:bg-treez-accent-muted"
      >
        Apply {posName || 'auto'} defaults
      </button>
    </div>
  );
}
