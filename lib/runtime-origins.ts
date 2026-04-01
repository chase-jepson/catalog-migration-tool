import type { TreezEnv } from "./env";

export const API_BASE_URLS: Record<TreezEnv, string> = {
  production: "https://api.treez.io",
  sandbox: "https://api.sandbox.treez.io",
  dev: "https://api-dev.treez.io",
};

export const MSO_API_BASE_URLS: Record<TreezEnv, string> = {
  production: "https://api.mso.treez.io",
  sandbox: "https://api.mso.sandbox.treez.io",
  dev: "https://api-mso-dev.treez.io",
};

export const PORTAL_BASE_URL = "https://customer-success.mso.treez.io";

export const HOST_PERMISSIONS = [
  "https://app.treez.io/*",
  "https://app.sandbox.treez.io/*",
  "https://app.dev.treez.io/*",
  "https://api.treez.io/*",
  "https://api.sandbox.treez.io/*",
  "https://api-dev.treez.io/*",
  "https://api-prod.treez.io/*",
  "https://api.mso.treez.io/*",
  "https://api.mso.sandbox.treez.io/*",
  "https://api-mso-dev.treez.io/*",
  `${PORTAL_BASE_URL}/*`,
  "https://oauth.treez.io/*",
  "https://oauth-dev.treez.io/*",
  "https://*.s3.us-west-2.amazonaws.com/*",
] as const;

export const REQUIRED_FETCH_ORIGINS = [
  ...new Set(
    [...Object.values(API_BASE_URLS), ...Object.values(MSO_API_BASE_URLS), PORTAL_BASE_URL].map(
      (url) => new URL(url).origin,
    ),
  ),
];

export function isOriginCoveredByHostPermission(
  origin: string,
  hostPermissions: readonly string[] = HOST_PERMISSIONS,
): boolean {
  return hostPermissions.some((permission) => permission.startsWith(`${origin}/`));
}
