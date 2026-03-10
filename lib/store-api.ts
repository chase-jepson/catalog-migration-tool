import { decodeJwtPayload } from '../entrypoints/background/auth';
import type { TreezEnv } from './env';

/**
 * Extract organization and entity claims from a JWT token.
 * Returns null if the token is malformed or missing required claims.
 */
export function extractStoreClaimsFromToken(
  token: string,
): { orgId: string; entityIds: string[] } | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const { orgId, entityIds } = payload;
  if (typeof orgId !== 'string' || !Array.isArray(entityIds)) return null;

  return { orgId, entityIds: entityIds as string[] };
}

/**
 * Get the MSO API base URL for the given Treez environment.
 */
export function getMsoApiBaseUrl(env: TreezEnv): string {
  switch (env) {
    case 'production':
      return 'https://api.mso.treez.io';
    case 'sandbox':
      return 'https://api.mso.sandbox.treez.io';
    case 'dev':
      return 'https://api-mso-dev.treez.io';
  }
}
