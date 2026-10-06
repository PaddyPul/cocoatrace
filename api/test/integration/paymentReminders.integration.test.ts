import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
import { enqueueOverdueReminders, PAYMENT_REMINDER_SYSTEM_ACTOR, processPaymentReminderEmails } from '../../src/modules/payments/reminders';
import { evidenceStorage } from '../../src/services/evidenceStorage';
import type { EmailDeliveryResult, EmailMessage, EmailSender } from '../../src/services/emailSender';
import type { PaymentPlan } from '../../src/services/paymentProtection';

type Actor = { organizationId: string; userId: string; token: string; email: string };
type Deal = { contractId: string; paymentId: string; shipmentId: string };
let seller: Actor, buyer: Actor, outsider: Actor;
const deals: Deal[] = [], storageKeys: string[] = [];
const nativeIt = process.env.COCOATRACE_SUPPLEMENTAL_DATABASE === 'true' ? it.skip : it;
const post = (path: string, actor: Actor, body = {}) => request(app).post(path).set('Authorization', `Bearer ${actor.token}`).send(body);

async function actor(type: 'exporter' | 'importer'): Promise<Actor> {
  const suffix = crypto.randomUUID(), email = `reminder-${suffix}@integration.test`, password = 'ReminderRegression123!';
  const org = (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id", [`Reminder ${suffix}`, type])).rows[0];
  const user = (await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id', [org.id, email, await bcrypt.hash(password, 4), 'Reminder regression'])).rows[0];
  const role = (await query("INSERT INTO roles(name,permissions) VALUES($1,ARRAY['*']) RETURNING id", [`reminder-${suffix}`])).rows[0];
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id, role.id]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  return { organizationId: org.id, userId: user.id, email, token: login.body.accessToken };
}
async function deal(plan: PaymentPlan = 'pay_before_dispatch', creditDays = 0, confirm = true): Promise<Deal> {
  const batch = (await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','Reminder regression','GH') RETURNING id", [seller.organizationId])).rows[0];
  const holding = (await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id', [batch.id, seller.organizationId])).rows[0];
  const listing = (await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,5,'EUR','FOB','Tema','Rotterdam') RETURNING id", [seller.organizationId, holding.id])).rows[0];
  const offer = (await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,4,5,'EUR',NOW()+INTERVAL '1 day') RETURNING id", [listing.id, buyer.organizationId])).rows[0];
  const accepted = await post(`/offers/${offer.id}/accept`, seller);
  expect(accepted.status).toBe(200);
  const contractId = accepted.body.contract.id, shipmentId = accepted.body.shipment.id;
  const paymentId = (await query('SELECT id FROM payment_requests WHERE contract_id=$1', [contractId])).rows[0].id;
  const proposed = await request(app).patch(`/contracts/${contractId}/payment-terms`).set('Authorization', `Bearer ${seller.token}`).send({ paymentPlan: plan, depositPercentage: 20, creditDays, paymentEvidenceRequired: false });
  expect(proposed.status).toBe(200);
  if (confirm) expect((await post(`/contracts/${contractId}/payment-terms/confirm`, buyer)).status).toBe(200);
  const result = { contractId, paymentId, shipmentId }; deals.push(result); return result;
}
async function installments(d: Deal) { return (await query('SELECT * FROM payment_installments WHERE payment_request_id=$1 ORDER BY sequence_number', [d.paymentId])).rows; }
async function overdue(d: Deal) {
  await query("UPDATE payment_installments SET due_at=NOW()-INTERVAL '2 days' WHERE payment_request_id=$1 AND status='due'", [d.paymentId]);
}
async function reminderRows(d: Deal) { return (await query('SELECT * FROM payment_reminders WHERE payment_request_id=$1', [d.paymentId])).rows; }
async function outbox(d: Deal) { return (await query('SELECT o.* FROM payment_reminder_email_outbox o JOIN payment_reminders r ON r.id=o.reminder_id WHERE r.payment_request_id=$1 ORDER BY o.created_at,o.id', [d.paymentId])).rows; }
async function shippingProof(d: Deal) {
  for (const type of ['commercial_invoice', 'packing_list', 'transport_document']) {
    const id = crypto.randomUUID(), key = `evidence/test/${id}`, content = Buffer.from('%PDF-1.4\nReminder regression document\n%%EOF');
    await evidenceStorage().put(key, content, 'application/pdf'); storageKeys.push(key);
    await query(`INSERT INTO evidence_items(id,type,file_name,file_size_bytes,mime_type,sha256_hash,uploader_user_id,uploader_organization_id,
      linked_entity_type,linked_entity_id,storage_key,storage_provider,validation_status,malware_scan_status)
      VALUES($1,$2,$3,$4,'application/pdf',$5,$6,$7,'contract',$8,$9,$10,'validated','clean')`,
    [id, type, `${type}.pdf`, content.length, crypto.createHash('sha256').update(content).digest('hex'), seller.userId, seller.organizationId, d.contractId, key, evidenceStorage().provider]);
  }
  await query("UPDATE shipments SET current_milestone='loaded',transport_document_reference='REMINDER-DOCUMENTS' WHERE id=$1", [d.shipmentId]);
}
class CapturingSender implements EmailSender {
  messages: EmailMessage[] = [];
  constructor(private result: EmailDeliveryResult = { status: 'sent' }, private fail = false) {}
  async healthcheck() {}
  async send(message: EmailMessage) { this.messages.push(message); if (this.fail) throw new Error('Injected SMTP outage'); return this.result; }
}

beforeAll(async () => {
  // The integration database is disposable, but other suites leave retained
  // fixtures. Neutralize their deadlines before exercising a global worker.
  await query("UPDATE payment_installments SET due_at=NOW()+INTERVAL '365 days' WHERE status='due'");
  await query("UPDATE payment_reminder_email_outbox SET status='suppressed',lease_token=NULL,lease_expires_at=NULL");
  seller = await actor('exporter'); buyer = await actor('importer'); outsider = await actor('importer');
});
beforeEach(async () => {
  // Only neutralize this suite's previous fixtures: the worker scans the real
  // database, so retained fixtures must not become additional overdue work.
  if (deals.length) {
    await query("UPDATE payment_installments SET due_at=NOW()+INTERVAL '365 days' WHERE payment_request_id=ANY($1::uuid[])", [deals.map(d => d.paymentId)]);
    await query("UPDATE payment_reminder_email_outbox SET status='suppressed',lease_token=NULL,lease_expires_at=NULL WHERE reminder_id IN (SELECT id FROM payment_reminders WHERE payment_request_id=ANY($1::uuid[]))", [deals.map(d => d.paymentId)]);
  }
});
afterAll(async () => { for (const key of storageKeys) await evidenceStorage().delete(key); await pool.end(); });

describe('durable payment deadlines and scoped reminder delivery', () => {
  it('activates prepayment at agreement and preserves the original deadline on confirmation replay', async () => {
    const d = await deal('pay_before_dispatch', 0, false);
    expect((await installments(d))[0].due_at).toBeNull();
    expect((await post(`/contracts/${d.contractId}/payment-terms/confirm`, buyer)).status).toBe(200);
    const first = (await installments(d))[0];
    const agreed = (await query('SELECT payment_terms_confirmed_at FROM sales_contracts WHERE id=$1', [d.contractId])).rows[0];
    expect(first.status).toBe('due'); expect(new Date(first.due_at).getTime()).toBe(new Date(agreed.payment_terms_confirmed_at).getTime());
    expect((await post(`/contracts/${d.contractId}/payment-terms/confirm`, buyer)).status).toBe(200);
    expect(new Date((await installments(d))[0].due_at).getTime()).toBe(new Date(first.due_at).getTime());
  });

  it('activates document payment only after real clean shipping documents and preserves its timestamp on replay', async () => {
    const d = await deal('documentary_collection');
    expect((await installments(d))[0].due_at).toBeNull();
    expect((await post(`/payment-requests/${d.paymentId}/submit-documents`, seller)).status).toBe(400);
    expect((await installments(d))[0].due_at).toBeNull();
    await shippingProof(d);
    expect((await post(`/payment-requests/${d.paymentId}/submit-documents`, seller)).status).toBe(200);
    const first = (await installments(d))[0], payment = (await query('SELECT documents_presented_at FROM payment_requests WHERE id=$1', [d.paymentId])).rows[0];
    expect(first.status).toBe('due'); expect(new Date(first.due_at).getTime()).toBe(new Date(payment.documents_presented_at).getTime());
    expect((await post(`/payment-requests/${d.paymentId}/submit-documents`, seller)).status).toBe(200);
    expect(new Date((await installments(d))[0].due_at).getTime()).toBe(new Date(first.due_at).getTime());
  });

  it('starts delivery credit from persisted delivery and does not extend it on milestone replay', async () => {
    const d = await deal('pay_after_delivery', 14);
    expect((await installments(d))[0].due_at).toBeNull();
    expect((await post(`/shipments/${d.shipmentId}/milestones`, seller, { milestone: 'loaded' })).status).toBe(200);
    expect((await post(`/shipments/${d.shipmentId}/milestones`, buyer, { milestone: 'delivered' })).status).toBe(200);
    const first = (await installments(d))[0], shipment = (await query('SELECT delivered_at FROM shipments WHERE id=$1', [d.shipmentId])).rows[0];
    expect(first.status).toBe('due');
    expect(new Date(first.due_at).getTime()).toBe(new Date(shipment.delivered_at).getTime() + 14 * 86_400_000);
    // Duplicate progress is rejected by the transport API; its existing due
    // date must nevertheless stay intact when a client retries the milestone.
    expect((await post(`/shipments/${d.shipmentId}/milestones`, buyer, { milestone: 'delivered' })).status).toBe(400);
    expect(new Date((await installments(d))[0].due_at).getTime()).toBe(new Date(first.due_at).getTime());
    await enqueueOverdueReminders(); expect(await reminderRows(d)).toHaveLength(0);
  });

  it('shares UTC-day deduplication between manual and automatic reminders and queues durable email', async () => {
    const d = await deal(); await overdue(d);
    expect((await post(`/payment-requests/${d.paymentId}/remind`, outsider)).status).toBe(404);
    const manual = await post(`/payment-requests/${d.paymentId}/remind`, seller); expect(manual.status).toBe(200); expect(manual.body.created).toBe(1);
    expect(await outbox(d)).toHaveLength(1);
    await enqueueOverdueReminders(); await enqueueOverdueReminders();
    expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).body.created).toBe(0);
    const rows = await reminderRows(d); expect(rows).toHaveLength(1);
    expect((await query("SELECT reminder_date=(NOW() AT TIME ZONE 'UTC')::date AS utc_today FROM payment_reminders WHERE id=$1", [rows[0].id])).rows[0].utc_today).toBe(true);
    expect(await outbox(d)).toHaveLength(1);
  });

  it('waits for a full overdue day before automatic collection while allowing an explicit earlier reminder', async () => {
    const d = await deal();
    await query("UPDATE payment_installments SET due_at=NOW()-INTERVAL '1 hour' WHERE payment_request_id=$1", [d.paymentId]);
    await enqueueOverdueReminders(); expect(await reminderRows(d)).toHaveLength(0);
    expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).status).toBe(200);
    expect(await reminderRows(d)).toHaveLength(1); expect(await outbox(d)).toHaveLength(1);
  });

  it('does not queue automatic reminders for submitted, paid, unconfirmed or cancelled obligations', async () => {
    const submitted = await deal(), paid = await deal(), unconfirmed = await deal('pay_before_dispatch', 0, false), cancelled = await deal();
    for (const d of [submitted, paid, unconfirmed, cancelled]) await query("UPDATE payment_installments SET status='due',due_at=NOW()-INTERVAL '2 days' WHERE payment_request_id=$1", [d.paymentId]);
    const submittedId = (await installments(submitted))[0].id;
    expect((await post(`/payment-installments/${submittedId}/submit`, buyer, { transactionReference: 'REMINDER-NOT-COLLECTED' })).status).toBe(200);
    await query("UPDATE payment_installments SET status='paid' WHERE payment_request_id=$1", [paid.paymentId]);
    await query("UPDATE sales_contracts SET status='cancelled' WHERE id=$1", [cancelled.contractId]);
    await enqueueOverdueReminders();
    for (const d of [submitted, paid, unconfirmed, cancelled]) expect(await reminderRows(d)).toHaveLength(0);
  });

  it.each(['open', 'resolution_proposed'])('holds manual and automatic collection during a payment issue in %s state', async status => {
    const d = await deal(); await overdue(d);
    await query("INSERT INTO payment_issues(payment_request_id,issue_type,status,opened_by_user_id,opened_by_organization_id,reason) VALUES($1,'payment_dispute',$2,$3,$4,'Buyer and supplier must resolve disputed payment')", [d.paymentId, status, buyer.userId, buyer.organizationId]);
    expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).status).toBe(409);
    await enqueueOverdueReminders(); expect(await reminderRows(d)).toHaveLength(0);
  });

  it('holds collection during an active delivery discrepancy, including a proposed resolution', async () => {
    const d = await deal(); await overdue(d);
    await query("INSERT INTO delivery_discrepancies(contract_id,kind,received_quantity_kg,reason,evidence_ids,status,reported_by_user_id,reported_by_organization_id) VALUES($1,'shortage',3,'Missing one kilogram at delivery',ARRAY[$2]::uuid[],'resolution_proposed',$3,$4)", [d.contractId, crypto.randomUUID(), buyer.userId, buyer.organizationId]);
    expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).status).toBe(409);
    await enqueueOverdueReminders(); expect(await reminderRows(d)).toHaveLength(0);
  });

  it('delivers only to active authorized buyer members and never to sellers, outsiders or users without payment permission', async () => {
    const d = await deal(); await overdue(d);
    const allowedEmail = `payment-reader-${crypto.randomUUID()}@integration.test`, inactiveEmail = `inactive-${crypto.randomUUID()}@integration.test`, deniedEmail = `no-payment-${crypto.randomUUID()}@integration.test`;
    const allowed = (await query("INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,'unused','Payment reader') RETURNING id", [buyer.organizationId, allowedEmail])).rows[0];
    const role = (await query("INSERT INTO roles(name,permissions) VALUES($1,ARRAY['payment.read']) RETURNING id", [`reader-${crypto.randomUUID()}`])).rows[0];
    await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [allowed.id, role.id]);
    await query("INSERT INTO users(organization_id,email,password_hash,name,active) VALUES($1,$2,'unused','Inactive',false),($1,$3,'unused','No payment permission',true)", [buyer.organizationId, inactiveEmail, deniedEmail]);
    expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).status).toBe(200);
    const sender = new CapturingSender(); await processPaymentReminderEmails(sender);
    const recipients = sender.messages.flatMap(message => typeof message.to === 'string' ? [message.to] : [...message.to]).sort();
    expect(recipients).toEqual([buyer.email, allowedEmail].sort());
    expect(recipients).not.toContain(seller.email); expect(recipients).not.toContain(outsider.email);
    expect(recipients).not.toContain(inactiveEmail); expect(recipients).not.toContain(deniedEmail);
    expect((await outbox(d)).every(row => row.status === 'sent')).toBe(true);
    // Retain the user fixtures without making them future recipients in this suite.
    await query('UPDATE users SET active=false WHERE id=$1', [allowed.id]);
  });

  it('retains SMTP failures for retry, respects active leases and recovers stale leases without duplicate delivery', async () => {
    const d = await deal(); await overdue(d); expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).status).toBe(200);
    await processPaymentReminderEmails(new CapturingSender({ status: 'sent' }, true));
    let rows = await outbox(d); expect(rows).toHaveLength(1); expect(rows[0].status).not.toBe('sent'); expect(rows[0].attempts).toBeGreaterThan(0); expect(rows[0].last_error).toBeTruthy();
    await query("UPDATE payment_reminder_email_outbox SET status='sending',next_attempt_at=NOW()-INTERVAL '1 second',lease_token=$1,lease_expires_at=NOW()+INTERVAL '5 minutes' WHERE id=$2", [crypto.randomUUID(), rows[0].id]);
    const recovered = new CapturingSender(); await processPaymentReminderEmails(recovered); expect(recovered.messages).toHaveLength(0);
    await query("UPDATE payment_reminder_email_outbox SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [rows[0].id]);
    await processPaymentReminderEmails(recovered); expect(recovered.messages).toHaveLength(1); expect((await outbox(d))[0].status).toBe('sent');
    await processPaymentReminderEmails(recovered); expect(recovered.messages).toHaveLength(1);
  });

  it('rechecks collection and recipient authorization before sending queued email', async () => {
    const submitted = await deal(); await overdue(submitted); expect((await post(`/payment-requests/${submitted.paymentId}/remind`, seller)).status).toBe(200);
    expect((await post(`/payment-installments/${(await installments(submitted))[0].id}/submit`, buyer, { transactionReference: 'QUEUED-THEN-SUBMITTED' })).status).toBe(200);
    const revoked = await deal(); await overdue(revoked); expect((await post(`/payment-requests/${revoked.paymentId}/remind`, seller)).status).toBe(200);
    await query('UPDATE users SET active=false WHERE id=$1', [buyer.userId]);
    try {
      const sender = new CapturingSender(); await processPaymentReminderEmails(sender); expect(sender.messages).toHaveLength(0);
      expect((await outbox(submitted))[0].status).toBe('suppressed'); expect((await outbox(revoked))[0].status).toBe('suppressed');
    } finally { await query('UPDATE users SET active=true WHERE id=$1', [buyer.userId]); }
  });

  it('records development email suppression without claiming an email was sent', async () => {
    const d = await deal(); await overdue(d); expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).status).toBe(200);
    await processPaymentReminderEmails(new CapturingSender({ status: 'suppressed' }));
    const row = (await outbox(d))[0]; expect(row.status).toBe('suppressed'); expect(row.sent_at).toBeNull();
  });

  it('leaves queued emails intact when production SMTP delivery is not enabled', async () => {
    const d = await deal(); await overdue(d); expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).status).toBe(200);
    const result = await processPaymentReminderEmails(); expect(result.skipped).toBe(1);
    const row = (await outbox(d))[0]; expect(row.status).toBe('queued'); expect(row.attempts).toBe(0); expect(row.sent_at).toBeNull();
  });

  it('suppresses an older unsent daily reminder when a newer reminder already exists', async () => {
    const d = await deal(); await overdue(d); expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).status).toBe(200);
    const first = (await reminderRows(d))[0];
    await query("UPDATE payment_reminders SET reminder_date=(NOW() AT TIME ZONE 'UTC')::date-1 WHERE id=$1", [first.id]);
    expect((await post(`/payment-requests/${d.paymentId}/remind`, seller)).body.created).toBe(1);
    const sender = new CapturingSender(); await processPaymentReminderEmails(sender);
    expect(sender.messages).toHaveLength(1);
    const rows = await outbox(d); expect(rows.find(row => row.reminder_id === first.id).status).toBe('suppressed');
    expect(rows.filter(row => row.status === 'sent')).toHaveLength(1);
  });

  it('creates an automatic reminder with a non-login system audit identity and commits email work once', async () => {
    const d = await deal(); await overdue(d);
    expect((await enqueueOverdueReminders()).created).toBe(1);
    expect((await enqueueOverdueReminders()).created).toBe(0);
    expect(await reminderRows(d)).toHaveLength(1);
    expect(await outbox(d)).toHaveLength(1);
    const installment = (await installments(d))[0];
    const events = (await query("SELECT * FROM audit_events WHERE entity_id=$1 AND action='payment.reminder.create'", [installment.id])).rows;
    expect(events).toHaveLength(1);
    expect(events[0].actor_user_id).toBe(PAYMENT_REMINDER_SYSTEM_ACTOR);
    expect(events[0].actor_organization_id).toBe(buyer.organizationId);
    expect(events[0].metadata.automatic).toBe(true);
    expect((await query('SELECT id FROM users WHERE id=$1', [PAYMENT_REMINDER_SYSTEM_ACTOR])).rows).toHaveLength(0);
    const view = await request(app).get(`/payment-requests/${d.paymentId}/operations`).set('Authorization', `Bearer ${buyer.token}`);
    expect(view.status).toBe(200);
    expect(view.body.timeline.find((event: { action: string }) => event.action === 'payment.reminder.create').actor_name).toBe('Scheduled payment worker');
    const sender = new CapturingSender(); await processPaymentReminderEmails(sender);
    expect(sender.messages).toHaveLength(1);
    expect((await outbox(d))[0].status).toBe('sent');
  });

  nativeIt('serializes concurrent automatic runs into one reminder and one recipient email', async () => {
    const d = await deal(); await overdue(d);
    await Promise.all([enqueueOverdueReminders(), enqueueOverdueReminders()]);
    expect(await reminderRows(d)).toHaveLength(1); expect(await outbox(d)).toHaveLength(1);
    const sender = new CapturingSender(); await Promise.all([processPaymentReminderEmails(sender), processPaymentReminderEmails(sender)]);
    expect(sender.messages).toHaveLength(1); expect((await outbox(d))[0].status).toBe('sent');
  });
});
