import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoreInfo } from '../../lib/types';

interface StoreSelectorProps {
  selectedStore: StoreInfo | null;
  onStoreChange: (store: StoreInfo | null) => void;
  stores: StoreInfo[];
  loading: boolean;
  error: string | null;
}

export function StoreSelector({
  selectedStore,
  onStoreChange,
  stores,
  loading,
  error,
}: StoreSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStore, setPendingStore] = useState<StoreInfo | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filteredStores = stores.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = useCallback(
    (store: StoreInfo) => {
      if (selectedStore && selectedStore.entityId !== store.entityId) {
        setPendingStore(store);
        setShowConfirm(true);
        setOpen(false);
        setSearch('');
        return;
      }
      onStoreChange(store);
      setOpen(false);
      setSearch('');
    },
    [selectedStore, onStoreChange],
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
    <div className="border-b border-gray-200 bg-white px-4 py-2">
      {/* Store selector button */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => !loading && setOpen(!open)}
          disabled={loading}
          className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-gray-50 transition-colors"
        >
          {/* Storefront icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M3.3 7.4l1.2-3.6c.2-.5.7-.8 1.2-.8h12.6c.5 0 1 .3 1.2.8l1.2 3.6c.3 1.1-.1 2.2-.9 2.9V19c0 .6-.4 1-1 1H5.2c-.6 0-1-.4-1-1v-8.7c-.8-.7-1.2-1.8-.9-2.9zM5.2 19h13.6v-8.1c-.4.1-.7.1-1.1.1-.9 0-1.8-.4-2.4-1-.6.6-1.5 1-2.4 1-.9 0-1.8-.4-2.4-1-.6.6-1.5 1-2.4 1-.9 0-1.8-.4-2.4-1-.6.6-1.4 1-2.3 1-.1 0-.2 0-.3 0V19z"/>
            </svg>
          </div>

          {/* Label */}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-500">Store</div>
            {loading ? (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : error ? (
              <div className="text-sm text-red-600 truncate">{error}</div>
            ) : (
              <div className="text-sm text-gray-900 truncate">
                {selectedStore?.name ?? 'Store Selection'}
              </div>
            )}
          </div>

          {/* Expand icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-gray-400">
            <path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/>
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-gray-200 bg-white shadow-lg">
            {/* Search */}
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-gray-400">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search Stores"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 border-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>

            {/* Store list */}
            <div className="max-h-48 overflow-y-auto py-1">
              {filteredStores.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">No stores found</div>
              ) : (
                filteredStores.map((store) => (
                  <button
                    key={store.entityId}
                    type="button"
                    onClick={() => handleSelect(store)}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                      selectedStore?.entityId === store.entityId
                        ? 'font-medium text-teal-700 bg-teal-50'
                        : 'text-gray-900'
                    }`}
                  >
                    {store.name}
                  </button>
                ))
              )}
            </div>
          </div>
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

      {/* Info text */}
      <p className="mt-1 px-2 text-xs text-gray-400">
        Inventory import requires catalog migration to be completed first.
      </p>
    </div>
  );
}
