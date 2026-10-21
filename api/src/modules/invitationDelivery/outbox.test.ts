import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../config/env', () => ({
  config: {
    get identityEmailEnabled() {
      return state.enabled;
    },
    emailDriver: 'smtp',
    invitationDeliveryKey: '12'.repeat(32),
  },
}));
import { enqueueInvitationDelivery, cancelInvitationDelivery } from './outbox';
const token = 'private-bearer';
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const actor = { id: 'actor', organizationId: 'org' };
const query = vi.fn();
const client = { query } as unknown as PoolClient;
beforeEach(() => {
  vi.resetAllMocks();
  state.enabled = true;
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT token_hash'))
      return { rows: [{ token_hash: tokenHash, email: 'private@example.test' }] };
    if (sql.includes('INSERT INTO invitation_email_outbox')) return { rows: [{ id: 'queue' }] };
    return { rows: [] };
  });
});
describe('transactional invitation delivery intent', () => {
  it('uses only the supplied transaction and stores encrypted credentials with safe audit metadata', async () => {
    await enqueueInvitationDelivery(client, actor, 'invitation', token);
    const insert = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO invitation_email_outbox'),
    )!;
    expect(insert[1].slice(0, 2)).toEqual(['invitation', tokenHash]);
    expect(insert[1][3]).not.toContain(token);
    expect(insert[1][6]).toBe(actor.id);
    expect(JSON.stringify(query.mock.calls)).not.toContain(token);
    const audit = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_events'))!;
    expect(audit[1][2]).toBe('member.invitation_email_queued');
    expect(JSON.parse(audit[1][6])).toEqual({ outboxId: 'queue', deliveryEnabled: true });
    expect(query.mock.calls.some(([sql]) => /^(BEGIN|COMMIT)$/.test(sql))).toBe(false);
  });
  it('records disabled delivery without persisting bearer material or claiming a send', async () => {
    state.enabled = false;
    await enqueueInvitationDelivery(client, actor, 'invitation', token);
    const values = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO invitation_email_outbox'),
    )![1];
    expect(values.slice(2, 6)).toEqual([null, null, 'suppressed', 'EMAIL_NOT_CONFIGURED']);
  });
  it('does not reset already delivered status or emit another audit on duplicate enqueue', async () => {
    query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT token_hash')
        ? [{ token_hash: tokenHash, email: 'private@example.test' }]
        : [],
    }));
    await enqueueInvitationDelivery(client, actor, 'invitation', token);
    expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE user_invitations'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO audit_events'))).toBe(false);
  });
  it('refuses stale generations and propagates insert/audit failure to the caller transaction', async () => {
    query.mockResolvedValueOnce({ rows: [{ token_hash: 'old' }] });
    await expect(
      enqueueInvitationDelivery(client, actor, 'invitation', token),
    ).rejects.toMatchObject({ statusCode: 409 });
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT token_hash'))
        return { rows: [{ token_hash: tokenHash, email: 'private@example.test' }] };
      if (sql.includes('INSERT INTO invitation_email_outbox')) throw new Error('disk failure');
      return { rows: [] };
    });
    await expect(enqueueInvitationDelivery(client, actor, 'invitation', token)).rejects.toThrow(
      'disk failure',
    );
  });
  it('revocation and acceptance scrub pending credentials under the parent invitation lock', async () => {
    await cancelInvitationDelivery(client, 'invitation');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('token_ciphertext=NULL'), [
      'invitation',
    ]);
    expect(query.mock.calls[0][0]).toContain("status<>'sent'");
  });
});
