import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
let owner: { org: string; token: string },
  buyer: { org: string; token: string },
  listing: string,
  pending: string;
async function actor() {
  const tag = crypto.randomUUID(),
    email = `expiry-${tag}@integration.test`;
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'exporter','GH','verified') RETURNING id",
      [tag],
    )
  ).rows[0].id;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash('ExpiryReview123!', 4), 'Expiry reviewer'],
    )
  ).rows[0].id;
  const role = (
    await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
      `expiry-${tag}`,
      ['listing.read', 'listing.create', 'offer.create', 'offer.respond'],
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const response = await request(app)
    .post('/auth/login')
    .send({ email, password: 'ExpiryReview123!' });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return { org, token: response.body.accessToken };
}
beforeAll(async () => {
  owner = await actor();
  buyer = await actor();
  const batch = (
    await query(
      "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,100,$1,'direct_inventory','Expiry stock','GH') RETURNING id",
      [owner.org],
    )
  ).rows[0].id;
  const holding = (
    await query(
      'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,100) RETURNING id',
      [batch, owner.org],
    )
  ).rows[0].id;
  listing = (
    await query(
      "INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,origin_location,destination_location,expires_at) VALUES($1,$2,50,10,'EUR','Tamale','Rotterdam',clock_timestamp()-INTERVAL '1 day') RETURNING id",
      [owner.org, holding],
    )
  ).rows[0].id;
  pending = (
    await query(
      "INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,1,10,'EUR',NOW()+INTERVAL '1 day') RETURNING id",
      [listing, buyer.org],
    )
  ).rows[0].id;
});
afterAll(async () => {
  await pool.end();
});
it('hides expired supply, blocks offers and bypass updates, then explicitly renews with audit and retires pending offers', async () => {
  const headers = { Authorization: `Bearer ${owner.token}` };
  const page = await request(app).get('/listings/page').query({ id: listing }).set(headers);
  expect(page.status, JSON.stringify(page.body)).toBe(200);
  expect(page.body.items.some((l: { id: string }) => l.id === listing)).toBe(false);
  const mine = await request(app)
    .get('/listings/page')
    .query({ mine: 'true', id: listing })
    .set(headers);
  expect(mine.status, JSON.stringify(mine.body)).toBe(200);
  expect(mine.body.items.some((l: { id: string }) => l.id === listing)).toBe(true);
  const offer = await request(app)
    .post(`/listings/${listing}/offers`)
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({ quantityKg: 1, offeredPricePerKg: 10, currency: 'EUR' });
  expect(offer.status, JSON.stringify(offer.body)).toBe(409);
  expect(offer.body.code).toBe('LISTING_EXPIRED');
  const accept = await request(app).post(`/offers/${pending}/accept`).set(headers).send({});
  expect(accept.status, JSON.stringify(accept.body)).toBe(409);
  expect(accept.body.code).toBe('LISTING_EXPIRED');
  const invalid = await request(app)
    .post(`/listings/${listing}/renew`)
    .set(headers)
    .send({
      expiresAt: new Date(Date.now() + 91 * 86400000).toISOString(),
      reason: 'Reviewed available stock',
    });
  expect(invalid.status, JSON.stringify(invalid.body)).toBe(400);
  const patch = await request(app)
    .patch(`/listings/${listing}`)
    .set(headers)
    .send({ active: true });
  expect(patch.status, JSON.stringify(patch.body)).toBe(409);
  const foreign = await request(app)
    .post(`/listings/${listing}/renew`)
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      reason: 'Reviewed available stock',
    });
  expect(foreign.status, JSON.stringify(foreign.body)).toBe(404);
  await query(
    'UPDATE batch_holdings SET quantity_kg=10 WHERE id=(SELECT holding_id FROM listings WHERE id=$1)',
    [listing],
  );
  const shortage = await request(app)
    .post(`/listings/${listing}/renew`)
    .set(headers)
    .send({
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      reason: 'Reviewed available stock',
    });
  expect(shortage.status, JSON.stringify(shortage.body)).toBe(409);
  expect(shortage.body.code).toBe('INSUFFICIENT_INVENTORY');
  expect(
    (await query('SELECT status FROM trade_offers WHERE id=$1', [pending])).rows[0].status,
  ).toBe('pending');
  expect(
    (
      await query(
        "SELECT COUNT(*)::int AS count FROM audit_events WHERE entity_id=$1 AND action='listing.renew'",
        [listing],
      )
    ).rows[0].count,
  ).toBe(0);
  await query(
    'UPDATE batch_holdings SET quantity_kg=100 WHERE id=(SELECT holding_id FROM listings WHERE id=$1)',
    [listing],
  );
  const renewed = await request(app)
    .post(`/listings/${listing}/renew`)
    .set(headers)
    .send({
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      reason: 'Reviewed available stock',
    });
  expect(renewed.status, JSON.stringify(renewed.body)).toBe(200);
  expect(renewed.body.renewed_at).toBeTruthy();
  expect(
    (await query('SELECT status FROM trade_offers WHERE id=$1', [pending])).rows[0].status,
  ).toBe('rejected');
  const audit = (
    await query("SELECT metadata FROM audit_events WHERE entity_id=$1 AND action='listing.renew'", [
      listing,
    ])
  ).rows[0];
  expect(audit.metadata.reason).toBe('Reviewed available stock');
  expect(audit.metadata.rejectedOfferCount).toBe(1);
  const visible = await request(app).get('/listings/page').query({ id: listing }).set(headers);
  expect(visible.status, JSON.stringify(visible.body)).toBe(200);
  expect(visible.body.items.some((l: { id: string }) => l.id === listing)).toBe(true);
  const old = await request(app).post(`/offers/${pending}/accept`).set(headers).send({});
  expect(old.status, JSON.stringify(old.body)).toBe(409);
});
