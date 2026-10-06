import type { ActionContext, TradeAction } from './types';
import { money, pretty } from './labels';
export function commercialActions({
  deal,
  seller,
  buyer,
  room,
  payment,
}: ActionContext): TradeAction[] | null {
  const actions: TradeAction[] = [];
  if (deal.payment_terms_status === 'draft') {
    actions.push({
      id: `deal:${deal.id}:terms`,
      kind: seller ? 'configure_terms' : 'waiting',
      priority: seller ? 15 : 75,
      requiresAction: seller,
      title: seller
        ? 'Set the payment protection plan'
        : 'Offer accepted—supplier preparing payment terms',
      description: seller
        ? 'Choose the payment condition before the buyer can review or confirm it.'
        : `${deal.seller_name} must propose the payment protection terms next.`,
      actionLabel: seller ? 'Configure protection' : 'View deal',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  if (deal.payment_terms_status === 'proposed') {
    actions.push({
      id: `deal:${deal.id}:terms`,
      kind: buyer ? 'confirm_terms' : 'waiting',
      priority: buyer ? 15 : 75,
      requiresAction: buyer,
      title: buyer
        ? 'Review and confirm payment terms'
        : 'Payment terms sent—awaiting buyer confirmation',
      description: buyer
        ? `${deal.seller_name} proposed ${pretty(deal.payment_plan)}.`
        : `${deal.buyer_name} must confirm the proposed terms.`,
      actionLabel: buyer ? 'Review terms' : 'View deal',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  if (deal.payment_terms_status !== 'agreed') {
    actions.push({
      id: `deal:${deal.id}:unavailable`,
      kind: 'waiting',
      priority: 15,
      requiresAction: false,
      title: 'Payment terms need review',
      description:
        'The payment state is unavailable or unsupported. Review the contract with your administrator before progressing.',
      actionLabel: 'Review contract',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  if (deal.payment_issue_status || deal.recall_held) {
    actions.push({
      id: `deal:${deal.id}:hold`,
      kind: 'waiting',
      priority: 10,
      requiresAction: false,
      title: deal.recall_held ? 'Trade on recall safety hold' : 'Resolve the payment issue',
      description: deal.recall_held
        ? 'Trading and dispatch remain blocked. Review the recall response with your safety lead.'
        : 'An unresolved payment issue blocks progression. Review the issue in the payment workspace.',
      actionLabel: deal.recall_held ? 'View held deal' : 'Review payment issue',
      actionPath: deal.recall_held ? room : payment,
      contractId: deal.id,
    });
    return actions;
  }
  if (
    ![
      'pay_before_dispatch',
      'deposit_balance',
      'bank_secured',
      'documentary_collection',
      'pay_after_delivery',
    ].includes(deal.payment_plan) ||
    (deal.facts_loaded &&
      (!deal.payment_request_id ||
        deal.amount_confirmed == null ||
        deal.dispatch_required_amount == null))
  ) {
    return [
      {
        id: `deal:${deal.id}:unavailable`,
        kind: 'waiting',
        priority: 15,
        requiresAction: false,
        title: 'Payment protection needs review',
        description:
          'The payment protection record is incomplete or unsupported. Ask your administrator to review it before progressing.',
        actionLabel: 'Review contract',
        actionPath: room,
        contractId: deal.id,
      },
    ];
  }
  if (deal.payment_plan === 'bank_secured' && deal.security_status !== 'verified') {
    const submitted = deal.security_status === 'submitted',
      actor = submitted ? seller : buyer;
    actions.push({
      id: `deal:${deal.id}:security`,
      kind: submitted ? 'payment_verification' : 'payment',
      priority: actor ? 20 : 70,
      requiresAction: actor,
      title: submitted
        ? seller
          ? 'Verify submitted bank security'
          : 'Bank security awaiting seller verification'
        : buyer
          ? 'Submit the agreed bank security'
          : 'Awaiting buyer bank security',
      description: submitted
        ? 'The security reference must be verified before dispatch.'
        : 'Dispatch remains blocked until the agreed security is submitted and verified.',
      actionLabel: actor
        ? submitted
          ? 'Verify security'
          : 'Submit security'
        : 'View payment status',
      actionPath: payment,
      contractId: deal.id,
    });
    return actions;
  }
  if (deal.installment_status === 'payment_submitted') {
    actions.push({
      id: `deal:${deal.id}:payment`,
      kind: seller ? 'payment_verification' : 'waiting',
      priority: seller ? 20 : 70,
      requiresAction: seller,
      title: seller ? 'Verify funds received' : 'Payment submitted—awaiting supplier verification',
      description: seller
        ? `${deal.buyer_name} submitted a reference. Check the receiving account before confirming.`
        : `${deal.seller_name} must verify receipt before the payment counts as cleared.`,
      actionLabel: seller ? 'Verify payment' : 'View payment',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  if (deal.installment_status === 'due') {
    actions.push({
      id: `deal:${deal.id}:payment`,
      kind: buyer ? 'payment' : 'waiting',
      priority: buyer ? 20 : 70,
      requiresAction: buyer,
      title: buyer ? 'Complete the due payment' : 'Awaiting buyer payment',
      description: buyer
        ? `${money(deal.amount_due, deal.currency, deal.currency_minor_units)} is due for the ${pretty(deal.installment_type || 'payment')}.`
        : `${deal.buyer_name} must submit the due ${pretty(deal.installment_type || 'payment')}.`,
      actionLabel: buyer ? 'Submit payment' : 'View deal',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }

  return null;
}
