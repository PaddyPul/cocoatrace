import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { authenticator } from '../../src/testing/webauthnFixture';
import { createActor, createSupply, type FixtureActor } from './support/fixtures';

const authorization = (actor: FixtureActor) => ({ Authorization: `Bearer ${actor.token}` });
let manager: FixtureActor, participant: FixtureActor, outsider: FixtureActor, network: FixtureActor;
let recallId: string, holdingId: string;
beforeAll(async () => {
  manager = await createActor({ type: 'exporter', permissions: ['recall.manage'] });
  participant = await createActor({ type: 'importer', permissions: [] });
  outsider = await createActor({ type: 'exporter', permissions: ['recall.manage'] });
  network = await createActor({ type: 'exporter', permissions: ['recall.manage.all'] });
  const device = authenticator();
  const options = await request(app)
    .post('/auth/mfa/registration/options')
    .set(authorization(network))
    .send({ currentPassword: network.password });
  expect(options.status, JSON.stringify(options.body)).toBe(200);
  const verified = await request(app)
    .post('/auth/mfa/registration/verify')
    .set(authorization(network))
    .send({
      response: device.registration(options.body.challenge),
      label: 'Recall network authority fixture',
    });
  expect(verified.status, JSON.stringify(verified.body)).toBe(200);
  const supply = await createSupply(participant, { quantityKg: 10 });
  holdingId = supply.holdingId;
  recallId = (
    await query(
      `INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,initiated_by_user_id,initiated_by_organization_id)
    VALUES($1,'Operation authority','Investigate reported contamination','Isolate inventory','critical',$2,$3) RETURNING id`,
      [`ROLES-${crypto.randomUUID()}`, manager.userId, manager.organizationId],
    )
  ).rows[0].id;
  await query('INSERT INTO recall_participants(recall_id,organization_id) VALUES($1,$2)', [
    recallId,
    participant.organizationId,
  ]);
  await query(
    "INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id) VALUES($1,'holding',$2)",
    [recallId, holdingId],
  );
});
afterAll(async () => {
  await pool.end();
});
describe('recall operation permissions and scoped physical responsibility', () => {
  it('does not equate network scope or participant access with investigation/activation route permission', async () => {
    for (const actor of [participant, network]) {
      for (const path of ['/traceability/recall-impact', '/recalls']) {
        const denied = await request(app).post(path).set(authorization(actor)).send({});
        expect(denied.status, JSON.stringify(denied.body)).toBe(403);
        expect(denied.body.error).toBe('Permission required: recall.manage');
      }
    }
  });
  it('allows own manager and explicit network contact, but denies participant and unrelated tenant manager', async () => {
    const path = `/recalls/${recallId}/participants/${participant.organizationId}/contact`;
    const body = { status: 'contacted', note: 'Affected organization contacted by telephone' };
    expect((await request(app).patch(path).set(authorization(participant)).send(body)).status).toBe(
      403,
    );
    expect((await request(app).patch(path).set(authorization(outsider)).send(body)).status).toBe(
      404,
    );
    expect((await request(app).patch(path).set(authorization(manager)).send(body)).status).toBe(
      200,
    );
    expect((await request(app).patch(path).set(authorization(network)).send(body)).status).toBe(
      200,
    );
  });
  it('limits acknowledgement and physical accounting to the affected organization even for managers', async () => {
    const ack = `/recalls/${recallId}/acknowledge`;
    const note = 'Read notice and isolated all affected stock';
    expect((await request(app).post(ack).set(authorization(manager)).send({ note })).status).toBe(
      403,
    );
    expect(
      (await request(app).post(ack).set(authorization(participant)).send({ note })).status,
    ).toBe(200);
    const recovery = `/recalls/${recallId}/recovery/${holdingId}`;
    const body = {
      quarantinedKg: 10,
      returnedKg: 0,
      destroyedKg: 0,
      correctedKg: 0,
      releasedKg: 0,
      note: 'All affected stock remains physically isolated',
    };
    expect((await request(app).put(recovery).set(authorization(network)).send(body)).status).toBe(
      403,
    );
    expect((await request(app).put(recovery).set(authorization(manager)).send(body)).status).toBe(
      403,
    );
    expect(
      (await request(app).put(recovery).set(authorization(participant)).send(body)).status,
    ).toBe(200);
    const rows = await query('SELECT * FROM recall_recovery_records WHERE recall_id=$1', [
      recallId,
    ]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].recorded_by_user_id).toBe(participant.userId);
    expect(
      (await query('SELECT released_at FROM recall_safety_holds WHERE recall_id=$1', [recallId]))
        .rows[0].released_at,
    ).toBeNull();
  });
});
