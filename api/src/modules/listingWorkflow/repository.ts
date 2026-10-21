import type { PoolClient } from 'pg';
import { query } from '../../db';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import {
  lockHoldingListings,
  pendingTransferQuantity,
  reconcileHoldingListings,
} from '../../services/inventoryIntegrity';
import { lockRecallBoundary, assertBatchNotRecalled, activeBatchRecallSql } from '../recall/safety';
import { loadBatchTrust } from '../trust/assessment';
import type {
  CurrentListingRow,
  HoldingRow,
  ListingDetailRow,
  ListingRepository,
  ListingRow,
  ListingTransaction,
} from './types';

function transactionRepository(client: PoolClient): ListingTransaction {
  return {
    lockRecallBoundary: () => lockRecallBoundary(client),
    async findOwnedHolding(id, organizationId) {
      return (
        await client.query<HoldingRow>(
          'SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 FOR UPDATE',
          [id, organizationId],
        )
      ).rows[0];
    },
    async discoverHolding(id, organizationId) {
      return (
        await client.query<{ holding_id: string }>(
          'SELECT holding_id FROM listings WHERE id=$1 AND seller_organization_id=$2',
          [id, organizationId],
        )
      ).rows[0]?.holding_id;
    },
    async lockHolding(id) {
      return (
        await client.query<HoldingRow>('SELECT * FROM batch_holdings WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
    },
    lockListings: (id) => lockHoldingListings(client, id),
    async findOwnedListing(id, organizationId) {
      return (
        await client.query<CurrentListingRow>(
          'SELECT *, (expires_at IS NOT NULL AND expires_at<=clock_timestamp()) AS listing_expired FROM listings WHERE id=$1 AND seller_organization_id=$2',
          [id, organizationId],
        )
      ).rows[0];
    },
    assertNotRecalled: (id) => assertBatchNotRecalled(client, id),
    async publishedQuantity(id, excludingId) {
      const result =
        excludingId === undefined
          ? await client.query<{ quantity: string | number }>(
              'SELECT COALESCE(SUM(available_quantity_kg),0) AS quantity FROM listings WHERE holding_id=$1 AND active=TRUE AND (expires_at IS NULL OR expires_at>clock_timestamp())',
              [id],
            )
          : await client.query<{ quantity: string | number }>(
              'SELECT COALESCE(SUM(available_quantity_kg),0) AS quantity FROM listings WHERE holding_id=$1 AND active=TRUE AND (expires_at IS NULL OR expires_at>clock_timestamp()) AND id<>$2',
              [id, excludingId],
            );
      return Number(result.rows[0].quantity);
    },
    pendingQuantity: (id) => pendingTransferQuantity(client, id),
    async insert(actor, input) {
      return (
        await client.query<ListingRow>(
          'INSERT INTO listings (seller_organization_id, holding_id, available_quantity_kg, price_per_kg, currency, incoterm, origin_location, destination_location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
          [
            actor.organizationId,
            input.holdingId,
            input.availableQuantityKg,
            input.pricePerKg,
            input.currency,
            input.incoterm,
            input.originLocation,
            input.destinationLocation,
          ],
        )
      ).rows[0];
    },
    async update(id, price, quantity, active) {
      return (
        await client.query<ListingRow>(
          'UPDATE listings SET price_per_kg=COALESCE($1,price_per_kg),available_quantity_kg=$2,active=$3 WHERE id=$4 RETURNING *',
          [price, quantity, active, id],
        )
      ).rows[0];
    },
    async withdraw(id) {
      await client.query('UPDATE listings SET active=FALSE WHERE id=$1', [id]);
    },
    reconcile: (id, quantity) => reconcileHoldingListings(client, id, quantity),
    audit: (actor, action, id) => recordAudit(client, actor, action, 'listing', id),
  };
}

export const listingRepository: ListingRepository = {
  async detail(id) {
    return (
      await query<ListingDetailRow>(
        `SELECT l.*, o.name as seller_name, h.batch_id, b.crop, b.organic_claim_status, b.grade, b.harvest_date,
              b.source_mode, b.source_name, b.source_country, b.source_region,
              ${activeBatchRecallSql('b.id')} AS "activeRecall",
              f.name as farm_name, f.region as farm_region, f.country as farm_country,
              h.batch_id
       FROM listings l
       JOIN organizations o ON o.id = l.seller_organization_id
       JOIN batch_holdings h ON h.id = l.holding_id
       JOIN harvest_batches b ON b.id = h.batch_id
       LEFT JOIN farms f ON f.id = b.farm_id
       WHERE l.id = $1`,
        [id],
      )
    ).rows[0];
  },
  async trust(id) {
    return (await loadBatchTrust([id])).get(id)!;
  },
  transaction: (work) => inDatabaseTransaction((client) => work(transactionRepository(client))),
};
