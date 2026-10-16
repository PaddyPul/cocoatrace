import { describe, it, expect } from 'vitest';
import { assignable, boundedRole, definitions, family } from './policy';
import { pageSchema, roleSchema, decisionSchema } from './schemas';
describe('bounded team roles', () => {
  it('maps the supported organization types explicitly', () => {
    expect(family('importer')).toBe('buyer');
    for (const type of ['exporter', 'farmer', 'cooperative']) expect(family(type)).toBe('supplier');
    expect(() => family('certifier')).toThrow();
  });
  it('members exclude management and viewers only read', () => {
    for (const type of ['importer', 'exporter']) {
      const roles = definitions(type);
      for (const [name, permissions] of Object.entries(roles)) {
        expect(permissions).not.toContain('*');
        if (name.endsWith('_member')) expect(permissions).not.toContain('member.invite');
        if (name.endsWith('_viewer'))
          expect(permissions.every((p) => p.endsWith('.read'))).toBe(true);
      }
    }
  });
  it('does not trust names, custom roles, duplicate permissions, wildcard or opposite family', () => {
    const roles = definitions('importer'),
      permissions = roles.buyer_member;
    expect(boundedRole('buyer_member', permissions, 'importer')).toBe(true);
    for (const value of [
      [...permissions, '*'],
      [...permissions, 'member.manage'],
      [...permissions, permissions[0]],
      permissions.slice(1),
    ])
      expect(boundedRole('buyer_member', value, 'importer')).toBe(false);
    expect(boundedRole('supplier_member', permissions, 'importer')).toBe(false);
    expect(boundedRole('custom', permissions, 'importer')).toBe(false);
    expect(assignable('buyer_member', permissions, ['listing.read'], 'importer')).toBe(false);
  });
  it('requires bounded pagination and explicit decisions without extra fields', () => {
    expect(pageSchema.parse({}).limit).toBe(20);
    for (const p of [{ limit: 0 }, { limit: 101 }, { cursor: 'bad' }, { search: 'x'.repeat(201) }])
      expect(pageSchema.safeParse(p).success).toBe(false);
    const input = { reason: 'Reviewed membership change', currentPassword: 'secret' };
    expect(decisionSchema.safeParse(input).success).toBe(true);
    expect(decisionSchema.safeParse({ ...input, active: true }).success).toBe(false);
    expect(roleSchema.safeParse({ ...input, role: 'buyer_viewer' }).success).toBe(true);
    expect(roleSchema.safeParse({ ...input, reason: 'short', role: 'buyer_viewer' }).success).toBe(
      false,
    );
  });
});
