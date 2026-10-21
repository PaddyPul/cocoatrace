import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '../../services/authSessionService';
const m = vi.hoisted(() => ({ sql: vi.fn(), release: vi.fn(), fail: false, missing: false }));
vi.mock('../../db', () => ({ getClient: async () => ({ query: m.sql, release: m.release }) }));
import { updateBuyerComplianceReference, updateBuyerEudrReference } from './complianceReferences';
const actor: AuthenticatedActor = {
  id: 'user',
  organizationId: 'org',
  sessionId: 'session',
  email: 'test@example.invalid',
  name: 'Test',
  roles: [],
  permissions: [],
  orgName: 'Org',
  orgType: 'buyer',
};
beforeEach(() => {
  vi.clearAllMocks();
  m.fail = false;
  m.missing = false;
  m.sql.mockImplementation(async (sql: string) => {
    if (sql.includes('INSERT INTO audit_events') && m.fail) throw new Error('audit unavailable');
    return { rows: sql.startsWith('UPDATE') && !m.missing ? [{ id: 'contract' }] : [] };
  });
});
describe('compliance reference mutation boundary', () => {
  for (const run of [
    () => updateBuyerEudrReference(actor, 'contract', 'REF'),
    () => updateBuyerComplianceReference(actor, 'contract', ' EUDR ', ' REF '),
  ]) {
    it('retains buyer scoping and commits audit before returning', async () => {
      expect(await run()).toEqual({ id: 'contract' });
      expect(m.sql.mock.calls[1][0]).toContain('buyer_organization_id');
      expect(m.sql.mock.calls[1][1]).toContain(actor.organizationId);
      expect(m.sql.mock.calls[2][0]).toContain('INSERT INTO audit_events');
      expect(m.sql).toHaveBeenLastCalledWith('COMMIT');
    });
    it('rolls back the reference if its required audit fails', async () => {
      m.fail = true;
      await expect(run()).rejects.toThrow('audit unavailable');
      expect(m.sql).toHaveBeenLastCalledWith('ROLLBACK');
      expect(m.sql.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    });
    it('does not audit an unrelated or missing contract', async () => {
      m.missing = true;
      expect(await run()).toBeNull();
      expect(
        m.sql.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO audit_events')),
      ).toBe(false);
    });
  }
});
