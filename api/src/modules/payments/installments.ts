import { evidenceStorage } from '../../services/evidenceStorage';
import { AppError, ConflictError, NotFoundError } from '../../errors';
import { inTradeTransaction, recordTradeAudit, TradeActor } from '../trading/transaction';
import { completeTradeIfReady } from '../../services/tradeSettlement';
import { lockPayment, requireAgreed } from './locking';
import { assertNoActivePaymentIssue } from './issueGuard';

export type PaymentSubmission = { transactionReference: string; evidenceId?: string };

export async function submitPayment(
  actor: TradeActor,
  id: string,
  input: PaymentSubmission,
  legacyRequest = false,
) {
  return inTradeTransaction(async (client) => {
    const { contract, payment } = await lockPayment(client, actor, id, 'buyer', !legacyRequest);
    requireAgreed(contract);
    await assertNoActivePaymentIssue(client, payment.id);
    const item = (
      await client.query(
        legacyRequest
          ? "SELECT * FROM payment_installments WHERE payment_request_id=$1 AND (payment_reference_external=$2 OR status IN('due','payment_submitted')) ORDER BY (payment_reference_external=$2) DESC NULLS LAST,sequence_number LIMIT 1 FOR UPDATE"
          : 'SELECT * FROM payment_installments WHERE id=$1 FOR UPDATE',
        legacyRequest ? [id, input.transactionReference] : [id],
      )
    ).rows[0];
    if (!item || item.payment_request_id !== payment.id)
      throw new ConflictError('No payment installment is currently due');
    const same =
      item.payment_reference_external === input.transactionReference &&
      (item.payment_evidence_id || null) === (input.evidenceId || null);
    if (['payment_submitted', 'paid'].includes(item.status) && same) return item;
    if (item.status !== 'due')
      throw new ConflictError('This installment is not due or has a different submitted reference');
    const duplicateReference = await client.query(
      'SELECT id FROM payment_installments WHERE payment_request_id=$1 AND id<>$2 AND payment_reference_external=$3',
      [payment.id, item.id, input.transactionReference],
    );
    if (duplicateReference.rows[0])
      throw new ConflictError('Use a separate payment reference for each installment');
    if (contract.payment_evidence_required && !input.evidenceId) {
      throw new AppError(
        'Attach the payment proof required by the agreed terms',
        400,
        'PAYMENT_EVIDENCE_REQUIRED',
      );
    }
    if (input.evidenceId) {
      const evidence = (
        await client.query(
          `SELECT id,storage_key FROM evidence_items WHERE id=$1 AND linked_entity_type='contract'
        AND linked_entity_id=$2 AND uploader_organization_id=$3 AND type='payment_proof'
        AND validation_status='validated' AND malware_scan_status='clean' AND review_status<>'rejected'
        AND storage_key IS NOT NULL FOR SHARE`,
          [input.evidenceId, contract.id, actor.organizationId],
        )
      ).rows[0];
      if (!evidence || !(await evidenceStorage().get(evidence.storage_key))?.length)
        throw new AppError(
          'Payment proof must be your scan-clean, validated upload for this contract',
          400,
          'PAYMENT_EVIDENCE_INVALID',
        );
      const used = await client.query(
        'SELECT id FROM payment_installments WHERE payment_evidence_id=$1 AND id<>$2',
        [input.evidenceId, item.id],
      );
      if (used.rows[0])
        throw new ConflictError('This proof is already attached to another installment');
    }
    const updated = (
      await client.query(
        `UPDATE payment_installments SET status='payment_submitted',payment_reference_external=$1,
      payment_evidence_id=$2,submitted_by_user_id=$3,submitted_at=NOW(),rejected_at=NULL,rejection_reason=NULL,updated_at=NOW()
      WHERE id=$4 RETURNING *`,
        [input.transactionReference, input.evidenceId || null, actor.id, item.id],
      )
    ).rows[0];
    await client.query(
      "UPDATE payment_requests SET status='payment_pending_verification',payment_reference_external=$1,updated_at=NOW() WHERE id=$2",
      [input.transactionReference, payment.id],
    );
    await recordTradeAudit(client, actor, 'payment.submit', 'payment_installment', item.id, {
      reference: input.transactionReference,
      evidenceId: input.evidenceId || null,
    });
    return updated;
  });
}

export async function confirmReceipt(actor: TradeActor, id: string) {
  return inTradeTransaction(async (client) => {
    const { contract, payment } = await lockPayment(client, actor, id, 'seller', true);
    requireAgreed(contract);
    await assertNoActivePaymentIssue(client, payment.id);
    const item = (
      await client.query('SELECT * FROM payment_installments WHERE id=$1 FOR UPDATE', [id])
    ).rows[0];
    if (!item) throw new NotFoundError('Installment');
    if (item.status === 'paid') return item;
    if (item.status !== 'payment_submitted')
      throw new ConflictError('The buyer must submit the payment first');
    // Proof may have been rejected or quarantined after submission.
    if (contract.payment_evidence_required || item.payment_evidence_id) {
      const proof = await client.query(
        `SELECT id,storage_key FROM evidence_items WHERE id=$1 AND validation_status='validated'
        AND malware_scan_status='clean' AND review_status<>'rejected' AND storage_key IS NOT NULL FOR SHARE`,
        [item.payment_evidence_id],
      );
      if (!proof.rows[0] || !(await evidenceStorage().get(proof.rows[0].storage_key))?.length)
        throw new ConflictError(
          'The attached payment proof is unavailable; reject the reference and ask for valid proof',
        );
    }
    const updated = (
      await client.query(
        "UPDATE payment_installments SET status='paid',verified_by_user_id=$1,verified_at=NOW(),updated_at=NOW() WHERE id=$2 RETURNING *",
        [actor.id, id],
      )
    ).rows[0];
    // PostgreSQL NUMERIC calculates the total, without JS floating-point tolerance.
    const totals = (
      await client.query(
        `SELECT COALESCE(SUM(amount_due) FILTER(WHERE status='paid'),0) AS confirmed,
      COALESCE(SUM(amount_due) FILTER(WHERE status='paid'),0)=$2::numeric AS settled
      FROM payment_installments WHERE payment_request_id=$1`,
        [payment.id, payment.amount_total],
      )
    ).rows[0];
    await client.query(
      `UPDATE payment_requests SET amount_confirmed=$1,status=$2,
      release_status=CASE WHEN $3 THEN 'authorized' ELSE release_status END,
      settled_at=CASE WHEN $3 THEN COALESCE(settled_at,NOW()) ELSE settled_at END,updated_at=NOW() WHERE id=$4`,
      [totals.confirmed, totals.settled ? 'settled' : 'partially_paid', totals.settled, payment.id],
    );
    if (totals.settled) await completeTradeIfReady(client, contract.id);
    await recordTradeAudit(client, actor, 'payment.receipt.verify', 'payment_installment', id, {
      reference: item.payment_reference_external,
      evidenceId: item.payment_evidence_id,
      amount: item.amount_due,
    });
    return { ...updated, amountConfirmed: Number(totals.confirmed), settled: totals.settled };
  });
}

export async function rejectReceipt(actor: TradeActor, id: string, reason: string) {
  return inTradeTransaction(async (client) => {
    const { contract, payment } = await lockPayment(client, actor, id, 'seller', true);
    requireAgreed(contract);
    await assertNoActivePaymentIssue(client, payment.id);
    const item = (
      await client.query('SELECT * FROM payment_installments WHERE id=$1 FOR UPDATE', [id])
    ).rows[0];
    if (!item) throw new NotFoundError('Installment');
    if (item.status === 'due' && item.rejection_reason === reason) return item;
    if (item.status !== 'payment_submitted')
      throw new ConflictError('No submitted payment is awaiting verification');
    const updated = (
      await client.query(
        `UPDATE payment_installments SET status='due',rejected_at=NOW(),rejection_reason=$1,
      submitted_by_user_id=NULL,submitted_at=NULL,updated_at=NOW() WHERE id=$2 RETURNING *`,
        [reason, id],
      )
    ).rows[0];
    await client.query(
      "UPDATE payment_requests SET status='payment_due',updated_at=NOW() WHERE id=$1",
      [payment.id],
    );
    await recordTradeAudit(client, actor, 'payment.receipt.reject', 'payment_installment', id, {
      reason,
      reference: item.payment_reference_external,
      evidenceId: item.payment_evidence_id,
    });
    return updated;
  });
}
