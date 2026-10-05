import type { PoolClient } from 'pg';
import { ConflictError, NotFoundError, ForbiddenError, ValidationError } from '../../errors';
import { inTradeTransaction, recordTradeAudit, type TradeActor } from '../trading/transaction';
import { lockRecallBoundary, assertBatchNotRecalled } from '../recall/safety';

interface Contract {
  id: string;
  status: string;
  holding_id: string;
  seller_organization_id: string;
  buyer_organization_id: string;
}
interface CancellationRequest {
  id: string;
  contract_id: string;
  requested_by_organization_id: string;
  status: 'requested' | 'approved' | 'rejected';
  reason: string;
}
export interface CancellationFacts {
  status: string;
  paymentActivity: boolean;
  securityActivity: boolean;
  transportActivity: boolean;
  issueActivity: boolean;
  feeActivity: boolean;
  inventorySafe: boolean;
}
export function cancellationBlock(facts: CancellationFacts): string | null {
  if (['cancelled', 'settled'].includes(facts.status)) return 'This trade is already closed.';
  if (facts.paymentActivity)
    return 'Payment activity exists. A refund or financial resolution is required before cancellation.';
  if (facts.securityActivity)
    return 'External payment security has been submitted. Resolve it with the parties and provider first.';
  if (facts.transportActivity)
    return 'Transport has progressed. This trade requires a delivery or return resolution.';
  if (facts.issueActivity) return 'Resolve the active payment or delivery issue first.';
  if (facts.feeActivity)
    return 'An issued or paid platform fee requires financial resolution first.';
  if (!facts.inventorySafe)
    return 'Inventory has changed or has competing reservations. Cancellation cannot release it safely.';
  return null;
}
async function contract(
  client: PoolClient,
  actor: TradeActor,
  id: string,
  lock = false,
): Promise<Contract> {
  const row = (
    await client.query<Contract>(
      `SELECT id,status,holding_id,seller_organization_id,buyer_organization_id FROM sales_contracts WHERE id=$1 AND $2 IN(seller_organization_id,buyer_organization_id) ${lock ? 'FOR UPDATE' : ''}`,
      [id, actor.organizationId],
    )
  ).rows[0];
  if (!row) throw new NotFoundError('Contract');
  return row;
}
async function facts(client: PoolClient, c: Contract): Promise<CancellationFacts> {
  const row = (
    await client.query<Omit<CancellationFacts, 'status'>>(
      `SELECT
    EXISTS(SELECT 1 FROM payment_requests p WHERE p.contract_id=$1 AND (p.amount_confirmed<>0 OR p.payment_reference_external IS NOT NULL OR p.status IN('payment_pending_verification','settled') OR EXISTS(SELECT 1 FROM payment_installments i WHERE i.payment_request_id=p.id AND (i.submitted_at IS NOT NULL OR i.verified_at IS NOT NULL OR i.payment_reference_external IS NOT NULL OR i.status IN('payment_submitted','paid'))))) AS "paymentActivity",
    EXISTS(SELECT 1 FROM payment_requests p WHERE p.contract_id=$1 AND (p.security_status NOT IN('not_required','awaiting_submission') OR p.security_submitted_at IS NOT NULL OR p.security_reference IS NOT NULL)) AS "securityActivity",
    NOT EXISTS(SELECT 1 FROM shipments s WHERE s.contract_id=$1) OR EXISTS(SELECT 1 FROM shipments s WHERE s.contract_id=$1 AND (s.current_milestone<>'planning' OR s.service_provider_name IS NOT NULL OR s.booking_reference IS NOT NULL OR s.transport_document_reference IS NOT NULL OR s.dispatch_exception OR EXISTS(SELECT 1 FROM shipment_milestones m WHERE m.shipment_id=s.id AND m.milestone<>'planning'))) AS "transportActivity",
    EXISTS(SELECT 1 FROM payment_issues i JOIN payment_requests p ON p.id=i.payment_request_id WHERE p.contract_id=$1 AND i.status<>'resolved') OR EXISTS(SELECT 1 FROM delivery_discrepancies d WHERE d.contract_id=$1 AND d.status<>'resolved') OR EXISTS(SELECT 1 FROM delivery_acceptances a WHERE a.contract_id=$1) AS "issueActivity",
    EXISTS(SELECT 1 FROM platform_fee_invoices f WHERE f.contract_id=$1 AND f.status<>'estimated') AS "feeActivity",
    EXISTS(SELECT 1 FROM batch_holdings h JOIN sales_contracts c ON c.holding_id=h.id WHERE c.id=$1 AND h.status='committed' AND h.holder_organization_id=c.seller_organization_id AND h.quantity_kg=c.quantity_kg
      AND NOT EXISTS(SELECT 1 FROM listings l WHERE l.holding_id=h.id AND l.active)
      AND NOT EXISTS(SELECT 1 FROM custody_transfers t WHERE t.holding_id=h.id AND t.status='requested')
      AND NOT EXISTS(SELECT 1 FROM sales_contracts other WHERE other.holding_id=h.id AND other.id<>c.id AND other.status NOT IN('cancelled','settled')))
      AND EXISTS(SELECT 1 FROM payment_requests p WHERE p.contract_id=$1) AND EXISTS(SELECT 1 FROM platform_fee_invoices f WHERE f.contract_id=$1) AS "inventorySafe"`,
      [c.id],
    )
  ).rows[0];
  return { status: c.status, ...row };
}
async function history(client: PoolClient, id: string) {
  return (
    await client.query<CancellationRequest>(
      'SELECT * FROM contract_cancellation_requests WHERE contract_id=$1 ORDER BY created_at DESC,id DESC',
      [id],
    )
  ).rows;
}
export async function getCancellation(actor: TradeActor, id: string) {
  return inTradeTransaction(async (client) => {
    const c = await contract(client, actor, id);
    return {
      contractStatus: c.status,
      blockedReason: cancellationBlock(await facts(client, c)),
      requests: await history(client, id),
    };
  });
}
export async function requestCancellation(actor: TradeActor, id: string, reason: string) {
  const trimmed = reason.trim();
  if ([...trimmed].length < 10 || trimmed.length > 2000)
    throw new ValidationError('Explain the cancellation in 10–2000 characters');
  return inTradeTransaction(async (client) => {
    const c = await contract(client, actor, id, true);
    const pending = (await history(client, id)).find((row) => row.status === 'requested');
    if (pending) {
      if (
        pending.requested_by_organization_id === actor.organizationId &&
        pending.reason === trimmed
      )
        return pending;
      throw new ConflictError('A cancellation request already awaits the other party’s decision');
    }
    const blocked = cancellationBlock(await facts(client, c));
    if (blocked) throw new ConflictError(blocked);
    const row = (
      await client.query<CancellationRequest>(
        `INSERT INTO contract_cancellation_requests(contract_id,requested_by_user_id,requested_by_organization_id,reason) VALUES($1,$2,$3,$4) RETURNING *`,
        [id, actor.id, actor.organizationId, trimmed],
      )
    ).rows[0];
    await recordTradeAudit(client, actor, 'contract.cancellation.request', 'sales_contract', id, {
      requestId: row.id,
      reason: trimmed,
    });
    return row;
  });
}
export async function reviewCancellation(
  actor: TradeActor,
  id: string,
  requestId: string,
  approve: boolean,
) {
  return inTradeTransaction(async (client) => {
    await lockRecallBoundary(client);
    const c = await contract(client, actor, id, true);
    const row = (
      await client.query<CancellationRequest>(
        'SELECT * FROM contract_cancellation_requests WHERE id=$1 AND contract_id=$2 FOR UPDATE',
        [requestId, id],
      )
    ).rows[0];
    if (!row) throw new NotFoundError('Cancellation request');
    if (row.requested_by_organization_id === actor.organizationId)
      throw new ForbiddenError('The other organization must review this cancellation');
    const desired = approve ? 'approved' : 'rejected';
    if (row.status === desired) return row;
    if (row.status !== 'requested')
      throw new ConflictError('This cancellation request has already been reviewed');
    if (approve) {
      await client.query('SELECT id FROM payment_requests WHERE contract_id=$1 FOR UPDATE', [id]);
      await client.query('SELECT id FROM shipments WHERE contract_id=$1 ORDER BY id FOR UPDATE', [
        id,
      ]);
      const holding = (
        await client.query<{ batch_id: string }>(
          'SELECT batch_id FROM batch_holdings WHERE id=$1 FOR UPDATE',
          [c.holding_id],
        )
      ).rows[0];
      const blocked = cancellationBlock(await facts(client, c));
      if (blocked) throw new ConflictError(blocked);
      await assertBatchNotRecalled(client, holding.batch_id);
      await client.query("UPDATE sales_contracts SET status='cancelled' WHERE id=$1", [id]);
      await client.query("UPDATE batch_holdings SET status='available' WHERE id=$1", [
        c.holding_id,
      ]);
      await client.query(
        "UPDATE payment_requests SET status='cancelled',release_status='locked',updated_at=NOW() WHERE contract_id=$1",
        [id],
      );
      await client.query(
        "UPDATE payment_installments SET status='cancelled',updated_at=NOW() WHERE payment_request_id IN(SELECT id FROM payment_requests WHERE contract_id=$1)",
        [id],
      );
      await client.query(
        "UPDATE platform_fee_invoices SET status='void' WHERE contract_id=$1 AND status='estimated'",
        [id],
      );
    }
    const reviewed = (
      await client.query<CancellationRequest>(
        `UPDATE contract_cancellation_requests SET status=$1,reviewed_by_user_id=$2,reviewed_by_organization_id=$3,reviewed_at=NOW() WHERE id=$4 RETURNING *`,
        [desired, actor.id, actor.organizationId, requestId],
      )
    ).rows[0];
    await recordTradeAudit(
      client,
      actor,
      `contract.cancellation.${desired}`,
      'sales_contract',
      id,
      { requestId, inventoryReleased: approve, holdingId: c.holding_id },
    );
    return reviewed;
  });
}
