import type { PersistedMigrationState } from "./types";

const STORAGE_KEY = "migrationState";

/**
 * Save migration state to chrome.storage.local.
 * Uses the 'migrationState' key for persistence across sessions.
 */
export async function saveMigrationState(state: PersistedMigrationState): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch (err) {
    console.error("[migration-store] Failed to save state:", err);
  }
}

/**
 * Load migration state from chrome.storage.local.
 * Returns null if no persisted state exists or on error.
 */
export async function loadMigrationState(): Promise<PersistedMigrationState | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as PersistedMigrationState) ?? null;
  } catch (err) {
    console.error("[migration-store] Failed to load state:", err);
    return null;
  }
}

/**
 * Clear persisted migration state from chrome.storage.local.
 */
export async function clearMigrationState(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch (err) {
    console.error("[migration-store] Failed to clear state:", err);
  }
}
