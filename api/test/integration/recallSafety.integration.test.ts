import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { getClient, pool, query } from '../../src/db';
import { up as backfillRecallHolds } from '../../src/migrations/022_recall_safety_holds';
import { reconcileRecallSafety } from '../../src/modules/recall/reconciliation';
import { evidenceStorage } from '../../src/services/evidenceStorage';
import { parseLotPage, readLotPage } from '../../src/modules/trace/lotPage';
import { withTraceRead } from '../../src/services/traceGraphRepository';

type Actor = { id: string; organizationId: string; token: string };
type Supply = { batchId: string; holdingId: string; lotId: string; listingId: string };
let seller: Actor, buyer: Actor, outsider: Actor, unprivileged: Actor;
const resolutionEvidence = new Map<string, string>();

async function actor(type: 'exporter' | 'importer', permissions = true): Promise<Actor> {
  const suffix = crypto.randomUUID();
  const organization = (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id", [`Recall regression ${suffix}`, type])).rows[0];
  const email = `recall-${suffix}@integration.test`, password = 'RecallRegressionPassword123!';
  const user = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [organization.id, email, await bcrypt.hash(password, 4), 'Recall Regression'])).rows[0];
  const role = (await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [`recall-${suffix}`, permissions ? ['batch.create', 'batch.read', 'holding.read', 'holding.create', 'custody.transfer.request', 'custody.transfer.accept', 'listing.read', 'listing.create', 'offer.create', 'offer.respond', 'contract.read', 'shipment.read', 'shipment.update', 'recall.manage', 'evidence.read', 'evidence.upload'] : []])).rows[0];
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id, role.id]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  return { id: user.id, organizationId: organization.id, token: login.body.accessToken };
}

async function supply(quantity = 10): Promise<Supply> {
  const inventory = await request(app).post('/inventory/direct').set('Authorization', `Bearer ${seller.token}`).send({ commodity: 'shea nuts', quantityKg: quantity, inventoryDate: new Date().toISOString().slice(0, 10), sourceName: 'Supplier warehouse', sourceCountry: 'GH' });
  expect(inventory.status).toBe(201);
  const lot = (await query('SELECT id FROM material_lots WHERE batch_id=$1', [inventory.body.id])).rows[0];
  const published = await request(app).post('/listings').set('Authorization', `Bearer ${seller.token}`).send({ holdingId: inventory.body.holding_id, availableQuantityKg: quantity, pricePerKg: 5, currency: 'EUR', incoterm: 'FOB', originLocation: 'Tema', destinationLocation: 'Rotterdam' });
  expect(published.status).toBe(201);
  return { batchId: inventory.body.id, holdingId: inventory.body.holding_id, lotId: lot.id, listingId: published.body.id };
}

function recall(s: Supply, principal = seller) {
  return request(app).post('/recalls').set('Authorization', `Bearer ${principal.token}`).send({ referenceCode: `R-${crypto.randomUUID()}`, title: 'Possible product contamination', reason: 'Investigate a reported contaminant', instructions: 'Stop dispatch and isolate affected inventory', severity: 'critical', batchIds: [s.batchId] });
}
async function resolve(id: string, principal = seller) {
  let evidenceId = resolutionEvidence.get(id);
  if (!evidenceId) {
    const content = Buffer.from('%PDF-1.7\nCompleted recall investigation.');
    const intent = await request(app).post('/evidence/upload-intents').set('Authorization', `Bearer ${seller.token}`).send({ type: 'investigation_report', fileName: 'resolution.pdf', mimeType: 'application/pdf', fileSizeBytes: content.length, linkedEntityType: 'recall', linkedEntityId: id });
    expect(intent.status).toBe(201);
    const uploaded = await request(app).put(intent.body.uploadUrl).set('Content-Type', 'application/pdf').send(content);
    expect(uploaded.status).toBe(201);
    evidenceId = uploaded.body.id;
    resolutionEvidence.set(id, evidenceId!);
    const participants = (await query('SELECT organization_id FROM recall_participants WHERE recall_id=$1 AND acknowledged_at IS NULL', [id])).rows;
    for (const participant of participants) {
      const owner = [seller, buyer, outsider].find(actor => actor.organizationId === participant.organization_id)!;
      expect(owner).toBeDefined();
      expect((await request(app).post(`/recalls/${id}/acknowledge`).set('Authorization', `Bearer ${owner.token}`).send({ note: 'Notice received and affected inventory investigated' })).status).toBe(200);
    }
    const holdings = (await query("SELECT h.* FROM recall_safety_holds hold JOIN batch_holdings h ON h.id=hold.entity_id WHERE hold.recall_id=$1 AND hold.entity_type='holding' AND h.status<>'transferred' AND h.quantity_kg>0", [id])).rows;
    for (const holding of holdings) {
      const owner = [seller, buyer, outsider].find(actor => actor.organizationId === holding.holder_organization_id)!;
      expect(owner).toBeDefined();
      const recovered = await request(app).put(`/recalls/${id}/recovery/${holding.id}`).set('Authorization', `Bearer ${owner.token}`).send({ quarantinedKg: 0, returnedKg: 0, destroyedKg: 0, correctedKg: 0, releasedKg: Number(holding.quantity_kg), note: 'Investigation cleared this inventory for release' });
      expect(recovered.status).toBe(200);
    }
  }
  return request(app).post(`/recalls/${id}/resolve`).set('Authorization', `Bearer ${principal.token}`).send({ reason: 'Investigation complete; source records reviewed', evidenceIds: [evidenceId] });
}

function makeOffer(s: Supply, quantity = 4) {
  return request(app).post(`/listings/${s.listingId}/offers`).set('Authorization', `Bearer ${buyer.token}`).send({ quantityKg: quantity, offeredPricePerKg: 5, currency: 'EUR' });
}
function accept(id: string) { return request(app).post(`/offers/${id}/accept`).set('Authorization', `Bearer ${seller.token}`); }
async function snapshot(s: Supply) {
  return (await query('SELECT id,quantity_kg,status,holder_organization_id FROM batch_holdings WHERE batch_id=$1 ORDER BY id', [s.batchId])).rows;
}
function publish(s: Supply) {
  return request(app).post('/listings').set('Authorization', `Bearer ${seller.token}`).send({ holdingId: s.holdingId, availableQuantityKg: 1, pricePerKg: 5, originLocation: 'Tema', destinationLocation: 'Rotterdam' });
}
function blocked(response: { status: number; body: { code?: string } }) {
  expect(response.status).toBe(409);
  expect(response.body.code).toBe('ACTIVE_RECALL');
}

beforeAll(async () => { seller = await actor('exporter'); buyer = await actor('importer'); outsider = await actor('exporter'); unprivileged = await actor('exporter', false); });

describe('bounded trace lot selector', () => {
  it('pages beyond the graph cap, searches before limiting and rejects foreign cursors without leaking lots', async () => {
    const prefix = `page-${crypto.randomUUID()}-`;
    const fixtures = (await query(`INSERT INTO material_lots(lot_code,lot_type,product_name,quantity_kg,owner_organization_id)
      SELECT $1||n,'production','Page fixture',1,$2 FROM generate_series(1,2501) n RETURNING id,lot_code`, [prefix, seller.organizationId])).rows;
    const foreign = (await query(`INSERT INTO material_lots(lot_code,lot_type,product_name,quantity_kg,owner_organization_id)
      VALUES($1,'production','Page fixture',1,$2) RETURNING id`, [prefix + 'FOREIGN', outsider.organizationId])).rows[0];
    const get = (parameters: Record<string, string>, principal = seller) => request(app).get('/traceability/lots/page').query(parameters).set('Authorization', `Bearer ${principal.token}`);
    try {
      const first = await get({ search: prefix, limit: '100' });
      expect(first.status).toBe(200);
      expect(first.body.items).toHaveLength(100);
      expect(first.body.hasMore).toBe(true);
      // Measure the actual PostgreSQL plan against 2,501 permitted records.
      // Assertion is structural, not a hardware-dependent wall-clock threshold.
      await withTraceRead(async execute => {
        await readLotPage(async (sql, parameters) => {
          const explained = await execute(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, parameters);
          const report = explained.rows[0]['QUERY PLAN'][0];
          expect(report['Execution Time']).toBeGreaterThanOrEqual(0);
          const pending = [report.Plan];
          let boundedPageFound = false;
          while (pending.length) {
            const node = pending.pop();
            if (node['Node Type'] === 'Limit') { expect(node['Actual Rows']).toBeLessThanOrEqual(101); boundedPageFound = true; }
            pending.push(...(node.Plans || []));
          }
          expect(boundedPageFound).toBe(true);
          return execute(sql, parameters);
        }, seller.organizationId, false, parseLotPage({ search: prefix, limit: '100' }, seller.organizationId, false));
      });
      const second = await get({ search: prefix, limit: '100', cursor: first.body.nextCursor });
      expect(second.status).toBe(200);
      expect(second.body.items).toHaveLength(100);
      const ids = [...first.body.items, ...second.body.items].map((lot: { id: string }) => lot.id);
      expect(new Set(ids).size).toBe(200);
      expect(ids).toEqual([...ids].sort());
      expect(ids).not.toContain(foreign.id);
      const beyond = fixtures.find(lot => !ids.includes(lot.id))!;
      const found = await get({ search: beyond.id });
      expect(found.status).toBe(200);
      expect(found.body.items.map((lot: { id: string }) => lot.id)).toEqual([beyond.id]);
      expect(found.body.nextCursor).toBeNull();
      await query('UPDATE material_lots SET owner_organization_id=$1 WHERE id=$2', [outsider.organizationId, beyond.id]);
      expect((await get({ search: beyond.id })).body.items).toEqual([]);
      expect((await get({ search: foreign.id })).body.items).toEqual([]);
      expect((await get({ search: prefix, cursor: first.body.nextCursor }, outsider)).status).toBe(400);
      expect((await get({ search: 'different', cursor: first.body.nextCursor })).status).toBe(400);
      for (const parameters of [{ limit: '101' }, { search: 'x'.repeat(81) }, { cursor: 'invalid' }] as Record<string, string>[]) expect((await get(parameters)).status).toBe(400);
      expect((await get({}, unprivileged)).status).toBe(403);
      expect((await request(app).get('/traceability/lots/page')).status).toBe(401);
    } finally {
      await query('DELETE FROM material_lots WHERE id=ANY($1::uuid[])', [[...fixtures.map(lot => lot.id), foreign.id]]);
    }
  });

  it('includes recorded custody and trade access without duplicating a lot', async () => {
    const s = await supply();
    const offer = await makeOffer(s);
    expect(offer.status).toBe(201);
    expect((await accept(offer.body.id)).status).toBe(200);
    const result = await request(app).get('/traceability/lots/page').query({ search: s.lotId }).set('Authorization', `Bearer ${buyer.token}`);
    expect(result.status).toBe(200);
    expect(result.body.items.map((lot: { id: string }) => lot.id)).toEqual([s.lotId]);
  });
});
afterAll(async () => {
  const ids = [...resolutionEvidence.values()];
  if (ids.length) {
    const rows = (await query('SELECT storage_key FROM evidence_items WHERE id=ANY($1::uuid[])', [ids])).rows;
    await Promise.all(rows.filter(row => row.storage_key).map(row => evidenceStorage().delete(row.storage_key)));
  }
  await pool.end();
});

describe('real PostgreSQL recall containment', () => {
  it('requires authentication, recall permission and an actual inventory relationship', async () => {
    const s = await supply();
    expect((await request(app).post('/recalls').send({})).status).toBe(401);
    expect((await recall(s, unprivileged)).status).toBe(403);
    expect((await recall(s, outsider)).status).toBe(403);
    expect((await query('SELECT * FROM recall_affected_batches WHERE batch_id=$1', [s.batchId])).rows).toHaveLength(0);
  });

  it('atomically places safety holds, withdraws supply and audits activation without changing quantities or ownership', async () => {
    const s = await supply(10.125), before = await snapshot(s);
    const activated = await recall(s);
    expect(activated.status).toBe(201);
    const holds = (await query('SELECT entity_type,entity_id FROM recall_safety_holds WHERE recall_id=$1 ORDER BY entity_type', [activated.body.id])).rows;
    expect(holds).toEqual([{ entity_type: 'holding', entity_id: s.holdingId }, { entity_type: 'lot', entity_id: s.lotId }]);
    expect((await query('SELECT active FROM listings WHERE id=$1', [s.listingId])).rows[0].active).toBe(false);
    expect(await snapshot(s)).toEqual(before);
    const audit = (await query("SELECT actor_user_id,actor_organization_id FROM audit_events WHERE action='recall.activate' AND entity_id=$1", [activated.body.id])).rows;
    expect(audit).toEqual([{ actor_user_id: seller.id, actor_organization_id: seller.organizationId }]);
    const details = await request(app).get(`/listings/${s.listingId}`).set('Authorization', `Bearer ${buyer.token}`);
    expect(details.status).toBe(200);
    expect(details.body.activeRecall).toBe(true);
    expect((await makeOffer(s)).status).toBe(409);
    blocked(await publish(s));
    blocked(await request(app).patch(`/listings/${s.listingId}`).set('Authorization', `Bearer ${seller.token}`).send({ active: true }));
  });

  it('rolls back the notice, holds and listing withdrawal if the required audit cannot be written', async () => {
    const s = await supply(), before = await snapshot(s), name = `recall_audit_${crypto.randomUUID().replaceAll('-', '')}`;
    await query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='recall.activate' AND NEW.actor_user_id='${seller.id}'::uuid THEN RAISE EXCEPTION 'injected recall audit failure'; END IF; RETURN NEW; END $$`);
    await query(`CREATE TRIGGER ${name} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${name}()`);
    try {
      expect((await recall(s)).status).toBe(500);
      expect((await query('SELECT * FROM recall_affected_batches WHERE batch_id=$1', [s.batchId])).rows).toHaveLength(0);
      expect((await query('SELECT * FROM recall_safety_holds WHERE entity_id=ANY($1::uuid[])', [[s.holdingId, s.lotId]])).rows).toHaveLength(0);
      expect((await query('SELECT active FROM listings WHERE id=$1', [s.listingId])).rows[0].active).toBe(true);
      expect(await snapshot(s)).toEqual(before);
    } finally { await query(`DROP TRIGGER ${name} ON audit_events`); await query(`DROP FUNCTION ${name}()`); }
  });

  it('keeps overlapping recall holds until every active notice is resolved and never automatically relists', async () => {
    const s = await supply(), before = await snapshot(s), first = await recall(s), second = await recall(s);
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    expect((await resolve(first.body.id, outsider)).status).toBe(404);
    expect((await resolve(first.body.id)).status).toBe(200);
    expect((await publish(s)).status).toBe(409);
    expect((await resolve(second.body.id)).status).toBe(200);
    expect((await resolve(second.body.id)).status).toBe(409);
    expect((await query('SELECT active FROM listings WHERE id=$1', [s.listingId])).rows[0].active).toBe(false);
    expect(await snapshot(s)).toEqual(before);
    expect((await publish(s)).status).toBe(201);
    const audit = (await query("SELECT entity_id FROM audit_events WHERE action='recall.resolve' AND entity_id=ANY($1::uuid[])", [[first.body.id, second.body.id]])).rows;
    expect(audit).toHaveLength(2);
  });

  it.skipIf(process.env.COCOATRACE_SUPPLEMENTAL_DATABASE === 'true')('keeps the recall active and its holds unreleased when resolution audit fails', async () => {
    const s = await supply(), activated = await recall(s), name = `recall_resolve_${crypto.randomUUID().replaceAll('-', '')}`;
    expect(activated.status).toBe(201);
    await query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='recall.resolve' AND NEW.entity_id='${activated.body.id}'::uuid THEN RAISE EXCEPTION 'injected resolution audit failure'; END IF; RETURN NEW; END $$`);
    await query(`CREATE TRIGGER ${name} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${name}()`);
    try {
      expect((await resolve(activated.body.id)).status).toBe(500);
      expect((await query('SELECT status,resolved_at FROM recall_notices WHERE id=$1', [activated.body.id])).rows[0]).toEqual({ status: 'active', resolved_at: null });
      expect((await query('SELECT released_at FROM recall_safety_holds WHERE recall_id=$1', [activated.body.id])).rows.every(hold => hold.released_at === null)).toBe(true);
      blocked(await publish(s));
    } finally { await query(`DROP TRIGGER ${name} ON audit_events`); await query(`DROP FUNCTION ${name}()`); }
  });

  it('blocks acceptance of pending offers and custody transfers, fresh transfers, splitting and batch republication', async () => {
    const s = await supply(), offer = await makeOffer(s);
    expect(offer.status).toBe(201);
    // Reserve unlisted stock through the real transfer endpoint before containment.
    await request(app).patch(`/listings/${s.listingId}`).set('Authorization', `Bearer ${seller.token}`).send({ active: false });
    const transfer = await request(app).post(`/holdings/${s.holdingId}/transfer`).set('Authorization', `Bearer ${seller.token}`).send({ toOrganizationId: buyer.organizationId, quantityKg: 2 });
    expect(transfer.status).toBe(201);
    const before = await snapshot(s);
    expect((await recall(s)).status).toBe(201);
    blocked(await accept(offer.body.id));
    blocked(await request(app).post(`/transfers/${transfer.body.id}/accept`).set('Authorization', `Bearer ${buyer.token}`));
    blocked(await request(app).post(`/holdings/${s.holdingId}/transfer`).set('Authorization', `Bearer ${seller.token}`).send({ toOrganizationId: buyer.organizationId, quantityKg: 1 }));
    blocked(await request(app).post(`/holdings/${s.holdingId}/split`).set('Authorization', `Bearer ${seller.token}`).send({ quantities: [5, 5] }));
    blocked(await request(app).post(`/batches/${s.batchId}/push-to-marketplace`).set('Authorization', `Bearer ${seller.token}`).send({ quantityKg: 1, pricePerKg: 5, originLocation: 'Tema', destinationLocation: 'Rotterdam' }));
    expect(await snapshot(s)).toEqual(before);
    expect((await query('SELECT status FROM custody_transfers WHERE id=$1', [transfer.body.id])).rows[0].status).toBe('requested');
  });

  it('guides newly created inventory through an accepted trade then refuses recalled dispatch even with a payment exception', async () => {
    const s = await supply(), offer = await makeOffer(s);
    expect(offer.status).toBe(201);
    const accepted = await accept(offer.body.id);
    expect(accepted.status).toBe(200);
    const shipment = (await query('SELECT id,current_milestone FROM shipments WHERE contract_id=$1', [accepted.body.contract.id])).rows[0], before = await snapshot(s);
    expect((await recall(s)).status).toBe(201);
    for (const milestone of ['picked_up', 'handed_over', 'loaded', 'departed', 'arrived', 'delivered']) {
      const progress = await request(app).post(`/shipments/${shipment.id}/milestones`).set('Authorization', `Bearer ${['departed','arrived','delivered'].includes(milestone)?buyer.token:seller.token}`).send({ milestone, exceptionalDispatch: { reason: 'Previously agreed exception to payment terms', acknowledgePaymentRisk: true } });
      blocked(progress);
    }
    expect((await query('SELECT current_milestone,dispatch_exception FROM shipments WHERE id=$1', [shipment.id])).rows[0]).toEqual({ current_milestone: shipment.current_milestone, dispatch_exception: false });
    expect(await snapshot(s)).toEqual(before);
    expect((await query('SELECT * FROM shipment_milestones WHERE shipment_id=$1 AND milestone=ANY($2::text[])', [shipment.id, ['picked_up', 'loaded', 'departed', 'arrived', 'delivered']])).rows).toHaveLength(0);
  });

  it.skipIf(process.env.COCOATRACE_SUPPLEMENTAL_DATABASE === 'true')('allows receipt and containment reporting for recalled cargo already dispatched, while preventing further departure', async () => {
    const s = await supply(), offer = await makeOffer(s), accepted = await accept(offer.body.id);
    expect(offer.status).toBe(201); expect(accepted.status).toBe(200);
    const shipment = (await query('SELECT id FROM shipments WHERE contract_id=$1', [accepted.body.contract.id])).rows[0];
    const loaded = await request(app).post(`/shipments/${shipment.id}/milestones`).set('Authorization', `Bearer ${seller.token}`).send({ milestone: 'loaded', exceptionalDispatch: { reason: 'Approved commercial risk before safety notice', acknowledgePaymentRisk: true } });
    expect(loaded.status).toBe(200);
    expect((await recall(s)).status).toBe(201);
    blocked(await request(app).post(`/shipments/${shipment.id}/milestones`).set('Authorization', `Bearer ${buyer.token}`).send({ milestone: 'departed' }));
    const arrived = await request(app).post(`/shipments/${shipment.id}/milestones`).set('Authorization', `Bearer ${buyer.token}`).send({ milestone: 'arrived', notes: 'Received into isolated containment area' });
    expect(arrived.status).toBe(200);
    expect((await query('SELECT current_milestone FROM shipments WHERE id=$1', [shipment.id])).rows[0].current_milestone).toBe('arrived');
    blocked(await publish(s));
  });

  it('backfills existing active notices without altering inventory and leaves resolved historical notices unheld', async () => {
    const activeSupply = await supply(), resolvedSupply = await supply(), before = await snapshot(activeSupply);
    const client = await getClient();
    try {
      // Exercise the migration against a pre-022 state inside this disposable
      // database transaction. Rollback restores the original table and fixtures.
      await client.query('BEGIN');
      await client.query('DROP TABLE recall_safety_holds');
      const ids: string[] = [];
      for (const [s, status] of [[activeSupply, 'active'], [resolvedSupply, 'resolved']] as const) {
        const legacy = (await client.query("INSERT INTO recall_notices(reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id) VALUES($1,'Legacy recall','Review legacy source','Isolate source','warning',$2,$3,$4) RETURNING id", [`LEGACY-${crypto.randomUUID()}`, status, seller.id, seller.organizationId])).rows[0];
        ids.push(legacy.id);
        // Historical notices may have lot impact but no affected-batch rows.
        await client.query('INSERT INTO recall_affected_lots(recall_id,lot_id,source_equivalent_kg,recall_quantity_kg,relationship_depth) VALUES($1,$2,10,10,0)', [legacy.id, s.lotId]);
      }
      await backfillRecallHolds({ raw: (sql: string) => client.query(sql) } as unknown as Knex);
      const holds = (await client.query('SELECT entity_type,entity_id FROM recall_safety_holds WHERE recall_id=$1 ORDER BY entity_type', [ids[0]])).rows;
      expect(holds).toEqual([{ entity_type: 'holding', entity_id: activeSupply.holdingId }, { entity_type: 'lot', entity_id: activeSupply.lotId }]);
      expect((await client.query('SELECT * FROM recall_safety_holds WHERE recall_id=$1', [ids[1]])).rows).toHaveLength(0);
      expect((await client.query('SELECT batch_id FROM recall_affected_batches WHERE recall_id=$1', [ids[0]])).rows).toEqual([{ batch_id: activeSupply.batchId }]);
      expect((await client.query('SELECT active FROM listings WHERE id=$1', [activeSupply.listingId])).rows[0].active).toBe(false);
      expect((await client.query('SELECT active FROM listings WHERE id=$1', [resolvedSupply.listingId])).rows[0].active).toBe(true);
      expect((await client.query('SELECT id,quantity_kg,status,holder_organization_id FROM batch_holdings WHERE batch_id=$1 ORDER BY id', [activeSupply.batchId])).rows).toEqual(before);
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  it('reports unsafe historical publication and missing holds without repairing or mutating them', async () => {
    const s = await supply(), activated = await recall(s);
    expect(activated.status).toBe(201);
    const client = await getClient();
    try {
      expect((await reconcileRecallSafety(client)).ok).toBe(true);
      await client.query('BEGIN');
      await client.query('UPDATE listings SET active=TRUE WHERE id=$1', [s.listingId]);
      await client.query("DELETE FROM recall_safety_holds WHERE recall_id=$1 AND entity_type='holding' AND entity_id=$2", [activated.body.id, s.holdingId]);
      const report = await reconcileRecallSafety(client);
      expect(report.ok).toBe(false);
      expect(report.issues).toEqual(expect.arrayContaining([
        { code: 'ACTIVE_RECALL_LISTING_PUBLISHED', entity_type: 'listing', entity_id: s.listingId },
        { code: 'ACTIVE_RECALL_HOLD_MISSING', entity_type: 'holding', entity_id: s.holdingId },
      ]));
      expect((await client.query('SELECT active FROM listings WHERE id=$1', [s.listingId])).rows[0].active).toBe(true);
      expect((await client.query("SELECT * FROM recall_safety_holds WHERE recall_id=$1 AND entity_type='holding' AND entity_id=$2", [activated.body.id, s.holdingId])).rows).toHaveLength(0);
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  it.skipIf(process.env.COCOATRACE_SUPPLEMENTAL_DATABASE === 'true')('serializes recall activation against offer acceptance without publishing recalled residual stock', async () => {
    const s = await supply(), offer = await makeOffer(s);
    expect(offer.status).toBe(201);
    const [activated, accepted] = await Promise.all([recall(s), accept(offer.body.id)]);
    expect(activated.status).toBe(201);
    expect([200, 409]).toContain(accepted.status);
    const holdings = await snapshot(s);
    expect(holdings.reduce((sum, h) => sum + Number(h.quantity_kg), 0)).toBe(10);
    expect((await query('SELECT l.id FROM listings l JOIN batch_holdings h ON h.id=l.holding_id WHERE h.batch_id=$1 AND l.active', [s.batchId])).rows).toHaveLength(0);
    const heldIds = (await query("SELECT entity_id FROM recall_safety_holds WHERE recall_id=$1 AND entity_type='holding'", [activated.body.id])).rows.map(h => h.entity_id).sort();
    expect(heldIds).toEqual(holdings.map(h => h.id).sort());
  });
});

// Corrupt/oversized fixtures are confined to the disposable PostgreSQL stack.
// Every fixture is removed so later resource-boundary tests remain independent.
describe('bounded recall analysis atomicity', () => {
  it('rejects cyclic analysis and activation without partial notices, holds or inventory changes', async () => {
    const s = await supply();
    const otherLot = (await query(`INSERT INTO material_lots(lot_code,lot_type,product_name,quantity_kg,owner_organization_id)
      VALUES($1,'production','Cycle fixture',10,$2) RETURNING id`, [`cycle-${crypto.randomUUID()}`, seller.organizationId])).rows[0].id;
    const event = (await query(`INSERT INTO transformation_events(event_code,event_type,facility_organization_id,occurred_at)
      VALUES($1,'blend',$2,NOW()) RETURNING id`, [`cycle-${crypto.randomUUID()}`, seller.organizationId])).rows[0].id;
    const before = await snapshot(s);
    const noticeCount = Number((await query('SELECT COUNT(*) FROM recall_notices')).rows[0].count);
    try {
      await query(`INSERT INTO lot_genealogy_edges(transformation_event_id,source_lot_id,destination_lot_id,allocated_input_kg)
        VALUES($1,$2,$3,10),($1,$3,$2,10)`, [event, s.lotId, otherLot]);
      const traced = await request(app).get(`/traceability/lots/${s.lotId}/trace-forward`).set('Authorization', `Bearer ${seller.token}`);
      expect(traced.status).toBe(422);
      expect(traced.body).toMatchObject({ code: 'TRACE_ANALYSIS_INCOMPLETE', analysis: { status: 'incomplete', reason: 'CYCLE', safetyClearance: false } });
      expect(traced.body.impactedLots).toBeUndefined();
      const activation = await recall(s);
      expect(activation.status).toBe(422);
      expect(activation.body.analysis.reason).toBe('CYCLE');
      expect(Number((await query('SELECT COUNT(*) FROM recall_notices')).rows[0].count)).toBe(noticeCount);
      expect((await query('SELECT 1 FROM recall_safety_holds WHERE entity_id=$1', [s.lotId])).rows).toEqual([]);
      expect(await snapshot(s)).toEqual(before);
      const listing = (await query('SELECT active FROM listings WHERE id=$1', [s.listingId])).rows[0];
      expect(listing.active).toBe(true);
      // Failure to activate is explicitly reported: this is not a clearance.
    } finally {
      await query('DELETE FROM transformation_events WHERE id=$1', [event]);
      await query('DELETE FROM material_lots WHERE id=$1', [otherLot]);
    }
  });

  it('does not load an unrelated oversized component and denies foreign seeds before analyzing them', async () => {
    const { TRACE_LIMITS } = await import('../../src/modules/trace/limits');
    const s = await supply();
    const prefix = `oversize-${crypto.randomUUID()}-`;
    const lots = (await query(`INSERT INTO material_lots(lot_code,lot_type,product_name,quantity_kg,owner_organization_id)
      SELECT $1||n,'production','Capacity fixture',1,$2 FROM generate_series(1,$3::int) n RETURNING id`, [prefix, outsider.organizationId, TRACE_LIMITS.lots + 1])).rows;
    const event = (await query(`INSERT INTO transformation_events(event_code,event_type,facility_organization_id,occurred_at)
      VALUES($1,'blend',$2,NOW()) RETURNING id`, [prefix, outsider.organizationId])).rows[0].id;
    const root = lots[0].id;
    try {
      await query(`INSERT INTO lot_genealogy_edges(transformation_event_id,source_lot_id,destination_lot_id,allocated_input_kg)
        SELECT $1,$2,unnest($3::uuid[]),1`, [event, root, lots.slice(1).map(lot => lot.id)]);
      const small = await request(app).get(`/traceability/lots/${s.lotId}/trace-forward`).set('Authorization', `Bearer ${seller.token}`);
      expect(small.status).toBe(200);
      expect(small.body.analysis.status).toBe('complete');
      expect(small.body.impactedLots).toHaveLength(1);
      const foreign = await request(app).get(`/traceability/lots/${root}/trace-forward`).set('Authorization', `Bearer ${seller.token}`);
      expect(foreign.status).toBe(403);
      const large = await request(app).get(`/traceability/lots/${root}/trace-forward`).set('Authorization', `Bearer ${outsider.token}`);
      expect(large.status).toBe(422);
      expect(large.body.analysis).toEqual({ status: 'incomplete', reason: 'LOTS_LIMIT', safetyClearance: false });
    } finally {
      await query('DELETE FROM transformation_events WHERE id=$1', [event]);
      await query('DELETE FROM material_lots WHERE id=ANY($1::uuid[])', [lots.map(lot => lot.id)]);
    }
  });
});
