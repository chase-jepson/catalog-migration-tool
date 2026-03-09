import { describe, it, expect, vi, afterEach } from 'vitest';
import { decodeJwtPayload, isTokenExpired } from '../entrypoints/background/auth';

/**
 * Helper: create a fake JWT with given payload.
 * Format: header.payload.signature (all base64url-encoded)
 */
function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const sig = btoa('fake-signature');
  return `${header}.${body}.${sig}`;
}

describe('decodeJwtPayload', () => {
  it('returns parsed payload for a valid JWT', () => {
    const token = createFakeJwt({ sub: 'user-123', exp: 9999999999 });
    const result = decodeJwtPayload(token);
    expect(result).toEqual({ sub: 'user-123', exp: 9999999999 });
  });

  it('returns null for an empty string', () => {
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('returns null for a token with fewer than 3 parts', () => {
    expect(decodeJwtPayload('abc.def')).toBeNull();
  });

  it('returns null for invalid base64 payload', () => {
    expect(decodeJwtPayload('abc.!!!invalid!!!.def')).toBeNull();
  });

  it('handles URL-safe base64 characters (- and _)', () => {
    // Payload with characters that would produce + and / in standard base64
    const payload = { data: 'test+value/special' };
    const token = createFakeJwt(payload);
    const result = decodeJwtPayload(token);
    expect(result).toEqual(payload);
  });
});

describe('isTokenExpired', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when exp is in the past', () => {
    // exp = 1000 seconds ago
    const pastExp = Math.floor(Date.now() / 1000) - 1000;
    const token = createFakeJwt({ exp: pastExp });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns false when exp is well in the future', () => {
    // exp = 1 hour from now
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = createFakeJwt({ exp: futureExp });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true when exp is within the 60-second buffer', () => {
    // exp = 30 seconds from now (within 60s buffer)
    vi.spyOn(Date, 'now').mockReturnValue(1000000 * 1000); // 1000000 seconds
    const token = createFakeJwt({ exp: 1000030 }); // 30s from "now"
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns false when exp is exactly at the 60-second boundary', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000 * 1000);
    // exp = now + 61 seconds -- just outside the 60s buffer
    const token = createFakeJwt({ exp: 1000061 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true for a malformed token', () => {
    expect(isTokenExpired('not-a-valid-token')).toBe(true);
  });

  it('returns true when payload has no exp claim', () => {
    const token = createFakeJwt({ sub: 'user-123' });
    expect(isTokenExpired(token)).toBe(true);
  });
});
