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
  switch (env) {
    case "production":
      return "https://api.treez.io";
    case "sandbox":
      return "https://api.sandbox.treez.io";
    case "dev":
      return "https://api-dev.treez.io";
  }
}

export function getMsoApiBaseUrl(env: TreezEnv): string {
  switch (env) {
    case "production":
      return "https://api.mso.treez.io";
    case "sandbox":
      return "https://api.sandbox.treez.io";
    case "dev":
      return "https://api.dev.treez.io";
  }
}
