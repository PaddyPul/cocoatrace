import { describe, expect, it } from 'vitest';
import { requirePlatformAdministrator, requireSafeTarget } from './policy';
import { decisionSchema, listSchema } from './schemas';
describe('access control policy', () => {
  it('organization administrators cannot act as platform administrators', () => {
    expect(() => requirePlatformAdministrator(['organization.admin'])).toThrow(
      'Platform administrator',
    );
    expect(() => requirePlatformAdministrator(['*'])).not.toThrow();
  });
  it('privileged organizations are protected from the routine suspension path', () => {
    expect(() => requireSafeTarget(true)).toThrow('privileged recovery');
    expect(() => requireSafeTarget(false)).not.toThrow();
  });
  it('requires an explicit boolean, substantive bounded reason and current password', () => {
    expect(
      decisionSchema.safeParse({
        suspended: 'false',
        reason: 'reviewed reason',
        currentPassword: 'password',
      }).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse({ suspended: true, reason: '   ', currentPassword: 'password' })
        .success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse({
        suspended: true,
        reason: 'reviewed reason',
        currentPassword: 'password',
        active: true,
      }).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse({
        suspended: false,
        reason: 'Restoration reviewed',
        currentPassword: 'password',
      }).success,
    ).toBe(true);
    expect(listSchema.safeParse({ after: 'malformed' }).success).toBe(false);
  });
});
