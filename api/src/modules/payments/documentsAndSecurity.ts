import { documentsCanBePresentedAt } from './documentPolicy';
import { activatePaymentInstallments } from './dueDates';
import { evidenceStorage } from '../../services/evidenceStorage';
import { ConflictError, ValidationError } from '../../errors';
import { inTradeTransaction, recordTradeAudit, TradeActor } from '../trading/transaction';
import { lockPayment, requireAgreed } from './locking';
import { assertNoActivePaymentIssue } from './issueGuard';

export async function presentDocuments(actor: TradeActor, id: string) {
  return inTradeTransaction(async (client) => {
    const { contract, payment } = await lockPayment(client, actor, id, 'seller');
    requireAgreed(contract);
    await assertNoActivePaymentIssue(client, payment.id);
    if (payment.documents_presented_at) return payment;
    if (
      !['deposit_balance', 'documentary_collection', 'bank_secured'].includes(contract.payment_plan)
    ) {
      throw new ConflictError('This plan does not trigger payment through document presentation');
    }
    if (contract.payment_plan === 'bank_secured' && payment.security_status !== 'verified') {
      throw new ConflictError(
        'The seller must accept the external bank security before presenting documents',
      );
    }
    const shipment = (
      await client.query(
        'SELECT current_milestone,transport_document_reference FROM shipments WHERE contract_id=$1 ORDER BY created_at DESC LIMIT 1',
        [contract.id],
      )
    ).rows[0];
    if (!documentsCanBePresentedAt(shipment?.current_milestone)) {
      throw new ValidationError(
        'The goods must be handed to the transport provider before presenting documents',
      );
    }
    if (!shipment?.transport_document_reference)
      throw new ValidationError('Record the applicable transport-document reference first');
    const required = ['commercial_invoice', 'packing_list', 'transport_document'];
    if (['CIF', 'CIP'].includes(String(contract.incoterm).toUpperCase()))
      required.push('insurance_certificate');
    const documents = await client.query(
      `SELECT type,storage_key FROM evidence_items WHERE linked_entity_type='contract' AND linked_entity_id=$1
      AND uploader_organization_id=$2 AND type=ANY($3::text[]) AND validation_status='validated'
      AND malware_scan_status='clean' AND review_status<>'rejected' AND storage_key IS NOT NULL FOR SHARE`,
      [contract.id, actor.organizationId, required],
    );
    const present = new Set<string>();
    for (const item of documents.rows) {
      if ((await evidenceStorage().get(item.storage_key))?.length) present.add(item.type);
    }
    const missing = required.filter((type) => !present.has(type));
    if (missing.length)
      throw new ValidationError(
        `Upload validated, scan-clean documents first: ${missing.join(', ')}`,
      );
    await activatePaymentInstallments(client, id, 'documents_presented');
    const updated = (
      await client.query(
        "UPDATE payment_requests SET status='payment_due',documents_presented_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *",
        [id],
      )
    ).rows[0];
    await recordTradeAudit(client, actor, 'payment.documents.present', 'payment_request', id, {
      required,
    });
    return updated;
  });
}

export async function submitSecurity(
  actor: TradeActor,
  id: string,
  input: { provider: string; reference: string },
) {
  return inTradeTransaction(async (client) => {
    const { contract, payment } = await lockPayment(client, actor, id, 'buyer');
    requireAgreed(contract);
    await assertNoActivePaymentIssue(client, payment.id);
    if (contract.payment_plan !== 'bank_secured')
      throw new ConflictError('Bank security cannot be submitted for this plan');
    const same =
      payment.security_provider === input.provider &&
      payment.security_reference === input.reference;
    if (['submitted', 'verified'].includes(payment.security_status) && same) return payment;
    if (!['awaiting_submission', 'rejected'].includes(payment.security_status))
      throw new ConflictError('Submitted or accepted security cannot be overwritten');
    const updated = (
      await client.query(
        `UPDATE payment_requests SET security_status='submitted',security_provider=$1,security_reference=$2,
      security_submitted_at=NOW(),updated_at=NOW() WHERE id=$3 RETURNING *`,
        [input.provider, input.reference, id],
      )
    ).rows[0];
    await recordTradeAudit(client, actor, 'payment.security.submit', 'payment_request', id, input);
    return updated;
  });
}

export async function confirmSecurity(actor: TradeActor, id: string) {
  return inTradeTransaction(async (client) => {
    const { contract, payment } = await lockPayment(client, actor, id, 'seller');
    requireAgreed(contract);
    await assertNoActivePaymentIssue(client, payment.id);
    if (contract.payment_plan !== 'bank_secured')
      throw new ConflictError('Bank security cannot be accepted for this plan');
    if (payment.security_status === 'verified') return payment;
    if (payment.security_status !== 'submitted')
      throw new ConflictError('No submitted bank security is awaiting acceptance');
    const updated = (
      await client.query(
        `UPDATE payment_requests SET security_status='verified',security_verified_at=NOW(),
      security_verified_by_user_id=$1,release_status='authorized',status='security_verified',updated_at=NOW() WHERE id=$2 RETURNING *`,
        [actor.id, id],
      )
    ).rows[0];
    await recordTradeAudit(client, actor, 'payment.security.verify', 'payment_request', id, {
      provider: payment.security_provider,
      reference: payment.security_reference,
      verification: 'seller_external_check',
    });
    return updated;
  });
}
