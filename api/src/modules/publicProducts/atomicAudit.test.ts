import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ sql: vi.fn(), release: vi.fn(), fail: false, owner: 'org' }));
vi.mock('../../db', () => ({
  query: vi.fn(),
  getClient: async () => ({ query: m.sql, release: m.release }),
}));
import { publishProfile, upsertProfile } from './administration';
const actor = { id: 'user', organizationId: 'org', permissions: [] };
const input = { batchId: 'batch', slug: 'batch', displayName: 'Batch', lotCode: 'LOT' };
beforeEach(() => {
  vi.clearAllMocks();
  m.fail = false;
  m.owner = 'org';
  m.sql.mockImplementation(async (sql: string) => {
    if (sql.includes('INSERT INTO audit_events')) {
      if (m.fail) throw new Error('audit unavailable');
      return { rows: [] };
    }
    if (sql.startsWith('SELECT id, current_holder_id'))
      return { rows: [{ id: 'batch', current_holder_id: m.owner }] };
    if (sql.startsWith('SELECT b.id')) return { rows: [{ id: 'batch' }] };
    if (sql.includes('INSERT INTO product_profiles') || sql.includes('UPDATE product_profiles'))
      return { rows: [{ id: 'profile', batch_id: 'batch' }] };
    return { rows: [] };
  });
});
describe('public profile required audit', () => {
  for (const workflow of [
    { name: 'upsert', action: 'product_profile.upsert', run: () => upsertProfile(actor, input) },
    {
      name: 'publish',
      action: 'product_profile.publish',
      run: () => publishProfile(actor, 'profile'),
    },
  ]) {
    it(`${workflow.name} commits only after the matching audit`, async () => {
      await workflow.run();
      const statements = m.sql.mock.calls.map(([sql]) => String(sql));
      const auditIndex = statements.findIndex((sql) => sql.includes('INSERT INTO audit_events'));
      expect(auditIndex).toBeGreaterThan(0);
      expect(statements.indexOf('COMMIT')).toBeGreaterThan(auditIndex);
      expect(m.sql.mock.calls[auditIndex][1]).toEqual(
        expect.arrayContaining([
          actor.id,
          actor.organizationId,
          workflow.action,
          'product_profile',
          'profile',
        ]),
      );
      expect(m.release).toHaveBeenCalledOnce();
    });
    it(`${workflow.name} rolls back when audit insertion fails`, async () => {
      m.fail = true;
      await expect(workflow.run()).rejects.toThrow('audit unavailable');
      expect(m.sql).toHaveBeenLastCalledWith('ROLLBACK');
      expect(m.sql.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
      expect(m.release).toHaveBeenCalledOnce();
    });
  }
  it('locks current ownership and denies a read-only non-holder before writing', async () => {
    m.owner = 'other';
    await expect(upsertProfile(actor, input)).rejects.toMatchObject({ statusCode: 403 });
    expect(m.sql.mock.calls[1][0]).toContain('FOR SHARE');
    expect(
      m.sql.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO product_profiles')),
    ).toBe(false);
  });
});
