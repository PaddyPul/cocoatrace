import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { getClient, pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { inDatabaseTransaction } from '../../src/services/databaseTransaction';
import { runTrackedJob } from '../../src/modules/operations/jobs';
import { retryCleanup } from '../../src/modules/operations/recovery';
import { authenticator } from '../../src/testing/webauthnFixture';

type Actor = { id: string; organizationId: string; sessionId: string; token: string };
let admin: Actor, ordinary: Actor;
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
async function dead(code = 'MAX_ATTEMPTS_EXCEEDED') {
  return (
    await query(
      `INSERT INTO evidence_object_cleanup(object_key,organization_id,bytes,storage_provider,state,reason,attempts,last_error_code)
    VALUES($1,$2,100,'local','dead','upload_rejected',8,$3) RETURNING id`,
      ['quarantine/test/' + crypto.randomUUID(), admin.organizationId, code],
    )
  ).rows[0].id as string;
}
const retry = (id: string, who = admin) =>
  request(app)
    .post(`/operations/cleanup/${id}/retry`)
    .set('Authorization', `Bearer ${who.token}`)
    .send({ reason: 'Reviewed transient provider incident; retry safely' });
beforeAll(async () => {
  admin = await actor(true);
  ordinary = await actor(false);
});
afterAll(async () => {
  if (admin)
    await query('DELETE FROM evidence_object_cleanup WHERE organization_id=$1', [
      admin.organizationId,
    ]);
  await pool.end();
});

describe('scheduled operation ownership and audited recovery', () => {
  it('serializes deployment job execution and records success after the provider completes', async () => {
    const first = await getClient(),
      second = await getClient();
    let enter!: () => void, finish!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const running = runTrackedJob(first, {
      name: 'evidence_scan',
      run: async () => {
        enter();
        await gate;
        return {};
      },
    });
    try {
      await entered;
      expect(
        (await query("SELECT status FROM operations_job_status WHERE job_name='evidence_scan'"))
          .rows[0].status,
      ).toBe('running');
      expect(
        await runTrackedJob(second, {
          name: 'evidence_scan',
          run: async () => {
            throw new Error('must not execute');
          },
        }),
      ).toBe('busy');
      finish();
      expect(await running).toBe('succeeded');
      expect(
        (
          await query(
            "SELECT status,last_success_at,consecutive_failures FROM operations_job_status WHERE job_name='evidence_scan'",
          )
        ).rows[0],
      ).toMatchObject({ status: 'succeeded', consecutive_failures: 0 });
    } finally {
      finish();
      await running;
      first.release();
      second.release();
    }
  });
  it('keeps terminal work unhealthy across subsequent idle cycles', async () => {
    const client = await getClient();
    try {
      expect(
        await runTrackedJob(client, {
          name: 'evidence_cleanup',
          run: async () => ({ terminalFailures: 1 }),
        }),
      ).toBe('failed');
      expect(
        (
          await query(
            "SELECT error_code,consecutive_failures FROM operations_job_status WHERE job_name='evidence_cleanup'",
          )
        ).rows[0],
      ).toMatchObject({ error_code: 'TERMINAL_WORK_PENDING', consecutive_failures: 1 });
    } finally {
      client.release();
    }
  });
  it('denies unauthenticated and ordinary accounts without exposing queue keys', async () => {
    for (const path of ['/operations/status', '/operations/cleanup/dead']) {
      expect((await request(app).get(path)).status).toBe(401);
      expect(
        (await request(app).get(path).set('Authorization', `Bearer ${ordinary.token}`)).status,
      ).toBe(403);
    }
    const id = await dead();
    expect((await retry(id, ordinary)).status).toBe(403);
    const response = await request(app)
      .get('/operations/cleanup/dead')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(JSON.stringify(response.body)).not.toMatch(/object_key|organization_id|quarantine\//);
  });
  it('requeues once under concurrency, keeps quota charged and writes one audit', async () => {
    const id = await dead();
    const responses = await Promise.all([retry(id), retry(id)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const row = (
      await query('SELECT state,attempts,bytes FROM evidence_object_cleanup WHERE id=$1', [id])
    ).rows[0];
    expect(row).toMatchObject({ state: 'pending', attempts: 0, bytes: '100' });
    const events = (
      await query(
        "SELECT actor_user_id,metadata FROM audit_events WHERE entity_id=$1 AND action='operations.cleanup.retry'",
        [id],
      )
    ).rows;
    expect(events).toHaveLength(1);
    expect(events[0].actor_user_id).toBe(admin.id);
  });
  it.each(['LIVE_EVIDENCE_REFERENCE', 'INVALID_OBJECT_KEY', 'STORAGE_PROVIDER_MISMATCH'])(
    'refuses unsafe terminal reason %s',
    async (code) => {
      const id = await dead(code);
      expect((await retry(id)).status).toBe(409);
      expect(
        (await query('SELECT state FROM evidence_object_cleanup WHERE id=$1', [id])).rows[0].state,
      ).toBe('dead');
    },
  );
  it('rejects stale passkey assurance without requeueing terminal work', async () => {
    const id = await dead();
    await query("UPDATE sessions SET mfa_verified_at=NOW()-INTERVAL '6 minutes' WHERE id=$1", [
      admin.sessionId,
    ]);
    try {
      const response = await retry(id);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('MFA_STEP_UP_REQUIRED');
      expect(
        (await query('SELECT state FROM evidence_object_cleanup WHERE id=$1', [id])).rows[0].state,
      ).toBe('dead');
    } finally {
      await query('UPDATE sessions SET mfa_verified_at=NOW() WHERE id=$1', [admin.sessionId]);
    }
  });
  it('rolls recovery and audit back together and denies a revoked session inside the transaction', async () => {
    const id = await dead();
    await expect(
      inDatabaseTransaction(async (client) => {
        await retryCleanup(client, admin, id, 'Reviewed rollback fixture reason');
        throw new Error('rollback fixture');
      }),
    ).rejects.toThrow('rollback fixture');
    expect(
      (await query('SELECT state FROM evidence_object_cleanup WHERE id=$1', [id])).rows[0].state,
    ).toBe('dead');
    expect(
      (
        await query(
          "SELECT id FROM audit_events WHERE entity_id=$1 AND action='operations.cleanup.retry'",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
    await query('UPDATE sessions SET revoked_at=NOW() WHERE id=$1', [admin.sessionId]);
    await expect(
      inDatabaseTransaction((client) =>
        retryCleanup(client, admin, id, 'Reviewed stale actor fixture reason'),
      ),
    ).rejects.toThrow();
  });
});

describe('bounded private queue backlog observations', () => {
  // The preceding security suite intentionally revokes admin's session. Use a
  // separate enrolled identity; never revive that session to make reads pass.
  let backlogAdmin: Actor;
  beforeAll(async () => {
    backlogAdmin = await actor(true);
  });
  const read = (who = backlogAdmin) =>
    request(app).get('/operations/backlog').set('Authorization', `Bearer ${who.token}`);
  it('denies ordinary and unauthenticated readers and rejects unknown parameters', async () => {
    expect((await request(app).get('/operations/backlog')).status).toBe(401);
    expect((await read(admin)).status).toBe(401);
    expect((await read(ordinary)).status).toBe(403);
    expect((await read().query({ organization: ordinary.organizationId })).status).toBe(400);
  });
  it('caps metadata probes and identifies due, retrying, expired and terminal work without changing it', async () => {
    const keys = Array.from({ length: 1005 }, () => 'quarantine/test/' + crypto.randomUUID());
    await query(
      `INSERT INTO evidence_object_cleanup(object_key,organization_id,bytes,storage_provider,state,reason,attempts,next_attempt_at)
      SELECT key,$2,100,'local','pending','upload_rejected',3,NOW()-INTERVAL '1 hour' FROM unnest($1::text[]) AS key`,
      [keys, admin.organizationId],
    );
    const expired = (
      await query(
        `INSERT INTO evidence_object_cleanup(object_key,organization_id,bytes,storage_provider,state,reason,lease_token,lease_expires_at)
      VALUES($1,$2,100,'local','processing','upload_rejected',$3,NOW()-INTERVAL '1 minute') RETURNING id`,
        ['quarantine/test/' + crypto.randomUUID(), admin.organizationId, crypto.randomUUID()],
      )
    ).rows[0].id;
    await dead();
    const response = await read();
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.queues.map((row: { name: string }) => row.name)).toEqual([
      'cleanup',
      'payment_reminder',
      'recall',
      'fee_statement',
    ]);
    const cleanup = response.body.queues.find((row: { name: string }) => row.name === 'cleanup');
    expect(cleanup.queued).toEqual({ count: 1000, more: true });
    // Other suites share the disposable database; this observed subset need not contain our rows.
    expect(cleanup.retryingObserved).toBeGreaterThanOrEqual(0);
    expect(cleanup.retryingObserved).toBeLessThanOrEqual(1000);
    expect(cleanup.expiredLeasesObserved).toBeGreaterThanOrEqual(1);
    expect(cleanup.incidents).toEqual(
      expect.arrayContaining([
        'TERMINAL_WORK_PENDING',
        'EXPIRED_LEASE',
        'OVERDUE_WORK',
        'MONITOR_LIMIT_REACHED',
      ]),
    );
    expect(response.body.needsAttention).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(
      /object_key|organization_id|recipient|storage_provider|last_error|@/,
    );
    expect(
      (await query('SELECT state FROM evidence_object_cleanup WHERE id=$1', [expired])).rows[0]
        .state,
    ).toBe('processing');
    expect(
      (
        await query(
          "SELECT COUNT(*)::int AS count FROM evidence_object_cleanup WHERE object_key=ANY($1::text[]) AND state='pending'",
          [keys],
        )
      ).rows[0].count,
    ).toBe(1005);
  });
  it('returns explicit unavailable status on a blocked probe, then recovers after the lock is released', async () => {
    const blocker = await getClient();
    try {
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE evidence_object_cleanup IN ACCESS EXCLUSIVE MODE');
      const blocked = await read();
      expect(blocked.status, JSON.stringify(blocked.body)).toBe(503);
      expect(blocked.body.code).toBe('OPERATIONS_BACKLOG_UNAVAILABLE');
      expect(blocked.body.queues).toBeUndefined();
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    expect((await read()).status).toBe(200);
  });
});

describe('private process runtime metrics', () => {
  it('requires live administrator authority and returns bounded no-store observations', async () => {
    expect((await request(app).get('/operations/metrics')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/operations/metrics')
          .set('Authorization', `Bearer ${ordinary.token}`)
      ).status,
    ).toBe(403);
    const response = await request(app)
      .get('/operations/metrics')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.schemaVersion).toBe(1);
    expect(response.body.http.durationMs.buckets).toHaveLength(11);
    expect(Object.keys(response.body.pool).sort()).toEqual(['idle', 'total', 'waiting']);
    expect(JSON.stringify(response.body)).not.toContain(admin.organizationId);
    expect(JSON.stringify(response.body)).not.toContain(admin.token);
    const invalid = await request(app)
      .get('/operations/metrics?tenant=private')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(invalid.status).toBe(400);
    expect(invalid.headers['cache-control']).toBe('no-store');
  });
});
