import { detectEnvironment, getApiBaseUrl, type TreezEnv } from "../../lib/env";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  idToken?: string;
}

/**
 * Decode the payload section of a JWT token (base64url -> JSON).
 * Returns null on any error (malformed, invalid base64, bad JSON).
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Convert base64url to standard base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = atob(base64);
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired or will expire within 60 seconds.
 * Returns true if expired, nearly expired, or malformed.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return Date.now() / 1000 > payload.exp - 60;
}

/**
 * Read Treez session tokens from the page's localStorage via chrome.scripting.
 */
export async function getTokensViaScripting(tabId: number): Promise<StoredTokens | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          const raw = localStorage.getItem("tz-tokens");
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      },
    });
    return results?.[0]?.result ?? null;
  } catch {
    return null;
  }
}

/**
 * Derive the OAuth token endpoint from the Treez environment.
 * Maps app URLs to their corresponding OAuth endpoints.
 */
function getOAuthUrl(env: TreezEnv): string {
  switch (env) {
    case "production":
      return "https://oauth.treez.io/oauth/token";
    case "sandbox":
      return "https://oauth.treez.io/oauth/token";
    case "dev":
      return "https://oauth-dev.treez.io/oauth/token";
  }
}

/**
 * Refresh the access token using the refresh token.
 * NOTE: The exact OAuth endpoint and payload may need verification in Phase 2+.
 */
export async function refreshAccessToken(
  refreshToken: string,
  env: TreezEnv,
): Promise<StoredTokens | null> {
  try {
    const url = getOAuthUrl(env);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      accessToken: data.access_token ?? data.accessToken,
      refreshToken: data.refresh_token ?? data.refreshToken ?? refreshToken,
      expiresIn: data.expires_in ?? data.expiresIn ?? 3600,
      idToken: data.id_token ?? data.idToken,
    };
  } catch {
    return null;
  }
}

// Refresh-in-progress guard: prevents concurrent refresh calls (Pitfall 4)
let refreshInProgress: Promise<StoredTokens | null> | null = null;

/**
 * Get a valid auth token for the given tab. Reads from localStorage,
 * checks expiry, and refreshes if needed. Uses a refresh-in-progress
 * guard to prevent concurrent refresh race conditions.
 */
export async function getValidToken(tabId: number, tabUrl: string): Promise<string | null> {
  const tokens = await getTokensViaScripting(tabId);
  if (!tokens?.accessToken) return null;

  // Token is still valid
  if (!isTokenExpired(tokens.accessToken)) {
    return tokens.accessToken;
  }

  // Token expired -- need to refresh
  if (!tokens.refreshToken) return null;

  const env = detectEnvironment(tabUrl);
  if (!env) return null;

  // Guard against concurrent refreshes
  if (refreshInProgress) {
    const result = await refreshInProgress;
    return result?.accessToken ?? null;
  }

  refreshInProgress = refreshAccessToken(tokens.refreshToken, env);
  try {
    const refreshed = await refreshInProgress;
    return refreshed?.accessToken ?? null;
  } finally {
    refreshInProgress = null;
  }
}
