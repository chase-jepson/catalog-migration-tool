import { useCallback, useState } from 'react';
import type { StoreInfo } from '../../lib/types';

interface StoreSelectorProps {
  selectedStore: StoreInfo | null;
  onStoreChange: (store: StoreInfo | null) => void;
  stores: StoreInfo[];
  loading: boolean;
  error: string | null;
}

/**
 * Persistent banner rendered above the wizard steps for inventory mode.
 * Provides a store dropdown and shows info about catalog prerequisite.
 */
export function StoreSelector({
  selectedStore,
  onStoreChange,
  stores,
  loading,
  error,
}: StoreSelectorProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStore, setPendingStore] = useState<StoreInfo | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const entityId = e.target.value;
      if (!entityId) {
        onStoreChange(null);
        return;
      }

      const store = stores.find((s) => s.entityId === entityId) ?? null;

      // If a store was already selected and we're changing, show confirmation
      if (selectedStore && store && selectedStore.entityId !== entityId) {
        setPendingStore(store);
        setShowConfirm(true);
        return;
      }

      onStoreChange(store);
    },
    [stores, selectedStore, onStoreChange],
  );

  const handleConfirmChange = useCallback(() => {
    onStoreChange(pendingStore);
    setShowConfirm(false);
    setPendingStore(null);
  }, [pendingStore, onStoreChange]);

  const handleCancelChange = useCallback(() => {
    setShowConfirm(false);
    setPendingStore(null);
  }, []);

  return (
    <div className="border-b border-teal-200 bg-teal-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <label
          htmlFor="store-select"
          className="text-sm font-medium text-teal-800 whitespace-nowrap"
        >
          Store:
        </label>

        {loading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <span className="text-sm text-teal-700">Loading stores...</span>
          </div>
        ) : error ? (
          <span className="text-sm text-red-600">{error}</span>
        ) : (
          <select
            id="store-select"
            value={selectedStore?.entityId ?? ''}
            onChange={handleChange}
            className="flex-1 rounded-md border border-teal-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">Select a store...</option>
            {stores.map((store) => (
              <option key={store.entityId} value={store.entityId}>
                {store.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Confirmation dialog for store change */}
      {showConfirm && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2">
          <p className="text-sm text-amber-800">
            Changing stores will reset your current progress. Continue?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleCancelChange}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmChange}
              className="rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700"
            >
              Change Store
            </button>
          </div>
        </div>
      )}

      {/* Info text about catalog prerequisite */}
      <p className="mt-1.5 text-xs text-teal-600">
        Inventory import requires catalog migration to be completed first.
        Products must exist in Treez with reference IDs.
      </p>
    </div>
  );
}
