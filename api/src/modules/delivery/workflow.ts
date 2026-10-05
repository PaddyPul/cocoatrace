import type { PoolClient } from 'pg';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { inTradeTransaction, recordTradeAudit, TradeActor } from '../trading/transaction';
import { completeTradeIfReady } from '../../services/tradeSettlement';
import { lockRecallBoundary, assertBatchNotRecalled } from '../recall/safety';
import { evidenceStorage } from '../../services/evidenceStorage';

interface DeliveryContractRow {
  id: string;
  quantity_kg: string;
  status: string;
  holding_id: string;
  buyer_organization_id: string;
  seller_organization_id: string;
}

interface DeliveryContract extends DeliveryContractRow {
  current_milestone: string | null | undefined;
}

interface DeliveryAcceptanceRow {
  contract_id: string;
  received_quantity_kg: string;
  accepted_by_user_id: string;
  accepted_by_organization_id: string;
  note: string;
  accepted_at: Date;
}

interface DeliveryDiscrepancyRow {
  id: string;
  contract_id: string;
  kind: 'shortage' | 'damage' | 'rejection';
  received_quantity_kg: string;
  reason: string;
  evidence_ids: string[];
  status: 'open' | 'resolution_proposed' | 'resolved';
  reported_by_user_id: string;
  reported_by_organization_id: string;
  resolution_note: string | null;
  resolution_proposed_by_organization_id: string | null;
  resolution_proposed_by_user_id: string | null;
  resolved_by_user_id: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface DeliveryDetails {
  contract: Pick<
    DeliveryContract,
    | 'id'
    | 'quantity_kg'
    | 'status'
    | 'buyer_organization_id'
    | 'seller_organization_id'
    | 'current_milestone'
  >;
  acceptance: DeliveryAcceptanceRow | null;
  discrepancy: DeliveryDiscrepancyRow | null;
  history: DeliveryDiscrepancyRow[];
}

async function lockContract(
  client: PoolClient,
  actor: TradeActor,
  id: string,
  party?: 'buyer' | 'seller',
): Promise<DeliveryContract> {
  const contract = (
    await client.query<DeliveryContractRow>(
      `SELECT c.* FROM sales_contracts c WHERE c.id=$1
    AND $2 IN(c.buyer_organization_id,c.seller_organization_id) FOR UPDATE`,
      [id, actor.organizationId],
    )
  ).rows[0];
  if (!contract) throw new NotFoundError('Contract');
  if (party && contract[`${party}_organization_id`] !== actor.organizationId)
    throw new NotFoundError('Contract');
  const shipment = (
    await client.query<{ current_milestone: string | null }>(
      'SELECT current_milestone FROM shipments WHERE contract_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',
      [id],
    )
  ).rows[0];
  return { ...contract, current_milestone: shipment?.current_milestone };
}
async function details(client: PoolClient, contract: DeliveryContract): Promise<DeliveryDetails> {
  const acceptance =
    (
      await client.query<DeliveryAcceptanceRow>(
        'SELECT * FROM delivery_acceptances WHERE contract_id=$1',
        [contract.id],
      )
    ).rows[0] || null;
  const history = (
    await client.query<DeliveryDiscrepancyRow>(
      'SELECT * FROM delivery_discrepancies WHERE contract_id=$1 ORDER BY created_at DESC,id DESC',
      [contract.id],
    )
  ).rows;
  return {
    contract: {
      id: contract.id,
      quantity_kg: contract.quantity_kg,
      status: contract.status,
      buyer_organization_id: contract.buyer_organization_id,
      seller_organization_id: contract.seller_organization_id,
      current_milestone: contract.current_milestone,
    },
    acceptance,
    discrepancy: history.find((item) => item.status !== 'resolved') || history[0] || null,
    history,
  };
}
function requireDelivered(contract: DeliveryContract) {
  if (contract.status === 'cancelled' || contract.status === 'settled')
    throw new ConflictError('Closed trades cannot change delivery acceptance');
  if (contract.current_milestone !== 'delivered')
    throw new ConflictError('Record physical delivery before reviewing the goods');
}
async function requireNoAcceptance(client: PoolClient, id: string) {
  if (
    (
      await client.query<Pick<DeliveryAcceptanceRow, 'contract_id'>>(
        'SELECT contract_id FROM delivery_acceptances WHERE contract_id=$1',
        [id],
      )
    ).rows[0]
  )
    throw new ConflictError('Delivery has already been accepted');
}
export async function getDelivery(actor: TradeActor, id: string) {
  return inTradeTransaction(async (client) =>
    details(client, await lockContract(client, actor, id)),
  );
}
export async function acceptDelivery(
  actor: TradeActor,
  id: string,
  input: { receivedQuantityKg: number; note: string },
) {
  return inTradeTransaction(async (client) => {
    await lockRecallBoundary(client);
    const contract = await lockContract(client, actor, id, 'buyer');
    const previous = (
      await client.query<DeliveryAcceptanceRow>(
        'SELECT * FROM delivery_acceptances WHERE contract_id=$1',
        [id],
      )
    ).rows[0];
    if (previous) {
      if (
        Number(previous.received_quantity_kg) !== input.receivedQuantityKg ||
        previous.note !== input.note
      )
        throw new ConflictError('Acceptance is immutable; it cannot be overwritten');
      return details(client, contract);
    }
    requireDelivered(contract);
    const holding = (
      await client.query<{ batch_id: string }>('SELECT batch_id FROM batch_holdings WHERE id=$1', [
        contract.holding_id,
      ])
    ).rows[0];
    if (holding) await assertBatchNotRecalled(client, holding.batch_id);
    const quantity = (
      await client.query<{ matches: boolean }>('SELECT $1::numeric=$2::numeric AS matches', [
        input.receivedQuantityKg,
        contract.quantity_kg,
      ])
    ).rows[0];
    if (!quantity.matches)
      throw new ValidationError(
        'Full contracted quantity is required for acceptance. Report a discrepancy for shortages or rejected goods.',
      );
    if (
      (
        await client.query<Pick<DeliveryDiscrepancyRow, 'id'>>(
          "SELECT id FROM delivery_discrepancies WHERE contract_id=$1 AND status<>'resolved'",
          [id],
        )
      ).rows[0]
    )
      throw new ConflictError('Resolve the delivery discrepancy before accepting goods');
    await client.query(
      `INSERT INTO delivery_acceptances(contract_id,received_quantity_kg,accepted_by_user_id,accepted_by_organization_id,note)
      VALUES($1,$2,$3,$4,$5)`,
      [id, input.receivedQuantityKg, actor.id, actor.organizationId, input.note],
    );
    await recordTradeAudit(client, actor, 'delivery.accept', 'sales_contract', id, {
      receivedQuantityKg: input.receivedQuantityKg,
      note: input.note,
    });
    await completeTradeIfReady(client, id, actor);
    const refreshed = await lockContract(client, actor, id);
    return details(client, refreshed);
  });
}
export async function reportDiscrepancy(
  actor: TradeActor,
  id: string,
  input: { kind: string; receivedQuantityKg: number; reason: string; evidenceIds: string[] },
) {
  return inTradeTransaction(async (client) => {
    const contract = await lockContract(client, actor, id, 'buyer');
    requireDelivered(contract);
    await requireNoAcceptance(client, id);
    if (input.receivedQuantityKg > Number(contract.quantity_kg))
      throw new ValidationError('Received quantity cannot exceed the contract');
    if (input.kind === 'shortage' && input.receivedQuantityKg >= Number(contract.quantity_kg))
      throw new ValidationError('A shortage must be less than the contracted quantity');
    const active = (
      await client.query<DeliveryDiscrepancyRow>(
        "SELECT * FROM delivery_discrepancies WHERE contract_id=$1 AND status<>'resolved'",
        [id],
      )
    ).rows[0];
    const ids = [...new Set(input.evidenceIds)].sort();
    if (active) {
      if (
        active.kind === input.kind &&
        Number(active.received_quantity_kg) === input.receivedQuantityKg &&
        active.reason === input.reason &&
        JSON.stringify([...active.evidence_ids].sort()) === JSON.stringify(ids)
      )
        return details(client, contract);
      throw new ConflictError('Resolve the existing discrepancy first');
    }
    const proofs = (
      await client.query<{ id: string; storage_key: string }>(
        `SELECT id,storage_key FROM evidence_items WHERE id=ANY($1::uuid[])
      AND linked_entity_type='contract' AND linked_entity_id=$2 AND uploader_organization_id=$3
      AND validation_status='validated' AND malware_scan_status='clean' AND review_status<>'rejected'
      AND type IN('delivery_proof','delivery_receipt','inspection_certificate','other') AND storage_key IS NOT NULL FOR SHARE`,
        [ids, id, actor.organizationId],
      )
    ).rows;
    if (proofs.length !== ids.length)
      throw new ValidationError('Attach your validated, scan-clean evidence for this contract');
    for (const proof of proofs)
      if (!(await evidenceStorage().get(proof.storage_key))?.length)
        throw new ValidationError('Supporting evidence bytes are unavailable');
    const issue = (
      await client.query<DeliveryDiscrepancyRow>(
        `INSERT INTO delivery_discrepancies(contract_id,kind,received_quantity_kg,reason,evidence_ids,reported_by_user_id,reported_by_organization_id)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          id,
          input.kind,
          input.receivedQuantityKg,
          input.reason,
          ids,
          actor.id,
          actor.organizationId,
        ],
      )
    ).rows[0];
    await recordTradeAudit(client, actor, 'delivery.discrepancy.report', 'sales_contract', id, {
      discrepancyId: issue.id,
      kind: input.kind,
      receivedQuantityKg: input.receivedQuantityKg,
      reason: input.reason,
      evidenceIds: ids,
    });
    return details(client, contract);
  });
}
export async function proposeResolution(actor: TradeActor, id: string, note: string) {
  return inTradeTransaction(async (client) => {
    const contract = await lockContract(client, actor, id, 'seller');
    requireDelivered(contract);
    const issue = (
      await client.query<DeliveryDiscrepancyRow>(
        'SELECT * FROM delivery_discrepancies WHERE contract_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (!issue) throw new NotFoundError('Delivery discrepancy');
    if (issue.status !== 'open') {
      if (issue.resolution_note === note) return details(client, contract);
      throw new ConflictError('The resolution proposal is already recorded');
    }
    await client.query(
      `UPDATE delivery_discrepancies SET status='resolution_proposed',resolution_note=$1,
      resolution_proposed_by_user_id=$2,resolution_proposed_by_organization_id=$3,updated_at=NOW() WHERE id=$4`,
      [note, actor.id, actor.organizationId, issue.id],
    );
    await recordTradeAudit(client, actor, 'delivery.resolution.propose', 'sales_contract', id, {
      discrepancyId: issue.id,
      note,
    });
    return details(client, contract);
  });
}
export async function approveResolution(actor: TradeActor, id: string) {
  return inTradeTransaction(async (client) => {
    const contract = await lockContract(client, actor, id, 'buyer');
    requireDelivered(contract);
    const issue = (
      await client.query<DeliveryDiscrepancyRow>(
        'SELECT * FROM delivery_discrepancies WHERE contract_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (!issue) throw new NotFoundError('Delivery discrepancy');
    if (issue.status === 'resolved') return details(client, contract);
    if (
      issue.status !== 'resolution_proposed' ||
      issue.resolution_proposed_by_organization_id !== contract.seller_organization_id
    )
      throw new ConflictError('The supplier must propose a resolution first');
    await client.query(
      "UPDATE delivery_discrepancies SET status='resolved',resolved_by_user_id=$1,resolved_at=NOW(),updated_at=NOW() WHERE id=$2",
      [actor.id, issue.id],
    );
    await recordTradeAudit(client, actor, 'delivery.resolution.approve', 'sales_contract', id, {
      discrepancyId: issue.id,
      note: issue.resolution_note,
    });
    // Resolution does not accept goods or rewrite financial/stock quantities.
    return details(client, contract);
  });
}
