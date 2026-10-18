import { processFeeStatementEmails } from '../../src/modules/feeStatementDelivery/service';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { getClient, pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';
import { inDatabaseTransaction } from '../../src/services/databaseTransaction';
import { processPaymentReminderEmails } from '../../src/modules/payments/reminders';
import { processRecallEmails } from '../../src/modules/recall/notifications';
import { emailOutboxes, retryEmail, type EmailQueue } from '../../src/modules/operations/recovery';
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

const queues: EmailQueue[] = ['payment_reminder', 'recall', 'fee_statement'];
const explanation = 'SMTP incident investigated and corrected';
const retry = (
  queue: EmailQueue,
  id: string,
  who = admin,
  body: Record<string, unknown> = { reason: explanation },
) =>
  request(app)
    .post(`/operations/email/${queue}/${id}/retry`)
    .set('Authorization', `Bearer ${who.token}`)
    .send(body);
async function terminal(queue: EmailQueue) {
  let parent: string;
  if (queue === 'recall') {
    parent = (
      await query(
        `INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,initiated_by_user_id,initiated_by_organization_id)
      VALUES($1,'Private recall title','Private reason','Private instructions','warning',$2,$3) RETURNING id`,
        [crypto.randomUUID(), admin.id, admin.organizationId],
      )
    ).rows[0].id;
  } else {
    const batch = (
      await query(
        `INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country)
      VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','Recovery fixture','GH') RETURNING id`,
        [admin.organizationId],
      )
    ).rows[0].id;
    const holding = (
      await query(
        'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id',
        [batch, admin.organizationId],
      )
    ).rows[0].id;
    const listing = (
      await query(
        `INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location)
      VALUES($1,$2,10,5,'EUR','FOB','Tema','Rotterdam') RETURNING id`,
        [admin.organizationId, holding],
      )
    ).rows[0].id;
    const offer = (
      await query(
        `INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until)
      VALUES($1,$2,4,5,'EUR',NOW()+INTERVAL '1 day') RETURNING id`,
        [listing, ordinary.organizationId],
      )
    ).rows[0].id;
    const contract = (
      await query(
        `INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg)
      VALUES($1,$2,$3,$4,$5,4,5) RETURNING id`,
        [listing, offer, admin.organizationId, ordinary.organizationId, holding],
      )
    ).rows[0].id;
    if (queue === 'fee_statement') {
      parent = (
        await query(
          `INSERT INTO platform_fee_invoices(contract_id,fee_payer,payer_organization_id,policy_version,rate_bps,amount_total,currency,currency_minor_units,status,invoiced_at,due_at)
        VALUES($1,'seller',$2,'seller-completion-v2',200,1,'EUR',2,'invoiced',NOW(),NOW()) RETURNING id`,
          [contract, admin.organizationId],
        )
      ).rows[0].id;
    } else {
      const payment = (
        await query(
          'INSERT INTO payment_requests(contract_id,requested_by_organization_id,amount_total) VALUES($1,$2,20) RETURNING id',
          [contract, admin.organizationId],
        )
      ).rows[0].id;
      const installment = (
        await query(
          `INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger)
      VALUES($1,'balance',1,20,'delivery') RETURNING id`,
          [payment],
        )
      ).rows[0].id;
      parent = (
        await query(
          `INSERT INTO payment_reminders(payment_request_id,installment_id,recipient_organization_id,reminder_date)
      VALUES($1,$2,$3,CURRENT_DATE) RETURNING id`,
          [payment, installment, ordinary.organizationId],
        )
      ).rows[0].id;
    }
  }
  return (
    await query(
      `INSERT INTO ${emailOutboxes[queue]}(${queue === 'recall' ? 'recall_id' : queue === 'fee_statement' ? 'fee_id' : 'reminder_id'},recipient_user_id,status,attempts,last_error${queue === 'recall' ? ',exhausted_at' : ''})
    VALUES($1,$2,'failed_terminal',8,'SMTP_SUBMISSION_FAILED'${queue === 'recall' ? ',NOW()' : ''}) RETURNING id`,
      [parent, ordinary.id],
    )
  ).rows[0].id as string;
}
const row = async (queue: EmailQueue, id: string) =>
  (await query(`SELECT * FROM ${emailOutboxes[queue]} WHERE id=$1`, [id])).rows[0];
const audits = async (id: string) =>
  (
    await query(
      "SELECT * FROM audit_events WHERE action='operations.email.retry' AND entity_id=$1",
      [id],
    )
  ).rows;
beforeAll(async () => {
  // Other suites retain fixtures in this disposable database. Isolate the
  // global delivery workers before testing eligibility for this suite's rows.
  for (const table of Object.values(emailOutboxes)) {
    await query(`UPDATE ${table} SET status='suppressed',lease_token=NULL,lease_expires_at=NULL
      WHERE status IN ('queued','failed','sending')`);
  }
  admin = await actor(true);
  ordinary = await actor(false);
});
afterAll(async () => {
  await pool.end();
});

describe.each(queues)('%s reviewed email recovery', (queue) => {
  it('denies unauthenticated and ordinary reads and writes; validates queue, ID and explanation', async () => {
    const id = await terminal(queue),
      path = `/operations/email/${queue}/dead`;
    expect((await request(app).get(path)).status).toBe(401);
    expect(
      (await request(app).get(path).set('Authorization', `Bearer ${ordinary.token}`)).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/operations/email/${queue}/${id}/retry`)
          .send({ reason: explanation })
      ).status,
    ).toBe(401);
    expect((await retry(queue, id, ordinary)).status).toBe(403);
    for (const body of [
      { reason: 'short' },
      { reason: ' '.repeat(20) },
      { reason: 'x'.repeat(501) },
      { reason: explanation, recipient: 'override' },
    ])
      expect((await retry(queue, id, admin, body)).status).toBe(400);
    expect((await retry(queue, 'invalid')).status).toBe(400);
    expect((await retry(queue, crypto.randomUUID())).status).toBe(404);
    expect(
      (
        await request(app)
          .get('/operations/email/arbitrary/dead')
          .set('Authorization', `Bearer ${admin.token}`)
      ).status,
    ).toBe(400);
    expect((await row(queue, id)).status).toBe('failed_terminal');
    expect(await audits(id)).toHaveLength(0);
  });
  it('requeues exactly once under concurrent operators and preserves recipient and business identity', async () => {
    const id = await terminal(queue),
      before = await row(queue, id);
    expect(
      (await Promise.all([retry(queue, id), retry(queue, id)])).map((r) => r.status).sort(),
    ).toEqual([200, 409]);
    const after = await row(queue, id);
    expect(after).toMatchObject({
      status: 'queued',
      attempts: 0,
      last_error: null,
      lease_token: null,
      lease_expires_at: null,
      sent_at: null,
      recipient_user_id: before.recipient_user_id,
      created_at: before.created_at,
    });
    expect(
      after[
        queue === 'recall' ? 'recall_id' : queue === 'fee_statement' ? 'fee_id' : 'reminder_id'
      ],
    ).toBe(
      before[
        queue === 'recall' ? 'recall_id' : queue === 'fee_statement' ? 'fee_id' : 'reminder_id'
      ],
    );
    if (queue === 'recall') expect(after.exhausted_at).toBeNull();
    expect(await audits(id)).toMatchObject([
      {
        actor_user_id: admin.id,
        metadata: {
          reason: explanation,
          queue,
          previousAttempts: 8,
          previousErrorCode: 'SMTP_SUBMISSION_FAILED',
        },
      },
    ]);
    await query(`UPDATE ${emailOutboxes[queue]} SET status='suppressed' WHERE id=$1`, [id]);
  });
  it.each(['queued', 'sending', 'sent', 'suppressed', 'failed'])(
    'refuses %s state without an audit',
    async (status) => {
      const id = await terminal(queue);
      await query(`UPDATE ${emailOutboxes[queue]} SET status=$2 WHERE id=$1`, [id, status]);
      expect((await retry(queue, id)).status).toBe(409);
      expect(await audits(id)).toHaveLength(0);
      await query(`UPDATE ${emailOutboxes[queue]} SET status='suppressed' WHERE id=$1`, [id]);
    },
  );
  it('refuses terminal records carrying a lease or recorded submission', async () => {
    // The fee queue enforces paired lease fields; older queues can also
    // contain a lone token or expiry, which recovery must still refuse.
    const leases =
      queue === 'fee_statement'
        ? ["lease_token=gen_random_uuid(),lease_expires_at=NOW()+INTERVAL '1 minute'"]
        : ['lease_token=gen_random_uuid()', "lease_expires_at=NOW()+INTERVAL '1 minute'"];
    for (const assignment of ['sent_at=NOW()', ...leases]) {
      const id = await terminal(queue);
      await query(`UPDATE ${emailOutboxes[queue]} SET ${assignment} WHERE id=$1`, [id]);
      expect((await retry(queue, id)).status).toBe(409);
      expect(await audits(id)).toHaveLength(0);
    }
  });
  it('requires fresh assurance and rechecks revoked authority inside the transaction', async () => {
    const id = await terminal(queue);
    await query("UPDATE sessions SET mfa_verified_at=NOW()-INTERVAL '6 minutes' WHERE id=$1", [
      admin.sessionId,
    ]);
    try {
      const response = await retry(queue, id);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('MFA_STEP_UP_REQUIRED');
    } finally {
      await query('UPDATE sessions SET mfa_verified_at=NOW() WHERE id=$1', [admin.sessionId]);
    }
    for (const [change, restore, args] of [
      [
        'UPDATE sessions SET revoked_at=NOW() WHERE id=$1',
        'UPDATE sessions SET revoked_at=NULL WHERE id=$1',
        [admin.sessionId],
      ],
      [
        "UPDATE sessions SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",
        "UPDATE sessions SET expires_at=NOW()+INTERVAL '1 day' WHERE id=$1",
        [admin.sessionId],
      ],
      [
        'UPDATE users SET access_suspended_at=NOW() WHERE id=$1',
        'UPDATE users SET access_suspended_at=NULL WHERE id=$1',
        [admin.id],
      ],
      [
        'UPDATE organizations SET access_suspended_at=NOW() WHERE id=$1',
        'UPDATE organizations SET access_suspended_at=NULL WHERE id=$1',
        [admin.organizationId],
      ],
      [
        "UPDATE roles SET permissions=ARRAY['batch.read'] WHERE id IN (SELECT role_id FROM user_roles WHERE user_id=$1)",
        "UPDATE roles SET permissions=ARRAY['*'] WHERE id IN (SELECT role_id FROM user_roles WHERE user_id=$1)",
        [admin.id],
      ],
    ] as const) {
      await query(change, [...args]);
      try {
        await expect(
          inDatabaseTransaction((client) => retryEmail(client, admin, queue, id, explanation)),
        ).rejects.toThrow();
      } finally {
        await query(restore, [...args]);
      }
    }
    expect((await row(queue, id)).status).toBe('failed_terminal');
    expect(await audits(id)).toHaveLength(0);
  });
  it('observes suspension committed while recovery is waiting for identity locks', async () => {
    const id = await terminal(queue);
    const blocker = await getClient(),
      recovering = await getClient();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [admin.id]);
      await recovering.query('BEGIN');
      const pid = (await recovering.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      // Attach rejection handling immediately so a failed assertion cannot leak a rejection.
      pending = retryEmail(recovering, admin, queue, id, explanation).then(
        () => null,
        (error) => error,
      );
      await expect
        .poll(
          async () =>
            (await query('SELECT cardinality(pg_blocking_pids($1)) AS n', [pid])).rows[0].n,
        )
        .toBeGreaterThan(0);
      await blocker.query('UPDATE users SET access_suspended_at=NOW() WHERE id=$1', [admin.id]);
      await blocker.query('COMMIT');
      expect(await pending).toBeInstanceOf(Error);
    } finally {
      await blocker.query('ROLLBACK');
      await pending;
      await recovering.query('ROLLBACK');
      blocker.release();
      recovering.release();
      await query('UPDATE users SET access_suspended_at=NULL WHERE id=$1', [admin.id]);
    }
    expect((await row(queue, id)).status).toBe('failed_terminal');
    expect(await audits(id)).toHaveLength(0);
  });
  it('rolls back the state transition if the audit insert fails', async () => {
    const id = await terminal(queue);
    await expect(
      inDatabaseTransaction(async (client) => {
        // Transaction-local database trigger fails only this record's audit.
        await client.query(`CREATE FUNCTION pg_temp.reject_email_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.entity_id='${id}'::uuid THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`);
        await client.query(
          'CREATE TRIGGER reject_email_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_email_audit()',
        );
        await retryEmail(client, admin, queue, id, explanation);
      }),
    ).rejects.toThrow('injected audit failure');
    expect((await row(queue, id)).status).toBe('failed_terminal');
    expect((await row(queue, id)).attempts).toBe(8);
    expect(await audits(id)).toHaveLength(0);
  });
  it('returns at most fifty deterministic redacted records and uses the terminal index', async () => {
    for (let i = 0; i < 51; i++) await terminal(queue);
    const id = await terminal(queue);
    await query(
      `UPDATE ${emailOutboxes[queue]} SET last_error='private@example.test provider payload' WHERE id=$1`,
      [id],
    );
    const response = await request(app)
      .get(`/operations/email/${queue}/dead`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.more).toBe(true);
    expect(response.body.items).toHaveLength(50);
    const ids = response.body.items.map((item: { id: string }) => item.id);
    expect(ids).toEqual([...ids].sort());
    for (const item of response.body.items)
      expect(Object.keys(item).sort()).toEqual([
        'attempts',
        'created_at',
        'id',
        'last_error_code',
        'retryable',
        'status',
      ]);
    expect(JSON.stringify(response.body)).not.toMatch(
      /recipient|private@|Private recall|provider payload/,
    );
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan=off');
      const plan = await client.query(
        `EXPLAIN SELECT id,status,attempts,last_error,created_at FROM ${emailOutboxes[queue]} WHERE status='failed_terminal' ORDER BY id LIMIT 51`,
      );
      expect(JSON.stringify(plan.rows)).toContain(
        queue === 'recall'
          ? 'recall_email_terminal_operator'
          : queue === 'fee_statement'
            ? 'fee_statement_email_terminal'
            : 'payment_reminder_terminal_operator',
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('leaves delivery eligibility with the existing worker after a reviewed retry', async () => {
    const id = await terminal(queue);
    expect((await retry(queue, id)).status).toBe(200);
    const sender = {
      healthcheck: async () => {},
      send: async () => {
        throw new Error('Ineligible email must not be sent');
      },
    };
    if (queue === 'recall') {
      await query('UPDATE users SET active=false WHERE id=$1', [ordinary.id]);
      try {
        await processRecallEmails(sender, 1);
      } finally {
        await query('UPDATE users SET active=true WHERE id=$1', [ordinary.id]);
      }
    } else if (queue === 'fee_statement') {
      await query('UPDATE users SET active=false WHERE id=$1', [ordinary.id]);
      try {
        await processFeeStatementEmails(sender, 1);
      } finally {
        await query('UPDATE users SET active=true WHERE id=$1', [ordinary.id]);
      }
    } else {
      await processPaymentReminderEmails(sender, 1);
    }
    expect((await row(queue, id)).status).toBe('suppressed');
  });
});

describe.each(queues)('%s backlog delivery state visibility', (queue) => {
  it('observes overdue retries and missing sending leases without recipient metadata or queue mutation', async () => {
    const pending = await terminal(queue),
      sending = await terminal(queue);
    try {
      await query(
        `UPDATE ${emailOutboxes[queue]} SET status='failed',attempts=1,next_attempt_at=NOW()-INTERVAL '1 hour' WHERE id=$1`,
        [pending],
      );
      await query(
        `UPDATE ${emailOutboxes[queue]} SET status='sending',lease_token=NULL,lease_expires_at=NULL WHERE id=$1`,
        [sending],
      );
      const response = await request(app)
        .get('/operations/backlog')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      const signal = response.body.queues.find((item: { name: string }) => item.name === queue);
      expect(signal.queued.count).toBeGreaterThan(0);
      expect(signal.expiredLeasesObserved).toBeGreaterThan(0);
      expect(signal.incidents).toEqual(expect.arrayContaining(['EXPIRED_LEASE', 'OVERDUE_WORK']));
      expect(JSON.stringify(response.body)).not.toMatch(
        /recipient|private@|object_key|storage_key|last_error/,
      );
      expect((await row(queue, pending)).status).toBe('failed');
      expect((await row(queue, sending)).status).toBe('sending');
    } finally {
      await query(
        `UPDATE ${emailOutboxes[queue]} SET status='suppressed',lease_token=NULL,lease_expires_at=NULL WHERE id=ANY($1::uuid[])`,
        [[pending, sending]],
      );
    }
  });
});
