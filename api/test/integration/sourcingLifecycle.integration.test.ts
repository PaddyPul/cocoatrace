import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { inDatabaseTransaction } from '../../src/services/databaseTransaction';
import { recordAudit } from '../../src/services/auditWriter';
import { closeoutSourcing } from '../../src/modules/sourcing/lifecycle';
let token: string, org: string, user: string, id: string;
beforeAll(async () => {
  const suffix = crypto.randomUUID();
  org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'importer','NL','verified') RETURNING id",
      [`Closeout ${suffix}`],
    )
  ).rows[0].id;
  const email = `closeout-${suffix}@integration.test`;
  user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('CloseoutTest123!', 4), 'Closeout buyer'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      `closeout-${suffix}`,
      ['listing.read', 'offer.create'],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'CloseoutTest123!' });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  token = login.body.accessToken;
  id = (
    await query(
      "INSERT INTO sourcing_requests(buyer_organization_id,created_by_user_id,title,commodity,quantity_kg,delivery_location,status) VALUES($1,$2,'Closeout test','cocoa',20,'Rotterdam','open') RETURNING id",
      [org, user],
    )
  ).rows[0].id;
});
const post = (target: string, body: Record<string, unknown>) =>
  request(app)
    .post(`/sourcing-requests/${target}/closeout`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
describe('buyer manual sourcing closeout native', () => {
  it('requires confirmation and does not disclose foreign requests', async () => {
    expect(
      (await post(id, { status: 'closed', reason: 'Reviewed remaining demand', confirmed: false }))
        .status,
    ).toBe(400);
    expect(
      (
        await post(crypto.randomUUID(), {
          status: 'closed',
          reason: 'Reviewed remaining demand',
          confirmed: true,
        })
      ).status,
    ).toBe(404);
  });
  it('rejects unknown buyer contract without changing the request', async () => {
    expect(
      (
        await post(id, {
          status: 'awarded',
          reason: 'Reviewed remaining demand',
          confirmed: true,
          contractId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(404);
    expect(
      (await query('SELECT status FROM sourcing_requests WHERE id=$1', [id])).rows[0].status,
    ).toBe('open');
  });
  it('atomically closes, audits and preserves the durable reason; rejects repeat and tampering', async () => {
    const result = await post(id, {
      status: 'closed',
      reason: 'No remaining demand after procurement review',
      confirmed: true,
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.status).toBe('closed');
    const get = await request(app)
      .get(`/sourcing-requests/${id}/closeout`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.body.closeout.reason).toBe('No remaining demand after procurement review');
    expect(
      (
        await query(
          "SELECT id FROM audit_events WHERE entity_id=$1 AND action='sourcing_request.closeout'",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (await post(id, { status: 'closed', reason: 'Attempt repeated closeout', confirmed: true }))
        .status,
    ).toBe(409);
    await expect(
      query(
        "UPDATE sourcing_request_closeouts SET reason='Attempt to replace history' WHERE request_id=$1",
        [id],
      ),
    ).rejects.toThrow('immutable');
  });
});

afterAll(async () => {
  await pool.end();
});
async function newRequest() {
  return (
    await query(
      "INSERT INTO sourcing_requests(buyer_organization_id,created_by_user_id,title,commodity,quantity_kg,delivery_location,status) VALUES($1,$2,'Award reviewed','cocoa',20,'Rotterdam','open') RETURNING id",
      [org, user],
    )
  ).rows[0].id as string;
}
async function contract(crop = 'cocoa', buyerOrg = org, status = 'accepted') {
  const seller = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Award seller ' + crypto.randomUUID()],
    )
  ).rows[0].id;
  const batch = (
    await query(
      "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode) VALUES($1,CURRENT_DATE,20,$2,'direct_inventory') RETURNING id",
      [crop, seller],
    )
  ).rows[0].id;
  const holding = (
    await query(
      'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,20) RETURNING id',
      [batch, seller],
    )
  ).rows[0].id;
  const listing = (
    await query(
      "INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,origin_location,destination_location) VALUES($1,$2,20,1,'Ghana','Rotterdam') RETURNING id",
      [seller, holding],
    )
  ).rows[0].id;
  const offer = (
    await query(
      "INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,valid_until) VALUES($1,$2,1,1,NOW()+INTERVAL '1 day') RETURNING id",
      [listing, buyerOrg],
    )
  ).rows[0].id;
  return (
    await query(
      'INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,status) VALUES($1,$2,$3,$4,$5,1,1,$6) RETURNING id',
      [listing, offer, seller, buyerOrg, holding, status],
    )
  ).rows[0].id as string;
}
describe('award contract association and transaction safety', () => {
  it('rejects different commodity, foreign buyer and cancelled contracts then records a reviewed award', async () => {
    const target = await newRequest();
    const foreign = (
      await query(
        "INSERT INTO organizations(name,type,jurisdiction) VALUES($1,'importer','NL') RETURNING id",
        ['Foreign ' + crypto.randomUUID()],
      )
    ).rows[0].id;
    for (const [contractId, expected] of [
      [await contract('coffee'), 400],
      [await contract('cocoa', foreign), 404],
      [await contract('cocoa', org, 'cancelled'), 400],
    ] as const) {
      expect(
        (
          await post(target, {
            status: 'awarded',
            reason: 'Reviewed allocations and selected contract',
            confirmed: true,
            contractId,
          })
        ).status,
      ).toBe(expected);
    }
    const selected = await contract();
    const result = await post(target, {
      status: 'awarded',
      reason: 'Reviewed allocations and selected contract',
      confirmed: true,
      contractId: selected,
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const receipt = (
      await query('SELECT * FROM sourcing_request_closeouts WHERE request_id=$1', [target])
    ).rows[0];
    expect(receipt.contract_id).toBe(selected);
    expect(receipt.association_basis).toBe('buyer_manual');
  });
  it('rolls back closeout when the atomic audit fails', async () => {
    const target = await newRequest();
    await expect(
      inDatabaseTransaction(async (client) => {
        await closeoutSourcing(
          client.query.bind(client),
          { id: user, organizationId: org },
          target,
          { status: 'closed', reason: 'Reviewed allocations before closing', confirmed: true },
        );
        await recordAudit(
          client,
          { id: crypto.randomUUID(), organizationId: org },
          'sourcing_request.closeout',
          'sourcing_request',
          target,
        );
      }),
    ).rejects.toThrow();
    expect(
      (await query('SELECT status FROM sourcing_requests WHERE id=$1', [target])).rows[0].status,
    ).toBe('open');
    expect(
      (await query('SELECT * FROM sourcing_request_closeouts WHERE request_id=$1', [target])).rows,
    ).toHaveLength(0);
  });
  it('serializes simultaneous closeouts into one terminal receipt and audit', async () => {
    const target = await newRequest();
    const results = await Promise.all([
      post(target, {
        status: 'closed',
        reason: 'Concurrent reviewed closeout first',
        confirmed: true,
      }),
      post(target, {
        status: 'closed',
        reason: 'Concurrent reviewed closeout second',
        confirmed: true,
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await query('SELECT * FROM sourcing_request_closeouts WHERE request_id=$1', [target])).rows,
    ).toHaveLength(1);
    expect(
      (
        await query(
          "SELECT * FROM audit_events WHERE entity_id=$1 AND action='sourcing_request.closeout'",
          [target],
        )
      ).rows,
    ).toHaveLength(1);
  });
});
