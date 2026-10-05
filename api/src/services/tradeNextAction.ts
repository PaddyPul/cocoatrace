export type TradeActionKind = 'offer_decision' | 'offer_waiting' | 'configure_terms' | 'confirm_terms' | 'payment' | 'payment_verification' | 'transport' | 'delivery' | 'waiting' | 'complete';

export interface TradeAction {
  id: string;
  kind: TradeActionKind;
  priority: number;
  requiresAction: boolean;
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
  contractId?: string;
  offerId?: string;
}

type OfferFact = { id:string; status:string; buyer_organization_id:string; seller_organization_id:string; buyer_name?:string; seller_name?:string };
type DealFact = {
  id:string; seller_organization_id:string; buyer_organization_id:string; seller_name:string; buyer_name:string;
  fee_status?:string;fee_payer_organization_id?:string;fee_amount?:string;fee_payment_submitted?:boolean;
  payment_terms_status:string; payment_plan:string; payment_request_id?:string; payment_status?:string; security_status?:string;
  installment_id?:string; installment_status?:string; installment_type?:string; amount_due?:number; currency?:string;
  cancellation_requested_by_organization_id?:string; delivery_accepted_at?:string; delivery_discrepancy_status?:string; shipment_id?:string; transport_coordinator_organization_id?:string; current_milestone?:string; status:string;
};

const money = (amount: unknown, currency = 'EUR') => new Intl.NumberFormat('en', { style:'currency', currency }).format(Number(amount || 0));
const pretty = (value: string) => String(value || '').split('_').join(' ');

export function buildTradeActions(offers:OfferFact[],deals:DealFact[],organizationId:string):TradeAction[]{
  const actions:TradeAction[]=[];
  for(const offer of offers.filter((item)=>item.status==='pending')){
    const seller=offer.seller_organization_id===organizationId;
    actions.push({id:`offer:${offer.id}`,kind:seller?'offer_decision':'offer_waiting',priority:seller?10:80,requiresAction:seller,
      title:seller?'New offer requires a decision':'Offer sent—awaiting supplier response',
      description:seller?`${offer.buyer_name||'A verified buyer'} submitted commercial terms for your supply.`:`${offer.seller_name||'The supplier'} has received your offer.`,
      actionLabel:seller?'Review offer':'View offer',actionPath:`/offers?tab=${seller?'received':'sent'}`,offerId:offer.id});
  }
  for(const deal of deals){
    const seller=deal.seller_organization_id===organizationId,buyer=deal.buyer_organization_id===organizationId;
    const room=`/deal-room/${deal.id}`,payment=deal.payment_request_id?`/payments/${deal.payment_request_id}`:room;
    if(deal.status==='cancelled'){
      actions.push({id:`deal:${deal.id}:cancelled`,kind:'complete',priority:100,requiresAction:false,title:'Trade cancelled',description:'Both parties agreed to close this unstarted trade. Released inventory is not automatically republished.',actionLabel:'View cancelled deal',actionPath:room,contractId:deal.id});continue;
    }
    if(deal.cancellation_requested_by_organization_id){
      const reviewer=deal.cancellation_requested_by_organization_id!==organizationId;
      actions.push({id:`deal:${deal.id}:cancellation`,kind:'waiting',priority:reviewer?8:65,requiresAction:reviewer,title:reviewer?'Review cancellation request':'Cancellation awaiting the other organization',description:'Inventory remains committed until the other party agrees and the safety checks pass.',actionLabel:reviewer?'Review cancellation':'View cancellation',actionPath:room,contractId:deal.id});continue;
    }
    if(deal.status==='settled'&&deal.fee_status==='invoiced'&&deal.fee_payer_organization_id===organizationId&&Number(deal.fee_amount)>0){
      actions.push({id:`deal:${deal.id}:fee`,kind:'payment',priority:35,requiresAction:!deal.fee_payment_submitted,title:deal.fee_payment_submitted?'Platform fee awaiting receipt verification':'Review and pay the platform fee',description:'The trade is complete. Platform fee collection is separate from the goods payment.',actionLabel:'Review fee statement',actionPath:room,contractId:deal.id});
    }
    if(deal.status==='settled'){
      actions.push({id:`deal:${deal.id}:complete`,kind:'complete',priority:100,requiresAction:false,title:'Trade completed',description:`Delivery and settlement with ${seller?deal.buyer_name:deal.seller_name} are recorded.`,actionLabel:'View completed deal',actionPath:room,contractId:deal.id});continue;
    }
    if(deal.delivery_discrepancy_status){
      const actor=deal.delivery_discrepancy_status==='open'?seller:buyer;
      actions.push({id:`deal:${deal.id}:discrepancy`,kind:'delivery',priority:12,requiresAction:actor,title:actor?(seller?'Propose a delivery resolution':'Review delivery resolution'):'Delivery discrepancy awaiting the other party',description:'Trade completion is paused. Review the evidence and agree a resolution before accepting delivery.',actionLabel:'Review delivery',actionPath:room,contractId:deal.id});continue;
    }
    if(deal.current_milestone==='delivered'&&!deal.delivery_accepted_at){
      actions.push({id:`deal:${deal.id}:acceptance`,kind:buyer?'delivery':'waiting',priority:18,requiresAction:buyer,title:buyer?'Inspect and accept delivered goods':'Awaiting buyer delivery acceptance',description:'Physical delivery is reported. The buyer must inspect the quantity and condition; report any discrepancy before acceptance.',actionLabel:'Review delivery',actionPath:room,contractId:deal.id});continue;
    }
    if(deal.payment_terms_status==='draft'){
      actions.push({id:`deal:${deal.id}:terms`,kind:seller?'configure_terms':'waiting',priority:seller?15:75,requiresAction:seller,
        title:seller?'Set the payment protection plan':'Offer accepted—supplier preparing payment terms',
        description:seller?'Choose the payment condition before the buyer can review or confirm it.':`${deal.seller_name} must propose the payment protection terms next.`,
        actionLabel:seller?'Configure protection':'View deal',actionPath:room,contractId:deal.id});continue;
    }
    if(deal.payment_terms_status==='proposed'){
      actions.push({id:`deal:${deal.id}:terms`,kind:buyer?'confirm_terms':'waiting',priority:buyer?15:75,requiresAction:buyer,
        title:buyer?'Review and confirm payment terms':'Payment terms sent—awaiting buyer confirmation',
        description:buyer?`${deal.seller_name} proposed ${pretty(deal.payment_plan)}.`:`${deal.buyer_name} must confirm the proposed terms.`,
        actionLabel:buyer?'Review terms':'View deal',actionPath:room,contractId:deal.id});continue;
    }
    if(deal.payment_plan==='bank_secured'&&deal.security_status!=='verified'){
      const submitted=deal.security_status==='submitted',actor=submitted?seller:buyer;
      actions.push({id:`deal:${deal.id}:security`,kind:submitted?'payment_verification':'payment',priority:actor?20:70,requiresAction:actor,
        title:submitted?(seller?'Verify submitted bank security':'Bank security awaiting seller verification'):(buyer?'Submit the agreed bank security':'Awaiting buyer bank security'),
        description:submitted?'The security reference must be verified before dispatch.':'Dispatch remains blocked until the agreed security is submitted and verified.',
        actionLabel:actor?(submitted?'Verify security':'Submit security'):'View payment status',actionPath:payment,contractId:deal.id});continue;
    }
    if(deal.installment_status==='payment_submitted'){
      actions.push({id:`deal:${deal.id}:payment`,kind:seller?'payment_verification':'waiting',priority:seller?20:70,requiresAction:seller,
        title:seller?'Verify funds received':'Payment submitted—awaiting supplier verification',
        description:seller?`${deal.buyer_name} submitted a reference. Check the receiving account before confirming.`:`${deal.seller_name} must verify receipt before the payment counts as cleared.`,
        actionLabel:seller?'Verify payment':'View payment',actionPath:room,contractId:deal.id});continue;
    }
    if(deal.installment_status==='due'){
      actions.push({id:`deal:${deal.id}:payment`,kind:buyer?'payment':'waiting',priority:buyer?20:70,requiresAction:buyer,
        title:buyer?'Complete the due payment':'Awaiting buyer payment',
        description:buyer?`${money(deal.amount_due,deal.currency)} is due for the ${pretty(deal.installment_type||'payment')}.`:`${deal.buyer_name} must submit the due ${pretty(deal.installment_type||'payment')}.`,
        actionLabel:buyer?'Submit payment':'View deal',actionPath:room,contractId:deal.id});continue;
    }
    const milestone=deal.current_milestone||'planning';
    if(['arrived','customs_cleared'].includes(milestone)){
      actions.push({id:`deal:${deal.id}:delivery`,kind:buyer?'delivery':'waiting',priority:buyer?30:70,requiresAction:buyer,title:buyer?'Confirm final delivery':'Shipment awaiting buyer receipt',description:buyer?'Review the received goods and record delivery when appropriate.':`${deal.buyer_name} is responsible for confirming receipt.`,actionLabel:buyer?'Confirm delivery':'Track shipment',actionPath:deal.shipment_id?`/shipments/${deal.shipment_id}`:room,contractId:deal.id});continue;
    }
    if(milestone==='delivered'){
      actions.push({id:`deal:${deal.id}:settlement`,kind:'waiting',priority:65,requiresAction:false,title:'Delivery recorded—awaiting settlement',description:'The deal will close automatically when every payment installment is seller-verified.',actionLabel:'View deal',actionPath:room,contractId:deal.id});continue;
    }
    const coordinator=deal.transport_coordinator_organization_id===organizationId;
    actions.push({id:`deal:${deal.id}:transport`,kind:coordinator?'transport':'waiting',priority:coordinator?30:70,requiresAction:coordinator,title:coordinator?'Continue fulfilment and transport':`Shipment progress: ${pretty(milestone)}`,description:coordinator?'The payment release conditions are satisfied. Record the next physical milestone.':`The assigned coordinator is updating transport progress.`,actionLabel:coordinator?'Continue transport':'Track shipment',actionPath:deal.shipment_id?`/shipments/${deal.shipment_id}`:room,contractId:deal.id});
  }
  return actions.sort((a,b)=>a.priority-b.priority||a.title.localeCompare(b.title));
}
