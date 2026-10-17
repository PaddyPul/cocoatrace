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

let shipmentId: string;
const auth = (who: Actor) => ({ Authorization: `Bearer ${who.token}` });
const read = (who = buyer) => request(app).get(`/shipments/${shipmentId}/timing`).set(auth(who));
const update = (revision: number, date = '2020-01-01', who = buyer) =>
  request(app).post(`/shipments/${shipmentId}/timing`).set(auth(who)).send({
    expectedRevision: revision,
    etaArrival: date,
    reason: 'Provider revised arrival estimate',
  });
beforeAll(async () => {
  shipmentId = (
    await query(
      "INSERT INTO shipments(contract_id,transport_coordinator_organization_id,current_milestone) VALUES($1,$2,'planning') RETURNING id",
      [contractId, buyer.organizationId],
    )
  ).rows[0].id;
});
describe('reviewed transport timing', () => {
  it('isolates contract parties and the Incoterm coordinator', async () => {
    expect((await read(outsider)).status).toBe(404);
    expect((await update(0, '2020-01-01', seller)).status).toBe(403);
    const initial = await read();
    expect(initial.status, JSON.stringify(initial.body)).toBe(200);
    expect(initial.body.etaArrival).toBeNull();
  });
  it('records immutable history, audits and rejects stale overwrite', async () => {
    const current = await read();
    const saved = await update(current.body.revision);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.overdue).toBe(true);
    expect(saved.body.history[0].reason).toBe('Provider revised arrival estimate');
    expect((await update(current.body.revision, '2020-01-02')).status).toBe(409);
    await expect(
      query('UPDATE shipment_timing_history SET reason=$2 WHERE shipment_id=$1', [
        shipmentId,
        'changed',
      ]),
    ).rejects.toThrow();
  });
  it('rolls back timing when its atomic audit fails', async () => {
    const old = (await read()).body;
    await query(
      `CREATE FUNCTION timing_test_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='transport.timing.update' THEN RAISE EXCEPTION 'injected timing audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER timing_test_audit_fail BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION timing_test_audit_fail()`,
    );
    try {
      expect((await update(old.revision, '2020-01-03')).status).toBe(500);
      expect((await read()).body.revision).toBe(old.revision);
    } finally {
      await query(
        'DROP TRIGGER timing_test_audit_fail ON audit_events; DROP FUNCTION timing_test_audit_fail()',
      );
    }
  });
  it('preserves legacy initial entry but rejects unreviewed changes', async () => {
    const fresh = shipmentId;
    await query('UPDATE shipments SET eta_arrival=NULL WHERE id=$1', [fresh]);
    const initial = await request(app)
      .patch(`/shipments/${fresh}/details`)
      .set(auth(buyer))
      .send({ etaArrival: '2020-02-01' });
    expect(initial.status, JSON.stringify(initial.body)).toBe(200);
    const changed = await request(app)
      .patch(`/shipments/${fresh}/details`)
      .set(auth(buyer))
      .send({ etaArrival: '2020-02-02' });
    expect(changed.status).toBe(400);
  });
  it('arrival suppresses overdue and closes ETA editing', async () => {
    await query("UPDATE shipments SET current_milestone='arrived' WHERE id=$1", [shipmentId]);
    const arrival = (await read()).body;
    expect(arrival.overdue).toBe(false);
    expect(arrival.canEdit).toBe(false);
    expect((await update(arrival.revision, '2020-02-04')).status).toBe(403);
  });
});
