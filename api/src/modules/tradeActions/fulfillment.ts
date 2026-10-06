import { documentsCanBePresentedAt } from '../payments/documentPolicy';
import type { ActionContext, TradeAction } from './types';
import { dispatchDecision, type PaymentPlan } from '../../services/paymentProtection';
import { milestoneParty, transportPermissions } from '../transport/responsibilities';
import { pretty } from './labels';
export function fulfillmentActions({
  deal,
  organizationId,
  seller,
  buyer,
  room,
  payment,
}: ActionContext): TradeAction[] | null {
  const actions: TradeAction[] = [];
  if (
    deal.documents_pending &&
    !deal.documents_presented_at &&
    documentsCanBePresentedAt(deal.current_milestone)
  ) {
    actions.push({
      id: `deal:${deal.id}:documents`,
      kind: seller ? 'documents' : 'waiting',
      priority: seller ? 25 : 70,
      requiresAction: seller,
      title: seller ? 'Present the trade document set' : 'Awaiting supplier trade documents',
      description:
        'The supplier prepares validated, scan-clean invoice, packing list and transport documents. CIF/CIP also require insurance evidence. Presentation makes the document-triggered payment due.',
      actionLabel: seller ? 'Open trade documents' : 'View documents',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  if (deal.current_milestone === 'delivered' && !deal.delivery_accepted_at) {
    actions.push({
      id: `deal:${deal.id}:acceptance`,
      kind: buyer ? 'delivery' : 'waiting',
      priority: 18,
      requiresAction: buyer,
      title: buyer ? 'Inspect and accept delivered goods' : 'Awaiting buyer delivery acceptance',
      description:
        'Physical delivery is reported. The buyer must inspect the quantity and condition; report any discrepancy before acceptance.',
      actionLabel: 'Review delivery',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  if (deal.amount_confirmed !== undefined && deal.dispatch_required_amount !== undefined) {
    const gate = dispatchDecision({
      plan: deal.payment_plan as PaymentPlan,
      termsStatus: deal.payment_terms_status,
      amountConfirmed: deal.amount_confirmed,
      dispatchRequiredAmount: deal.dispatch_required_amount,
      securityStatus: deal.security_status || '',
      currencyMinorUnits: deal.currency_minor_units,
    });
    if (!gate.allowed) {
      actions.push({
        id: `deal:${deal.id}:gate`,
        kind: 'waiting',
        priority: 20,
        requiresAction: false,
        title: 'Dispatch remains blocked',
        description: gate.reason || 'Payment protection requires review.',
        actionLabel: 'Review payment protection',
        actionPath: payment,
        contractId: deal.id,
      });
      return actions;
    }
  }
  const milestone = deal.current_milestone || 'planning';
  if (milestone === 'delivered') {
    actions.push({
      id: `deal:${deal.id}:settlement`,
      kind: 'waiting',
      priority: 65,
      requiresAction: false,
      title: 'Delivery recorded—awaiting settlement',
      description:
        'The deal will close automatically when every payment installment is seller-verified.',
      actionLabel: 'View deal',
      actionPath: room,
      contractId: deal.id,
    });
    return actions;
  }
  const permissions = transportPermissions(deal, organizationId);
  let next: string | undefined;
  if (['planning', 'booked', 'requested', 'accepted'].includes(milestone))
    next = milestone === 'planning' ? 'booked' : 'cargo_ready';
  else if (
    [
      'cargo_ready',
      'export_cleared',
      'picked_up',
      'warehouse_received',
      'handed_over',
      'port_received',
    ].includes(milestone)
  )
    next =
      deal.incoterm === 'FAS' && milestone !== 'handed_over' && milestone !== 'port_received'
        ? 'handed_over'
        : 'loaded';
  else if (milestone === 'loaded') next = 'departed';
  else if (milestone === 'departed') next = 'arrived';
  else if (milestone === 'arrived') next = 'customs_cleared';
  else if (milestone === 'customs_cleared')
    next = deal.incoterm === 'DPU' ? 'unloaded' : 'delivered';
  else if (milestone === 'unloaded') next = 'delivered';
  const responsible = next ? milestoneParty(deal.incoterm, next) : null;
  const actor = permissions.party !== null && permissions.party === responsible;
  const task = next ? pretty(next) : 'transport configuration review';
  actions.push({
    id: `deal:${deal.id}:transport`,
    kind: actor ? 'transport' : 'waiting',
    priority: actor ? 30 : 70,
    requiresAction: actor,
    title: actor
      ? `Next transport action: ${task}`
      : `Awaiting ${responsible || 'contract'}: ${task}`,
    description: actor
      ? `Your contract role records this step under ${deal.incoterm}. Payment and safety gates still apply.`
      : 'The other party must record its assigned step. You can track progress without confirming on its behalf.',
    actionLabel: actor ? 'Continue transport' : 'Track shipment',
    actionPath: deal.shipment_id ? `/shipments/${deal.shipment_id}` : room,
    contractId: deal.id,
  });
  return actions;
}
