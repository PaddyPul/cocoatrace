import { ConflictError, NotFoundError } from '../../errors';
import { lockOfferInventory } from './offers';
import { inTradeTransaction, recordTradeAudit, type TradeActor } from './transaction';

/** Shares acceptance's holding -> listings -> offers order, so only one terminal decision wins. */
export async function withdrawTradeOffer(actor: TradeActor, offerId: string) {
  return inTradeTransaction(async (client) => {
    // Reject unrelated actors before taking inventory locks; recheck current buyer after locks.
    const visible = await client.query(
      'SELECT id FROM trade_offers WHERE id=$1 AND buyer_organization_id=$2',
      [offerId, actor.organizationId],
    );
    if (!visible.rows[0]) throw new NotFoundError('Offer');
    const { offer } = await lockOfferInventory(client, offerId);
    if (offer.buyer_organization_id !== actor.organizationId) throw new NotFoundError('Offer');
    // cancelled is the existing offer terminal state; accepted contract cancellation is separate.
    if (offer.status === 'cancelled') return offer;
    if (offer.status !== 'pending') throw new ConflictError('Only pending offers can be withdrawn');
    const result = await client.query(
      "UPDATE trade_offers SET status='cancelled' WHERE id=$1 RETURNING *",
      [offerId],
    );
    await recordTradeAudit(client, actor, 'offer.withdraw', 'trade_offer', offerId, {
      previousStatus: 'pending',
      newStatus: 'cancelled',
    });
    return result.rows[0];
  });
}
