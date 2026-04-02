import { describe, expect, it } from "vitest";
import {
  isPortalSessionExpired,
  toPortalSessionInfo,
} from "../lib/portal-session";

describe("portal session helpers", () => {
  it("removes the bearer token from session info exposed to the UI", () => {
    const session = toPortalSessionInfo({
      token: "secret-token",
      email: "ops@treez.io",
      firstName: "Op",
      lastName: "User",
      expiresAt: 9999999999,
    });

    expect(session).toEqual({
      email: "ops@treez.io",
      firstName: "Op",
      lastName: "User",
      expiresAt: 9999999999,
    });
    expect("token" in session).toBe(false);
  });

  it("treats nearly expired sessions as expired", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    expect(isPortalSessionExpired({ expiresAt: nowSeconds + 30 })).toBe(true);
    expect(isPortalSessionExpired({ expiresAt: nowSeconds + 120 })).toBe(false);
  });
});
