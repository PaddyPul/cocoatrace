import { canRecord, milestoneOrder } from '../transport/responsibilities';
import { dispatchDecision } from '../../services/paymentProtection';
import type { MilestoneInput, ProgressRow, WorkflowResult } from './model';
const order: readonly string[] = milestoneOrder;

/** Preserve authority-first denial ordering; unknown milestones are not a permission bypass. */
export function transitionDenial(
  shipment: ProgressRow | undefined,
  organizationId: string,
  milestone: string,
): WorkflowResult | null {
  if (!shipment) return { status: 404, body: { error: 'Transport record not found' } };
  if (
    shipment.seller_organization_id !== organizationId &&
    shipment.buyer_organization_id !== organizationId
  )
    return { status: 403, body: { error: 'Only a party can report progress' } };
  if (!canRecord(shipment, organizationId, milestone))
    return {
      status: 403,
      body: {
        error:
          'This transport action belongs to the other contract party or requires reviewed Incoterm configuration',
        code: 'TRANSPORT_ACTION_FORBIDDEN',
      },
    };
  if (shipment.contract_status === 'cancelled')
    return { status: 409, body: { error: 'This trade has been cancelled' } };
  if (!order.includes(milestone))
    return { status: 400, body: { error: 'Unknown transport milestone' } };
  if (order.indexOf(milestone) <= order.indexOf(shipment.current_milestone))
    return {
      status: 400,
      body: {
        error: `Cannot go from ${shipment.current_milestone} to ${milestone}. Milestones must progress forward.`,
      },
    };
  return null;
}
/** Includes skipped pickup boundaries, but keeps later containment/arrival reports available. */
export function crossesDispatchBoundary(current: string, next: string): boolean {
  return (
    ['picked_up', 'handed_over', 'port_received', 'loaded', 'departed'].includes(next) ||
    (order.indexOf(current) < order.indexOf('picked_up') &&
      order.indexOf(next) >= order.indexOf('picked_up'))
  );
}
export type DispatchAuthorization =
  | { kind: 'ordinary' }
  | { kind: 'exception'; reason: string }
  | { kind: 'denied'; response: WorkflowResult };
/** Recall, currency and unresolved issues are checked before this payment-only exception policy. */
export function authorizePaymentDispatch(
  shipment: ProgressRow,
  organizationId: string,
  exceptionalDispatch: MilestoneInput['exceptionalDispatch'],
): DispatchAuthorization {
  const decision = dispatchDecision({
    plan: shipment.payment_plan,
    termsStatus: shipment.payment_terms_status,
    amountConfirmed: shipment.amount_confirmed || '0',
    dispatchRequiredAmount: shipment.dispatch_required_amount || '0',
    securityStatus: shipment.security_status || 'not_required',
    currencyMinorUnits: shipment.payment_minor_units,
  });
  if (decision.allowed) return { kind: 'ordinary' };
  if (!exceptionalDispatch)
    return {
      kind: 'denied',
      response: { status: 409, body: { error: decision.reason, code: 'PAYMENT_DISPATCH_GATE' } },
    };
  if (shipment.seller_organization_id !== organizationId)
    return {
      kind: 'denied',
      response: {
        status: 403,
        body: { error: 'Only the seller can authorize exceptional dispatch' },
      },
    };
  return { kind: 'exception', reason: exceptionalDispatch.reason };
}
