import { AppError } from '../../errors';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit as recordTradeAudit, type AuditActor } from '../../services/auditWriter';
import { lockRecallBoundary, assertBatchNotRecalled } from '../recall/safety';
import {
  lockHoldingListings,
  pendingTransferQuantity,
  reconcileHoldingListings,
} from '../../services/inventoryIntegrity';
import * as repository from './repository';
import type {
  HoldingRow,
  CreateHoldingInput,
  TransferHoldingInput,
  SplitHoldingInput,
} from './types';

export class HoldingWorkflowError extends AppError {
  constructor(
    status: number,
    public readonly response: { error: string; code?: string },
  ) {
    super(response.error, status, response.code);
  }
}

export async function createHolding(actor: AuditActor, payload: CreateHoldingInput) {
  const { batchId, quantityKg, warehouseLocation } = payload;
  return inDatabaseTransaction(async (client) => {
    await lockRecallBoundary(client);
    const batch = (await repository.lockOwnedBatch(client, [batchId, actor.organizationId]))
      .rows[0];
    if (!batch) {
      throw new HoldingWorkflowError(400, {
        error: 'Batch not found or not held by your organization',
      });
    }
    await assertBatchNotRecalled(client, batchId);
    const allocated = (await repository.allocatedBatchQuantity(client, [batchId])).rows[0];
    const remainingGrams =
      Math.round(Number(batch.quantity_kg) * 1000) - Math.round(Number(allocated.quantity) * 1000);
    const remaining = remainingGrams / 1000;
    if (Math.round(quantityKg * 1000) > remainingGrams) {
      throw new HoldingWorkflowError(409, {
        error: `Only ${Math.max(0, remaining)} kg remains unallocated`,
        code: 'INSUFFICIENT_INVENTORY',
      });
    }
    const { rows } = await repository.insertHolding(client, [
      batchId,
      actor.organizationId,
      quantityKg,
      warehouseLocation || null,
    ]);
    await recordTradeAudit(client, actor, 'holding.create', 'batch_holding', rows[0].id);
    return rows[0];
  });
}

export async function transferHolding(
  actor: AuditActor,
  id: string,
  payload: TransferHoldingInput,
) {
  const { toOrganizationId, quantityKg, reason } = payload;
  if (toOrganizationId === actor.organizationId) {
    throw new HoldingWorkflowError(400, { error: 'Choose a different destination organization' });
  }
  return inDatabaseTransaction(async (client) => {
    await lockRecallBoundary(client);
    const holding = (await repository.lockOwnedHolding(client, [id, actor.organizationId])).rows[0];
    if (!holding) {
      throw new HoldingWorkflowError(404, { error: 'Holding not found' });
    }
    await assertBatchNotRecalled(client, holding.batch_id);
    if (holding.status !== 'available') {
      throw new HoldingWorkflowError(409, {
        error: 'Committed stock cannot be transferred',
        code: 'INVENTORY_UNAVAILABLE',
      });
    }
    const destination = await repository.findDestination(client, [toOrganizationId]);
    if (!destination.rows[0]) {
      throw new HoldingWorkflowError(400, { error: 'Destination organization not found' });
    }
    await lockHoldingListings(client, id);
    const reserved = await pendingTransferQuantity(client, id);
    const freeGrams = Math.round(Number(holding.quantity_kg) * 1000) - Math.round(reserved * 1000);
    if (Math.round(quantityKg * 1000) > freeGrams) {
      throw new HoldingWorkflowError(409, {
        error: 'Requested quantity exceeds free stock',
        code: 'INSUFFICIENT_INVENTORY',
      });
    }
    const { rows } = await repository.insertTransfer(client, [
      id,
      actor.organizationId,
      toOrganizationId,
      quantityKg,
    ]);
    await reconcileHoldingListings(client, id, (freeGrams - Math.round(quantityKg * 1000)) / 1000);
    await recordTradeAudit(
      client,
      actor,
      'custody.transfer.request',
      'custody_transfer',
      rows[0].id,
      { reason },
    );
    return rows[0];
  });
}

export async function acceptTransfer(actor: AuditActor, id: string) {
  return inDatabaseTransaction(async (client) => {
    await lockRecallBoundary(client);
    const discovered = (
      await repository.discoverIncomingTransfer(client, [id, actor.organizationId])
    ).rows[0];
    if (!discovered) {
      throw new HoldingWorkflowError(404, { error: 'Transfer not found' });
    }
    const src = (await repository.lockSourceHolding(client, [discovered.holding_id])).rows[0];
    await lockHoldingListings(client, discovered.holding_id);
    const transfer = (await repository.lockIncomingTransfer(client, [id, actor.organizationId]))
      .rows[0];
    if (!transfer || transfer.status !== 'requested') {
      throw new HoldingWorkflowError(409, {
        error: 'Transfer already decided',
        code: 'TRANSFER_NOT_PENDING',
      });
    }
    await assertBatchNotRecalled(client, src.batch_id);
    const qty = Number(transfer.quantity_kg);
    const reserved = await pendingTransferQuantity(client, src.id, id);
    const freeGrams = Math.round(Number(src.quantity_kg) * 1000) - Math.round(reserved * 1000);
    if (
      src.status !== 'available' ||
      src.holder_organization_id !== transfer.from_organization_id ||
      transfer.to_organization_id === transfer.from_organization_id ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      Math.round(qty * 1000) > freeGrams
    ) {
      throw new HoldingWorkflowError(409, {
        error: 'Transfer source no longer has available stock',
        code: 'INSUFFICIENT_INVENTORY',
      });
    }
    const newHolding = await repository.insertHolding(client, [
      src.batch_id,
      actor.organizationId,
      qty,
      null,
    ]);
    const remainder = (Math.round(Number(src.quantity_kg) * 1000) - Math.round(qty * 1000)) / 1000;
    await repository.updateSourceQuantity(client, [
      remainder === 0 ? Number(src.quantity_kg) : remainder,
      remainder === 0 ? 'transferred' : 'available',
      src.id,
    ]);
    const updated = await repository.acceptRequestedTransfer(client, [id]);
    await reconcileHoldingListings(
      client,
      src.id,
      (Math.round(remainder * 1000) - Math.round(reserved * 1000)) / 1000,
    );
    await recordTradeAudit(client, actor, 'custody.transfer.accept', 'custody_transfer', id);
    return { transfer: updated.rows[0], newHolding: newHolding.rows[0] };
  });
}

export async function splitHolding(actor: AuditActor, id: string, payload: SplitHoldingInput) {
  const { quantities } = payload;
  if (
    !Array.isArray(quantities) ||
    quantities.length < 2 ||
    quantities.some((qty: unknown) => typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0)
  ) {
    throw new HoldingWorkflowError(400, { error: 'Provide at least two positive quantities' });
  }
  return inDatabaseTransaction(async (client) => {
    await lockRecallBoundary(client);
    const holding = (await repository.lockOwnedHolding(client, [id, actor.organizationId])).rows[0];
    if (!holding) {
      throw new HoldingWorkflowError(404, { error: 'Holding not found' });
    }
    await assertBatchNotRecalled(client, holding.batch_id);
    if (holding.status !== 'available' || (await pendingTransferQuantity(client, id)) > 0) {
      throw new HoldingWorkflowError(409, {
        error: 'Committed or transfer-reserved stock cannot be split',
        code: 'INVENTORY_UNAVAILABLE',
      });
    }
    const total = quantities.reduce((sum: number, qty: number) => sum + qty, 0);
    // Store grams exactly as NUMERIC(12,3), and require exact conservation at that precision.
    const grams = quantities.map((qty: number) => Math.round(qty * 1000));
    if (
      Math.abs(total - Number(holding.quantity_kg)) > 0.000001 ||
      grams.reduce((sum: number, qty: number) => sum + qty, 0) !==
        Math.round(Number(holding.quantity_kg) * 1000) ||
      grams.some((qty: number) => qty <= 0)
    ) {
      throw new HoldingWorkflowError(400, {
        error: 'Split quantities must conserve the full holding quantity to three decimal places',
      });
    }
    await lockHoldingListings(client, id);
    await repository.markHoldingTransferred(client, [id]);
    await reconcileHoldingListings(client, id, 0);
    const newHoldings: HoldingRow[] = [];
    for (const qty of grams) {
      const result = await repository.insertHolding(client, [
        holding.batch_id,
        actor.organizationId,
        qty / 1000,
        holding.warehouse_location,
      ]);
      newHoldings.push(result.rows[0]);
    }
    await recordTradeAudit(client, actor, 'holding.split', 'batch_holding', id);
    return { original: { ...holding, status: 'transferred' }, newHoldings };
  });
}
