import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { query } from '../../db';
import { config } from '../../config/env';
import logger from '../../logger';
import { hashObject } from '../../services/audit';
import { emailSender, type EmailSender } from '../../services/emailSender';
import { inTradeTransaction } from '../trading/transaction';

// Reserved non-login audit principal. It is not a users row and grants no permissions.
export const PAYMENT_REMINDER_SYSTEM_ACTOR = '00000000-0000-4000-8000-000000000001';

const eligiblePayment = `c.payment_terms_status='agreed' AND c.status NOT IN ('settled','cancelled')
  AND i.status='due' AND i.due_at<NOW()
  AND NOT EXISTS (SELECT 1 FROM payment_issues issue WHERE issue.payment_request_id=p.id AND issue.status<>'resolved')
  AND NOT EXISTS (SELECT 1 FROM delivery_discrepancies discrepancy WHERE discrepancy.contract_id=c.id AND discrepancy.status<>'resolved')`;
const permittedRecipient = `member.active AND member.organization_id=c.buyer_organization_id
  AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles role ON role.id=ur.role_id
    WHERE ur.user_id=member.id AND ('payment.read'=ANY(role.permissions) OR '*'=ANY(role.permissions)))`;

/** Commit recipient work in the same transaction as its durable daily reminder. */
export async function queueReminderEmails(client: PoolClient, reminderId: string): Promise<void> {
  await client.query(
    `INSERT INTO payment_reminder_email_outbox(reminder_id,recipient_user_id)
    SELECT reminder.id,member.id FROM payment_reminders reminder
    JOIN payment_requests p ON p.id=reminder.payment_request_id
    JOIN sales_contracts c ON c.id=p.contract_id JOIN users member ON member.organization_id=c.buyer_organization_id
    WHERE reminder.id=$1 AND reminder.recipient_organization_id=c.buyer_organization_id AND ${permittedRecipient}
    ON CONFLICT(reminder_id,recipient_user_id) DO NOTHING`,
    [reminderId],
  );
}

/** Contract-first locks serialize reminder decisions with payment and issue changes. */
export async function enqueueOverdueReminders(limit = 100) {
  const candidates = (
    await query(
      `SELECT c.id AS contract_id,i.id AS installment_id
    FROM payment_installments i JOIN payment_requests p ON p.id=i.payment_request_id JOIN sales_contracts c ON c.id=p.contract_id
    WHERE ${eligiblePayment} AND i.due_at<NOW()-INTERVAL '24 hours' AND NOT EXISTS (SELECT 1 FROM payment_reminders reminder
      WHERE reminder.installment_id=i.id AND reminder.reminder_date=(NOW() AT TIME ZONE 'UTC')::date)
    ORDER BY i.due_at,i.id LIMIT $1`,
      [boundedLimit(limit, 1000)],
    )
  ).rows;
  let created = 0;
  for (const candidate of candidates) {
    const inserted = await inTradeTransaction(async (client) => {
      await client.query('SELECT id FROM sales_contracts WHERE id=$1 FOR UPDATE', [
        candidate.contract_id,
      ]);
      const installment = (
        await client.query<{
          id: string;
          payment_request_id: string;
          buyer_organization_id: string;
        }>(
          `SELECT i.id,i.payment_request_id,c.buyer_organization_id
        FROM payment_installments i JOIN payment_requests p ON p.id=i.payment_request_id JOIN sales_contracts c ON c.id=p.contract_id
        WHERE c.id=$1 AND i.id=$2 AND ${eligiblePayment} AND i.due_at<NOW()-INTERVAL '24 hours' FOR UPDATE OF i`,
          [candidate.contract_id, candidate.installment_id],
        )
      ).rows[0];
      if (!installment) return false;
      const reminder = (
        await client.query<{ id: string; reminder_date: string }>(
          `INSERT INTO payment_reminders
        (payment_request_id,installment_id,recipient_organization_id,created_by_user_id,reminder_date)
        VALUES($1,$2,$3,NULL,(NOW() AT TIME ZONE 'UTC')::date)
        ON CONFLICT(installment_id,reminder_date) DO NOTHING RETURNING id,reminder_date`,
          [installment.payment_request_id, installment.id, installment.buyer_organization_id],
        )
      ).rows[0];
      if (!reminder) return false;
      const metadata = {
        recipientOrganizationId: installment.buyer_organization_id,
        reminderDate: reminder.reminder_date,
        automatic: true,
      };
      await client.query(
        `INSERT INTO audit_events
        (actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,metadata)
        VALUES($4,$5,'payment.reminder.create','payment_installment',$1,$2,$3)`,
        [
          installment.id,
          hashObject({ action: 'payment.reminder.create', entityId: installment.id, ...metadata }),
          JSON.stringify(metadata),
          PAYMENT_REMINDER_SYSTEM_ACTOR,
          installment.buyer_organization_id,
        ],
      );
      await queueReminderEmails(client, reminder.id);
      return true;
    });
    if (inserted) created++;
  }
  return { created };
}

function boundedLimit(limit: number, maximum: number) {
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(limit)));
}

type ClaimedEmail = { id: string; contract_id: string };
type Delivery = {
  email: string;
  amount_due: string;
  currency: string;
  due_at: Date | string;
  contract_id: string;
};

/** SMTP is at least once: a crash after submission but before commit can duplicate an email. */
export async function processPaymentReminderEmails(sender?: EmailSender, limit = 20) {
  const totals = { sent: 0, suppressed: 0, failed: 0, skipped: 0 };
  // Development suppression must not consume the durable queue before SMTP is configured.
  if (!sender && (!config.identityEmailEnabled || config.emailDriver !== 'smtp')) {
    totals.skipped = 1;
    return totals;
  }
  const delivery = sender ?? emailSender();
  for (let index = 0; index < boundedLimit(limit, 1000); index++) {
    const lease = crypto.randomUUID();
    const claimed = await inTradeTransaction(async (client) => {
      await client.query(`UPDATE payment_reminder_email_outbox SET status='failed_terminal',
        last_error=COALESCE(last_error,'FINAL_LEASE_EXPIRED'),lease_token=NULL,lease_expires_at=NULL
        WHERE attempts>=8 AND (status IN ('queued','failed') OR (status='sending' AND lease_expires_at<NOW()))`);
      const row = (
        await client.query<ClaimedEmail>(`SELECT queue.id,p.contract_id FROM payment_reminder_email_outbox queue
        JOIN payment_reminders reminder ON reminder.id=queue.reminder_id JOIN payment_requests p ON p.id=reminder.payment_request_id
        WHERE queue.attempts<8 AND ((queue.status IN ('queued','failed') AND queue.next_attempt_at<=NOW())
          OR (queue.status='sending' AND queue.lease_expires_at<NOW()))
        ORDER BY queue.created_at,queue.id LIMIT 1 FOR UPDATE OF queue SKIP LOCKED`)
      ).rows[0];
      if (row)
        await client.query(
          `UPDATE payment_reminder_email_outbox SET status='sending',attempts=attempts+1,
        lease_token=$2,lease_expires_at=NOW()+INTERVAL '5 minutes' WHERE id=$1`,
          [row.id, lease],
        );
      return row;
    });
    if (!claimed) break;
    try {
      const status = await inTradeTransaction(async (client) => {
        // Lock order matches all trade operations. Hold this short contract lock through
        // SMTP submission so receipt verification cannot race stale payment demands.
        await client.query('SELECT id FROM sales_contracts WHERE id=$1 FOR UPDATE', [
          claimed.contract_id,
        ]);
        const owned = (
          await client.query(
            `SELECT id FROM payment_reminder_email_outbox
          WHERE id=$1 AND lease_token=$2 AND status='sending' AND lease_expires_at>NOW() FOR UPDATE`,
            [claimed.id, lease],
          )
        ).rows[0];
        if (!owned) return 'lost' as const;
        const current = (
          await client.query<Delivery>(
            `SELECT member.email,i.amount_due,c.currency,i.due_at,c.id AS contract_id
          FROM payment_reminder_email_outbox queue JOIN payment_reminders reminder ON reminder.id=queue.reminder_id
          JOIN payment_installments i ON i.id=reminder.installment_id AND i.payment_request_id=reminder.payment_request_id
          JOIN payment_requests p ON p.id=i.payment_request_id JOIN sales_contracts c ON c.id=p.contract_id
          JOIN users member ON member.id=queue.recipient_user_id
          WHERE queue.id=$1 AND reminder.recipient_organization_id=c.buyer_organization_id
            AND NOT EXISTS(SELECT 1 FROM payment_reminders newer WHERE newer.installment_id=i.id AND newer.reminder_date>reminder.reminder_date)
            AND ${eligiblePayment} AND ${permittedRecipient}`,
            [claimed.id],
          )
        ).rows[0];
        let outcome: 'sent' | 'suppressed' = 'suppressed';
        if (current) {
          const link = new URL(`/deal-room/${current.contract_id}`, config.publicWebUrl).toString();
          outcome = (
            await delivery.send({
              to: current.email,
              category: 'payment_reminder',
              subject: 'CocoaTrace: overdue trade payment',
              text: `A payment of ${current.amount_due} ${current.currency.trim()} was due on ${new Date(current.due_at).toISOString()}.\n\nSign in to review the agreed payment terms and next action:\n${link}\n\nIf you have already sent funds, record the payment in the deal room. A submitted payment awaits supplier receipt verification.`,
            })
          ).status;
        }
        await client.query(
          `UPDATE payment_reminder_email_outbox SET status=$3,
          last_error=CASE WHEN $4 THEN NULL ELSE 'PAYMENT_OR_RECIPIENT_NO_LONGER_ELIGIBLE' END,
          sent_at=CASE WHEN $3='sent' THEN NOW() ELSE sent_at END,lease_token=NULL,lease_expires_at=NULL
          WHERE id=$1 AND lease_token=$2 AND status='sending'`,
          [claimed.id, lease, outcome, Boolean(current)],
        );
        return outcome;
      });
      if (status !== 'lost') totals[status]++;
    } catch {
      await query(
        `UPDATE payment_reminder_email_outbox SET status=CASE WHEN attempts>=8 THEN 'failed_terminal' ELSE 'failed' END,
        last_error='SMTP_SUBMISSION_FAILED',next_attempt_at=NOW()+make_interval(secs=>LEAST(3600,60*attempts)),
        lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND status='sending'`,
        [claimed.id, lease],
      );
      totals.failed++;
      logger.error(
        { notificationId: claimed.id },
        'Payment reminder submission failed; durable retry retained',
      );
    }
  }
  return totals;
}

export function startPaymentReminderWorker() {
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await enqueueOverdueReminders();
      await processPaymentReminderEmails();
    } catch {
      logger.error('Payment reminder worker failed; durable queue retained');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 15000);
  timer.unref();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
