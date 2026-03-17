/**
 * Portal authentication helpers.
 * Stores/retrieves portal token from chrome.storage.session.
 */

import type { PortalAuthState } from "./types";

const STORAGE_KEY = "portalAuth";

export async function getPortalAuth(): Promise<PortalAuthState | null> {
  try {
    const result = await chrome.storage.session.get(STORAGE_KEY);
    const auth = result[STORAGE_KEY] as PortalAuthState | undefined;
    if (!auth) return null;

    // Check expiry (with 60s buffer)
    if (Date.now() / 1000 > auth.expiresAt - 60) {
      await clearPortalAuth();
      return null;
    }

    return auth;
  } catch {
    return null;
  }
}

export async function setPortalAuth(auth: PortalAuthState): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: auth });
}

async function clearPortalAuth(): Promise<void> {
  await chrome.storage.session.remove(STORAGE_KEY);
}
