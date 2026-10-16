import { describe, expect, it } from 'vitest';
import { assertListingCurrent, listingExpired, renewalInput } from './policy';
describe('listing expiry policy', () => {
  it('retains nullable legacy terms and expires at the exact boundary', () => {
    expect(listingExpired(null, 1000)).toBe(false);
    expect(listingExpired(new Date(1000).toISOString(), 1000)).toBe(true);
    expect(listingExpired(new Date(1001).toISOString(), 1000)).toBe(false);
    expect(() => assertListingCurrent('2000-01-01')).toThrow('Listing has expired');
  });
  it('requires a reason and explicit bounded future review', () => {
    const now = Date.now();
    for (const invalid of [
      undefined,
      null,
      [],
      {},
      { reason: 'Reviewed current stock', expiresAt: 'tomorrow' },
      {
        reason: 'Reviewed current stock',
        expiresAt: new Date(now + 1000).toISOString(),
        active: true,
      },
    ])
      expect(() => renewalInput(invalid, now)).toThrow();
    expect(() =>
      renewalInput({ reason: 'short', expiresAt: new Date(now + 1000).toISOString() }, now),
    ).toThrow();
    expect(() =>
      renewalInput(
        {
          reason: 'Reviewed current stock',
          expiresAt: new Date(now + 91 * 86400000).toISOString(),
        },
        now,
      ),
    ).toThrow();
    expect(
      renewalInput(
        {
          reason: ' Reviewed current stock ',
          expiresAt: new Date(now + 30 * 86400000).toISOString(),
        },
        now,
      ).reason,
    ).toBe('Reviewed current stock');
  });
});
