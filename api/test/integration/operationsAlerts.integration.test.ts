import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import { getClient, pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { authenticator } from '../../src/testing/webauthnFixture';
import { deliverAlerts, runAlertCycle, syncIncidents } from '../../src/modules/operations/alerts';
let operator: { id: string; organizationId: string; roleId: string; token: string };
let ordinaryToken: string;
const key = 'queue:recall:TERMINAL_WORK_PENDING';
async function actor(privileged: boolean) {
  const tag = crypto.randomUUID();
  const organizationId = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Alerts ' + tag],
    )
  ).rows[0].id;
  const id = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,'Alert operator') RETURNING id",
      [
        organizationId,
        'private-' + tag + '@integration.test',
        await bcrypt.hash('AlertsFixture123!', 4),
      ],
    )
  ).rows[0].id;
  const roleId = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'alert-' + tag,
      privileged ? ['*'] : ['batch.read'],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [id, roleId]);
  const session = await createSession(id);
  if (privileged) {
    const device = authenticator();
    const options = await request(app)
      .post('/auth/mfa/registration/options')
      .set('Authorization', `Bearer ${session.token}`)
      .send({ currentPassword: 'AlertsFixture123!' });
    expect(options.status, JSON.stringify(options.body)).toBe(200);
    const verified = await request(app)
      .post('/auth/mfa/registration/verify')
      .set('Authorization', `Bearer ${session.token}`)
      .send({
        response: device.registration(options.body.challenge),
        label: 'Alert regression authenticator',
      });
    expect(verified.status, JSON.stringify(verified.body)).toBe(200);
  }
  return { id, organizationId, roleId, token: session.token };
}
const options = () => ({ enabled: true, recipientUserIds: [operator.id] });
const sender = () => ({
  send: vi.fn(async () => ({ status: 'sent' as const })),
  healthcheck: async () => {},
});
async function reset() {
  await query('TRUNCATE operations_alert_outbox,operations_incidents,operations_alert_status');
}
beforeAll(async () => {
  operator = await actor(true);
  ordinaryToken = (await actor(false)).token;
});
beforeEach(async () => {
  await reset();
  await query('UPDATE users SET active=true,access_suspended_at=NULL WHERE id=$1', [operator.id]);
  await query(
    "UPDATE organizations SET access_suspended_at=NULL,verification_status='verified' WHERE id=$1",
    [operator.organizationId],
  );
  await query("UPDATE roles SET permissions=ARRAY['*']::text[] WHERE id=$1", [operator.roleId]);
});
afterAll(async () => {
  await reset();
  await pool.end();
});
describe('durable registered-operator incident alerts', () => {
  it('denies private status to ordinary/anonymous readers and does not expose contacts', async () => {
    expect((await request(app).get('/operations/alerts')).status).toBe(401);
    expect(
      (await request(app).get('/operations/alerts').set('Authorization', `Bearer ${ordinaryToken}`))
        .status,
    ).toBe(403);
    const status = await request(app)
      .get('/operations/alerts')
      .set('Authorization', `Bearer ${operator.token}`);
    expect(status.status, JSON.stringify(status.body)).toBe(200);
    expect(status.headers['cache-control']).toBe('no-store');
    expect(status.body).toMatchObject({ enabled: false, healthy: false, observation: null });
    expect(JSON.stringify(status.body)).not.toMatch(/private-|@|recipient_user_id/);
  });
  it('redacts unrecognized stored error codes in the private status response', async () => {
    await query(
      "INSERT INTO operations_alert_status(id,last_poll_at,error_code,consecutive_failures) VALUES(1,NOW(),'PRIVATE_PROVIDER_SECRET',1)",
    );
    const result = await request(app)
      .get('/operations/alerts')
      .set('Authorization', `Bearer ${operator.token}`);
    expect(result.status).toBe(200);
    expect(result.body.observation.error_code).toBe('UNKNOWN_ALERT_FAILURE');
    expect(JSON.stringify(result.body)).not.toContain('PRIVATE_PROVIDER_SECRET');
  });
  it('serializes concurrent detections into one episode and one alert and claims a single submission', async () => {
    await Promise.all([
      syncIncidents([key], true, [operator.id]),
      syncIncidents([key], true, [operator.id]),
    ]);
    expect(
      (await query('SELECT COUNT(*)::int count FROM operations_incidents')).rows[0].count,
    ).toBe(1);
    expect(
      (await query('SELECT COUNT(*)::int count FROM operations_alert_outbox')).rows[0].count,
    ).toBe(1);
    const delivery = sender();
    await Promise.all([deliverAlerts(options(), delivery), deliverAlerts(options(), delivery)]);
    expect(delivery.send).toHaveBeenCalledTimes(1);
    expect(
      (await query('SELECT status,attempts FROM operations_alert_outbox')).rows[0],
    ).toMatchObject({ status: 'sent', attempts: 1 });
    await syncIncidents([key], true, [operator.id]);
    await deliverAlerts(options(), delivery);
    expect(delivery.send).toHaveBeenCalledTimes(1);
  });
  it('preserves incidents on incomplete observation and starts a new episode after genuine recovery', async () => {
    await syncIncidents([key], true, [operator.id]);
    await syncIncidents(['monitor:operations:MONITOR_UNAVAILABLE'], false, [operator.id]);
    expect(
      (
        await query("SELECT id FROM operations_incidents WHERE signal_key=$1 AND state='open'", [
          key,
        ])
      ).rows,
    ).toHaveLength(1);
    await syncIncidents([], true, [operator.id]);
    expect(
      (await query("SELECT id FROM operations_incidents WHERE state='open'")).rows,
    ).toHaveLength(0);
    await syncIncidents([key], true, [operator.id]);
    expect(
      (await query('SELECT id FROM operations_incidents WHERE signal_key=$1', [key])).rows,
    ).toHaveLength(2);
  });
  it('does not deliver resolved or withdrawn alerts or count development suppression as SMTP submission', async () => {
    await syncIncidents([key], true, [operator.id]);
    await syncIncidents([], true, [operator.id]);
    const delivery = sender();
    await deliverAlerts(options(), delivery);
    expect(delivery.send).not.toHaveBeenCalled();
    await reset();
    await syncIncidents([key], true, [operator.id]);
    await deliverAlerts({ enabled: true, recipientUserIds: [crypto.randomUUID()] }, delivery);
    expect(delivery.send).not.toHaveBeenCalled();
    expect((await query('SELECT status FROM operations_alert_outbox')).rows[0].status).toBe(
      'suppressed',
    );
    await reset();
    await syncIncidents([key], true, [operator.id]);
    await deliverAlerts(options(), {
      send: async () => ({ status: 'suppressed' }),
      healthcheck: async () => {},
    });
    expect(
      (await query('SELECT status,sent_at,last_error_code FROM operations_alert_outbox')).rows[0],
    ).toMatchObject({ status: 'suppressed', sent_at: null, last_error_code: 'EMAIL_SUPPRESSED' });
  });
  it.each(['user', 'organization', 'role'] as const)(
    'rechecks %s authority before delivery',
    async (scope) => {
      await syncIncidents([key], true, [operator.id]);
      if (scope === 'user')
        await query('UPDATE users SET access_suspended_at=NOW() WHERE id=$1', [operator.id]);
      if (scope === 'organization')
        await query('UPDATE organizations SET access_suspended_at=NOW() WHERE id=$1', [
          operator.organizationId,
        ]);
      if (scope === 'role')
        await query('UPDATE roles SET permissions=ARRAY[]::text[] WHERE id=$1', [operator.roleId]);
      const delivery = sender();
      await deliverAlerts(options(), delivery);
      expect(delivery.send).not.toHaveBeenCalled();
      expect((await query('SELECT status FROM operations_alert_outbox')).rows[0].status).toBe(
        'suppressed',
      );
    },
  );
  it('retains generic retry errors, respects due times and reaches a finite terminal state', async () => {
    await syncIncidents([key], true, [operator.id]);
    const delivery = {
      send: vi.fn(async () => {
        throw new Error('private@example.test provider-secret');
      }),
      healthcheck: async () => {},
    };
    await deliverAlerts(options(), delivery);
    expect(
      (await query('SELECT status,attempts,last_error_code FROM operations_alert_outbox')).rows[0],
    ).toMatchObject({ status: 'failed', attempts: 1, last_error_code: 'SMTP_SUBMISSION_FAILED' });
    await deliverAlerts(options(), delivery);
    expect(delivery.send).toHaveBeenCalledTimes(1);
    await query(
      "UPDATE operations_alert_outbox SET attempts=7,next_attempt_at=NOW()-INTERVAL '1 second'",
    );
    await deliverAlerts(options(), delivery);
    expect(
      (await query('SELECT status,attempts FROM operations_alert_outbox')).rows[0],
    ).toMatchObject({ status: 'failed_terminal', attempts: 8 });
    expect(
      JSON.stringify((await query('SELECT last_error_code FROM operations_alert_outbox')).rows),
    ).not.toContain('provider-secret');
  });
  it('keeps durable work when SMTP health fails and does not consume a delivery attempt', async () => {
    await syncIncidents([key], true, [operator.id]);
    const client = await getClient();
    const delivery = {
      send: vi.fn(async () => ({ status: 'sent' as const })),
      healthcheck: async () => {
        throw new Error('private operator provider secret');
      },
    };
    try {
      expect(await runAlertCycle(client, options(), delivery)).toBe('failed');
      expect(delivery.send).not.toHaveBeenCalled();
      const records = await query(
        'SELECT attempts,status,last_error_code FROM operations_alert_outbox',
      );
      expect(records.rows.every((row) => row.attempts === 0 && row.status === 'queued')).toBe(true);
      const status = (await query('SELECT error_code FROM operations_alert_status')).rows[0];
      expect(status.error_code).not.toContain('private');
      expect(status.error_code).not.toBeNull();
    } finally {
      client.release();
    }
  });
  it('honors a held deployment lock and the durable one-minute polling cooldown', async () => {
    const first = await getClient(),
      second = await getClient();
    const delivery = sender();
    try {
      await first.query(
        "SELECT pg_advisory_lock(hashtextextended('bettertrade.operations.alert-cycle',0))",
      );
      expect(await runAlertCycle(second, options(), delivery)).toBe('busy');
      expect(delivery.send).not.toHaveBeenCalled();
      await first.query(
        "SELECT pg_advisory_unlock(hashtextextended('bettertrade.operations.alert-cycle',0))",
      );
      await runAlertCycle(second, options(), delivery);
      const sent = delivery.send.mock.calls.length;
      expect(sent).toBeLessThanOrEqual(4);
      expect(await runAlertCycle(second, options(), delivery)).toBe('busy');
      expect(delivery.send).toHaveBeenCalledTimes(sent);
    } finally {
      await first.query('SELECT pg_advisory_unlock_all()');
      first.release();
      second.release();
    }
  });
  it('recovers an expired claim without replaying already recorded submission', async () => {
    await syncIncidents([key], true, [operator.id]);
    await query(
      "UPDATE operations_alert_outbox SET status='sending',attempts=1,lease_token=$1,lease_expires_at=NOW()-INTERVAL '1 second'",
      [crypto.randomUUID()],
    );
    const delivery = sender();
    await deliverAlerts(options(), delivery);
    expect(delivery.send).toHaveBeenCalledTimes(1);
    await query("UPDATE operations_alert_outbox SET status='queued',next_attempt_at=NOW()");
    await deliverAlerts(options(), delivery);
    expect(delivery.send).toHaveBeenCalledTimes(1);
    expect(
      (await query('SELECT status,last_error_code FROM operations_alert_outbox')).rows[0],
    ).toMatchObject({ status: 'failed_terminal', last_error_code: 'INCONSISTENT_SUBMISSION' });
  });
});
