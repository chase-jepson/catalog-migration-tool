import type { TreezEnv } from '../../lib/env';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  idToken?: string;
}

// Stub implementations -- TDD RED phase
export function decodeJwtPayload(
  _token: string,
): Record<string, unknown> | null {
  throw new Error('Not implemented');
}

export function isTokenExpired(_token: string): boolean {
  throw new Error('Not implemented');
}

export async function getValidToken(
  _tabId: number,
  _tabUrl: string,
): Promise<string | null> {
  throw new Error('Not implemented');
}
