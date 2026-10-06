import { closeoutActions } from '../modules/tradeActions/closeout';
import { commercialActions } from '../modules/tradeActions/commercial';
import { fulfillmentActions } from '../modules/tradeActions/fulfillment';
import { authorizeActions, has } from '../modules/tradeActions/permissions';
import type {
  TradeAction,
  DealFact,
  OfferFact,
  ActionContext,
} from '../modules/tradeActions/types';
export type {
  TradeAction,
  DealFact,
  OfferFact,
  TradeOperation,
} from '../modules/tradeActions/types';
export { has } from '../modules/tradeActions/permissions';

// Priority order is explicit; views consume this response and do not decide policy.
export function buildTradeActions(
  offers: OfferFact[],
  deals: DealFact[],
  organizationId: string,
  grants: readonly string[] = [],
): TradeAction[] {
  const actions: TradeAction[] = [];
  for (const offer of offers.filter((item) => item.status === 'pending')) {
    if (
      (offer.seller_organization_id === organizationId) ===
      (offer.buyer_organization_id === organizationId)
    )
      continue;
    if (!has(grants, 'offer.respond', 'offer.create')) continue;
    const seller = offer.seller_organization_id === organizationId;
    actions.push({
      id: `offer:${offer.id}`,
      kind: seller ? 'offer_decision' : 'offer_waiting',
      priority: seller ? 10 : 80,
      requiresAction: seller,
      title: seller ? 'New offer requires a decision' : 'Offer sent—awaiting supplier response',
      description: seller
        ? `${offer.buyer_name || 'A verified buyer'} submitted commercial terms for your supply.`
        : `${offer.seller_name || 'The supplier'} has received your offer.`,
      actionLabel: seller ? 'Review offer' : 'View offer',
      actionPath: `/offers?tab=${seller ? 'received' : 'sent'}`,
      offerId: offer.id,
    });
  }

  for (const deal of deals) {
    const seller = deal.seller_organization_id === organizationId,
      buyer = deal.buyer_organization_id === organizationId;
    if (seller === buyer || !has(grants, 'contract.read')) continue;
    const room = `/deal-room/${deal.id}`;
    const context: ActionContext = {
      deal,
      organizationId,
      seller,
      buyer,
      room,
      payment: deal.payment_request_id ? `/payments/${deal.payment_request_id}` : room,
    };
    actions.push(
      ...(closeoutActions(context) ||
        commercialActions(context) ||
        fulfillmentActions(context) ||
        []),
    );
  }
  return authorizeActions(actions, deals, organizationId, grants);
}
