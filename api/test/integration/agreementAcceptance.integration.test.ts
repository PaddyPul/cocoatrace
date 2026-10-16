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
const auth = (who: Actor) => ({ Authorization: `Bearer ${who.token}` });
const get = (who = buyer) => request(app).get(`/contracts/${contractId}/acceptance`).set(auth(who));
const post = (hash: string, who = buyer) =>
  request(app)
    .post(`/contracts/${contractId}/acceptance`)
    .set(auth(who))
    .send({ snapshotHash: hash, confirmed: true });
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
afterAll(async () => {
  await pool.end();
});
describe('explicit bilateral base commercial acknowledgement', () => {
  it('has no inferred acceptance; hides foreign contracts and validates UUIDs', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.body.acceptances).toEqual({ buyer: null, seller: null });
    expect(response.body.snapshot.origin).toBe('Tema');
    expect(JSON.stringify(response.body)).not.toContain('@integration.test');
    expect((await get(outsider)).status).toBe(404);
    expect((await post(response.body.snapshotHash, outsider)).status).toBe(404);
    expect(
      (await request(app).get('/contracts/not-a-uuid/acceptance').set(auth(buyer))).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`/contracts/${contractId}/acceptance`)
          .set(auth(buyer))
          .send({ snapshotHash: response.body.snapshotHash, confirmed: false })
      ).status,
    ).toBe(400);
  });
  it('records each party once and preserves server timestamps on retries', async () => {
    const current = (await get()).body;
    const first = await post(current.snapshotHash);
    expect(first.status).toBe(200);
    expect(first.body.acceptances.buyer).toBeTruthy();
    expect(first.body.acceptances.seller).toBeNull();
    const retry = await post(current.snapshotHash);
    expect(retry.body.acceptances).toEqual(first.body.acceptances);
    const second = await post(current.snapshotHash, seller);
    expect(second.status).toBe(200);
    expect(second.body.acceptances.seller).toBeTruthy();
    expect(
      (await query('SELECT * FROM agreement_acceptances WHERE contract_id=$1', [contractId]))
        .rowCount,
    ).toBe(2);
  });
  it('requires a fresh review of revised base terms; payment proposals are excluded', async () => {
    const old = (await get()).body;
    await query(
      "UPDATE sales_contracts SET payment_terms_note='Separate updated payment proposal' WHERE id=$1",
      [contractId],
    );
    expect((await get()).body.snapshotHash).toBe(old.snapshotHash);
    await query('UPDATE sales_contracts SET price_per_kg=6 WHERE id=$1', [contractId]);
    expect((await post(old.snapshotHash)).status).toBe(409);
    const revised = (await get()).body;
    expect(revised.version).toBe(2);
    expect(revised.acceptances).toEqual({ buyer: null, seller: null });
  });
  it('rechecks live trading permission and never lets wildcard see a foreign trade', async () => {
    const current = (await get()).body;
    const role = (await query('SELECT role_id FROM user_roles WHERE user_id=$1', [buyer.userId]))
      .rows[0].role_id;
    await query("UPDATE roles SET permissions=ARRAY['contract.read']::text[] WHERE id=$1", [role]);
    try {
      expect((await post(current.snapshotHash)).status).toBe(403);
    } finally {
      await query(
        "UPDATE roles SET permissions=ARRAY['contract.read','offer.create']::text[] WHERE id=$1",
        [role],
      );
    }
    const otherRole = (
      await query('SELECT role_id FROM user_roles WHERE user_id=$1', [outsider.userId])
    ).rows[0].role_id;
    await query("UPDATE roles SET permissions=ARRAY['*']::text[] WHERE id=$1", [otherRole]);
    expect((await get(outsider)).status).toBe(404);
  });
  it('preserves prior immutable versions and receipts', async () => {
    await expect(
      query('UPDATE agreement_versions SET snapshot_hash=$2 WHERE contract_id=$1', [
        contractId,
        'b'.repeat(64),
      ]),
    ).rejects.toThrow('immutable');
    await expect(
      query('DELETE FROM agreement_acceptances WHERE contract_id=$1', [contractId]),
    ).rejects.toThrow('immutable');
  });
  it('rolls back the receipt when its actual audit insert fails', async () => {
    const current = (await get()).body;
    await query(
      `CREATE FUNCTION fail_agreement_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='agreement.acknowledged' THEN RAISE EXCEPTION 'test audit unavailable'; END IF; RETURN NEW; END $$`,
    );
    await query(
      'CREATE TRIGGER agreement_test_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_agreement_test_audit()',
    );
    try {
      expect((await post(current.snapshotHash)).status).toBe(500);
    } finally {
      await query('DROP TRIGGER agreement_test_audit_failure ON audit_events');
      await query('DROP FUNCTION fail_agreement_test_audit()');
    }
    expect((await get()).body.acceptances.buyer).toBeNull();
  });
});
