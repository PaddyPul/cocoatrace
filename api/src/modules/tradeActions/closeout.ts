import type { ActionContext, TradeAction } from './types';

export function closeoutActions({
  deal,
  organizationId,
  seller,
  buyer,
  room,
}: ActionContext): TradeAction[] | null {
  const actions: TradeAction[] = [];
  if (deal.status === 'cancelled') {
    actions.push({
      id: `deal:${deal.id}:cancelled`,
      kind: 'complete',
      priority: 100,
      requiresAction: false,
      title: 'Trade cancelled',
      description:
        'Both parties agreed to close this unstarted trade. Released inventory is not automatically republished.',
      actionLabel: 'View cancelled deal',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  if (deal.cancellation_requested_by_organization_id) {
    const reviewer = deal.cancellation_requested_by_organization_id !== organizationId;
    actions.push({
      id: `deal:${deal.id}:cancellation`,
      kind: 'waiting',
      priority: reviewer ? 8 : 65,
      requiresAction: reviewer,
      title: reviewer
        ? 'Review cancellation request'
        : 'Cancellation awaiting the other organization',
      description:
        'Inventory remains committed until the other party agrees and the safety checks pass.',
      actionLabel: reviewer ? 'Review cancellation' : 'View cancellation',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  if (
    deal.status === 'settled' &&
    deal.fee_status === 'invoiced' &&
    deal.fee_payer_organization_id === organizationId &&
    Number(deal.fee_amount) > 0
  ) {
    actions.push({
      id: `deal:${deal.id}:fee`,
      kind: 'payment',
      priority: 35,
      requiresAction: !deal.fee_payment_submitted,
      title: deal.fee_payment_submitted
        ? 'Platform fee awaiting receipt verification'
        : 'Review and pay the platform fee',
      description:
        'The trade is complete. Platform fee collection is separate from the goods payment.',
      actionLabel: 'Review fee statement',
      actionPath: room,
      contractId: deal.id,
    });
  }
  if (deal.status === 'settled') {
    actions.push({
      id: `deal:${deal.id}:complete`,
      kind: 'complete',
      priority: 100,
      requiresAction: false,
      title: 'Trade completed',
      description: `Delivery and settlement with ${seller ? deal.buyer_name : deal.seller_name} are recorded.`,
      actionLabel: 'View completed deal',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  if (deal.delivery_discrepancy_status) {
    const actor = deal.delivery_discrepancy_status === 'open' ? seller : buyer;
    actions.push({
      id: `deal:${deal.id}:discrepancy`,
      kind: 'delivery',
      priority: 12,
      requiresAction: actor,
      title: actor
        ? seller
          ? 'Propose a delivery resolution'
          : 'Review delivery resolution'
        : 'Delivery discrepancy awaiting the other party',
      description:
        'Trade completion is paused. Review the evidence and agree a resolution before accepting delivery.',
      actionLabel: 'Review delivery',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }

  return null;
}
