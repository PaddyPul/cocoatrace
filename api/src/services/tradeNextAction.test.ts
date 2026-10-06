import { describe,expect,it } from 'vitest';
import { buildTradeActions } from './tradeNextAction';

const seller='seller',buyer='buyer';
const deal=(extra:Record<string,unknown>={})=>({id:'deal',seller_organization_id:seller,buyer_organization_id:buyer,seller_name:'Supplier',buyer_name:'Buyer',payment_terms_status:'draft',payment_plan:'deposit_balance',status:'accepted',...extra} as any);

describe('role-aware trade next actions',()=>{
  it('asks the supplier to configure terms before the buyer can confirm',()=>{
    expect(buildTradeActions([], [deal()], seller)[0]).toMatchObject({kind:'configure_terms',requiresAction:true});
    expect(buildTradeActions([], [deal()], buyer)[0]).toMatchObject({kind:'waiting',requiresAction:false,title:'Offer accepted—supplier preparing payment terms'});
  });
  it('asks only the buyer to confirm proposed terms',()=>{
    expect(buildTradeActions([], [deal({payment_terms_status:'proposed'})], buyer)[0]).toMatchObject({kind:'confirm_terms',requiresAction:true});
    expect(buildTradeActions([], [deal({payment_terms_status:'proposed'})], seller)[0].requiresAction).toBe(false);
  });
  it('separates buyer payment submission from seller verification',()=>{
    const due=deal({payment_terms_status:'agreed',installment_status:'due',amount_due:200,currency:'EUR'});
    expect(buildTradeActions([], [due], buyer)[0].kind).toBe('payment');
    const submitted=deal({payment_terms_status:'agreed',installment_status:'payment_submitted'});
    expect(buildTradeActions([], [submitted], seller)[0].kind).toBe('payment_verification');
  });
  it('puts a pending offer on the seller action list and buyer waiting list',()=>{
    const offer={id:'offer',status:'pending',seller_organization_id:seller,buyer_organization_id:buyer};
    expect(buildTradeActions([offer],[],seller)[0]).toMatchObject({kind:'offer_decision',requiresAction:true});
    expect(buildTradeActions([offer],[],buyer)[0]).toMatchObject({kind:'offer_waiting',requiresAction:false});
  });
});

describe('delivery consent', () => {
  it('prompts the buyer to inspect delivered goods independently of payment', () => {
    const delivered=deal({payment_terms_status:'agreed',current_milestone:'delivered',payment_status:'settled'});
    expect(buildTradeActions([], [delivered], buyer)[0]).toMatchObject({kind:'delivery',requiresAction:true,title:'Inspect and accept delivered goods'});
    expect(buildTradeActions([], [delivered], seller)[0].requiresAction).toBe(false);
  });
  it('prioritizes supplier resolution and buyer approval during a discrepancy', () => {
    expect(buildTradeActions([], [deal({delivery_discrepancy_status:'open'})], seller)[0].requiresAction).toBe(true);
    expect(buildTradeActions([], [deal({delivery_discrepancy_status:'resolution_proposed'})], buyer)[0].requiresAction).toBe(true);
  });
});

 it('prioritizes the other organization’s cancellation review and never asks a cancelled trade to pay', () => {
   expect(buildTradeActions([], [deal({cancellation_requested_by_organization_id: seller})], buyer)[0]).toMatchObject({requiresAction:true,title:'Review cancellation request'});
   expect(buildTradeActions([], [deal({cancellation_requested_by_organization_id: seller})], seller)[0].requiresAction).toBe(false);
   expect(buildTradeActions([], [deal({status:'cancelled',installment_status:'due'})], buyer)[0]).toMatchObject({requiresAction:false,title:'Trade cancelled',kind:'complete'});
 });

describe('separate platform fee action',()=>{
 it('keeps trade completed while prompting only the recorded fee payer',()=>{
   const d=deal({status:'settled',fee_status:'invoiced',fee_payer_organization_id:seller,fee_amount:'0.20'});
   const supplierActions=buildTradeActions([], [d], seller);
   expect(supplierActions.some(a=>a.title==='Trade completed')).toBe(true);
   expect(supplierActions[0]).toMatchObject({title:'Review and pay the platform fee',requiresAction:true});
   expect(buildTradeActions([], [d], buyer).some(a=>a.id.endsWith(':fee'))).toBe(false);
 });
 it('submitted fee waits for platform receipt and zero fees never prompt payment',()=>{
   const d=deal({status:'settled',fee_status:'invoiced',fee_payer_organization_id:seller,fee_amount:'0.20',fee_payment_submitted:true});
   expect(buildTradeActions([], [d], seller)[0]).toMatchObject({title:'Platform fee awaiting receipt verification',requiresAction:false});
   expect(buildTradeActions([], [deal({...d,fee_amount:'0.00'})], seller).some(a=>a.id.endsWith(':fee'))).toBe(false);
 });
});

describe('Incoterm dashboard handoffs',()=>{
 it('FOB cargo preparation belongs to seller after buyer booking',()=>{
  const d=deal({incoterm:'FOB',payment_terms_status:'agreed',current_milestone:'booked',transport_coordinator_organization_id:buyer});
  expect(buildTradeActions([], [d],seller)[0]).toMatchObject({requiresAction:true,title:'Next transport action: cargo ready'});
  expect(buildTradeActions([], [d],buyer)[0]).toMatchObject({requiresAction:false,title:'Awaiting seller: cargo ready'});
 });
 it('DDP clearance and DPU unloading stay with seller before buyer receipt',()=>{
  for(const [incoterm,current_milestone] of [['DDP','arrived'],['DPU','customs_cleared']]) {
   const d=deal({incoterm,current_milestone,payment_terms_status:'agreed',transport_coordinator_organization_id:seller});
   expect(buildTradeActions([], [d],seller)[0].requiresAction).toBe(true);
   expect(buildTradeActions([], [d],buyer)[0].requiresAction).toBe(false);
  }
 });
});
