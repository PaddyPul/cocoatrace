import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { config } from '../../config/env';
import { query } from '../../db';
import logger from '../../logger';
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from '../../errors';
import type { JwtPayload } from '../../middleware/auth';
import { assertPlatformFinance } from '../feeEnforcement/service';
import { assertMutationAssurance } from '../mfa/assurance';
import { emailSender, type EmailSender } from '../../services/emailSender';
import { inTradeTransaction, recordTradeAudit, type TradeActor } from '../trading/transaction';

// Both permissions are required; independent role assignments may supply each.
const recipientEligibility = `member.active AND member.access_suspended_at IS NULL
 AND member.organization_id=f.payer_organization_id AND org.access_suspended_at IS NULL
 AND org.verification_status='verified'
 AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles role ON role.id=ur.role_id
   WHERE ur.user_id=member.id AND ('contract.read'=ANY(role.permissions) OR '*'=ANY(role.permissions)))
 AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles role ON role.id=ur.role_id
   WHERE ur.user_id=member.id AND (role.permissions && ARRAY['payment.read','offer.respond','offer.create','*']::text[]))`;
const eligibleFee = `f.status IN ('invoiced','paid','written_off') AND f.due_at IS NOT NULL AND c.status<>'cancelled'
 AND f.payer_organization_id=CASE f.fee_payer WHEN 'seller' THEN c.seller_organization_id WHEN 'buyer' THEN c.buyer_organization_id END`;

/** Called under the caller's contract lock; an invoice/recipient is queued once. */
export async function enqueueFeeStatement(
  client: PoolClient,
  actor: TradeActor,
  contractId: string,
): Promise<void> {
  const recipients = await client.query<{ id: string }>(
    `SELECT member.id FROM platform_fee_invoices f JOIN sales_contracts c ON c.id=f.contract_id
    JOIN users member ON member.organization_id=f.payer_organization_id JOIN organizations org ON org.id=member.organization_id
    WHERE c.id=$1 AND ${eligibleFee} AND ${recipientEligibility} ORDER BY member.id LIMIT 101`,
    [contractId],
  );
  if (recipients.rows.length > 100)
    throw new ValidationError(
      'Fee statement recipient limit exceeded. Contact the platform operator.',
    );
  if (!recipients.rows.length) {
    await recordTradeAudit(
      client,
      actor,
      'fee.statement.email.contact_missing',
      'sales_contract',
      contractId,
      { reason: 'NO_ELIGIBLE_PAYER_CONTACT' },
    );
    return;
  }
  const inserted = await client.query<{ id: string; fee_id: string }>(
    `INSERT INTO fee_statement_email_outbox(fee_id,recipient_user_id)
    SELECT f.id,member.id FROM platform_fee_invoices f JOIN sales_contracts c ON c.id=f.contract_id
    JOIN users member ON member.organization_id=f.payer_organization_id JOIN organizations org ON org.id=member.organization_id
    WHERE c.id=$1 AND member.id=ANY($2::uuid[]) AND ${eligibleFee} AND ${recipientEligibility}
    ON CONFLICT(fee_id,recipient_user_id) DO NOTHING RETURNING id,fee_id`,
    [contractId, recipients.rows.map((row) => row.id)],
  );
  for (const row of inserted.rows)
    await recordTradeAudit(
      client,
      actor,
      'fee.statement.email.queued',
      'platform_fee_invoice',
      row.fee_id,
      { outboxId: row.id },
    );
}

/** SMTP is at least once; a crash after SMTP accepts but before commit may duplicate a notice. */
export async function processFeeStatementEmails(sender?: EmailSender, limit = 20) {
  const totals = { sent: 0, suppressed: 0, failed: 0, skipped: 0 };
  if (!sender && (!config.identityEmailEnabled || config.emailDriver !== 'smtp')) {
    totals.skipped = 1;
    return totals;
  }
  const delivery = sender ?? emailSender();
  const bounded = Number.isFinite(limit) ? Math.max(0, Math.min(100, Math.floor(limit))) : 0;
  for (let index = 0; index < bounded; index++) {
    const lease = crypto.randomUUID();
    const claimed = await inTradeTransaction(async (client) => {
      await client.query(`WITH exhausted AS (SELECT id FROM fee_statement_email_outbox
        WHERE attempts>=8 AND (status IN ('queued','failed') OR (status='sending' AND (lease_expires_at IS NULL OR lease_expires_at<NOW())))
        ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED)
        UPDATE fee_statement_email_outbox queue SET status='failed_terminal',last_error=COALESCE(queue.last_error,'FINAL_LEASE_EXPIRED'),lease_token=NULL,lease_expires_at=NULL
        FROM exhausted WHERE queue.id=exhausted.id`);
      const row = (
        await client.query<{
          id: string;
          contract_id: string;
        }>(`SELECT queue.id,f.contract_id FROM fee_statement_email_outbox queue
        JOIN platform_fee_invoices f ON f.id=queue.fee_id
        WHERE queue.attempts<8 AND ((queue.status IN ('queued','failed') AND queue.next_attempt_at<=NOW()) OR (queue.status='sending' AND (queue.lease_expires_at IS NULL OR queue.lease_expires_at<NOW())))
        ORDER BY queue.created_at,queue.id LIMIT 1 FOR UPDATE OF queue SKIP LOCKED`)
      ).rows[0];
      if (row)
        await client.query(
          `UPDATE fee_statement_email_outbox SET status='sending',attempts=attempts+1,lease_token=$2,lease_expires_at=NOW()+INTERVAL '5 minutes' WHERE id=$1`,
          [row.id, lease],
        );
      return row;
    });
    if (!claimed) break;
    try {
      const outcome = await inTradeTransaction(async (client) => {
        await client.query('SELECT id FROM sales_contracts WHERE id=$1 FOR UPDATE', [
          claimed.contract_id,
        ]);
        const owned = (
          await client.query(
            `SELECT id FROM fee_statement_email_outbox WHERE id=$1 AND status='sending' AND lease_token=$2 AND lease_expires_at>NOW() FOR UPDATE`,
            [claimed.id, lease],
          )
        ).rows[0];
        if (!owned) return 'lost' as const;
        // Keep the current authorization rows stable through SMTP submission.
        await client.query(
          `SELECT ur.user_id FROM fee_statement_email_outbox queue
          JOIN user_roles ur ON ur.user_id=queue.recipient_user_id JOIN roles role ON role.id=ur.role_id
          WHERE queue.id=$1 FOR SHARE OF ur,role`,
          [claimed.id],
        );
        const current = (
          await client.query<{ email: string }>(
            `SELECT member.email FROM fee_statement_email_outbox queue
          JOIN platform_fee_invoices f ON f.id=queue.fee_id JOIN sales_contracts c ON c.id=f.contract_id
          JOIN users member ON member.id=queue.recipient_user_id JOIN organizations org ON org.id=member.organization_id
          WHERE queue.id=$1 AND ${eligibleFee} AND ${recipientEligibility}
          FOR SHARE OF member,org`,
            [claimed.id],
          )
        ).rows[0];
        let status: 'sent' | 'suppressed' = 'suppressed';
        if (current)
          status = (
            await delivery.send({
              to: current.email,
              category: 'fee_statement',
              subject: 'BetterTrade: platform fee statement available',
              text: `A commercial platform fee statement is available. Sign in to review the amount, collection status and payment instructions. This notice is not a tax invoice or a receipt.\n\n${new URL(`/deal-room/${claimed.contract_id}`, config.publicWebUrl).toString()}`,
            })
          ).status;
        await client.query(
          `UPDATE fee_statement_email_outbox SET status=$3,sent_at=CASE WHEN $3='sent' THEN NOW() ELSE sent_at END,
          last_error=CASE WHEN $4 THEN NULL ELSE 'FEE_OR_RECIPIENT_NO_LONGER_ELIGIBLE' END,lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND status='sending'`,
          [claimed.id, lease, status, Boolean(current)],
        );
        return status;
      });
      if (outcome !== 'lost') totals[outcome]++;
    } catch {
      await query(
        `UPDATE fee_statement_email_outbox SET status=CASE WHEN attempts>=8 THEN 'failed_terminal' ELSE 'failed' END,
        last_error='SMTP_SUBMISSION_FAILED',next_attempt_at=NOW()+make_interval(secs=>LEAST(3600,60*attempts)),lease_token=NULL,lease_expires_at=NULL
        WHERE id=$1 AND lease_token=$2 AND status='sending'`,
        [claimed.id, lease],
      );
      totals.failed++;
      logger.error(
        { notificationId: claimed.id },
        'Fee statement email failed; durable retry retained',
      );
    }
  }
  return totals;
}

async function authorize(
  client: PoolClient,
  actor: JwtPayload,
  contractId: string,
  mutation: boolean,
) {
  const finance = actor.permissions.some((p) => p === '*' || p === 'finance.manage');
  if (mutation && finance) await assertPlatformFinance(client, actor);
  else if (mutation) await assertMutationAssurance(client, actor);
  const current = (
    await client.query(
      `SELECT member.id FROM users member JOIN organizations org ON org.id=member.organization_id
    JOIN sessions session ON session.user_id=member.id AND session.id=$3 AND session.revoked_at IS NULL AND session.expires_at>NOW()
    WHERE member.id=$1 AND member.organization_id=$2 AND member.active AND member.access_suspended_at IS NULL AND org.access_suspended_at IS NULL
    AND org.verification_status='verified' AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles role ON role.id=ur.role_id WHERE ur.user_id=member.id
      AND (('*'=ANY(role.permissions)) OR ($4 AND 'finance.manage'=ANY(role.permissions)) OR (NOT $4 AND ('contract.read'=ANY(role.permissions)))))
    FOR SHARE OF member,org,session`,
      [actor.id, actor.organizationId, actor.sessionId, finance],
    )
  ).rows[0];
  if (!current) throw new ForbiddenError('Current fee statement authority required');
  const fee = (
    await client.query<{ id: string; status: string }>(
      `SELECT f.id,f.status FROM platform_fee_invoices f JOIN sales_contracts c ON c.id=f.contract_id
    WHERE c.id=$1 AND ($3 OR f.payer_organization_id=$2) FOR UPDATE OF c,f`,
      [contractId, actor.organizationId, finance],
    )
  ).rows[0];
  if (!fee) throw new NotFoundError('Fee statement');
  return fee;
}
async function counts(client: PoolClient, feeId: string) {
  const rows = (
    await client.query<{ status: string; count: number }>(
      `SELECT status,COUNT(*)::int count FROM fee_statement_email_outbox WHERE fee_id=$1 GROUP BY status`,
      [feeId],
    )
  ).rows;
  const totals = { queued: 0, sending: 0, sent: 0, suppressed: 0, failed: 0, failed_terminal: 0 };
  for (const row of rows)
    if (row.status in totals) totals[row.status as keyof typeof totals] = row.count;
  return { ...totals, missingContact: rows.length === 0 };
}
/** Explicit existing-statement delivery; dedupe prevents replay from spamming recipients. */
export async function requestFeeStatementDelivery(actor: JwtPayload, contractId: string) {
  return inTradeTransaction(async (client) => {
    const fee = await authorize(client, actor, contractId, true);
    if (!['invoiced', 'paid', 'written_off'].includes(fee.status))
      throw new ConflictError('Only an issued fee statement can be emailed');
    await enqueueFeeStatement(client, actor, contractId);
    return counts(client, fee.id);
  });
}
export async function readDeliveryStatus(actor: JwtPayload, contractId: string) {
  return inTradeTransaction(async (client) => {
    const fee = await authorize(client, actor, contractId, false);
    return counts(client, fee.id);
  });
}
