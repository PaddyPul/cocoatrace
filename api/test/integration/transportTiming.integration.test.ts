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
  shipmentId = await createShipment(contractId, {
    coordinatorOrganizationId: buyer.organizationId,
    milestone: 'planning',
  });
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
