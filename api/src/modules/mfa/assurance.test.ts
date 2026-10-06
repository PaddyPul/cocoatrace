import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { assertMutationAssurance } from './assurance';
import { PRIVILEGED_PERMISSIONS } from './policy';
const actor = { id: 'user', organizationId: 'org', sessionId: 'session' };
const identity = { active: true, verification_status: 'verified', history: true, privileged: true };
describe('transactional privileged assurance', () => {
  it('holds live identity/key/session locks and binds the shared permission policy', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [identity] })
      .mockResolvedValueOnce({ rows: [{ id: 'session' }] });
    await assertMutationAssurance({ query } as unknown as PoolClient, actor);
    expect(query.mock.calls[0][1]).toEqual(['user', 'org', PRIVILEGED_PERMISSIONS]);
    expect(query.mock.calls[0][0]).toContain('FOR SHARE OF o,u');
    expect(query.mock.calls[1][0]).toContain('FOR SHARE OF s,k');
  });
  it('rejects revoked or stale assurance after the user lock', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [identity] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(
      assertMutationAssurance({ query } as unknown as PoolClient, actor),
    ).rejects.toMatchObject({ code: 'MFA_STEP_UP_REQUIRED' });
  });
  it('rejects suspension before checking assurance', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [{ ...identity, access_suspended_at: new Date() }] });
    await expect(
      assertMutationAssurance({ query } as unknown as PoolClient, actor),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
