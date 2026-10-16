import { sensitiveActionLimit } from '../../middleware/security';
import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { inTradeTransaction, recordTradeAudit } from '../trading/transaction';
import { lockRecallBoundary, assertBatchNotRecalled } from '../recall/safety';
import { lockHoldingListings, pendingTransferQuantity } from '../../services/inventoryIntegrity';
import { AppError, NotFoundError, ValidationError } from '../../errors';
import { renewalInput } from './policy';
const router = Router();
router.post(
  '/listings/:id/renew',
  requireAuth,
  requirePermission('listing.create'),
  sensitiveActionLimit,
  async (req, res) => {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(req.params.id),
      )
    )
      throw new ValidationError('Listing ID must be a UUID');
    const input = renewalInput(req.body);
    const listing = await inTradeTransaction(async (client) => {
      await lockRecallBoundary(client);
      const id = req.params.id;
      const found = (
        await client.query(
          'SELECT holding_id FROM listings WHERE id=$1 AND seller_organization_id=$2',
          [id, req.user!.organizationId],
        )
      ).rows[0];
      if (!found) throw new NotFoundError('Listing');
      const holding = (
        await client.query('SELECT * FROM batch_holdings WHERE id=$1 FOR UPDATE', [
          found.holding_id,
        ])
      ).rows[0];
      await lockHoldingListings(client, found.holding_id);
      const current = (await client.query('SELECT * FROM listings WHERE id=$1', [id])).rows[0];
      if (
        !current ||
        current.holding_id !== found.holding_id ||
        !current.active ||
        !holding ||
        holding.status !== 'available' ||
        holding.holder_organization_id !== req.user!.organizationId ||
        current.seller_organization_id !== req.user!.organizationId
      ) {
        throw new AppError(
          'Only active supply still owned and available can be renewed',
          409,
          'INVENTORY_UNAVAILABLE',
        );
      }
      await assertBatchNotRecalled(client, holding.batch_id);
      // Revalidate against the database clock after waiting for inventory locks.
      const time = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
      renewalInput(req.body, new Date(time).getTime());
      const siblings = (
        await client.query(
          `SELECT COALESCE(SUM(available_quantity_kg),0) AS quantity FROM listings
      WHERE holding_id=$1 AND id<>$2 AND active=TRUE AND (expires_at IS NULL OR expires_at>clock_timestamp())`,
          [holding.id, id],
        )
      ).rows[0];
      const freeGrams =
        Math.round(Number(holding.quantity_kg) * 1000) -
        Math.round(Number(siblings.quantity) * 1000) -
        Math.round((await pendingTransferQuantity(client, holding.id)) * 1000);
      if (
        !(Number(current.available_quantity_kg) > 0) ||
        Math.round(Number(current.available_quantity_kg) * 1000) > freeGrams
      )
        throw new AppError(
          'Insufficient current inventory to renew this quantity',
          409,
          'INSUFFICIENT_INVENTORY',
        );
      await client.query(`SELECT id FROM trade_offers WHERE listing_id=$1 ORDER BY id FOR UPDATE`, [
        id,
      ]);
      if (
        (
          await client.query(
            "SELECT id FROM trade_offers WHERE listing_id=$1 AND status='accepted'",
            [id],
          )
        ).rows.length
      )
        throw new AppError('Accepted supply cannot be renewed', 409, 'INVENTORY_UNAVAILABLE');
      const rejected = await client.query(
        "UPDATE trade_offers SET status='rejected' WHERE listing_id=$1 AND status='pending'",
        [id],
      );
      const renewed = (
        await client.query(
          'UPDATE listings SET expires_at=$1,renewed_at=clock_timestamp() WHERE id=$2 RETURNING *',
          [input.expiry, id],
        )
      ).rows[0];
      await recordTradeAudit(client, req.user!, 'listing.renew', 'listing', String(id), {
        reason: input.reason,
        previousExpiresAt: current.expires_at,
        expiresAt: input.expiry.toISOString(),
        quantityKg: current.available_quantity_kg,
        rejectedOfferCount: rejected.rowCount,
      });
      return renewed;
    });
    res.json(listing);
  },
);
export default router;
