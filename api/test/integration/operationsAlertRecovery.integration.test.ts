import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import { getClient, pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { inDatabaseTransaction } from '../../src/services/databaseTransaction';
import { retryOperatorAlert } from '../../src/modules/operations/alertRecovery';
import { authenticator } from '../../src/testing/webauthnFixture';
const alertSettings = vi.hoisted(() => ({ enabled: false, recipientUserIds: [] as string[] }));
vi.mock('../../src/modules/operations/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/modules/operations/alerts')>();
  return { ...actual, alertOptions: () => ({ ...alertSettings }) };
});

type Actor = { id: string; organizationId: string; sessionId: string; token: string };
let admin: Actor, ordinary: Actor, recipient: Actor;
async function actor(privileged: boolean): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Operations ' + tag],
    )
  ).rows[0].id;
  const id = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,'Operations test') RETURNING id",
      [org, tag + '@integration.test', await bcrypt.hash('OperationsFixture123!', 4)],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'ops-' + tag,
      privileged ? ['*'] : ['batch.read'],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [id, role]);
  const session = await createSession(id);
  if (privileged) {
    const device = authenticator();
    const options = await request(app)
      .post('/auth/mfa/registration/options')
      .set('Authorization', `Bearer ${session.token}`)
      .send({ currentPassword: 'OperationsFixture123!' });
    expect(options.status, JSON.stringify(options.body)).toBe(200);
    const verified = await request(app)
      .post('/auth/mfa/registration/verify')
      .set('Authorization', `Bearer ${session.token}`)
      .send({
        response: device.registration(options.body.challenge),
        label: 'Operations regression authenticator',
      });
    expect(verified.status, JSON.stringify(verified.body)).toBe(200);
  }
  return { id, organizationId: org, sessionId: session.actor.sessionId, token: session.token };
}

const explanation = 'Alert transport incident investigated and corrected';
const initial = {
  enabled: alertSettings.enabled,
  recipients: alertSettings.recipientUserIds,
};
const options = () => ({
  enabled: alertSettings.enabled,
  recipientUserIds: alertSettings.recipientUserIds,
});
const key = 'queue:recall:TERMINAL_WORK_PENDING';
async function reset() {
  await query('TRUNCATE operations_alert_outbox,operations_incidents,operations_alert_status');
}
async function terminal() {
  const incident = (
    await query(
      "INSERT INTO operations_incidents(signal_key) VALUES($1) ON CONFLICT(signal_key) WHERE state='open' DO UPDATE SET last_observed_at=NOW() RETURNING id",
      [key],
    )
  ).rows[0].id;
  return (
    await query(
      "INSERT INTO operations_alert_outbox(incident_id,recipient_user_id,status,attempts,last_error_code) VALUES($1,$2,'failed_terminal',8,'SMTP_SUBMISSION_FAILED') RETURNING id",
      [incident, recipient.id],
    )
  ).rows[0].id as string;
}
const row = async (id: string) =>
  (await query('SELECT * FROM operations_alert_outbox WHERE id=$1', [id])).rows[0];
const audits = async (id: string) =>
  (
    await query(
      "SELECT * FROM audit_events WHERE action='operations.alert.retry' AND entity_id=$1",
      [id],
    )
  ).rows;
const retry = (id: string, who = admin, body: Record<string, unknown> = { reason: explanation }) =>
  request(app)
    .post(`/operations/alerts/${id}/retry`)
    .set('Authorization', `Bearer ${who.token}`)
    .send(body);
const read = (who = admin) =>
  request(app).get('/operations/alerts/dead').set('Authorization', `Bearer ${who.token}`);
beforeAll(async () => {
  admin = await actor(true);
  ordinary = await actor(false);
  recipient = await actor(true);
});
beforeEach(async () => {
  await reset();
  alertSettings.enabled = true;
  alertSettings.recipientUserIds = [recipient.id];
});
afterAll(async () => {
  alertSettings.enabled = initial.enabled;
  alertSettings.recipientUserIds = initial.recipients;
  await reset();
  await pool.end();
});
describe('reviewed terminal operator alert recovery', () => {
  it('denies anonymous/ordinary reads and writes, rejects unreviewed overrides and returns private metadata', async () => {
    const id = await terminal();
    expect((await request(app).get('/operations/alerts/dead')).status).toBe(401);
    expect(
      (await request(app).post(`/operations/alerts/${id}/retry`).send({ reason: explanation }))
        .status,
    ).toBe(401);
    expect((await read(ordinary)).status).toBe(403);
    expect((await retry(id, ordinary)).status).toBe(403);
    for (const body of [
      { reason: 'short' },
      { reason: ' '.repeat(20) },
      { reason: 'x'.repeat(501) },
      { reason: explanation, recipientUserId: admin.id },
      { reason: explanation, incidentId: crypto.randomUUID() },
    ])
      expect((await retry(id, admin, body)).status).toBe(400);
    expect((await retry('invalid')).status).toBe(400);
    expect((await retry(crypto.randomUUID())).status).toBe(404);
    expect(
      (
        await request(app)
          .get('/operations/alerts/dead?limit=1000')
          .set('Authorization', `Bearer ${admin.token}`)
      ).status,
    ).toBe(400);
    const response = await read();
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ id, retryable: true });
    expect(Object.keys(response.body.items[0]).sort()).toEqual([
      'attempts',
      'created_at',
      'id',
      'last_error_code',
      'retryable',
      'status',
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(
      /recipient|@|signal_key|incident_id|lease_token/,
    );
    expect(await audits(id)).toHaveLength(0);
  });
  it('serializes concurrent reviews into one queued record and atomic actor-attributed audit', async () => {
    const id = await terminal(),
      before = await row(id);
    const responses = await Promise.all([retry(id), retry(id)]);
    expect(responses.map((value) => value.status).sort()).toEqual([200, 409]);
    expect(await row(id)).toMatchObject({
      id,
      status: 'queued',
      attempts: 0,
      last_error_code: null,
      sent_at: null,
      lease_token: null,
      lease_expires_at: null,
      incident_id: before.incident_id,
      recipient_user_id: before.recipient_user_id,
      created_at: before.created_at,
    });
    expect(await audits(id)).toMatchObject([
      {
        actor_user_id: admin.id,
        actor_organization_id: admin.organizationId,
        metadata: {
          reason: explanation,
          previousAttempts: 8,
          previousErrorCode: 'SMTP_SUBMISSION_FAILED',
        },
      },
    ]);
  });
  it.each(['queued', 'sending', 'sent', 'suppressed', 'failed'])(
    'refuses %s work without a retry audit',
    async (status) => {
      const id = await terminal();
      await query('UPDATE operations_alert_outbox SET status=$2 WHERE id=$1', [id, status]);
      expect((await retry(id)).status).toBe(409);
      expect(await audits(id)).toHaveLength(0);
    },
  );
  it.each([
    'sent_at=NOW()',
    'lease_token=gen_random_uuid()',
    "lease_expires_at=NOW()-INTERVAL '1 minute'",
    "last_error_code='INCONSISTENT_SUBMISSION'",
    "last_error_code='PRIVATE_PROVIDER_SECRET'",
  ])('refuses unsafe terminal field %s and redacts unknown errors', async (assignment) => {
    const id = await terminal();
    await query(`UPDATE operations_alert_outbox SET ${assignment} WHERE id=$1`, [id]);
    expect((await retry(id)).status).toBe(409);
    expect(await audits(id)).toHaveLength(0);
    const response = await read();
    expect(response.status).toBe(200);
    expect(response.body.items[0].retryable).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_PROVIDER_SECRET');
  });
  it('refuses disabled, withdrawn and resolved-incident recovery without changing the original target', async () => {
    const id = await terminal();
    alertSettings.enabled = false;
    expect((await retry(id)).status).toBe(409);
    expect((await read()).body.items[0].retryable).toBe(false);
    alertSettings.enabled = true;
    alertSettings.recipientUserIds = [admin.id];
    expect((await retry(id)).status).toBe(409);
    alertSettings.recipientUserIds = [recipient.id];
    await query("UPDATE operations_incidents SET state='resolved',resolved_at=NOW() WHERE id=$1", [
      (await row(id)).incident_id,
    ]);
    expect((await retry(id)).status).toBe(409);
    expect((await read()).body.items[0].retryable).toBe(false);
    expect((await row(id)).recipient_user_id).toBe(recipient.id);
    expect(await audits(id)).toHaveLength(0);
  });
  it.each(['user', 'organization', 'role'] as const)(
    'rechecks current recipient %s eligibility before requeue',
    async (scope) => {
      const id = await terminal();
      const [change, restore, args] =
        scope === 'user'
          ? [
              'UPDATE users SET access_suspended_at=NOW() WHERE id=$1',
              'UPDATE users SET access_suspended_at=NULL WHERE id=$1',
              [recipient.id],
            ]
          : scope === 'organization'
            ? [
                'UPDATE organizations SET access_suspended_at=NOW() WHERE id=$1',
                'UPDATE organizations SET access_suspended_at=NULL WHERE id=$1',
                [recipient.organizationId],
              ]
            : [
                'UPDATE roles SET permissions=ARRAY[]::text[] WHERE id IN(SELECT role_id FROM user_roles WHERE user_id=$1)',
                "UPDATE roles SET permissions=ARRAY['*']::text[] WHERE id IN(SELECT role_id FROM user_roles WHERE user_id=$1)",
                [recipient.id],
              ];
      await query(change, args);
      try {
        expect((await retry(id)).status).toBe(409);
        expect((await read()).body.items[0].retryable).toBe(false);
      } finally {
        await query(restore, args);
      }
      expect(await audits(id)).toHaveLength(0);
    },
  );
  it('requires fresh assurance and rechecks revoked actor authority inside the mutation', async () => {
    const id = await terminal();
    await query("UPDATE sessions SET mfa_verified_at=NOW()-INTERVAL '6 minutes' WHERE id=$1", [
      admin.sessionId,
    ]);
    try {
      const response = await retry(id);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('MFA_STEP_UP_REQUIRED');
    } finally {
      await query('UPDATE sessions SET mfa_verified_at=NOW() WHERE id=$1', [admin.sessionId]);
    }
    await query('UPDATE sessions SET revoked_at=NOW() WHERE id=$1', [admin.sessionId]);
    try {
      await expect(
        inDatabaseTransaction((client) =>
          retryOperatorAlert(client, admin, id, explanation, options()),
        ),
      ).rejects.toThrow();
    } finally {
      await query('UPDATE sessions SET revoked_at=NULL WHERE id=$1', [admin.sessionId]);
    }
    expect((await row(id)).status).toBe('failed_terminal');
    expect(await audits(id)).toHaveLength(0);
  });
  it('observes recipient suspension committed while waiting for its identity lock', async () => {
    const id = await terminal(),
      blocker = await getClient(),
      recovering = await getClient();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [recipient.id]);
      await recovering.query('BEGIN');
      const pid = (await recovering.query('SELECT pg_backend_pid() pid')).rows[0].pid;
      pending = retryOperatorAlert(recovering, admin, id, explanation, options()).then(
        () => null,
        (error) => error,
      );
      await expect
        .poll(
          async () => (await query('SELECT cardinality(pg_blocking_pids($1)) n', [pid])).rows[0].n,
        )
        .toBeGreaterThan(0);
      await blocker.query('UPDATE users SET access_suspended_at=NOW() WHERE id=$1', [recipient.id]);
      await blocker.query('COMMIT');
      expect(await pending).toBeInstanceOf(Error);
    } finally {
      await blocker.query('ROLLBACK');
      await pending;
      await recovering.query('ROLLBACK');
      blocker.release();
      recovering.release();
      await query('UPDATE users SET access_suspended_at=NULL WHERE id=$1', [recipient.id]);
    }
    expect((await row(id)).status).toBe('failed_terminal');
    expect(await audits(id)).toHaveLength(0);
  });
  it('rolls back requeueing when the audit write fails', async () => {
    const id = await terminal();
    await expect(
      inDatabaseTransaction(async (client) => {
        await client.query(
          `CREATE FUNCTION pg_temp.reject_operator_alert_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${id}'::uuid THEN RAISE EXCEPTION 'injected operator alert audit failure'; END IF; RETURN NEW; END $$`,
        );
        await client.query(
          'CREATE TRIGGER reject_operator_alert_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_operator_alert_audit()',
        );
        await retryOperatorAlert(client, admin, id, explanation, options());
      }),
    ).rejects.toThrow('injected operator alert audit failure');
    expect(await row(id)).toMatchObject({ status: 'failed_terminal', attempts: 8 });
    expect(await audits(id)).toHaveLength(0);
  });
  it('caps terminal metadata at fifty deterministic records before eligibility hydration', async () => {
    await query(
      `WITH incidents AS(INSERT INTO operations_incidents(signal_key,state,resolved_at) SELECT $1,'resolved',NOW() FROM generate_series(1,51) RETURNING id)
      INSERT INTO operations_alert_outbox(incident_id,recipient_user_id,status,attempts,last_error_code) SELECT id,$2,'failed_terminal',8,'LEASE_EXPIRED' FROM incidents`,
      [key, recipient.id],
    );
    const response = await read();
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.items).toHaveLength(50);
    expect(response.body.more).toBe(true);
    const ids = response.body.items.map((item: { id: string }) => item.id);
    expect(ids).toEqual([...ids].sort());
    expect(
      response.body.items.every((item: { retryable: boolean }) => item.retryable === false),
    ).toBe(true);
  });
});
