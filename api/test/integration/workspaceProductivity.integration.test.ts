import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { createSession } from '../../src/services/authSessionService';

type Actor = { org: string; user: string; role: string; token: string };
const actors: Actor[] = [];
let buyer: Actor, seller: Actor, outsider: Actor, denied: Actor;
let contract: string, farm: string, batch: string, holding: string, listing: string, offer: string;
let brief: string;
async function actor(permissions: string[]): Promise<Actor> {
  const tag = crypto.randomUUID();
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      ['Workspace ' + tag],
    )
  ).rows[0].id;
  const user = (
    await query(
      "INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,'unused-session-fixture','Workspace test') RETURNING id",
      [org, tag + '@integration.test'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      'workspace-' + tag,
      permissions,
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const result = { org, user, role, token: (await createSession(user)).token };
  actors.push(result);
  return result;
}
const get = (who: Actor, parameters: Record<string, string> = {}, id = contract) =>
  request(app)
    .get(`/contracts/${id}/activity/page`)
    .set('Authorization', `Bearer ${who.token}`)
    .query(parameters);
beforeAll(async () => {
  buyer = await actor(['contract.read', 'offer.create', 'listing.read']);
  seller = await actor(['contract.read']);
  outsider = await actor(['contract.read', 'contract.read.all', 'offer.create', 'listing.read']);
  denied = await actor([]);
  farm = (
    await query(
      "INSERT INTO farms(farmer_organization_id,name,country,region,district) VALUES($1,'Workspace farm','GH','Northern','Tamale') RETURNING id",
      [seller.org],
    )
  ).rows[0].id;
  batch = (
    await query(
      "INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id) VALUES($1,'peanut',CURRENT_DATE,10,$2) RETURNING id",
      [farm, seller.org],
    )
  ).rows[0].id;
  holding = (
    await query(
      "INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg,status) VALUES($1,$2,10,'committed') RETURNING id",
      [batch, seller.org],
    )
  ).rows[0].id;
  listing = (
    await query(
      "INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location,active) VALUES($1,$2,0,5,'EUR','FOB','Tema','Accra',false) RETURNING id",
      [seller.org, holding],
    )
  ).rows[0].id;
  offer = (
    await query(
      "INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until,status) VALUES($1,$2,10,5,'EUR',NOW()+INTERVAL '1 day','accepted') RETURNING id",
      [listing, buyer.org],
    )
  ).rows[0].id;
  contract = (
    await query(
      "INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,currency,incoterm) VALUES($1,$2,$3,$4,$5,10,5,'EUR','FOB') RETURNING id",
      [listing, offer, seller.org, buyer.org, holding],
    )
  ).rows[0].id;
  await query(
    `INSERT INTO audit_events(actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,metadata,occurred_at)
    SELECT $1,$2,'payment.terms.confirm','sales_contract',$3,'fixture','{"privateBankReference":"not-for-history"}'::jsonb,'2026-10-15 12:30:00.123456+00'::timestamptz FROM generate_series(1,55)`,
    [buyer.user, buyer.org, contract],
  );
  await query(
    "INSERT INTO audit_events(actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,metadata) VALUES($1,$2,'maintenance.secret','sales_contract',$3,'fixture','{\"private\":true}')",
    [buyer.user, buyer.org, contract],
  );
  brief = (
    await query(
      "INSERT INTO sourcing_requests(buyer_organization_id,created_by_user_id,title,commodity,quantity_kg,delivery_location,status,visibility,quality_requirements) VALUES($1,$2,'Saved peanut brief','peanut',10,'Accra','open','private','{\"moistureMax\":7}') RETURNING id",
      [buyer.org, buyer.user],
    )
  ).rows[0].id;
});
afterAll(async () => {
  if (actors.length) {
    const orgs = actors.map((a) => a.org),
      users = actors.map((a) => a.user);
    await query('DELETE FROM audit_events WHERE actor_user_id=ANY($1::uuid[])', [users]);
    await query('DELETE FROM sourcing_requests WHERE buyer_organization_id=ANY($1::uuid[])', [
      orgs,
    ]);
    if (contract) await query('DELETE FROM sales_contracts WHERE id=$1', [contract]);
    if (offer) await query('DELETE FROM trade_offers WHERE id=$1', [offer]);
    if (listing) await query('DELETE FROM listings WHERE id=$1', [listing]);
    if (holding) await query('DELETE FROM batch_holdings WHERE id=$1', [holding]);
    if (batch) await query('DELETE FROM harvest_batches WHERE id=$1', [batch]);
    if (farm) await query('DELETE FROM farms WHERE id=$1', [farm]);
    await query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])', [users]);
    await query('DELETE FROM user_roles WHERE user_id=ANY($1::uuid[])', [users]);
    await query('DELETE FROM roles WHERE id=ANY($1::uuid[])', [actors.map((a) => a.role)]);
    await query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    await query('DELETE FROM organizations WHERE id=ANY($1::uuid[])', [orgs]);
  }
  await pool.end();
});
describe('scoped customer workspace productivity', () => {
  it('pages complete allowed history without metadata, identity or administrative actions', async () => {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const response = await get(buyer, { limit: '20', ...(cursor ? { cursor } : {}) });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      for (const row of response.body.items) {
        expect(Object.keys(row).sort()).toEqual(['id', 'label', 'occurredAt', 'party']);
        expect(row.label).toBe('Payment terms confirmed');
        expect(row.party).toBe('buyer');
        ids.push(row.id);
      }
      cursor = response.body.nextCursor || undefined;
    } while (cursor);
    expect(ids).toHaveLength(55);
    expect(new Set(ids).size).toBe(55);
    expect((await get(seller)).status).toBe(200);
  });
  it('requires declared permission and current party scope for each page, including read-all actors', async () => {
    expect((await request(app).get(`/contracts/${contract}/activity/page`)).status).toBe(401);
    expect((await get(denied)).status).toBe(403);
    expect((await get(outsider)).status).toBe(404);
    expect((await get(buyer, {}, crypto.randomUUID())).status).toBe(404);
    const first = await get(buyer, { limit: '1' });
    expect(first.status).toBe(200);
    expect((await get(seller, { cursor: first.body.nextCursor })).status).toBe(400);
    await query('UPDATE sales_contracts SET buyer_organization_id=$1 WHERE id=$2', [
      outsider.org,
      contract,
    ]);
    try {
      expect((await get(buyer, { cursor: first.body.nextCursor })).status).toBe(404);
    } finally {
      await query('UPDATE sales_contracts SET buyer_organization_id=$1 WHERE id=$2', [
        buyer.org,
        contract,
      ]);
    }
    expect((await get(buyer, { limit: '51' })).status).toBe(400);
  });
  it('edits reviewed sourcing fields on the original record with an attributable audit', async () => {
    const response = await request(app)
      .patch(`/sourcing-requests/${brief}`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        title: 'Reviewed saved brief',
        commodity: 'shea',
        quantityKg: 43,
        qualityRequirements: { moistureMax: 7, notes: 'Reviewed' },
        requiredBy: null,
        offerDeadline: null,
      });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({ id: brief, commodity: 'shea', quantity_kg: '43.000' });
    const audit = (
      await query(
        "SELECT metadata FROM audit_events WHERE entity_id=$1 AND action='sourcing_request.update'",
        [brief],
      )
    ).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata.changedFields).toContain('quantityKg');
    const reopened = await request(app)
      .get('/sourcing-requests/page')
      .set('Authorization', `Bearer ${buyer.token}`)
      .query({ mine: 'true', id: brief, limit: '1' });
    expect(reopened.body.items[0]).toMatchObject({
      id: brief,
      commodity: 'shea',
      quantity_kg: '43.000',
    });
  });
  it('denies foreign and terminal sourcing edits and rejects malformed changes', async () => {
    expect(
      (
        await request(app)
          .patch(`/sourcing-requests/${brief}`)
          .set('Authorization', `Bearer ${outsider.token}`)
          .send({ title: 'Foreign change' })
      ).status,
    ).toBe(404);
    for (const body of [
      { quantityKg: 0 },
      { buyer_organization_id: outsider.org },
      { requiredBy: '2026-02-30' },
    ])
      expect(
        (
          await request(app)
            .patch(`/sourcing-requests/${brief}`)
            .set('Authorization', `Bearer ${buyer.token}`)
            .send(body)
        ).status,
      ).toBe(400);
    await query("UPDATE sourcing_requests SET status='closed' WHERE id=$1", [brief]);
    expect(
      (
        await request(app)
          .patch(`/sourcing-requests/${brief}`)
          .set('Authorization', `Bearer ${buyer.token}`)
          .send({ title: 'Terminal change' })
      ).status,
    ).toBe(404);
  });
});
