import type { PersistedInventoryState } from "./types";

const STORAGE_KEY = "inventoryMigrationState";

/**
 * Save inventory migration state to chrome.storage.local.
 * Uses the 'inventoryMigrationState' key -- separate from catalog's 'migrationState'.
 */
export async function saveInventoryState(state: PersistedInventoryState): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch (err) {
    console.error("[inventory-migration-store] Failed to save state:", err);
  }
}

/**
 * Load inventory migration state from chrome.storage.local.
 * Returns null if no persisted state exists or on error.
 */
export async function loadInventoryState(): Promise<PersistedInventoryState | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as PersistedInventoryState) ?? null;
  } catch (err) {
    console.error("[inventory-migration-store] Failed to load state:", err);
    return null;
  }
}

/**
 * Clear persisted inventory migration state from chrome.storage.local.
 */
export async function clearInventoryState(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch (err) {
    console.error("[inventory-migration-store] Failed to clear state:", err);
  }
}
