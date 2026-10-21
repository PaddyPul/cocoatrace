import type { PoolClient } from 'pg';
import type { HoldingRow, TransferRow } from './types';

export function lockOwnedBatch(
  client: PoolClient,
  values: [batchId: string, organizationId: string],
) {
  return client.query<{ quantity_kg: string }>(
    'SELECT quantity_kg FROM harvest_batches WHERE id=$1 AND current_holder_id=$2 FOR NO KEY UPDATE',
    values,
  );
}

export function allocatedBatchQuantity(client: PoolClient, values: [batchId: string]) {
  return client.query<{ quantity: string }>(
    "SELECT COALESCE(SUM(quantity_kg),0) AS quantity FROM batch_holdings WHERE batch_id=$1 AND status <> 'transferred'",
    values,
  );
}

export function insertHolding(
  client: PoolClient,
  values: [
    batchId: string,
    organizationId: string,
    quantityKg: number,
    warehouseLocation: string | null,
  ],
) {
  return client.query<HoldingRow>(
    'INSERT INTO batch_holdings (batch_id,holder_organization_id,quantity_kg,warehouse_location) VALUES ($1,$2,$3,$4) RETURNING *',
    values,
  );
}

export function lockOwnedHolding(
  client: PoolClient,
  values: [holdingId: string, organizationId: string],
) {
  return client.query<HoldingRow>(
    'SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 FOR UPDATE',
    values,
  );
}

export function findDestination(client: PoolClient, values: [organizationId: string]) {
  return client.query<{ id: string }>('SELECT id FROM organizations WHERE id=$1', values);
}

export function insertTransfer(
  client: PoolClient,
  values: [
    holdingId: string,
    fromOrganizationId: string,
    toOrganizationId: string,
    quantityKg: number,
  ],
) {
  return client.query<TransferRow>(
    'INSERT INTO custody_transfers (holding_id,from_organization_id,to_organization_id,quantity_kg) VALUES ($1,$2,$3,$4) RETURNING *',
    values,
  );
}

export function discoverIncomingTransfer(
  client: PoolClient,
  values: [transferId: string, organizationId: string],
) {
  return client.query<{ holding_id: string }>(
    'SELECT holding_id FROM custody_transfers WHERE id=$1 AND to_organization_id=$2',
    values,
  );
}

export function lockSourceHolding(client: PoolClient, values: [holdingId: string]) {
  return client.query<HoldingRow>('SELECT * FROM batch_holdings WHERE id=$1 FOR UPDATE', values);
}

export function lockIncomingTransfer(
  client: PoolClient,
  values: [transferId: string, organizationId: string],
) {
  return client.query<TransferRow>(
    'SELECT * FROM custody_transfers WHERE id=$1 AND to_organization_id=$2 FOR UPDATE',
    values,
  );
}

export function updateSourceQuantity(
  client: PoolClient,
  values: [quantityKg: number, status: string, holdingId: string],
) {
  return client.query<HoldingRow>(
    'UPDATE batch_holdings SET quantity_kg=$1,status=$2 WHERE id=$3',
    values,
  );
}

export function acceptRequestedTransfer(client: PoolClient, values: [transferId: string]) {
  return client.query<TransferRow>(
    "UPDATE custody_transfers SET status='accepted',responded_at=NOW() WHERE id=$1 RETURNING *",
    values,
  );
}

export function markHoldingTransferred(client: PoolClient, values: [holdingId: string]) {
  return client.query<HoldingRow>(
    "UPDATE batch_holdings SET status='transferred' WHERE id=$1",
    values,
  );
}
