import type { PortalAuthState, PortalSessionInfo } from "./types";

export function toPortalSessionInfo(auth: PortalAuthState): PortalSessionInfo {
  return {
    email: auth.email,
    firstName: auth.firstName,
    lastName: auth.lastName,
    expiresAt: auth.expiresAt,
  };
}

export function isPortalSessionExpired(session: { expiresAt: number }): boolean {
  return Date.now() / 1000 > session.expiresAt - 60;
}
