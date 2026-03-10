import { decodeJwtPayload } from '../entrypoints/background/auth';

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
