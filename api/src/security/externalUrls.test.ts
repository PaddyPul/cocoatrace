import { describe, expect, it } from 'vitest';
import { safeExternalHttpsUrl } from './externalUrls';
import { updateShipmentDetailsSchema, productProfileSchema } from '../validation';

describe('user-controlled external URL boundary', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'http://carrier.com/track',
    '//carrier.com/track',
    'https://user:secret@carrier.com/',
    'https://carrier.com:8443/',
    'https://localhost/',
    'https://127.0.0.1/',
    'https://2130706433/',
    'https://[::1]/',
    'https://service.internal/',
    'https://carrier.com\\@localhost/',
    'https://carrier.com/\ntrack',
    ' https://carrier.com/',
    'https://carrier.com/' + 'a'.repeat(2048),
  ])('rejects %s before storage and on legacy rendering', (value) => {
    expect(safeExternalHttpsUrl(value)).toBeNull();
    expect(updateShipmentDetailsSchema.safeParse({ trackingUrl: value }).success).toBe(false);
    expect(productProfileSchema.shape.heroImageUrl.safeParse(value).success).toBe(false);
  });
  it('allows an unknown provider with query/fragment intact without claiming provider verification', () => {
    const value = 'https://new-carrier.com/track?reference=ABC%20123#status';
    expect(safeExternalHttpsUrl(value)).toBe(value);
    expect(updateShipmentDetailsSchema.safeParse({ trackingUrl: value }).success).toBe(true);
    expect(productProfileSchema.shape.heroImageUrl.safeParse(value).success).toBe(true);
  });
  it('treats absent and non-string legacy values as unavailable', () => {
    for (const value of [null, undefined, 1, {}, ''])
      expect(safeExternalHttpsUrl(value)).toBeNull();
  });
});
