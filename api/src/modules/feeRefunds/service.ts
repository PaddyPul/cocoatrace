import { decimalUnits } from '../../services/tradeMoney';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { JwtPayload } from '../../middleware/auth';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { assertMutationAssurance } from '../mfa/assurance';
import { assertPlatformFinance } from '../feeEnforcement/service';
import { textInput } from '../fees/policy';
type Row = Record<string, unknown>;
const isFinance = (actor: JwtPayload) =>
  actor.permissions.some((p) => p === '*' || p === 'finance.manage');
export function feeRefundFingerprint(fee: Row): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        fee.id,
        fee.contract_id,
        String(fee.amount_total),
        fee.currency,
        fee.currency_minor_units,
        fee.rate_bps,
        fee.payer_organization_id,
        fee.policy_version,
        fee.status,
        fee.platform_receipt_reference,
        fee.paid_at,
        fee.verified_by_user_id,
      ]),
    )
    .digest('hex');
}
async function feeRow(
  client: PoolClient,
  actor: JwtPayload,
  contractId: string,
  lock = false,
): Promise<Row> {
  const contract = (
    await client.query(
      `SELECT * FROM sales_contracts WHERE id=$1 AND ($3 OR $2 IN(seller_organization_id,buyer_organization_id)) ${lock ? 'FOR UPDATE' : ''}`,
      [contractId, actor.organizationId, isFinance(actor)],
    )
  ).rows[0];
  if (!contract) throw new NotFoundError('Platform fee refund');
  const fee = (
    await client.query(
      `SELECT f.*,EXISTS(SELECT 1 FROM platform_fee_submissions s WHERE s.fee_id=f.id AND s.status='verified') receipt_verified,
      (f.amount_total=round(c.quantity_kg*c.price_per_kg*f.rate_bps/10000::numeric,f.currency_minor_units) AND f.currency=c.currency AND f.currency_minor_units=c.currency_minor_units AND ((f.fee_payer='seller' AND f.payer_organization_id=c.seller_organization_id) OR (f.fee_payer='buyer' AND f.payer_organization_id=c.buyer_organization_id))) snapshot_valid
      FROM platform_fee_invoices f JOIN sales_contracts c ON c.id=f.contract_id WHERE f.contract_id=$1 ${lock ? 'FOR UPDATE OF f' : ''}`,
      [contractId],
    )
  ).rows[0];
  if (!fee) throw new NotFoundError('Platform fee refund');
  return { ...fee, contract_status: contract.status };
}
/** Contract lock serializes this precondition with dispatch, cancellation and goods writes. */
export async function feeRefundBlockedReason(
  client: PoolClient,
  fee: Row,
  lock = false,
): Promise<string | null> {
  if (lock) {
    await client.query(
      'SELECT id FROM payment_requests WHERE contract_id=$1 ORDER BY id FOR UPDATE',
      [fee.contract_id],
    );
    await client.query('SELECT id FROM shipments WHERE contract_id=$1 ORDER BY id FOR UPDATE', [
      fee.contract_id,
    ]);
  }
  if (
    fee.status !== 'paid' ||
    !fee.receipt_verified ||
    !fee.paid_at ||
    !fee.verified_by_user_id ||
    !fee.platform_receipt_reference ||
    !/[1-9]/.test(String(fee.amount_total))
  )
    return 'A verified full platform fee receipt is required.';
  if (fee.snapshot_valid === false)
    return 'The fee snapshot does not reconcile with its contract; investigate before refunding.';
  if (['settled', 'cancelled'].includes(String(fee.contract_status)))
    return 'This trade is already closed; use financial investigation.';
  const facts = (
    await client.query(
      `SELECT
    NOT EXISTS(SELECT 1 FROM payment_requests WHERE contract_id=$1) OR EXISTS(SELECT 1 FROM payment_requests p WHERE p.contract_id=$1 AND (p.amount_confirmed<>0 OR p.payment_reference_external IS NOT NULL OR p.status IN('payment_pending_verification','settled') OR p.security_status NOT IN('not_required','awaiting_submission') OR p.security_submitted_at IS NOT NULL OR p.security_reference IS NOT NULL OR EXISTS(SELECT 1 FROM payment_installments i WHERE i.payment_request_id=p.id AND (i.submitted_at IS NOT NULL OR i.verified_at IS NOT NULL OR i.payment_reference_external IS NOT NULL OR i.status IN('payment_submitted','paid'))))) goods,
    NOT EXISTS(SELECT 1 FROM shipments WHERE contract_id=$1) OR EXISTS(SELECT 1 FROM shipments s WHERE s.contract_id=$1 AND (s.current_milestone<>'planning' OR s.service_provider_name IS NOT NULL OR s.booking_reference IS NOT NULL OR s.transport_document_reference IS NOT NULL OR s.dispatch_exception OR EXISTS(SELECT 1 FROM shipment_milestones m WHERE m.shipment_id=s.id AND m.milestone<>'planning'))) transport,
    EXISTS(SELECT 1 FROM payment_issues i JOIN payment_requests p ON p.id=i.payment_request_id WHERE p.contract_id=$1 AND i.status<>'resolved') OR EXISTS(SELECT 1 FROM delivery_discrepancies WHERE contract_id=$1) OR EXISTS(SELECT 1 FROM delivery_acceptances WHERE contract_id=$1) OR EXISTS(SELECT 1 FROM custody_transfers t JOIN sales_contracts c ON c.holding_id=t.holding_id WHERE c.id=$1) issue`,
      [fee.contract_id],
    )
  ).rows[0];
  return facts.goods
    ? 'Goods payment or security activity requires financial investigation.'
    : facts.transport
      ? 'Transport has started or is unavailable; resolve it before refund recovery.'
      : facts.issue
        ? 'Delivery, custody or unresolved payment activity requires investigation.'
        : null;
}
async function current(client: PoolClient, feeId: unknown, lock = false): Promise<Row | undefined> {
  return (
    await client.query(
      `SELECT * FROM fee_refund_requests WHERE fee_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`,
      [feeId],
    )
  ).rows[0];
}
async function view(client: PoolClient, actor: JwtPayload, fee: Row) {
  const refund = await current(client, fee.id);
  const payer = fee.payer_organization_id === actor.organizationId;
  const finance = isFinance(actor) && !payer;
  const blockedReason = await feeRefundBlockedReason(client, fee);
  const history = refund
    ? (
        await client.query(
          'SELECT id,action,reason,created_at FROM fee_refund_events WHERE refund_id=$1 ORDER BY created_at,id',
          [refund.id],
        )
      ).rows
    : [];
  return {
    expectedFingerprint: feeRefundFingerprint(fee),
    eligible: blockedReason === null,
    blockedReason,
    canRequest: payer && !blockedReason && (!refund || refund.status === 'rejected'),
    canSend: finance && !blockedReason && refund?.status === 'requested',
    canReject: finance && refund?.status === 'requested',
    canConfirm: payer && !blockedReason && refund?.status === 'sent',
    refund: refund
      ? {
          id: refund.id,
          status: refund.status,
          reason: refund.reason,
          amount: String(refund.amount),
          currency: refund.currency,
          revision: refund.revision,
          ...(payer || finance ? { externalReference: refund.external_reference } : {}),
        }
      : null,
    history,
  };
}
export async function readFeeRefund(actor: JwtPayload, contractId: string) {
  return inDatabaseTransaction(async (client) =>
    view(client, actor, await feeRow(client, actor, contractId)),
  );
}
async function payerAuthority(client: PoolClient, actor: JwtPayload, fee: Row) {
  await assertMutationAssurance(client, actor);
  const result = await client.query(
    `SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id JOIN sessions s ON s.user_id=u.id AND s.id=$3 WHERE u.id=$1 AND u.organization_id=$2 AND u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND s.revoked_at IS NULL AND s.expires_at>NOW() AND ('*'=ANY(r.permissions) OR 'offer.respond'=ANY(r.permissions)) FOR SHARE OF u,o,ur,r,s`,
    [actor.id, actor.organizationId, actor.sessionId],
  );
  if (fee.payer_organization_id !== actor.organizationId || !result.rows.length)
    throw new ForbiddenError('Current fee payer authority required');
}
async function event(
  client: PoolClient,
  actor: JwtPayload,
  refund: Row,
  action: string,
  reason: string,
) {
  await client.query(
    'INSERT INTO fee_refund_events(refund_id,actor_user_id,actor_organization_id,action,reason) VALUES($1,$2,$3,$4,$5)',
    [refund.id, actor.id, actor.organizationId, action, reason],
  );
  await recordAudit(
    client,
    actor,
    `fee.refund.${action}`,
    'platform_fee_invoice',
    String(refund.fee_id),
    { refundId: refund.id, reason, amount: String(refund.amount), currency: refund.currency },
  );
}
export async function requestFeeRefund(
  actor: JwtPayload,
  contractId: string,
  input: { reason: string; idempotencyKey: string; expectedFingerprint: string },
) {
  const reason = textInput(input.reason, 10, 'Refund reason');
  return inDatabaseTransaction(async (client) => {
    const fee = await feeRow(client, actor, contractId, true);
    await payerAuthority(client, actor, fee);
    if (feeRefundFingerprint(fee) !== input.expectedFingerprint)
      throw new ConflictError('Fee receipt changed; review it again');
    const previous = await current(client, fee.id, true);
    if (previous && previous.idempotency_key === input.idempotencyKey) {
      if (previous.reason !== reason || previous.snapshot_fingerprint !== input.expectedFingerprint)
        throw new ConflictError('Refund request key has different terms');
      return view(client, actor, fee);
    }
    if (previous && previous.status !== 'rejected')
      throw new ConflictError('A refund already holds this fee');
    const blocked = await feeRefundBlockedReason(client, fee, true);
    if (blocked) throw new ConflictError(blocked);
    const refund = (
      await client.query(
        `INSERT INTO fee_refund_requests(fee_id,requested_by,payer_organization_id,idempotency_key,snapshot_fingerprint,reason,amount,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          fee.id,
          actor.id,
          actor.organizationId,
          input.idempotencyKey,
          input.expectedFingerprint,
          reason,
          fee.amount_total,
          fee.currency,
        ],
      )
    ).rows[0];
    await event(client, actor, refund, 'requested', reason);
    return view(client, actor, fee);
  });
}
type Decision = { refundId: string; expectedRevision: number; reason: string };
async function transition(
  actor: JwtPayload,
  contractId: string,
  input: Decision,
  action: 'sent' | 'confirmed' | 'rejected',
  payment?: { amount: string; currency: string; reference: string },
) {
  const reason = textInput(input.reason, 10, 'Refund decision reason');
  return inDatabaseTransaction(async (client) => {
    const fee = await feeRow(client, actor, contractId, true);
    if (action === 'confirmed') await payerAuthority(client, actor, fee);
    else {
      await assertPlatformFinance(client, actor);
      if (fee.payer_organization_id === actor.organizationId)
        throw new ForbiddenError('Independent platform finance required');
    }
    const refund = await current(client, fee.id, true);
    if (!refund || refund.id !== input.refundId) throw new NotFoundError('Refund request');
    if (refund.status === action) {
      if (action === 'sent' && refund.external_reference !== payment?.reference)
        throw new ConflictError('Recorded refund differs');
      return view(client, actor, fee);
    }
    if (
      Number(refund.revision) !== input.expectedRevision ||
      refund.status !== (action === 'confirmed' ? 'sent' : 'requested')
    )
      throw new ConflictError('Refund changed; review the current record');
    if (action !== 'rejected') {
      const blocked = await feeRefundBlockedReason(client, fee, true);
      if (blocked) throw new ConflictError(blocked);
      if (feeRefundFingerprint(fee) !== refund.snapshot_fingerprint)
        throw new ConflictError('Original fee receipt changed');
    }
    if (action === 'sent') {
      if (
        !payment ||
        decimalUnits(payment.amount, Number(fee.currency_minor_units)) !==
          decimalUnits(String(refund.amount), Number(fee.currency_minor_units)) ||
        payment.currency !== refund.currency
      )
        throw new ValidationError('Record the full exact fee amount and currency');
      const reference = textInput(payment.reference, 3, 'External refund reference');
      const duplicate = await client.query(
        'SELECT id FROM fee_refund_requests WHERE lower(trim(external_reference))=lower(trim($1))',
        [reference],
      );
      if (duplicate.rows.length)
        throw new ConflictError('External refund reference already recorded');
      await client.query(
        "UPDATE fee_refund_requests SET status='sent',revision=revision+1,external_reference=$2,sent_by=$3,sent_at=NOW() WHERE id=$1",
        [refund.id, reference, actor.id],
      );
    } else if (action === 'confirmed')
      await client.query(
        "UPDATE fee_refund_requests SET status='confirmed',revision=revision+1,confirmed_by=$2,confirmed_at=NOW() WHERE id=$1",
        [refund.id, actor.id],
      );
    else
      await client.query(
        "UPDATE fee_refund_requests SET status='rejected',revision=revision+1,rejected_by=$2,rejected_at=NOW() WHERE id=$1",
        [refund.id, actor.id],
      );
    await event(client, actor, refund, action, reason);
    return view(client, actor, fee);
  });
}
export const sendFeeRefund = (
  actor: JwtPayload,
  id: string,
  input: Decision & { amount: string; currency: string; reference: string },
) => transition(actor, id, input, 'sent', input);
export const confirmFeeRefund = (actor: JwtPayload, id: string, input: Decision) =>
  transition(actor, id, input, 'confirmed');
export const rejectFeeRefund = (actor: JwtPayload, id: string, input: Decision) =>
  transition(actor, id, input, 'rejected');

/** Full confirmed refund may resolve only the fee part of bilateral cancellation. */
export async function hasConfirmedFeeRefund(
  client: PoolClient,
  contractId: string,
): Promise<boolean> {
  const fee = (
    await client.query(
      `SELECT f.* FROM platform_fee_invoices f JOIN sales_contracts c ON c.id=f.contract_id WHERE f.contract_id=$1 AND f.amount_total=round(c.quantity_kg*c.price_per_kg*f.rate_bps/10000::numeric,f.currency_minor_units) AND f.currency=c.currency AND f.currency_minor_units=c.currency_minor_units AND ((f.fee_payer='seller' AND f.payer_organization_id=c.seller_organization_id) OR (f.fee_payer='buyer' AND f.payer_organization_id=c.buyer_organization_id)) AND f.status='paid' AND f.paid_at IS NOT NULL AND f.verified_by_user_id IS NOT NULL AND f.platform_receipt_reference IS NOT NULL AND EXISTS(SELECT 1 FROM platform_fee_submissions s WHERE s.fee_id=f.id AND s.status='verified')`,
      [contractId],
    )
  ).rows[0];
  if (!fee) return false;
  const refund = (
    await client.query(
      `SELECT * FROM fee_refund_requests WHERE fee_id=$1 AND status='confirmed' AND sent_by IS NOT NULL AND sent_at IS NOT NULL AND external_reference IS NOT NULL AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL AND EXISTS(SELECT 1 FROM fee_refund_events e WHERE e.refund_id=fee_refund_requests.id AND e.action='confirmed')`,
      [fee.id],
    )
  ).rows[0];
  return Boolean(
    refund &&
      refund.snapshot_fingerprint === feeRefundFingerprint(fee) &&
      refund.payer_organization_id === fee.payer_organization_id &&
      refund.currency === fee.currency &&
      decimalUnits(String(refund.amount), Number(fee.currency_minor_units)) ===
        decimalUnits(String(fee.amount_total), Number(fee.currency_minor_units)),
  );
}
