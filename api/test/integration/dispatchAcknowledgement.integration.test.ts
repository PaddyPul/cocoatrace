import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { requireDisposableTestDatabase } from '../../src/testing/databaseSafety';

import {
  createActor,
  createSupply,
  createListing,
  createOffer,
  createContract,
  createShipment,
  type FixtureActor as Actor,
} from './support/fixtures';
let seller: Actor;
let buyer: Actor;
let outsider: Actor;
const permissions = [
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
];

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
  seller = await createActor({ type: 'exporter', permissions });
  buyer = await createActor({ type: 'importer', permissions });
  outsider = await createActor({ type: 'importer', permissions });
  const stock = await createSupply(seller, { quantityKg: 1000 });
  const terms = { quantityKg: 1000, pricePerKg: 5, currency: 'EUR', incoterm: 'FOB' } as const;
  const listingId = await createListing(seller, stock, {
    ...terms,
    origin: 'Tema',
    destination: 'Rotterdam',
  });
  const offerId = await createOffer(buyer, listingId, { ...terms, quantityKg: 600 });
  contractId = await createContract(seller, buyer, stock, listingId, offerId, {
    ...terms,
    quantityKg: 600,
  });
});
beforeAll(async () => {
  shipmentId = await createShipment(contractId, { exception: { reason: 'Payment not confirmed' } });
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
