import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
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
beforeEach(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  await query('TRUNCATE auth_rate_limits');
});
beforeAll(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
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
      "INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,origin_location,destination_location,expires_at) VALUES($1,$2,50,10,'EUR','Tamale','Rotterdam',clock_timestamp()+INTERVAL '1 day') RETURNING id",
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
it('persists private receipts, rehydrates current authority and removes ended notices', async () => {
  const headers = { Authorization: `Bearer ${owner.token}` },
    other = { Authorization: `Bearer ${buyer.token}` };
  const page = await request(app).get('/notifications/page?limit=1').set(headers);
  expect(page.status, JSON.stringify(page.body)).toBe(200);
  const item = page.body.items[0];
  expect(item.responsibleParty).toBe('you');
  expect(item.read).toBe(false);
  const url = '/notifications/' + item.fingerprint + '/read';
  expect((await request(app).post(url).set(other).send({ read: true })).status).toBe(404);
  for (let i = 0; i < 2; i++)
    expect((await request(app).post(url).set(headers).send({ read: true })).status).toBe(200);
  expect((await request(app).get('/notifications/summary').set(headers)).body.unreadCount).toBe(0);
  expect((await request(app).get('/notifications/summary').set(other)).body.unreadCount).toBe(1);
  expect(
    (await query('SELECT * FROM notification_reads WHERE fingerprint=$1', [item.fingerprint])).rows,
  ).toHaveLength(1);
  await query("UPDATE trade_offers SET status='rejected' WHERE id=$1", [pending]);
  expect((await request(app).get('/notifications/page').set(headers)).body.items).toEqual([]);
  expect((await request(app).post(url).set(headers).send({ read: false })).status).toBe(404);
  expect(
    Number(
      (
        await query(
          'SELECT quantity_kg FROM batch_holdings WHERE id=(SELECT holding_id FROM listings WHERE id=$1)',
          [listing],
        )
      ).rows[0].quantity_kg,
    ),
  ).toBe(100);
});
