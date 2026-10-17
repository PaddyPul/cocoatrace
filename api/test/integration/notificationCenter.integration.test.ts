import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';
import {
  createActor,
  createSupply,
  createListing,
  createOffer,
  type FixtureActor,
} from './support/fixtures';
let owner: FixtureActor, buyer: FixtureActor, listing: string, pending: string;
beforeEach(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  await query('TRUNCATE auth_rate_limits');
});
beforeAll(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  const permissions = ['listing.read', 'listing.create', 'offer.create', 'offer.respond'];
  owner = await createActor({ type: 'exporter', permissions });
  buyer = await createActor({ type: 'importer', permissions });
  const stock = await createSupply(owner, { quantityKg: 100, crop: 'peanut' });
  const terms = { quantityKg: 50, pricePerKg: 10, currency: 'EUR', incoterm: 'CIF' } as const;
  listing = await createListing(owner, stock, {
    ...terms,
    origin: 'Tamale',
    destination: 'Rotterdam',
  });
  pending = await createOffer(buyer, listing, { ...terms, quantityKg: 1 });
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
