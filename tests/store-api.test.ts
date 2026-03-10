import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module before importing store-api
vi.mock('../entrypoints/background/auth', () => ({
  decodeJwtPayload: vi.fn(),
}));

import { decodeJwtPayload } from '../entrypoints/background/auth';
import { extractStoreClaimsFromToken, getMsoApiBaseUrl } from '../lib/store-api';

const mockDecode = vi.mocked(decodeJwtPayload);

describe('extractStoreClaimsFromToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns orgId and entityIds from valid JWT claims', () => {
    mockDecode.mockReturnValue({
      orgId: 'org-123',
      entityIds: ['store-a', 'store-b'],
    });

    const result = extractStoreClaimsFromToken('fake.jwt.token');
    expect(result).toEqual({
      orgId: 'org-123',
      entityIds: ['store-a', 'store-b'],
    });
    expect(mockDecode).toHaveBeenCalledWith('fake.jwt.token');
  });

  it('returns null when orgId claim is missing', () => {
    mockDecode.mockReturnValue({
      entityIds: ['store-a'],
    });

    const result = extractStoreClaimsFromToken('fake.jwt.token');
    expect(result).toBeNull();
  });

  it('returns null when entityIds claim is missing', () => {
    mockDecode.mockReturnValue({
      orgId: 'org-123',
    });

    const result = extractStoreClaimsFromToken('fake.jwt.token');
    expect(result).toBeNull();
  });

  it('returns null for malformed token (decode returns null)', () => {
    mockDecode.mockReturnValue(null);

    const result = extractStoreClaimsFromToken('bad-token');
    expect(result).toBeNull();
  });

  it('returns null when entityIds is not an array', () => {
    mockDecode.mockReturnValue({
      orgId: 'org-123',
      entityIds: 'not-an-array',
    });

    const result = extractStoreClaimsFromToken('fake.jwt.token');
    expect(result).toBeNull();
  });
});

describe('getMsoApiBaseUrl', () => {
  it('returns production MSO API URL', () => {
    expect(getMsoApiBaseUrl('production')).toBe('https://api.mso.treez.io');
  });

  it('returns sandbox MSO API URL', () => {
    expect(getMsoApiBaseUrl('sandbox')).toBe('https://api.mso.sandbox.treez.io');
  });

  it('returns dev MSO API URL', () => {
    expect(getMsoApiBaseUrl('dev')).toBe('https://api-mso-dev.treez.io');
  });
});
