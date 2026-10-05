import { queueReminderEmails } from './reminders';
import { ConflictError, NotFoundError } from '../../errors';
import { inTradeTransaction, recordTradeAudit, TradeActor } from '../trading/transaction';
import { lockPayment, requireAgreed } from './locking';
import { installmentDueState } from './dueState';

export { installmentDueState } from './dueState';

// Audit metadata may contain implementation details or secrets from unrelated
// events. The customer-facing timeline exposes only known payment fields.
const timelineFields = new Set(['reference', 'evidenceId', 'amount', 'reason', 'paymentPlan',
  'paymentEvidenceRequired', 'resolution', 'issueId', 'installmentId', 'previousStatus',
  'newStatus', 'recipientOrganizationId', 'reminderDate', 'choice']);

export function safeTimelineMetadata(metadata: unknown): Record<string, string | number | boolean | null> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => timelineFields.has(key)
    && (value === null || ['string', 'number', 'boolean'].includes(typeof value))));
}

/** Both contract parties see the same durable operational record. */
export async function getPaymentOperations(actor: TradeActor, paymentId: string) {
  return inTradeTransaction(async client => {
    const payment = (await client.query(`SELECT p.id,p.contract_id FROM payment_requests p
      JOIN sales_contracts c ON c.id=p.contract_id WHERE p.id=$1
      AND $2 IN (c.buyer_organization_id,c.seller_organization_id)`, [paymentId, actor.organizationId])).rows[0];
    if (!payment) throw new NotFoundError('Payment workflow');
    const installments = (await client.query(`SELECT * FROM payment_installments
      WHERE payment_request_id=$1 ORDER BY sequence_number,id`, [paymentId])).rows;
    const now = new Date();
    const issues = (await client.query(`SELECT * FROM payment_issues
      WHERE payment_request_id=$1 ORDER BY created_at,id`, [paymentId])).rows;
    const reminders = (await client.query(`SELECT r.*,
      (SELECT COUNT(*)::int FROM payment_reminder_email_outbox q WHERE q.reminder_id=r.id) AS email_recipient_count,
      (SELECT COUNT(*)::int FROM payment_reminder_email_outbox q WHERE q.reminder_id=r.id AND q.status='sent') AS email_sent_count,
      (SELECT COUNT(*)::int FROM payment_reminder_email_outbox q WHERE q.reminder_id=r.id AND q.status IN('failed','failed_terminal')) AS email_failed_count,
      (SELECT COUNT(*)::int FROM payment_reminder_email_outbox q WHERE q.reminder_id=r.id AND q.status='suppressed') AS email_suppressed_count,
      (SELECT COUNT(*)::int FROM payment_reminder_email_outbox q WHERE q.reminder_id=r.id AND q.status IN('queued','sending')) AS email_pending_count
      FROM payment_reminders r WHERE payment_request_id=$1 ORDER BY created_at,id`, [paymentId])).rows;
    const timeline = (await client.query(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.occurred_at,
      a.metadata,COALESCE(u.name,'Former team member') AS actor_name,o.name AS actor_organization_name
      FROM audit_events a LEFT JOIN users u ON u.id=a.actor_user_id
      LEFT JOIN organizations o ON o.id=a.actor_organization_id
      WHERE (a.action LIKE 'payment.%' OR a.action LIKE 'transport.%') AND (
        (a.entity_type='payment_request' AND a.entity_id=$1)
        OR (a.entity_type='payment_installment' AND a.entity_id IN
          (SELECT id FROM payment_installments WHERE payment_request_id=$1))
        OR (a.entity_type='sales_contract' AND a.entity_id=$2)
        OR (a.entity_type='shipment' AND a.entity_id IN (SELECT id FROM shipments WHERE contract_id=$2))
        OR (a.entity_type='payment_issue' AND a.entity_id IN
          (SELECT id FROM payment_issues WHERE payment_request_id=$1)))
      ORDER BY a.occurred_at,a.id`, [paymentId, payment.contract_id])).rows;
    return {
      installments: installments.map(item => ({ ...item, dueState: installmentDueState(item, now) })),
      issues, reminders,
      timeline: timeline.map(event => ({ ...event, metadata: safeTimelineMetadata(event.metadata) })),
    };
  });
}

/** At most one durable in-app reminder per overdue installment per UTC day. */
export async function remindPayment(actor: TradeActor, paymentId: string) {
  return inTradeTransaction(async client => {
    const { contract, payment } = await lockPayment(client, actor, paymentId, 'seller');
    requireAgreed(contract);
    const activeIssue = (await client.query(`SELECT id FROM payment_issues
      WHERE payment_request_id=$1 AND status<>'resolved' LIMIT 1`, [payment.id])).rows[0];
    if (activeIssue) throw new ConflictError('Resolve the active payment issue before sending a reminder');
    if (['settled','cancelled'].includes(contract.status)) throw new ConflictError('Closed trades cannot send payment reminders');
    if ((await client.query("SELECT id FROM delivery_discrepancies WHERE contract_id=$1 AND status<>'resolved' LIMIT 1", [contract.id])).rows[0]) throw new ConflictError('Resolve the delivery discrepancy before sending payment reminders');
    const overdue = (await client.query(`SELECT id FROM payment_installments
      WHERE payment_request_id=$1 AND status='due' AND due_at<NOW()
      ORDER BY sequence_number,id FOR UPDATE`, [payment.id])).rows;
    if (!overdue.length) throw new ConflictError('There is no overdue buyer payment to remind');
    const reminders = [];
    for (const installment of overdue) {
      const reminder = (await client.query(`INSERT INTO payment_reminders
        (payment_request_id,installment_id,recipient_organization_id,created_by_user_id,reminder_date)
        VALUES($1,$2,$3,$4,(NOW() AT TIME ZONE 'UTC')::date)
        ON CONFLICT(installment_id,reminder_date) DO NOTHING RETURNING *`,
      [payment.id, installment.id, contract.buyer_organization_id, actor.id])).rows[0];
      if (reminder) {
        await queueReminderEmails(client, reminder.id);
        await recordTradeAudit(client, actor, 'payment.reminder.create', 'payment_installment', installment.id,
          { recipientOrganizationId: contract.buyer_organization_id, reminderDate: reminder.reminder_date });
        reminders.push(reminder);
      }
    }
    return { created: reminders.length, reminders };
  });
}
