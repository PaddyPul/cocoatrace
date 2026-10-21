import { getClient, query } from '../../db';
import type { PoolClient } from 'pg';

export interface BatchRow {
  id: string;
  crop: string;
  quantity_kg: string | number;
  current_holder_id: string;
  harvest_date: string;
  farm_id: string | null;
  plot_ids: string[];
  moisture_percent: string | number | null;
  grade: string | null;
  organic_claim_status: string;
  source_mode: string;
}
export interface HoldingRow {
  id: string;
  quantity_kg: string | number;
}
export interface ListingRow {
  id: string;
  seller_organization_id: string;
  holding_id: string;
  available_quantity_kg: string | number;
  price_per_kg: string | number;
  currency: string;
  incoterm: string;
  origin_location: string;
  destination_location: string;
}
export interface HarvestInput {
  farmId: string;
  plotIds?: string[];
  crop: string;
  harvestDate: string;
  quantityKg: number;
  moisturePercent?: number | null;
  grade?: string | null;
}
export interface DirectInventoryInput {
  commodity: string;
  quantityKg: number;
  inventoryDate: string;
  sourceName?: string | null;
  sourceCountry: string;
  sourceRegion?: string | null;
  warehouseLocation?: string | null;
  moisturePercent?: number | null;
  grade?: string | null;
}
export interface ListingInput {
  quantityKg: number;
  pricePerKg: number;
  currency: string;
  incoterm: string;
  originLocation: string;
  destinationLocation: string;
}
export async function ownsFarm(farmId: string, organizationId: string): Promise<boolean> {
  return Boolean(
    (
      await query('SELECT id FROM farms WHERE id=$1 AND farmer_organization_id=$2', [
        farmId,
        organizationId,
      ])
    ).rows[0],
  );
}
export async function farmPlotCount(farmId: string, plotIds: string[]): Promise<number> {
  return (
    await query('SELECT id FROM farm_plots WHERE farm_id=$1 AND id=ANY($2::uuid[])', [
      farmId,
      plotIds,
    ])
  ).rows.length;
}
export const connectBatchWorkflow = getClient;
export class BatchRepository {
  constructor(private readonly client: PoolClient) {}
  async ownedBatch(id: string, organizationId: string): Promise<BatchRow | undefined> {
    return (
      await this.client.query<BatchRow>(
        'SELECT * FROM harvest_batches WHERE id=$1 AND current_holder_id=$2 FOR KEY SHARE',
        [id, organizationId],
      )
    ).rows[0];
  }
  async bestHolding(batchId: string, organizationId: string): Promise<HoldingRow | undefined> {
    return (
      await this.client.query<HoldingRow>(
        `SELECT h.* FROM batch_holdings h WHERE h.batch_id=$1 AND h.holder_organization_id=$2 AND h.status='available'
       ORDER BY (h.quantity_kg
         - COALESCE((SELECT SUM(l.available_quantity_kg) FROM listings l WHERE l.holding_id=h.id AND l.active=TRUE AND (l.expires_at IS NULL OR l.expires_at>clock_timestamp())),0)
         - COALESCE((SELECT SUM(t.quantity_kg) FROM custody_transfers t WHERE t.holding_id=h.id AND t.status='requested'),0)) DESC,h.id
       LIMIT 1 FOR UPDATE OF h`,
        [batchId, organizationId],
      )
    ).rows[0];
  }
  async lockAllocation(batchId: string): Promise<void> {
    await this.client.query('SELECT id FROM harvest_batches WHERE id=$1 FOR NO KEY UPDATE', [
      batchId,
    ]);
  }
  async allocatedQuantity(batchId: string): Promise<number> {
    return Number(
      (
        await this.client.query<{ quantity: string }>(
          "SELECT COALESCE(SUM(quantity_kg),0) AS quantity FROM batch_holdings WHERE batch_id=$1 AND status<>'transferred'",
          [batchId],
        )
      ).rows[0].quantity,
    );
  }
  async createHolding(
    batchId: string,
    organizationId: string,
    quantity: number,
  ): Promise<HoldingRow> {
    return (
      await this.client.query<HoldingRow>(
        "INSERT INTO batch_holdings (batch_id,holder_organization_id,quantity_kg,status) VALUES ($1,$2,$3,'available') RETURNING *",
        [batchId, organizationId, quantity],
      )
    ).rows[0];
  }
  async createHarvestHolding(
    batchId: string,
    organizationId: string,
    quantity: number,
  ): Promise<{ id: string }> {
    return (
      await this.client.query<{ id: string }>(
        "INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, status) VALUES ($1,$2,$3,'available') RETURNING id",
        [batchId, organizationId, quantity],
      )
    ).rows[0];
  }
  async listedQuantity(holdingId: string): Promise<number> {
    return Number(
      (
        await this.client.query<{ quantity: string }>(
          'SELECT COALESCE(SUM(available_quantity_kg),0) AS quantity FROM listings WHERE holding_id=$1 AND active=TRUE AND (expires_at IS NULL OR expires_at>clock_timestamp())',
          [holdingId],
        )
      ).rows[0].quantity,
    );
  }
  async createListing(
    organizationId: string,
    holdingId: string,
    input: ListingInput,
  ): Promise<ListingRow> {
    return (
      await this.client.query<ListingRow>(
        'INSERT INTO listings (seller_organization_id, holding_id, available_quantity_kg, price_per_kg, currency, incoterm, origin_location, destination_location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [
          organizationId,
          holdingId,
          input.quantityKg,
          input.pricePerKg,
          input.currency,
          input.incoterm,
          input.originLocation,
          input.destinationLocation,
        ],
      )
    ).rows[0];
  }
  async createHarvest(organizationId: string, input: HarvestInput): Promise<BatchRow> {
    return (
      await this.client.query<BatchRow>(
        "INSERT INTO harvest_batches (farm_id, plot_ids, crop, harvest_date, quantity_kg, moisture_percent, grade, current_holder_id, organic_claim_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_attestation') RETURNING *",
        [
          input.farmId,
          input.plotIds,
          input.crop,
          input.harvestDate,
          input.quantityKg,
          input.moisturePercent || null,
          input.grade || null,
          organizationId,
        ],
      )
    ).rows[0];
  }
  async createDirect(organizationId: string, input: DirectInventoryInput): Promise<BatchRow> {
    return (
      await this.client.query<BatchRow>(
        `INSERT INTO harvest_batches (
        farm_id, plot_ids, crop, harvest_date, quantity_kg, moisture_percent, grade,
        current_holder_id, organic_claim_status, source_mode, source_name, source_country, source_region
      ) VALUES (NULL,'{}',$1,$2,$3,$4,$5,$6,'none','direct_inventory',$7,$8,$9) RETURNING *`,
        [
          input.commodity,
          input.inventoryDate,
          input.quantityKg,
          input.moisturePercent || null,
          input.grade || null,
          organizationId,
          input.sourceName || null,
          input.sourceCountry,
          input.sourceRegion || null,
        ],
      )
    ).rows[0];
  }
  async createWarehouseHolding(
    batchId: string,
    organizationId: string,
    input: DirectInventoryInput,
  ): Promise<HoldingRow> {
    return (
      await this.client.query<HoldingRow>(
        "INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location, status) VALUES ($1,$2,$3,$4,'available') RETURNING *",
        [batchId, organizationId, input.quantityKg, input.warehouseLocation || null],
      )
    ).rows[0];
  }
}
