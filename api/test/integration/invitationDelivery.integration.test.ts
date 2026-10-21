import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const delivery = vi.hoisted(() => ({ enabled: true, key: '12'.repeat(32) }));
vi.mock('../../src/config/env', async (original) => {
  const actual = await original<typeof import('../../src/config/env')>();
  return {
    ...actual,
    config: {
      ...actual.config,
      get identityEmailEnabled() {
        return delivery.enabled;
      },
      emailDriver: 'smtp',
      get invitationDeliveryKey() {
        return delivery.key;
      },
    },
  };
});
vi.mock('../../src/services/invitationDelivery', () => ({
  deliverInvitation: async () => ({ status: 'pending' }),
}));
import { PostgresOrganizationAccessRepository } from '../../src/modules/organizationAccess/repository';
import { pool, query } from '../../src/db';
import { inDatabaseTransaction } from '../../src/services/databaseTransaction';
import { createPendingInvitation } from '../../src/services/invitationIssuance';
import {
  enqueueInvitationDelivery,
  invitationTokenHash,
} from '../../src/modules/invitationDelivery/outbox';
import { processInvitationEmails } from '../../src/modules/invitationDelivery/worker';
import { retryEmail } from '../../src/modules/operations/recovery';
import {
  resendInvitation,
  revokeInvitation,
  acceptInvitation,
} from '../../src/modules/invitationsWorkflow/useCases';

let org: string, user: string, role: string, session: string, invitedRole: string;
let ownsInvitedRole = false;
const token = () => crypto.randomBytes(32).toString('base64url');
const who = () => ({
  id: user,
  organizationId: org,
  sessionId: session,
  permissions: ['member.invite'],
});
async function invite() {
  const bearer = token();
  const row = await createPendingInvitation({
    organizationId: org,
    email: crypto.randomUUID() + '@integration.test',
    roleId: invitedRole,
    tokenHash: invitationTokenHash(bearer),
    token: bearer,
    actorId: user,
    actorOrganizationId: org,
    actorSessionId: session,
  });
  return { id: row.id as string, bearer };
}
const queued = async (id: string) =>
  (
    await query(
      'SELECT * FROM invitation_email_outbox WHERE invitation_id=$1 ORDER BY created_at,id',
      [id],
    )
  ).rows;
const send = () => vi.fn(async () => ({ status: 'sent' as const }));
beforeAll(async () => {
  org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Durable invitations ' + crypto.randomUUID()],
    )
  ).rows[0].id;
  user = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,'unused','Outbox issuer') RETURNING id",
      [org, crypto.randomUUID() + '@integration.test'],
    )
  ).rows[0].id;
  role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'outbox-' + crypto.randomUUID(),
      ['member.invite'],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  session = crypto.randomUUID();
  await query(
    "INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '1 day')",
    [session, user, invitationTokenHash(token())],
  );
  // The native migration baseline is intentionally unseeded. This non-platform
  // issuance scenario requires the legacy role name that matches its org type.
  // Own that fixture when absent; never overwrite a shared role's permissions.
  const created = await query<{ id: string }>(
    "INSERT INTO roles(name,permissions) VALUES('exporter',ARRAY[]::text[]) ON CONFLICT(name) DO NOTHING RETURNING id",
  );
  ownsInvitedRole = !!created.rows[0];
  const target =
    created.rows[0] ||
    (await query<{ id: string }>("SELECT id FROM roles WHERE name='exporter'")).rows[0];
  if (!target) throw new Error('Invitation delivery recipient role fixture unavailable');
  invitedRole = target.id;
});
beforeEach(() => {
  delivery.enabled = true;
  delivery.key = '12'.repeat(32);
});
afterAll(async () => {
  try {
    if (org) await query('DELETE FROM user_invitations WHERE organization_id=$1', [org]);
    if (ownsInvitedRole && invitedRole) {
      // Acceptance creates a test user with this role. Remove only our org's
      // assignments and the role we created, leaving pre-existing roles intact.
      await query(
        `DELETE FROM user_roles ur USING users u
        WHERE ur.user_id=u.id AND u.organization_id=$1 AND ur.role_id=$2`,
        [org, invitedRole],
      );
      await query('DELETE FROM roles WHERE id=$1', [invitedRole]);
    }
  } finally {
    await pool.end();
  }
});
describe('durable private invitation delivery and recovery', () => {
  it('recovers committed invitation intent after the original request is gone and scrubs submitted credentials', async () => {
    const item = await invite();
    const before = (await queued(item.id))[0];
    expect(before.status).toBe('queued');
    expect(before.token_ciphertext).not.toContain(item.bearer);
    const sender = send();
    expect(await processInvitationEmails(sender, 1, item.id)).toMatchObject({ sent: 1 });
    expect(sender).toHaveBeenCalledOnce();
    expect(sender).toHaveBeenCalledWith(
      expect.objectContaining({ invitationUrl: expect.stringContaining(item.bearer) }),
    );
    expect((await queued(item.id))[0]).toMatchObject({
      status: 'sent',
      token_ciphertext: null,
      key_id: null,
      attempts: 1,
    });
    expect(
      (await query('SELECT email_delivery_status FROM user_invitations WHERE id=$1', [item.id]))
        .rows[0].email_delivery_status,
    ).toBe('sent');
  });
  it('deduplicates the same generation without resetting successful submission status', async () => {
    const item = await invite();
    const sender = send();
    await processInvitationEmails(sender, 1, item.id);
    await inDatabaseTransaction((client) =>
      enqueueInvitationDelivery(client, who(), item.id, item.bearer),
    );
    expect(await queued(item.id)).toHaveLength(1);
    expect((await queued(item.id))[0].status).toBe('sent');
    expect(
      (await query('SELECT email_delivery_status FROM user_invitations WHERE id=$1', [item.id]))
        .rows[0].email_delivery_status,
    ).toBe('sent');
  });
  it('rolls back invitation and business audit when outbox persistence fails', async () => {
    await query(`CREATE FUNCTION fail_invitation_outbox_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM user_invitations WHERE id=NEW.invitation_id AND organization_id='${org}'::uuid) THEN RAISE EXCEPTION 'injected outbox failure'; END IF; RETURN NEW; END $$`);
    await query(
      'CREATE TRIGGER fail_invitation_outbox_fixture BEFORE INSERT ON invitation_email_outbox FOR EACH ROW EXECUTE FUNCTION fail_invitation_outbox_fixture()',
    );
    const before = (
      await query('SELECT COUNT(*)::int n FROM user_invitations WHERE organization_id=$1', [org])
    ).rows[0].n;
    const audits = (
      await query('SELECT COUNT(*)::int n FROM audit_events WHERE actor_user_id=$1', [user])
    ).rows[0].n;
    try {
      await expect(invite()).rejects.toThrow('injected outbox failure');
      expect(
        (
          await query('SELECT COUNT(*)::int n FROM user_invitations WHERE organization_id=$1', [
            org,
          ])
        ).rows[0].n,
      ).toBe(before);
      expect(
        (await query('SELECT COUNT(*)::int n FROM audit_events WHERE actor_user_id=$1', [user]))
          .rows[0].n,
      ).toBe(audits);
    } finally {
      await query('DROP TRIGGER fail_invitation_outbox_fixture ON invitation_email_outbox');
      await query('DROP FUNCTION fail_invitation_outbox_fixture()');
    }
  });
  it('claims once across concurrent workers', async () => {
    const item = await invite();
    const sender = send();
    await Promise.all([
      processInvitationEmails(sender, 1, item.id),
      processInvitationEmails(sender, 1, item.id),
    ]);
    expect(sender).toHaveBeenCalledOnce();
    expect((await queued(item.id))[0]).toMatchObject({ status: 'sent', attempts: 1 });
  });
  it('retries unknown submission outcomes at least once without falsely reporting sent', async () => {
    const item = await invite();
    const first = vi.fn(async () => {
      throw new Error('relay accepted but acknowledgement lost: private payload');
    });
    expect(await processInvitationEmails(first, 1, item.id)).toMatchObject({ failed: 1 });
    expect((await queued(item.id))[0]).toMatchObject({
      status: 'failed',
      sent_at: null,
      last_error: 'SMTP_SUBMISSION_FAILED',
    });
    await query('UPDATE invitation_email_outbox SET next_attempt_at=NOW() WHERE invitation_id=$1', [
      item.id,
    ]);
    const second = send();
    await processInvitationEmails(second, 1, item.id);
    expect((await queued(item.id))[0]).toMatchObject({ status: 'sent', attempts: 2 });
  });
  it('recovers an expired lease but refuses an active lease', async () => {
    const item = await invite();
    const sender = send();
    await query(
      "UPDATE invitation_email_outbox SET status='sending',lease_token=$2,lease_expires_at=NOW()+INTERVAL '1 minute',attempts=1 WHERE invitation_id=$1",
      [item.id, crypto.randomUUID()],
    );
    await processInvitationEmails(sender, 1, item.id);
    expect(sender).not.toHaveBeenCalled();
    await query(
      "UPDATE invitation_email_outbox SET lease_expires_at=NOW()-INTERVAL '1 minute' WHERE invitation_id=$1",
      [item.id],
    );
    await processInvitationEmails(sender, 1, item.id);
    expect(sender).toHaveBeenCalledOnce();
  });
  it('caps retries and retains a visible terminal record', async () => {
    const item = await invite();
    const sender = send();
    await query(
      "UPDATE invitation_email_outbox SET status='sending',lease_token=$2,lease_expires_at=NOW()-INTERVAL '1 minute',attempts=8 WHERE invitation_id=$1",
      [item.id, crypto.randomUUID()],
    );
    await processInvitationEmails(sender, 1, item.id);
    expect(sender).not.toHaveBeenCalled();
    expect((await queued(item.id))[0]).toMatchObject({
      status: 'failed_terminal',
      attempts: 8,
      last_error: 'FINAL_LEASE_EXPIRED',
    });
  });
  it.each(['revoked', 'expired', 'accepted', 'superseded'] as const)(
    'scrubs %s invitation work before provider submission',
    async (state) => {
      const item = await invite();
      const sender = send();
      if (state === 'revoked')
        await query('UPDATE user_invitations SET revoked_at=NOW() WHERE id=$1', [item.id]);
      if (state === 'expired')
        await query(
          "UPDATE user_invitations SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",
          [item.id],
        );
      if (state === 'accepted')
        await query('UPDATE user_invitations SET accepted_at=NOW() WHERE id=$1', [item.id]);
      if (state === 'superseded')
        await query('UPDATE user_invitations SET token_hash=$2 WHERE id=$1', [
          item.id,
          invitationTokenHash(token()),
        ]);
      await processInvitationEmails(sender, 1, item.id);
      expect(sender).not.toHaveBeenCalled();
      expect((await queued(item.id))[0]).toMatchObject({
        status: 'suppressed',
        token_ciphertext: null,
      });
    },
  );
  it('suppresses work if the issuer loses permission after enqueue', async () => {
    const item = await invite();
    const sender = send();
    try {
      await query('UPDATE roles SET permissions=ARRAY[]::text[] WHERE id=$1', [role]);
      await processInvitationEmails(sender, 1, item.id);
      expect(sender).not.toHaveBeenCalled();
      expect((await queued(item.id))[0]).toMatchObject({
        status: 'suppressed',
        token_ciphertext: null,
      });
    } finally {
      await query('UPDATE roles SET permissions=$2 WHERE id=$1', [role, ['member.invite']]);
    }
  });
  it('fails closed on key replacement or credential tampering without leaking payload', async () => {
    const item = await invite();
    const sender = send();
    delivery.key = '34'.repeat(32);
    await processInvitationEmails(sender, 1, item.id);
    expect(sender).not.toHaveBeenCalled();
    expect((await queued(item.id))[0]).toMatchObject({
      status: 'failed_terminal',
      last_error: 'INVITATION_KEY_UNAVAILABLE',
    });
    delivery.key = '12'.repeat(32);
    const corrupt = await invite();
    await query(
      "UPDATE invitation_email_outbox SET token_ciphertext='invalid' WHERE invitation_id=$1",
      [corrupt.id],
    );
    await processInvitationEmails(sender, 1, corrupt.id);
    expect(sender).not.toHaveBeenCalled();
    expect((await queued(corrupt.id))[0].last_error).toBe('INVITATION_CREDENTIAL_INVALID');
  });
  it('retains pending work while email is disabled instead of claiming delivery', async () => {
    const item = await invite();
    delivery.enabled = false;
    expect(await processInvitationEmails(undefined, 1, item.id)).toMatchObject({ skipped: 1 });
    expect((await queued(item.id))[0]).toMatchObject({ status: 'queued', attempts: 0 });
    const suppressed = await invite();
    expect((await queued(suppressed.id))[0]).toMatchObject({
      status: 'suppressed',
      token_ciphertext: null,
      last_error: 'EMAIL_NOT_CONFIGURED',
    });
  });
  it('resend supersedes the old generation and only the replacement token is submitted', async () => {
    const item = await invite();
    expect(await resendInvitation(who(), item.id)).toMatchObject({
      kind: 'success',
      value: { emailDelivery: 'pending' },
    });
    const rows = await queued(item.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.token_hash === invitationTokenHash(item.bearer))).toMatchObject({
      status: 'suppressed',
      token_ciphertext: null,
    });
    const sender = send();
    await processInvitationEmails(sender, 1, item.id);
    expect(sender).toHaveBeenCalledOnce();
    expect(JSON.stringify(sender.mock.calls)).not.toContain(item.bearer);
  });
  it.each(['revoke', 'accept'] as const)(
    '%s invalidates queued credentials in the business transaction',
    async (action) => {
      const item = await invite();
      const result =
        action === 'revoke'
          ? await revokeInvitation(who(), item.id)
          : await acceptInvitation(item.bearer, {
              name: 'Synthetic invitee',
              password: 'TemporaryOutbox123!',
            });
      expect(result).toMatchObject({ kind: 'success' });
      expect((await queued(item.id))[0]).toMatchObject({
        status: 'suppressed',
        token_ciphertext: null,
      });
      const sender = send();
      await processInvitationEmails(sender, 1, item.id);
      expect(sender).not.toHaveBeenCalled();
    },
  );
  it('serializes audited operator retries and refuses corrupt credential recovery', async () => {
    const item = await invite();
    await query(
      "UPDATE invitation_email_outbox SET status='failed_terminal',attempts=8,last_error='FINAL_LEASE_EXPIRED' WHERE invitation_id=$1",
      [item.id],
    );
    const record = (await queued(item.id))[0];
    try {
      await query('UPDATE roles SET permissions=$2 WHERE id=$1', [role, ['*']]);
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          inDatabaseTransaction((client) =>
            retryEmail(
              client,
              who(),
              'invitation',
              record.id,
              'Reviewed synthetic provider outage',
            ),
          ),
        ),
      );
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect((await queued(item.id))[0]).toMatchObject({ status: 'queued', attempts: 0 });
      expect(
        (
          await query(
            "SELECT id FROM audit_events WHERE entity_id=$1 AND action='operations.email.retry'",
            [record.id],
          )
        ).rows,
      ).toHaveLength(1);
      await query(
        "UPDATE invitation_email_outbox SET status='failed_terminal',last_error='INVITATION_CREDENTIAL_INVALID' WHERE id=$1",
        [record.id],
      );
      await expect(
        inDatabaseTransaction((client) =>
          retryEmail(client, who(), 'invitation', record.id, 'Investigating corrupt credential'),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    } finally {
      await query('UPDATE roles SET permissions=$2 WHERE id=$1', [role, ['member.invite']]);
    }
  });

  it('never redirects an encrypted invitation to a changed recipient', async () => {
    const item = await invite();
    const sender = send();
    await query('UPDATE user_invitations SET email=$2 WHERE id=$1', [
      item.id,
      crypto.randomUUID() + '@integration.test',
    ]);
    await processInvitationEmails(sender, 1, item.id);
    expect(sender).not.toHaveBeenCalled();
    expect((await queued(item.id))[0]).toMatchObject({
      status: 'suppressed',
      token_ciphertext: null,
    });
  });
  it('scrubs expired credentials even when delivery is disabled', async () => {
    const item = await invite();
    delivery.enabled = false;
    await query("UPDATE user_invitations SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [
      item.id,
    ]);
    await processInvitationEmails(undefined, 1, item.id);
    expect((await queued(item.id))[0]).toMatchObject({
      status: 'suppressed',
      token_ciphertext: null,
    });
  });
  it('queues first-admin approval delivery in the organization approval transaction', async () => {
    const tag = crypto.randomUUID();
    const appId = (
      await query(
        `INSERT INTO organization_access_applications
      (organization_name,organization_type,jurisdiction,admin_name,admin_email,status,verification_expires_at,email_verified_at)
      VALUES($1,'supplier','GH','Synthetic admin',$2,'pending_review',NOW()+INTERVAL '1 day',NOW()) RETURNING id`,
        ['Outbox approval ' + tag, tag + '@integration.test'],
      )
    ).rows[0].id;
    let targetOrg: string | undefined;
    try {
      await query('UPDATE roles SET permissions=$2 WHERE id=$1', [role, ['*']]);
      const bearer = token();
      const result = await new PostgresOrganizationAccessRepository().approve({
        id: appId,
        actor: { ...who(), permissions: ['*'] },
        invitationTokenHash: invitationTokenHash(bearer),
        invitationToken: bearer,
        invitationExpiresAt: new Date(Date.now() + 86400000),
      });
      targetOrg = result.organizationId;
      const rows = await queued(result.invitationId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: 'queued', actor_user_id: user });
      expect(JSON.stringify(rows)).not.toContain(bearer);
      expect(
        (
          await query(
            "SELECT id FROM audit_events WHERE action='member.invitation_email_queued' AND entity_id=$1",
            [result.invitationId],
          )
        ).rows,
      ).toHaveLength(1);
    } finally {
      await query('UPDATE roles SET permissions=$2 WHERE id=$1', [role, ['member.invite']]);
      await query('DELETE FROM organization_access_applications WHERE id=$1', [appId]);
      if (targetOrg)
        await query('DELETE FROM user_invitations WHERE organization_id=$1', [targetOrg]);
    }
  });
});
