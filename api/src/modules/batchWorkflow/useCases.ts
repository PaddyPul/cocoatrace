import type { AuditActor } from '../../services/auditWriter';
import { recordAudit } from '../../services/auditWriter';
import { ensureSourceMaterialLot } from '../../services/materialLot';
import { lockHoldingListings, pendingTransferQuantity } from '../../services/inventoryIntegrity';
import { recordTradeAudit } from '../trading/transaction';
import { lockRecallBoundary, assertBatchNotRecalled } from '../recall/safety';
import { BatchRepository, connectBatchWorkflow, ownsFarm, farmPlotCount } from './repository';
import type {
  BatchRow,
  DirectInventoryInput,
  HarvestInput,
  ListingInput,
  ListingRow,
} from './repository';

export class BatchWorkflowError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}
export async function publishBatchInventory(
  actor: AuditActor,
  batchId: string,
  input: ListingInput,
): Promise<ListingRow> {
  const client = await connectBatchWorkflow();
  const repository = new BatchRepository(client);
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const batch = await repository.ownedBatch(batchId, actor.organizationId);
    if (!batch) throw new BatchWorkflowError(404, 'Batch not found or not yours');
    await assertBatchNotRecalled(client, batchId);
    // Keep the holding -> listings lock order; allocation locks the source only when no holding exists.
    let holding = await repository.bestHolding(batchId, actor.organizationId);
    if (!holding) {
      await repository.lockAllocation(batchId);
      const allocated = await repository.allocatedQuantity(batchId);
      const unallocatedGrams =
        Math.round(Number(batch.quantity_kg) * 1000) - Math.round(allocated * 1000);
      if (Math.round(input.quantityKg * 1000) > unallocatedGrams) {
        throw new BatchWorkflowError(
          409,
          'This batch has no unallocated stock available to publish',
          'INSUFFICIENT_INVENTORY',
        );
      }
      holding = await repository.createHolding(batchId, actor.organizationId, input.quantityKg);
    }
    await lockHoldingListings(client, holding.id);
    const reserved = await pendingTransferQuantity(client, holding.id);
    const listed = await repository.listedQuantity(holding.id);
    const remainingGrams =
      Math.round(Number(holding.quantity_kg) * 1000) -
      Math.round(reserved * 1000) -
      Math.round(listed * 1000);
    if (Math.round(input.quantityKg * 1000) > remainingGrams) {
      throw new BatchWorkflowError(
        409,
        `Only ${Math.max(0, remainingGrams) / 1000} kg remains available to publish`,
        'INSUFFICIENT_INVENTORY',
      );
    }
    const listing = await repository.createListing(actor.organizationId, holding.id, input);
    await recordTradeAudit(client, actor, 'listing.create', 'listing', listing.id);
    await client.query('COMMIT');
    return listing;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function registerHarvestBatch(
  actor: AuditActor,
  input: HarvestInput,
): Promise<BatchRow & { holding_id: string }> {
  if (!(await ownsFarm(input.farmId, actor.organizationId))) {
    throw new BatchWorkflowError(400, 'Choose a farm managed by your organization');
  }
  if (
    input.plotIds?.length &&
    (await farmPlotCount(input.farmId, input.plotIds)) !== input.plotIds.length
  ) {
    throw new BatchWorkflowError(400, 'One or more plots do not belong to the selected farm');
  }
  const client = await connectBatchWorkflow();
  const repository = new BatchRepository(client);
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const batch = await repository.createHarvest(actor.organizationId, input);
    await ensureSourceMaterialLot(client, batch);
    const holding = await repository.createHarvestHolding(
      batch.id,
      actor.organizationId,
      input.quantityKg,
    );
    await recordAudit(client, actor, 'batch.create', 'harvest_batch', batch.id);
    await client.query('COMMIT');
    return { ...batch, holding_id: holding.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function registerDirectInventory(
  actor: AuditActor,
  input: DirectInventoryInput,
): Promise<BatchRow & { holding_id: string }> {
  const client = await connectBatchWorkflow();
  const repository = new BatchRepository(client);
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const batch = await repository.createDirect(actor.organizationId, input);
    await ensureSourceMaterialLot(client, batch);
    const holding = await repository.createWarehouseHolding(batch.id, actor.organizationId, input);
    await recordAudit(client, actor, 'inventory.create_direct', 'harvest_batch', batch.id);
    await client.query('COMMIT');
    return { ...batch, holding_id: holding.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
