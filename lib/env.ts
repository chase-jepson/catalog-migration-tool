import { API_BASE_URLS, MSO_API_BASE_URLS } from "./runtime-origins";

export type TreezEnv = "production" | "sandbox" | "dev";

const ENV_MAP: Record<string, TreezEnv> = {
  "app.treez.io": "production",
  "app.sandbox.treez.io": "sandbox",
  "app.dev.treez.io": "dev",
};

export function detectEnvironment(url: string): TreezEnv | null {
  try {
    const hostname = new URL(url).hostname;
    return ENV_MAP[hostname] ?? null;
  } catch {
    return null;
  }
}

export function getApiBaseUrl(env: TreezEnv): string {
  return API_BASE_URLS[env];
}

export function getMsoApiBaseUrl(env: TreezEnv): string {
  return MSO_API_BASE_URLS[env];
}
