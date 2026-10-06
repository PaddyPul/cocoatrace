import { describe, expect, it } from 'vitest';
import { bypassPath, mfaState, privileged } from './policy';
describe('privileged passkey assurance', () => {
  it.each(['admin', 'supplier_admin', 'buyer_admin', 'certifier', 'regulator'])(
    'protects %s',
    (role) => expect(privileged([role], [])).toBe(true),
  );
  it('protects wildcard and invitation authority regardless of role name', () => {
    expect(privileged(['custom'], ['*'])).toBe(true);
    expect(privileged(['custom'], ['member.invite'])).toBe(true);
    expect(privileged(['supplier'], ['batch.read'])).toBe(false);
  });
  it('enrolled ordinary accounts cannot fall back to password-only sessions', () =>
    expect(mfaState(false, [], [], true, null)).toEqual({
      required: true,
      enrolled: true,
      verified: false,
      fresh: false,
    }));
  it('revoked key history remains protected even in local/demo mode', () =>
    expect(mfaState(false, [], [], false, null, Date.now(), true).required).toBe(true));
  it('requires setup before privileged access when enforcement is enabled', () =>
    expect(mfaState(true, ['admin'], [], false, null).required).toBe(true));
  it('expires step-up at five minutes without losing read access', () => {
    const now = 1_000_000;
    expect(mfaState(true, ['admin'], [], true, new Date(now - 299999), now).fresh).toBe(true);
    expect(mfaState(true, ['admin'], [], true, new Date(now - 300000), now)).toMatchObject({
      verified: true,
      fresh: false,
    });
    expect(mfaState(true, ['admin'], [], true, new Date(now + 1), now).verified).toBe(false);
  });
  it('limits the restricted-session allowlist to exact me/logout and MFA routes', () => {
    for (const path of ['/me', '/auth/logout', '/auth/mfa/keys'])
      expect(bypassPath(path)).toBe(true);
    for (const path of [
      '/me/extra',
      '/auth/logout/extra',
      '/auth/mfaevil',
      '/auth/password/change',
      '/admin/access-controls',
    ])
      expect(bypassPath(path)).toBe(false);
  });
});
