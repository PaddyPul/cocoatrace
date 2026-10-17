import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';

type Actor = { organizationId: string; token: string; userId: string };
type Supply = { batchId: string; holdingId: string };
let seller: Actor;
let buyer: Actor;
let outsider: Actor;

async function actor(type: 'exporter' | 'importer'): Promise<Actor> {
  const suffix = crypto.randomUUID();
  const organization = await query(
    "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",
    [`Trading ${suffix}`, type],
  );
  const email = `trade-${suffix}@integration.test`;
  const password = 'TradingRegressionPassword123!';
  const user = await query(
    'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
    [organization.rows[0].id, email, await bcrypt.hash(password, 4), 'Trading Regression'],
  );
  const role = await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [
    `trading-${suffix}`,
    [
      'batch.create',
      'holding.read',
      'holding.create',
      'custody.transfer.request',
      'custody.transfer.accept',
      'listing.read',
      'listing.create',
      'offer.create',
      'offer.respond',
      'contract.read',
      'shipment.read',
      'shipment.update',
    ],
  ]);
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [
    user.rows[0].id,
    role.rows[0].id,
  ]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  return {
    organizationId: organization.rows[0].id,
    token: login.body.accessToken,
    userId: user.rows[0].id,
  };
}

async function supply(quantity = 1000, allocate = true): Promise<Supply> {
  const batch = await query(
    "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('shea nuts',CURRENT_DATE,$1,$2,'direct_inventory','Regression Source','GH') RETURNING id",
    [quantity, seller.organizationId],
  );
  if (!allocate) return { batchId: batch.rows[0].id, holdingId: '' };
  const holding = await query(
    'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,$3) RETURNING id',
    [batch.rows[0].id, seller.organizationId, quantity],
  );
  return { batchId: batch.rows[0].id, holdingId: holding.rows[0].id };
}

async function listing(s: Supply, quantity = 1000): Promise<string> {
  const result = await query(
    "INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,$3,5,'EUR','FOB','Tema','Rotterdam') RETURNING id",
    [seller.organizationId, s.holdingId, quantity],
  );
  return result.rows[0].id;
}

async function offer(listingId: string, quantity = 600, expired = false): Promise<string> {
  const result = await query(
    "INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,$3,5,'EUR',$4) RETURNING id",
    [
      listingId,
      buyer.organizationId,
      quantity,
      new Date(Date.now() + (expired ? -86400000 : 86400000)),
    ],
  );
  return result.rows[0].id;
}

let contractId: string;
let shipmentId: string;
const auth = (who: Actor) => ({ Authorization: `Bearer ${who.token}` });
const get = (who = buyer) =>
  request(app).get(`/shipments/${shipmentId}/dispatch-acknowledgement`).set(auth(who));
const post = (hash: string, who = buyer) =>
  request(app)
    .post(`/shipments/${shipmentId}/dispatch-acknowledgement`)
    .set(auth(who))
    .send({ exceptionHash: hash, confirmed: true });
beforeEach(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  await query('TRUNCATE auth_rate_limits');
});
beforeAll(async () => {
  requireDisposableTestDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  seller = await actor('exporter');
  buyer = await actor('importer');
  outsider = await actor('importer');
  const stock = await supply();
  const listingId = await listing(stock);
  const offerId = await offer(listingId);
  contractId = (
    await query(
      `INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,currency,incoterm)
    VALUES($1,$2,$3,$4,$5,600,5,'EUR','FOB') RETURNING id`,
      [listingId, offerId, seller.organizationId, buyer.organizationId, stock.holdingId],
    )
  ).rows[0].id;
});
beforeAll(async () => {
  shipmentId = (
    await query(
      "INSERT INTO shipments(contract_id,dispatch_exception,dispatch_exception_reason,dispatch_exception_recorded_at) VALUES($1,TRUE,'Payment not confirmed',NOW()) RETURNING id",
      [contractId],
    )
  ).rows[0].id;
});
afterAll(async () => {
  await pool.end();
});
describe('exceptional dispatch awareness boundaries', () => {
  it('does not infer acknowledgement; prevents foreign and seller acknowledgement', async () => {
    const current = await get();
    expect(current.status, JSON.stringify(current.body)).toBe(200);
    expect(current.body.acknowledgedAt).toBeNull();
    expect((await get(outsider)).status).toBe(404);
    expect((await post(current.body.exception.hash, seller)).status).toBe(403);
    const role = (await query('SELECT role_id FROM user_roles WHERE user_id=$1', [outsider.userId]))
      .rows[0].role_id;
    await query("UPDATE roles SET permissions=ARRAY['*']::text[] WHERE id=$1", [role]);
    expect((await get(outsider)).status).toBe(404);
  });
  it('serializes concurrent receipts and audits once; new reason requires review', async () => {
    const old = (await get()).body;
    const results = await Promise.all([post(old.exception.hash), post(old.exception.hash)]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results[0].body.acknowledgedAt).toBe(results[1].body.acknowledgedAt);
    expect(
      (
        await query(
          "SELECT COUNT(*)::int AS count FROM audit_events WHERE action='dispatch.exception.acknowledged' AND entity_id=$1",
          [shipmentId],
        )
      ).rows[0].count,
    ).toBe(1);
    await query(
      "UPDATE shipments SET dispatch_exception_reason='Revised explanation' WHERE id=$1",
      [shipmentId],
    );
    expect((await post(old.exception.hash)).status).toBe(409);
    expect((await get()).body.acknowledgedAt).toBeNull();
  });
  it('rechecks reduced permissions and rolls back receipt when audit fails', async () => {
    const current = (await get()).body;
    const role = (await query('SELECT role_id FROM user_roles WHERE user_id=$1', [buyer.userId]))
      .rows[0].role_id;
    await query("UPDATE roles SET permissions=ARRAY['shipment.read']::text[] WHERE id=$1", [role]);
    try {
      expect((await post(current.exception.hash)).status).toBe(403);
    } finally {
      await query(
        "UPDATE roles SET permissions=ARRAY['shipment.read','shipment.update']::text[] WHERE id=$1",
        [role],
      );
    }
    await query(
      "CREATE FUNCTION fail_dispatch_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='dispatch.exception.acknowledged' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$",
    );
    await query(
      'CREATE TRIGGER dispatch_test_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_dispatch_test_audit()',
    );
    try {
      expect((await post(current.exception.hash)).status).toBe(500);
    } finally {
      await query('DROP TRIGGER dispatch_test_audit_failure ON audit_events');
      await query('DROP FUNCTION fail_dispatch_test_audit()');
    }
    expect((await get()).body.acknowledgedAt).toBeNull();
    expect((await post(current.exception.hash)).status).toBe(200);
    await expect(
      query('DELETE FROM dispatch_acknowledgements WHERE shipment_id=$1', [shipmentId]),
    ).rejects.toThrow('immutable');
  });
});
