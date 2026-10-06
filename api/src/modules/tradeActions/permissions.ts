import type { TradeAction, TradeOperation, DealFact } from './types';
export function authorizeActions(
  actions: TradeAction[],
  deals: DealFact[],
  organizationId: string,
  grants: readonly string[],
): TradeAction[] {
  const facts = new Map(deals.map((deal) => [deal.id, deal]));
  return actions
    .map((action) => {
      const deal = action.contractId ? facts.get(action.contractId) : undefined;
      const operation: TradeOperation = action.id.endsWith(':security')
        ? 'bank_security'
        : action.kind === 'configure_terms'
          ? 'configure_terms'
          : action.kind === 'confirm_terms'
            ? 'confirm_terms'
            : action.id.endsWith(':payment') && action.kind === 'payment'
              ? 'submit_payment'
              : action.id.endsWith(':payment') && action.kind === 'payment_verification'
                ? 'verify_payment'
                : action.kind === 'documents'
                  ? 'documents'
                  : action.kind === 'transport'
                    ? 'transport'
                    : 'view';
      const needed =
        operation === 'submit_payment'
          ? 'payment.confirm'
          : operation === 'verify_payment' || operation === 'documents'
            ? 'payment.request'
            : operation === 'bank_security'
              ? deal?.buyer_organization_id === organizationId
                ? 'payment.confirm'
                : 'payment.request'
              : operation === 'transport'
                ? 'shipment.update'
                : action.kind === 'offer_decision'
                  ? 'offer.respond'
                  : undefined;
      const readableDestination = action.actionPath.startsWith('/payments/')
        ? has(grants, 'payment.read')
        : action.actionPath.startsWith('/shipments/')
          ? has(grants, 'shipment.read')
          : true;
      const cancellationOrFee = action.id.endsWith(':cancellation') || action.id.endsWith(':fee');
      const canAct =
        action.requiresAction &&
        (!needed || has(grants, needed)) &&
        readableDestination &&
        (!cancellationOrFee || has(grants, 'offer.create', 'offer.respond'));

      return {
        ...action,
        requiresAction: canAct,
        actionPath: readableDestination ? action.actionPath : `/deal-room/${action.contractId}`,
        operation: canAct ? operation : 'view',
        installmentId:
          operation === 'submit_payment' || operation === 'verify_payment'
            ? deal?.installment_id
            : undefined,
        ...(action.requiresAction && !canAct
          ? {
              title: 'Awaiting an authorized colleague',
              description:
                'Your organization owns the next step, but your account cannot perform it. Ask an authorized colleague to continue.',
              actionLabel: 'View deal',
            }
          : {}),
      };
    })
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

export function has(grants: readonly string[], ...required: string[]): boolean {
  return grants.includes('*') || required.some((permission) => grants.includes(permission));
}
