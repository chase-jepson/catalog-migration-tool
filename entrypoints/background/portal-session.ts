import { isPortalSessionExpired } from "../../lib/portal-session";
import type { PortalAuthState, PortalSessionInfo } from "../../lib/types";

let currentPortalAuth: PortalAuthState | null = null;

export function setPortalAuth(auth: PortalAuthState): PortalSessionInfo {
  currentPortalAuth = auth;
  return {
    email: auth.email,
    firstName: auth.firstName,
    lastName: auth.lastName,
    expiresAt: auth.expiresAt,
  };
}

export function getPortalAuth(): PortalAuthState | null {
  if (!currentPortalAuth) return null;
  if (isPortalSessionExpired(currentPortalAuth)) {
    currentPortalAuth = null;
    return null;
  }
  return currentPortalAuth;
}

export function getPortalSessionInfo(): PortalSessionInfo | null {
  const auth = getPortalAuth();
  if (!auth) return null;
  return {
    email: auth.email,
    firstName: auth.firstName,
    lastName: auth.lastName,
    expiresAt: auth.expiresAt,
  };
}

export function clearPortalAuth(): void {
  currentPortalAuth = null;
}
