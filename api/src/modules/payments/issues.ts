import type { PoolClient } from 'pg';
import { AppError, ConflictError, NotFoundError } from '../../errors';
import { completeTradeIfReady } from '../../services/tradeSettlement';
import { inTradeTransaction, recordTradeAudit, TradeActor } from '../trading/transaction';
import { lockPayment } from './locking';

export type PaymentIssueInput = {
  issueType: 'payment_dispute' | 'reference_correction' | 'receipt_reversal';
  installmentId?: string;
  reason: string;
  proposedReference?: string;
};

function textInput(value: string, label: string, limit = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) {
    throw new AppError(
      `${label} is required and must be at most ${limit} characters`,
      400,
      'VALIDATION_ERROR',
    );
  }
  return value.trim();
}

async function lockPartyPayment(client: PoolClient, actor: TradeActor, paymentId: string) {
  const party = (
    await client.query(
      `SELECT c.buyer_organization_id,c.seller_organization_id
    FROM payment_requests p JOIN sales_contracts c ON c.id=p.contract_id
    WHERE p.id=$1 AND $2 IN(c.buyer_organization_id,c.seller_organization_id)`,
      [paymentId, actor.organizationId],
    )
  ).rows[0];
  if (!party) throw new NotFoundError('Payment workflow');
  const role = party.buyer_organization_id === actor.organizationId ? 'buyer' : 'seller';
  const locked = await lockPayment(client, actor, paymentId, role);
  if (locked.contract.status === 'cancelled')
    throw new ConflictError('Cancelled deals cannot change payment workflows');
  return { ...locked, role };
}

async function lockIssue(client: PoolClient, actor: TradeActor, issueId: string) {
  const lookup = (
    await client.query('SELECT payment_request_id FROM payment_issues WHERE id=$1', [issueId])
  ).rows[0];
  if (!lookup) throw new NotFoundError('Payment issue');
  const locked = await lockPartyPayment(client, actor, lookup.payment_request_id);
  const issue = (
    await client.query('SELECT * FROM payment_issues WHERE id=$1 FOR UPDATE', [issueId])
  ).rows[0];
  if (!issue) throw new NotFoundError('Payment issue');
  return { ...locked, issue };
}

export async function openPaymentIssue(
  actor: TradeActor,
  paymentId: string,
  input: PaymentIssueInput,
) {
  const reason = textInput(input.reason, 'Issue explanation');
  if (!['payment_dispute', 'reference_correction', 'receipt_reversal'].includes(input.issueType)) {
    throw new AppError('Unsupported payment issue', 400, 'VALIDATION_ERROR');
  }
  const reference =
    input.issueType === 'reference_correction'
      ? textInput(input.proposedReference!, 'Corrected payment reference', 200)
      : null;
  if (input.issueType !== 'reference_correction' && input.proposedReference) {
    throw new AppError(
      'Only reference corrections may propose a reference',
      400,
      'VALIDATION_ERROR',
    );
  }
  return inTradeTransaction(async (client) => {
    const { contract, payment, role } = await lockPartyPayment(client, actor, paymentId);
    const active = (
      await client.query(
        "SELECT * FROM payment_issues WHERE payment_request_id=$1 AND status<>'resolved' FOR UPDATE",
        [payment.id],
      )
    ).rows[0];
    if (active) {
      if (
        active.issue_type === input.issueType &&
        (active.installment_id || null) === (input.installmentId || null) &&
        active.reason === reason &&
        (active.proposed_reference || null) === reference &&
        active.opened_by_organization_id === actor.organizationId
      )
        return active;
      throw new ConflictError('Resolve the current payment issue before opening another');
    }
    const item = input.installmentId
      ? (
          await client.query(
            'SELECT * FROM payment_installments WHERE id=$1 AND payment_request_id=$2 FOR UPDATE',
            [input.installmentId, payment.id],
          )
        ).rows[0]
      : null;
    if (input.installmentId && !item) throw new NotFoundError('Installment');
    if (input.issueType === 'reference_correction') {
      if (role !== 'buyer' || !item || item.status !== 'payment_submitted')
        throw new ConflictError(
          'The buyer can correct only a submitted payment awaiting verification',
        );
      if (item.payment_reference_external === reference)
        throw new ConflictError('The corrected reference must differ from the submitted reference');
      await requireUniqueReference(client, payment.id, item.id, reference!);
    }
    if (input.issueType === 'receipt_reversal') {
      if (role !== 'seller' || !item || item.status !== 'paid' || contract.status === 'settled') {
        throw new ConflictError(
          'The supplier can propose reversing a verified receipt only before trade completion',
        );
      }
    }
    const issue = (
      await client.query(
        `INSERT INTO payment_issues
      (payment_request_id,installment_id,issue_type,status,opened_by_user_id,opened_by_organization_id,reason,proposed_reference)
      VALUES($1,$2,$3,'open',$4,$5,$6,$7) RETURNING *`,
        [
          payment.id,
          input.installmentId || null,
          input.issueType,
          actor.id,
          actor.organizationId,
          reason,
          reference,
        ],
      )
    ).rows[0];
    await recordTradeAudit(client, actor, 'payment.issue.open', 'payment_issue', issue.id, {
      paymentId: payment.id,
      installmentId: item?.id || null,
      issueType: input.issueType,
      reason,
      proposedReference: reference,
      previousReference: item?.payment_reference_external || null,
    });
    return issue;
  });
}

async function requireUniqueReference(
  client: PoolClient,
  paymentId: string,
  installmentId: string,
  reference: string,
) {
  const duplicate = await client.query(
    'SELECT id FROM payment_installments WHERE payment_request_id=$1 AND id<>$2 AND payment_reference_external=$3',
    [paymentId, installmentId, reference],
  );
  if (duplicate.rows[0])
    throw new ConflictError('Use a separate payment reference for each installment');
}

export async function proposeIssueResolution(actor: TradeActor, issueId: string, note: string) {
  const resolution = textInput(note, 'Resolution explanation');
  return inTradeTransaction(async (client) => {
    const { issue, role } = await lockIssue(client, actor, issueId);
    if (issue.status !== 'open') {
      if (
        issue.resolution_note === resolution &&
        issue.resolution_proposed_by_organization_id === actor.organizationId
      )
        return issue;
      throw new ConflictError('This issue already has a resolution proposal');
    }
    if (
      (issue.issue_type === 'reference_correction' && role !== 'buyer') ||
      (issue.issue_type === 'receipt_reversal' && role !== 'seller')
    ) {
      throw new ConflictError('The party requesting this correction must propose its resolution');
    }
    const updated = (
      await client.query(
        `UPDATE payment_issues SET status='resolution_proposed',resolution_note=$1,
      resolution_proposed_by_user_id=$2,resolution_proposed_by_organization_id=$3,updated_at=NOW() WHERE id=$4 RETURNING *`,
        [resolution, actor.id, actor.organizationId, issue.id],
      )
    ).rows[0];
    await recordTradeAudit(
      client,
      actor,
      'payment.issue.resolution.propose',
      'payment_issue',
      issue.id,
      {
        paymentId: issue.payment_request_id,
        issueType: issue.issue_type,
        resolutionNote: resolution,
      },
    );
    return updated;
  });
}

export async function approveIssueResolution(actor: TradeActor, issueId: string) {
  return inTradeTransaction(async (client) => {
    const { contract, payment, issue, role } = await lockIssue(client, actor, issueId);
    if (
      issue.resolution_proposed_by_organization_id === actor.organizationId ||
      (issue.issue_type === 'reference_correction' && role !== 'seller') ||
      (issue.issue_type === 'receipt_reversal' && role !== 'buyer')
    ) {
      throw new ConflictError('The other trade party must approve this resolution');
    }
    if (issue.status === 'resolved') return issue;
    if (issue.status !== 'resolution_proposed')
      throw new ConflictError('A resolution must be proposed first');
    let previousReference: string | null = null;
    let previousReceipt: Record<string, unknown> | null = null;
    if (issue.issue_type !== 'payment_dispute') {
      const item = (
        await client.query(
          'SELECT * FROM payment_installments WHERE id=$1 AND payment_request_id=$2 FOR UPDATE',
          [issue.installment_id, payment.id],
        )
      ).rows[0];
      if (!item) throw new NotFoundError('Installment');
      previousReference = item.payment_reference_external;
      if (issue.issue_type === 'reference_correction') {
        if (item.status !== 'payment_submitted')
          throw new ConflictError('This payment is no longer awaiting verification');
        await requireUniqueReference(client, payment.id, item.id, issue.proposed_reference);
        await client.query(
          'UPDATE payment_installments SET payment_reference_external=$1,updated_at=NOW() WHERE id=$2',
          [issue.proposed_reference, item.id],
        );
        await client.query(
          'UPDATE payment_requests SET payment_reference_external=$1,updated_at=NOW() WHERE id=$2 AND payment_reference_external=$3',
          [issue.proposed_reference, payment.id, previousReference],
        );
      } else {
        if (contract.status === 'settled' || item.status !== 'paid')
          throw new ConflictError(
            'Completed trades and unverified payments cannot have receipts reversed',
          );
        previousReceipt = {
          verifiedByUserId: item.verified_by_user_id,
          verifiedAt: item.verified_at,
          submittedByUserId: item.submitted_by_user_id,
          submittedAt: item.submitted_at,
          amount: item.amount_due,
          evidenceId: item.payment_evidence_id || null,
        };
        await client.query(
          `UPDATE payment_installments SET status='due',verified_by_user_id=NULL,verified_at=NULL,
          submitted_by_user_id=NULL,submitted_at=NULL,updated_at=NOW() WHERE id=$1`,
          [item.id],
        );
        await client.query(
          `UPDATE payment_requests p SET amount_confirmed=t.confirmed,
          status=CASE WHEN t.pending THEN 'payment_pending_verification' WHEN t.confirmed>0 THEN 'partially_paid' ELSE 'payment_due' END,
          release_status=CASE WHEN $2='pay_after_delivery' OR ($2='bank_secured' AND p.security_status='verified') THEN 'authorized' ELSE 'locked' END,
          settled_at=NULL,updated_at=NOW() FROM (
            SELECT COALESCE(SUM(amount_due) FILTER(WHERE status='paid'),0) AS confirmed,
              COALESCE(BOOL_OR(status='payment_submitted'),FALSE) AS pending
            FROM payment_installments WHERE payment_request_id=$1
          ) t WHERE p.id=$1`,
          [payment.id, contract.payment_plan],
        );
      }
    }
    const updated = (
      await client.query(
        `UPDATE payment_issues SET status='resolved',resolved_by_user_id=$1,
      resolved_at=NOW(),updated_at=NOW() WHERE id=$2 RETURNING *`,
        [actor.id, issue.id],
      )
    ).rows[0];
    await recordTradeAudit(
      client,
      actor,
      'payment.issue.resolution.approve',
      'payment_issue',
      issue.id,
      {
        paymentId: payment.id,
        installmentId: issue.installment_id,
        issueType: issue.issue_type,
        previousReference,
        previousReceipt,
        proposedReference: issue.proposed_reference,
        resolutionNote: issue.resolution_note,
        proposedByOrganizationId: issue.resolution_proposed_by_organization_id,
      },
    );
    await completeTradeIfReady(client, contract.id);
    return updated;
  });
}
