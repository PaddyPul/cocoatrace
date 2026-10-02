import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { reconcileTradeIntegrity } from '../../src/modules/trading/reconciliation';

type Actor = { organizationId: string; token: string };
type Supply = { batchId: string; holdingId: string };
let seller: Actor;
let buyer: Actor;
let outsider: Actor;

async function actor(type: 'exporter' | 'importer'): Promise<Actor> {
  const suffix = crypto.randomUUID();
  const organization = await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id", [`Trading ${suffix}`, type]);
  const email = `trade-${suffix}@integration.test`;
  const password = 'TradingRegressionPassword123!';
  const user = await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [organization.rows[0].id, email, await bcrypt.hash(password, 4), 'Trading Regression']);
  const role = await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [`trading-${suffix}`, ['batch.create', 'holding.read', 'holding.create', 'custody.transfer.request', 'custody.transfer.accept', 'listing.read', 'listing.create', 'offer.create', 'offer.respond', 'contract.read']]);
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.rows[0].id, role.rows[0].id]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  return { organizationId: organization.rows[0].id, token: login.body.accessToken };
}

async function supply(quantity = 1000, allocate = true): Promise<Supply> {
  const batch = await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('shea nuts',CURRENT_DATE,$1,$2,'direct_inventory','Regression Source','GH') RETURNING id", [quantity, seller.organizationId]);
  if (!allocate) return { batchId: batch.rows[0].id, holdingId: '' };
  const holding = await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,$3) RETURNING id', [batch.rows[0].id, seller.organizationId, quantity]);
  return { batchId: batch.rows[0].id, holdingId: holding.rows[0].id };
}

async function listing(s: Supply, quantity = 1000): Promise<string> {
  const result = await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,$3,5,'EUR','FOB','Tema','Rotterdam') RETURNING id", [seller.organizationId, s.holdingId, quantity]);
  return result.rows[0].id;
}

async function offer(listingId: string, quantity = 600, expired = false): Promise<string> {
  const result = await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,$3,5,'EUR',$4) RETURNING id", [listingId, buyer.organizationId, quantity, new Date(Date.now() + (expired ? -86400000 : 86400000))]);
  return result.rows[0].id;
}

function accept(id: string, principal = seller) {
  return request(app).post(`/offers/${id}/accept`).set('Authorization', `Bearer ${principal.token}`);
}

async function conserved(s: Supply, quantity = 1000) {
  const result = await query("SELECT COALESCE(SUM(quantity_kg) FILTER(WHERE status<>'transferred'),0)::numeric AS total, COUNT(*) FILTER(WHERE quantity_kg<=0)::int AS non_positive FROM batch_holdings WHERE batch_id=$1", [s.batchId]);
  expect(Number(result.rows[0].total)).toBe(quantity);
  expect(result.rows[0].non_positive).toBe(0);
  const allocations = await query("SELECT h.id,h.quantity_kg,COALESCE(SUM(l.available_quantity_kg) FILTER(WHERE l.active),0) AS listed FROM batch_holdings h LEFT JOIN listings l ON l.holding_id=h.id WHERE h.batch_id=$1 GROUP BY h.id", [s.batchId]);
  for (const h of allocations.rows) expect(Number(h.listed)).toBeLessThanOrEqual(Number(h.quantity_kg));
}

async function contractCounts(s: Supply) {
  const result = await query(`SELECT COUNT(DISTINCT c.id)::int AS contracts,COUNT(DISTINCT p.id)::int AS payments,COUNT(DISTINCT sh.id)::int AS shipments,COUNT(DISTINCT f.id)::int AS fees
    FROM sales_contracts c JOIN batch_holdings h ON h.id=c.holding_id LEFT JOIN payment_requests p ON p.contract_id=c.id LEFT JOIN shipments sh ON sh.contract_id=c.id LEFT JOIN platform_fee_invoices f ON f.contract_id=c.id WHERE h.batch_id=$1`, [s.batchId]);
  return result.rows[0];
}

async function transfer(s: Supply, quantity: number): Promise<string> {
  const result = await query('INSERT INTO custody_transfers(holding_id,from_organization_id,to_organization_id,quantity_kg) VALUES($1,$2,$3,$4) RETURNING id', [s.holdingId, seller.organizationId, buyer.organizationId, quantity]);
  return result.rows[0].id;
}

beforeAll(async () => { seller = await actor('exporter'); buyer = await actor('importer'); outsider = await actor('exporter'); });
afterAll(async () => { await pool.end(); });

describe('real PostgreSQL trading inventory integrity', () => {
  it('accepts a duplicate concurrent request exactly once and prepares exactly one fulfillment workspace', async () => {
    const s = await supply(); const id = await offer(await listing(s));
    const results = await Promise.all([accept(id), accept(id)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await contractCounts(s)).toEqual({ contracts: 1, payments: 1, shipments: 1, fees: 1 });
    const committed = await query("SELECT quantity_kg FROM batch_holdings WHERE batch_id=$1 AND status='committed'", [s.batchId]);
    expect(committed.rows.map(r => Number(r.quantity_kg))).toEqual([600]);
    await conserved(s);
  });

  it('serializes competing offers on the same listing without double-selling', async () => {
    const s = await supply(); const l = await listing(s);
    const ids = await Promise.all([offer(l, 700), offer(l, 700)]);
    const results = await Promise.all(ids.map(id => accept(id)));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await contractCounts(s)).contracts).toBe(1);
    await conserved(s);
  });

  it('serializes competing legacy listings sharing one holding and caps the remaining listing stock', async () => {
    const s = await supply();
    const ids = await Promise.all([offer(await listing(s), 700), offer(await listing(s), 700)]);
    const results = await Promise.all(ids.map(id => accept(id)));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await contractCounts(s)).contracts).toBe(1);
    await conserved(s);
  });

  it('keeps a sellable residual holding after partial acceptance and conserves decimal quantities', async () => {
    const s = await supply(1000.125); const id = await offer(await listing(s, 1000.125), 333.333);
    const accepted = await accept(id);
    expect(accepted.status).toBe(200);
    expect(Number(accepted.body.remainingListing.available_quantity_kg)).toBe(666.792);
    const holdings = await query('SELECT quantity_kg,status FROM batch_holdings WHERE batch_id=$1 ORDER BY status', [s.batchId]);
    expect(holdings.rows).toEqual([{ quantity_kg: '666.792', status: 'available' }, { quantity_kg: '333.333', status: 'committed' }]);
    await conserved(s, 1000.125);
  });

  it('keeps the unsold 6 kg visible in the marketplace after accepting 4 kg from a 10 kg listing', async () => {
    const s = await supply(10); const originalId = await listing(s, 10);
    const accepted = await accept(await offer(originalId, 4));
    expect(accepted.status).toBe(200);
    const remaining = accepted.body.remainingListing;
    expect(remaining.id).not.toBe(originalId);
    expect(remaining.holding_id).toBe(s.holdingId);
    expect(Number(remaining.available_quantity_kg)).toBe(6);
    expect(remaining).toMatchObject({ active: true, price_per_kg: '5.0000', currency: 'EUR', incoterm: 'FOB', origin_location: 'Tema', destination_location: 'Rotterdam' });
    const marketplace = await request(app).get('/listings').set('Authorization', `Bearer ${buyer.token}`);
    expect(marketplace.status).toBe(200);
    expect(marketplace.body.find((item: { id: string }) => item.id === remaining.id)).toMatchObject({ available_quantity_kg: '6.000', active: true });
    expect(marketplace.body.some((item: { id: string }) => item.id === originalId)).toBe(false);
    const original = (await query('SELECT holding_id,active,available_quantity_kg FROM listings WHERE id=$1', [originalId])).rows[0];
    expect(original.active).toBe(false);
    expect(original.holding_id).toBe(accepted.body.contract.holding_id);
    expect(Number(original.available_quantity_kg)).toBe(4);
    await conserved(s, 10);
  });

  it('creates no continuation listing when the advertised quantity is fully accepted', async () => {
    const s = await supply(10); const originalId = await listing(s, 4);
    const accepted = await accept(await offer(originalId, 4));
    expect(accepted.status).toBe(200);
    expect(accepted.body.remainingListing).toBeNull();
    const published = await query('SELECT id FROM listings WHERE holding_id=$1 AND active', [s.holdingId]);
    expect(published.rows).toHaveLength(0);
    await conserved(s, 10);
  });

  it('reserves continuation stock ahead of legacy siblings and pending transfer reservations', async () => {
    const s = await supply(10); const originalId = await listing(s, 10);
    const siblingId = await listing(s, 8); // Historical overpublication must not double-sell.
    await transfer(s, 2);
    const accepted = await accept(await offer(originalId, 4));
    expect(accepted.status).toBe(200);
    expect(Number(accepted.body.remainingListing.available_quantity_kg)).toBe(4);
    const sibling = (await query('SELECT active,available_quantity_kg FROM listings WHERE id=$1', [siblingId])).rows[0];
    expect(sibling.active).toBe(false);
    const published = (await query('SELECT COALESCE(SUM(available_quantity_kg),0) AS quantity FROM listings WHERE holding_id=$1 AND active', [s.holdingId])).rows[0];
    expect(Number(published.quantity) + 2).toBe(6);
    await conserved(s, 10);
  });

  it('refuses expired offers, deactivated listings and foreign seller acceptance without allocating inventory', async () => {
    const s = await supply(); const l = await listing(s); const expired = await offer(l, 600, true);
    expect((await accept(expired)).status).toBe(409);
    const id = await offer(l);
    expect((await accept(id, outsider)).status).toBe(403);
    await query('UPDATE listings SET active=FALSE WHERE id=$1', [l]);
    expect((await accept(id)).status).toBe(409);
    expect((await contractCounts(s)).contracts).toBe(0);
    await conserved(s);
  });

  it('does not allow rejection to rewrite an accepted offer', async () => {
    const s = await supply(); const id = await offer(await listing(s));
    expect((await accept(id)).status).toBe(200);
    const rejected = await request(app).post(`/offers/${id}/reject`).set('Authorization', `Bearer ${seller.token}`);
    expect(rejected.status).toBe(409);
    expect((await query('SELECT status FROM trade_offers WHERE id=$1', [id])).rows[0].status).toBe('accepted');
  });

  it('rolls back inventory, offer and every fulfillment record when a downstream insert fails', async () => {
    const s = await supply(); const l = await listing(s); const id = await offer(l);
    const trigger = `trade_fail_${crypto.randomUUID().replaceAll('-', '')}`;
    await query(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM sales_contracts c WHERE c.id=NEW.contract_id AND c.offer_id='${id}'::uuid) THEN RAISE EXCEPTION 'injected fulfillment failure'; END IF; RETURN NEW; END $$`);
    await query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON shipments FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
    try {
      expect((await accept(id)).status).toBe(500);
      expect(await contractCounts(s)).toEqual({ contracts: 0, payments: 0, shipments: 0, fees: 0 });
      expect((await query('SELECT status FROM trade_offers WHERE id=$1', [id])).rows[0].status).toBe('pending');
      expect((await query('SELECT active FROM listings WHERE id=$1', [l])).rows[0].active).toBe(true);
      await conserved(s);
      expect((await query('SELECT COUNT(*)::int AS total FROM batch_holdings WHERE batch_id=$1', [s.batchId])).rows[0].total).toBe(1);
    } finally { await query(`DROP TRIGGER ${trigger} ON shipments`); await query(`DROP FUNCTION ${trigger}()`); }
    expect((await accept(id)).status).toBe(200);
  });

  it('atomically caps concurrent new listings at the unreserved holding quantity', async () => {
    const s = await supply();
    const body = { holdingId: s.holdingId, availableQuantityKg: 700, pricePerKg: 5, currency: 'EUR', incoterm: 'FOB', originLocation: 'Tema', destinationLocation: 'Rotterdam' };
    const results = await Promise.all([1, 2].map(() => request(app).post('/listings').set('Authorization', `Bearer ${seller.token}`).send(body)));
    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(results.filter(r => r.status === 409)).toHaveLength(1);
    await conserved(s);
  });

  it('validates listing edits and denies oversupply and foreign ownership', async () => {
    const s = await supply(); const l = await listing(s, 600);
    const edit = (actor: Actor, body: object) => request(app).patch(`/listings/${l}`).set('Authorization', `Bearer ${actor.token}`).send(body);
    expect((await edit(seller, { availableQuantityKg: 1200 })).status).toBe(409);
    expect((await edit(seller, { availableQuantityKg: -1 })).status).toBe(400);
    expect((await edit(seller, { pricePerKg: 'free' })).status).toBe(400);
    expect((await edit(outsider, { availableQuantityKg: 100 })).status).toBe(404);
    expect(Number((await query('SELECT available_quantity_kg FROM listings WHERE id=$1', [l])).rows[0].available_quantity_kg)).toBe(600);
    await conserved(s);
  });

  it('atomically caps concurrent holding allocation at the batch quantity', async () => {
    const s = await supply(1000, false);
    const results = await Promise.all([1, 2].map(() => request(app).post('/holdings').set('Authorization', `Bearer ${seller.token}`).send({ batchId: s.batchId, quantityKg: 700 })));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const result = await query("SELECT SUM(quantity_kg)::numeric AS total FROM batch_holdings WHERE batch_id=$1 AND status<>'transferred'", [s.batchId]);
    expect(Number(result.rows[0].total)).toBe(700);
  });

  it('does not mint committed or transferred stock again through batch publication', async () => {
    const publish = (s: Supply) => request(app).post(`/batches/${s.batchId}/push-to-marketplace`)
      .set('Authorization', `Bearer ${seller.token}`).send({ quantityKg: 1000, pricePerKg: 5, currency: 'EUR', incoterm: 'FOB', originLocation: 'Tema', destinationLocation: 'Rotterdam' });
    const sold = await supply(); const id = await offer(await listing(sold), 1000);
    expect((await accept(id)).status).toBe(200);
    expect((await publish(sold)).status).toBe(409);
    await conserved(sold);
    const moved = await supply(); const transferId = await transfer(moved, 1000);
    expect((await request(app).post(`/transfers/${transferId}/accept`).set('Authorization', `Bearer ${buyer.token}`)).status).toBe(200);
    expect((await publish(moved)).status).toBe(409);
    await conserved(moved);
  });

  it('serializes concurrent source allocation across holding creation and batch publication', async () => {
    const s = await supply(1000, false);
    const published = request(app).post(`/batches/${s.batchId}/push-to-marketplace`).set('Authorization', `Bearer ${seller.token}`)
      .send({ quantityKg: 700, pricePerKg: 5, currency: 'EUR', incoterm: 'FOB', originLocation: 'Tema', destinationLocation: 'Rotterdam' });
    const allocated = request(app).post('/holdings').set('Authorization', `Bearer ${seller.token}`).send({ batchId: s.batchId, quantityKg: 700 });
    const results = await Promise.all([published, allocated]);
    // Publication may reuse the holding created by the competing request, so
    // both requests can succeed without creating a second allocation.
    expect(results.every(result => [201, 409].includes(result.status))).toBe(true);
    expect(results.some(result => result.status === 201)).toBe(true);
    const held = await query("SELECT SUM(quantity_kg)::numeric AS total FROM batch_holdings WHERE batch_id=$1 AND status<>'transferred'", [s.batchId]);
    expect(Number(held.rows[0].total)).toBe(700);
    const listed = await query('SELECT COALESCE(SUM(l.available_quantity_kg),0)::numeric AS total FROM listings l JOIN batch_holdings h ON h.id=l.holding_id WHERE h.batch_id=$1 AND l.active', [s.batchId]);
    expect(Number(listed.rows[0].total)).toBeLessThanOrEqual(700);
  });

  it('uses exact gram budgets when creating and editing fractional listings', async () => {
    const s = await supply(0.3); await listing(s, 0.1);
    const created = await request(app).post('/listings').set('Authorization', `Bearer ${seller.token}`)
      .send({ holdingId: s.holdingId, availableQuantityKg: 0.2, pricePerKg: 5, currency: 'EUR', incoterm: 'FOB', originLocation: 'Tema', destinationLocation: 'Rotterdam' });
    expect(created.status).toBe(201);
    const edited = await request(app).patch(`/listings/${created.body.id}`).set('Authorization', `Bearer ${seller.token}`).send({ availableQuantityKg: 0.2 });
    expect(edited.status).toBe(200);
    await conserved(s, 0.3);
  });

  it('conserves exact fractional stock across allocations, transfer reservations and offer acceptance', async () => {
    const allocated = await supply(0.3, false);
    for (const quantityKg of [0.1, 0.2]) {
      expect((await request(app).post('/holdings').set('Authorization', `Bearer ${seller.token}`)
        .send({ batchId: allocated.batchId, quantityKg })).status).toBe(201);
    }
    await conserved(allocated, 0.3);
    const s = await supply(0.3);
    expect((await request(app).post(`/holdings/${s.holdingId}/transfer`).set('Authorization', `Bearer ${seller.token}`)
      .send({ toOrganizationId: outsider.organizationId, quantityKg: 0.1 })).status).toBe(201);
    const l = await listing(s, 0.2);
    const made = await request(app).post(`/listings/${l}/offers`).set('Authorization', `Bearer ${buyer.token}`)
      .send({ quantityKg: 0.2, offeredPricePerKg: 5, currency: 'EUR' });
    expect(made.status).toBe(201);
    expect((await accept(made.body.id)).status).toBe(200);
    await conserved(s, 0.3);
    const pending = await query("SELECT quantity_kg FROM custody_transfers WHERE holding_id=$1 AND status='requested'", [s.holdingId]);
    expect(pending.rows[0].quantity_kg).toBe('0.100');
    const residual = await query('SELECT quantity_kg,status FROM batch_holdings WHERE id=$1', [s.holdingId]);
    expect(residual.rows[0]).toEqual({ quantity_kg: '0.100', status: 'available' });
  });

  it('accepts a duplicate full custody transfer once without zero or duplicated holdings', async () => {
    const s = await supply(); const id = await transfer(s, 1000);
    const results = await Promise.all([1, 2].map(() => request(app).post(`/transfers/${id}/accept`).set('Authorization', `Bearer ${buyer.token}`)));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    await conserved(s);
    expect((await query("SELECT SUM(quantity_kg)::numeric AS total FROM batch_holdings WHERE batch_id=$1 AND holder_organization_id=$2 AND status<>'transferred'", [s.batchId, buyer.organizationId])).rows[0].total).toBe('1000.000');
  });

  it('reserves pending custody transfers so a competing offer cannot consume their stock', async () => {
    const s = await supply(); const id = await transfer(s, 800); const o = await offer(await listing(s), 700);
    const results = await Promise.all([accept(o), request(app).post(`/transfers/${id}/accept`).set('Authorization', `Bearer ${buyer.token}`)]);
    expect(results.map(r => r.status)).toEqual([409, 200]);
    expect((await contractCounts(s)).contracts).toBe(0);
    await conserved(s);
  });

  it('prevents splitting stock already reserved by a pending transfer while the transfer is accepted', async () => {
    const s = await supply(); const id = await transfer(s, 800);
    const results = await Promise.all([request(app).post(`/holdings/${s.holdingId}/split`).set('Authorization', `Bearer ${seller.token}`).send({ quantities: [500, 500] }), request(app).post(`/transfers/${id}/accept`).set('Authorization', `Bearer ${buyer.token}`)]);
    expect([400, 409]).toContain(results[0].status);
    expect(results[1].status).toBe(200);
    await conserved(s);
  });

  it('rejects cross-tenant transfers and conserves a legitimate split', async () => {
    const s = await supply();
    expect((await request(app).post(`/holdings/${s.holdingId}/transfer`).set('Authorization', `Bearer ${outsider.token}`).send({ toOrganizationId: buyer.organizationId, quantityKg: 100 })).status).toBe(404);
    const split = await request(app).post(`/holdings/${s.holdingId}/split`).set('Authorization', `Bearer ${seller.token}`).send({ quantities: [400, 600] });
    expect(split.status).toBe(200);
    await conserved(s);
  });

  it('enforces database quantity, price and state constraints independently of the HTTP API', async () => {
    const s = await supply(); const l = await listing(s); const o = await offer(l);
    for (const value of ['-1', '0', 'NaN']) {
      await expect(query('UPDATE batch_holdings SET quantity_kg=$1::numeric WHERE id=$2', [value, s.holdingId])).rejects.toMatchObject({ code: '23514' });
      await expect(query('UPDATE trade_offers SET quantity_kg=$1::numeric WHERE id=$2', [value, o])).rejects.toMatchObject({ code: '23514' });
      await expect(query('UPDATE listings SET price_per_kg=$1::numeric WHERE id=$2', [value, l])).rejects.toMatchObject({ code: '23514' });
    }
    await expect(query("UPDATE batch_holdings SET status='unreviewed_state' WHERE id=$1", [s.holdingId])).rejects.toMatchObject({ code: '23514' });
    await expect(query("UPDATE trade_offers SET status='unreviewed_state' WHERE id=$1", [o])).rejects.toMatchObject({ code: '23514' });
    await conserved(s);
  });

  it('enforces one contract per offer even when bypassing the application', async () => {
    const s = await supply(); const id = await offer(await listing(s));
    const accepted = await accept(id); expect(accepted.status).toBe(200);
    const c = accepted.body.contract;
    await expect(query(`INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,currency,incoterm)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [c.listing_id,c.offer_id,c.seller_organization_id,c.buyer_organization_id,c.holding_id,c.quantity_kg,c.price_per_kg,c.currency,c.incoterm])).rejects.toMatchObject({ code: '23505' });
    expect((await contractCounts(s)).contracts).toBe(1);
  });

  it('independently detects corrupted allocation while a valid accepted trade reconciles cleanly', async () => {
    const clean = await supply(); const l = await listing(clean); const o = await offer(l);
    expect((await accept(o)).status).toBe(200);
    const related = await query(`SELECT id FROM batch_holdings WHERE batch_id=$1 UNION SELECT id FROM sales_contracts WHERE offer_id=$2 UNION SELECT id FROM listings WHERE id=$3 UNION SELECT id FROM trade_offers WHERE id=$2`, [clean.batchId,o,l]);
    const cleanIds = new Set([clean.batchId,...related.rows.map(row => row.id)]);
    expect((await reconcileTradeIntegrity(pool)).filter(issue => cleanIds.has(issue.entity_id))).toEqual([]);
    const corrupted = await supply();
    const badHolding = await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,1) RETURNING id', [corrupted.batchId,seller.organizationId]);
    try { expect(await reconcileTradeIntegrity(pool)).toContainEqual({ code: 'SOURCE_OVERALLOCATED', entity_type: 'batch', entity_id: corrupted.batchId }); }
    finally { await query('DELETE FROM batch_holdings WHERE id=$1', [badHolding.rows[0].id]); }
  });

});
