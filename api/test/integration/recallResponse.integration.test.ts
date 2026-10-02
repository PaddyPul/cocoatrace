import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { getClient, pool, query } from '../../src/db';
import { evidenceStorage } from '../../src/services/evidenceStorage';
import { processRecallEmails, queueRecallEmails } from '../../src/modules/recall/notifications';
import type { EmailMessage, EmailSender } from '../../src/services/emailSender';
import { reconcileRecallSafety } from '../../src/modules/recall/reconciliation';
import { activeBatchRecallSql } from '../../src/modules/recall/safety';

type Actor = { id: string; organizationId: string; token: string };
type Case = { batchId: string; holdingId: string; buyerHoldingId?: string; recallId: string; noContactOrganizationId?: string };
let seller: Actor, buyer: Actor, outsider: Actor;
const evidenceIds: string[] = [];

async function actor(type: 'exporter' | 'importer', manage: boolean, readEvidence = true): Promise<Actor> {
  const suffix = crypto.randomUUID();
  const organization = (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id", [`Recall response ${suffix}`, type])).rows[0];
  const email = `response-${suffix}@integration.test`, password = 'RecallResponsePassword123!';
  const user = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [organization.id, email, await bcrypt.hash(password, 4), 'Recall Response'])).rows[0];
  const permissions = ['batch.create', 'holding.read', 'holding.create', 'custody.transfer.request', 'custody.transfer.accept', 'listing.create', 'listing.read', 'evidence.upload', ...(readEvidence ? ['evidence.read'] : []), ...(manage ? ['recall.manage'] : [])];
  const role = (await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id', [`response-${suffix}`, permissions])).rows[0];
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id, role.id]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  return { id: user.id, organizationId: organization.id, token: login.body.accessToken };
}

async function scenario(withBuyer = false, transferQuantity = 4, recipientWithoutContact = false): Promise<Case> {
  const inventory = await request(app).post('/inventory/direct').set('Authorization', `Bearer ${seller.token}`).send({ commodity: 'shea nuts', quantityKg: 10, inventoryDate: new Date().toISOString().slice(0, 10), sourceCountry: 'GH', sourceName: 'Supplier warehouse' });
  expect(inventory.status).toBe(201);
  let buyerHoldingId: string | undefined;
  let noContactOrganizationId: string | undefined;
  if (withBuyer) {
    const transfer = await request(app).post(`/holdings/${inventory.body.holding_id}/transfer`).set('Authorization', `Bearer ${seller.token}`).send({ toOrganizationId: buyer.organizationId, quantityKg: transferQuantity });
    expect(transfer.status).toBe(201);
    const accepted = await request(app).post(`/transfers/${transfer.body.id}/accept`).set('Authorization', `Bearer ${buyer.token}`);
    expect(accepted.status).toBe(200);
    buyerHoldingId = accepted.body.newHolding.id;
  }
  if (recipientWithoutContact) {
    noContactOrganizationId = (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,'importer','NL','verified') RETURNING id", [`External recipient ${crypto.randomUUID()}`])).rows[0].id;
    const lot = (await query('SELECT id FROM material_lots WHERE batch_id=$1', [inventory.body.id])).rows[0];
    await query('INSERT INTO lot_distributions(lot_id,recipient_organization_id,quantity_kg,distribution_reference,dispatched_at) VALUES($1,$2,1,$3,NOW())', [lot.id, noContactOrganizationId, `EXTERNAL-${crypto.randomUUID()}`]);
  }
  const activated = await request(app).post('/recalls').set('Authorization', `Bearer ${seller.token}`).send({ referenceCode: `RESPONSE-${crypto.randomUUID()}`, title: 'Investigate contamination', reason: 'Potential contamination reported', instructions: 'Isolate goods and record outcome', severity: 'critical', batchIds: [inventory.body.id] });
  expect(activated.status).toBe(201);
  return { batchId: inventory.body.id, holdingId: inventory.body.holding_id, buyerHoldingId, recallId: activated.body.id, noContactOrganizationId };
}
function details(c: Case, actor = seller) { return request(app).get(`/recalls/${c.recallId}/response`).set('Authorization', `Bearer ${actor.token}`); }
function ack(c: Case, actor = buyer) { return request(app).post(`/recalls/${c.recallId}/acknowledge`).set('Authorization', `Bearer ${actor.token}`).send({ note: 'Safety notice read and affected goods isolated' }); }
function recovery(c: Case, holdingId: string, actor: Actor, values: Record<string, number | string>) {
  return request(app).put(`/recalls/${c.recallId}/recovery/${holdingId}`).set('Authorization', `Bearer ${actor.token}`).send({ quarantinedKg: 0, returnedKg: 0, destroyedKg: 0, correctedKg: 0, releasedKg: 0, note: 'Investigated inventory and recorded physical outcome', ...values });
}
function resolve(c: Case, ids: string[] = []) { return request(app).post(`/recalls/${c.recallId}/resolve`).set('Authorization', `Bearer ${seller.token}`).send({ reason: 'Investigation completed and all affected inventory accounted for', evidenceIds: ids }); }
async function proof(c: Case, actor = seller, entityType = 'recall', entityId = c.recallId): Promise<string> {
  const content = Buffer.from('%PDF-1.7\nRecall investigation report.');
  const intent = await request(app).post('/evidence/upload-intents').set('Authorization', `Bearer ${actor.token}`).send({ type: 'other', fileName: 'investigation.pdf', mimeType: 'application/pdf', fileSizeBytes: content.length, linkedEntityType: entityType, linkedEntityId: entityId, claimDescription: 'External investigation report' });
  expect(intent.status).toBe(201);
  const uploaded = await request(app).put(intent.body.uploadUrl).set('Content-Type', 'application/pdf').send(content);
  expect(uploaded.status).toBe(201);
  evidenceIds.push(uploaded.body.id);
  return uploaded.body.id;
}
async function inventory(c: Case) { return (await query('SELECT id,holder_organization_id,quantity_kg,status FROM batch_holdings WHERE batch_id=$1 ORDER BY id', [c.batchId])).rows; }
function publish(c: Case) { return request(app).post('/listings').set('Authorization', `Bearer ${seller.token}`).send({ holdingId: c.holdingId, availableQuantityKg: 1, pricePerKg: 5, originLocation: 'Tema', destinationLocation: 'Rotterdam' }); }

beforeAll(async () => { seller = await actor('exporter', true); buyer = await actor('importer', false, false); outsider = await actor('exporter', true); });
afterAll(async () => {
  if (evidenceIds.length) {
    const stored = (await query('SELECT storage_key FROM evidence_items WHERE id=ANY($1::uuid[])', [evidenceIds])).rows;
    await Promise.all(stored.filter(row => row.storage_key).map(row => evidenceStorage().delete(row.storage_key)));
  }
  await pool.end();
});

describe('real PostgreSQL buyer and supplier recall response', () => {
  it('makes notices visible to affected buyers without manager permission and excludes unrelated organizations', async () => {
    const c = await scenario(true), evidence = await proof(c);
    expect((await request(app).get(`/recalls/${c.recallId}/response`)).status).toBe(401);
    expect((await details(c, outsider)).status).toBe(404);
    const own = await details(c, buyer);
    expect(own.status).toBe(200);
    expect(own.body.canManage).toBe(false);
    expect(JSON.stringify(own.body)).toContain(c.buyerHoldingId);
    expect(JSON.stringify(own.body)).not.toContain(c.holdingId);
    expect(JSON.stringify(own.body)).not.toContain(evidence);
    expect(JSON.stringify(own.body)).not.toContain('investigation.pdf');
    const list = await request(app).get('/recalls').set('Authorization', `Bearer ${buyer.token}`);
    expect(list.status).toBe(200);
    expect(list.body.some((notice: { id: string }) => notice.id === c.recallId)).toBe(true);
    const unrelated = await request(app).get('/recalls').set('Authorization', `Bearer ${outsider.token}`);
    expect(unrelated.status).toBe(200);
    expect(unrelated.body.some((notice: { id: string }) => notice.id === c.recallId)).toBe(false);
    expect((await ack(c, buyer)).status).toBe(200);
    expect((await ack(c, outsider)).status).toBe(404);
  });

  it('restricts contact management to the initiating manager and physical recovery to the actual inventory holder', async () => {
    const c = await scenario(true);
    const contactUrl = `/recalls/${c.recallId}/participants/${buyer.organizationId}/contact`;
    expect((await request(app).patch(contactUrl).set('Authorization', `Bearer ${buyer.token}`).send({ status: 'contacted', note: 'Buyer called supplier' })).status).toBe(403);
    expect((await request(app).patch(contactUrl).set('Authorization', `Bearer ${seller.token}`).send({ status: 'contacted', note: 'Reached buyer and instructed isolation' })).status).toBe(200);
    expect((await recovery(c, c.buyerHoldingId!, seller, { releasedKg: 4 })).status).toBe(403);
    expect((await recovery(c, c.holdingId, buyer, { releasedKg: 6 })).status).toBe(403);
    expect((await recovery(c, c.buyerHoldingId!, buyer, { quarantinedKg: 4 })).status).toBe(200);
  });

  it('rejects negative, over-allocated and excessive-precision responses without changing inventory', async () => {
    const c = await scenario(), before = await inventory(c);
    for (const values of [{ releasedKg: -1 }, { releasedKg: 11 }, { releasedKg: 5, correctedKg: 6 }, { releasedKg: 1.0001 }]) {
      const response = await recovery(c, c.holdingId, seller, values);
      expect(response.status).toBe(400);
    }
    expect((await recovery(c, c.holdingId, seller, { quarantinedKg: 10 })).status).toBe(200);
    expect(await inventory(c)).toEqual(before);
  });

  it('requires a substantive resolution reason and clean proof linked to this exact recall', async () => {
    const c = await scenario();
    expect((await recovery(c, c.holdingId, seller, { releasedKg: 10 })).status).toBe(200);
    expect((await resolve(c)).status).toBe(400);
    const evidence = await proof(c);
    expect((await request(app).post(`/recalls/${c.recallId}/resolve`).set('Authorization', `Bearer ${seller.token}`).send({ reason: 'Done', evidenceIds: [evidence] })).status).toBe(400);
    const another = await scenario(), foreignProof = await proof(another);
    expect((await resolve(c, [foreignProof])).status).toBe(400);
    await query("UPDATE evidence_items SET malware_scan_status='scan_failed' WHERE id=$1", [evidence]);
    expect((await resolve(c, [evidence])).status).toBe(400);
    expect((await query('SELECT status FROM recall_notices WHERE id=$1', [c.recallId])).rows[0].status).toBe('active');
  });

  it('cannot resolve while affected buyers have not acknowledged or inventory remains unaccounted or quarantined', async () => {
    const c = await scenario(true), evidence = await proof(c);
    expect((await recovery(c, c.holdingId, seller, { releasedKg: 6 })).status).toBe(200);
    expect((await recovery(c, c.buyerHoldingId!, buyer, { releasedKg: 4 })).status).toBe(200);
    expect((await resolve(c, [evidence])).status).toBe(409);
    expect((await ack(c)).status).toBe(200);
    expect((await recovery(c, c.buyerHoldingId!, buyer, { releasedKg: 3 })).status).toBe(200);
    expect((await resolve(c, [evidence])).status).toBe(409);
    expect((await recovery(c, c.buyerHoldingId!, buyer, { quarantinedKg: 4 })).status).toBe(200);
    expect((await resolve(c, [evidence])).status).toBe(409);
    expect((await query('SELECT status FROM recall_notices WHERE id=$1', [c.recallId])).rows[0].status).toBe('active');
  });

  it('resolves accounted released or corrected stock without approving external proof or automatically publishing supply', async () => {
    const c = await scenario(), before = await inventory(c), evidence = await proof(c);
    expect((await recovery(c, c.holdingId, seller, { releasedKg: 7, correctedKg: 3 })).status).toBe(200);
    expect((await resolve(c, [evidence])).status).toBe(200);
    expect(await inventory(c)).toEqual(before);
    expect((await query('SELECT review_status,validation_status,malware_scan_status FROM evidence_items WHERE id=$1', [evidence])).rows[0]).toMatchObject({ review_status: 'submitted', validation_status: 'validated', malware_scan_status: 'clean' });
    expect((await query('SELECT id FROM listings WHERE holding_id=$1 AND active', [c.holdingId])).rows).toHaveLength(0);
    expect((await publish(c)).status).toBe(201);
  });

  it('retains safety holds for disposed or returned stock after resolution so it cannot be traded again', async () => {
    for (const disposition of ['returnedKg', 'destroyedKg']) {
      const c = await scenario(), evidence = await proof(c), before = await inventory(c);
      expect((await recovery(c, c.holdingId, seller, { [disposition]: 10 })).status).toBe(200);
      expect((await resolve(c, [evidence])).status).toBe(200);
      const listing = await publish(c);
      expect(listing.status).toBe(409);
      expect(listing.body.code).toBe('ACTIVE_RECALL');
      expect(await inventory(c)).toEqual(before);
      expect((await query("SELECT * FROM recall_safety_holds WHERE recall_id=$1 AND entity_type='holding' AND entity_id=$2 AND released_at IS NULL", [c.recallId, c.holdingId])).rows).toHaveLength(1);
    }
  });

  it('accounts for a fully transferred holding once and keeps historical custody rows out of physical recovery', async () => {
    const c = await scenario(true, 10), evidence = await proof(c), before = await inventory(c);
    expect(before.filter(row => row.status !== 'transferred').reduce((sum, row) => sum + Number(row.quantity_kg), 0)).toBe(10);
    const manager = await details(c);
    expect(manager.status).toBe(200);
    expect(manager.body.holdings.map((holding: { id: string }) => holding.id)).toEqual([c.buyerHoldingId]);
    expect((await recovery(c, c.holdingId, seller, { releasedKg: 10 })).status).toBe(404);
    expect((await ack(c)).status).toBe(200);
    expect((await recovery(c, c.buyerHoldingId!, buyer, { releasedKg: 10 })).status).toBe(200);
    expect((await resolve(c, [evidence])).status).toBe(200);
    expect(await inventory(c)).toEqual(before);
    expect((await query('SELECT released_at FROM recall_safety_holds WHERE recall_id=$1', [c.recallId])).rows.every(row => row.released_at !== null)).toBe(true);
  });

  // The single-backend supplemental adapter cannot prove transaction rollback
  // isolation after an injected SQL exception. Native PostgreSQL must run this.
  it.skipIf(process.env.COCOATRACE_SUPPLEMENTAL_DATABASE === 'true')('rolls back recovery when required audit logging fails', async () => {
    const c = await scenario(), before = await inventory(c), trigger = `response_audit_${crypto.randomUUID().replaceAll('-', '')}`;
    await query(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_user_id='${seller.id}'::uuid AND NEW.action LIKE 'recall.%' THEN RAISE EXCEPTION 'injected response audit failure'; END IF; RETURN NEW; END $$`);
    await query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
    try {
      expect((await recovery(c, c.holdingId, seller, { releasedKg: 10 })).status).toBe(500);
      expect(await inventory(c)).toEqual(before);
      expect((await query('SELECT status FROM recall_notices WHERE id=$1', [c.recallId])).rows[0].status).toBe('active');
      expect((await query('SELECT * FROM recall_recovery_records WHERE recall_id=$1', [c.recallId])).rows).toHaveLength(0);
    } finally { await query(`DROP TRIGGER ${trigger} ON audit_events`); await query(`DROP FUNCTION ${trigger}()`); }
  });

  it('queues one notification per affected user, retries durably and never equates email submission with acknowledgement', async () => {
    const c = await scenario(true), client = await getClient();
    try { await queueRecallEmails(client, c.recallId, 'activated'); await queueRecallEmails(client, c.recallId, 'activated'); }
    finally { client.release(); }
    const recipients = (await query("SELECT recipient_user_id FROM recall_email_outbox WHERE recall_id=$1 AND event_type='activated'", [c.recallId])).rows;
    expect(recipients.map(row => row.recipient_user_id).sort()).toEqual([seller.id, buyer.id].sort());
    const sent: EmailMessage[] = [];
    const sender: EmailSender = { async send(message) { sent.push(message); return { status: 'sent' }; }, async healthcheck() {} };
    await processRecallEmails(sender, 1000);
    expect((await query('SELECT status FROM recall_email_outbox WHERE recall_id=$1', [c.recallId])).rows.every(row => row.status === 'sent')).toBe(true);
    expect((await query('SELECT acknowledged_at FROM recall_participants WHERE recall_id=$1 AND organization_id=$2', [c.recallId, buyer.organizationId])).rows[0].acknowledged_at).toBeNull();
    const count = sent.length;
    expect(await processRecallEmails(sender, 1000)).toEqual({ sent: 0, suppressed: 0, failed: 0 });
    expect(sent).toHaveLength(count);
    expect(sent.every(message => message.category === 'recall' && !message.text.includes('storage_key'))).toBe(true);
  });

  it('retains failed notification attempts and safely retries them without duplicate outbox rows', async () => {
    const c = await scenario();
    const failing: EmailSender = { async send() { throw new Error('Simulated SMTP rejection'); }, async healthcheck() {} };
    expect((await processRecallEmails(failing, 1000)).failed).toBeGreaterThan(0);
    const failed = (await query('SELECT status,attempts FROM recall_email_outbox WHERE recall_id=$1', [c.recallId])).rows;
    expect(failed).toEqual([{ status: 'failed', attempts: 1 }]);
    await query("UPDATE recall_email_outbox SET next_attempt_at=NOW() WHERE recall_id=$1", [c.recallId]);
    const successful: EmailSender = { async send() { return { status: 'sent' }; }, async healthcheck() {} };
    await processRecallEmails(successful, 1000);
    expect((await query('SELECT status,attempts FROM recall_email_outbox WHERE recall_id=$1', [c.recallId])).rows).toEqual([{ status: 'sent', attempts: 2 }]);
  });

  it('excludes inactive accounts from new notifications and rechecks account activity before delivery', async () => {
    const inactive = (await query('INSERT INTO users(organization_id,email,password_hash,name,active) VALUES($1,$2,$3,$4,FALSE) RETURNING id', [seller.organizationId, `inactive-${crypto.randomUUID()}@integration.test`, await bcrypt.hash('InactiveUserPassword123!', 4), 'Inactive recall account'])).rows[0];
    const c = await scenario(true);
    expect((await query('SELECT id FROM recall_email_outbox WHERE recall_id=$1 AND recipient_user_id=$2', [c.recallId, inactive.id])).rows).toHaveLength(0);
    const buyerEmail = (await query('SELECT email FROM users WHERE id=$1', [buyer.id])).rows[0].email;
    const sent: EmailMessage[] = [];
    const sender: EmailSender = { async send(message) { sent.push(message); return { status: 'sent' }; }, async healthcheck() {} };
    await query('UPDATE users SET active=FALSE WHERE id=$1', [buyer.id]);
    try {
      await processRecallEmails(sender, 1000);
      expect(sent.some(message => message.to === buyerEmail)).toBe(false);
    } finally { await query('UPDATE users SET active=TRUE WHERE id=$1', [buyer.id]); }
  });

  it('escalates affected external recipients without an active account instead of pretending they were notified or acknowledged', async () => {
    const c = await scenario(false, 4, true), evidence = await proof(c), response = await details(c);
    expect(response.status).toBe(200);
    const external = response.body.participants.find((participant: { organization_id: string }) => participant.organization_id === c.noContactOrganizationId);
    expect(external).toMatchObject({ eligible_contact_count: 0, contact_status: 'escalated', acknowledged_at: null, first_queued_at: null });
    expect((await recovery(c, c.holdingId, seller, { releasedKg: 10 })).status).toBe(200);
    expect((await resolve(c, [evidence])).status).toBe(409);
  });

  it('surfaces exhausted failed deliveries and expired eighth-attempt leases as terminal failures', async () => {
    for (const status of ['sending', 'failed']) {
      const c = await scenario();
      await query("UPDATE recall_email_outbox SET status=$2,attempts=8,lease_token=$3,lease_expires_at=NOW()-INTERVAL '1 minute',next_attempt_at=NOW()-INTERVAL '1 minute' WHERE recall_id=$1", [c.recallId, status, crypto.randomUUID()]);
      const sent: EmailMessage[] = [];
      const sender: EmailSender = { async send(message) { sent.push(message); return { status: 'sent' }; }, async healthcheck() {} };
      await processRecallEmails(sender, 1000);
      expect((await query('SELECT status,attempts FROM recall_email_outbox WHERE recall_id=$1', [c.recallId])).rows).toEqual([{ status: 'failed_terminal', attempts: 8 }]);
      const reference = (await query('SELECT reference_code FROM recall_notices WHERE id=$1', [c.recallId])).rows[0].reference_code;
      expect(sent.some(message => message.subject.includes(reference))).toBe(false);
    }
    const recoverable = await scenario();
    await query("UPDATE recall_email_outbox SET status='sending',attempts=1,lease_token=$2,lease_expires_at=NOW()-INTERVAL '1 minute' WHERE recall_id=$1", [recoverable.recallId, crypto.randomUUID()]);
    const sender: EmailSender = { async send() { return { status: 'sent' }; }, async healthcheck() {} };
    await processRecallEmails(sender, 1000);
    expect((await query('SELECT status,attempts FROM recall_email_outbox WHERE recall_id=$1', [recoverable.recallId])).rows).toEqual([{ status: 'sent', attempts: 2 }]);
  }, 30_000);

  it('claims a queued message once when two delivery workers run concurrently', async () => {
    const delivered: EmailMessage[] = [];
    const sender: EmailSender = { async send(message) { delivered.push(message); return { status: 'sent' }; }, async healthcheck() {} };
    await processRecallEmails(sender, 1000);
    delivered.length = 0;
    const c = await scenario();
    await Promise.all([processRecallEmails(sender, 1), processRecallEmails(sender, 1)]);
    expect(delivered).toHaveLength(1);
    expect((await query('SELECT status,attempts FROM recall_email_outbox WHERE recall_id=$1', [c.recallId])).rows).toEqual([{ status: 'sent', attempts: 1 }]);
  });

  it('reports missing or released disposal holds after resolution without repairing the records', async () => {
    const c = await scenario(), evidence = await proof(c);
    expect((await recovery(c, c.holdingId, seller, { destroyedKg: 10 })).status).toBe(200);
    expect((await resolve(c, [evidence])).status).toBe(200);
    const client = await getClient();
    try {
      expect((await reconcileRecallSafety(client)).ok).toBe(true);
      for (const corruption of ['released', 'deleted']) {
        await client.query('BEGIN');
        if (corruption === 'released') await client.query("UPDATE recall_safety_holds SET released_at=NOW() WHERE recall_id=$1 AND entity_type='holding' AND entity_id=$2", [c.recallId, c.holdingId]);
        else await client.query("DELETE FROM recall_safety_holds WHERE recall_id=$1 AND entity_type='holding' AND entity_id=$2", [c.recallId, c.holdingId]);
        const report = await reconcileRecallSafety(client);
        expect(report.issues).toContainEqual({ code: 'RETAINED_DISPOSAL_HOLD_MISSING', entity_type: 'holding', entity_id: c.holdingId });
        expect(report.ok).toBe(false);
        expect((await client.query(`SELECT ${activeBatchRecallSql('$1::uuid')} AS held`, [c.batchId])).rows[0].held).toBe(true);
        await client.query('ROLLBACK');
      }
    } finally { await client.query('ROLLBACK'); client.release(); }
  });
});
